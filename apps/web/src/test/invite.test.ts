import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildInviteMessage, shareInvite } from '@/lib/invite';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const PARAMS = {
  leagueName: 'Test League',
  joinCode: 'ABC123',
  origin: 'https://example.com',
};

describe('buildInviteMessage', () => {
  it('contains the league name', () => {
    const msg = buildInviteMessage(PARAMS);
    expect(msg).toContain('Test League');
  });

  it('contains the join code', () => {
    const msg = buildInviteMessage(PARAMS);
    expect(msg).toContain('ABC123');
  });

  it('contains the join link', () => {
    const msg = buildInviteMessage(PARAMS);
    expect(msg).toContain('https://example.com/join/ABC123');
  });

  it('contains an "already have the app" hint with the code', () => {
    const msg = buildInviteMessage(PARAMS);
    expect(msg.toLowerCase()).toContain('already have the app');
    expect(msg).toContain('ABC123');
  });

  it('mentions The Steele Spreadsheet System', () => {
    const msg = buildInviteMessage(PARAMS);
    expect(msg).toContain('The Steele Spreadsheet System');
  });
});

describe('shareInvite — navigator.share absent', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      share: undefined,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to clipboard and returns "copied"', async () => {
    const result = await shareInvite({ message: 'hello', url: 'https://x.com' });
    expect(result).toBe('copied');
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});

describe('shareInvite — navigator.share present', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      share: vi.fn().mockResolvedValue(undefined),
      clipboard: { writeText: vi.fn() },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('calls navigator.share and returns "shared"', async () => {
    const result = await shareInvite({ message: 'hello', url: 'https://x.com' });
    expect(result).toBe('shared');
    expect(navigator.share).toHaveBeenCalledWith({
      text: 'hello',
      url: 'https://x.com',
    });
  });
});
