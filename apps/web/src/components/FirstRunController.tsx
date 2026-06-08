import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { markTourSeen, isTourSeen } from './IntroTour';

type Step = 'about' | 'done';

export function FirstRunController() {
  const { player, sessionUnlockRequired } = useAuth();
  const navigate = useNavigate();
  // Start as 'done'; the per-user effect below sets 'about' for new users once
  // the player identity is known. The global key (isTourSeen() without id) was
  // never written after U49, so using it here caused every return visit to
  // redirect to /about on every load.
  const [step, setStep] = useState<Step>('done');

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
