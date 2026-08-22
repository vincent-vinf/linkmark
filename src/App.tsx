import { useEffect, useMemo, useRef, useState } from 'react';
import type { Kdbx } from 'kdbxweb';
import { createTarget, deleteGroup, reorderTargets, type Target, type TargetKind, validateWebUrl } from './domain/targets';
import { db, replaceLocalData, type Group, type Tag } from './storage/db';
import { parseBackup, serializeBackup } from './portability/backup';
import { mergeMetadata } from './portability/merge';
import { addVaultItem, createVault, deleteVaultItem, emptyVaultRecycleBin, getVaultItem, listRecycledVaultItems, listVaultItems, mergeVaultItems, purgeExpiredVaultItems, rekeyVault, restoreVaultItem, saveVault, unlockVault, updateVaultItem, type VaultItemDetail, type VaultItemSummary } from './vault/vault';
import './app.css';
import './responsive.css';

const kinds: Record<TargetKind, string> = { web: '网站', postgresql: 'PostgreSQL', redis: 'Redis', generic: '通用' };
const newId = () => crypto.randomUUID();
type PasswordRequest = { label: string; resolve: (value: string | null) => void };

export default function App() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('linkmark-theme') as 'dark' | 'light' ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [hasVault, setHasVault] = useState(false);
  const [vaultDialog, setVaultDialog] = useState(false);
  const [vaultError, setVaultError] = useState('');
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [vaultExpiry, setVaultExpiry] = useState<number | null>(null);
  const [vaultItems, setVaultItems] = useState<VaultItemSummary[]>([]);
  const [recycledItems, setRecycledItems] = useState<VaultItemSummary[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordRequest, setPasswordRequest] = useState<PasswordRequest | null>(null);
  const [selectedVaultItem, setSelectedVaultItem] = useState<VaultItemDetail | null>(null);
  const vaultRef = useRef<Kdbx | null>(null);
  const masterPasswordRef = useRef<string | null>(null);
  const askPassword = (label: string) => new Promise<string | null>((resolve) => setPasswordRequest({ label, resolve }));

  const reload = async () => {
    setTargets(await db.targets.orderBy('updatedAt').reverse().toArray());
    setGroups(await db.groups.orderBy('sortOrder').toArray());
    setTags(await db.tags.orderBy('name').toArray());
  };
  useEffect(() => { void reload(); void db.vaults.get('primary').then((record) => setHasVault(Boolean(record))); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('linkmark-theme', theme); }, [theme]);
  const clearSensitiveState = () => { vaultRef.current = null; masterPasswordRef.current = null; setVaultItems([]); setRecycledItems([]); setSelectedVaultItem(null); setVaultUnlocked(false); setVaultExpiry(null); };
  useEffect(() => { if (!vaultExpiry) return; const timer = window.setTimeout(clearSensitiveState, Math.max(0, vaultExpiry - Date.now())); return () => window.clearTimeout(timer); }, [vaultExpiry]);
  useEffect(() => { const clear = () => { vaultRef.current = null; masterPasswordRef.current = null; }; window.addEventListener('pagehide', clear); return () => window.removeEventListener('pagehide', clear); }, []);

  const visible = useMemo(() => targets.filter((target) => {
    const words = `${target.name} ${target.kind} ${Object.values(target.config).join(' ')}`.toLowerCase();
    const secretMatch = vaultUnlocked && vaultItems.some((item) => target.vaultItemIds.includes(item.id) && `${item.title} ${item.username}`.toLowerCase().includes(query.toLowerCase()));
    return (!activeGroup || target.groupId === activeGroup) && (words.includes(query.toLowerCase()) || secretMatch);
  }).sort((left, right) => left.sortOrder - right.sortOrder), [targets, activeGroup, query, vaultUnlocked, vaultItems]);

  const addGroup = async () => {
    const name = window.prompt('分组名称')?.trim();
    if (!name) return;
    await db.groups.add({ id: newId(), name, sortOrder: groups.length });
    await reload();
  };
  const removeGroup = async (group: Group) => { if (!window.confirm(`删除分组“${group.name}”？其中 Target 将移入收件箱。`)) return; await db.targets.bulkPut(deleteGroup(targets, group.id)); await db.groups.delete(group.id); if (activeGroup === group.id) setActiveGroup(null); await reload(); };

  const removeTarget = async (id: string) => {
    if (!window.confirm('删除此 Target？关联的秘密不会被删除。')) return;
    await db.targets.delete(id);
    await reload();
  };
  const editTarget = (target: Target) => { setEditingTarget(target); setEditorOpen(true); };
  const moveTarget = async (target: Target, direction: -1 | 1) => {
    const withinGroup = targets.filter((item) => item.groupId === target.groupId).sort((left, right) => left.sortOrder - right.sortOrder); const index = withinGroup.findIndex((item) => item.id === target.id); const adjacent = withinGroup[index + direction]; if (!adjacent) return;
    await db.targets.bulkPut(reorderTargets(targets, withinGroup.map((item, position) => position === index ? adjacent.id : position === index + direction ? target.id : item.id))); await reload();
  };
  const editTags = async (target: Target) => {
    const current = target.tagIds.map((id) => tags.find((tag) => tag.id === id)?.name).filter(Boolean).join(', ');
    const value = window.prompt('用逗号分隔标签', current); if (value === null) return;
    const names = [...new Set(value.split(',').map((name) => name.trim()).filter(Boolean))]; const ids: string[] = [];
    for (const name of names) { const existing = tags.find((tag) => tag.name === name); const id = existing?.id ?? newId(); if (!existing) await db.tags.add({ id, name }); ids.push(id); }
    await db.targets.put({ ...target, tagIds: ids, updatedAt: new Date().toISOString() }); await reload();
  };
  const addSecret = async () => {
    if (!vaultRef.current) return setVaultDialog(true);
    const title = (await askPassword('秘密条目名称'))?.trim(); const username = await askPassword('账号（可留空）'); const password = await askPassword('密码、API Key 或 Token（可留空）'); const notes = await askPassword('备注（可留空）'); const custom = await askPassword('自定义字段，格式为 名称=值，多个用逗号分隔（可留空）');
    if (!title || password === null || username === null || notes === null || custom === null) return;
    const fields = Object.fromEntries(custom.split(',').map((part) => part.split('=').map((value) => value.trim())).filter(([key, value]) => key && value));
    addVaultItem(vaultRef.current, { title, username, password, notes, fields });
    await db.vaults.put({ id: 'primary', data: await saveVault(vaultRef.current), updatedAt: new Date().toISOString() });
    setVaultItems(listVaultItems(vaultRef.current));
  };
  const removeSecret = async (id: string) => { if (!vaultRef.current || !window.confirm('将秘密条目移入回收站？')) return; deleteVaultItem(vaultRef.current, id); await db.vaults.put({ id: 'primary', data: await saveVault(vaultRef.current), updatedAt: new Date().toISOString() }); setVaultItems(listVaultItems(vaultRef.current)); };
  const restoreSecret = async (id: string) => { if (!vaultRef.current) return; restoreVaultItem(vaultRef.current, id); await db.vaults.put({ id: 'primary', data: await saveVault(vaultRef.current), updatedAt: new Date().toISOString() }); setRecycledItems(listRecycledVaultItems(vaultRef.current)); setVaultItems(listVaultItems(vaultRef.current)); };
  const emptyRecycleBin = async () => { if (!vaultRef.current || !window.confirm('永久删除回收站中的全部秘密？')) return; emptyVaultRecycleBin(vaultRef.current); await db.vaults.put({ id: 'primary', data: await saveVault(vaultRef.current), updatedAt: new Date().toISOString() }); setRecycledItems([]); };
  const saveSecret = async (item: VaultItemDetail) => { if (!vaultRef.current || !item.title.trim()) return; updateVaultItem(vaultRef.current, item.id, item); await db.vaults.put({ id: 'primary', data: await saveVault(vaultRef.current), updatedAt: new Date().toISOString() }); setVaultItems(listVaultItems(vaultRef.current)); setSelectedVaultItem(null); };
  const linkSecret = async (target: Target) => {
    if (!vaultRef.current) return setVaultDialog(true);
    const options = listVaultItems(vaultRef.current); if (!options.length) return alert('请先创建秘密条目。');
    const value = window.prompt(`输入要关联的秘密 ID：\n${options.map((item) => `${item.id}  ${item.title}`).join('\n')}`)?.trim();
    if (!value || !options.some((item) => item.id === value)) return;
    await db.targets.put({ ...target, vaultItemIds: [...new Set([...target.vaultItemIds, value])], updatedAt: new Date().toISOString() }); await reload();
  };
  const lockVault = clearSensitiveState;
  const changeMasterPassword = async () => {
    if (!vaultRef.current || !masterPasswordRef.current) return setVaultDialog(true);
    const next = await askPassword('输入新的主密码'); if (!next) return;
    if (!window.confirm('主密码将立即更新；忘记新密码将无法恢复 Vault。')) return;
    const data = await rekeyVault(await saveVault(vaultRef.current), masterPasswordRef.current, next);
    await db.vaults.put({ id: 'primary', data, updatedAt: new Date().toISOString() }); vaultRef.current = await unlockVault(data, next); masterPasswordRef.current = next; alert('主密码已更新。请立即导出新的备份。');
  };
  const share = async () => {
    if (!vaultRef.current) return setVaultDialog(true);
    const password = await askPassword('设置独立分享口令'); if (!password) return;
    const currentPassword = masterPasswordRef.current; if (!currentPassword) return lockVault();
    const [allTargets, allGroups, allTags, vault] = await Promise.all([db.targets.toArray(), db.groups.toArray(), db.tags.toArray(), saveVault(vaultRef.current)]);
    const text = await serializeBackup({ targets: allTargets, groups: allGroups, tags: allTags, vault: await rekeyVault(vault, currentPassword, password) }, password, 'share');
    await navigator.clipboard.writeText(text); alert('已复制加密分享字符串。');
  };
  const downloadBackup = async () => {
    if (!vaultRef.current || !masterPasswordRef.current) return setVaultDialog(true);
    const [allTargets, allGroups, allTags, vault] = await Promise.all([db.targets.toArray(), db.groups.toArray(), db.tags.toArray(), saveVault(vaultRef.current)]);
    const encoded = await serializeBackup({ targets: allTargets, groups: allGroups, tags: allTags, vault }, masterPasswordRef.current);
    const url = URL.createObjectURL(new Blob([encoded], { type: 'text/plain' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `linkmark-backup-${new Date().toISOString().slice(0, 10)}.txt`; anchor.click(); URL.revokeObjectURL(url);
  };
  const importShare = async () => {
    const text = window.prompt('粘贴加密备份或分享字符串'); const password = await askPassword('输入对应口令'); if (!text || password === null) return;
    try { const data = await parseBackup(text, password); const nextPassword = data.mode === 'share' ? await askPassword('设置导入后 Vault 的新主密码') : password; if (!nextPassword) return; const replace = window.confirm(`导入预览：${data.targets.length} 个 Target、${data.groups.length} 个分组、${data.tags.length} 个标签。确定替换本地数据；取消则合并。`); if (!replace) { if (!vaultRef.current) return alert('合并导入前必须先解锁当前 Vault。'); const incoming = await unlockVault(data.vault, password); const mapping = mergeVaultItems(vaultRef.current, incoming); const remapped = { ...data, targets: data.targets.map((target) => ({ ...target, vaultItemIds: target.vaultItemIds.map((id) => mapping.get(id) ?? id) })) }; const merged = mergeMetadata({ targets: await db.targets.toArray(), groups: await db.groups.toArray(), tags: await db.tags.toArray() }, remapped); await replaceLocalData({ ...merged, vault: await saveVault(vaultRef.current) }); await reload(); alert('已合并导入。'); return; } const vault = data.mode === 'share' ? await rekeyVault(data.vault, password, nextPassword) : data.vault; await unlockVault(vault, nextPassword); await replaceLocalData({ ...data, vault }); lockVault(); setHasVault(true); await reload(); alert(data.mode === 'share' ? '已导入。请使用新主密码解锁 Vault。' : '已恢复。请使用备份主密码解锁 Vault。'); } catch (error) { alert(error instanceof Error ? error.message : '导入失败'); }
  };

  return <main className="shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><span>✦</span> Linkmark</div>
      <button className="new-button" onClick={() => { setEditingTarget(null); setEditorOpen(true); }}>＋ 新建 Target</button>
      <nav>
        <button className={!activeGroup ? 'active' : ''} onClick={() => setActiveGroup(null)}>收件箱 <small>{targets.filter((item) => !item.groupId).length}</small></button>
        <div className="section-title">分组 <button aria-label="添加分组" onClick={() => void addGroup()}>＋</button></div>
        {groups.map((group) => <div key={group.id}><button className={activeGroup === group.id ? 'active' : ''} onClick={() => setActiveGroup(group.id)}>{group.name}<small>{targets.filter((item) => item.groupId === group.id).length}</small></button><button aria-label={`删除分组 ${group.name}`} onClick={() => void removeGroup(group)}>×</button></div>)}
      </nav>
      <div className="sidebar-footer"><span className={vaultUnlocked ? 'lock-dot unlocked' : 'lock-dot'} /> Vault {vaultUnlocked ? '已解锁' : '已锁定'} <button onClick={vaultUnlocked ? lockVault : () => setVaultDialog(true)}>{vaultUnlocked ? '锁定' : hasVault ? '解锁' : '创建'}</button></div>
    </aside>
    <section className="content">
      <header>
        <div><button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)}>☰</button><p className="eyebrow">LOCAL-FIRST WORKSPACE</p><h1>{activeGroup ? groups.find((group) => group.id === activeGroup)?.name : '所有 Targets'}</h1></div>
        <div className="actions"><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀︎' : '☾'}</button>{vaultUnlocked && <button onClick={() => setVaultItems(listVaultItems(vaultRef.current!))}>Vault</button>}{vaultUnlocked && <button onClick={() => setRecycledItems(listRecycledVaultItems(vaultRef.current!))}>回收站</button>}{vaultUnlocked && <button onClick={() => void addSecret()}>＋ 秘密</button>}{vaultUnlocked && <button onClick={() => void changeMasterPassword()}>改主密码</button>}{vaultUnlocked && <button onClick={() => void downloadBackup()}>备份</button>}{vaultUnlocked && <button onClick={() => void share()}>分享</button>}<button onClick={() => void importShare()}>导入</button></div>
      </header>
      <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={vaultUnlocked ? '搜索 Target、秘密标题或账号…' : '搜索名称、连接主机或数据库…'} /></label>
      <div className="toolbar"><span>{visible.length} 个 Target</span><button onClick={() => { setEditingTarget(null); setEditorOpen(true); }}>新建</button></div>
      {visible.length ? <div className="grid">{visible.map((target) => <article className="card" key={target.id} onDoubleClick={() => { if (target.kind === 'web') window.open(String(target.config.url), '_blank', 'noopener,noreferrer'); }}>
        <div className={`kind kind-${target.kind}`}>{target.kind === 'web' ? '↗' : target.kind === 'postgresql' ? '◫' : target.kind === 'redis' ? '◆' : '◇'}</div>
        <div className="card-body"><p className="kind-label">{kinds[target.kind]}</p><h2>{target.name}</h2><p>{target.kind === 'web' ? String(target.config.url ?? '') : Object.values(target.config).filter(Boolean).join(' · ') || '未填写连接资料'}</p></div>
        {target.tagIds.length > 0 && <small>{target.tagIds.map((id) => tags.find((tag) => tag.id === id)?.name).filter(Boolean).join(' · ')}</small>}
        {vaultUnlocked && <button className="link-secret" onClick={() => void linkSecret(target)}>秘密 {target.vaultItemIds.length}</button>}
        <button className="edit-target" onClick={() => void editTarget(target)}>编辑</button>
        <button onClick={() => void editTags(target)}>标签</button>
        <button onClick={() => void moveTarget(target, -1)}>↑</button><button onClick={() => void moveTarget(target, 1)}>↓</button>
        <button className="delete" aria-label={`删除 ${target.name}`} onClick={() => void removeTarget(target.id)}>×</button>
      </article>)}</div> : <div className="empty"><span>✦</span><h2>建立你的第一个入口</h2><p>网站、PostgreSQL、Redis 与通用连接资料都会保存在这台设备上。</p><button onClick={() => { setEditingTarget(null); setEditorOpen(true); }}>新建 Target</button></div>}
      {vaultUnlocked && vaultItems.length > 0 && <section className="vault-list"><h2>Vault Items</h2>{vaultItems.filter((item) => `${item.title} ${item.username}`.toLowerCase().includes(query.toLowerCase())).map((item) => <div key={item.id}><button className="vault-item" onClick={() => setSelectedVaultItem(getVaultItem(vaultRef.current!, item.id))}><span>{item.title || '未命名秘密'}</span><small>{item.username}</small></button><button onClick={() => void removeSecret(item.id)}>删除</button></div>)}</section>}
      {vaultUnlocked && recycledItems.length > 0 && <section className="vault-list"><h2>回收站 <button onClick={() => void emptyRecycleBin()}>清空</button></h2>{recycledItems.map((item, index) => <div key={item.id}><span>已删除秘密 {index + 1}</span><button onClick={() => void restoreSecret(item.id)}>恢复</button></div>)}</section>}
    </section>
    {isEditorOpen && <TargetEditor target={editingTarget} groups={groups} onClose={() => setEditorOpen(false)} onSaved={async () => { setEditorOpen(false); setEditingTarget(null); await reload(); }} />}
    {vaultDialog && <VaultDialog hasVault={hasVault} onClose={() => setVaultDialog(false)} onSubmit={async (password, duration) => { try { const record = await db.vaults.get('primary'); const data = record?.data ?? await createVault(password); const vault = await unlockVault(data, password); const purged = purgeExpiredVaultItems(vault); if (!record || purged) await db.vaults.put({ id: 'primary', data: await saveVault(vault), updatedAt: new Date().toISOString() }); vaultRef.current = vault; masterPasswordRef.current = password; setVaultExpiry(Date.now() + duration); setVaultUnlocked(true); setHasVault(true); setVaultDialog(false); } catch { setVaultError('无法解锁 Vault，请检查主密码。'); } }} error={vaultError} />}
    {passwordRequest && <PasswordPrompt label={passwordRequest.label} onClose={() => { passwordRequest.resolve(null); setPasswordRequest(null); }} onSubmit={(value) => { passwordRequest.resolve(value); setPasswordRequest(null); }} />}
    {selectedVaultItem && <VaultItemDialog item={selectedVaultItem} onClose={() => setSelectedVaultItem(null)} onSave={saveSecret} />}
  </main>;
}

