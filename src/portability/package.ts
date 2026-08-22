import { argon2id } from 'hash-wasm';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const fromBase64Url = (value: string) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), (char) => char.charCodeAt(0));

export type EncryptedPackage = { formatVersion: 1; algorithm: 'Argon2id/AES-GCM'; salt: string; iv: string; memoryKiB: number; iterations: number; parallelism: number; ciphertext: string };

async function derive(password: string, salt: Uint8Array, memoryKiB: number, iterations: number, parallelism: number): Promise<CryptoKey> {
  const bytes = await argon2id({ password, salt, memorySize: memoryKiB, iterations, parallelism, hashLength: 32, outputType: 'binary' });
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptPackage(payload: unknown, password: string): Promise<EncryptedPackage> {
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt, 65536, 3, 1);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(payload)));
  return { formatVersion: 1, algorithm: 'Argon2id/AES-GCM', salt: toBase64Url(salt), iv: toBase64Url(iv), memoryKiB: 65536, iterations: 3, parallelism: 1, ciphertext: toBase64Url(new Uint8Array(ciphertext)) };
}

export async function decryptPackage(envelope: EncryptedPackage, password: string): Promise<unknown> {
  if (envelope.formatVersion !== 1 || envelope.algorithm !== 'Argon2id/AES-GCM' || envelope.memoryKiB > 65536 || envelope.iterations > 6 || envelope.parallelism > 2) throw new Error('不支持的导入包');
  try { const key = await derive(password, fromBase64Url(envelope.salt), envelope.memoryKiB, envelope.iterations, envelope.parallelism); const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(envelope.iv) }, key, fromBase64Url(envelope.ciphertext)); return JSON.parse(decoder.decode(plain)); } catch { throw new Error('无法解密导入包'); }
}
