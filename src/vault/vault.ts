import { argon2id } from 'hash-wasm';
import { Consts, Credentials, CryptoEngine, Kdbx, ProtectedValue } from 'kdbxweb';

const text = new TextEncoder();
let configured = false;

function configureArgon2(): void {
  if (configured) return;
  CryptoEngine.setArgon2Impl(async (password, salt, memory, iterations, length, parallelism) => {
    const result = await argon2id({ password: new Uint8Array(password), salt: new Uint8Array(salt), memorySize: memory, iterations, parallelism, hashLength: length, outputType: 'binary' });
    return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
  });
  configured = true;
}

function credentials(password: string): Credentials { return new Credentials(ProtectedValue.fromString(password)); }

export async function createVault(password: string): Promise<ArrayBuffer> {
  configureArgon2();
  const vault = Kdbx.create(credentials(password), 'Linkmark Vault');
  vault.setKdf(Consts.KdfId.Argon2id);
  return vault.save();
}

export async function unlockVault(data: ArrayBuffer, password: string): Promise<Kdbx> {
  configureArgon2();
  return Kdbx.load(data, credentials(password));
}

export async function saveVault(vault: Kdbx): Promise<ArrayBuffer> { return vault.save(); }

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
