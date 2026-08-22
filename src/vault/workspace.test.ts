import { describe, expect, it } from 'vitest';
import { createTarget } from '../domain/targets';
import { createVault, unlockVault } from './vault';
import { addEntry, addKey, deleteEntry, deleteKey, getWorkspace, initializeWorkspace, listRecycledRecords, restoreRecycledRecord, setWorkspaceMetadata, updateEntry } from './workspace';

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

  it('owns key links on entries and removes them when a key is deleted', async () => {
    const vault = await unlockVault(await createVault('test'), 'test'); initializeWorkspace(vault);
    const keyId = addKey(vault, { title: '共享 API Key' }); const entry = createTarget({ name: '控制台', kind: 'web', config: { url: 'https://example.com' }, vaultItemIds: [keyId] });
    addEntry(vault, entry);
    expect(updateEntry(vault, { ...entry, name: '生产控制台' })).toBe(true);
    expect(deleteKey(vault, keyId)).toBe(true);
    expect(getWorkspace(vault).entries).toEqual([expect.objectContaining({ name: '生产控制台', vaultItemIds: [] })]);
    expect(getWorkspace(vault).keys).toEqual([]);
  });

  it('moves deleted entries to the encrypted recycle bin', async () => {
    const vault = await unlockVault(await createVault('test'), 'test'); initializeWorkspace(vault);
    const entry = createTarget({ name: 'temporary', kind: 'web', config: { url: 'https://example.com' } }); addEntry(vault, entry);
    expect(deleteEntry(vault, entry.id)).toBe(true); expect(getWorkspace(vault).entries).toEqual([]);
    const recycled = listRecycledRecords(vault); expect(recycled).toHaveLength(1); expect(restoreRecycledRecord(vault, recycled[0]!.id)).toBe(true); expect(getWorkspace(vault).entries).toHaveLength(1);
  });

  it('keeps group and tag metadata encrypted alongside entries', async () => {
    const vault = await unlockVault(await createVault('test'), 'test'); initializeWorkspace(vault);
    setWorkspaceMetadata(vault, { groups: [{ id: 'work', name: '工作', sortOrder: 0 }], tags: [{ id: 'prod', name: '生产' }] });
    expect(getWorkspace(vault)).toMatchObject({ groups: [{ name: '工作' }], tags: [{ name: '生产' }] });
  });
});
