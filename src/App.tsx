import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Kdbx } from "kdbxweb";
import {
  createTarget,
  validateTargetConfig,
  type Target,
  type TargetKind,
} from "./domain/targets";
import { db, type Group } from "./storage/db";
import {
  DEFAULT_GROUP_ID,
  nextGroupSortOrder,
  orderedGroups,
} from "./domain/groups";
import { createVault, saveVault, unlockVault } from "./vault/vault";
import { CryptoUnavailableError } from "./crypto/environment";
import {
  addEntry,
  addKey,
  deleteEntry,
  deleteKey,
  deleteWorkspaceGroup,
  emptyRecycledRecords,
  getKey,
  getWorkspace,
  initializeWorkspace,
  listRecycledRecords,
  mergeWorkspace,
  permanentlyDeleteRecycledRecord,
  purgeExpiredRecycledRecords,
  restoreRecycledRecord,
  setWorkspaceMetadata,
  updateEntry,
  updateKey,
  type EncryptedWorkspace,
  type RecycledRecord,
} from "./vault/workspace";
import {
  parseKeyStoreBackup,
  serializeKeyStoreBackup,
} from "./portability/backup";
import { Dialog, Icon, type IconName } from "./ui";
import { useAppearance } from "./appearance";
import { AppearanceSettings } from "./AppearanceSettings";
import { WebsiteIcon } from "./WebsiteIcon";
import { GroupEditor } from "./GroupEditor";
import { buildSshCommand } from "./domain/ssh";
import { webNavigationCopy } from "./domain/navigation";
import { buildPostgresUri } from "./domain/postgresql";
import { formatEntryCopy } from "./domain/entry-copy";
import "./themes.css";
import "./app.css";
import "./responsive.css";
import "./appearance.css";

const kindIcons: Record<TargetKind, IconName> = {
  web: "globe",
  ssh: "terminal",
  postgresql: "database",
  redis: "server",
  generic: "box",
};

const emptyWorkspace: EncryptedWorkspace = {
  entries: [],
  groups: [],
  defaultGroupSortOrder: -1,
  keys: [],
};
const durations = [
  [300_000, "5 分钟"],
  [1_800_000, "30 分钟"],
  [7_200_000, "2 小时"],
  [86_400_000, "24 小时"],
  [604_800_000, "7 天"],
] as const;
const kindNames: Record<TargetKind, string> = {
  web: "网站",
  ssh: "SSH",
  postgresql: "PostgreSQL",
  redis: "Redis",
  generic: "通用",
};

