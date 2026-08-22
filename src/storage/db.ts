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
