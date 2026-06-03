import { toast } from 'sonner';

export interface InviteMessageParams {
  leagueName: string;
  joinCode: string;
  origin: string;
}

export function buildInviteMessage({ leagueName, joinCode, origin }: InviteMessageParams): string {
  return [
    `Join me on The Steele Spreadsheet System — World Cup 2026 prediction league!`,
    ``,
    `Pick scores match by match as the tournament unfolds — no bracket to fill in upfront, just predict each game before kick-off. One thing to do before the tournament starts: go to Predict → Specials to lock in your tournament award picks.`,
    ``,
    `League: ${leagueName}`,
    `Your join code: ${joinCode}`,
    ``,
    `New to the app?`,
    `1. Install it: ${origin}`,
    `2. Open it from your home screen`,
    `3. Tap Leagues → Join by code → enter: ${joinCode}`,
    `4. Go to Predict → Specials before the tournament kicks off`,
    ``,
    `Already have the app? Open it, tap Leagues → Join by code, enter: ${joinCode} — then go to Predict → Specials before the tournament starts.`,
  ].join('\n');
}

export interface ShareInviteParams {
  message: string;
  url: string;
}

export async function shareInvite({ message, url }: ShareInviteParams): Promise<'shared' | 'copied' | 'cancelled'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ text: message, url });
      return 'shared';
    } catch (err) {
      // AbortError = user dismissed/swiped the share sheet — not an error, stay silent
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
      throw err;
    }
  }
  await navigator.clipboard.writeText(`${message}`);
  toast.success('Invite link copied to clipboard');
  return 'copied';
}
