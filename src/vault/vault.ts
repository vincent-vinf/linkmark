import { BinaryStream, Consts, Credentials, CryptoEngine, Int64, Kdbx, KdbxHeader, ProtectedValue, VarDictionary } from 'kdbxweb';
import { deriveArgon2id } from '../crypto/argon2';

const text = new TextEncoder();
let configured = false;

function configureArgon2(): void {
  if (configured) return;
  CryptoEngine.setArgon2Impl(async (password, salt, memory, iterations, length, parallelism) => {
    const result = await deriveArgon2id(new Uint8Array(password), new Uint8Array(salt), { memorySize: memory, iterations, parallelism, hashLength: length });
    return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
  });
  configured = true;
}

function credentials(password: string): Credentials { return new Credentials(ProtectedValue.fromString(password)); }

/** Reads the unauthenticated KDBX header before any expensive password KDF runs. */
export function assertVaultKdfParameters(data: ArrayBuffer): void {
  let header: KdbxHeader;
  try { header = KdbxHeader.read(new BinaryStream(data), undefined as never); } catch { throw new Error('无效的 Vault 文件'); }
  const parameters = header.kdfParameters;
  const memory = Number(parameters?.get('M')); const iterations = Number(parameters?.get('I')); const parallelism = Number(parameters?.get('P'));
  if (header.versionMajor !== 4 || !Number.isFinite(memory) || !Number.isFinite(iterations) || !Number.isFinite(parallelism) || memory > 64 * 1024 * 1024 || iterations > 6 || parallelism > 2) throw new Error('Vault KDF 参数超出安全限制');
}

export async function createVault(password: string): Promise<ArrayBuffer> {
  configureArgon2();
  const vault = Kdbx.create(credentials(password), 'Linkmark Vault');
  vault.setKdf(Consts.KdfId.Argon2id);
  vault.header.kdfParameters?.set('M', VarDictionary.ValueType.UInt64, new Int64(64 * 1024 * 1024));
  vault.header.kdfParameters?.set('I', VarDictionary.ValueType.UInt64, new Int64(3));
  vault.header.kdfParameters?.set('P', VarDictionary.ValueType.UInt32, 1);
  return vault.save();
}

export async function unlockVault(data: ArrayBuffer, password: string): Promise<Kdbx> {
  configureArgon2();
  assertVaultKdfParameters(data);
  return Kdbx.load(data, credentials(password));
}

export async function saveVault(vault: Kdbx, password?: string): Promise<ArrayBuffer> {
  if (!password || typeof Worker === 'undefined') return vault.save();
  const xml = await vault.saveXml();
  const worker = new Worker(new URL('./vault-save.worker.ts', import.meta.url), { type: 'module' });
  return new Promise<ArrayBuffer>((resolve, reject) => {
    worker.onmessage = ({ data }) => { worker.terminate(); if (data.error) reject(new Error(data.error)); else resolve(data.result); };
    worker.onerror = () => { worker.terminate(); reject(new Error('Vault save worker failed')); };
    worker.postMessage({ xml, password });
  });
}

export async function rekeyVault(data: ArrayBuffer, currentPassword: string, nextPassword: string): Promise<ArrayBuffer> {
  const vault = await unlockVault(data, currentPassword);
  await vault.credentials.setPassword(ProtectedValue.fromString(nextPassword));
  return vault.save();
}

export type VaultItemInput = { title: string; username?: string; password?: string; notes?: string; fields?: Record<string, string> };

export function addVaultItem(vault: Kdbx, input: VaultItemInput): string {
  const entry = vault.createEntry(vault.getDefaultGroup());
  entry.fields.set('Title', input.title);
  if (input.username) entry.fields.set('UserName', input.username);
  if (input.password) entry.fields.set('Password', ProtectedValue.fromString(input.password));
  if (input.notes) entry.fields.set('Notes', ProtectedValue.fromString(input.notes));
  for (const [name, value] of Object.entries(input.fields ?? {})) entry.fields.set(name, ProtectedValue.fromString(value));
  return entry.uuid.toString();
}

export type VaultItemSummary = { id: string; title: string; username: string };
export type VaultItemDetail = VaultItemSummary & { password: string; notes: string; fields: Record<string, string> };
const standardFields = new Set(['Title', 'UserName', 'Password', 'Notes']);
const readField = (value: unknown): string => value instanceof ProtectedValue ? value.getText() : typeof value === 'string' ? value : '';
export function listVaultItems(vault: Kdbx): VaultItemSummary[] {
  return vault.groups.flatMap((group) => group.entries.map((entry) => ({ id: entry.uuid.toString(), title: readField(entry.fields.get('Title')), username: readField(entry.fields.get('UserName')) })));
}

