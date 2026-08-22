import type { Target } from '../domain/targets';
import type { Group, Tag } from '../storage/db';
import type { FullBackup } from './backup';

export type Metadata = Pick<FullBackup, 'targets' | 'groups' | 'tags'>;
const newId = () => crypto.randomUUID();

export function mergeMetadata(local: Metadata, incoming: Metadata): Metadata {
  const groupMap = new Map<string, string>(); const tagMap = new Map<string, string>();
  const localGroupIds = new Set(local.groups.map(({ id }) => id)); const localTagIds = new Set(local.tags.map(({ id }) => id)); const localTargetIds = new Set(local.targets.map(({ id }) => id));
  const groups: Group[] = [...local.groups, ...incoming.groups.map((group) => { const id = localGroupIds.has(group.id) ? newId() : group.id; groupMap.set(group.id, id); return { ...group, id }; })];
  const tags: Tag[] = [...local.tags, ...incoming.tags.map((tag) => { const id = localTagIds.has(tag.id) ? newId() : tag.id; tagMap.set(tag.id, id); return { ...tag, id }; })];
  const targets: Target[] = [...local.targets, ...incoming.targets.map((target) => ({ ...target, id: localTargetIds.has(target.id) ? newId() : target.id, groupId: target.groupId ? (groupMap.get(target.groupId) ?? target.groupId) : null, tagIds: target.tagIds.map((id) => tagMap.get(id) ?? id) }))];
  return { groups, tags, targets };
}
