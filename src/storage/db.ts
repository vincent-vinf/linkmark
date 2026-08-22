import Dexie, { type Table } from 'dexie';
import type { Target } from '../domain/targets';

export type Group = { id: string; name: string; sortOrder: number };
export type Tag = { id: string; name: string };

class LinkmarkDb extends Dexie {
  targets!: Table<Target, string>;
  groups!: Table<Group, string>;
  tags!: Table<Tag, string>;
  vaults!: Table<VaultRecord, string>;

  constructor() {
    super('linkmark');
    this.version(1).stores({
      targets: 'id, kind, groupId, *tagIds, updatedAt',
      groups: 'id, sortOrder',
      tags: 'id, name',
      vaults: 'id',
    });
  }
}

export const db = new LinkmarkDb();

export type VaultRecord = { id: 'primary'; data: ArrayBuffer; updatedAt: string };

export async function replaceLocalData(data: { targets: Target[]; groups: Group[]; tags: Tag[]; vault: ArrayBuffer }): Promise<void> {
  await db.transaction('rw', db.targets, db.groups, db.tags, db.vaults, async () => {
    await Promise.all([db.targets.clear(), db.groups.clear(), db.tags.clear(), db.vaults.clear()]);
    await db.targets.bulkAdd(data.targets); await db.groups.bulkAdd(data.groups); await db.tags.bulkAdd(data.tags);
    await db.vaults.put({ id: 'primary', data: data.vault, updatedAt: new Date().toISOString() });
  });
}
