import { lazy, Suspense } from 'react';
import { useUi } from './lib/ui.jsx';
import AppRoutes from './AppRoutes.jsx';
import PayWatcher from './components/PayWatcher.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import ScrollMemory from './components/ScrollMemory.jsx';
import OnboardingGate from './components/OnboardingGate.jsx';

const NextApp = lazy(() => import('./ui-next/NextApp.jsx'));

export default function App() {
  const { ui } = useUi();
  if (ui === 'next') {
    return (
      <div className="app">
        <UpdateBanner />
        <Suspense fallback={null}>
          <NextApp />
        </Suspense>
      </div>
    );
  }
  return (
    <div className="app">
      <ScrollMemory />
      <OnboardingGate />
      <UpdateBanner />
      <PayWatcher />
      <AppRoutes />
    </div>
  );
}
