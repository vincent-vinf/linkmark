import { describe, expect, it } from 'vitest';
import { addVaultItem, createVault, unlockVault } from './vault';

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
});
