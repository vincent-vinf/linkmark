# Linkmark 安全审查报告

## 摘要

本次审查确认 2 项可利用问题：1 项中危的历史明文数据残留，以及 1 项低危的恶意导入包拒绝服务。当前架构没有服务端、账户或网络 API；主风险面是本地浏览器配置文件、导入 KDBX 与解锁后的浏览器执行环境。未发现可确认的 XSS、认证绕过、密钥库解密绕过或远程数据泄露。

基线是 KeePass/KeeWeb 一类本地密码库。与其一致，失陷浏览器配置文件并非完全可防；但本项目承诺 IndexedDB 仅保存加密 Vault，因此升级后仍保留历史明文记录违反了这一存储边界。

| 严重性 | 问题 | 概述 |
| --- | --- | --- |
| MEDIUM | 历史 IndexedDB 明文记录未清除 | 升级用户的旧入口元数据（可能含 URL 凭据）仍可在无需主密码的情况下读取。 |
| LOW | KDBX 导入解压未设输出上限 | 有效但高度压缩的分享包可在导入/预览时耗尽浏览器内存。 |

## MEDIUM — 历史 IndexedDB 明文记录未清除

受影响位置：`src/storage/db.ts:7-20`。

旧版本将入口、分组和标签保存在 `linkmark` IndexedDB 的 `targets`、`groups`、`tags` 表中。迁移到加密 KDBX 后，当前代码仍以同一数据库名和 `version(1)` 打开这些表，却没有升级、迁移或删除它们。Git 历史表明，早于 `f4da2b3` 的版本允许 `https://user:password@host/` 并将该 URL 原样写入 `targets`。因此从旧版本升级的用户，可能在加密 Vault 之外留下主机名、入口名称、分组/标签和 URL 内嵌凭据。

攻击场景：攻击者取得用户浏览器 profile 的副本或本机 IndexedDB 访问能力后，直接打开同源的 `linkmark` 数据库并读取 `targets`。无需主密码，也无需解密 `vaults.primary`，即可获得残留 URL 和元数据；若旧记录带 userinfo，则直接获得凭据。

影响：泄露本应受主密码保护的连接信息，且历史 URL 可能包含用户名和密码。需要本地/profile 访问，故不评为高危；但影响超出项目声明的“IndexedDB 仅保留密文”边界。

建议：将 Dexie schema 升级到新版本，在 upgrade transaction 中清空/删除旧表，并为已处于当前 schema 的升级用户在一次成功 Vault 保存后执行幂等清理。对数据删除行为提供迁移提示，并加入“从旧 v1 数据库升级后旧表为空”的回归测试。

## LOW — KDBX 导入解压未设输出上限

受影响位置：`src/portability/backup.ts:52-54`、`src/App.tsx:35`、`src/vault/vault.ts:58-61`。

v3 便携包只限制 Base64 文本与压缩后 KDBX 的大小。导入后 `unlockVault` 只限制 Argon2 KDF 参数，随后 kdbxweb 在认证完成后同步调用无输出限制的 `gunzipSync` 来解压 KDBX 内容（`node_modules/kdbxweb/dist/kdbxweb.js:2342-2353`）。高度可压缩的、攻击者自行加密且知道口令的 KDBX 可远小于外层限制，却在受害者点击导入或预览时膨胀到数百 MB。

动态复现：30,000,000 字符的有效 KDBX 标题压缩为 30,949-byte vault / 55,124-character package，完整解锁后恢复为 30,000,000 字符；120,000,000 字符样本仅 118,773-byte vault，解锁时完全展开。更大输入可冻结标签页或触发设备内存压力。

攻击场景：攻击者创建上述 KDBX，用自选分享口令包装并诱导受害者粘贴、输入该口令后预览或导入。认证不会阻止攻击，因为攻击者提供的是有效且口令正确的 Vault。

影响：一次用户交互即可造成本地标签页/浏览器拒绝服务，不泄露或篡改数据。

建议：在 KDBX 解压与 XML 解析层引入可强制执行的输出/条目数/字段长度限制；不要只信任 gzip ISIZE。若上游库不支持流式有界解压，应在加载前采用安全的受限解码路径，或限制可导入的 KDBX 格式和未压缩内容大小。

## 硬化建议（非漏洞）

- 为生产响应头配置 `frame-ancestors 'none'` 或等价 X-Frame-Options，减少 UI 被嵌入的可能性。
- 不要将 Vite 开发服务器暴露到不可信网络；开发模式会为 HMR 移除 CSP。
- 在 CI 使用支持 advisory endpoint 的 npm registry 执行依赖审计。本次 `npm audit` 因配置的镜像不支持该接口而无法完成。

## 正向安全模式

- 生产 CSP 为 self-only，应用没有不安全 HTML 渲染、动态代码执行、postMessage/WebSocket 或业务 API。
- 常规书签 URL 限制为无 userinfo 的 HTTP(S)，并以 `noopener,noreferrer` 打开；Chromium 动态测试确认导入数据中的 `javascript:` URL 在该调用方式下不获得源页面执行上下文。
- KDBX 解锁前限制 Argon2 参数，v2 包解压设有输出上限，保存时使用 Argon2id/KDBX4；主密码、解锁对象和 UI 工作区在锁定、pagehide 和绝对超时后清空引用。
- Service Worker 只处理同源 GET 应用壳资源，不缓存 IndexedDB 或 Vault 内容。
