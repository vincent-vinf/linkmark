# Local-first security boundary

Linkmark 是纯静态、local-first 的 PWA：服务器仅交付应用文件，永不接触用户数据、主密码或解密后的 Vault。Vault 保护浏览器存储或导出数据泄露时的静态数据；被注入的脚本、恶意扩展和已失陷的设备不在该保护承诺内，因此 XSS 防护与供应链控制是核心工程约束。
