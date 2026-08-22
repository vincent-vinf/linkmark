import { describe, expect, it } from 'vitest';
import { createTarget, deleteGroup, deleteTarget, reorderTargets, validateWebUrl } from './targets';

describe('Target management seam', () => {
  it('moves Targets to Inbox when a Group is deleted', () => {
    const target = createTarget({ name: '文档', kind: 'web', groupId: 'work', config: { url: 'https://example.com' } });
    const result = deleteGroup([target], 'work');

    expect(result[0]?.groupId).toBeNull();
  });

  it('removes only the Target relationship and reports orphan Vault Items', () => {
    const first = createTarget({ name: '主库', kind: 'postgresql', vaultItemIds: ['shared', 'unique'] });
    const second = createTarget({ name: '备用库', kind: 'postgresql', vaultItemIds: ['shared'] });

    const result = deleteTarget([first, second], first.id);

    expect(result.targets).toHaveLength(1);
    expect(result.orphanVaultItemIds).toEqual(['unique']);
  });

  it('allows only HTTP(S) web URLs', () => {
    expect(validateWebUrl('https://linkmark.example')).toBe(true);
    expect(validateWebUrl('javascript:alert(1)')).toBe(false);
    expect(validateWebUrl('file:///etc/passwd')).toBe(false);
  });

  it('persists a requested ordering inside a Group', () => {
    const first = createTarget({ name: 'first', kind: 'generic' }); const second = createTarget({ name: 'second', kind: 'generic' });
    expect(reorderTargets([first, second], [second.id, first.id]).map((target) => target.sortOrder)).toEqual([1, 0]);
  });
});
