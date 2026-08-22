import { deriveArgon2id } from '../crypto/argon2';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const toBinaryString = (bytes: Uint8Array) => { let text = ''; for (let start = 0; start < bytes.length; start += 0x8000) text += String.fromCharCode(...bytes.subarray(start, start + 0x8000)); return text; };
const toBase64Url = (bytes: Uint8Array) => btoa(toBinaryString(bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const fromBase64Url = (value: string) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), (char) => char.charCodeAt(0));

export type EncryptedPackage = { formatVersion: 1; algorithm: 'Argon2id/AES-GCM'; compression: 'gzip'; salt: string; iv: string; memoryKiB: number; iterations: number; parallelism: number; ciphertext: string };
async function gzip(data: Uint8Array): Promise<Uint8Array> { const stream = new CompressionStream('gzip'); const writer = stream.writable.getWriter(); await writer.write(data); await writer.close(); return new Uint8Array(await new Response(stream.readable).arrayBuffer()); }
async function gunzip(data: Uint8Array): Promise<Uint8Array> { const stream = new DecompressionStream('gzip'); const writer = stream.writable.getWriter(); await writer.write(data); await writer.close(); return new Uint8Array(await new Response(stream.readable).arrayBuffer()); }

async function derive(password: string, salt: Uint8Array, memoryKiB: number, iterations: number, parallelism: number): Promise<CryptoKey> {
  const bytes = await deriveArgon2id(password, salt, { memorySize: memoryKiB, iterations, parallelism, hashLength: 32 });
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptPackage(payload: unknown, password: string): Promise<EncryptedPackage> {
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt, 65536, 3, 1);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await gzip(encoder.encode(JSON.stringify(payload))));
  return { formatVersion: 1, algorithm: 'Argon2id/AES-GCM', compression: 'gzip', salt: toBase64Url(salt), iv: toBase64Url(iv), memoryKiB: 65536, iterations: 3, parallelism: 1, ciphertext: toBase64Url(new Uint8Array(ciphertext)) };
}

export async function decryptPackage(envelope: EncryptedPackage, password: string): Promise<unknown> {
  if (envelope.formatVersion !== 1 || envelope.algorithm !== 'Argon2id/AES-GCM' || envelope.compression !== 'gzip' || envelope.memoryKiB > 65536 || envelope.iterations > 6 || envelope.parallelism > 2) throw new Error('不支持的导入包');
  try { const key = await derive(password, fromBase64Url(envelope.salt), envelope.memoryKiB, envelope.iterations, envelope.parallelism); const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(envelope.iv) }, key, fromBase64Url(envelope.ciphertext)); return JSON.parse(decoder.decode(await gunzip(new Uint8Array(plain)))); } catch { throw new Error('无法解密导入包'); }
}
