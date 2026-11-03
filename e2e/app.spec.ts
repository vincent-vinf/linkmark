import { expect, test } from "@playwright/test";

test("new entries inherit the browsed group and allow overriding it", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("主密码", { exact: true })
    .fill("browser-test-password");
  await page
    .getByLabel("确认主密码", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "创建密钥库", exact: true }).click();
  await page.getByLabel("管理分组", { exact: true }).click();
  for (const name of ["研发资源", "生产资源"]) {
    await page.getByLabel("新分组名称", { exact: true }).fill(name);
    await page
      .getByRole("dialog", { name: "管理分组" })
      .getByRole("button", { name: "新建分组", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: `${name} 0`, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "完成", exact: true }).click();
  const group = page.getByRole("combobox", { name: /^分组/ });
  const newEntry = page
    .locator(".actions")
    .getByRole("button", { name: "新建入口", exact: true });
  await page.getByRole("button", { name: "研发资源 0", exact: true }).click();
  await page
    .locator(".empty")
    .getByRole("button", { name: "新建入口", exact: true })
    .click();
  await expect(group.locator("option:checked")).toHaveText("研发资源");
  await page.getByLabel("名称", { exact: true }).fill("研发文档");
  await page
    .getByLabel("网站地址", { exact: true })
    .fill("https://example.com/docs");
  await page.getByRole("button", { name: "保存入口", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "研发文档", exact: true }),
  ).toBeVisible();
  await page.getByLabel("编辑 研发文档", { exact: true }).click();
  await expect(group.locator("option:checked")).toHaveText("研发资源");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "生产资源 0", exact: true }).click();
  await newEntry.click();
  await expect(group.locator("option:checked")).toHaveText("生产资源");
  await group.selectOption("");
  await page.getByLabel("名称", { exact: true }).fill("手动归组的文档");
  await page
    .getByLabel("网站地址", { exact: true })
    .fill("https://example.com/manual");
  await page.getByRole("button", { name: "保存入口", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "新建入口", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "手动归组的文档", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "默认分组 1", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "手动归组的文档", exact: true }),
  ).toBeVisible();
  await newEntry.click();
  await expect(group).toHaveValue("");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "所有入口 2", exact: true }).click();
  await page.keyboard.press("n");
  await expect(group).toHaveValue("");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.reload();
  await page
    .getByLabel("主密码", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "解锁密钥库", exact: true }).click();
  await page.getByRole("button", { name: "研发资源 1", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "研发文档", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "手动归组的文档", exact: true }),
  ).not.toBeVisible();
});

test("requires a key store before showing entries and saves a linked key with an entry", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "创建你的私人密钥库" }),
  ).toBeVisible();
  await page
    .getByLabel("主密码", { exact: true })
    .fill("browser-test-password");
  await page
    .getByLabel("确认主密码", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "创建密钥库" }).click();
  await page
    .locator(".actions")
    .getByRole("button", { name: "新建入口", exact: true })
    .click();
  await page.getByLabel("名称", { exact: true }).fill("Linkmark 文档");
  await page
    .getByRole("dialog", { name: "新建入口" })
    .getByLabel("备注（可选）", { exact: true })
    .first()
    .fill("这是一条用于验证卡片截断与完整悬浮提示的入口备注。");
  await page
    .getByLabel("网站地址", { exact: true })
    .fill("https://example.com/docs");
  await page.getByRole("button", { name: "管理关联密钥" }).click();
  await page.getByRole("button", { name: "新建密钥", exact: true }).click();
  await page.getByLabel("密钥名称", { exact: true }).fill("文档令牌");
  await page
    .getByLabel("密钥值（可选）", { exact: true })
    .fill("never-plaintext");
  await page.getByRole("button", { name: "创建并关联" }).click();
  await page.getByRole("button", { name: "完成" }).click();
  await page.getByRole("button", { name: "保存入口" }).click();
  await expect(
    page.getByRole("heading", { name: "Linkmark 文档" }),
  ).toBeVisible();
  await expect(page.getByLabel("Linkmark 文档 的复制密钥")).toHaveText(
    "文档令牌",
  );
  await expect(page.locator(".card-note")).toHaveAttribute(
    "title",
    "这是一条用于验证卡片截断与完整悬浮提示的入口备注。",
  );
});

