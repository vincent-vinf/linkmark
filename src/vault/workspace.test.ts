import { describe, expect, it } from 'vitest';
import { createTarget } from '../domain/targets';
import { createVault, unlockVault } from './vault';
import { addEntry, addKey, deleteEntry, deleteKey, deleteWorkspaceGroup, emptyRecycledRecords, getKey, getWorkspace, initializeWorkspace, listRecycledRecords, mergeWorkspace, permanentlyDeleteRecycledRecord, restoreRecycledRecord, setWorkspaceMetadata, updateEntry, updateKey } from './workspace';

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

  it('restores an entry without links to keys deleted while it was recycled', async () => {
    const vault = await unlockVault(await createVault('test'), 'test'); initializeWorkspace(vault);
    const keyId = addKey(vault, { title: 'temporary key' }); const entry = createTarget({ name: 'temporary', kind: 'web', config: { url: 'https://example.com' }, vaultItemIds: [keyId] }); addEntry(vault, entry);
    deleteEntry(vault, entry.id); deleteKey(vault, keyId);
    const recycledEntry = listRecycledRecords(vault).find((record) => record.kind === 'entry')!;
    expect(restoreRecycledRecord(vault, recycledEntry.id)).toBe(true);
    expect(getWorkspace(vault).entries[0]?.vaultItemIds).toEqual([]);
  });

  it('keeps group and tag metadata encrypted alongside entries', async () => {
    const vault = await unlockVault(await createVault('test'), 'test'); initializeWorkspace(vault);
    setWorkspaceMetadata(vault, { groups: [{ id: 'work', name: '工作', sortOrder: 0 }], tags: [{ id: 'prod', name: '生产' }] });
    expect(getWorkspace(vault)).toMatchObject({ groups: [{ name: '工作' }], tags: [{ name: '生产' }] });
  });

  it('updates key details and safely returns grouped entries to the default group', async () => {
    const vault = await unlockVault(await createVault('test'), 'test'); initializeWorkspace(vault);
    const groupId = crypto.randomUUID(); setWorkspaceMetadata(vault, { groups: [{ id: groupId, name: '基础设施', sortOrder: 0 }], tags: [] });
    const keyId = addKey(vault, { title: 'old', password: 'before' });
    addEntry(vault, createTarget({ name: 'Redis', kind: 'redis', groupId, config: { host: 'redis.example.com', port: '6379', database: '0', tls: true }, vaultItemIds: [keyId] }));
    expect(updateKey(vault, keyId, { title: 'new', username: 'default', password: 'after', fields: { Region: 'cn' } })).toBe(true);
    expect(getKey(vault, keyId)).toMatchObject({ title: 'new', username: 'default', password: 'after', fields: { Region: 'cn' } });
    expect(deleteWorkspaceGroup(vault, groupId)).toBe(true);
    expect(getWorkspace(vault).entries[0]?.groupId).toBeNull();
  });

  it('permanently manages unified recycled records', async () => {
    const vault = await unlockVault(await createVault('test'), 'test'); initializeWorkspace(vault);
    const keyId = addKey(vault, { title: 'temporary' }); deleteKey(vault, keyId);
    const [record] = listRecycledRecords(vault); expect(record?.kind).toBe('key');
    expect(permanentlyDeleteRecycledRecord(vault, record!.id)).toBe(true);
    const other = addKey(vault, { title: 'other' }); deleteKey(vault, other);
    expect(emptyRecycledRecords(vault)).toBe(1);
  });

  it('merges records as fresh copies while preserving key links', async () => {
    const local = await unlockVault(await createVault('local'), 'local'); const incoming = await unlockVault(await createVault('incoming'), 'incoming');
    initializeWorkspace(local); initializeWorkspace(incoming);
    const keyId = addKey(incoming, { title: 'imported key', password: 'value' });
    addEntry(incoming, createTarget({ name: 'imported entry', kind: 'web', config: { url: 'https://example.com' }, vaultItemIds: [keyId] }));
    mergeWorkspace(local, incoming); const result = getWorkspace(local);
    expect(result.entries).toHaveLength(1); expect(result.keys).toHaveLength(1);
    expect(result.entries[0]?.vaultItemIds).toEqual([result.keys[0]?.id]);
    expect(result.keys[0]?.id).not.toBe(keyId);
  });
});
