import { ProtectedValue, type Kdbx } from "kdbxweb";
import { createTarget, type Target } from "../domain/targets";
import type { Group } from "../storage/db";
import {
  ensureLinkmarkStructure,
  type VaultItemInput,
  type VaultItemSummary,
} from "./vault";

const dataField = "LinkmarkData";
const metadataTitle = ".linkmark-metadata";
type WorkspaceMetadata = { groups: Group[] };
export type EncryptedWorkspace = {
  entries: Target[];
  groups: Group[];
  keys: VaultItemSummary[];
};
export type RecycledRecord = {
  id: string;
  title: string;
  kind: "entry" | "key";
  deletedAt: number;
};

const read = (value: unknown) =>
  value instanceof ProtectedValue
    ? value.getText()
    : typeof value === "string"
      ? value
      : "";
const partition = (vault: Kdbx, name: string) => {
  ensureLinkmarkStructure(vault);
  const group = vault
    .getDefaultGroup()
    .groups.find((item) => item.name === name);
  if (!group) throw new Error(`密钥库缺少${name}分区`);
  return group;
};

function metadataEntry(vault: Kdbx) {
  const group = partition(vault, "应用元数据");
  let entry = group.entries.find(
    (item) => read(item.fields.get("Title")) === metadataTitle,
  );
  if (!entry) {
    entry = vault.createEntry(group);
    entry.fields.set("Title", metadataTitle);
    entry.fields.set(
      dataField,
      ProtectedValue.fromString(
        JSON.stringify({ groups: [] } satisfies WorkspaceMetadata),
      ),
    );
  }
  return entry;
}

function metadata(vault: Kdbx): WorkspaceMetadata {
  try {
    const value = JSON.parse(
      read(metadataEntry(vault).fields.get(dataField)),
    ) as Partial<WorkspaceMetadata>;
    return { groups: Array.isArray(value.groups) ? value.groups : [] };
  } catch {
    throw new Error("密钥库应用元数据损坏");
  }
}

/** Old Vaults may contain tagIds. Read them safely but never expose or write them again. */
function readEntry(record: {
  fields: Map<string, string | ProtectedValue>;
}): Target | null {
  try {
    const { tagIds: _legacyTagIds, ...entry } = JSON.parse(
      read(record.fields.get(dataField)),
    ) as Target & { tagIds?: unknown };
    return entry;
  } catch {
    return null;
  }
}

export function initializeWorkspace(vault: Kdbx): void {
  ensureLinkmarkStructure(vault);
  metadataEntry(vault);
}

export function addKey(vault: Kdbx, input: VaultItemInput): string {
  return addVaultItemToGroup(vault, partition(vault, "密钥"), input);
}

function addVaultItemToGroup(
  vault: Kdbx,
  group: ReturnType<typeof partition>,
  input: VaultItemInput,
): string {
  const entry = vault.createEntry(group);
  writeKeyFields(entry, input);
  return entry.uuid.toString();
}

function writeKeyFields(
  record: { fields: Map<string, string | ProtectedValue> },
  input: VaultItemInput,
): void {
  record.fields.clear();
  record.fields.set("Title", input.title);
  if (input.username) record.fields.set("UserName", input.username);
  if (input.password)
    record.fields.set("Password", ProtectedValue.fromString(input.password));
  if (input.notes)
    record.fields.set("Notes", ProtectedValue.fromString(input.notes));
  for (const [name, value] of Object.entries(input.fields ?? {}))
    if (name.trim() && value)
      record.fields.set(name.trim(), ProtectedValue.fromString(value));
}

export function addEntry(vault: Kdbx, entry: Target): void {
  const record = vault.createEntry(partition(vault, "入口"));
  record.fields.set("Title", entry.name);
  record.fields.set(
    dataField,
    ProtectedValue.fromString(JSON.stringify(entry)),
  );
}

function entryRecord(vault: Kdbx, id: string) {
  return partition(vault, "入口").entries.find(
    (record) => readEntry(record)?.id === id,
  );
}

