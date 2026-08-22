# Linkmark

Linkmark 是一个浏览器本地优先的网站入口、书签与轻量秘密库。它将可公开的导航信息与需要静态加密保护的敏感信息分开管理。

## Language

**Target**:
一个用户保存的访问目标，包含名称、类别、分组、标签和非敏感连接信息，并可关联零个或多个 Vault Item。网页、数据库和缓存服务都是 Target。
_Avoid_: Entry, resource, connection

**Bookmark**:
类别为 Web 的 Target，即可在浏览器中打开的网站入口。
_Avoid_: Link, site entry

**Connection Target**:
类别为数据库、缓存或其他网络服务的 Target；它保存可公开的连接端点和配置，而认证材料必须保存在关联的 Vault Item 中。Connection Target 仅保存资料，不承担连接、测试或管理服务的职责。
_Avoid_: Connection string, DSN

**Group**:
Target 的单层、互斥归属，用于导航和持久化的手动排序；未归属的 Target 位于 Inbox。
_Avoid_: Folder, category

**Tag**:
可附加到任意数量 Target 的交叉分类标签；它不定义 Target 的持久化顺序。
_Avoid_: Label, keyword

**Vault**:
由主密码解锁的加密数据集合，其中的明文只在已解锁的浏览器内存中存在。
_Avoid_: Password database, secret store

**Master Password**:
用户知晓但绝不持久化的口令，用于派生解锁 Vault 或 Import Package 的加密密钥；它不是派生后的密钥本身。
_Avoid_: Master key, encryption key

**Unlock Session**:
从成功输入 Master Password 开始、到手动或自动锁定结束的内存期访问状态。锁定后必须清除 Vault 明文和派生密钥。
_Avoid_: Login session

**Inbox**:
不属于任何 Group 的 Target 的默认归属。
_Avoid_: Uncategorized, root folder

**Orphan Vault Item**:
不再被任何 Target 引用的 Vault Item；它仍保留在 Vault 中，等待用户重新关联或删除。
_Avoid_: Unused password, dangling secret

**Vault Item**:
Vault 中的一个加密秘密记录，可包含账号、密码、API Key、备注和自定义字段，并可被多个 Target 关联。
_Avoid_: Credential, secret, password entry

**Import Package**:
可导出、导入或分享的数据载体；完整包同时携带明文 Bookmark 数据和保持加密的 Vault 数据。
_Avoid_: Backup, share link

**Share Package**:
以独立分享口令二次加密整个 Import Package、再压缩并 Base64URL 编码的可移植载体。它不泄露 Target 或 Vault 的可读元数据。
_Avoid_: Share link, encrypted bookmark list

**Backup Restore**:
以导出时的 Master Password 将完整 Import Package 替换为本地数据的恢复流程。
_Avoid_: Import, sync

**Backup Merge**:
同时解锁备份 Vault 与当前 Vault，再将备份数据合并并以当前 Master Password 保存的导入流程。
_Avoid_: Restore, sync
