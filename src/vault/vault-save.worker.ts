import { argon2id } from 'hash-wasm';
import { Consts, Credentials, CryptoEngine, Int64, Kdbx, ProtectedValue, VarDictionary } from 'kdbxweb';

const copyBuffer = (value: Uint8Array): ArrayBuffer => { const copy = new Uint8Array(value.byteLength); copy.set(value); return copy.buffer; };
CryptoEngine.setArgon2Impl(async (password, salt, memory, iterations, length, parallelism) => {
  const hash = await argon2id({ password: new Uint8Array(password), salt: new Uint8Array(salt), memorySize: memory, iterations, parallelism, hashLength: length, outputType: 'binary' });
  return copyBuffer(hash);
});

self.onmessage = async ({ data }: MessageEvent<{ xml?: string; password: string }>) => {
  try {
    const credentials = new Credentials(ProtectedValue.fromString(data.password));
    const vault = data.xml ? await Kdbx.loadXml(data.xml, credentials) : Kdbx.create(credentials, 'Linkmark Vault');
    vault.setKdf(Consts.KdfId.Argon2id);
    vault.header.kdfParameters?.set('M', VarDictionary.ValueType.UInt64, new Int64(64 * 1024 * 1024));
    vault.header.kdfParameters?.set('I', VarDictionary.ValueType.UInt64, new Int64(3));
    vault.header.kdfParameters?.set('P', VarDictionary.ValueType.UInt32, 1);
    const result = await vault.save();
    self.postMessage({ result }, [result]);
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Vault save failed' }); }
};
