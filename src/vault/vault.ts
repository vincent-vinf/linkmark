import { Consts, Credentials, CryptoEngine, Int64, Kdbx, ProtectedValue, VarDictionary } from 'kdbxweb';
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

export async function createVault(password: string): Promise<ArrayBuffer> {
  configureArgon2();
  const vault = Kdbx.create(credentials(password), 'Linkmark Vault');
  vault.setKdf(Consts.KdfId.Argon2id);
  vault.header.kdfParameters?.set('M', VarDictionary.ValueType.UInt64, new Int64(65536));
  vault.header.kdfParameters?.set('I', VarDictionary.ValueType.UInt64, new Int64(3));
  vault.header.kdfParameters?.set('P', VarDictionary.ValueType.UInt32, 1);
  return vault.save();
}

export async function unlockVault(data: ArrayBuffer, password: string): Promise<Kdbx> {
  configureArgon2();
  return Kdbx.load(data, credentials(password));
}

export async function saveVault(vault: Kdbx): Promise<ArrayBuffer> { return vault.save(); }

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

export function clearPassword(value: string): void { text.encode(value).fill(0); }
