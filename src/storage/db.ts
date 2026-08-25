import Dexie, { type Table } from 'dexie';

export type Group = { id: string; name: string; sortOrder: number };
export type Tag = { id: string; name: string };

class LinkmarkDb extends Dexie {
  vaults!: Table<VaultRecord, string>;

  constructor() {
    super('linkmark');
    // This is a development-stage format reset. Advancing the version removes
    // every obsolete plaintext store when an existing browser database opens.
    this.version(2).stores({ vaults: 'id' });
  }
}

export const db = new LinkmarkDb();

export type VaultRecord = { id: 'primary'; data: ArrayBuffer; updatedAt: string };
