import { describe, expect, it } from 'vitest';
import { decryptPackage, encryptPackage } from './package';

describe('portable package seam', () => {
  it('round-trips a complete package only with its password', async () => {
    const encrypted = await encryptPackage({ formatVersion: 1, targets: [{ id: 'a', name: '生产' }] }, 'share secret');

    await expect(decryptPackage(encrypted, 'share secret')).resolves.toEqual({ formatVersion: 1, targets: [{ id: 'a', name: '生产' }] });
    await expect(decryptPackage(encrypted, 'wrong secret')).rejects.toThrow('无法解密');
  });
});
