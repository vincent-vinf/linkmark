import { expect, test } from '@playwright/test';

test('creates a Web Target in IndexedDB', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '＋ 新建 Target' }).click();
  await page.getByLabel('名称', { exact: true }).fill('Linkmark 文档');
  await page.getByLabel('URL', { exact: true }).fill('https://example.com/docs');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByRole('heading', { name: 'Linkmark 文档' })).toBeVisible();
});

test('creates a Worker-encrypted Vault and locks after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '创建' }).click();
  await page.getByLabel('主密码', { exact: true }).fill('browser-test-password');
  await page.getByLabel('确认主密码', { exact: true }).fill('browser-test-password');
  await page.getByRole('button', { name: '创建', exact: true }).last().click();
  await expect(page.getByText('Vault 已解锁')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByText('Vault 已锁定')).toBeVisible();
  await expect(page.getByRole('button', { name: '解锁' })).toBeVisible();
});

test('registers the same-origin Service Worker for offline application resources', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
});