function VaultItemDialog({ item, onClose, onSave }: { item: VaultItemDetail; onClose: () => void; onSave: (item: VaultItemDetail) => Promise<void> }) {
  const [draft, setDraft] = useState(item); const [reveal, setReveal] = useState(false);
  const set = (key: keyof VaultItemDetail, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); } catch { alert('无法写入剪贴板，请检查浏览器权限。'); } };
  const customText = Object.entries(draft.fields).map(([key, value]) => `${key}=${value}`).join('\n');
  return <div className="modal-backdrop"><section className="modal vault-detail" role="dialog" aria-modal="true" aria-label="编辑秘密条目"><div className="modal-heading"><div><p className="eyebrow">ENCRYPTED VAULT ITEM</p><h2>秘密条目</h2></div><button onClick={onClose}>×</button></div><label>名称<input autoFocus value={draft.title} onChange={(event) => set('title', event.target.value)} /></label><label>账号<div className="copy-field"><input value={draft.username} onChange={(event) => set('username', event.target.value)} /><button disabled={!draft.username} onClick={() => void copy(draft.username)}>复制</button></div></label><label>密码 / API Key / Token<div className="copy-field"><input type={reveal ? 'text' : 'password'} value={draft.password} onChange={(event) => set('password', event.target.value)} /><button onClick={() => setReveal(!reveal)}>{reveal ? '隐藏' : '显示'}</button><button disabled={!draft.password} onClick={() => void copy(draft.password)}>复制</button></div></label><label>备注<textarea value={draft.notes} onChange={(event) => set('notes', event.target.value)} /></label><label>自定义字段（每行 名称=值）<textarea value={customText} onChange={(event) => setDraft((current) => ({ ...current, fields: Object.fromEntries(event.target.value.split('\n').map((line) => line.split('=').map((part) => part.trim())).filter(([key, value]) => key && value) ) }))} /></label><div className="modal-actions"><button onClick={onClose}>取消</button><button className="primary" disabled={!draft.title.trim()} onClick={() => void onSave(draft)}>保存</button></div></section></div>;
}

