import AppRoutes from './AppRoutes.jsx';
import PayWatcher from './components/PayWatcher.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import ScrollMemory from './components/ScrollMemory.jsx';
import OnboardingGate from './components/OnboardingGate.jsx';
import TabBar from './ui-next/TabBar.jsx';
import NextHome from './ui-next/NextHome.jsx';
import './ui-next/widgets.css';
import './ui-next/next-type.css';
import './ui-next/next.css';
import ProfilePage from './ui-next/ProfilePage.jsx';
import { useEffect } from 'react';
import Tour from './tour/Tour.jsx';
import PushBanner from './components/PushBanner.jsx';
import { Route, useNavigate } from 'react-router-dom';

// Тап по пушу, коли додаток уже відкритий: сервіс-воркер надсилає адресу, переходимо прямо в діалог.
function PushOpen() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const on = (e) => {
      const d = e.data;
      if (!d || d.type !== 'push-open' || !d.url) return;
      try {
        const h = new URL(d.url).hash;
        if (h && h.startsWith('#/')) navigate(h.slice(1));
      } catch {
        /* ignore */
      }
    };
    navigator.serviceWorker.addEventListener('message', on);
    return () => navigator.serviceWorker.removeEventListener('message', on);
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <div className="app">
      <ScrollMemory />
      <OnboardingGate />
      <UpdateBanner />
      <PayWatcher />
      <PushOpen />
      <PushBanner />
      <Tour />
      <AppRoutes extra={<><Route path="/" element={<NextHome />} /><Route path="/profile" element={<ProfilePage />} /></>} />
      <TabBar />
    </div>
  );
}
