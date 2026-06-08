import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { markTourSeen, isTourSeen } from './IntroTour';

type Step = 'about' | 'done';

export function FirstRunController() {
  const { player, sessionUnlockRequired } = useAuth();
  const navigate = useNavigate();
  // Start as 'done' if global key set (returning user); re-evaluated per-user below.
  const [step, setStep] = useState<Step>(() => (isTourSeen() ? 'done' : 'about'));

  // Re-check with per-user key once player identity is known.
  // This catches new accounts on a device where a different account already exists.
  useEffect(() => {
    if (!player) return;
    if (!isTourSeen(player.id)) setStep('about');
  }, [player?.id]);

  useEffect(() => {
    if (step !== 'about' || !player || sessionUnlockRequired) return;
    markTourSeen(player.id);
    navigate('/about');
    setStep('done');
  }, [step, navigate, player, sessionUnlockRequired]);

  return null;
}
