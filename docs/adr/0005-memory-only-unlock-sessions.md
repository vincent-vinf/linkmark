# Memory-only unlock sessions

Master Password、派生密钥和已解密 Vault 绝不持久化。每次应用启动或页面刷新都需输入 Master Password；成功后用户可为当前打开页面选择最长七天的闲置自动锁定时间，锁定会清除内存中的敏感材料，且不尝试自动清空系统剪贴板。
