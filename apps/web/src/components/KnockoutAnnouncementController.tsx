import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
  const [open, setOpen] = useState(() => {
    const seen = hasSeen(player?.id);
    if (seen) {
      resetSeen(player?.id);
    }
    return true;
  });

  if (!player || !open) return null;

  return (
    <KnockoutAnnouncementModal
      onClose={() => {
        markSeen(player.id);
        setOpen(false);
      }}
    />
  );
}
