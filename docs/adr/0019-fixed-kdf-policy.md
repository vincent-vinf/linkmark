# Fixed KDF policy

创建 Vault 和 Share Package 时应用使用经测试的平衡 Argon2id 默认参数，不向用户暴露原始内存、迭代和并行度调节。参数与版本始终写入加密容器；导入端验证其资源上限，未来策略升级通过版本化迁移完成。
