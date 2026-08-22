import { argon2id } from 'hash-wasm';

self.onmessage = async ({ data }: MessageEvent<{ id: string; password: Uint8Array; salt: Uint8Array; memorySize: number; iterations: number; parallelism: number; hashLength: number }>) => {
  try {
    const hash = await argon2id({ ...data, outputType: 'binary' });
    self.postMessage({ id: data.id, hash: hash.buffer }, [hash.buffer]);
  } catch (error) { self.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Argon2 failed' }); }
};
