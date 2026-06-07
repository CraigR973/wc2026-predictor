import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isFirstRunLaunchpadSeen } from '@/lib/firstRunLaunchpad';
import { markTourSeen, isTourSeen } from './IntroTour';
import { FirstRunLaunchpad } from './FirstRunLaunchpad';
import { NotificationsPromptModal, isNotifPromptSeen } from './NotificationsPromptModal';

type Step = 'about' | 'notif' | 'checklist' | 'done';

function initialStep(): Step {
  if (!isTourSeen()) return 'about';
  if (!isNotifPromptSeen()) return 'notif';
  if (!isFirstRunLaunchpadSeen()) return 'checklist';
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
    setStep(!isNotifPromptSeen() ? 'notif' : (!isFirstRunLaunchpadSeen() ? 'checklist' : 'done'));
  }, [step, navigate, player, sessionUnlockRequired]);

  if (!player || sessionUnlockRequired || step === 'done' || step === 'about') return null;

  if (step === 'notif') {
    return (
      <NotificationsPromptModal
        onClose={() => setStep(isFirstRunLaunchpadSeen() ? 'done' : 'checklist')}
      />
    );
  }

  return <FirstRunLaunchpad onClose={() => setStep('done')} />;
}
