import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Schedule from './pages/Schedule.jsx';
import Section from './pages/Section.jsx';
import Exercise from './pages/Exercise.jsx';
import Anatomy from './pages/Anatomy.jsx';
import AdminBoundary from './admin/AdminBoundary.jsx';
import OnboardingGate from './components/OnboardingGate.jsx';

// Адмінка вантажиться окремим шматком коду, тільки коли її відкривають.
const Students = lazy(() => import('./admin/Students.jsx'));

export default function App() {
  return (
    <div className="app">
      <OnboardingGate />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/section/:category" element={<Section />} />
        <Route path="/exercise/:id" element={<Exercise />} />
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
