// Edge Function «line-login»: вхід через LINE.
// Чому окрема функція: LINE при вході з браузера підписує ID-токен алгоритмом HS256, а власні OIDC-провайдери
// Supabase приймають лише ES256, тому стандартне підключення LINE не працює. Тут ми самі обмінюємо код на токен,
// перевіряємо його в LINE і видаємо застосунку одноразовий токен входу Supabase.
// Налаштування: Verify JWT = вимкнено; секрети LINE_CHANNEL_ID, LINE_CHANNEL_SECRET
// (необов'язково APP_ORIGINS: адреси сайту через кому, за замовчуванням https://olegracer.github.io).
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const CHANNEL_ID = Deno.env.get('LINE_CHANNEL_ID') || '';
const CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET') || '';
const ORIGINS = (Deno.env.get('APP_ORIGINS') || 'https://olegracer.github.io').split(',').map((s) => s.trim()).filter(Boolean);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sign(text: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(CHANNEL_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

// state/nonce без збереження на сервері: випадкове значення + час + підпис. Живе 15 хвилин.
async function makeState() {
  const body = `${b64url(crypto.getRandomValues(new Uint8Array(12)))}.${Date.now()}`;
  return `${body}.${await sign(body)}`;
}
async function checkState(state: string) {
  const parts = String(state || '').split('.');
  if (parts.length !== 3) return false;
  const body = `${parts[0]}.${parts[1]}`;
  if ((await sign(body)) !== parts[2]) return false;
  const age = Date.now() - Number(parts[1]);
  return age >= 0 && age < 15 * 60 * 1000;
}

function redirectOk(uri: string) {
  try {
    const u = new URL(uri);
    return ORIGINS.includes(u.origin) && u.pathname.endsWith('/line-callback.html');
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!CHANNEL_ID || !CHANNEL_SECRET) return json({ error: 'LINE_CHANNEL_ID / LINE_CHANNEL_SECRET не задані в Secrets' }, 500);
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  const redirectUri = String(body.redirect_uri || '');
  if (!redirectOk(redirectUri)) return json({ error: 'redirect_uri не дозволено (перевірте APP_ORIGINS)' }, 400);

  // 1) Адреса сторінки входу LINE
  if (body.action === 'url') {
    const state = await makeState();
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: CHANNEL_ID,
      redirect_uri: redirectUri,
      state,
      scope: 'openid profile',
      nonce: state
    });
    return json({ url: `https://access.line.me/oauth2/v2.1/authorize?${q}`, state });
  }

  // 2) Обмін коду на токен, перевірка і видача входу
  if (body.action === 'login') {
    if (!(await checkState(body.state))) return json({ error: 'state недійсний або прострочений, спробуйте ще раз' }, 400);
    const tok = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(body.code || ''),
        redirect_uri: redirectUri,
        client_id: CHANNEL_ID,
        client_secret: CHANNEL_SECRET
      })
    });
    const t = await tok.json();
    if (!tok.ok || !t.id_token) return json({ error: `LINE token: ${t.error_description || t.error || tok.status}` }, 400);

    // LINE сам перевіряє підпис (HS256) і nonce
    const ver = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: t.id_token, client_id: CHANNEL_ID, nonce: body.state })
    });
    const c = await ver.json();
    if (!ver.ok || !c.sub) return json({ error: `LINE verify: ${c.error_description || c.error || ver.status}` }, 400);

    const email = `line_${String(c.sub).toLowerCase()}@line.local`;
    const name = c.name || 'LINE';
    const { error: ce } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: name, name, avatar_url: c.picture || null, line_id: c.sub },
      app_metadata: { provider: 'line', providers: ['line'] }
    });
    // «вже існує» не помилка: це повторний вхід
    if (ce && !/already|registered|exists/i.test(ce.message)) return json({ error: `create user: ${ce.message}` }, 500);

    const { data, error: le } = await db.auth.admin.generateLink({ type: 'magiclink', email });
    if (le || !data?.properties?.hashed_token) return json({ error: `link: ${le?.message || 'no token'}` }, 500);
    return json({ token_hash: data.properties.hashed_token });
  }

  return json({ error: 'unknown action' }, 400);
});
