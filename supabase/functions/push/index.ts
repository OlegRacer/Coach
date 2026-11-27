// Edge Function «push»: надсилає пуш-сповіщення.
// Викликається тригером бази (нова оплата, рішення по оплаті) і кнопкою «Тест» у додатку.
// Налаштування: Verify JWT = вимкнено; секрети VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'https://olegracer.github.io/Coach/',
  Deno.env.get('VAPID_PUBLIC')!,
  Deno.env.get('VAPID_PRIVATE')!
);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Lang = 'uk' | 'en' | 'zh-TW';
const pick = (o: Record<string, string> | null, lang: Lang) => (o && (o[lang] || o.uk || o.en || o['zh-TW'])) || '';
const TXT = {
  newPay: { uk: 'Нова оплата', en: 'New payment', 'zh-TW': '新付款' },
  approved: { uk: 'Доступ відкрито', en: 'Access unlocked', 'zh-TW': '已開通' },
  rejected: { uk: 'Оплату не підтверджено', en: 'Payment not confirmed', 'zh-TW': '付款未確認' },
  coach: { uk: 'Тренер', en: 'Coach', 'zh-TW': '教練' },
  chal: { uk: 'Челендж: час тренування', en: 'Challenge: workout time', 'zh-TW': '挑戰：該訓練了' },
  test: { uk: 'Сповіщення працюють', en: 'Notifications work', 'zh-TW': '通知正常' }
};

// Ім'я учня: спершу з анкети (ім'я та прізвище), потім ім'я акаунта, потім пошта.
async function nameOf(id: string): Promise<string> {
  const [{ data: p }, { data: d }] = await Promise.all([
    db.from('profiles').select('full_name, email').eq('id', id).maybeSingle(),
    db.from('student_details').select('first_name, last_name').eq('student_id', id).maybeSingle()
  ]);
  const own = d ? [d.first_name, d.last_name].filter(Boolean).join(' ').trim() : '';
  return own || (p && (p.full_name || (p.email || '').split('@')[0])) || '';
}

// Адміни, які не вимкнули цю категорію сповіщень (admin_push_prefs: { chat: false, payments: false }).
async function adminsFor(cat: string): Promise<string[]> {
  const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin');
  const ids = (admins || []).map((a) => a.id);
  if (!ids.length) return [];
  const { data: prefs } = await db.from('admin_push_prefs').select('user_id, prefs').in('user_id', ids);
  const off = new Set((prefs || []).filter((p) => p.prefs && p.prefs[cat] === false).map((p) => p.user_id));
  return ids.filter((id) => !off.has(id));
}