export function getVaultItem(vault: Kdbx, id: string): VaultItemDetail | null {
  for (const group of vault.groups) {
    const entry = group.entries.find((item) => item.uuid.toString() === id);
    if (!entry) continue;
    const fields = Object.fromEntries([...entry.fields.entries()].filter(([name]) => !standardFields.has(name)).map(([name, value]) => [name, readField(value)]));
    return { id, title: readField(entry.fields.get('Title')), username: readField(entry.fields.get('UserName')), password: readField(entry.fields.get('Password')), notes: readField(entry.fields.get('Notes')), fields };
  }
  return null;
}

export function updateVaultItem(vault: Kdbx, id: string, input: VaultItemInput): boolean {
  for (const group of vault.groups) {
    const entry = group.entries.find((item) => item.uuid.toString() === id);
    if (!entry) continue;
    entry.fields.clear();
    entry.fields.set('Title', input.title);
    if (input.username) entry.fields.set('UserName', input.username);
    if (input.password) entry.fields.set('Password', ProtectedValue.fromString(input.password));
    if (input.notes) entry.fields.set('Notes', ProtectedValue.fromString(input.notes));
    for (const [name, value] of Object.entries(input.fields ?? {})) if (name.trim() && value) entry.fields.set(name.trim(), ProtectedValue.fromString(value));
    entry.times.update();
    return true;
  }
  return false;
}

export function deleteVaultItem(vault: Kdbx, id: string): boolean {
  for (const group of vault.groups) { const item = group.entries.find((entry) => entry.uuid.toString() === id); if (item) { vault.createRecycleBin(); vault.remove(item); return true; } }
  return false;
}

export function listRecycledVaultItems(vault: Kdbx): VaultItemSummary[] {
  const recycleBin = vault.meta.recycleBinUuid ? vault.getGroup(vault.meta.recycleBinUuid) : undefined;
  if (!recycleBin) return [];
  return recycleBin.entries.map((entry) => ({ id: entry.uuid.toString(), title: typeof entry.fields.get('Title') === 'string' ? entry.fields.get('Title') as string : '', username: '' }));
}

export function restoreVaultItem(vault: Kdbx, id: string): boolean {
  const recycleBin = vault.meta.recycleBinUuid ? vault.getGroup(vault.meta.recycleBinUuid) : undefined;
  const item = recycleBin?.entries.find((entry) => entry.uuid.toString() === id);
  if (!item) return false;
  vault.move(item, vault.getDefaultGroup()); return true;
}

export function purgeExpiredVaultItems(vault: Kdbx, now = Date.now(), retentionMs = 30 * 24 * 60 * 60 * 1000): number {
  const recycleBin = vault.meta.recycleBinUuid ? vault.getGroup(vault.meta.recycleBinUuid) : undefined;
  if (!recycleBin) return 0;
  const expired = recycleBin.entries.filter((entry) => entry.lastModTime <= now - retentionMs);
  for (const item of expired) recycleBin.entries.splice(recycleBin.entries.indexOf(item), 1);
  return expired.length;
}

export function emptyVaultRecycleBin(vault: Kdbx): number {
  const recycleBin = vault.meta.recycleBinUuid ? vault.getGroup(vault.meta.recycleBinUuid) : undefined;
  if (!recycleBin) return 0;
  const count = recycleBin.entries.length; recycleBin.entries.splice(0, count); return count;
}

export function permanentlyDeleteVaultItem(vault: Kdbx, id: string): boolean {
  const recycleBin = vault.meta.recycleBinUuid ? vault.getGroup(vault.meta.recycleBinUuid) : undefined;
  const index = recycleBin?.entries.findIndex((entry) => entry.uuid.toString() === id) ?? -1;
  if (index < 0 || !recycleBin) return false;
  recycleBin.entries.splice(index, 1);
  return true;
}

export function mergeVaultItems(target: Kdbx, incoming: Kdbx): Map<string, string> {
  const group = target.getDefaultGroup();
  const ids = new Map<string, string>();
  for (const sourceGroup of incoming.groups) for (const entry of sourceGroup.entries) ids.set(entry.uuid.toString(), target.importEntry(entry, group, incoming).uuid.toString());
  return ids;
}

export function clearPassword(value: string): void { text.encode(value).fill(0); }
