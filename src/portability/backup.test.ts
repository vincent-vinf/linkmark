import { describe, expect, it } from "vitest";
import {
  parseBackup,
  parseKeyStoreBackup,
  serializeBackup,
  serializeKeyStoreBackup,
} from "./backup";

describe("full backup seam", () => {
  it("serializes all local records into an encrypted portable string", async () => {
    const group = "11111111-1111-4111-8111-111111111111";
    const target = "22222222-2222-4222-8222-222222222222";
    const backup = await serializeBackup(
      {
        targets: [
          {
            id: target,
            name: "生产",
            notes: "备份备注",
            kind: "web",
            groupId: group,
            sortOrder: 0,
            config: { url: "https://example.com" },
            vaultItemIds: [],
            pinned: false,
            lastAccessAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        groups: [{ id: group, name: "工作", sortOrder: 0 }],
        vault: new Uint8Array([1, 2, 3]).buffer,
      },
      "secret",
    );
    await expect(parseBackup(backup, "secret")).resolves.toMatchObject({
      mode: "backup",
      targets: [{ id: target }],
      groups: [{ id: group }],
    });
  });
});

describe("encrypted key store backup seam", () => {
  it("contains only KDBX ciphertext in the portable payload", async () => {
    const portable = await serializeKeyStoreBackup(
      new Uint8Array([1, 2, 3]).buffer,
      "secret",
    );
    expect(portable).not.toContain("Linkmark 文档");
    await expect(
      parseKeyStoreBackup(portable, "secret"),
    ).resolves.toMatchObject({
      mode: "backup",
      vault: expect.any(ArrayBuffer),
    });
  });

  it("uses a KDBX-encrypted share envelope without a second slow package KDF", async () => {
    const portable = await serializeKeyStoreBackup(
      new Uint8Array([1, 2, 3]).buffer,
      "share-password",
      "share",
    );
    expect(portable).not.toContain("Linkmark 文档");
    await expect(
      parseKeyStoreBackup(portable, "any-value"),
    ).resolves.toMatchObject({ mode: "share", vault: expect.any(ArrayBuffer) });
  });
});