test("locks all entry metadata after refresh", async ({ page }) => {
  await page.goto("/");
  await page
    .getByLabel("主密码", { exact: true })
    .fill("browser-test-password");
  await page
    .getByLabel("确认主密码", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "创建密钥库" }).click();
  await expect(page.getByRole("heading", { name: "所有入口" })).toBeVisible({
    timeout: 30_000,
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  await expect(page.getByText("所有入口")).not.toBeVisible();
  await page
    .getByLabel("主密码", { exact: true })
    .fill("browser-test-password");
  await page.getByLabel("主密码", { exact: true }).press("Enter");
  await expect(page.getByRole("heading", { name: "所有入口" })).toBeVisible({
    timeout: 30_000,
  });
});

test("generates a share package even when clipboard access is unavailable", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("主密码", { exact: true })
    .fill("browser-test-password");
  await page
    .getByLabel("确认主密码", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "创建密钥库" }).click();
  await page.locator("summary").filter({ hasText: "备份与分享" }).click();
  await page.getByRole("button", { name: "分享", exact: true }).click();
  await page
    .getByLabel("分享口令", { exact: true })
    .fill("share-test-password");
  await page
    .getByLabel("确认分享口令", { exact: true })
    .fill("share-test-password");
  await page.getByRole("button", { name: "生成并复制" }).click();
  await expect(page.getByText("正在以分享口令加密密钥库…")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByLabel("已生成的加密字符串")).toBeVisible({
    timeout: 20_000,
  });
});

test("exports the encrypted key store as a download", async ({ page }) => {
  await page.goto("/");
  await page
    .getByLabel("主密码", { exact: true })
    .fill("browser-test-password");
  await page
    .getByLabel("确认主密码", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "创建密钥库" }).click();
  const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
  await page.locator("summary").filter({ hasText: "备份与分享" }).click();
  await page.getByRole("button", { name: "导出备份" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^linkmark-backup-\d{4}-\d{2}-\d{2}\.txt$/,
  );
});

test("selects which linked key card copy actions use", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await page.getByLabel("主密码", { exact: true }).fill("picker-test-password");
  await page
    .getByLabel("确认主密码", { exact: true })
    .fill("picker-test-password");
  await page.getByRole("button", { name: "创建密钥库" }).click();
  await page
    .locator(".actions")
    .getByRole("button", { name: "新建入口", exact: true })
    .click();
  await page.getByLabel("名称", { exact: true }).fill("双凭据入口");
  await page
    .getByLabel("网站地址", { exact: true })
    .fill("https://example.com");
  await page.getByRole("button", { name: "管理关联密钥" }).click();
  await page.getByRole("button", { name: "新建密钥", exact: true }).click();
  await page.getByLabel("密钥名称", { exact: true }).fill("生产账号");
  await page
    .getByLabel("账号（可选）", { exact: true })
    .fill("prod@example.com");
  await page.getByLabel("密钥值（可选）", { exact: true }).fill("prod-token");
  await page.getByRole("button", { name: "创建并关联" }).click();
  await page.getByRole("button", { name: "完成" }).click();
  await page.getByRole("button", { name: "保存入口" }).click();
  await page.getByRole("button", { name: "全部密钥 1" }).click();
  await page
    .locator(".actions")
    .getByRole("button", { name: "新建密钥", exact: true })
    .click();
  await page.getByLabel("密钥名称", { exact: true }).fill("只读账号");
  await page
    .getByLabel("账号（可选）", { exact: true })
    .fill("readonly@example.com");
  await page
    .getByRole("dialog", { name: "新建密钥" })
    .locator('input[type="password"]')
    .fill("readonly-token");
  await page.getByRole("button", { name: "保存密钥" }).click();
  await page.getByRole("button", { name: "所有入口 1" }).click();
  await page.getByLabel("编辑 双凭据入口").click();
  await page.getByRole("button", { name: "管理关联密钥" }).click();
  await page
    .getByRole("checkbox", { name: "只读账号 readonly@example.com" })
    .check();
  await page.getByRole("button", { name: "完成" }).click();
  await page.getByRole("button", { name: "保存入口" }).click();
  const picker = page.getByLabel("双凭据入口 的复制密钥");
  await expect(picker).toHaveText(/生产账号.*只读账号/);
  await picker.selectOption({ label: "只读账号 · readonly@example.com" });
  await expect(picker).toHaveValue(
    (await picker
      .locator("option", { hasText: "只读账号" })
      .getAttribute("value")) ?? "",
  );
  if (browserName === "chromium") {
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
  } else {
    // Firefox does not expose Playwright's clipboard permission override.
    // Verify the value passed to its clipboard API without relying on OS permissions.
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as Window & { copiedValue?: string }).copiedValue = value;
          },
        },
      });
    });
  }
  await page.getByLabel("复制 双凭据入口 的账号").click();
  await expect
    .poll(() =>
      page.evaluate(
        (nativeClipboard) =>
          nativeClipboard
            ? navigator.clipboard.readText()
            : (window as Window & { copiedValue?: string }).copiedValue,
        browserName === "chromium",
      ),
    )
    .toBe("readonly@example.com");
});

