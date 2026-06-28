import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isTourSeen } from './IntroTour';
import { KnockoutAnnouncementModal } from './KnockoutAnnouncementModal';

const SEEN_KEY = 'sss_knockout_announcement_seen_v1';

function storageKey(playerId?: string): string {
  return playerId ? `${SEEN_KEY}_${playerId}` : SEEN_KEY;
}

function hasSeen(playerId?: string): boolean {
  try {
    return localStorage.getItem(storageKey(playerId)) === 'true';
  } catch {
    return false;
  }
}

function markSeen(playerId?: string): void {
  try {
    localStorage.setItem(storageKey(playerId), 'true');
  } catch {
    /* ignore */
  }
}

function resetSeen(playerId?: string): void {
  try {
    localStorage.removeItem(storageKey(playerId));
  } catch {
    /* ignore */
  }
}

export function KnockoutAnnouncementController() {
  const { player } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => {
    const seen = hasSeen(player?.id);
    if (seen) {
      resetSeen(player?.id);
    }
    return true;
  });
  const isSafeLandingRoute = pathname === '/';

  if (!player || !open) return null;
  if (!isTourSeen(player.id)) return null;
  if (!isSafeLandingRoute) return null;

  return (
    <KnockoutAnnouncementModal
      onClose={() => {
        markSeen(player.id);
        setOpen(false);
      }}
    />
  );
}
