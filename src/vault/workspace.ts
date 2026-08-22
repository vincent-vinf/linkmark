import { ProtectedValue, type Kdbx } from 'kdbxweb';
import type { Target } from '../domain/targets';
import type { Group, Tag } from '../storage/db';
import { ensureLinkmarkStructure, type VaultItemInput, type VaultItemSummary } from './vault';

const dataField = 'LinkmarkData';
const metadataTitle = '.linkmark-metadata';
type WorkspaceMetadata = { groups: Group[]; tags: Tag[] };
export type EncryptedWorkspace = { entries: Target[]; groups: Group[]; tags: Tag[]; keys: VaultItemSummary[] };

const read = (value: unknown) => value instanceof ProtectedValue ? value.getText() : typeof value === 'string' ? value : '';
const partition = (vault: Kdbx, name: string) => {
  ensureLinkmarkStructure(vault);
  const group = vault.getDefaultGroup().groups.find((item) => item.name === name);
  if (!group) throw new Error(`密钥库缺少${name}分区`);
  return group;
};

function metadataEntry(vault: Kdbx) {
  const group = partition(vault, '应用元数据');
  let entry = group.entries.find((item) => read(item.fields.get('Title')) === metadataTitle);
  if (!entry) { entry = vault.createEntry(group); entry.fields.set('Title', metadataTitle); entry.fields.set(dataField, ProtectedValue.fromString(JSON.stringify({ groups: [], tags: [] } satisfies WorkspaceMetadata))); }
  return entry;
}

function metadata(vault: Kdbx): WorkspaceMetadata {
  try { return JSON.parse(read(metadataEntry(vault).fields.get(dataField))) as WorkspaceMetadata; } catch { throw new Error('密钥库应用元数据损坏'); }
}

export function initializeWorkspace(vault: Kdbx): void { ensureLinkmarkStructure(vault); metadataEntry(vault); }

export function addKey(vault: Kdbx, input: VaultItemInput): string { return addVaultItemToGroup(vault, partition(vault, '密钥'), input); }

function addVaultItemToGroup(vault: Kdbx, group: ReturnType<typeof partition>, input: VaultItemInput): string {
  const entry = vault.createEntry(group); entry.fields.set('Title', input.title);
  if (input.username) entry.fields.set('UserName', input.username);
  if (input.password) entry.fields.set('Password', ProtectedValue.fromString(input.password));
  if (input.notes) entry.fields.set('Notes', ProtectedValue.fromString(input.notes));
  for (const [name, value] of Object.entries(input.fields ?? {})) entry.fields.set(name, ProtectedValue.fromString(value));
  return entry.uuid.toString();
}

export function addEntry(vault: Kdbx, entry: Target): void {
  const record = vault.createEntry(partition(vault, '入口'));
  record.fields.set('Title', entry.name);
  record.fields.set(dataField, ProtectedValue.fromString(JSON.stringify(entry)));
}

function entryRecord(vault: Kdbx, id: string) {
  return partition(vault, '入口').entries.find((record) => {
    try { return (JSON.parse(read(record.fields.get(dataField))) as Target).id === id; } catch { return false; }
  });
}

export function updateEntry(vault: Kdbx, entry: Target): boolean {
  const record = entryRecord(vault, entry.id);
  if (!record) return false;
  record.fields.set('Title', entry.name); record.fields.set(dataField, ProtectedValue.fromString(JSON.stringify(entry))); record.times.update();
  return true;
}

export function deleteEntry(vault: Kdbx, id: string): boolean {
  const record = entryRecord(vault, id);
  if (!record) return false;
  vault.createRecycleBin(); vault.remove(record); return true;
}

export function deleteKey(vault: Kdbx, keyId: string): boolean {
  const record = partition(vault, '密钥').entries.find((item) => item.uuid.toString() === keyId);
  if (!record) return false;
  for (const entry of getWorkspace(vault).entries.filter((item) => item.vaultItemIds.includes(keyId))) updateEntry(vault, { ...entry, vaultItemIds: entry.vaultItemIds.filter((id) => id !== keyId), updatedAt: new Date().toISOString() });
  vault.createRecycleBin(); vault.remove(record); return true;
}

export function getWorkspace(vault: Kdbx): EncryptedWorkspace {
  const entries = partition(vault, '入口').entries.flatMap((record) => { try { return [JSON.parse(read(record.fields.get(dataField))) as Target]; } catch { return []; } });
  const keys = partition(vault, '密钥').entries.map((record) => ({ id: record.uuid.toString(), title: read(record.fields.get('Title')), username: read(record.fields.get('UserName')) }));
  const state = metadata(vault);
  return { entries, groups: state.groups, tags: state.tags, keys };
}

export function setWorkspaceMetadata(vault: Kdbx, next: WorkspaceMetadata): void {
  metadataEntry(vault).fields.set(dataField, ProtectedValue.fromString(JSON.stringify(next)));
}
