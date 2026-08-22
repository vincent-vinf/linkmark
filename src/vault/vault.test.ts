import { describe, expect, it } from 'vitest';
import { addVaultItem, createVault, deleteVaultItem, listVaultItems, rekeyVault, unlockVault } from './vault';

describe('Vault item seam', () => {
  it('stores secret fields inside a password-protected KDBX vault', async () => {
    const data = await createVault('correct horse battery staple');
    const vault = await unlockVault(data, 'correct horse battery staple');
    addVaultItem(vault, { title: '生产 Redis', password: 'not-in-target-storage', fields: { 'API Key': 'key-123' } });

    expect(vault.getDefaultGroup().entries).toHaveLength(1);
    expect(vault.getDefaultGroup().entries[0]?.fields.get('Password')).toBeDefined();
    expect(Number(vault.header.kdfParameters?.get('M'))).toBe(65536);
    expect(Number(vault.header.kdfParameters?.get('I'))).toBe(3);
  });

  it('moves deleted Vault Items into the recycle bin', async () => {
    const vault = await unlockVault(await createVault('test'), 'test');
    const id = addVaultItem(vault, { title: 'temporary', password: 'x' });
    expect(listVaultItems(vault)).toEqual([{ id, title: 'temporary', username: '' }]);
    expect(deleteVaultItem(vault, id)).toBe(true);
    expect(listVaultItems(vault)).toHaveLength(0);
  });

  it('can rekey a portable Vault without changing its entries', async () => {
    const data = await createVault('old');
    const vault = await unlockVault(data, 'old');
    addVaultItem(vault, { title: 'API', password: 'secret' });
    const rekeyed = await rekeyVault(await vault.save(), 'old', 'new');
    await expect(unlockVault(rekeyed, 'old')).rejects.toBeDefined();
    expect((await unlockVault(rekeyed, 'new')).getDefaultGroup().entries).toHaveLength(1);
  });
});
