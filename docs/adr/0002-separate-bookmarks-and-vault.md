# Separate Bookmarks and Vault

Bookmark 作为非敏感导航数据可明文持久化，Vault Item 作为敏感记录单独加密；Bookmark 通过多个引用关联 Vault Item。这让未解锁时的导航与搜索可用，同时限制需要解密的数据范围，并支持一个入口使用多个账号或密钥。
