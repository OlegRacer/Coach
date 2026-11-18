import { supabase } from './supabase.js';

// Публічний VAPID-ключ (приватний лежить лише в секретах Edge Function).
export const VAPID_PUBLIC = 'BKEcjABY_VII2_v2_e1ucANPuot2GzCa1ifC28j_gId87mwqqvZoQAerrKMpnxKMi5rEg-jQZRGAkhI0iqrR1l0';

const b64 = (s) => {
  const p = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// На iPhone пуші працюють лише у встановленому на екран «Додому» додатку.
export const isIosBrowserTab = () => {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  return ios && !standalone;
};

const reg = () => navigator.serviceWorker.ready;

export async function currentSubscription() {
  if (!pushSupported()) return null;
  try {
    return await (await reg()).pushManager.getSubscription();
  } catch {
    return null;
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function enablePush(userId, lang) {
  // Реєстрацію сервіс-воркера чекаємо ДО запиту дозволу: iOS швидко «гасить» жест після діалогу дозволу
  const r = await reg();
  const had = await r.pushManager.getSubscription();
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  let sub = had;
  let last = null;
  for (let i = 0; i < 4 && !sub; i++) {
    try {
      sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC) });
    } catch (e) {
      last = e;
      await wait(500);
    }
  }
  if (!sub) return { ok: false, reason: 'sub', detail: last ? `${last.name || ''} ${last.message || ''}`.trim() : '' };
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, lang, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' }
  );
  if (error) return { ok: false, reason: 'db', detail: `${error.code || ''} ${error.message || ''}`.trim() };
  return { ok: true };
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export async function testPush() {
  const { data, error } = await supabase.functions.invoke('push', { body: { type: 'test' } });
  return { data, error };
}
