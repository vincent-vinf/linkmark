import { expect, test } from '@playwright/test';

test('creates a Web entry in IndexedDB', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '＋ 新建入口' }).click();
  await page.getByLabel('名称', { exact: true }).fill('Linkmark 文档');
  await page.getByLabel('URL', { exact: true }).fill('https://example.com/docs');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByRole('heading', { name: 'Linkmark 文档' })).toBeVisible();
});

test('keeps the add-entry confirmation button legible in dark mode', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('linkmark-theme', 'dark'));
  await page.goto('/');
  await page.getByRole('button', { name: '＋ 新建入口' }).click();
  const colors = await page.getByRole('button', { name: '保存' }).evaluate((button) => {
    const style = getComputedStyle(button);
    return { background: style.backgroundColor, color: style.color };
  });
  expect(colors).toEqual({ background: 'rgb(124, 224, 192)', color: 'rgb(8, 44, 40)' });
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

test('reopens the cached application shell while offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '所有入口' })).toBeVisible();
});
