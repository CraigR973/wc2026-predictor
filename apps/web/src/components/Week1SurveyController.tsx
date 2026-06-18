import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { isTourSeen } from './IntroTour';
import { Week1SurveyModal } from './Week1SurveyModal';
import { fetchSurveyStatus, WEEK1_SURVEY_KEY } from '@/lib/survey';

const SNOOZE_KEY = 'sss_survey_week1_snoozed';

function isSnoozed(): boolean {
  try {
    return sessionStorage.getItem(SNOOZE_KEY) === '1';
  } catch {
    return false;
  }
}

function markSnoozed(): void {
  try {
    sessionStorage.setItem(SNOOZE_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Shows the Week-1 pulse survey to a logged-in player who hasn't completed it.
 *
 * Snooze-able nag: "Later" hides it for the current session (sessionStorage, so
 * it returns on the next app launch), never blocking the predictions/live
 * screens. Completion is server-authoritative, so once submitted it never shows
 * again on any device. Gated behind first-run so it can't stack on a brand-new
 * user's launchpad.
 */
export function Week1SurveyController() {
  const { player } = useAuth();
  const queryClient = useQueryClient();
  const [snoozed, setSnoozed] = useState(isSnoozed);

  const tourSeen = !!player && isTourSeen(player.id);
  const { data } = useQuery({
    queryKey: ['survey', WEEK1_SURVEY_KEY, 'status', player?.id],
    queryFn: () => fetchSurveyStatus(WEEK1_SURVEY_KEY),
    enabled: tourSeen && !snoozed,
    staleTime: Infinity,
  });

  if (!player || snoozed) return null;
  if (!data || data.completed) return null;

  return (
    <Week1SurveyModal
      onClose={() => {
        markSnoozed();
        setSnoozed(true);
      }}
      onSubmitted={() => {
        queryClient.setQueryData(
          ['survey', WEEK1_SURVEY_KEY, 'status', player.id],
          { completed: true },
        );
      }}
    />
  );
}
