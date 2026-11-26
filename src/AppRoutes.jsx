import { lazy, Suspense, useEffect } from 'react';
import { useAuth } from './auth/index.jsx';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import AdminBoundary from './admin/AdminBoundary.jsx';


const Schedule = lazy(() => import('./pages/Schedule.jsx'));
const Section = lazy(() => import('./pages/Section.jsx'));
const Exercise = lazy(() => import('./pages/Exercise.jsx'));
const Anatomy = lazy(() => import('./pages/Anatomy.jsx'));
const Plans = lazy(() => import('./pages/Plans.jsx'));
const MyProgram = lazy(() => import('./pages/MyProgram.jsx'));
const Equipment = lazy(() => import('./pages/Equipment.jsx'));
const Feedback = lazy(() => import('./pages/Feedback.jsx'));
const ChatInbox = lazy(() => import('./admin/ChatInbox.jsx'));
const ChatAdminThread = lazy(() => import('./admin/ChatAdminThread.jsx'));
const Chat = lazy(() => import('./pages/Chat.jsx'));
const PushAdmin = lazy(() => import('./admin/PushAdmin.jsx'));
const Students = lazy(() => import('./admin/Students.jsx'));
const ScheduleAdmin = lazy(() => import('./admin/ScheduleAdmin.jsx'));
const PaymentsAdmin = lazy(() => import('./admin/PaymentsAdmin.jsx'));
const ChallengesAdmin = lazy(() => import('./admin/ChallengesAdmin.jsx'));
const StorageAdmin = lazy(() => import('./admin/StorageAdmin.jsx'));
const ContentAdmin = lazy(() => import('./admin/ContentAdmin.jsx'));
const SectionEditor = lazy(() => import('./admin/SectionEditor.jsx'));
const ExerciseEditor = lazy(() => import('./admin/ExerciseEditor.jsx'));
const EquipmentAdmin = lazy(() => import('./admin/EquipmentAdmin.jsx'));
const FeedbackAdmin = lazy(() => import('./admin/FeedbackAdmin.jsx'));

// Маршрути, спільні для класичного й нового інтерфейсу. extra: додаткові <Route> (наприклад, /profile у новому).
export default function AppRoutes({ extra = null }) {
  const { isAdmin } = useAuth();
  // Тренеру заздалегідь підвантажуємо адмінські сторінки, щоб перехід не чекав на завантаження (раніше був порожній екран)
  // Сторінки учня вантажаться окремими файлами; після першого показу підтягуємо їх у фоні, щоб перехід був миттєвий
  useEffect(() => {
    const warm = () => ['Chat', 'Schedule', 'Section', 'Exercise', 'Anatomy', 'Plans', 'MyProgram', 'Equipment', 'Feedback'].forEach((n) => import(`./pages/${n}.jsx`));
    const id = 'requestIdleCallback' in window ? window.requestIdleCallback(warm, { timeout: 3000 }) : setTimeout(warm, 1200);
    return () => ('cancelIdleCallback' in window ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, []);
  useEffect(() => {
    if (!isAdmin) return undefined;
    const warm = () => {
      import('./admin/Students.jsx');
      import('./admin/ScheduleAdmin.jsx');
      import('./admin/PaymentsAdmin.jsx');
      import('./admin/ChallengesAdmin.jsx');
      import('./admin/StorageAdmin.jsx');
      import('./admin/ContentAdmin.jsx');
      import('./admin/SectionEditor.jsx');
      import('./admin/ExerciseEditor.jsx');
      import('./admin/EquipmentAdmin.jsx');
    };
    const id = 'requestIdleCallback' in window ? window.requestIdleCallback(warm, { timeout: 4000 }) : setTimeout(warm, 1500);
    return () => ('cancelIdleCallback' in window ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, [isAdmin]);
  return (
  <Suspense fallback={null}>
  <Routes>
    {extra}
    <Route path="/" element={<Home />} />
    <Route path="/schedule" element={<Schedule />} />
    <Route path="/section/:category" element={<Section />} />
    <Route path="/exercise/:id" element={<Exercise />} />
    <Route
      path="/admin/schedule"
      element={
        <AdminBoundary>
          <ScheduleAdmin />
        </AdminBoundary>
      }
    />
    <Route
      path="/admin/content"
      element={
        <AdminBoundary>
          <ContentAdmin />
        </AdminBoundary>
      }
    />
    <Route
      path="/admin/content/:sid"
      element={
        <AdminBoundary>
          <SectionEditor />
        </AdminBoundary>
      }
    />
    <Route
      path="/admin/content/:sid/:eid"
      element={
        <AdminBoundary>
          <ExerciseEditor />
        </AdminBoundary>
      }
    />
    <Route path="/plans" element={<Plans />} />
    <Route path="/equipment" element={<Equipment />} />
    <Route path="/program/:id" element={<MyProgram />} />
    <Route
      path="/admin/equipment"
      element={
        <AdminBoundary>
          <EquipmentAdmin />
        </AdminBoundary>
      }
    />
    <Route path="/chat" element={<Chat />} />
    <Route
      path="/admin/chat"
      element={
        <AdminBoundary>
          <ChatInbox />
        </AdminBoundary>
      }
    />
    <Route
      path="/admin/chat/:sid"
      element={
        <AdminBoundary>
          <ChatAdminThread />
        </AdminBoundary>
      }
    />
    <Route
      path="/admin/push"
      element={
        <AdminBoundary>
          <PushAdmin />
        </AdminBoundary>
      }
    />
    <Route
      path="/admin/challenges"
      element={
        <AdminBoundary>
          <ChallengesAdmin />
        </AdminBoundary>
      }
    />
    <Route
      path="/admin/payments"
      element={
        <AdminBoundary>
          <PaymentsAdmin />
        </AdminBoundary>
      }
    />
    <Route
      path="/admin/storage"
      element={
        <AdminBoundary>
          <StorageAdmin />
        </AdminBoundary>
      }
    />
    <Route path="/feedback" element={<Feedback />} />
    <Route
      path="/admin/feedback"
      element={
        <AdminBoundary>
          <FeedbackAdmin />
        </AdminBoundary>
      }
    />
    <Route path="/anatomy" element={<Anatomy />} />
    <Route
      path="/admin/students"
      element={
        <AdminBoundary>
          <Students />
        </AdminBoundary>
      }
    />
    <Route path="*" element={<Home />} />
  </Routes>
  </Suspense>
  );
}
