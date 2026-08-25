# MEDIUM+ findings detail

## 历史 IndexedDB 明文记录未清除（MEDIUM）

| 步骤 | 数据流 |
| --- | --- |
| 入口 | 旧版用户升级后，浏览器保留同源 IndexedDB `linkmark` 的 `targets`、`groups`、`tags` 行。当前 `LinkmarkDb` 仍在 `src/storage/db.ts:14-20` 以 v1 schema 注册这些表。 |
| 传播 | 当前应用只读取/写入密文 `vaults.primary`（`src/App.tsx:21,24,30`）；它没有调用唯一会 clear 旧表的 `replaceLocalData`（`src/storage/db.ts:28-32`）。相同 IndexedDB 版本重新打开不会触发 upgrade migration。 |
| 接收端 | 有 profile/forensic 存储访问的攻击者读取 `linkmark.targets`，直接获得旧行的 `config.url` 与元数据，无需调用 `unlockVault`。 |

触发方式不是 HTTP 请求，而是本地浏览器存储读取：

1. 在旧版 Linkmark 中保存 `https://alice:old-password@db.example/`。
2. 升级至当前版本并锁定 Vault。
3. 攻击者取得浏览器 profile，读取同源 `linkmark` IndexedDB 的 `targets` 表。

攻击者得到 URL userinfo、入口名称、主机、分组/标签等历史明文。KeePass 类产品应把持久化 Vault 数据保留为加密 blob；迁移时应删除不再使用的明文对象存储。
