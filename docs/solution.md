# Linkmark v1 方案（待审核）

## 1. 目标与边界

Linkmark 是可自托管的纯静态 PWA，用于管理网站入口、基础设施连接资料和轻量秘密。静态服务器只交付构建产物，永不接触书签、Target、主密码、Vault 明文或任何解密后的数据。

v1 支持 Web、PostgreSQL、Redis 和 Generic 四类 Target。它是资料管理器，不会连接、测试或管理数据库、Redis 或任何其他服务。

不在 v1 范围内：账号体系、云同步、外部系统导入导出、TOTP、附件、浏览器扩展、网页自动填充、远程 favicon/标题抓取，以及任何远程分析或 CDN 依赖。

## 2. 安全承诺与非承诺

### 承诺

- Vault、完整备份和分享包采用成熟密码学方案保护静态数据。
- 主密码、派生密钥和解密后的 Vault 只存在于当前页面内存。
- 应用启动或刷新后必定锁定并要求输入主密码。
- 分享字符串泄露时，攻击者不能在没有分享口令的情况下读取任何 Target 元数据或秘密。
- 不建立秘密的明文搜索索引，不在标题、通知、列表或日志中显示秘密。

### 不承诺

- 无法保护被 XSS 注入的正在运行页面、恶意浏览器扩展、受控浏览器配置文件或已失陷的设备。
- 无法在浏览器底层存储中提供取证级物理擦除。
- 不提供主密码找回；忘记主密码即无法恢复 Vault。
- 不提供跨设备自动同步。

应用首次创建和主密码修改页面必须明确展示这些边界，并提示用户保留加密备份。

## 3. 领域模型

| 概念 | 定义 | 持久化方式 |
| --- | --- | --- |
| Target | 一个保存的访问目标，包含名称、类别、分组、标签与非敏感配置。 | 明文 IndexedDB |
| Bookmark | `kind = web` 的 Target，可从浏览器打开。 | 明文 IndexedDB |
| Connection Target | 数据库、缓存等服务的 Target；只保存端点资料。 | 明文 IndexedDB |
| Vault Item | 加密的秘密记录，包含账号、密码、API Key、备注和自定义字段。 | KDBX |
| Group | Target 的单层、互斥归属，同时定义手动排序范围。 | 明文 IndexedDB |
| Tag | 可附加到多个 Target 的交叉分类。 | 明文 IndexedDB |
| Orphan Vault Item | 没有被 Target 引用的 Vault Item，等待审查或删除。 | KDBX |

一个 Target 可关联零到多个 Vault Item；一个 Vault Item 也可关联多个 Target。关联只存 KDBX entry UUID，不存任何秘密内容。

### Target 最小结构

```ts
type Target = {
  id: UUID;
  kind: 'web' | 'postgresql' | 'redis' | 'generic';
  name: string;
  groupId: UUID | null;
  tagIds: UUID[];
  sortOrder: number;
  config: Record<string, string | number | boolean>;
  vaultItemIds: KdbxEntryUuid[];
  createdAt: ISO8601;
  updatedAt: ISO8601;
};
```

- Web：仅允许 `http:`、`https:` URL。
- PostgreSQL：host、port、database、SSL mode 等非敏感字段。
- Redis：host、port、database number、TLS 等非敏感字段。
- Generic：任意非敏感键值对，只保存、不执行。

用户名、密码、API Key、Token、含凭据的 DSN/URI 和备注均只能进入 Vault Item，不得放入 `config`。

## 4. 本地存储与 Vault

所有业务数据使用 IndexedDB；Dexie 提供访问层。`localStorage` 不保存业务数据、主密码或会话材料，最多可保存无敏感性的主题偏好。

Vault 是一个 KDBX4 二进制文件，使用本地打包、锁版本的 `kdbxweb` 读写；不提供 KDBX 文件导入或导出。新 Vault 显式选择 Argon2id，绝不使用库的默认 KDF。

Argon2id 实现采用本地、可审计且锁版本的 WASM 包，在专用 Worker 中执行。v1 使用应用固定的平衡参数：64 MiB 内存、3 次迭代、并行度 1；用户不调参。参数与算法版本写入 KDBX 和分享包。导入任何外部数据时，对包大小、KDF 内存、迭代和并行度执行严格上限校验。

KDBX 条目保存 Vault Item 的加密标题、账号、密码、备注和自定义字段。Target 与 KDBX 条目的关联位于独立的 Target 数据中，因此锁定时仍只会看到“关联了 N 项秘密”。

## 5. 解锁、锁定与删除

首次使用创建一个 Vault 并两次输入主密码。主密码不设长度或复杂度限制，但提供本地风险提示和长口令建议；不上传或远程检测口令。

