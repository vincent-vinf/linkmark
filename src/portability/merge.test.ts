import { describe, expect, it } from "vitest";
import { mergeMetadata } from "./merge";

describe("backup merge seam", () => {
  it("keeps local records and remaps colliding imported Group IDs", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const target = "22222222-2222-4222-8222-222222222222";
    const result = mergeMetadata(
      { groups: [{ id, name: "本地", sortOrder: 0 }], targets: [] },
      {
        groups: [{ id, name: "导入", sortOrder: 0 }],
        targets: [
          {
            id: target,
            name: "入口",
            notes: "",
            kind: "web",
            groupId: id,
            sortOrder: 0,
            config: { url: "https://example.com" },
            vaultItemIds: [],
            pinned: false,
            lastAccessAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    );
    expect(result.groups).toHaveLength(2);
    expect(result.targets[0]?.groupId).not.toBe(id);
  });
});
