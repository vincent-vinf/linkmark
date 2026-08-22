# Targets are records, not clients

Linkmark 的 Connection Target 仅保存和组织连接资料，不直接连接、测试或管理 PostgreSQL、Redis 或其他服务，也不生成可操作的连接 URI。此产品边界让静态网页始终不向用户基础设施发起网络请求，并避免将凭据管理器扩张为多协议客户端。
