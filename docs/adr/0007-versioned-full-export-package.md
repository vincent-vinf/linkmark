# Versioned full export package

完整备份、恢复和分享统一使用包含明文 Target 元数据与 KDBX 密文的版本化 Linkmark Package；不提供仅 KDBX 导出。普通导出保留原 Vault 密文，分享副本以独立分享口令重新加密、压缩并编码为 Base64URL，接收方导入时以自己的主密码建立本地 Vault。
