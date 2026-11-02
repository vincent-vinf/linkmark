import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build, createServer } from 'vite';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');

describe('development and production CSP boundaries', () => {
  it('allows Vite development styles with the real formatted HTML shell', async () => {
    const server = await createServer({
      root: projectRoot,
      server: { middlewareMode: true, watch: null },
      logLevel: 'silent',
    });
    try {
      const source = await readFile(resolve(projectRoot, 'index.html'), 'utf8');
      const html = await server.transformIndexHtml('/', source);
      expect(html).not.toMatch(/http-equiv\s*=\s*["']Content-Security-Policy["']/i);
      expect(html).toContain('/@vite/client');
    } finally {
      await server.close();
    }
  });

  it('keeps the strict self-only CSP in the production build', async () => {
    const result = await build({
      root: projectRoot,
      logLevel: 'silent',
      build: { write: false },
    });
    if (Array.isArray(result) || !('output' in result)) throw new Error('Expected a single app build');
    const html = result.output.find((item) => item.type === 'asset' && item.fileName === 'index.html');
    expect(html?.type).toBe('asset');
    if (!html || html.type !== 'asset') throw new Error('Missing HTML shell');
    expect(String(html.source)).toMatch(/http-equiv\s*=\s*["']Content-Security-Policy["']/i);
    expect(String(html.source)).toContain("script-src 'self'");
    expect(String(html.source)).toContain("style-src 'self'");
    expect(String(html.source)).not.toContain("'unsafe-inline'");
  });
});
