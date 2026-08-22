import { z } from 'zod';
import { decryptPackage, encryptPackage, type EncryptedPackage } from './package';
import type { Target } from '../domain/targets';
import { validateWebUrl } from '../domain/targets';
import type { Group, Tag } from '../storage/db';

const binaryToBase64 = (data: ArrayBuffer) => { const bytes = new Uint8Array(data); let text = ''; for (let start = 0; start < bytes.length; start += 0x8000) text += String.fromCharCode(...bytes.subarray(start, start + 0x8000)); return btoa(text); };
const base64ToBinary = (data: string) => Uint8Array.from(atob(data), (char) => char.charCodeAt(0)).buffer;
const envelopeSchema = z.object({ formatVersion: z.literal(1), algorithm: z.literal('Argon2id/AES-GCM'), compression: z.literal('gzip'), salt: z.string().max(128), iv: z.string().max(64), memoryKiB: z.number().int(), iterations: z.number().int(), parallelism: z.number().int(), ciphertext: z.string().max(20_000_000) });
const targetSchema = z.object({ id: z.string().uuid(), name: z.string().min(1).max(256), kind: z.enum(['web', 'postgresql', 'redis', 'generic']), groupId: z.string().uuid().nullable(), tagIds: z.array(z.string().uuid()), sortOrder: z.number().finite(), config: z.record(z.union([z.string(), z.number(), z.boolean()])), vaultItemIds: z.array(z.string()), createdAt: z.string().datetime(), updatedAt: z.string().datetime() });
const groupSchema = z.object({ id: z.string().uuid(), name: z.string().min(1).max(128), sortOrder: z.number().finite() });
const tagSchema = z.object({ id: z.string().uuid(), name: z.string().min(1).max(128) });
const backupSchema = z.object({ formatVersion: z.literal(1), mode: z.enum(['backup', 'share']), targets: z.array(targetSchema), groups: z.array(groupSchema), tags: z.array(tagSchema), vault: z.string().max(20_000_000) });

export type FullBackup = { mode: 'backup' | 'share'; targets: Target[]; groups: Group[]; tags: Tag[]; vault: ArrayBuffer };

export async function serializeBackup(backup: Omit<FullBackup, 'mode'>, password: string, mode: FullBackup['mode'] = 'backup'): Promise<string> {
  const envelope = await encryptPackage({ formatVersion: 1, mode, targets: backup.targets, groups: backup.groups, tags: backup.tags, vault: binaryToBase64(backup.vault) }, password);
  return btoa(JSON.stringify(envelope)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function parseBackup(encoded: string, password: string): Promise<FullBackup> {
  if (encoded.length > 25_000_000) throw new Error('导入包过大');
  const padded = encoded.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - encoded.length % 4) % 4);
  let envelope: EncryptedPackage;
  try { envelope = envelopeSchema.parse(JSON.parse(atob(padded))); } catch { throw new Error('无效的导入包'); }
  const decoded = backupSchema.parse(await decryptPackage(envelope, password));
  const groupIds = new Set(decoded.groups.map((group) => group.id)); const tagIds = new Set(decoded.tags.map((tag) => tag.id));
  for (const target of decoded.targets) {
    if (target.groupId && !groupIds.has(target.groupId)) throw new Error('导入包包含未知分组引用');
    if (target.tagIds.some((id) => !tagIds.has(id))) throw new Error('导入包包含未知标签引用');
    if (target.kind === 'web' && (typeof target.config.url !== 'string' || !validateWebUrl(target.config.url))) throw new Error('导入包包含不安全的网站地址');
  }
  return { mode: decoded.mode, targets: decoded.targets, groups: decoded.groups, tags: decoded.tags, vault: base64ToBinary(decoded.vault) };
}
