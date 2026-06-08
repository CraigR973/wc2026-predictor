import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { markTourSeen, isTourSeen } from './IntroTour';

type Step = 'about' | 'done';

function initialStep(): Step {
  if (!isTourSeen()) return 'about';
  return 'done';
}

export function FirstRunController() {
  const { player, sessionUnlockRequired } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(initialStep);

  // New users land on About instead of the swipe tour.
  useEffect(() => {
    if (step !== 'about' || !player || sessionUnlockRequired) return;
    markTourSeen();
    navigate('/about');
    setStep('done');
  }, [step, navigate, player, sessionUnlockRequired]);

  return null;
}
