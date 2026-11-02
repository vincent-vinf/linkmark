export class CryptoUnavailableError extends Error {
  constructor() {
    super(
      "当前访问地址无法使用浏览器加密功能。请通过 HTTPS 或本机 localhost 访问，再创建或解锁密钥库。",
    );
    this.name = "CryptoUnavailableError";
  }
}

export function assertCryptoAvailable(): void {
  if (!globalThis.crypto?.subtle) throw new CryptoUnavailableError();
}
