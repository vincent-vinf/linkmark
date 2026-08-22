import { argon2id } from 'hash-wasm';

type Options = { memorySize: number; iterations: number; parallelism: number; hashLength: number };
export async function deriveArgon2id(password: Uint8Array | string, salt: Uint8Array, options: Options): Promise<Uint8Array> {
  if (typeof Worker === 'undefined') return argon2id({ password, salt, ...options, outputType: 'binary' });
  const worker = new Worker(new URL('./argon2.worker.ts', import.meta.url), { type: 'module' });
  const id = crypto.randomUUID(); const passwordBytes = typeof password === 'string' ? new TextEncoder().encode(password) : password;
  return new Promise<Uint8Array>((resolve, reject) => {
    worker.onmessage = ({ data }) => { worker.terminate(); if (data.error) reject(new Error(data.error)); else resolve(new Uint8Array(data.hash)); };
    worker.onerror = () => { worker.terminate(); reject(new Error('Argon2 worker failed')); };
    worker.postMessage({ id, password: passwordBytes, salt, ...options });
  });
}