- 启动、刷新、关闭标签或浏览器重启后必锁。
- 解锁时用户选择绝对有效期：5 分钟、30 分钟、2 小时、24 小时或 7 天。
- 有效期从解锁开始计时，用户活动不会续期；到期、手动锁定或页面卸载时清除内存中的明文与派生密钥。
- Vault 修改使用明确的“保存”按钮；在 Worker 中重加密并原子写入 IndexedDB。锁定、导出、分享前有未保存改动时，用户必须保存或放弃。
- 秘密默认掩码；显示与复制均由用户显式触发。应用不自动清空系统剪贴板，也不承诺能控制其他应用读取剪贴板。
- 删除的 Vault Item 进入回收站，30 天后自动永久清理；可手动恢复、永久删除或清空。删除 Target 只移除关联，绝不删除 Vault Item；无关联条目显示为 Orphan。

## 6. 导入、导出与分享

### 完整备份

唯一的常规导出格式是由当前主密码保护的完整、版本化 Linkmark JSON Package。整个 Package 加密，故不泄露 Target、分组、标签或基础设施目录；它包含 Target 数据、关系、设置、KDBX 密文、格式版本与完整性数据。

不提供明文、仅 Target、仅 Vault 或外部 KDBX 的导入导出。

导入必须先预览，随后由用户选择：

- **备份恢复**：以备份主密码解锁后，原子替换本地全部数据。
- **备份合并**：同时输入备份主密码和当前主密码；解锁两侧 Vault 后合并，并以当前主密码重新加密。冲突项生成新 UUID，不静默覆盖。

### 分享包

用户在解锁状态下输入独立的分享口令。应用从内存构建完整数据包，先压缩，再以分享口令经 Argon2id 派生的密钥使用 Web Crypto AES-GCM 加密，最后编码为 Base64URL 并复制。

分享包包头至少包含：`formatVersion`、加密算法、盐、IV、KDF 参数、认证数据和密文。接收方粘贴字符串并输入分享口令后预览；导入时以接收方自己的主密码创建或合并本地 Vault。分享口令不会成为接收方的长期主密码。

所有 Package 均具有版本字段和迁移器。遇到较新的未知版本、认证失败、字段结构非法或资源参数超限时，导入必须失败且不改写本地数据。

## 7. UI 与体验

默认简体中文，文案使用本地字典组织，为未来语言包预留边界。界面默认跟随系统深浅色，用户可手动覆盖。

- 左侧为可折叠 Group 导航；窄屏转为抽屉。
- 顶部提供全局搜索、新增入口、导入导出与 Vault 锁定状态。
- 主区为可切换的 Target 卡片/紧凑列表，首页展示置顶与最近访问。
- 编辑使用桌面抽屉、移动端全屏页面；服务 Target 仅展示和编辑资料，不提供测试、连接或 URI 生成操作。
- 锁定时搜索仅覆盖 Target；解锁后才搜索 Vault Item。
- 分组单层；删除分组时其 Target 移入默认分组；标签可多选；每组支持持久化手动排序，名称/更新时间等排序是临时视图。
- 核心路径（解锁、搜索、新建、保存、导入导出）支持键盘操作，满足 WCAG AA 对比度与可见焦点。

## 8. 前端与发布架构

- TypeScript + React + Vite。
- Dexie 管理 IndexedDB；kdbxweb 管理 KDBX；Zod 校验表单和不可信导入包。
- 样式使用本地构建、零运行时 CSS 方案；所有依赖锁入 lockfile 并随同源构建物发布。
- PWA 可安装、可离线启动。Service Worker 仅缓存同源构建资源，不缓存、代理或上传用户数据。
- 每次启动检查静态资源更新；有更新时提示重新加载，安全更新可以要求刷新。
- 生产部署使用 HTTPS，并配置严格 CSP；禁止第三方脚本、字体 CDN、分析 SDK、广告与自动远程 favicon/网页标题抓取。

## 9. 验收与安全测试

实现前后至少覆盖以下验证：

1. 主密码、派生密钥与 Vault 明文不出现在 IndexedDB、localStorage、日志、错误上报或 Service Worker 缓存。
2. 锁定、刷新、超时、手动锁定和页面卸载后 Vault 无法访问。
3. 普通备份恢复、备份合并、分享导入、错误口令、损坏包、未知版本和 KDF 超限包均符合预期，失败不改写数据。
4. 删除 Target、删除 Group、Orphan Vault Item、回收站恢复和 30 天清理均不误删关联秘密。
5. URL 协议校验拒绝 `javascript:`、`data:`、`file:`；所有用户文本都以文本节点渲染，不使用不可信 HTML。
6. Worker KDF/加密失败、IndexedDB 空间不足、剪贴板权限拒绝、离线启动和 PWA 更新都有可理解且不泄露秘密的错误提示。
7. Chrome、Edge、Firefox、Safari 的近两年版本均验证创建、锁定、导入导出、分享和深浅色/窄屏核心流程。

## 10. 实施阶段

1. 初始化 React/TypeScript/PWA 工程、CSP 与本地依赖供应链约束。
2. 实现 IndexedDB schema、Target/Group/Tag 管理、搜索和响应式仪表盘。
3. 集成 KDBX、Argon2id Worker、创建/解锁/锁定/保存、Vault Item 与关联。
4. 实现版本化加密备份、合并/恢复、分享包与导入安全限制。
5. 完成回收站、自动锁定、PWA 更新、无障碍、迁移与安全测试。
