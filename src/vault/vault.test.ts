import { describe, expect, it } from 'vitest';
import { addVaultItem, assertVaultKdfParameters, createVault, deleteVaultItem, emptyVaultRecycleBin, getVaultItem, listRecycledVaultItems, listVaultItems, mergeVaultItems, permanentlyDeleteVaultItem, purgeExpiredVaultItems, rekeyVault, restoreVaultItem, saveVault, unlockVault, updateVaultItem } from './vault';

describe('Vault item seam', () => {
  it('stores secret fields inside a password-protected KDBX vault', async () => {
    const data = await createVault('correct horse battery staple');
    const vault = await unlockVault(data, 'correct horse battery staple');
    addVaultItem(vault, { title: '生产 Redis', password: 'not-in-target-storage', fields: { 'API Key': 'key-123' } });

    expect(vault.getDefaultGroup().entries).toHaveLength(1);
    expect(vault.getDefaultGroup().entries[0]?.fields.get('Password')).toBeDefined();
    expect(Number(vault.header.kdfParameters?.get('M'))).toBe(64 * 1024 * 1024);
    expect(Number(vault.header.kdfParameters?.get('I'))).toBe(3);
  });

  it('permanently empties the recycle bin on request', async () => {
    const vault = await unlockVault(await createVault('test'), 'test'); const id = addVaultItem(vault, { title: 'remove' }); deleteVaultItem(vault, id);
    expect(emptyVaultRecycleBin(vault)).toBe(1); expect(listRecycledVaultItems(vault)).toEqual([]);
  });

  it('permanently deletes one recycled Vault Item on request', async () => {
    const vault = await unlockVault(await createVault('test'), 'test'); const id = addVaultItem(vault, { title: 'remove' }); deleteVaultItem(vault, id);
    expect(permanentlyDeleteVaultItem(vault, id)).toBe(true); expect(listRecycledVaultItems(vault)).toEqual([]);
  });

  it('purges recycle-bin entries after the retention window', async () => {
    const vault = await unlockVault(await createVault('test'), 'test'); const id = addVaultItem(vault, { title: 'old' }); deleteVaultItem(vault, id);
    expect(purgeExpiredVaultItems(vault, Date.now() + 31 * 24 * 60 * 60 * 1000)).toBe(1);
    expect(listRecycledVaultItems(vault)).toEqual([]);
  });

  it('imports Vault Items while preserving the current Vault', async () => {
    const current = await unlockVault(await createVault('a'), 'a'); const incoming = await unlockVault(await createVault('b'), 'b');
    addVaultItem(current, { title: 'local' }); const importedId = addVaultItem(incoming, { title: 'imported' }); const mapping = mergeVaultItems(current, incoming);
    expect(listVaultItems(current).map((item) => item.title)).toEqual(['local', 'imported']);
    expect(mapping.get(importedId)).toBeDefined();
  });

  it('moves deleted Vault Items into the recycle bin', async () => {
    const vault = await unlockVault(await createVault('test'), 'test');
    const id = addVaultItem(vault, { title: 'temporary', password: 'x' });
    expect(listVaultItems(vault)).toEqual([{ id, title: 'temporary', username: '' }]);
    expect(deleteVaultItem(vault, id)).toBe(true);
    expect(listVaultItems(vault)).toHaveLength(0);
    expect(listRecycledVaultItems(vault).map((item) => item.id)).toEqual([id]);
    expect(restoreVaultItem(vault, id)).toBe(true);
    expect(listVaultItems(vault).map((item) => item.id)).toEqual([id]);
  });

  it('can rekey a portable Vault without changing its entries', async () => {
    const data = await createVault('old');
    const vault = await unlockVault(data, 'old');
    addVaultItem(vault, { title: 'API', password: 'secret' });
    const rekeyed = await rekeyVault(await vault.save(), 'old', 'new');
    await expect(unlockVault(rekeyed, 'old')).rejects.toBeDefined();
    expect((await unlockVault(rekeyed, 'new')).getDefaultGroup().entries).toHaveLength(1);
  });

  it('reads and updates an encrypted Vault Item without exposing it in Target storage', async () => {
    const vault = await unlockVault(await createVault('test'), 'test');
    const id = addVaultItem(vault, { title: 'Redis', username: 'default', password: 'old', notes: 'private', fields: { Token: 'one==' } });
    expect(getVaultItem(vault, id)).toMatchObject({ title: 'Redis', username: 'default', password: 'old', notes: 'private', fields: { Token: 'one==' } });
    expect(updateVaultItem(vault, id, { title: 'Redis prod', username: 'admin', password: 'new', fields: { Token: 'two==' } })).toBe(true);
    expect(getVaultItem(vault, id)).toMatchObject({ title: 'Redis prod', username: 'admin', password: 'new', notes: '', fields: { Token: 'two==' } });
  });

  it('rejects malformed Vault bytes before attempting a password KDF', () => {
    expect(() => assertVaultKdfParameters(new Uint8Array([1, 2, 3]).buffer)).toThrow('Vault');
  });

  it('saves a Vault snapshot that remains protected by the supplied password', async () => {
    const vault = await unlockVault(await createVault('test'), 'test'); addVaultItem(vault, { title: 'saved', password: 'secret' });
    const data = await saveVault(vault, 'test');
    expect(listVaultItems(await unlockVault(data, 'test')).map((item) => item.title)).toEqual(['saved']);
  });
});
