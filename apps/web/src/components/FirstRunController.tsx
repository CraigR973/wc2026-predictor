import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { IntroTour, isTourSeen } from './IntroTour';
import { NotificationsPromptModal, isNotifPromptSeen } from './NotificationsPromptModal';

type Step = 'tour' | 'notif' | 'done';

function initialStep(): Step {
  if (!isTourSeen()) return 'tour';
  if (!isNotifPromptSeen()) return 'notif';
  return 'done';
}

export function FirstRunController() {
  const { player } = useAuth();
  const [step, setStep] = useState<Step>(initialStep);

  // Only active when authenticated
  if (!player || step === 'done') return null;

  if (step === 'tour') {
    return (
      <IntroTour
        onClose={() => setStep(isNotifPromptSeen() ? 'done' : 'notif')}
      />
    );
  }

  return (
    <NotificationsPromptModal
      onClose={() => setStep('done')}
    />
  );
}
