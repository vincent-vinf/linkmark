import { describe, expect, it } from 'vitest';
import { UnlockSession } from './session';

describe('Vault session seam', () => {
  it('locks at the selected absolute expiry regardless of activity', () => {
    const session = new UnlockSession(1_000, 60_000);
    session.recordActivity(59_999);

    expect(session.isLocked(61_000)).toBe(true);
  });

  it('clears the sensitive material on manual lock', () => {
    const session = new UnlockSession(1_000, 60_000);
    session.lock();

    expect(session.isLocked(1_001)).toBe(true);
  });
});
