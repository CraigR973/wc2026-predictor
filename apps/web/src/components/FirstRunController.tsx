import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirstRunLaunchpadSeen } from '@/lib/firstRunLaunchpad';
import { IntroTour, isTourSeen } from './IntroTour';
import { FirstRunLaunchpad } from './FirstRunLaunchpad';
import { NotificationsPromptModal, isNotifPromptSeen } from './NotificationsPromptModal';

type Step = 'tour' | 'notif' | 'checklist' | 'done';

function initialStep(): Step {
  if (!isTourSeen()) return 'tour';
  if (!isNotifPromptSeen()) return 'notif';
  if (!isFirstRunLaunchpadSeen()) return 'checklist';
  return 'done';
}

export function FirstRunController() {
  const { player, sessionUnlockRequired } = useAuth();
  const [step, setStep] = useState<Step>(initialStep);

  // Only active when authenticated
  if (!player || sessionUnlockRequired || step === 'done') return null;

  if (step === 'tour') {
    return (
      <IntroTour
        onClose={() => setStep(isNotifPromptSeen() ? (isFirstRunLaunchpadSeen() ? 'done' : 'checklist') : 'notif')}
      />
    );
  }

  if (step === 'notif') {
    return (
      <NotificationsPromptModal
        onClose={() => setStep(isFirstRunLaunchpadSeen() ? 'done' : 'checklist')}
      />
    );
  }

  return <FirstRunLaunchpad onClose={() => setStep('done')} />;
}
