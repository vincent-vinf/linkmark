import { describe, expect, it } from 'vitest';
import { createTarget } from '../domain/targets';
import { createVault, unlockVault } from './vault';
import { addEntry, addKey, getWorkspace, initializeWorkspace } from './workspace';

describe('encrypted workspace seam', () => {
  it('stores entries, groups, tags and key relationships only inside the KDBX workspace', async () => {
    const vault = await unlockVault(await createVault('test'), 'test');
    initializeWorkspace(vault);
    const keyId = addKey(vault, { title: '生产 Redis', username: 'default', password: 'key-value' });
    const entry = createTarget({ name: 'Redis 生产', kind: 'redis', groupId: 'infra', tagIds: ['production'], vaultItemIds: [keyId], config: { host: 'redis.example.com', port: '6379', database: '0', tls: true } });
    addEntry(vault, entry);

    expect(getWorkspace(vault)).toMatchObject({
      entries: [expect.objectContaining({ name: 'Redis 生产', vaultItemIds: [keyId] })],
      groups: [],
      tags: [],
      keys: [expect.objectContaining({ id: keyId, title: '生产 Redis', username: 'default' })],
    });
  });
});
