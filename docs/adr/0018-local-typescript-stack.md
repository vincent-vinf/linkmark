# Local TypeScript stack

应用采用 TypeScript、React 与 Vite；Dexie 管理 IndexedDB，kdbxweb 管理 KDBX，锁版本且本地打包的 Argon2id WASM 在专用 Worker 中运行，Zod 验证表单与导入数据。UI 使用本地构建的零运行时 CSS 方案，所有依赖进入锁文件与同源构建物，不经 CDN 加载。