test("filters entries, recovers from empty results and supports the search shortcut", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("主密码", { exact: true }).fill("filter-test-password");
  await page
    .getByLabel("确认主密码", { exact: true })
    .fill("filter-test-password");
  await page.getByRole("button", { name: "创建密钥库", exact: true }).click();
  await page
    .locator(".actions")
    .getByRole("button", { name: "新建入口", exact: true })
    .click();
  await page.getByLabel("名称", { exact: true }).fill("参考资料");
  await page
    .getByLabel("网站地址", { exact: true })
    .fill("https://example.com/reference");
  await page.getByRole("button", { name: "保存入口", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "参考资料", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "PostgreSQL 0", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "没有找到匹配的入口" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "参考资料", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("textbox", { name: "搜索入口", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("textbox", { name: "搜索入口", exact: true })
    .fill("找不到的资料");
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "参考资料", exact: true }),
  ).toBeVisible();
  await page.getByLabel("更多操作 参考资料").click();
  await page.getByRole("button", { name: "置顶入口", exact: true }).click();
  await expect(page.locator(".pin-label")).toHaveText("置顶");
  await page.getByRole("button", { name: "已置顶 1", exact: true }).click();
  await expect(page.locator(".card")).toHaveCount(1);
});

test("uses a mobile navigation drawer and restores keyboard focus after editing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("主密码", { exact: true }).fill("mobile-test-password");
  await page
    .getByLabel("确认主密码", { exact: true })
    .fill("mobile-test-password");
  await page.getByRole("button", { name: "创建密钥库", exact: true }).click();
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "资料导航", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "全部密钥 0", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const create = page
    .locator(".actions")
    .getByRole("button", { name: "新建密钥", exact: true });
  await create.click();
  const dialog = page.getByRole("dialog", { name: "新建密钥", exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("密钥名称", { exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "关闭对话框", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "取消", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(create).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "锁定", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "欢迎回来", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "打开导航", exact: true }),
  ).toHaveCount(0);
});

test("explains missing browser encryption APIs instead of blaming the master password", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "subtle", { value: undefined });
  });
  await page.goto("/");
  await page
    .getByLabel("主密码", { exact: true })
    .fill("environment-test-password");
  await page
    .getByLabel("确认主密码", { exact: true })
    .fill("environment-test-password");
  await page.getByRole("button", { name: "创建密钥库", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("HTTPS");
  await expect(page.getByRole("alert")).toContainText("localhost");
  await expect(page.getByRole("heading", { name: /所有入口/ })).toHaveCount(0);
});
