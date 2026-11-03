import type { Group } from "../storage/db";

// This ID is only used in the UI. Entries in the default group keep groupId=null.
export const DEFAULT_GROUP_ID = "linkmark:default";

export function orderedGroups(
  groups: Group[],
  defaultGroupSortOrder: number,
): Group[] {
  return [
    { id: DEFAULT_GROUP_ID, name: "默认分组", sortOrder: defaultGroupSortOrder },
    ...groups,
  ].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function nextGroupSortOrder(
  groups: Group[],
  defaultGroupSortOrder: number,
): number {
  return (
    Math.max(-1, defaultGroupSortOrder, ...groups.map((group) => group.sortOrder)) +
    1
  );
}
