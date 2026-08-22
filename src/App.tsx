import { useEffect, useMemo, useRef, useState } from 'react';
import type { Kdbx } from 'kdbxweb';
import { createTarget, type Target, type TargetKind, validateWebUrl } from './domain/targets';
import { db, replaceLocalData, type Group } from './storage/db';
import { parseBackup, serializeBackup } from './portability/backup';
import { mergeMetadata } from './portability/merge';
import { addVaultItem, createVault, deleteVaultItem, listVaultItems, mergeVaultItems, rekeyVault, saveVault, unlockVault, type VaultItemSummary } from './vault/vault';
import './app.css';

const kinds: Record<TargetKind, string> = { web: '网站', postgresql: 'PostgreSQL', redis: 'Redis', generic: '通用' };
const newId = () => crypto.randomUUID();

export default function App() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [hasVault, setHasVault] = useState(false);
  const [vaultDialog, setVaultDialog] = useState(false);
  const [vaultError, setVaultError] = useState('');
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [vaultExpiry, setVaultExpiry] = useState<number | null>(null);
  const [vaultItems, setVaultItems] = useState<VaultItemSummary[]>([]);
  const vaultRef = useRef<Kdbx | null>(null);
  const masterPasswordRef = useRef<string | null>(null);

  const reload = async () => {
    setTargets(await db.targets.orderBy('updatedAt').reverse().toArray());
    setGroups(await db.groups.orderBy('sortOrder').toArray());
  };
  useEffect(() => { void reload(); void db.vaults.get('primary').then((record) => setHasVault(Boolean(record))); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { if (!vaultExpiry) return; const timer = window.setTimeout(() => { vaultRef.current = null; masterPasswordRef.current = null; setVaultUnlocked(false); setVaultExpiry(null); }, Math.max(0, vaultExpiry - Date.now())); return () => window.clearTimeout(timer); }, [vaultExpiry]);

  const visible = useMemo(() => targets.filter((target) => {
    const words = `${target.name} ${target.kind} ${Object.values(target.config).join(' ')}`.toLowerCase();
    return (!activeGroup || target.groupId === activeGroup) && words.includes(query.toLowerCase());
  }), [targets, activeGroup, query]);

  const addGroup = async () => {
    const name = window.prompt('分组名称')?.trim();
    if (!name) return;
    await db.groups.add({ id: newId(), name, sortOrder: groups.length });
    await reload();
  };

  const removeTarget = async (id: string) => {
    if (!window.confirm('删除此 Target？关联的秘密不会被删除。')) return;
    await db.targets.delete(id);
    await reload();
  };
  const addSecret = async () => {
    if (!vaultRef.current) return setVaultDialog(true);
    const title = window.prompt('秘密条目名称')?.trim(); const password = window.prompt('密码、API Key 或 Token');
    if (!title || password === null) return;
    addVaultItem(vaultRef.current, { title, password });
    await db.vaults.put({ id: 'primary', data: await saveVault(vaultRef.current), updatedAt: new Date().toISOString() });
    setVaultItems(listVaultItems(vaultRef.current));
  };
  const removeSecret = async (id: string) => { if (!vaultRef.current || !window.confirm('将秘密条目移入回收站？')) return; deleteVaultItem(vaultRef.current, id); await db.vaults.put({ id: 'primary', data: await saveVault(vaultRef.current), updatedAt: new Date().toISOString() }); setVaultItems(listVaultItems(vaultRef.current)); };
  const linkSecret = async (target: Target) => {
    if (!vaultRef.current) return setVaultDialog(true);
    const options = listVaultItems(vaultRef.current); if (!options.length) return alert('请先创建秘密条目。');
    const value = window.prompt(`输入要关联的秘密 ID：\n${options.map((item) => `${item.id}  ${item.title}`).join('\n')}`)?.trim();
    if (!value || !options.some((item) => item.id === value)) return;
    await db.targets.put({ ...target, vaultItemIds: [...new Set([...target.vaultItemIds, value])], updatedAt: new Date().toISOString() }); await reload();
  };
  const lockVault = () => { vaultRef.current = null; masterPasswordRef.current = null; setVaultUnlocked(false); setVaultExpiry(null); };
  const share = async () => {
    if (!vaultRef.current) return setVaultDialog(true);
    const password = window.prompt('设置独立分享口令'); if (!password) return;
    const currentPassword = masterPasswordRef.current; if (!currentPassword) return lockVault();
    const [allTargets, allGroups, allTags, vault] = await Promise.all([db.targets.toArray(), db.groups.toArray(), db.tags.toArray(), saveVault(vaultRef.current)]);
    const text = await serializeBackup({ targets: allTargets, groups: allGroups, tags: allTags, vault: await rekeyVault(vault, currentPassword, password) }, password);
    await navigator.clipboard.writeText(text); alert('已复制加密分享字符串。');
  };
  const downloadBackup = async () => {
    if (!vaultRef.current || !masterPasswordRef.current) return setVaultDialog(true);
    const [allTargets, allGroups, allTags, vault] = await Promise.all([db.targets.toArray(), db.groups.toArray(), db.tags.toArray(), saveVault(vaultRef.current)]);
    const encoded = await serializeBackup({ targets: allTargets, groups: allGroups, tags: allTags, vault }, masterPasswordRef.current);
    const url = URL.createObjectURL(new Blob([encoded], { type: 'text/plain' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `linkmark-backup-${new Date().toISOString().slice(0, 10)}.txt`; anchor.click(); URL.revokeObjectURL(url);
  };
  const importShare = async () => {
    const text = window.prompt('粘贴加密备份或分享字符串'); const password = window.prompt('输入对应口令'); const nextPassword = window.prompt('设置导入后 Vault 的新主密码'); if (!text || password === null || !nextPassword) return;
    try { const data = await parseBackup(text, password); const replace = window.confirm(`导入预览：${data.targets.length} 个 Target、${data.groups.length} 个分组、${data.tags.length} 个标签。确定替换本地数据；取消则合并。`); if (!replace && vaultRef.current) { const incoming = await unlockVault(data.vault, password); mergeVaultItems(vaultRef.current, incoming); const merged = mergeMetadata({ targets: await db.targets.toArray(), groups: await db.groups.toArray(), tags: await db.tags.toArray() }, data); await replaceLocalData({ ...merged, vault: await saveVault(vaultRef.current) }); await reload(); alert('已合并导入。'); return; } const vault = await rekeyVault(data.vault, password, nextPassword); await replaceLocalData({ ...data, vault }); lockVault(); setHasVault(true); await reload(); alert('已导入。请使用新主密码解锁 Vault。'); } catch (error) { alert(error instanceof Error ? error.message : '导入失败'); }
  };

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span>✦</span> Linkmark</div>
      <button className="new-button" onClick={() => setEditorOpen(true)}>＋ 新建 Target</button>
      <nav>
        <button className={!activeGroup ? 'active' : ''} onClick={() => setActiveGroup(null)}>收件箱 <small>{targets.filter((item) => !item.groupId).length}</small></button>
        <div className="section-title">分组 <button aria-label="添加分组" onClick={() => void addGroup()}>＋</button></div>
        {groups.map((group) => <button key={group.id} className={activeGroup === group.id ? 'active' : ''} onClick={() => setActiveGroup(group.id)}>{group.name}<small>{targets.filter((item) => item.groupId === group.id).length}</small></button>)}
      </nav>
      <div className="sidebar-footer"><span className={vaultUnlocked ? 'lock-dot unlocked' : 'lock-dot'} /> Vault {vaultUnlocked ? '已解锁' : '已锁定'} <button onClick={vaultUnlocked ? lockVault : () => setVaultDialog(true)}>{vaultUnlocked ? '锁定' : hasVault ? '解锁' : '创建'}</button></div>
    </aside>
    <section className="content">
      <header>
        <div><p className="eyebrow">LOCAL-FIRST WORKSPACE</p><h1>{activeGroup ? groups.find((group) => group.id === activeGroup)?.name : '所有 Targets'}</h1></div>
        <div className="actions"><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀︎' : '☾'}</button>{vaultUnlocked && <button onClick={() => setVaultItems(listVaultItems(vaultRef.current!))}>Vault</button>}{vaultUnlocked && <button onClick={() => void addSecret()}>＋ 秘密</button>}{vaultUnlocked && <button onClick={() => void downloadBackup()}>备份</button>}{vaultUnlocked && <button onClick={() => void share()}>分享</button>}<button onClick={() => void importShare()}>导入</button></div>
      </header>
      <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、连接主机或数据库…" /></label>
      <div className="toolbar"><span>{visible.length} 个 Target</span><button onClick={() => setEditorOpen(true)}>新建</button></div>
      {visible.length ? <div className="grid">{visible.map((target) => <article className="card" key={target.id}>
        <div className={`kind kind-${target.kind}`}>{target.kind === 'web' ? '↗' : target.kind === 'postgresql' ? '◫' : target.kind === 'redis' ? '◆' : '◇'}</div>
        <div className="card-body"><p className="kind-label">{kinds[target.kind]}</p><h2>{target.name}</h2><p>{target.kind === 'web' ? String(target.config.url ?? '') : Object.values(target.config).filter(Boolean).join(' · ') || '未填写连接资料'}</p></div>
        {vaultUnlocked && <button className="link-secret" onClick={() => void linkSecret(target)}>秘密 {target.vaultItemIds.length}</button>}
        <button className="delete" aria-label={`删除 ${target.name}`} onClick={() => void removeTarget(target.id)}>×</button>
      </article>)}</div> : <div className="empty"><span>✦</span><h2>建立你的第一个入口</h2><p>网站、PostgreSQL、Redis 与通用连接资料都会保存在这台设备上。</p><button onClick={() => setEditorOpen(true)}>新建 Target</button></div>}
      {vaultUnlocked && vaultItems.length > 0 && <section className="vault-list"><h2>Vault Items</h2>{vaultItems.map((item) => <div key={item.id}><span>{item.title}</span><small>{item.username}</small><button onClick={() => void removeSecret(item.id)}>删除</button></div>)}</section>}
    </section>
    {isEditorOpen && <TargetEditor groups={groups} onClose={() => setEditorOpen(false)} onSaved={async () => { setEditorOpen(false); await reload(); }} />}
    {vaultDialog && <VaultDialog hasVault={hasVault} onClose={() => setVaultDialog(false)} onSubmit={async (password, duration) => { try { const record = await db.vaults.get('primary'); const data = record?.data ?? await createVault(password); const vault = await unlockVault(data, password); if (!record) await db.vaults.put({ id: 'primary', data, updatedAt: new Date().toISOString() }); vaultRef.current = vault; masterPasswordRef.current = password; setVaultExpiry(Date.now() + duration); setVaultUnlocked(true); setHasVault(true); setVaultDialog(false); } catch { setVaultError('无法解锁 Vault，请检查主密码。'); } }} error={vaultError} />}
  </main>;
}

function VaultDialog({ hasVault, onClose, onSubmit, error }: { hasVault: boolean; onClose: () => void; onSubmit: (password: string, duration: number) => Promise<void>; error: string }) {
  const [password, setPassword] = useState('');
  const [duration, setDuration] = useState(300_000);
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="eyebrow">ENCRYPTED VAULT</p><h2>{hasVault ? '解锁 Vault' : '创建 Vault'}</h2></div><button onClick={onClose}>×</button></div><label>主密码<input type="password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>免密时长<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={300000}>5 分钟</option><option value={1800000}>30 分钟</option><option value={7200000}>2 小时</option><option value={86400000}>24 小时</option><option value={604800000}>7 天</option></select></label>{error && <p className="error">{error}</p>}<div className="modal-actions"><button onClick={onClose}>取消</button><button className="primary" disabled={!password} onClick={() => void onSubmit(password, duration)}>{hasVault ? '解锁' : '创建'}</button></div></section></div>;
}

function TargetEditor({ groups, onClose, onSaved }: { groups: Group[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(''); const [kind, setKind] = useState<TargetKind>('web'); const [address, setAddress] = useState(''); const [host, setHost] = useState(''); const [port, setPort] = useState(''); const [database, setDatabase] = useState(''); const [groupId, setGroupId] = useState(''); const [error, setError] = useState('');
  const save = async () => {
    if (!name.trim()) return setError('请输入名称。');
    if (kind === 'web' && !validateWebUrl(address)) return setError('网站地址必须是 HTTP 或 HTTPS URL。');
    if ((kind === 'postgresql' || kind === 'redis') && (!host.trim() || !/^\d{1,5}$/.test(port) || Number(port) > 65535)) return setError('请填写主机和 1–65535 的端口。');
    const config: Record<string, string> = kind === 'web' ? { url: address } : kind === 'postgresql' ? { host, port, database } : kind === 'redis' ? { host, port, database } : { note: address };
    await db.targets.add(createTarget({ name, kind, groupId: groupId || null, config }));
    await onSaved();
  };
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-label="新建 Target"><div className="modal-heading"><div><p className="eyebrow">NEW TARGET</p><h2>添加入口</h2></div><button onClick={onClose}>×</button></div>
    <label>名称<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：生产数据库" /></label>
    <label>类型<select value={kind} onChange={(event) => setKind(event.target.value as TargetKind)}>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {kind === 'web' || kind === 'generic' ? <label>{kind === 'web' ? 'URL' : '非敏感说明'}<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={kind === 'web' ? 'https://example.com' : '仅保存资料，不执行'} /></label> : <><label>主机<input value={host} onChange={(event) => setHost(event.target.value)} placeholder="db.example.com" /></label><label>端口<input inputMode="numeric" value={port} onChange={(event) => setPort(event.target.value)} placeholder={kind === 'postgresql' ? '5432' : '6379'} /></label><label>{kind === 'postgresql' ? '数据库' : '数据库编号'}<input value={database} onChange={(event) => setDatabase(event.target.value)} /></label></>}
    <label>分组<select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">收件箱</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
    {error && <p className="error">{error}</p>}<div className="modal-actions"><button onClick={onClose}>取消</button><button className="primary" onClick={() => void save()}>保存</button></div>
  </section></div>;
}
