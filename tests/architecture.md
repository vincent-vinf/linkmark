# Linkmark security-audit architecture summary

## Scope and prior coverage

Target: `/home/csl/repo/linkmark`.  Output directory: `tests/`.  No prior
`~/security-audit-skill/linkmark/run-*` artifacts were present, so this is the
first known run.  A second independent run is recommended because each audit
explores different paths.

## Application and baseline

Linkmark is a single-user, local-first static React PWA for encrypted browser
bookmarks, connection metadata, and reusable credentials.  A static host
delivers the application; it does not receive users' vaults, passwords, or
business data.  The closest comparable products are KeeWeb/KeePassXC and the
local-vault mode of password managers, rather than a multi-user web service.
Its intended tradeoff is at-rest protection against a copied browser profile or
encrypted export; executing same-origin script, a malicious extension, and a
compromised device are outside that guarantee (see
`docs/adr/0001-local-first-security-boundary.md`).

The stack is TypeScript, React 19, Vite, Dexie/IndexedDB, kdbxweb KDBX4 and
hash-wasm Argon2id.  Production is a static HTTPS PWA: `index.html` contains a
self-only CSP, and `public/sw.js` caches only same-origin application-shell
GETs.  There are no HTTP business endpoints, backend processes, user accounts,
cookies, JWTs, API keys, RBAC roles, cloud sync, shell commands, or network
connections to saved targets.

Key entry points: `index.html` -> `src/main.tsx` -> `src/App.tsx`; cryptography
and KDBX parsing are in `src/vault/vault.ts`, `src/vault/vault-save.worker.ts`,
and `src/crypto/argon2.ts`; encrypted domain storage is in
`src/vault/workspace.ts`; IndexedDB is `src/storage/db.ts`; portable formats are
`src/portability/{backup,package,merge}.ts`; URL validation is
`src/domain/targets.ts`; the service worker is `public/sw.js`.

## Trust model and data lifecycle

The browser profile is the security principal.  A locked user can see only that
a primary vault exists and may create or submit an encrypted package.  A user
who supplies the KDBX master password obtains the complete local vault in page
memory and may perform every vault action by design.  Encrypted KDBX bytes are
the only active persistent business record (`db.vaults.primary`), while theme is
the only active localStorage value.  `App.tsx:16-32` holds the KDBX object and
password in refs, and clears references/UI state on explicit lock, pagehide, or
an absolute 5-minute to 7-day timer (`App.tsx:12,25-27`).

KDBX password verification is performed by `Kdbx.load` after
`assertVaultKdfParameters` limits imported KDBX4 Argon2 parameters to 64 MiB,
6 iterations, and parallelism 2 (`src/vault/vault.ts:38-61`).  New and saved
vaults use Argon2id (`src/vault/vault.ts:47-55`; worker equivalent at
`src/vault/vault-save.worker.ts:10-18`).  Passwords, notes, custom fields, and
workspace metadata are protected KDBX values.  Dedicated same-origin module
workers receive password/XML solely to perform KDF/save work and terminate after
one response.

## External input and sensitive sinks

- UI input: master password, unlock duration, entries, keys, groups, tags, and
  search are handled in `src/App.tsx`. React renders values as text; no
  `innerHTML`, eval, dynamic code loading, or cross-window message handler was
  found.
- Portable input: a pasted Base64URL package reaches
  `parseKeyStoreBackup` (`src/portability/backup.ts:52-59`), then `unlockVault`
  (`src/App.tsx:34-42`). Its size and legacy compressed format are bounded;
  KDBX header limits run before KDF. Merge and replace flows are relevant state
  transitions.
- Navigation: a user-controlled bookmark URL is validated as http/https without
  credentials (`src/domain/targets.ts:58-81`) then opened with
  `noopener,noreferrer` (`src/App.tsx:79`). Data recovered from a KDBX record is
  a separate, untrusted-on-import path requiring validation review.
- Persistence/IPC: IndexedDB stores encrypted bytes (`src/storage/db.ts:24-26`);
  clipboard and Blob download are explicit user operations in `src/App.tsx`.
  `storage/db.ts` has legacy plaintext tables and `replaceLocalData`, but the
  current app only uses `vaults`.
- PWA: `public/sw.js:22-27` intercepts only same-origin GET app-shell assets and
  has no access to IndexedDB/vault content.

## Audit focus

Hunters should focus on untrusted KDBX/package parsing and resource bounds,
import/merge state integrity, imported KDBX data reaching URL or UI sinks,
service-worker/cache and production CSP deployment assumptions, and residual
legacy IndexedDB state.  Network auth/protocol, SSRF, SQL injection, and
multi-user authorization are not applicable to this static single-user design.
