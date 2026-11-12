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

export async function enablePush(userId, lang) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  const r = await reg();
  const sub = (await r.pushManager.getSubscription()) || (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC) }));
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, lang, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' }
  );
  if (error) return { ok: false, reason: 'db', error };
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
