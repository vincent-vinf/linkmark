import { expect, test, type Page } from "@playwright/test";

async function createVault(page: Page) {
  await page.goto("/");
  await page
    .getByLabel("主密码", { exact: true })
    .fill("connection-test-password");
  await page
    .getByLabel("确认主密码", { exact: true })
    .fill("connection-test-password");
  await page.getByRole("button", { name: "创建密钥库", exact: true }).click();
  await expect(page.getByRole("heading", { name: "所有入口" })).toBeVisible();
}

async function mockClipboard(page: Page, useNative = false) {
  await page.evaluate((native) => {
    const nativeWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
    const nativeRead = navigator.clipboard.readText.bind(navigator.clipboard);
    const state = window as Window & {
      clipboardWrites: string[];
      rejectClipboard: boolean;
    };
    state.clipboardWrites = [];
    state.rejectClipboard = false;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          if (state.rejectClipboard) throw new Error("denied");
          state.clipboardWrites.push(value);
          if (native) await nativeWrite(value);
        },
        readText: nativeRead,
      },
    });
  }, useNative);
}

test("creates an SSH entry, previews and copies its command, and preserves it after unlock", async ({
  page,
}) => {
  await createVault(page);
  await mockClipboard(page);
  await page
    .locator(".actions")
    .getByRole("button", { name: "新建入口", exact: true })
    .click();
  await page.getByLabel("名称", { exact: true }).fill("SSH 生产主机");
  await page
    .getByRole("combobox", { name: "入口类型", exact: true })
    .selectOption("ssh");
  await page.getByLabel("主机", { exact: true }).fill("server.example.com");
  await page.getByLabel("端口", { exact: true }).fill("2222");
  await page
    .getByLabel("私钥文件路径（可选）", { exact: true })
    .fill("~/.ssh/team's key");
  await page.getByLabel("登录账号", { exact: true }).fill("deploy");
  await page.getByLabel("登录密码", { exact: true }).fill("never-in-command");
  await page.locator("summary").filter({ hasText: "跳板机与其他选项" }).click();
  await page
    .getByLabel("跳板机主机（可选）", { exact: true })
    .fill("bastion.example.com");
  await page.getByLabel("跳板机端口", { exact: true }).fill("2200");
  await page.getByLabel("启用压缩（-C）", { exact: true }).check();
  const expected =
    "ssh -p 2222 -l deploy -i '~/.ssh/team'\\''s key' -J bastion.example.com:2200 -C -- server.example.com";
  await expect(
    page.getByRole("region", { name: "SSH 命令预览" }).locator("code"),
  ).toHaveText(expected);
  await page.getByRole("button", { name: "复制命令", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "SSH 命令已复制" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "保存入口", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "SSH 生产主机", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "SSH 1", exact: true }).click();
  await page
    .getByRole("button", { name: "复制 SSH 生产主机 的 SSH 命令", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { clipboardWrites: string[] }).clipboardWrites,
      ),
    )
    .toEqual([expected, expected]);
  await page.reload();
  await page
    .getByLabel("主密码", { exact: true })
    .fill("connection-test-password");
  await page.getByRole("button", { name: "解锁密钥库", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "SSH 生产主机", exact: true }),
  ).toBeVisible();
  await mockClipboard(page);
  await page
    .getByRole("button", { name: "复制 SSH 生产主机 的 SSH 命令", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { clipboardWrites: string[] }).clipboardWrites[0],
      ),
    )
    .toBe(expected);
  await page.getByLabel("编辑 SSH 生产主机", { exact: true }).click();
  await expect(page.getByLabel("主机", { exact: true })).toHaveValue(
    "server.example.com",
  );
  await expect(
    page.getByRole("region", { name: "SSH 命令预览" }).locator("code"),
  ).toHaveText(expected);
});