export function updateEntry(vault: Kdbx, entry: Target): boolean {
  const record = entryRecord(vault, entry.id);
  if (!record) return false;
  record.fields.set("Title", entry.name);
  record.fields.set(
    dataField,
    ProtectedValue.fromString(JSON.stringify(entry)),
  );
  record.times.update();
  return true;
}

export function deleteEntry(vault: Kdbx, id: string): boolean {
  const record = entryRecord(vault, id);
  if (!record) return false;
  vault.createRecycleBin();
  vault.remove(record);
  return true;
}

export function deleteKey(vault: Kdbx, keyId: string): boolean {
  const record = partition(vault, "密钥").entries.find(
    (item) => item.uuid.toString() === keyId,
  );
  if (!record) return false;
  for (const entry of getWorkspace(vault).entries.filter((item) =>
    item.vaultItemIds.includes(keyId),
  ))
    updateEntry(vault, {
      ...entry,
      vaultItemIds: entry.vaultItemIds.filter((id) => id !== keyId),
      updatedAt: new Date().toISOString(),
    });
  vault.createRecycleBin();
  vault.remove(record);
  return true;
}

export function updateKey(
  vault: Kdbx,
  id: string,
  input: VaultItemInput,
): boolean {
  const record = partition(vault, "密钥").entries.find(
    (item) => item.uuid.toString() === id,
  );
  if (!record) return false;
  writeKeyFields(record, input);
  record.times.update();
  return true;
}

export function getKey(
  vault: Kdbx,
  id: string,
): (VaultItemInput & { id: string }) | null {
  const record = partition(vault, "密钥").entries.find(
    (item) => item.uuid.toString() === id,
  );
  if (!record) return null;
  const standard = new Set(["Title", "UserName", "Password", "Notes"]);
  return {
    id,
    title: read(record.fields.get("Title")),
    username: read(record.fields.get("UserName")),
    password: read(record.fields.get("Password")),
    notes: read(record.fields.get("Notes")),
    fields: Object.fromEntries(
      [...record.fields.entries()]
        .filter(([name]) => !standard.has(name))
        .map(([name, value]) => [name, read(value)]),
    ),
  };
}

export function listRecycledRecords(vault: Kdbx): RecycledRecord[] {
  const recycleBin = vault.meta.recycleBinUuid
    ? vault.getGroup(vault.meta.recycleBinUuid)
    : undefined;
  return (
    recycleBin?.entries.map((entry) => ({
      id: entry.uuid.toString(),
      title: read(entry.fields.get("Title")),
      kind: entry.fields.has(dataField) ? "entry" : "key",
      deletedAt: entry.lastModTime,
    })) ?? []
  );
}

export function restoreRecycledRecord(vault: Kdbx, id: string): boolean {
  const recycleBin = vault.meta.recycleBinUuid
    ? vault.getGroup(vault.meta.recycleBinUuid)
    : undefined;
  const entry = recycleBin?.entries.find((item) => item.uuid.toString() === id);
  if (!entry) return false;
  const isEntry = entry.fields.has(dataField);
  if (isEntry) {
    try {
      const target = readEntry(entry);
      if (!target) return false;
      const existingKeys = new Set(
        partition(vault, "密钥").entries.map((key) => key.uuid.toString()),
      );
      const vaultItemIds = target.vaultItemIds.filter((keyId) =>
        existingKeys.has(keyId),
      );
      entry.fields.set(
        dataField,
        ProtectedValue.fromString(
          JSON.stringify({
            ...target,
            vaultItemIds,
            updatedAt: new Date().toISOString(),
          }),
        ),
      );
    } catch {
      return false;
    }
  }
  const targetGroup = isEntry
    ? partition(vault, "入口")
    : partition(vault, "密钥");
  vault.move(entry, targetGroup);
  return true;
}

