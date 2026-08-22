# Safe target inputs

Web Bookmark 仅接受 HTTP 和 HTTPS URL，拒绝可执行或本地协议；Connection Target 按类别验证结构化的非敏感端点字段，Generic Target 的字段只保存、不执行。应用不直接访问或测试任何用户记录的网络端点。