function PasswordPrompt({ label, onClose, onSubmit }: { label: string; onClose: () => void; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState('');
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true"><h2>{label}</h2><label>口令<input type="password" autoFocus value={value} onChange={(event) => setValue(event.target.value)} /></label><div className="modal-actions"><button onClick={onClose}>取消</button><button className="primary" disabled={!value} onClick={() => onSubmit(value)}>确认</button></div></section></div>;
}

function VaultDialog({ hasVault, onClose, onSubmit, error }: { hasVault: boolean; onClose: () => void; onSubmit: (password: string, duration: number) => Promise<void>; error: string }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [duration, setDuration] = useState(300_000);
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="eyebrow">ENCRYPTED VAULT</p><h2>{hasVault ? '解锁 Vault' : '创建 Vault'}</h2></div><button onClick={onClose}>×</button></div><label>主密码<input type="password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} /></label>{!hasVault && <><label>确认主密码<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><p className="error">主密码无法找回。创建后请立即导出加密备份。</p></>}<label>免密时长<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={300000}>5 分钟</option><option value={1800000}>30 分钟</option><option value={7200000}>2 小时</option><option value={86400000}>24 小时</option><option value={604800000}>7 天</option></select></label>{error && <p className="error">{error}</p>}<div className="modal-actions"><button onClick={onClose}>取消</button><button className="primary" disabled={!password || (!hasVault && password !== confirmation)} onClick={() => void onSubmit(password, duration)}>{hasVault ? '解锁' : '创建'}</button></div></section></div>;
}

function TargetEditor({ target, groups, onClose, onSaved }: { target: Target | null; groups: Group[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const config = target?.config ?? {};
  const [name, setName] = useState(target?.name ?? ''); const [kind, setKind] = useState<TargetKind>(target?.kind ?? 'web'); const [address, setAddress] = useState(String(config.url ?? '')); const [host, setHost] = useState(String(config.host ?? '')); const [port, setPort] = useState(String(config.port ?? '')); const [database, setDatabase] = useState(String(config.database ?? '')); const [sslMode, setSslMode] = useState(String(config.sslMode ?? 'prefer')); const [tls, setTls] = useState(Boolean(config.tls)); const [genericFields, setGenericFields] = useState(() => Object.entries(config).map(([key, value]) => `${key}=${value}`).join('\n')); const [groupId, setGroupId] = useState(target?.groupId ?? ''); const [error, setError] = useState('');
  const save = async () => {
    if (!name.trim()) return setError('请输入名称。');
    if (kind === 'web' && !validateWebUrl(address)) return setError('网站地址必须是 HTTP 或 HTTPS URL。');
    if ((kind === 'postgresql' || kind === 'redis') && (!host.trim() || !/^\d{1,5}$/.test(port) || Number(port) > 65535)) return setError('请填写主机和 1–65535 的端口。');
    const generic: Record<string, string> = Object.fromEntries(genericFields.split('\n').map((line) => line.split('=').map((part) => part.trim())).filter(([key, value]) => key && value));
    if (kind === 'generic' && (Object.keys(generic).some((key) => /pass(word)?|secret|token|api.?key|dsn|uri/i.test(key)) || Object.values(generic).some((value) => /:\/\//.test(value)))) return setError('敏感字段、DSN 和 URI 请保存到关联的 Vault Item。');
    const nextConfig: Record<string, string | boolean> = kind === 'web' ? { url: address } : kind === 'postgresql' ? { host, port, database, sslMode } : kind === 'redis' ? { host, port, database, tls } : generic;
    const next = target ? { ...target, name: name.trim(), kind, groupId: groupId || null, config: nextConfig, updatedAt: new Date().toISOString() } : createTarget({ name, kind, groupId: groupId || null, config: nextConfig });
    await db.targets.put(next);
    await onSaved();
  };
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-label={target ? '编辑 Target' : '新建 Target'}><div className="modal-heading"><div><p className="eyebrow">{target ? 'EDIT TARGET' : 'NEW TARGET'}</p><h2>{target ? '编辑入口' : '添加入口'}</h2></div><button onClick={onClose}>×</button></div>
    <label>名称<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：生产数据库" /></label>
    <label>类型<select value={kind} onChange={(event) => setKind(event.target.value as TargetKind)}>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {kind === 'web' ? <label>URL<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="https://example.com" /></label> : kind === 'generic' ? <label>非敏感字段（每行 名称=值）<textarea value={genericFields} onChange={(event) => setGenericFields(event.target.value)} placeholder="host=example.com&#10;environment=production" /></label> : <><label>主机<input value={host} onChange={(event) => setHost(event.target.value)} placeholder="db.example.com" /></label><label>端口<input inputMode="numeric" value={port} onChange={(event) => setPort(event.target.value)} placeholder={kind === 'postgresql' ? '5432' : '6379'} /></label><label>{kind === 'postgresql' ? '数据库' : '数据库编号'}<input value={database} onChange={(event) => setDatabase(event.target.value)} /></label>{kind === 'postgresql' ? <label>SSL 模式<select value={sslMode} onChange={(event) => setSslMode(event.target.value)}><option value="disable">禁用</option><option value="prefer">优先</option><option value="require">要求</option><option value="verify-ca">验证 CA</option><option value="verify-full">完整验证</option></select></label> : <label className="checkbox"><input type="checkbox" checked={tls} onChange={(event) => setTls(event.target.checked)} /> 使用 TLS</label>}</>}
    <label>分组<select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">收件箱</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
    {error && <p className="error">{error}</p>}<div className="modal-actions"><button onClick={onClose}>取消</button><button className="primary" onClick={() => void save()}>保存</button></div>
  </section></div>;
}
