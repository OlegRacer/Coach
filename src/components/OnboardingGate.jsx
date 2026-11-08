import Onboarding from './Onboarding.jsx';
import { useAuth } from '../auth/index.jsx';

// Показує анкету автоматично, поки учень її не заповнив (або не натиснув «Не зараз»).
export default function OnboardingGate() {
  const { needsOnboarding, dismissOnboarding } = useAuth();
  return needsOnboarding ? <Onboarding onClose={dismissOnboarding} /> : null;
}
