import { toast } from 'sonner';

export interface InviteMessageParams {
  leagueName: string;
  joinCode: string;
  origin: string;
}

export function buildInviteMessage({ leagueName, joinCode, origin }: InviteMessageParams): string {
  return [
    `Join me on Calcio — the World Cup 2026 prediction app.`,
    ``,
    `Like fantasy football, you predict once and your picks automatically count across every league you join — so you can be in a mates league, a work league, whatever, all from one set of predictions.`,
    ``,
    `Pick scores match by match as the tournament unfolds — no bracket to fill in upfront, just predict each game before kick-off.`,
    ``,
    `Previously run from a spreadsheet of legendary proportions, Calcio is the next iteration.`,
    ``,
    `League: ${leagueName}`,
    `Your join code: ${joinCode}`,
    ``,
    `New to the app?`,
    `1. Install it: ${origin}`,
    `2. Open it from your home screen`,
    `3. Create your account`,
    `4. Tap Leagues → Join by code → enter: ${joinCode}`,
    `5. Complete your pre-tournament checklist before the tournament kicks off:`,
    `   • Read the About page`,
    `   • Predict your Specials`,
    `   • Predict your first match`,
    `   (all editable up until kick-off of the first game)`,
    ``,
    `Already have the app? Open it, tap Leagues → Join by code, enter: ${joinCode} — then finish your pre-tournament checklist (Read the About page, predict your Specials, predict your first match — all editable until the first game kicks off).`,
  ].join('\n');
}

export interface ShareInviteParams {
  message: string;
}

export async function shareInvite({ message }: ShareInviteParams): Promise<'shared' | 'copied' | 'cancelled'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      // Share text only — no url param. iOS renders the url as a separate
      // clickable link below the text, which clutters the preview and appears
      // adjacent to the "already have the app" line. The install URL is already
      // embedded in the message text so there's no information loss.
      await navigator.share({ text: message });
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
