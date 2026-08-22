# No secret search index

Target 元数据可在 Vault 锁定时搜索；Vault Item 的标题和字段只在解锁后参与搜索，应用不保存任何明文或可逆的秘密搜索索引。秘密默认掩码，仅在当前视图经用户动作显示或复制，且不出现在列表、标题或通知中。
