# Typed targets and absolute unlock

v1 提供 Web、PostgreSQL、Redis 和 Generic 四种 Target 模板；前三者验证非敏感结构化连接字段，Generic 保存任意非敏感键值。Unlock Session 从解锁时开始使用用户所选的绝对时长，到期必定锁定且不会由用户活动续期；最长时长为七天。