export function permanentlyDeleteRecycledRecord(
  vault: Kdbx,
  id: string,
): boolean {
  const recycleBin = vault.meta.recycleBinUuid
    ? vault.getGroup(vault.meta.recycleBinUuid)
    : undefined;
  const index =
    recycleBin?.entries.findIndex((entry) => entry.uuid.toString() === id) ??
    -1;
  if (index < 0 || !recycleBin) return false;
  recycleBin.entries.splice(index, 1);
  return true;
}

export function emptyRecycledRecords(vault: Kdbx): number {
  const recycleBin = vault.meta.recycleBinUuid
    ? vault.getGroup(vault.meta.recycleBinUuid)
    : undefined;
  if (!recycleBin) return 0;
  const count = recycleBin.entries.length;
  recycleBin.entries.splice(0, count);
  return count;
}

export function purgeExpiredRecycledRecords(
  vault: Kdbx,
  now = Date.now(),
  retentionMs = 30 * 24 * 60 * 60 * 1000,
): number {
  const recycleBin = vault.meta.recycleBinUuid
    ? vault.getGroup(vault.meta.recycleBinUuid)
    : undefined;
  if (!recycleBin) return 0;
  const expired = recycleBin.entries.filter(
    (entry) => entry.lastModTime <= now - retentionMs,
  );
  for (const record of expired)
    recycleBin.entries.splice(recycleBin.entries.indexOf(record), 1);
  return expired.length;
}

/** Removing a group never removes entries: they return to the default group. */
export function deleteWorkspaceGroup(vault: Kdbx, groupId: string): boolean {
  const state = metadata(vault);
  if (!state.groups.some((group) => group.id === groupId)) return false;
  for (const entry of getWorkspace(vault).entries.filter(
    (item) => item.groupId === groupId,
  ))
    updateEntry(vault, {
      ...entry,
      groupId: null,
      updatedAt: new Date().toISOString(),
    });
  setWorkspaceMetadata(vault, {
    ...state,
    groups: state.groups.filter((group) => group.id !== groupId),
  });
  return true;
}

/** Imports decrypted Linkmark records by allocating new IDs, never overwriting local records. */
export function mergeWorkspace(vault: Kdbx, incoming: Kdbx): void {
  initializeWorkspace(vault);
  initializeWorkspace(incoming);
  const local = getWorkspace(vault);
  const source = getWorkspace(incoming);
  const groupIds = new Map<string, string>();
  const keyIds = new Map<string, string>();
  const groups = [...local.groups];
  for (const group of source.groups) {
    const id = crypto.randomUUID();
    groupIds.set(group.id, id);
    groups.push({ ...group, id, sortOrder: groups.length });
  }
  setWorkspaceMetadata(vault, { groups });
  for (const key of source.keys) {
    const detail = getKey(incoming, key.id);
    if (detail) keyIds.set(key.id, addKey(vault, detail));
  }
  for (const entry of source.entries) {
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...copy
    } = entry;
    addEntry(
      vault,
      createTarget({
        ...copy,
        groupId: entry.groupId ? (groupIds.get(entry.groupId) ?? null) : null,
        vaultItemIds: entry.vaultItemIds.flatMap((id) => keyIds.get(id) ?? []),
      }),
    );
  }
}

export function getWorkspace(vault: Kdbx): EncryptedWorkspace {
  const entries = partition(vault, "入口").entries.flatMap((record) => {
    const entry = readEntry(record);
    return entry ? [entry] : [];
  });
  const keys = partition(vault, "密钥").entries.map((record) => ({
    id: record.uuid.toString(),
    title: read(record.fields.get("Title")),
    username: read(record.fields.get("UserName")),
  }));
  const state = metadata(vault);
  return { entries, groups: state.groups, keys };
}

export function setWorkspaceMetadata(
  vault: Kdbx,
  next: WorkspaceMetadata,
): void {
  metadataEntry(vault).fields.set(
    dataField,
    ProtectedValue.fromString(JSON.stringify(next)),
  );
}