export default function App() {
  const vaultRef = useRef<Kdbx | null>(null);
  const passwordRef = useRef("");
  const [hasVault, setHasVault] = useState(false);
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const [locked, setLocked] = useState(true);
  const [appearance, setAppearance] = useAppearance();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(300_000);
  const [expiry, setExpiry] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null | undefined>(
    undefined,
  );
  const [view, setView] = useState<"entries" | "keys">("entries");
  const [sortBy, setSortBy] = useState<"manual" | "name" | "updated">("manual");
  const [entryEditor, setEntryEditor] = useState<
    | { mode: "create"; template?: Target }
    | { mode: "edit"; entry: Target }
    | null
  >(null);
  const [keyEditor, setKeyEditor] = useState<string | "new" | null>(null);
  const [groupEditor, setGroupEditor] = useState(false);
  const [recycleOpen, setRecycleOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [opening, setOpening] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [kindFilter, setKindFilter] = useState<TargetKind | "all">("all");
  const [onlyPinned, setOnlyPinned] = useState(false);
  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      document
        .querySelectorAll<HTMLDetailsElement>("details[data-menu][open]")
        .forEach((menu) => {
          if (
            !menu.contains(event.target as Node) ||
            (event.target as HTMLElement).closest("button")
          )
            menu.open = false;
        });
    };
    const shortcuts = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        document
          .querySelectorAll<HTMLDetailsElement>("details[data-menu][open]")
          .forEach((menu) => {
            menu.open = false;
            menu.querySelector("summary")?.focus();
          });
      }
      if (locked || document.querySelector('[role="dialog"]')) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>("[data-workspace-search]")
          ?.focus();
      }
      if (
        !(event.target instanceof HTMLElement) ||
        event.target.closest(
          'input, textarea, select, [contenteditable="true"]',
        )
      )
        return;
      if (
        event.key.toLowerCase() === "n" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        if (view === "keys") setKeyEditor("new");
        else setEntryEditor({ mode: "create" });
      }
    };
    document.addEventListener("click", closeMenus);
    document.addEventListener("keydown", shortcuts);
    return () => {
      document.removeEventListener("click", closeMenus);
      document.removeEventListener("keydown", shortcuts);
    };
  }, [locked, view]);
  useEffect(() => {
    void db.vaults
      .get("primary")
      .then((record) => setHasVault(Boolean(record)));
  }, []);
  const refresh = () => {
    if (vaultRef.current) setWorkspace(getWorkspace(vaultRef.current));
  };
  const persist = async () => {
    const vault = vaultRef.current;
    if (!vault) throw new Error("密钥库已锁定");
    purgeExpiredRecycledRecords(vault);
    const data = await saveVault(vault, passwordRef.current);
    await db.vaults.put({
      id: "primary",
      data,
      updatedAt: new Date().toISOString(),
    });
    refresh();
  };
  const lock = () => {
    vaultRef.current = null;
    passwordRef.current = "";
    setWorkspace(emptyWorkspace);
    setExpiry(null);
    setLocked(true);
    setView("entries");
    setEntryEditor(null);
    setKeyEditor(null);
    setGroupEditor(false);
    setRecycleOpen(false);
    setImportOpen(false);
    setShareOpen(false);
    setNavOpen(false);
    setQuery("");
    setToast("");
    setPassword("");
    setConfirm("");
    setKindFilter("all");
    setOnlyPinned(false);
  };
  useEffect(() => {
    window.addEventListener("pagehide", lock);
    return () => window.removeEventListener("pagehide", lock);
  }, []);
  useEffect(() => {
    if (!expiry) return;
    const timer = window.setTimeout(lock, Math.max(0, expiry - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiry]);
  const open = async (create: boolean) => {
    if (opening) return;
    setOpening(true);
    try {
      setError("");
      if (create && password !== confirm)
        return setError("两次输入的主密码不一致。");
      const source = create
        ? await createVault(password)
        : (await db.vaults.get("primary"))?.data;
      if (!source) return setError("找不到密钥库。");
      const vault = await unlockVault(source, password);
      initializeWorkspace(vault);
      vaultRef.current = vault;
      passwordRef.current = password;
      if (create) await persist();
      else refresh();
      setExpiry(Date.now() + duration);
      setLocked(false);
      setHasVault(true);
      setPassword("");
      setConfirm("");
    } catch (cause) {
      setError(
        cause instanceof CryptoUnavailableError
          ? cause.message
          : create
            ? "无法创建密钥库，请确认浏览器允许本地存储后重试。"
            : "无法打开密钥库，请检查主密码或重试。",
      );
    } finally {
      setOpening(false);
    }
  };
  const importBackup = async (
    encoded: string,
    packagePassword: string,
    localPassword: string,
    mode: "replace" | "merge" = "replace",
  ) => {
    const backup = await parseKeyStoreBackup(encoded, packagePassword);
    const vault = await unlockVault(backup.vault, packagePassword);
    initializeWorkspace(vault);
    if (mode === "merge" && vaultRef.current) {
      const current = vaultRef.current;
      const snapshot = await saveVault(current, passwordRef.current);
      try {
        mergeWorkspace(current, vault);
        await persist();
        setImportOpen(false);
      } catch (cause) {
        vaultRef.current = await unlockVault(snapshot, passwordRef.current);
        refresh();
        throw cause;
      }
      return;
    }
    vaultRef.current = vault;
    passwordRef.current = localPassword;
    await persist();
    setWorkspace(getWorkspace(vault));
    setExpiry(Date.now() + duration);
    setHasVault(true);
    setLocked(false);
    setImportOpen(false);
  };
  const downloadBackup = async () => {
    const vault = vaultRef.current;
    if (!vault) return;
    const text = await serializeKeyStoreBackup(
      await saveVault(vault, passwordRef.current),
      passwordRef.current,
    );
    download(text, "linkmark-backup");
  };
  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast(`${label}已复制到剪贴板`);
      window.setTimeout(() => setToast(""), 2200);
    } catch {
      setToast(`无法复制${label}，请检查浏览器剪贴板权限`);
      window.setTimeout(() => setToast(""), 3200);
    }
  };
  const visible = useMemo(
    () =>
      workspace.entries
        .filter((entry) => {
          if (kindFilter !== "all" && entry.kind !== kindFilter) return false;
          if (onlyPinned && !entry.pinned) return false;
          if (activeGroup !== undefined && entry.groupId !== activeGroup)
            return false;
          const keys = entry.vaultItemIds
            .map((id) => workspace.keys.find((key) => key.id === id))
            .filter(Boolean)
            .map((key) => `${key!.title} ${key!.username}`)
            .join(" ");
          return `${entry.name} ${Object.values(entry.config).join(" ")} ${keys}`
            .toLowerCase()
            .includes(query.toLowerCase());
        })
        .sort((a, b) =>
          sortBy === "name"
            ? a.name.localeCompare(b.name, "zh-CN")
            : sortBy === "updated"
              ? b.updatedAt.localeCompare(a.updatedAt)
              : Number(b.pinned) - Number(a.pinned) ||
                a.sortOrder - b.sortOrder,
        ),
    [workspace, query, activeGroup, sortBy, kindFilter, onlyPinned],
  );
  if (locked)
    return (
      <LockScreen
        appearance={
          <AppearanceSettings
            appearance={appearance}
            onChange={setAppearance}
          />
        }
        hasVault={hasVault}
        opening={opening}
        password={password}
        confirm={confirm}
        duration={duration}
        error={error}
        onPassword={setPassword}
        onConfirm={setConfirm}
        onDuration={setDuration}
        onOpen={() => void open(!hasVault)}
        onImport={() => setImportOpen(true)}
        importOpen={importOpen}
        onCloseImport={() => setImportOpen(false)}
        onImportBackup={importBackup}
      />
    );
  const addGroup = async (name: string) => {
    if (!vaultRef.current) return;
    setWorkspaceMetadata(vaultRef.current, {
      groups: [
        ...workspace.groups,
        {
          id: crypto.randomUUID(),
          name,
          sortOrder: nextGroupSortOrder(
            workspace.groups,
            workspace.defaultGroupSortOrder,
          ),
        },
      ],
    });
    await persist();
  };
  const pageTitle =
    view === "keys"
      ? "密钥"
      : activeGroup === null
        ? "默认分组"
        : activeGroup
          ? workspace.groups.find((group) => group.id === activeGroup)?.name
          : "所有入口";
  const navigate = (
    nextView: "entries" | "keys",
    group?: string | null,
    pinned = false,
  ) => {
    setView(nextView);
    setActiveGroup(group);
    setOnlyPinned(pinned);
    setKindFilter("all");
    setQuery("");
    setNavOpen(false);
  };
  const sidebar = (mobile = false) => (
    <Sidebar
      mobile={mobile}
      workspace={workspace}
      view={view}
      activeGroup={activeGroup}
      onlyPinned={onlyPinned}
      onNavigate={navigate}
      onGroups={() => {
        setNavOpen(false);
        setGroupEditor(true);
      }}
      onRecycle={() => {
        setNavOpen(false);
        setRecycleOpen(true);
      }}
      onLock={lock}
      onClose={() => setNavOpen(false)}
    />
  );
  return (
    <main className="shell">
      <a className="skip-link" href="#workspace">
        跳到资料区
      </a>
      {sidebar()}
      {navOpen && (
        <Dialog
          onClose={() => setNavOpen(false)}
          className="navigation-backdrop"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="资料导航"
            className="navigation-drawer"
          >
            {sidebar(true)}
          </div>
        </Dialog>
      )}
      <section className="content" id="workspace" tabIndex={-1}>
        <header className="topbar">
          <div className="topbar-location">
            <button
              className="icon-button mobile-menu"
              aria-label="打开导航"
              onClick={() => setNavOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <span className="mobile-brand">Linkmark</span>
            <span className="desktop-location">
              私人入口簿 <Icon name="chevron" size={13} />{" "}
              <span>{pageTitle}</span>
            </span>
          </div>
          <div className="topbar-tools">
            <span className="local-label">
              <Icon name="shield" size={15} /> 本地加密
            </span>
            <AppearanceSettings
              appearance={appearance}
              onChange={setAppearance}
            />
            <button className="lock-button" onClick={lock}>
              <Icon name="lock" size={16} />
              <span>锁定</span>
            </button>
          </div>
        </header>
        <div className="workspace-body">
          <header className="workspace-header">
            <div>
              <h1>
                {onlyPinned ? "已置顶" : pageTitle}
                <span className="title-count">
                  {view === "keys"
                    ? workspace.keys.length
                    : onlyPinned
                      ? workspace.entries.filter((e) => e.pinned).length
                      : activeGroup === undefined
                        ? workspace.entries.length
                        : workspace.entries.filter(
                            (e) => e.groupId === activeGroup,
                          ).length}
                </span>
              </h1>
              <p className="page-subtitle">
                {view === "keys"
                  ? "账号、密码与 Token，保存一次，关联多个入口。"
                  : onlyPinned
                    ? "常用的访问地址，随时找到。"
                    : "收好访问地址，需要时一处找到。"}
              </p>
            </div>
            <div className="actions">
              <details className="action-menu" data-menu>
                <summary>
                  <Icon name="download" size={16} />
                  <span>备份与分享</span>
                  <Icon name="down" size={14} />
                </summary>
                <div className="menu-popover">
                  <button onClick={() => void downloadBackup()}>
                    <Icon name="download" />
                    导出备份
                  </button>
                  <button onClick={() => setImportOpen(true)}>
                    <Icon name="upload" />
                    导入加密包
                  </button>
                  <button onClick={() => setShareOpen(true)}>
                    <Icon name="share" />
                    分享
                  </button>
                  <p>用加密包备份或迁移资料</p>
                </div>
              </details>
              <button
                className="primary"
                aria-label={view === "keys" ? "新建密钥" : "新建入口"}
                onClick={() =>
                  view === "keys"
                    ? setKeyEditor("new")
                    : setEntryEditor({ mode: "create" })
                }
              >
                <Icon name="plus" />
                {view === "keys" ? "新建密钥" : "新建入口"}
              </button>
            </div>
          </header>
          {view === "keys" ? (
            <KeyList
              workspace={workspace}
              onNew={() => setKeyEditor("new")}
              onEdit={setKeyEditor}
              onDelete={async (key) => {
                if (
                  window.confirm(`删除密钥“${key.title}”并解除所有入口关联？`)
                ) {
                  deleteKey(vaultRef.current!, key.id);
                  await persist();
                }
              }}
            />
          ) : (
            <EntryList
              visible={visible}
              query={query}
              groups={workspace.groups}
              allEntries={workspace.entries.filter(
                (e) =>
                  (activeGroup === undefined || e.groupId === activeGroup) &&
                  (!onlyPinned || e.pinned),
              )}
              kindFilter={kindFilter}
              onKindFilter={setKindFilter}
              onClear={() => {
                setQuery("");
                setKindFilter("all");
              }}
              onTogglePin={async (entry) => {
                updateEntry(vaultRef.current!, {
                  ...entry,
                  pinned: !entry.pinned,
                });
                try {
                  await persist();
                } catch {
                  setToast("未能保存置顶状态，请重试。");
                }
              }}
              sortBy={sortBy}
              onSort={setSortBy}
              onQuery={setQuery}
              vault={vaultRef.current!}
              onCopy={copyValue}
              onNew={() => setEntryEditor({ mode: "create" })}
              onEdit={(entry) => setEntryEditor({ mode: "edit", entry })}
              onDuplicate={(template) =>
                setEntryEditor({ mode: "create", template })
              }
              onDelete={async (entry) => {
                if (window.confirm(`将“${entry.name}”移入回收站？`)) {
                  deleteEntry(vaultRef.current!, entry.id);
                  await persist();
                }
              }}
            />
          )}
          <footer className="workspace-footer">
            <span>
              <Icon name="shield" size={14} />
              资料加密保存在此浏览器
            </span>
            {expiry && <SessionStatus expiry={expiry} />}
          </footer>
        </div>
        {entryEditor && (
          <EntryEditor
            entry={entryEditor.mode === "edit" ? entryEditor.entry : undefined}
            template={
              entryEditor.mode === "create" ? entryEditor.template : undefined
            }
            initialGroupId={activeGroup}
            keys={workspace.keys}
            groups={workspace.groups}
            onClose={() => setEntryEditor(null)}
            onSave={async (entry, createdKeys) => {
              const vault = vaultRef.current!;
              const keyIds = createdKeys.map((key) => addKey(vault, key));
              const next = {
                ...entry,
                vaultItemIds: [...entry.vaultItemIds, ...keyIds],
              };
              if (entryEditor.mode === "create") addEntry(vault, next);
              else updateEntry(vault, next);
              await persist();
              setEntryEditor(null);
            }}
          />
        )}
        {keyEditor && (
          <KeyEditor
            keyId={keyEditor === "new" ? undefined : keyEditor}
            vault={vaultRef.current!}
            linkedEntries={workspace.entries.filter((entry) =>
              entry.vaultItemIds.includes(keyEditor === "new" ? "" : keyEditor),
            )}
            onClose={() => setKeyEditor(null)}
            onSave={async (id, input) => {
              if (id) updateKey(vaultRef.current!, id, input);
              else addKey(vaultRef.current!, input);
              await persist();
              setKeyEditor(null);
            }}
          />
        )}
        {groupEditor && (
          <GroupEditor
            groups={orderedGroups(
              workspace.groups,
              workspace.defaultGroupSortOrder,
            )}
            onClose={() => setGroupEditor(false)}
            onSave={async (name) => {
              await addGroup(name);
            }}
            onReorder={async (groups) => {
              const vault = vaultRef.current!;
              const previous = getWorkspace(vault);
              setWorkspaceMetadata(vault, {
                groups: groups.filter((group) => group.id !== DEFAULT_GROUP_ID),
                defaultGroupSortOrder:
                  groups.find((group) => group.id === DEFAULT_GROUP_ID)
                    ?.sortOrder ?? -1,
              });
              try {
                await persist();
              } catch (error) {
                setWorkspaceMetadata(vault, {
                  groups: previous.groups,
                  defaultGroupSortOrder: previous.defaultGroupSortOrder,
                });
                throw error;
              }
            }}
            onDelete={async (id) => {
              deleteWorkspaceGroup(vaultRef.current!, id);
              if (activeGroup === id) setActiveGroup(undefined);
              await persist();
            }}
          />
        )}
        {recycleOpen && (
          <RecycleDialog
            vault={vaultRef.current!}
            onClose={() => setRecycleOpen(false)}
            onChanged={persist}
          />
        )}
        {importOpen && (
          <ImportDialog
            hasVault
            onClose={() => setImportOpen(false)}
            onImport={importBackup}
          />
        )}
        {shareOpen && (
          <ShareDialog
            onClose={() => setShareOpen(false)}
            onShare={async (sharePassword, reportProgress) => {
              reportProgress("正在以分享口令加密密钥库…");
              const data = await saveVault(vaultRef.current!, sharePassword);
              reportProgress("正在封装分享字符串…");
              return serializeKeyStoreBackup(data, sharePassword, "share");
            }}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            <Icon name="info" /> {toast}
          </div>
        )}
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Icon name="bookmark" size={24} />
      </span>
      <div>
        Linkmark<small>私人入口簿</small>
      </div>
    </div>
  );
}

