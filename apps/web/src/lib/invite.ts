import { toast } from 'sonner';

export interface InviteMessageParams {
  leagueName: string;
  joinCode: string;
  origin: string;
}

export function buildInviteMessage({ leagueName, joinCode, origin }: InviteMessageParams): string {
  return [
    `Join me on The Steele Spreadsheet System — a World Cup 2026 prediction league!`,
    ``,
    `League: ${leagueName}`,
    `Join link: ${origin}/join/${joinCode}`,
    ``,
    `Already have the app? Open it and enter code: ${joinCode}`,
  ].join('\n');
}

export interface ShareInviteParams {
  message: string;
  url: string;
}

export async function shareInvite({ message, url }: ShareInviteParams): Promise<'shared' | 'copied'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    await navigator.share({ text: message, url });
    return 'shared';
  }
  await navigator.clipboard.writeText(`${message}`);
  toast.success('Invite link copied to clipboard');
  return 'copied';
}
