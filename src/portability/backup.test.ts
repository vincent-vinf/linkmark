import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from './backup';

describe('full backup seam', () => {
  it('serializes all local records into an encrypted portable string', async () => {
    const group = '11111111-1111-4111-8111-111111111111'; const target = '22222222-2222-4222-8222-222222222222'; const tag = '33333333-3333-4333-8333-333333333333';
    const backup = await serializeBackup({ targets: [{ id: target, name: '生产', kind: 'web', groupId: group, tagIds: [tag], sortOrder: 0, config: { url: 'https://example.com' }, vaultItemIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], groups: [{ id: group, name: '工作', sortOrder: 0 }], tags: [{ id: tag, name: '重要' }], vault: new Uint8Array([1, 2, 3]).buffer }, 'secret');
    await expect(parseBackup(backup, 'secret')).resolves.toMatchObject({ mode: 'backup', targets: [{ id: target }], groups: [{ id: group }], tags: [{ id: tag }] });
  });
});