function SessionStatus({ expiry }: { expiry: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const minutes = Math.max(1, Math.ceil((expiry - now) / 60_000));
  const label =
    minutes >= 1440
      ? `${Math.ceil(minutes / 1440)} 天`
      : minutes >= 60
        ? `${Math.ceil(minutes / 60)} 小时`
        : `${minutes} 分钟`;
  return (
    <span title={`自动锁定时间：${new Date(expiry).toLocaleString("zh-CN")}`}>
      <Icon name="clock" size={14} />
      {label}后自动锁定
    </span>
  );
}

function Sidebar({
  workspace,
  view,
  activeGroup,
  onlyPinned,
  mobile,
  onNavigate,
  onGroups,
  onRecycle,
  onLock,
  onClose,
}: {
  workspace: EncryptedWorkspace;
  view: "entries" | "keys";
  activeGroup?: string | null;
  onlyPinned: boolean;
  mobile: boolean;
  onNavigate: (
    view: "entries" | "keys",
    group?: string | null,
    pinned?: boolean,
  ) => void;
  onGroups: () => void;
  onRecycle: () => void;
  onLock: () => void;
  onClose: () => void;
}) {
  return (
    <aside
      className={`sidebar ${mobile ? "mobile-sidebar" : "desktop-sidebar"}`}
    >
      <div className="sidebar-brand">
        <Brand />
        {mobile && (
          <button
            className="icon-button"
            aria-label="关闭导航"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        )}
      </div>
      <nav aria-label="资料导航">
        <p className="nav-label">我的资料</p>
        <button
          className={
            view === "entries" && activeGroup === undefined && !onlyPinned
              ? "active"
              : ""
          }
          aria-current={
            view === "entries" && activeGroup === undefined && !onlyPinned
              ? "page"
              : undefined
          }
          onClick={() => onNavigate("entries")}
        >
          <Icon name="grid" />
          <span>所有入口</span>
          <small>{workspace.entries.length}</small>
        </button>
        <button
          className={view === "entries" && onlyPinned ? "active" : ""}
          aria-current={view === "entries" && onlyPinned ? "page" : undefined}
          onClick={() => onNavigate("entries", undefined, true)}
        >
          <Icon name="star" />
          <span>已置顶</span>
          <small>{workspace.entries.filter((e) => e.pinned).length}</small>
        </button>
        <button
          className={view === "keys" ? "active" : ""}
          aria-current={view === "keys" ? "page" : undefined}
          onClick={() => onNavigate("keys")}
        >
          <Icon name="key" />
          <span>全部密钥</span>
          <small>{workspace.keys.length}</small>
        </button>
        <div className="section-title">
          <span>分组</span>
          <button
            className="icon-button"
            aria-label="管理分组"
            title="管理分组"
            onClick={onGroups}
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
        {orderedGroups(workspace.groups, workspace.defaultGroupSortOrder).map(
          (group) => {
            const groupId = group.id === DEFAULT_GROUP_ID ? null : group.id;
            return (
              <button
                key={group.id}
                className={
                  view === "entries" && activeGroup === groupId ? "active" : ""
                }
                aria-current={
                  view === "entries" && activeGroup === groupId
                    ? "page"
                    : undefined
                }
                onClick={() => onNavigate("entries", groupId)}
              >
                <Icon name="folder" />
                <span>{group.name}</span>
                <small>
                  {workspace.entries.filter((e) => e.groupId === groupId).length}
                </small>
              </button>
            );
          },
        )}
        {!workspace.groups.length && (
          <button className="add-group" onClick={onGroups}>
            <Icon name="plus" size={16} />
            <span>新建分组</span>
          </button>
        )}
      </nav>
      <div className="sidebar-bottom">
        <button className="recycle-nav" onClick={onRecycle}>
          <Icon name="trash" />
          <span>回收站</span>
        </button>
        <div className="sidebar-note">
          <Icon name="shield" size={20} />
          <div>
            <strong>你的资料，由你保管</strong>
            <p>仅在此浏览器存储，请定期备份。</p>
          </div>
        </div>
        <button className="sidebar-lock" onClick={onLock}>
          <span className="status-dot" />
          密钥库已解锁
          <Icon name="lock" size={16} />
        </button>
      </div>
    </aside>
  );
}

function LockScreen(props: {
  appearance: ReactNode;
  hasVault: boolean;
  opening: boolean;
  password: string;
  confirm: string;
  duration: number;
  error: string;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
  onDuration: (value: number) => void;
  onOpen: () => void;
  onImport: () => void;
  importOpen: boolean;
  onCloseImport: () => void;
  onImportBackup: (
    encoded: string,
    packagePassword: string,
    localPassword: string,
    mode?: "replace" | "merge",
  ) => Promise<void>;
}) {
  return (
    <main className="lock-screen">
      <section className="lock-copy">
        <Brand />
        <div className="lock-intro">
          <h1>
            把常用入口
            <br />
            和访问凭据，
            <br />
            <span>锁在一起。</span>
          </h1>
          <p>
            从一个网站，到你的自托管服务。
            <br />
            访问资料井井有条，也只属于你。
          </p>
          <div className="lock-guide">
            <div>
              <Icon name="globe" size={22} />
              <span>
                <strong>入口，保存访问地址</strong>
                <small>网站、数据库，以及其他服务</small>
              </span>
            </div>
            <div>
              <Icon name="key" size={22} />
              <span>
                <strong>密钥，保存访问凭据</strong>
                <small>账号、密码与 Token，可关联多个入口</small>
              </span>
            </div>
          </div>
        </div>
        <p className="lock-privacy">
          <Icon name="shield" size={18} />
          本地加密 · 无需注册 · 可离线使用
        </p>
      </section>
      <section className="lock-form-area">
        <div className="lock-topbar">
          <div className="lock-mobile-brand">
            <Brand />
          </div>
          {props.appearance}
        </div>
        <div className="lock-card">
          <span className="lock-form-icon">
            <Icon name="lock" size={25} />
          </span>
          <h2>{props.hasVault ? "欢迎回来" : "创建你的私人密钥库"}</h2>
          <p className="lock-description">
            {props.hasVault
              ? "解锁后，继续管理你的入口与访问凭据。"
              : "设置一个主密码，开始收好你的访问资料。"}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (
                props.password &&
                (props.hasVault || props.confirm) &&
                !props.opening
              )
                props.onOpen();
            }}
            aria-busy={props.opening}
          >
            <label>
              主密码
              <input
                type="password"
                autoComplete={
                  props.hasVault ? "current-password" : "new-password"
                }
                required
                value={props.password}
                onChange={(event) => props.onPassword(event.target.value)}
                placeholder={
                  props.hasVault ? "输入主密码" : "建议使用较长、易记的口令"
                }
                autoFocus
                disabled={props.opening}
              />
            </label>
            {!props.hasVault && (
              <label>
                确认主密码
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={props.confirm}
                  onChange={(event) => props.onConfirm(event.target.value)}
                  placeholder="再输入一次主密码"
                  disabled={props.opening}
                />
              </label>
            )}
            <label>
              保持解锁
              <select
                value={props.duration}
                onChange={(event) =>
                  props.onDuration(Number(event.target.value))
                }
                disabled={props.opening}
              >
                {durations.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <p className="field-hint">到期自动锁定，刷新页面也会立即锁定。</p>
            {props.error && (
              <p className="error" role="alert">
                {props.error}
              </p>
            )}
            <button
              className="primary lock-submit"
              type="submit"
              disabled={
                props.opening ||
                !props.password ||
                (!props.hasVault && !props.confirm)
              }
            >
              {props.opening
                ? "正在打开密钥库…"
                : props.hasVault
                  ? "解锁密钥库"
                  : "创建密钥库"}
              <Icon name={props.opening ? "clock" : "chevron"} size={18} />
            </button>
            <button
              className="text-button"
              type="button"
              onClick={props.onImport}
              disabled={props.opening}
            >
              <Icon name="upload" size={15} />
              {props.hasVault ? "从备份恢复" : "已有备份？导入加密包"}
            </button>
          </form>
          <div className="password-notice">
            <Icon name="info" size={17} />
            <p>
              {props.hasVault
                ? "主密码不会发送给服务器。解锁后的资料仅在当前页面内存中保留。"
                : "主密码无法找回。请妥善保管，并在创建后导出一份加密备份。"}
            </p>
          </div>
        </div>
        <p className="lock-page-footer">服务器只提供页面，不接触你的资料。</p>
      </section>
      {props.importOpen && (
        <ImportDialog
          hasVault={props.hasVault}
          onClose={props.onCloseImport}
          onImport={props.onImportBackup}
        />
      )}
    </main>
  );
}

