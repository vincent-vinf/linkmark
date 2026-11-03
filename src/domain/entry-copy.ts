import type { VaultItemInput } from "../vault/vault";
import type { Target, TargetKind } from "./targets";

const kindNames: Record<TargetKind, string> = {
  web: "网站",
  ssh: "SSH",
  postgresql: "PostgreSQL",
  redis: "Redis",
  generic: "通用",
};

const configLabels: Record<string, string> = {
  url: "网站地址",
  host: "主机",
  port: "端口",
  database: "数据库",
  sslMode: "SSL 模式",
  tls: "使用 TLS",
  identityFile: "私钥文件路径",
  jumpHost: "跳板机主机",
  jumpPort: "跳板机端口",
  forwardAgent: "代理转发",
  compression: "压缩",
  details: "非敏感资料",
};

/** Plain-text details for this entry and its currently selected credential. */
export function formatEntryCopy(
  entry: Target,
  credential?: VaultItemInput,
): string {
  const lines: string[] = [];
  const add = (label: string, value: string | number | boolean | undefined) => {
    if (value === undefined || value === "") return;
    const text =
      typeof value === "boolean" ? (value ? "是" : "否") : String(value);
    lines.push(`${label}: ${text}`);
  };
  add("名称", entry.name);
  add("类型", kindNames[entry.kind]);
  for (const [key, value] of Object.entries(entry.config))
    add(
      key === "database" && entry.kind === "redis"
        ? "数据库编号"
        : (configLabels[key] ?? key),
      value,
    );
  add("备注", entry.notes);
  if (credential) {
    add("账号", credential.username);
    add("密码", credential.password);
    add("密钥备注", credential.notes);
    for (const [label, value] of Object.entries(credential.fields ?? {}))
      add(label, value);
  }
  return lines.join("\n");
}
