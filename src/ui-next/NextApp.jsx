import { Route } from 'react-router-dom';
import AppRoutes from '../AppRoutes.jsx';
import TabBar from './TabBar.jsx';
import NextHome from './NextHome.jsx';
import ProfilePage from './ProfilePage.jsx';
import PayWatcher from '../components/PayWatcher.jsx';
import ScrollMemory from '../components/ScrollMemory.jsx';
import OnboardingGate from '../components/OnboardingGate.jsx';
import './next-type.css';
import './next.css';

// Новий інтерфейс (iOS 26/27, Liquid Glass): ті самі сторінки й дані, нова оболонка:
// нижня панель вкладок, скляні верхні панелі, тема за системою (світла/темна), правила доступності.
// Усі стилі лише під html[data-ui="next"], тому класичний інтерфейс не зачеплений.
export default function NextApp() {
  return (
    <>
      <ScrollMemory />
      <OnboardingGate />
      <PayWatcher />
      <AppRoutes extra={<><Route path="/" element={<NextHome />} /><Route path="/profile" element={<ProfilePage />} /></>} />
      <TabBar />
    </>
  );
}