function EntryList({
  visible,
  query,
  sortBy,
  onSort,
  onQuery,
  vault,
  onCopy,
  onNew,
  onEdit,
  onDuplicate,
  onDelete,
  groups,
  allEntries,
  kindFilter,
  onKindFilter,
  onClear,
  onTogglePin,
}: {
  visible: Target[];
  query: string;
  sortBy: "manual" | "name" | "updated";
  onSort: (sort: "manual" | "name" | "updated") => void;
  onQuery: (value: string) => void;
  vault: Kdbx;
  onCopy: (label: string, value: string) => Promise<void>;
  onNew: () => void;
  onEdit: (entry: Target) => void;
  onDuplicate: (entry: Target) => void;
  onDelete: (entry: Target) => Promise<void>;
  groups: Group[];
  allEntries: Target[];
  kindFilter: TargetKind | "all";
  onKindFilter: (kind: TargetKind | "all") => void;
  onClear: () => void;
  onTogglePin: (entry: Target) => Promise<void>;
}) {
  const [selectedCredentialIds, setSelectedCredentialIds] = useState<
    Record<string, string>
  >({});
  const filtered = Boolean(query.trim() || kindFilter !== "all");
  return (
    <>
      <div className="search-row">
        <label className="search">
          <Icon name="search" size={20} />
          <input
            data-workspace-search
            aria-label="搜索入口"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="搜索入口名称、地址或关联密钥…"
          />
          <kbd>Ctrl / ⌘ K</kbd>
        </label>
        {query && (
          <button
            className="icon-button clear-search"
            aria-label="清除搜索"
            onClick={() => onQuery("")}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
      <div className="directory-toolbar">
        <div className="type-filters" role="group" aria-label="入口类型筛选">
          {(
            ["all", "web", "ssh", "postgresql", "redis", "generic"] as const
          ).map((kind) => (
            <button
              key={kind}
              aria-pressed={kindFilter === kind}
              className={kindFilter === kind ? "selected" : ""}
              onClick={() => onKindFilter(kind)}
            >
              {kind === "all" ? "全部" : kindNames[kind]}
              <span>
                {kind === "all"
                  ? allEntries.length
                  : allEntries.filter((e) => e.kind === kind).length}
              </span>
            </button>
          ))}
        </div>
        <label className="sort-label">
          <span>排序</span>
          <select
            aria-label="入口排序"
            value={sortBy}
            onChange={(event) =>
              onSort(event.target.value as "manual" | "name" | "updated")
            }
          >
            <option value="manual">置顶优先</option>
            <option value="name">名称</option>
            <option value="updated">最近更新</option>
          </select>
        </label>
      </div>
      {visible.length ? (
        <>
          <div className="results-caption" role="status">
            {filtered
              ? `找到 ${visible.length} 个入口`
              : `${visible.length} 个入口`}
            {filtered && (
              <button className="text-action" onClick={onClear}>
                清除筛选
              </button>
            )}
          </div>
          <div className="grid">
            {visible.map((entry) => {
              const credentials = entry.vaultItemIds
                .map((id) => getKey(vault, id))
                .filter((key): key is NonNullable<typeof key> => Boolean(key));
              const selectedCredential =
                credentials.find(
                  (key) => key.id === selectedCredentialIds[entry.id],
                ) ?? credentials[0];
              const isWeb =
                entry.kind === "web" && typeof entry.config.url === "string";
              const navigationCopy = isWeb
                ? webNavigationCopy(selectedCredential)
                : null;
              const copyForNavigation = () => {
                if (navigationCopy)
                  void onCopy(navigationCopy.label, navigationCopy.value);
              };
              const sshCommand =
                entry.kind === "ssh"
                  ? buildSshCommand(entry.config, selectedCredential?.username)
                  : null;
              const postgresUri =
                entry.kind === "postgresql"
                  ? buildPostgresUri(entry.config, selectedCredential)
                  : null;
              const address =
                entry.kind === "web"
                  ? String(entry.config.url)
                      .replace(/^https?:\/\//, "")
                      .replace(/\/$/, "")
                  : entry.config.host
                    ? `${entry.config.host}${entry.config.port ? `:${entry.config.port}` : ""}`
                    : Object.values(entry.config).join(" · ") || "通用服务资料";
              const group = groups.find((g) => g.id === entry.groupId)?.name;
              return (
                <article
                  className={`card${entry.pinned ? " is-pinned" : ""}`}
                  key={entry.id}
                >
                  <div className="card-top">
                    <span className={`kind kind-${entry.kind}`}>
                      {isWeb ? (
                        <WebsiteIcon
                          key={String(entry.config.url)}
                          url={String(entry.config.url)}
                        />
                      ) : (
                        <Icon name={kindIcons[entry.kind]} size={22} />
                      )}
                    </span>
                    <span className="card-type">{kindNames[entry.kind]}</span>
                    {entry.pinned && (
                      <span className="pin-label" title="已置顶">
                        <Icon name="star" size={13} />
                        置顶
                      </span>
                    )}
                    <details className="card-menu action-menu" data-menu>
                      <summary
                        className="icon-button"
                        aria-label={`更多操作 ${entry.name}`}
                      >
                        <Icon name="more" />
                      </summary>
                      <div className="menu-popover">
                        <button
                          aria-label={`编辑入口资料 ${entry.name}`}
                          onClick={() => onEdit(entry)}
                        >
                          <Icon name="edit" />
                          编辑入口
                        </button>
                        <button
                          aria-label={`复制入口 ${entry.name}`}
                          onClick={() => onDuplicate(entry)}
                        >
                          <Icon name="copy" />
                          复制入口
                        </button>
                        <button onClick={() => void onTogglePin(entry)}>
                          <Icon name="star" />
                          {entry.pinned ? "取消置顶" : "置顶入口"}
                        </button>
                        <button
                          className="danger"
                          aria-label={`删除 ${entry.name}`}
                          onClick={() => void onDelete(entry)}
                        >
                          <Icon name="trash" />
                          移入回收站
                        </button>
                      </div>
                    </details>
                  </div>
                  <div className="card-body">
                    <h2>
                      {isWeb ? (
                        <a
                          href={String(entry.config.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={
                            navigationCopy
                              ? `打开网站，同时复制${navigationCopy.label}`
                              : "打开网站"
                          }
                          onClick={copyForNavigation}
                          onAuxClick={(event) => {
                            if (event.button === 1) copyForNavigation();
                          }}
                        >
                          {entry.name}
                          <Icon name="external" size={15} />
                        </a>
                      ) : entry.kind === "postgresql" ? (
                        <button
                          title="复制 PostgreSQL 连接地址"
                          disabled={!postgresUri}
                          onClick={() =>
                            postgresUri &&
                            void onCopy("PostgreSQL 连接地址", postgresUri)
                          }
                        >
                          {entry.name}
                        </button>
                      ) : (
                        <button onClick={() => onEdit(entry)}>
                          {entry.name}
                        </button>
                      )}
                    </h2>
                    <p className="entry-address" title={address}>
                      {address}
                    </p>
                    {entry.notes && (
                      <p className="card-note" title={entry.notes}>
                        {entry.notes}
                      </p>
                    )}
                    {group && (
                      <span className="group-chip">
                        <Icon name="folder" size={12} />
                        {group}
                      </span>
                    )}
                  </div>
                  <div className="card-credentials">
                    {selectedCredential ? (
                      <div className="credential-heading">
                        <Icon name="key" size={14} />
                        <label className="credential-picker">
                          <span className="sr-only">
                            {entry.name} 的复制密钥
                          </span>
                          <select
                            aria-label={`${entry.name} 的复制密钥`}
                            value={selectedCredential.id}
                            disabled={credentials.length < 2}
                            onChange={(event) =>
                              setSelectedCredentialIds((current) => ({
                                ...current,
                                [entry.id]: event.target.value,
                              }))
                            }
                          >
                            {credentials.map((key) => (
                              <option key={key.id} value={key.id}>
                                {key.title}
                                {key.username ? ` · ${key.username}` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : (
                      <div className="no-credentials">
                        <Icon name="key" size={14} />
                        <span>未关联密钥</span>
                        <button onClick={() => onEdit(entry)}>
                          关联密钥
                          <Icon name="plus" size={14} />
                        </button>
                      </div>
                    )}
                    <div className="credential-actions">
                      {selectedCredential?.username && (
                        <button
                          aria-label={`复制 ${entry.name} 的账号`}
                          onClick={() =>
                            void onCopy(
                              "账号",
                              selectedCredential.username ?? "",
                            )
                          }
                        >
                          <Icon name="copy" size={14} />
                          复制账号
                        </button>
                      )}
                      {selectedCredential?.password && (
                        <button
                          aria-label={`复制 ${entry.name} 的密钥`}
                          onClick={() =>
                            void onCopy(
                              "密钥",
                              selectedCredential.password ?? "",
                            )
                          }
                        >
                          <Icon name="copy" size={14} />
                          复制密钥
                        </button>
                      )}
                      <button
                        aria-label={`复制 ${entry.name} 的全部资料`}
                        title="复制入口和当前选中密钥的资料，包含账号、密码及自定义字段"
                        onClick={() =>
                          void onCopy(
                            "全部资料",
                            formatEntryCopy(entry, selectedCredential),
                          )
                        }
                      >
                        <Icon name="copy" size={14} />
                        复制全部
                      </button>
                    </div>
                  </div>
                  <div className="card-footer">
                    {isWeb ? (
                      <a
                        href={String(entry.config.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={copyForNavigation}
                        onAuxClick={(event) => {
                          if (event.button === 1) copyForNavigation();
                        }}
                      >
                        {navigationCopy
                          ? `打开并复制${navigationCopy.label}`
                          : "打开网站"}
                        <Icon name="external" size={14} />
                      </a>
                    ) : entry.kind === "postgresql" ? (
                      <button
                        disabled={!postgresUri}
                        onClick={() =>
                          postgresUri &&
                          void onCopy("PostgreSQL 连接地址", postgresUri)
                        }
                        aria-label={`复制 ${entry.name} 的 PostgreSQL 连接地址`}
                      >
                        <Icon name="copy" size={14} />
                        复制连接地址
                      </button>
                    ) : entry.kind === "ssh" ? (
                      <button
                        disabled={!sshCommand}
                        onClick={() =>
                          sshCommand && void onCopy("SSH 命令", sshCommand)
                        }
                        aria-label={`复制 ${entry.name} 的 SSH 命令`}
                      >
                        <Icon name="copy" size={14} />
                        复制 SSH 命令
                      </button>
                    ) : (
                      <button onClick={() => onEdit(entry)}>
                        查看资料
                        <Icon name="chevron" size={14} />
                      </button>
                    )}
                    <button
                      className="icon-button"
                      aria-label={`编辑 ${entry.name}`}
                      title="编辑入口"
                      onClick={() => onEdit(entry)}
                    >
                      <Icon name="edit" size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="empty">
          <span className="empty-icon">
            <Icon name={filtered ? "search" : "bookmark"} size={30} />
          </span>
          <h2>{filtered ? "没有找到匹配的入口" : "收好你的第一个入口"}</h2>
          <p>
            {filtered
              ? "试试其他关键词，或清除筛选条件。"
              : "先保存一个常用的网站或服务地址，再按需关联账号与密钥。"}
          </p>
          <button className="primary" onClick={filtered ? onClear : onNew}>
            {filtered ? "清除筛选" : "新建入口"}
            <Icon name={filtered ? "close" : "plus"} size={17} />
          </button>
          {!filtered && (
            <div className="empty-explainer">
              <span>
                <Icon name="globe" />
                入口保存「去哪里」
              </span>
              <Icon name="chevron" size={16} />
              <span>
                <Icon name="key" />
                密钥保存「如何访问」
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function KeyList({
  workspace,
  onNew,
  onEdit,
  onDelete,
}: {
  workspace: EncryptedWorkspace;
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (key: EncryptedWorkspace["keys"][number]) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [unlinked, setUnlinked] = useState(false);
  const countLinks = (id: string) =>
    workspace.entries.filter((entry) => entry.vaultItemIds.includes(id));
  const visible = workspace.keys.filter(
    (key) =>
      (!unlinked || !countLinks(key.id).length) &&
      `${key.title} ${key.username ?? ""}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <label className="search">
        <Icon name="search" size={20} />
        <input
          data-workspace-search
          aria-label="搜索密钥"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索密钥名称或账号…"
        />
        <kbd>Ctrl / ⌘ K</kbd>
      </label>
      <div className="directory-toolbar">
        <div className="type-filters" role="group" aria-label="密钥关联筛选">
          <button
            aria-pressed={!unlinked}
            className={!unlinked ? "selected" : ""}
            onClick={() => setUnlinked(false)}
          >
            全部<span>{workspace.keys.length}</span>
          </button>
          <button
            aria-pressed={unlinked}
            className={unlinked ? "selected" : ""}
            onClick={() => setUnlinked(true)}
          >
            未关联密钥
            <span>
              {
                workspace.keys.filter((key) => !countLinks(key.id).length)
                  .length
              }
            </span>
          </button>
        </div>
        <span className="list-hint">密钥值默认隐藏</span>
      </div>
      {visible.length ? (
        <div className="vault-list">
          <table className="key-table">
            <thead>
              <tr>
                <th>密钥名称 / 账号</th>
                <th>关联入口</th>
                <th>
                  <span className="sr-only">操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((key) => {
                const linked = countLinks(key.id);
                return (
                  <tr key={key.id}>
                    <td>
                      <button
                        className="vault-item"
                        onClick={() => onEdit(key.id)}
                      >
                        <span className="key-avatar">
                          <Icon name="key" size={19} />
                        </span>
                        <span>
                          <strong>{key.title}</strong>
                          <small>{key.username || "未填写账号"}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span
                        className={`key-links ${linked.length ? "" : "unlinked"}`}
                        title={linked.map((entry) => entry.name).join("、")}
                      >
                        {linked.length ? `${linked.length} 个入口` : "未关联"}
                      </span>
                    </td>
                    <td>
                      <div className="key-row-actions">
                        <button
                          className="text-action"
                          aria-label={`查看密钥 ${key.title}`}
                          onClick={() => onEdit(key.id)}
                        >
                          查看
                          <Icon name="chevron" size={14} />
                        </button>
                        <button
                          className="icon-button delete-key"
                          aria-label={`删除密钥 ${key.title}`}
                          onClick={() => void onDelete(key)}
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <span className="empty-icon">
            <Icon name={query || unlinked ? "search" : "key"} size={30} />
          </span>
          <h2>
            {query || unlinked
              ? "没有匹配的密钥"
              : "凭据存一次，多个入口都能用"}
          </h2>
          <p>
            {query || unlinked
              ? "更换关键词，或查看全部密钥。"
              : "将账号、密码或 Token 保存为密钥，再关联到需要它的入口。"}
          </p>
          <button
            className="primary"
            onClick={
              query || unlinked
                ? () => {
                    setQuery("");
                    setUnlinked(false);
                  }
                : onNew
            }
          >
            <Icon name={query || unlinked ? "close" : "plus"} size={17} />
            {query || unlinked ? "清除筛选" : "新建密钥"}
          </button>
        </div>
      )}
      <p className="directory-note">
        <Icon name="info" size={15} />
        解除关联不会删除密钥。你可以在入口编辑中重新关联。
      </p>
    </>
  );
}

type PendingKey = {
  id: string;
  title: string;
  username?: string;
  password?: string;
  notes?: string;
};

function EntryEditor({
  entry,
  template,
  initialGroupId,
  keys,
  groups,
  onClose,
  onSave,
}: {
  entry?: Target;
  template?: Target;
  initialGroupId?: string | null;
  keys: EncryptedWorkspace["keys"];
  groups: Group[];
  onClose: () => void;
  onSave: (
    entry: Target,
    createdKeys: Array<{
      title: string;
      username?: string;
      password?: string;
      notes?: string;
    }>,
  ) => Promise<void>;
}) {
  const [screen, setScreen] = useState<"details" | "keys" | "new-key">(
    "details",
  );
  const initial = entry ?? template;
  const [name, setName] = useState(
    entry?.name ?? (template ? `${template.name}(副本)` : ""),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [kind, setKind] = useState<TargetKind>(initial?.kind ?? "web");
  const [config, setConfig] = useState<
    Record<string, string | number | boolean>
  >(stringConfig(initial?.config));
  const [groupId, setGroupId] = useState(
    initial ? (initial.groupId ?? "") : (initialGroupId ?? ""),
  );
  const [selected, setSelected] = useState([...(initial?.vaultItemIds ?? [])]);
  const [pendingKeys, setPendingKeys] = useState<PendingKey[]>([]);
  const [sshUser, setSshUser] = useState("");
  const [sshPassword, setSshPassword] = useState("");
  const [sshCopyStatus, setSshCopyStatus] = useState("");
  const [keySearch, setKeySearch] = useState("");
  const [keyTitle, setKeyTitle] = useState("");
  const [keyUser, setKeyUser] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [keyNotes, setKeyNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const setField = (field: string, value: string | boolean) =>
    setConfig((current) => ({ ...current, [field]: value }));
  const toggleKey = (id: string) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  const linked = [
    ...selected
      .map((id) => keys.find((key) => key.id === id))
      .filter((key): key is NonNullable<typeof key> => Boolean(key))
      .map((key) => ({ id: key.id, title: key.title, username: key.username })),
    ...pendingKeys.filter((key) => selected.includes(key.id)),
  ];
  const existingIds = new Set(keys.map((key) => key.id));
  const sshUsername = linked.length
    ? (linked[0]?.username ?? "")
    : sshUser.trim();
  const sshPreview =
    kind === "ssh"
      ? buildSshCommand(normalizeConfig(kind, config), sshUsername)
      : null;
  useEffect(() => setSshCopyStatus(""), [sshPreview]);
  const copySshPreview = async () => {
    if (!sshPreview) return;
    try {
      await navigator.clipboard.writeText(sshPreview);
      setSshCopyStatus("SSH 命令已复制");
    } catch {
      setSshCopyStatus(
        "无法复制，请检查浏览器剪贴板权限，或手动选择命令复制。",
      );
    }
  };
  const filteredKeys = keys.filter((key) =>
    `${key.title} ${key.username ?? ""}`
      .toLocaleLowerCase()
      .includes(keySearch.toLocaleLowerCase()),
  );
  const createPendingKey = () => {
    if (!keyTitle.trim()) return setError("请填写密钥名称。");
    const draft = {
      id: `draft-${crypto.randomUUID()}`,
      title: keyTitle.trim(),
      username: keyUser,
      password: keyValue,
      notes: keyNotes,
    };
    setPendingKeys((items) => [...items, draft]);
    setSelected((ids) => [...ids, draft.id]);
    setKeyTitle("");
    setKeyUser("");
    setKeyValue("");
    setKeyNotes("");
    setError("");
    setScreen("keys");
  };
  const submit = async () => {
    if (saving) return;
    setError("");
    const cleaned = normalizeConfig(kind, config);
    if (
      !name.trim() ||
      !validateTargetConfig(kind, cleaned) ||
      (kind === "ssh" && !buildSshCommand(cleaned, sshUsername))
    )
      return setError(
        kind === "web"
          ? "请填写有效的 HTTP 或 HTTPS 网站地址。"
          : kind === "ssh"
            ? "请填写名称和有效主机，端口应为 1–65535；登录账号和文件路径不能包含换行或控制字符。"
            : "请检查连接资料；账号、密码、DSN 和 Token 必须保存为密钥。",
      );
    const base = entry
      ? {
          ...entry,
          name: name.trim(),
          notes: notes.trim(),
          kind,
          config: cleaned,
          groupId: groupId || null,
          vaultItemIds: selected.filter((id) => existingIds.has(id)),
          updatedAt: new Date().toISOString(),
        }
      : createTarget({
          name,
          notes: notes.trim(),
          kind,
          config: cleaned,
          groupId: groupId || null,
          vaultItemIds: selected.filter((id) => existingIds.has(id)),
        });
    setSaving(true);
    try {
      await onSave(base, [
        ...pendingKeys
          .filter((key) => selected.includes(key.id))
          .map(({ id: _id, ...key }) => key),
        ...(kind === "ssh" && !linked.length && (sshUser.trim() || sshPassword)
          ? [
              {
                title: `${name.trim()} · SSH 登录`,
                username: sshUser.trim(),
                password: sshPassword,
              },
            ]
          : []),
      ]);
    } catch {
      setError("未能保存入口，请保持页面打开并重试。");
    } finally {
      setSaving(false);
    }
  };
  const heading =
    screen === "details"
      ? entry
        ? "编辑入口"
        : template
          ? "复制入口"
          : "新建入口"
      : screen === "keys"
        ? "关联密钥"
        : "新建密钥";
  return (
    <Dialog
      onClose={() => {
        if (!saving) onClose();
      }}
      className="editor-backdrop"
    >
      <section
        className="modal entry-modal"
        aria-busy={saving}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
      >
        <div className="modal-heading">
          <div>
            {screen !== "details" && (
              <button
                className="back-button"
                type="button"
                onClick={() =>
                  setScreen(screen === "new-key" ? "keys" : "details")
                }
              >
                <Icon name="chevron" size={15} /> 返回
              </button>
            )}
            <h2>{heading}</h2>
            <p className="editor-description">
              {screen === "details"
                ? template
                  ? "已填入原入口资料，保存后创建独立入口；关联密钥继续复用。"
                  : "保存访问地址，并按需关联账号与密钥。"
                : screen === "keys"
                  ? "一个密钥可用于多个入口，关联不会创建副本。"
                  : "保存入口时，新密钥会一起加密保存。"}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="关闭对话框"
            disabled={saving}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {screen === "details" ? (
          <>
            <label>
              名称
              <input
                autoFocus
                placeholder="例如：个人博客、开发数据库"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              类型
              <select
                aria-label="入口类型"
                value={kind}
                onChange={(event) => {
                  const next = event.target.value as TargetKind;
                  setKind(next);
                  setConfig(defaultConfig(next));
                }}
              >
                <option value="web">网站</option>
                <option value="ssh">SSH</option>
                <option value="postgresql">PostgreSQL</option>
                <option value="redis">Redis</option>
                <option value="generic">通用</option>
              </select>
            </label>
            <ConfigFields kind={kind} config={config} setField={setField} />
            {kind === "ssh" && (
              <>
                {!linked.length ? (
                  <fieldset className="ssh-auth">
                    <legend>登录资料（可选）</legend>
                    <label>
                      登录账号
                      <input
                        value={sshUser}
                        onChange={(event) => setSshUser(event.target.value)}
                        placeholder="例如：root、ubuntu、deploy"
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      登录密码
                      <input
                        type="password"
                        value={sshPassword}
                        onChange={(event) => setSshPassword(event.target.value)}
                        autoComplete="new-password"
                        placeholder="使用私钥时可留空"
                      />
                    </label>
                    <p className="field-hint">
                      填写后会创建并关联一把密钥；也可在下方选择已有密钥。密码不会写入命令。
                    </p>
                  </fieldset>
                ) : (
                  <p className="field-hint">
                    登录账号使用关联密钥中的账号；关联多把密钥时，可在入口卡片中切换。
                  </p>
                )}
                <section className="ssh-command" aria-label="SSH 命令预览">
                  <div>
                    <h3>SSH 命令</h3>
                    <button
                      type="button"
                      disabled={!sshPreview}
                      onClick={() => void copySshPreview()}
                    >
                      <Icon name="copy" size={14} />
                      复制命令
                    </button>
                  </div>
                  <code>
                    {sshPreview ?? "填写有效的主机和端口后，将在这里生成命令。"}
                  </code>
                  <p className="field-hint">
                    复制到 macOS、Linux 或 WSL 终端运行。
                  </p>
                  {sshCopyStatus && (
                    <p className="field-hint" role="status">
                      {sshCopyStatus}
                    </p>
                  )}
                </section>
              </>
            )}
            <label>
              分组
              <select
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
              >
                <option value="">默认分组</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              备注（可选）
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="例如：仅限公司网络访问"
              />
            </label>
            <section className="linked-key-summary">
              <div>
                <span>关联密钥</span>
                <strong>
                  {linked.length
                    ? linked
                        .map((key) =>
                          key.username
                            ? `${key.title} · ${key.username}`
                            : key.title,
                        )
                        .join("、")
                    : "可选：添加账号、密码或 Token"}
                </strong>
              </div>
              <button
                type="button"
                aria-label="管理关联密钥"
                onClick={() => {
                  setError("");
                  setScreen("keys");
                }}
              >
                管理
              </button>
            </section>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button disabled={saving} onClick={onClose}>
                取消
              </button>
              <button
                className="primary"
                disabled={saving || !name.trim()}
                onClick={() => void submit()}
              >
                {saving ? "正在加密保存…" : "保存入口"}
              </button>
            </div>
          </>
        ) : screen === "keys" ? (
          <>
            <label className="key-search">
              搜索已有密钥
              <input
                autoFocus
                value={keySearch}
                onChange={(event) => setKeySearch(event.target.value)}
                placeholder="按名称或账号筛选"
              />
            </label>
            <div className="key-selection-list">
              {filteredKeys.map((key) => (
                <label className="key-choice" key={key.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(key.id)}
                    onChange={() => toggleKey(key.id)}
                  />
                  <span>
                    <strong>{key.title}</strong>
                    <small>{key.username || "未填写账号"}</small>
                  </span>
                </label>
              ))}
              {pendingKeys.map((key) => (
                <label className="key-choice pending" key={key.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(key.id)}
                    onChange={() => toggleKey(key.id)}
                  />
                  <span>
                    <strong>{key.title}</strong>
                    <small>{key.username || "新建密钥草稿"}</small>
                  </span>
                  <em>新建</em>
                </label>
              ))}
              {!filteredKeys.length && !pendingKeys.length && (
                <p className="security-note">
                  没有匹配的密钥。你可以直接新建并关联。
                </p>
              )}
            </div>
            <button
              className="create-key-button"
              type="button"
              onClick={() => {
                setError("");
                setScreen("new-key");
              }}
            >
              <Icon name="plus" size={16} /> 新建密钥
            </button>
            <p className="selection-count">已选择 {linked.length} 把密钥</p>
            <div className="modal-actions">
              <button onClick={() => setScreen("details")}>完成</button>
            </div>
          </>
        ) : (
          <>
            <label>
              密钥名称
              <input
                autoFocus
                value={keyTitle}
                onChange={(event) => setKeyTitle(event.target.value)}
                placeholder={name || "例如：生产账号"}
              />
            </label>
            <label>
              账号（可选）
              <input
                value={keyUser}
                onChange={(event) => setKeyUser(event.target.value)}
              />
            </label>
            <label>
              密钥值（可选）
              <input
                type="password"
                value={keyValue}
                onChange={(event) => setKeyValue(event.target.value)}
              />
            </label>
            <label>
              备注（可选）
              <textarea
                value={keyNotes}
                onChange={(event) => setKeyNotes(event.target.value)}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button onClick={() => setScreen("keys")}>取消</button>
              <button className="primary" onClick={createPendingKey}>
                创建并关联
              </button>
            </div>
          </>
        )}
      </section>
    </Dialog>
  );
}

function ConfigFields({
  kind,
  config,
  setField,
}: {
  kind: TargetKind;
  config: Record<string, string | number | boolean>;
  setField: (key: string, value: string | boolean) => void;
}) {
  if (kind === "web")
    return (
      <label>
        网站地址
        <input
          value={String(config.url ?? "")}
          onChange={(event) => setField("url", event.target.value)}
          placeholder="https://example.com"
        />
      </label>
    );
  if (kind === "generic")
    return (
      <label>
        非敏感资料（每行：名称: 内容）
        <textarea
          value={String(config.details ?? "")}
          onChange={(event) => setField("details", event.target.value)}
          placeholder="区域: cn-north-1\n项目: 示例项目"
        />
      </label>
    );
  if (kind === "ssh")
    return (
      <>
        <div className="ssh-field-row">
          <label>
            主机
            <input
              value={String(config.host ?? "")}
              onChange={(event) => setField("host", event.target.value)}
              placeholder="server.example.com 或 [::1]"
            />
          </label>
          <label>
            端口
            <input
              inputMode="numeric"
              value={String(config.port ?? "22")}
              onChange={(event) => setField("port", event.target.value)}
              placeholder="22"
            />
          </label>
        </div>
        <label>
          私钥文件路径（可选）
          <input
            value={String(config.identityFile ?? "")}
            onChange={(event) => setField("identityFile", event.target.value)}
            placeholder="~/.ssh/id_ed25519"
          />
        </label>
        <p className="field-hint">
          填写运行 SSH 命令的设备上的文件路径，无需上传私钥。
        </p>
        <details className="ssh-options">
          <summary>跳板机与其他选项</summary>
          <div className="ssh-field-row">
            <label>
              跳板机主机（可选）
              <input
                value={String(config.jumpHost ?? "")}
                onChange={(event) => setField("jumpHost", event.target.value)}
                placeholder="bastion.example.com 或 SSH 别名"
              />
            </label>
            <label>
              跳板机端口
              <input
                inputMode="numeric"
                value={String(config.jumpPort ?? "22")}
                onChange={(event) => setField("jumpPort", event.target.value)}
              />
            </label>
          </div>
          <p className="field-hint">
            跳板机的账号和认证方式使用本机 SSH 配置。
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={Boolean(config.forwardAgent)}
              onChange={(event) =>
                setField("forwardAgent", event.target.checked)
              }
            />
            启用代理转发（-A）
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={Boolean(config.compression)}
              onChange={(event) =>
                setField("compression", event.target.checked)
              }
            />
            启用压缩（-C）
          </label>
        </details>
      </>
    );
  return (
    <>
      <label>
        主机
        <input
          value={String(config.host ?? "")}
          onChange={(event) => setField("host", event.target.value)}
          placeholder="db.example.com"
        />
      </label>
      <label>
        端口
        <input
          inputMode="numeric"
          value={String(config.port ?? "")}
          onChange={(event) => setField("port", event.target.value)}
          placeholder={kind === "postgresql" ? "5432" : "6379"}
        />
      </label>
      <label>
        {kind === "postgresql" ? "数据库" : "数据库编号"}
        <input
          value={String(config.database ?? "")}
          onChange={(event) => setField("database", event.target.value)}
        />
      </label>
      {kind === "postgresql" ? (
        <label>
          SSL 模式
          <select
            aria-label="SSL 模式"
            value={String(config.sslMode ?? "prefer")}
            onChange={(event) => setField("sslMode", event.target.value)}
          >
            {["disable", "prefer", "require", "verify-ca", "verify-full"].map(
              (mode) => (
                <option key={mode}>{mode}</option>
              ),
            )}
          </select>
        </label>
      ) : (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(config.tls)}
            onChange={(event) => setField("tls", event.target.checked)}
          />
          使用 TLS
        </label>
      )}
    </>
  );
}

function KeyEditor({
  keyId,
  vault,
  linkedEntries,
  onClose,
  onSave,
}: {
  keyId?: string;
  vault: Kdbx;
  linkedEntries: Target[];
  onClose: () => void;
  onSave: (
    id: string | undefined,
    input: {
      title: string;
      username?: string;
      password?: string;
      notes?: string;
      fields?: Record<string, string>;
    },
  ) => Promise<void>;
}) {
  const existing = keyId ? getKey(vault, keyId) : null;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [username, setUsername] = useState(existing?.username ?? "");
  const [value, setValue] = useState(existing?.password ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [fields, setFields] = useState(
    Object.entries(existing?.fields ?? {})
      .map(([name, value]) => `${name}: ${value}`)
      .join("\n"),
  );
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (saving || !title.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onSave(keyId, {
        title: title.trim(),
        username,
        password: value,
        notes,
        fields: parseLines(fields),
      });
    } catch {
      setError("未能保存密钥，请保持页面打开并重试。");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      onClose={() => {
        if (!saving) onClose();
      }}
      className="editor-backdrop"
    >
      <section
        className="modal entry-modal"
        aria-busy={saving}
        role="dialog"
        aria-modal="true"
        aria-label={keyId ? "编辑密钥" : "新建密钥"}
      >
        <div className="modal-heading">
          <h2>{keyId ? "编辑密钥" : "新建密钥"}</h2>
          <button
            className="icon-button"
            aria-label="关闭对话框"
            disabled={saving}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <label>
          密钥名称
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          账号（可选）
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          密钥值（密码、API Key 或 Token）
          <div className="copy-field">
            <input
              type={show ? "text" : "password"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <button type="button" onClick={() => setShow(!show)}>
              {show ? "隐藏" : "显示"}
            </button>
            {keyId && (
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(value)}
              >
                复制
              </button>
            )}
          </div>
        </label>
        <label>
          备注（可选）
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <label>
          自定义字段（每行：名称: 值）
          <textarea
            value={fields}
            onChange={(event) => setFields(event.target.value)}
          />
        </label>
        {keyId && (
          <p className="security-note">
            关联入口：
            {linkedEntries.length
              ? linkedEntries.map((entry) => entry.name).join("、")
              : "尚未关联"}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button disabled={saving} onClick={onClose}>
            取消
          </button>
          <button
            className="primary"
            disabled={saving || !title.trim()}
            onClick={() => void save()}
          >
            {saving ? "正在加密保存…" : "保存密钥"}
          </button>
        </div>
      </section>
    </Dialog>
  );
}

function RecycleDialog({
  vault,
  onClose,
  onChanged,
}: {
  vault: Kdbx;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [records, setRecords] = useState<RecycledRecord[]>(() =>
    listRecycledRecords(vault),
  );
  const refresh = async () => {
    await onChanged();
    setRecords(listRecycledRecords(vault));
  };
  return (
    <Dialog onClose={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="回收站"
      >
        <div className="modal-heading">
          <div>
            <h2>回收站</h2>
            <p className="security-note">
              删除的资料会在 30 天后自动永久清理。
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="关闭对话框"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {records.length ? (
          <>
            {records.map((record) => (
              <div className="recycle-row" key={record.id}>
                <span>
                  <strong>{record.title}</strong>
                  <small>{record.kind === "entry" ? "入口" : "密钥"}</small>
                </span>
                <button
                  onClick={() => {
                    restoreRecycledRecord(vault, record.id);
                    void refresh();
                  }}
                >
                  恢复
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("永久删除后无法恢复，是否继续？")) {
                      permanentlyDeleteRecycledRecord(vault, record.id);
                      void refresh();
                    }
                  }}
                >
                  永久删除
                </button>
              </div>
            ))}
            <div className="modal-actions">
              <button onClick={onClose}>关闭</button>
              <button
                onClick={() => {
                  if (window.confirm("清空回收站后无法恢复，是否继续？")) {
                    emptyRecycledRecords(vault);
                    void refresh();
                  }
                }}
              >
                清空回收站
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="security-note">回收站为空。</p>
            <div className="modal-actions">
              <button onClick={onClose}>关闭</button>
            </div>
          </>
        )}
      </section>
    </Dialog>
  );
}

function ImportDialog({
  hasVault,
  onClose,
  onImport,
}: {
  hasVault: boolean;
  onClose: () => void;
  onImport: (
    encoded: string,
    packagePassword: string,
    localPassword: string,
    mode?: "replace" | "merge",
  ) => Promise<void>;
}) {
  const [encoded, setEncoded] = useState("");
  const [packagePassword, setPackagePassword] = useState("");
  const [localPassword, setLocalPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [preview, setPreview] = useState<{
    packageMode: "backup" | "share";
    entries: number;
    keys: number;
    groups: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const inspect = async () => {
    if (working) return;
    setWorking(true);
    try {
      const backup = await parseKeyStoreBackup(encoded.trim(), packagePassword);
      const vault = await unlockVault(backup.vault, packagePassword);
      initializeWorkspace(vault);
      const state = getWorkspace(vault);
      setPreview({
        packageMode: backup.mode,
        entries: state.entries.length,
        keys: state.keys.length,
        groups: state.groups.length,
      });
      setError("");
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "无法读取加密包。");
    } finally {
      setWorking(false);
    }
  };
  const submit = async () => {
    if (!preview || working) return;
    if (
      mode === "replace" &&
      preview.packageMode === "share" &&
      (!localPassword || localPassword !== confirm)
    )
      return setError("请确认新的本地主密码。");
    setWorking(true);
    try {
      await onImport(
        encoded.trim(),
        packagePassword,
        preview.packageMode === "share" ? localPassword : packagePassword,
        mode,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法导入加密包。");
    } finally {
      setWorking(false);
    }
  };
  const resetPreview = () => setPreview(null);
  return (
    <Dialog
      onClose={() => {
        if (!working) onClose();
      }}
    >
      <section
        className="modal"
        aria-busy={working}
        role="dialog"
        aria-modal="true"
        aria-label="导入加密包"
      >
        <div className="modal-heading">
          <h2>导入加密包</h2>
          <button
            className="icon-button"
            aria-label="关闭对话框"
            disabled={working}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {hasVault && (
          <label>
            导入方式
            <select
              disabled={working}
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as "replace" | "merge");
                resetPreview();
              }}
            >
              <option value="replace">恢复并替换当前密钥库</option>
              <option value="merge">合并到当前密钥库</option>
            </select>
          </label>
        )}
        <p className="security-note">
          {mode === "merge"
            ? "合并会创建新副本，不会覆盖本地资料。"
            : hasVault
              ? "替换会清除当前全部资料；请先导出备份。"
              : "常规备份将继续使用备份主密码；分享包会要求设置新的本地主密码。"}
        </p>
        <label>
          加密字符串
          <textarea
            disabled={working}
            value={encoded}
            onChange={(event) => {
              setEncoded(event.target.value);
              resetPreview();
            }}
          />
        </label>
        <label>
          备份或分享口令
          <input
            disabled={working}
            type="password"
            value={packagePassword}
            onChange={(event) => {
              setPackagePassword(event.target.value);
              resetPreview();
            }}
          />
        </label>
        {preview?.packageMode === "share" && mode === "replace" && (
          <>
            <label>
              新的本地主密码
              <input
                disabled={working}
                type="password"
                value={localPassword}
                onChange={(event) => setLocalPassword(event.target.value)}
              />
            </label>
            <label>
              确认新的本地主密码
              <input
                disabled={working}
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
          </>
        )}
        {preview && (
          <p className="security-note">
            导入预览：{preview.entries} 个入口、{preview.keys} 把密钥、
            {preview.groups} 个分组。资料尚未写入本机。
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button disabled={working} onClick={onClose}>
            取消
          </button>
          {preview ? (
            <button
              className="primary"
              disabled={
                working ||
                (preview.packageMode === "share" &&
                  mode === "replace" &&
                  !localPassword)
              }
              onClick={() => void submit()}
            >
              {working
                ? "正在导入…"
                : mode === "merge"
                  ? "确认合并导入"
                  : "确认恢复"}
            </button>
          ) : (
            <button
              className="primary"
              disabled={working || !encoded || !packagePassword}
              onClick={() => void inspect()}
            >
              {working ? "正在解密预览…" : "解密并预览"}
            </button>
          )}
        </div>
      </section>
    </Dialog>
  );
}

function ShareDialog({
  onClose,
  onShare,
}: {
  onClose: () => void;
  onShare: (
    password: string,
    reportProgress: (message: string) => void,
  ) => Promise<string>;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [progress, setProgress] = useState("");
  const [creating, setCreating] = useState(false);
  const create = async () => {
    if (!password || password !== confirm) return setError("请确认分享口令。");
    setCreating(true);
    setError("");
    setProgress("正在准备分享包…");
    try {
      const text = await onShare(password, setProgress);
      setResult(text);
      try {
        await navigator.clipboard?.writeText(text);
        setCopyStatus("已复制到剪贴板。");
      } catch {
        setCopyStatus("分享包已生成，但浏览器拒绝复制；请手动复制下方字符串。");
      }
    } catch {
      setError("无法生成分享包。请保持页面打开后重试。");
    } finally {
      setCreating(false);
      setProgress("");
    }
  };
  return (
    <Dialog
      onClose={() => {
        if (!creating) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="分享加密包"
      >
        <div className="modal-heading">
          <h2>分享加密包</h2>
          <button
            className="icon-button"
            aria-label="关闭对话框"
            onClick={onClose}
            disabled={creating}
          >
            <Icon name="close" />
          </button>
        </div>
        <p className="security-note">
          分享包使用独立口令加密，接收方导入时会设置自己的本地主密码。
        </p>
        {result ? (
          <>
            <label>
              已生成的加密字符串
              <textarea readOnly value={result} />
            </label>
            <p className="security-note">{copyStatus}</p>
          </>
        ) : (
          <>
            <label>
              分享口令
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={creating}
              />
            </label>
            <label>
              确认分享口令
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                disabled={creating}
              />
            </label>
            {creating && (
              <p className="security-note" role="status">
                {progress}
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button onClick={onClose} disabled={creating}>
                取消
              </button>
              <button
                className="primary"
                disabled={creating}
                onClick={() => void create()}
              >
                {creating ? "正在生成加密包…" : "生成并复制"}
              </button>
            </div>
          </>
        )}
        <div className="modal-actions">
          {result && <button onClick={onClose}>完成</button>}
        </div>
      </section>
    </Dialog>
  );
}

const defaultConfig = (
  kind: TargetKind,
): Record<string, string | number | boolean> =>
  kind === "web"
    ? { url: "" }
    : kind === "ssh"
      ? {
          host: "",
          port: "22",
          identityFile: "",
          jumpHost: "",
          jumpPort: "22",
          forwardAgent: false,
          compression: false,
        }
      : kind === "postgresql"
        ? { host: "", port: "5432", database: "", sslMode: "prefer" }
        : kind === "redis"
          ? { host: "", port: "6379", database: "0", tls: false }
          : { details: "" };
const stringConfig = (config: Target["config"] | undefined) =>
  config
    ? Object.fromEntries(
        Object.entries(config).map(([key, value]) => [key, value]),
      )
    : defaultConfig("web");
const normalizeConfig = (
  kind: TargetKind,
  config: Record<string, string | number | boolean>,
) =>
  Object.fromEntries(
    Object.entries(config).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value,
    ]),
  ) as Target["config"];
const parseLines = (value: string) =>
  Object.fromEntries(
    value.split("\n").flatMap((line) => {
      const separator = line.indexOf(":");
      if (separator < 1 || !line.slice(separator + 1).trim()) return [];
      return [
        [line.slice(0, separator).trim(), line.slice(separator + 1).trim()],
      ];
    }),
  );
function download(text: string, prefix: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}
