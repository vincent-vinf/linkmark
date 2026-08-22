import { z } from 'zod';
import { decryptPackage, encryptPackage, type EncryptedPackage } from './package';

const binaryToBase64 = (data: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(data)));
const base64ToBinary = (data: string) => Uint8Array.from(atob(data), (char) => char.charCodeAt(0)).buffer;
const envelopeSchema = z.object({ formatVersion: z.literal(1), algorithm: z.literal('Argon2id/AES-GCM'), salt: z.string().max(128), iv: z.string().max(64), memoryKiB: z.number().int(), iterations: z.number().int(), parallelism: z.number().int(), ciphertext: z.string().max(20_000_000) });
const backupSchema = z.object({ formatVersion: z.literal(1), targets: z.array(z.unknown()), groups: z.array(z.unknown()), tags: z.array(z.unknown()), vault: z.string().max(20_000_000) });

export type FullBackup = { targets: unknown[]; groups: unknown[]; tags: unknown[]; vault: ArrayBuffer };

export async function serializeBackup(backup: FullBackup, password: string): Promise<string> {
  const envelope = await encryptPackage({ formatVersion: 1, targets: backup.targets, groups: backup.groups, tags: backup.tags, vault: binaryToBase64(backup.vault) }, password);
  return btoa(JSON.stringify(envelope)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function parseBackup(encoded: string, password: string): Promise<FullBackup> {
  if (encoded.length > 25_000_000) throw new Error('导入包过大');
  const padded = encoded.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - encoded.length % 4) % 4);
  let envelope: EncryptedPackage;
  try { envelope = envelopeSchema.parse(JSON.parse(atob(padded))); } catch { throw new Error('无效的导入包'); }
  const decoded = backupSchema.parse(await decryptPackage(envelope, password));
  return { targets: decoded.targets, groups: decoded.groups, tags: decoded.tags, vault: base64ToBinary(decoded.vault) };
}
