import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Group } from "./storage/db";
import { DEFAULT_GROUP_ID } from "./domain/groups";
import { Dialog, Icon } from "./ui";

export function GroupEditor({
  groups,
  onClose,
  onSave,
  onDelete,
  onReorder,
}: {
  groups: Group[];
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (groups: Group[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [order, setOrder] = useState(groups);
  const orderRef = useRef(groups);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const drag = useRef<{
    id: string;
    pointerId: number;
    handle: HTMLButtonElement;
    captureTarget: HTMLOListElement;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const updateOrder = (next: Group[]) => {
    orderRef.current = next;
    setOrder(next);
  };
  useEffect(() => {
    if (!busy && !draggedId) {
      orderRef.current = groups;
      setOrder(groups);
    }
  }, [groups, busy, draggedId]);

  const mutate = async (action: () => Promise<void>, message: string) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
      return true;
    } catch {
      setError(message);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const move = (id: string, targetId: string) => {
    const next = [...orderRef.current];
    const from = next.findIndex((group) => group.id === id);
    const to = next.findIndex((group) => group.id === targetId);
    if (from < 0 || to < 0 || from === to) return next;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    updateOrder(next);
    return next;
  };
  const saveOrder = async (next: Group[], id: string) => {
    if (next.every((group, index) => group.id === groups[index]?.id)) return;
    const saved = await mutate(
      () =>
        onReorder(next.map((group, sortOrder) => ({ ...group, sortOrder }))),
      "未能保存分组顺序，已恢复原顺序，请重试。",
    );
    if (saved) {
      const index = next.findIndex((group) => group.id === id);
      setStatus(`“${next[index]?.name}”已移至第 ${index + 1} 位，顺序已保存。`);
    } else updateOrder(groups);
  };
  const cancelDrag = () => {
    const active = drag.current;
    drag.current = null;
    setDraggedId(null);
    updateOrder(groups);
    if (active?.captureTarget.hasPointerCapture(active.pointerId))
      active.captureTarget.releasePointerCapture(active.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLOListElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const panel = event.currentTarget.closest<HTMLElement>(".modal");
    const bounds = panel?.getBoundingClientRect();
    if (panel && bounds) {
      if (event.clientY < bounds.top + 40) panel.scrollTop -= 16;
      else if (event.clientY > bounds.bottom - 40) panel.scrollTop += 16;
    }
    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-group-id]");
    if (row?.dataset.groupId) move(active.id, row.dataset.groupId);
  };
  const close = () => {
    if (drag.current) cancelDrag();
    else if (!busyRef.current) onClose();
  };

  return (
    <Dialog onClose={close}>
      <section
        className="modal group-editor"
        role="dialog"
        aria-modal="true"
        aria-label="管理分组"
        aria-busy={busy}
      >
        <div className="modal-heading">
          <h2>管理分组</h2>
          <button
            className="icon-button"
            aria-label="关闭对话框"
            disabled={busy}
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </div>
        <label>
          新分组名称
          <input
            autoFocus
            value={name}
            disabled={busy || !!draggedId}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button
            className="primary"
            disabled={!name.trim() || busy || !!draggedId}
            onClick={() => {
              void mutate(async () => {
                await onSave(name.trim());
                setName("");
              }, "未能新建分组，请重试。");
            }}
          >
            新建分组
          </button>
        </div>
        {order.length > 0 && (
          <>
            <p className="field-hint" id="group-sort-hint">
              拖动左侧手柄排序，也可聚焦手柄后按上下方向键。默认分组也可排序，顺序自动保存。
            </p>
            <ol
              className="group-sort-list"
              aria-label="分组排序"
              onPointerMove={pointerMove}
              onPointerUp={(event) => {
                const active = drag.current;
                if (!active || active.pointerId !== event.pointerId) return;
                drag.current = null;
                setDraggedId(null);
                void saveOrder(orderRef.current, active.id).then(() =>
                  active.handle.focus(),
                );
              }}
              onPointerCancel={cancelDrag}
              onLostPointerCapture={() => {
                if (drag.current) cancelDrag();
              }}
            >
              {order.map((group, index) => (
                <li
                  className={`group-sort-row${draggedId === group.id ? " is-dragging" : ""}`}
                  data-group-id={group.id}
                  key={group.id}
                >
                  <button
                    type="button"
                    className="icon-button group-drag-handle"
                    aria-label={`调整 ${group.name} 的顺序`}
                    aria-describedby="group-sort-hint"
                    aria-disabled={busy || order.length < 2}
                    onPointerDown={(event) => {
                      if (
                        !event.isPrimary ||
                        event.button !== 0 ||
                        busyRef.current ||
                        order.length < 2
                      )
                        return;
                      event.preventDefault();
                      event.currentTarget.focus();
                      const captureTarget = event.currentTarget.closest("ol")!;
                      captureTarget.setPointerCapture(event.pointerId);
                      drag.current = {
                        id: group.id,
                        pointerId: event.pointerId,
                        handle: event.currentTarget,
                        captureTarget,
                      };
                      setDraggedId(group.id);
                      setError("");
                      setStatus("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                        return;
                      event.preventDefault();
                      if (busyRef.current || drag.current) return;
                      const target =
                        orderRef.current[
                          index + (event.key === "ArrowUp" ? -1 : 1)
                        ];
                      if (!target) return;
                      const handle = event.currentTarget;
                      const next = move(group.id, target.id);
                      void saveOrder(next, group.id).then(() => handle.focus());
                    }}
                  >
                    <Icon name="grip" />
                  </button>
                  <span className="group-sort-name">{group.name}</span>
                  {group.id !== DEFAULT_GROUP_ID && (
                    <button
                      type="button"
                      className="group-delete"
                      aria-label={`删除分组 ${group.name}`}
                      disabled={busy || !!draggedId}
                      onClick={() => {
                        if (
                          window.confirm(
                            `删除分组“${group.name}”？其中入口会移入默认分组。`,
                          )
                        )
                          void mutate(
                            () => onDelete(group.id),
                            "未能删除分组，请重试。",
                          );
                      }}
                    >
                      删除
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
        <p className="group-sort-status field-hint" role="status">
          {busy ? "正在保存…" : status}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button disabled={busy || !!draggedId} onClick={close}>
            完成
          </button>
        </div>
      </section>
    </Dialog>
  );
}
