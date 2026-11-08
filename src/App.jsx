import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Schedule from './pages/Schedule.jsx';
import Section from './pages/Section.jsx';
import Exercise from './pages/Exercise.jsx';
import Anatomy from './pages/Anatomy.jsx';
import Students from './pages/Students.jsx';
import OnboardingGate from './components/OnboardingGate.jsx';

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
        <Route path="/admin/students" element={<Students />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}
