# Explicit portability flows

常规导出只提供由当前 Master Password 保护的完整 Backup Package，不提供明文或仅 Target 的导入导出。Share Package 从解锁内存中的完整数据生成，压缩后以独立分享口令派生的 Argon2id/AES-GCM 密封并 Base64URL 编码；它具有版本、算法、盐、IV、KDF 参数和认证数据，且导入受资源上限约束。普通 Backup Restore、Backup Merge 与分享导入分别提示所需口令和后果，绝不静默假设主密码相同。
