import type { Target } from "../domain/targets";
import type { Group } from "../storage/db";
import type { FullBackup } from "./backup";

export type Metadata = Pick<FullBackup, "targets" | "groups">;
const newId = () => crypto.randomUUID();

export function mergeMetadata(local: Metadata, incoming: Metadata): Metadata {
  const groupMap = new Map<string, string>();
  const localGroupIds = new Set(local.groups.map(({ id }) => id));
  const localTargetIds = new Set(local.targets.map(({ id }) => id));
  const groups: Group[] = [
    ...local.groups,
    ...incoming.groups.map((group) => {
      const id = localGroupIds.has(group.id) ? newId() : group.id;
      groupMap.set(group.id, id);
      return { ...group, id };
    }),
  ];
  const targets: Target[] = [
    ...local.targets,
    ...incoming.targets.map((target) => ({
      ...target,
      id: localTargetIds.has(target.id) ? newId() : target.id,
      groupId: target.groupId
        ? (groupMap.get(target.groupId) ?? target.groupId)
        : null,
    })),
  ];
  return { groups, targets };
}
