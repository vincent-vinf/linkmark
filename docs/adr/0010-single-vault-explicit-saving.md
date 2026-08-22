# Single Vault with explicit saving

> Superseded by ADR-0021.

每个浏览器配置只管理一个 Vault 和一个 Master Password；个人与工作等区分由 Group、Tag 和 Vault Item 分类表达。Vault 编辑必须经用户显式保存，在 Worker 中重新加密并原子写入 IndexedDB；锁定、导出和分享遇到未保存改动时要求用户保存或放弃。