test("website navigation copies the selected credential and still opens when copying fails", async ({
  page,
  context,
  browserName,
}) => {
  await context.route("https://example.com/**", (route) =>
    route.fulfill({ body: "Example destination" }),
  );
  await createVault(page);
  await page
    .locator(".actions")
    .getByRole("button", { name: "新建入口", exact: true })
    .click();
  await page.getByLabel("名称", { exact: true }).fill("登录站点");
  await page
    .getByLabel("网站地址", { exact: true })
    .fill("https://example.com/login");
  await page.getByRole("button", { name: "管理关联密钥", exact: true }).click();
  for (const [title, username, password] of [
    ["账号登录", "demo@example.com", "account-secret"],
    ["密码登录", "", "password-only"],
  ]) {
    await page.getByRole("button", { name: "新建密钥", exact: true }).click();
    await page.getByLabel("密钥名称", { exact: true }).fill(title!);
    await page.getByLabel("账号（可选）", { exact: true }).fill(username!);
    await page.getByLabel("密钥值（可选）", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "创建并关联", exact: true }).click();
  }
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "保存入口", exact: true }).click();
  if (browserName === "chromium")
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await mockClipboard(page, browserName === "chromium");
  const titleLink = page
    .getByRole("heading", { name: "登录站点", exact: true })
    .getByRole("link");
  const openLink = async (link: ReturnType<Page["getByRole"]>) => {
    const popupPromise = page.waitForEvent("popup");
    await link.click();
    const popup = await popupPromise;
    await popup.waitForURL("https://example.com/login");
    await popup.close();
  };
  await openLink(titleLink);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { clipboardWrites: string[] }).clipboardWrites,
      ),
    )
    .toEqual(["demo@example.com"]);
  if (browserName === "chromium")
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("demo@example.com");
  await page
    .getByLabel("登录站点 的复制密钥", { exact: true })
    .selectOption({ label: "密码登录" });
  await openLink(
    page.getByRole("link", { name: "打开并复制密码", exact: true }),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { clipboardWrites: string[] }).clipboardWrites,
      ),
    )
    .toEqual(["demo@example.com", "password-only"]);
  if (browserName === "chromium")
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("password-only");
  await page.evaluate(() => {
    (window as Window & { rejectClipboard: boolean }).rejectClipboard = true;
  });
  await openLink(titleLink);
  await expect(
    page.getByRole("status").filter({ hasText: "无法复制密码" }),
  ).toBeVisible();
});

test("PostgreSQL title and primary action copy a URI using the selected credential", async ({
  page,
}) => {
  await createVault(page);
  await page
    .locator(".actions")
    .getByRole("button", { name: "新建入口", exact: true })
    .click();
  await page.getByLabel("名称", { exact: true }).fill("PostgreSQL 生产");
  await page
    .getByRole("combobox", { name: "入口类型", exact: true })
    .selectOption("postgresql");
  await page.getByLabel("主机", { exact: true }).fill("db.example.com");
  await page.getByLabel("端口", { exact: true }).fill("6432");
  await page.getByRole("button", { name: "管理关联密钥", exact: true }).click();
  for (const [title, username, password] of [
    ["生产账号", "postgres", "example-password"],
    ["只读账号", "reader@ops", "p:a/ss?#"],
  ]) {
    await page.getByRole("button", { name: "新建密钥", exact: true }).click();
    await page.getByLabel("密钥名称", { exact: true }).fill(title!);
    await page.getByLabel("账号（可选）", { exact: true }).fill(username!);
    await page.getByLabel("密钥值（可选）", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "创建并关联", exact: true }).click();
  }
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "保存入口", exact: true }).click();
  await mockClipboard(page);
  await page
    .getByRole("heading", { name: "PostgreSQL 生产", exact: true })
    .getByRole("button")
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { clipboardWrites: string[] }).clipboardWrites[0],
      ),
    )
    .toBe("postgresql://postgres:example-password@db.example.com:6432");
  await page
    .getByLabel("PostgreSQL 生产 的复制密钥", { exact: true })
    .selectOption({ label: "只读账号 · reader@ops" });
  await page
    .getByRole("button", {
      name: "复制 PostgreSQL 生产 的 PostgreSQL 连接地址",
      exact: true,
    })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { clipboardWrites: string[] }).clipboardWrites[1],
      ),
    )
    .toBe("postgresql://reader%40ops:p%3Aa%2Fss%3F%23@db.example.com:6432");
  await page.getByLabel("编辑 PostgreSQL 生产", { exact: true }).click();
  await page.getByLabel("数据库", { exact: true }).fill("app/data");
  await page
    .getByRole("combobox", { name: "SSL 模式", exact: true })
    .selectOption("require");
  await page.getByRole("button", { name: "保存入口", exact: true }).click();
  await page
    .getByRole("button", {
      name: "复制 PostgreSQL 生产 的 PostgreSQL 连接地址",
      exact: true,
    })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { clipboardWrites: string[] }).clipboardWrites[2],
      ),
    )
    .toBe(
      "postgresql://reader%40ops:p%3Aa%2Fss%3F%23@db.example.com:6432/app%2Fdata?sslmode=require",
    );
  await expect(page.locator("body")).not.toContainText("example-password");
  await expect(page.locator("body")).not.toContainText("p:a/ss?#");
});
