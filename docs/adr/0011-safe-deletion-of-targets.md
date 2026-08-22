# Safe deletion of targets

删除 Target 只删除该 Target 及其 Vault Item 关联，绝不自动删除 Vault Item；失去全部关联的记录成为 Orphan Vault Item，供用户审查。删除 Group 默认将其中 Target 移入 Inbox，避免容器操作造成数据丢失。
