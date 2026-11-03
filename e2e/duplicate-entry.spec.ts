import { expect, test } from "@playwright/test";

test("duplicates entry details and key links without changing the original", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByLabel("主密码", { exact: true }).fill("duplicate-test-password");
  await page.getByLabel("确认主密码", { exact: true }).fill("duplicate-test-password");
  await page.getByRole("button", { name: "创建密钥库", exact: true }).click();
  await page.getByRole("button", { name: "管理分组", exact: true }).click();
  await page.getByLabel("新分组名称", { exact: true }).fill("服务器");
  await page.getByRole("dialog", { name: "管理分组" })
    .getByRole("button", { name: "新建分组", exact: true }).click();
  await expect(page.getByRole("button", { name: "服务器 0", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "服务器 0", exact: true }).click();
  const newEntry = page.locator(".actions").getByRole("button", { name: "新建入口", exact: true });
  await newEntry.click();
  await page.getByLabel("名称", { exact: true }).fill("生产主机");
  await page.getByRole("combobox", { name: "入口类型", exact: true }).selectOption("ssh");
  await page.getByLabel("主机", { exact: true }).fill("prod.example.com");
  await page.getByLabel("端口", { exact: true }).fill("2222");
  await page.getByLabel("私钥文件路径（可选）", { exact: true }).fill("~/.ssh/deploy");
  await page.locator("summary").filter({ hasText: "跳板机与其他选项" }).click();
  await page.getByLabel("跳板机主机（可选）", { exact: true }).fill("bastion.example.com");
  await page.getByLabel("跳板机端口", { exact: true }).fill("2200");
  await page.getByLabel("启用压缩（-C）", { exact: true }).check();
  await page.getByLabel("备注（可选）", { exact: true }).fill("部署服务\n仅限内网");
  await page.getByRole("button", { name: "管理关联密钥", exact: true }).click();
  for (const [title, user] of [["部署账号", "deploy"], ["运维账号", "admin"]]) {
    await page.getByRole("button", { name: "新建密钥", exact: true }).click();
    await page.getByLabel("密钥名称", { exact: true }).fill(title!);
    await page.getByLabel("账号（可选）", { exact: true }).fill(user!);
    await page.getByLabel("密钥值（可选）", { exact: true }).fill(`${user}-secret`);
    await page.getByRole("button", { name: "创建并关联", exact: true }).click();
  }
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "保存入口", exact: true }).click();
  await page.getByRole("button", { name: "所有入口 1", exact: true }).click();
  await page.getByLabel("更多操作 生产主机", { exact: true }).click();
  await expect(page.getByRole("button", { name: "复制入口 生产主机", exact: true })).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.screenshot({ path: testInfo.outputPath("desktop-menu.png") });
  await page.getByRole("button", { name: "复制入口 生产主机", exact: true }).click();
  const duplicate = page.getByRole("dialog", { name: "复制入口", exact: true });
  await expect(duplicate).toBeVisible();
  await expect(page.getByLabel("名称", { exact: true })).toHaveValue("生产主机(副本)");
  await expect(page.getByRole("combobox", { name: "入口类型", exact: true })).toHaveValue("ssh");
  await expect(page.getByRole("combobox", { name: /^分组/ }).locator("option:checked")).toHaveText("服务器");
  await expect(page.getByLabel("主机", { exact: true })).toHaveValue("prod.example.com");
  await expect(page.getByLabel("端口", { exact: true })).toHaveValue("2222");
  await expect(page.getByLabel("私钥文件路径（可选）", { exact: true })).toHaveValue("~/.ssh/deploy");
  await expect(page.getByRole("textbox", { name: "备注（可选）", exact: true })).toHaveValue("部署服务\n仅限内网");
  await expect(duplicate.locator(".linked-key-summary")).toContainText("部署账号 · deploy、运维账号 · admin");
  await page.locator("summary").filter({ hasText: "跳板机与其他选项" }).click();
  await expect(page.getByLabel("跳板机主机（可选）", { exact: true })).toHaveValue("bastion.example.com");
  await expect(page.getByLabel("跳板机端口", { exact: true })).toHaveValue("2200");
  await expect(page.getByLabel("启用压缩（-C）", { exact: true })).toBeChecked();
  await page.getByLabel("主机", { exact: true }).fill("staging.example.com");
  await page.getByRole("button", { name: "保存入口", exact: true }).click();
  await expect(page.getByRole("heading", { name: "生产主机(副本)", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "生产主机", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "服务器 2", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "全部密钥 2", exact: true })).toBeVisible();
  // Both entries still point to the same two keys, rather than creating key copies.
  for (const name of ["生产主机", "生产主机(副本)"]) {
    await expect(page.getByLabel(`${name} 的复制密钥`, { exact: true }).locator("option"))
      .toHaveText(["部署账号 · deploy", "运维账号 · admin"]);
  }
  await page.getByLabel("编辑 生产主机", { exact: true }).click();
  await expect(page.getByLabel("主机", { exact: true })).toHaveValue("prod.example.com");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.reload();
  await page.getByLabel("主密码", { exact: true }).fill("duplicate-test-password");
  await page.getByRole("button", { name: "解锁密钥库", exact: true }).click();
  await page.getByLabel("编辑 生产主机(副本)", { exact: true }).click();
  await expect(page.getByLabel("主机", { exact: true })).toHaveValue("staging.example.com");
  await expect(page.getByRole("combobox", { name: /^分组/ }).locator("option:checked")).toHaveText("服务器");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.getByLabel("更多操作 生产主机(副本)", { exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("mobile-menu.png") });
  await page.getByRole("button", { name: "复制入口 生产主机(副本)", exact: true }).click();
  await expect(page.getByLabel("名称", { exact: true })).toHaveValue("生产主机(副本)(副本)");
  await page.screenshot({ path: testInfo.outputPath("mobile-editor.png") });
  await page.getByRole("button", { name: "保存入口", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "保存入口", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("主机", { exact: true }).fill("discard.example.com");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator(".card")).toHaveCount(2);
  await newEntry.click();
  await expect(page.getByRole("dialog", { name: "新建入口", exact: true })).toBeVisible();
  await expect(page.getByLabel("名称", { exact: true })).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "入口类型", exact: true })).toHaveValue("web");
});
