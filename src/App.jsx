import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Schedule from './pages/Schedule.jsx';
import Section from './pages/Section.jsx';
import Exercise from './pages/Exercise.jsx';
import Anatomy from './pages/Anatomy.jsx';
import Plans from './pages/Plans.jsx';
import AdminBoundary from './admin/AdminBoundary.jsx';
import PayWatcher from './components/PayWatcher.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import OnboardingGate from './components/OnboardingGate.jsx';

// Адмінка вантажиться окремим шматком коду, тільки коли її відкривають.
const Students = lazy(() => import('./admin/Students.jsx'));
const ScheduleAdmin = lazy(() => import('./admin/ScheduleAdmin.jsx'));
const PaymentsAdmin = lazy(() => import('./admin/PaymentsAdmin.jsx'));
const StorageAdmin = lazy(() => import('./admin/StorageAdmin.jsx'));
const ContentAdmin = lazy(() => import('./admin/ContentAdmin.jsx'));
const SectionEditor = lazy(() => import('./admin/SectionEditor.jsx'));
const ExerciseEditor = lazy(() => import('./admin/ExerciseEditor.jsx'));

export default function App() {
  return (
    <div className="app">
      <OnboardingGate />
      <UpdateBanner />
      <PayWatcher />
      <Routes>
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
    </div>
  );
}
