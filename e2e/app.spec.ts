import { expect, test } from '@playwright/test';

test('requires a key store before showing entries and saves a linked key with an entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '创建密钥库' })).toBeVisible();
  await page.getByLabel('主密码', { exact: true }).fill('browser-test-password');
  await page.getByLabel('确认主密码', { exact: true }).fill('browser-test-password');
  await page.getByRole('button', { name: '创建密钥库' }).click();
  await page.getByRole('button', { name: '新建入口 ↗' }).click();
  await page.getByLabel('名称', { exact: true }).fill('Linkmark 文档');
  await page.getByLabel('网站地址', { exact: true }).fill('https://example.com/docs');
  await page.getByLabel('密钥名称', { exact: true }).fill('文档令牌');
  await page.getByLabel('密钥值', { exact: true }).fill('never-plaintext');
  await page.getByRole('button', { name: '保存入口' }).click();
  await expect(page.getByRole('heading', { name: 'Linkmark 文档' })).toBeVisible();
  await expect(page.getByText('关联 1 把密钥')).toBeVisible();
});

test('locks all entry metadata after refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('主密码', { exact: true }).fill('browser-test-password');
  await page.getByLabel('确认主密码', { exact: true }).fill('browser-test-password');
  await page.getByRole('button', { name: '创建密钥库' }).click();
  await expect(page.getByRole('heading', { name: '所有入口' })).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByRole('heading', { name: '解锁密钥库' })).toBeVisible();
  await expect(page.getByText('所有入口')).not.toBeVisible();
});

test('generates a share package even when clipboard access is unavailable', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('主密码', { exact: true }).fill('browser-test-password');
  await page.getByLabel('确认主密码', { exact: true }).fill('browser-test-password');
  await page.getByRole('button', { name: '创建密钥库' }).click();
  await page.getByRole('button', { name: '分享' }).click();
  await page.getByLabel('分享口令', { exact: true }).fill('share-test-password');
  await page.getByLabel('确认分享口令', { exact: true }).fill('share-test-password');
  await page.getByRole('button', { name: '生成并复制' }).click();
  await expect(page.getByText('正在以分享口令加密密钥库…')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('已生成的加密字符串')).toBeVisible({ timeout: 20_000 });
});

test('exports the encrypted key store as a download', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('主密码', { exact: true }).fill('browser-test-password');
  await page.getByLabel('确认主密码', { exact: true }).fill('browser-test-password');
  await page.getByRole('button', { name: '创建密钥库' }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
  await page.getByRole('button', { name: '导出备份' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^linkmark-backup-\d{4}-\d{2}-\d{2}\.txt$/);
});
