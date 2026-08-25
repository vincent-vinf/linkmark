import { expect, test } from '@playwright/test';

test('requires a key store before showing entries and saves a linked key with an entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '创建密钥库' })).toBeVisible();
  await page.getByLabel('主密码', { exact: true }).fill('browser-test-password');
  await page.getByLabel('确认主密码', { exact: true }).fill('browser-test-password');
  await page.getByRole('button', { name: '创建密钥库' }).click();
  await page.getByRole('button', { name: '新建入口 ↗' }).click();
  await page.getByLabel('名称', { exact: true }).fill('Linkmark 文档');
  await page.getByRole('dialog', { name: '新建入口' }).getByLabel('备注（可选）', { exact: true }).first().fill('这是一条用于验证卡片截断与完整悬浮提示的入口备注。');
  await page.getByLabel('网站地址', { exact: true }).fill('https://example.com/docs');
  await page.getByRole('button', { name: '管理关联密钥' }).click();
  await page.getByRole('button', { name: '＋ 新建密钥' }).click();
  await page.getByLabel('密钥名称', { exact: true }).fill('文档令牌');
  await page.getByLabel('密钥值（可选）', { exact: true }).fill('never-plaintext');
  await page.getByRole('button', { name: '创建并关联' }).click();
  await page.getByRole('button', { name: '完成' }).click();
  await page.getByRole('button', { name: '保存入口' }).click();
  await expect(page.getByRole('heading', { name: 'Linkmark 文档' })).toBeVisible();
  await expect(page.getByLabel('Linkmark 文档 的复制密钥')).toHaveText('文档令牌');
  await expect(page.locator('.card-note')).toHaveAttribute('title', '这是一条用于验证卡片截断与完整悬浮提示的入口备注。');
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
  await page.getByLabel('主密码', { exact: true }).fill('browser-test-password');
  await page.getByLabel('主密码', { exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: '所有入口' })).toBeVisible({ timeout: 30_000 });
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

test('selects which linked key card copy actions use', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('主密码', { exact: true }).fill('picker-test-password');
  await page.getByLabel('确认主密码', { exact: true }).fill('picker-test-password');
  await page.getByRole('button', { name: '创建密钥库' }).click();
  await page.getByRole('button', { name: '新建入口 ↗' }).click();
  await page.getByLabel('名称', { exact: true }).fill('双凭据入口');
  await page.getByLabel('网站地址', { exact: true }).fill('https://example.com');
  await page.getByRole('button', { name: '管理关联密钥' }).click();
  await page.getByRole('button', { name: '＋ 新建密钥' }).click();
  await page.getByLabel('密钥名称', { exact: true }).fill('生产账号');
  await page.getByLabel('账号（可选）', { exact: true }).fill('prod@example.com');
  await page.getByLabel('密钥值（可选）', { exact: true }).fill('prod-token');
  await page.getByRole('button', { name: '创建并关联' }).click();
  await page.getByRole('button', { name: '完成' }).click();
  await page.getByRole('button', { name: '保存入口' }).click();
  await page.getByRole('button', { name: '全部密钥 1' }).click();
  await page.getByRole('button', { name: '＋ 新建密钥' }).click();
  await page.getByLabel('密钥名称', { exact: true }).fill('只读账号');
  await page.getByLabel('账号（可选）', { exact: true }).fill('readonly@example.com');
  await page.getByRole('dialog', { name: '新建密钥' }).locator('input[type="password"]').fill('readonly-token');
  await page.getByRole('button', { name: '保存密钥' }).click();
  await page.getByRole('button', { name: '所有入口 1' }).click();
  await page.getByLabel('编辑 双凭据入口').click();
  await page.getByRole('button', { name: '管理关联密钥' }).click();
  await page.getByRole('checkbox', { name: '只读账号 readonly@example.com' }).check();
  await page.getByRole('button', { name: '完成' }).click();
  await page.getByRole('button', { name: '保存入口' }).click();
  const picker = page.getByLabel('双凭据入口 的复制密钥');
  await expect(picker).toHaveText(/生产账号.*只读账号/);
  await picker.selectOption({ label: '只读账号 · readonly@example.com' });
  await expect(picker).toHaveValue(await picker.locator('option', { hasText: '只读账号' }).getAttribute('value') ?? '');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByLabel('复制 双凭据入口 的账号').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('readonly@example.com');
});
