# KDBX Vault in IndexedDB

v1 使用成熟的 KDBX 4 JavaScript 实现管理 Vault，并将 KDBX 二进制密文与所有本地应用数据持久化在 IndexedDB。新 Vault 显式采用 Argon2id，并在受限 Worker 中执行派生；Linkmark 自有的 Target、分组、标签和 Target-to-Vault-Item 关联保持在独立的明文数据模型中。KDBX 是内部容器，不提供外部系统的 KDBX 导入或导出。
