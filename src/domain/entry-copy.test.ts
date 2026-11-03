import { describe, expect, it } from "vitest";
import { formatEntryCopy } from "./entry-copy";
import { createTarget, type TargetKind } from "./targets";

describe("copying complete entry details", () => {
  it("formats one credential and all entry details as plain labeled lines without internal metadata", () => {
    const entry = createTarget({
      name: '管理后台 "生产"',
      kind: "web",
      config: { url: "https://example.com/login?a=1&b=2" },
      notes: "第一行\n第二行：保留原文",
      groupId: "internal-group-id",
      vaultItemIds: ["internal-key-id"],
      pinned: true,
    });
    const text = formatEntryCopy(
      entry,
      {
        title: "管理员",
        username: "admin@example.com",
        password: '  p:a\\ss"\n```  ',
        notes: "仅内网使用\n第二行",
        fields: { "API Key": "secret-token", 区域: "cn-north-1" },
      },
      "生产服务",
    );
    expect(text).toBe(
      [
        '名称: 管理后台 "生产"',
        "类型: 网站",
        "分组: 生产服务",
        "网站地址: https://example.com/login?a=1&b=2",
        "备注: 第一行\n第二行：保留原文",
        "密钥名称: 管理员",
        "账号: admin@example.com",
        '密码:   p:a\\ss"\n```  ',
        "密钥备注: 仅内网使用\n第二行",
        "API Key: secret-token",
        "区域: cn-north-1",
      ].join("\n"),
    );
    for (const value of [
      entry.id,
      entry.createdAt,
      "internal-group-id",
      "internal-key-id",
    ])
      expect(text).not.toContain(value);
  });

  it.each<[TargetKind, Record<string, string | number | boolean>, object]>([
    [
      "ssh",
      {
        host: "server.example.com",
        port: "2222",
        identityFile: "~/.ssh/team key",
        jumpHost: "bastion.example.com",
        jumpPort: "2200",
        forwardAgent: false,
        compression: true,
      },
      {
        主机: "server.example.com",
        端口: "2222",
        私钥文件路径: "~/.ssh/team key",
        跳板机主机: "bastion.example.com",
        跳板机端口: "2200",
        代理转发: false,
        压缩: true,
      },
    ],
    [
      "postgresql",
      { host: "[::1]", port: "6432", database: "app/db", sslMode: "require" },
      { 主机: "[::1]", 端口: "6432", 数据库: "app/db", "SSL 模式": "require" },
    ],
    [
      "redis",
      { host: "cache.example.com", port: "6379", database: "0", tls: false },
      {
        主机: "cache.example.com",
        端口: "6379",
        数据库编号: "0",
        "使用 TLS": false,
      },
    ],
    [
      "generic",
      { details: "区域: cn-north-1\n项目: 示例", extra: 0, empty: "" },
      { 非敏感资料: "区域: cn-north-1\n项目: 示例", extra: 0 },
    ],
  ])(
    "includes all %s connection options, including zero and false values",
    (kind, config, expected) => {
      const entry = createTarget({ name: "测试服务", kind, config });
      const text = formatEntryCopy(entry);
      for (const [label, value] of Object.entries(expected)) {
        const rendered =
          typeof value === "boolean" ? (value ? "是" : "否") : value;
        expect(text).toContain(`${label}: ${rendered}`);
      }
      expect(text).not.toContain("empty:");
    },
  );

  it("supports entries without credentials and password-only keys without invented fields", () => {
    const entry = createTarget({
      name: "文档",
      kind: "web",
      config: { url: "https://example.com" },
    });
    expect(formatEntryCopy(entry)).toBe(
      [
        "名称: 文档",
        "类型: 网站",
        "分组: 默认分组",
        "网站地址: https://example.com",
      ].join("\n"),
    );
    expect(formatEntryCopy(entry, { title: "密码", password: "secret" })).toBe(
      [
        "名称: 文档",
        "类型: 网站",
        "分组: 默认分组",
        "网站地址: https://example.com",
        "密钥名称: 密码",
        "密码: secret",
      ].join("\n"),
    );
  });
});
