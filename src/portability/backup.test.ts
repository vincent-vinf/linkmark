import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from './backup';

describe('full backup seam', () => {
  it('serializes all local records into an encrypted portable string', async () => {
    const backup = await serializeBackup({ targets: [{ id: 't' }], groups: [{ id: 'g' }], tags: [{ id: 'x' }], vault: new Uint8Array([1, 2, 3]).buffer }, 'secret');
    await expect(parseBackup(backup, 'secret')).resolves.toMatchObject({ targets: [{ id: 't' }], groups: [{ id: 'g' }], tags: [{ id: 'x' }] });
  });
});
