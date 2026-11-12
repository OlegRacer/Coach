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
  test: { uk: 'Сповіщення працюють', en: 'Notifications work', 'zh-TW': '通知正常' }
};

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
  let body: { type?: string; id?: string } = {};
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
    const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin');
    const who = (r.student && (r.student.full_name || r.student.email)) || '';
    const n = await send((admins || []).map((a) => a.id), (l) => ({
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
