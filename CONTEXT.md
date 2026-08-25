# Linkmark

Linkmark 是一个浏览器本地优先的网站入口、书签与轻量密钥库。它将全部业务资料统一加密保存在本机密钥库中。

## Language

**入口**:
一个用户保存的访问位置，包含名称、类别、分组、标签和非敏感连接信息，并可关联零个或多个密钥。入口与密钥是可复用的多对多关系。网页、数据库和缓存服务都是入口；入口仅存在于已解锁的密钥库中。
_Avoid_: Target, resource, connection

**Bookmark**:
类别为 Web 的入口，即可在浏览器中打开的网站入口。
_Avoid_: Link, site entry

**连接入口**:
类别为数据库、缓存或其他网络服务的入口；它保存可公开的连接端点和配置，而认证材料必须保存在关联的密钥中。连接入口仅保存资料，不承担连接、测试或管理服务的职责。
_Avoid_: Connection string, DSN

**Group**:
入口的单层、互斥归属，用于导航和持久化的手动排序；未归属的入口位于默认分组。
_Avoid_: Folder, category

**Tag**:
可附加到任意数量入口的交叉分类标签；它不定义入口的持久化顺序。
_Avoid_: Label, keyword

**密钥库**:
由主密码解锁的唯一加密数据集合；它强制承载全部入口、分组、标签和密钥，其中的明文只在已解锁的浏览器内存中存在。
_Avoid_: Vault, password database, secret store

**Master Password**:
用户知晓但绝不持久化的口令，用于派生解锁密钥库或导入包的加密密钥；它不是派生后的密钥本身。
_Avoid_: Master key, encryption key

**Unlock Session**:
从成功输入主密码开始、到手动或自动锁定结束的内存期访问状态。锁定后必须清除密钥库明文和派生密钥。
_Avoid_: Login session

**Inbox**:
不属于任何分组的入口的默认归属。
_Avoid_: Inbox, Uncategorized, root folder

**未关联密钥**:
不再被任何入口引用的密钥；它仍保留在密钥库中，等待用户重新关联或删除。
_Avoid_: Orphan Vault Item, unused password, dangling secret

**密钥**:
密钥库中的一个加密认证资料记录，可包含账号、密码、API Key、Token、备注和自定义字段，并可被多个入口关联；解除关联不会删除密钥。
_Avoid_: Vault Item, secret, password entry

**导入包**:
可导出、导入或分享的数据载体；完整包携带版本化的密钥库密文，不含任何明文入口、分组、标签或密钥数据。
_Avoid_: Backup, share link

**分享包**:
以独立分享口令重新加密的 KDBX4 密钥库、再经版本化 Base64URL 信封编码的可移植载体。它不泄露入口或密钥库的可读元数据；不再对已由 KDBX4/Argon2id 保护的数据重复执行一层 KDF。
_Avoid_: Share link, encrypted bookmark list

**Backup Restore**:
以导出时的 Master Password 将完整导入包替换为本地数据的恢复流程。
_Avoid_: Import, sync

**Backup Merge**:
同时解锁备份密钥库与当前密钥库，再将备份数据合并并以当前 Master Password 保存的导入流程。
_Avoid_: Restore, sync
