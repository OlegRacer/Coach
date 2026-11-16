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
import { Route } from 'react-router-dom';

export default function App() {
  return (
    <div className="app">
      <ScrollMemory />
      <OnboardingGate />
      <UpdateBanner />
      <PayWatcher />
      <AppRoutes extra={<><Route path="/" element={<NextHome />} /><Route path="/profile" element={<ProfilePage />} /></>} />
      <TabBar />
    </div>
  );
}