async function send(userIds: string[], build: (lang: Lang) => { title: string; body: string; url: string; tag?: string }) {
  if (!userIds.length) return 0;
  const { data: subs } = await db.from('push_subscriptions').select('*').in('user_id', userIds);
  let sent = 0;
  await Promise.all((subs || []).map(async (s) => {
    const lang = (['uk', 'en', 'zh-TW'].includes(s.lang) ? s.lang : 'uk') as Lang;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(build(lang)));
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
    }
  }));
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  let body: { type?: string; id?: string; student_id?: string; item_id?: string; mode?: string; ids?: string[]; title?: string; text?: string; dry?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  // Тест: лише для залогіненого користувача, надсилає йому самому.
  if (body.type === 'test') {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data } = await db.auth.getUser(token);
    if (!data || !data.user) return json({ error: 'unauthorized' }, 401);
    const n = await send([data.user.id], (l) => ({ title: TXT.test[l], body: 'OK', url: './', tag: 'test' }));
    return json({ sent: n });
  }

  // Розсилка від тренера: усім, студіям, класам або окремим учням. dry=true лише рахує отримувачів.
  if (body.type === 'broadcast') {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = await db.auth.getUser(token);
    if (!u || !u.user) return json({ error: 'unauthorized' }, 401);
    const { data: me } = await db.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
    if (!me || me.role !== 'admin') return json({ error: 'forbidden' }, 403);
    const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string') : [];
    let users: string[] = [];
    if (body.mode === 'all') {
      const { data } = await db.from('profiles').select('id').neq('role', 'admin');
      users = (data || []).map((r) => r.id);
    } else if (body.mode === 'studios' && ids.length) {
      const { data } = await db.from('student_studios').select('student_id').in('studio_id', ids);
      users = (data || []).map((r) => r.student_id);
    } else if (body.mode === 'classes' && ids.length) {
      const { data } = await db.from('student_classes').select('student_id').in('class_id', ids);
      users = (data || []).map((r) => r.student_id);
    } else if (body.mode === 'students' && ids.length) {
      users = ids;
    }
    users = [...new Set(users)];
    const { data: subs } = users.length ? await db.from('push_subscriptions').select('user_id').in('user_id', users) : { data: [] };
    const reachable = new Set((subs || []).map((r) => r.user_id)).size;
    if (body.dry) return json({ recipients: users.length, reachable });
    const text = String(body.text || '').trim().slice(0, 300);
    const title = 'CoachApp';
    if (!text) return json({ error: 'empty' }, 400);
    const sent = await send(users, () => ({ title, body: text, url: './', tag: 'bc-' + Date.now() }));
    return json({ recipients: users.length, reachable, sent });
  }

  // Нагадування про заняття челенджу. Викликає функція бази challenge_reminders(): вона спершу пише рядок
  // у challenge_notified, тож без свіжого неналаштованого рядка (до 10 хв) нічого не надсилаємо.
  if (body.type === 'challenge_item') {
    if (!body.student_id || !body.item_id) return json({ error: 'no_id' }, 400);
    const { data: n } = await db.from('challenge_notified').select('*').eq('student_id', body.student_id).eq('item_id', body.item_id).maybeSingle();
    if (!n || n.sent_at || Date.now() - new Date(n.created_at).getTime() > 10 * 60 * 1000) return json({ skipped: true });
    await db.from('challenge_notified').update({ sent_at: new Date().toISOString() }).eq('student_id', n.student_id).eq('item_id', n.item_id);
    const { data: it } = await db.from('challenge_items').select('title, challenge:challenges(title)').eq('id', body.item_id).maybeSingle();
    if (!it) return json({ error: 'not_found' }, 404);
    const sent = await send([body.student_id], (l) => ({
      title: TXT.chal[l],
      body: [pick(it.challenge && it.challenge.title, l), pick(it.title, l)].filter(Boolean).join(' · '),
      url: './#/schedule',
      tag: 'chal-' + body.item_id
    }));
    return json({ sent });
  }

  // Нове повідомлення в чаті (тригер бази). Текст беремо з бази за id; notified_at не дає надіслати двічі.
  if (body.type === 'chat_message') {
    if (!body.id) return json({ error: 'no_id' }, 400);
    const { data: m } = await db.from('chat_messages').select('*').eq('id', body.id).maybeSingle();
    if (!m) return json({ error: 'not_found' }, 404);
    if (m.notified_at) return json({ skipped: true });
    await db.from('chat_messages').update({ notified_at: new Date().toISOString() }).eq('id', m.id);
    const text = String(m.body).replace(/\s+/g, ' ').slice(0, 140);
    if (m.sender_id === m.student_id) {
      const who = await nameOf(m.student_id);
      const n = await send(await adminsFor('chat'), () => ({ title: who || 'Чат', body: text, url: './#/admin/chat/' + m.student_id, tag: 'chat-' + m.student_id }));
      return json({ sent: n });
    }
    const n = await send([m.student_id], (l) => ({ title: TXT.coach[l], body: text, url: './#/chat', tag: 'chat-' + m.student_id }));
    return json({ sent: n });
  }

  // Нове повідомлення в груповому чаті: учасникам (крім автора) і тренерам, які не вимкнули пуш чату.
  if (body.type === 'chat_group_message') {
    if (!body.id) return json({ error: 'no_id' }, 400);
    const { data: m } = await db.from('chat_group_messages').select('*').eq('id', body.id).maybeSingle();
    if (!m) return json({ error: 'not_found' }, 404);
    if (m.notified_at) return json({ skipped: true });
    await db.from('chat_group_messages').update({ notified_at: new Date().toISOString() }).eq('id', m.id);
    const [{ data: g }, { data: me }, { data: mem }] = await Promise.all([
      db.from('chat_groups').select('title').eq('id', m.group_id).maybeSingle(),
      db.from('profiles').select('full_name, email, role').eq('id', m.sender_id).maybeSingle(),
      db.from('chat_group_members').select('student_id').eq('group_id', m.group_id)
    ]);
    const who = await nameOf(m.sender_id);
    const text = String(m.body).replace(/\s+/g, ' ').slice(0, 140);
    const title = (g && g.title) || 'Чат';
    const students = (mem || []).map((x) => x.student_id).filter((id) => id !== m.sender_id);
    const admins = (await adminsFor('chat')).filter((id) => id !== m.sender_id);
    const n1 = await send(students, () => ({ title, body: `${who}: ${text}`, url: './#/chat/g/' + m.group_id, tag: 'cg-' + m.group_id }));
    const n2 = await send(admins, () => ({ title, body: `${who}: ${text}`, url: './#/admin/chat/g/' + m.group_id, tag: 'cg-' + m.group_id }));
    return json({ sent: n1 + n2 });
  }

  // Подальші типи викликає тригер бази. Дані беремо з бази за id, тож підробити текст неможливо,
  // а прапорці *_notified_at не дають надіслати те саме двічі.
  if (!body.id) return json({ error: 'no_id' }, 400);
  const { data: r } = await db
    .from('payment_requests')
    .select('*, student:profiles!payment_requests_student_id_fkey(full_name, email)')
    .eq('id', body.id)
    .maybeSingle();
  if (!r) return json({ error: 'not_found' }, 404);

  if (body.type === 'new_payment') {
    if (r.status !== 'pending' || r.admin_notified_at) return json({ skipped: true });
    await db.from('payment_requests').update({ admin_notified_at: new Date().toISOString() }).eq('id', r.id);
    const who = await nameOf(r.student_id);
    const n = await send(await adminsFor('payments'), (l) => ({
      title: TXT.newPay[l],
      body: `${who}: ${pick(r.plan.title, l)} · ${r.plan.price} ${r.plan.currency}`,
      url: './#/admin/payments',
      tag: 'pay-' + r.id
    }));
    return json({ sent: n });
  }

  if (body.type === 'payment_decided') {
    if (r.status === 'pending' || r.student_notified_at) return json({ skipped: true });
    await db.from('payment_requests').update({ student_notified_at: new Date().toISOString() }).eq('id', r.id);
    const n = await send([r.student_id], (l) => ({
      title: r.status === 'approved' ? TXT.approved[l] : TXT.rejected[l],
      body: pick(r.plan.title, l) + (r.status === 'rejected' && r.reject_reason ? ` · ${r.reject_reason}` : ''),
      url: r.status === 'approved' ? './#/' : './#/plans',
      tag: 'pay-' + r.id
    }));
    return json({ sent: n });
  }
  return json({ error: 'unknown_type' }, 400);
});
