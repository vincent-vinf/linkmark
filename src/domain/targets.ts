export type TargetKind = 'web' | 'postgresql' | 'redis' | 'generic';

export type Target = {
  id: string;
  name: string;
  kind: TargetKind;
  groupId: string | null;
  tagIds: string[];
  sortOrder: number;
  config: Record<string, string | number | boolean>;
  vaultItemIds: string[];
  createdAt: string;
  updatedAt: string;
};

type NewTarget = Pick<Target, 'name' | 'kind'> & Partial<Omit<Target, 'id' | 'name' | 'kind' | 'createdAt' | 'updatedAt'>>;

const id = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export function createTarget(input: NewTarget): Target {
  const now = new Date().toISOString();
  return {
    id: id(),
    name: input.name.trim(),
    kind: input.kind,
    groupId: input.groupId ?? null,
    tagIds: input.tagIds ?? [],
    sortOrder: input.sortOrder ?? 0,
    config: input.config ?? {},
    vaultItemIds: input.vaultItemIds ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

export function deleteGroup(targets: Target[], groupId: string): Target[] {
  return targets.map((target) =>
    target.groupId === groupId
      ? { ...target, groupId: null, updatedAt: new Date().toISOString() }
      : target,
  );
}

export function deleteTarget(targets: Target[], targetId: string) {
  const deleted = targets.find((target) => target.id === targetId);
  const remaining = targets.filter((target) => target.id !== targetId);
  const stillReferenced = new Set(remaining.flatMap((target) => target.vaultItemIds));
  const orphanVaultItemIds = (deleted?.vaultItemIds ?? []).filter((itemId) => !stillReferenced.has(itemId));
  return { targets: remaining, orphanVaultItemIds };
}

export function validateWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Allows host names, IPv4 and bracketed IPv6 only; credentials and URI syntax belong in Vault Items. */
export function validateConnectionHost(value: string): boolean {
  const host = value.trim();
  if (!host || /[\s@/?#]/.test(host)) return false;
  return /^\[[0-9a-fA-F:.]+\]$/.test(host) || /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host);
}

export function validateTargetConfig(kind: TargetKind, config: Target['config']): boolean {
  if (kind === 'web') return Object.keys(config).length === 1 && typeof config.url === 'string' && validateWebUrl(config.url);
  if (Object.keys(config).some((key) => /pass(word)?|secret|token|api.?key|dsn|uri|user(name)?/i.test(key))) return false;
  if (Object.values(config).some((value) => typeof value === 'string' && /:\/\//.test(value))) return false;
  const port = config.port;
  if (kind === 'postgresql') return validateConnectionHost(String(config.host ?? '')) && typeof port === 'string' && /^\d{1,5}$/.test(port) && Number(port) <= 65535 && typeof config.database === 'string' && ['disable', 'prefer', 'require', 'verify-ca', 'verify-full'].includes(String(config.sslMode));
  if (kind === 'redis') return validateConnectionHost(String(config.host ?? '')) && typeof port === 'string' && /^\d{1,5}$/.test(port) && Number(port) <= 65535 && typeof config.database === 'string' && typeof config.tls === 'boolean';
  return true;
}

export function reorderTargets(targets: Target[], orderedIds: string[]): Target[] {
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  return targets.map((target) => order.has(target.id) ? { ...target, sortOrder: order.get(target.id)!, updatedAt: new Date().toISOString() } : target);
}
