import { expect, test, type Page } from "@playwright/test";

const names = ["研发资源", "生产资源", "个人资源"];
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "管理分组", exact: true });
const rows = (page: Page) => dialog(page).locator(".group-sort-name");
const handle = (page: Page, name: string) =>
  dialog(page).getByRole("button", {
    name: `调整 ${name} 的顺序`,
    exact: true,
  });
const navNames = (page: Page) =>
  page.locator(".desktop-sidebar nav > button > span");
const expectNav = async (page: Page, order: string[]) => {
  await expect(navNames(page)).toHaveText([
    "所有入口",
    "已置顶",
    "全部密钥",
    "默认分组",
    ...order,
  ]);
};

async function setup(page: Page) {
  await page.goto("/");
  await page.getByLabel("主密码", { exact: true }).fill("group-test-password");
  await page
    .getByLabel("确认主密码", { exact: true })
    .fill("group-test-password");
  await page.getByRole("button", { name: "创建密钥库", exact: true }).click();
  if ((page.viewportSize()?.width ?? 1280) <= 760)
    await page.getByRole("button", { name: "打开导航", exact: true }).click();
  await page.getByRole("button", { name: "管理分组", exact: true }).click();
  for (const name of names) {
    await dialog(page).getByLabel("新分组名称", { exact: true }).fill(name);
    await dialog(page)
      .getByRole("button", { name: "新建分组", exact: true })
      .click();
    await expect(rows(page).last()).toHaveText(name);
  }
}

test("dragging and keyboard sorting update navigation and survive unlocking", async ({
  page,
  browserName,
}, testInfo) => {
  await setup(page);
  const source = await handle(page, "个人资源").boundingBox();
  const target = await handle(page, "研发资源").boundingBox();
  if (!source || !target) throw new Error("Missing group handles");
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(dialog(page).getByRole("status")).toContainText("顺序已保存");
  await expect(rows(page)).toHaveText(["默认分组", "个人资源", "研发资源", "生产资源"]);
  await expectNav(page, ["个人资源", "研发资源", "生产资源"]);
  await handle(page, "个人资源").focus();
  await page.keyboard.press("ArrowDown");
  await expect(dialog(page).getByRole("status")).toContainText("第 3 位");
  await expect(rows(page)).toHaveText(["默认分组", "研发资源", "个人资源", "生产资源"]);
  await expect(handle(page, "个人资源")).toBeFocused();
  await expectNav(page, ["研发资源", "个人资源", "生产资源"]);
  if (browserName === "chromium") {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(`groups-${colorScheme}-${width}.png`),
          fullPage: true,
        });
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await dialog(page).getByRole("button", { name: "完成", exact: true }).click();
  await page.reload();
  await page.getByLabel("主密码", { exact: true }).fill("group-test-password");
  await page.getByRole("button", { name: "解锁密钥库", exact: true }).click();
  await expectNav(page, ["研发资源", "个人资源", "生产资源"]);
  await page.getByLabel("管理分组", { exact: true }).click();
  await expect(rows(page)).toHaveText(["默认分组", "研发资源", "个人资源", "生产资源"]);
  await dialog(page).getByLabel("新分组名称", { exact: true }).fill("新增资源");
  await dialog(page)
    .getByRole("button", { name: "新建分组", exact: true })
    .click();
  await expect(rows(page)).toHaveText([
    "默认分组",
    "研发资源",
    "个人资源",
    "生产资源",
    "新增资源",
  ]);
});

test("cancelling a drag restores the order and failed saves can be retried", async ({
  page,
}) => {
  await setup(page);
  const source = await handle(page, "默认分组").boundingBox();
  const target = await handle(page, "个人资源").boundingBox();
  if (!source || !target) throw new Error("Missing group handles");
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 12 },
  );
  await expect(rows(page)).toHaveText([...names, "默认分组"]);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(dialog(page)).toBeVisible();
  await expect(rows(page)).toHaveText(["默认分组", ...names]);
  await expectNav(page, names);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === "vaults") {
        IDBObjectStore.prototype.put = original;
        throw new DOMException("Test storage failure", "QuotaExceededError");
      }
      return key === undefined
        ? original.call(this, value)
        : original.call(this, value, key);
    };
  });
  await handle(page, "默认分组").focus();
  await page.keyboard.press("ArrowDown");
  await expect(dialog(page).getByRole("alert")).toContainText("已恢复原顺序");
  await expect(rows(page)).toHaveText(["默认分组", ...names]);
  await expectNav(page, names);
  await handle(page, "默认分组").focus();
  await page.keyboard.press("ArrowDown");
  await expect(dialog(page).getByRole("status")).toContainText("顺序已保存");
  await expect(navNames(page)).toHaveText([
    "所有入口", "已置顶", "全部密钥", "研发资源", "默认分组", "生产资源", "个人资源",
  ]);
});

test("touch dragging reorders groups on a narrow screen", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Touch gestures use Chromium's input protocol",
  );
  await page.setViewportSize({ width: 320, height: 844 });
  await setup(page);
  const source = await handle(page, "默认分组").boundingBox();
  const target = await handle(page, "个人资源").boundingBox();
  if (!source || !target) throw new Error("Missing group handles");
  const client = await page.context().newCDPSession(page);
  const x = source.x + source.width / 2;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: source.y + source.height / 2 }],
  });
  for (let step = 1; step <= 12; step++) {
    const y =
      source.y +
      source.height / 2 +
      ((target.y + target.height / 2 - (source.y + source.height / 2)) * step) /
        12;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y }],
    });
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(dialog(page).getByRole("status")).toContainText("顺序已保存");
  await expect(rows(page)).toHaveText([...names, "默认分组"]);
  await dialog(page).getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  await expect(page.locator(".mobile-sidebar nav > button > span")).toHaveText([
    "所有入口",
    "已置顶",
    "全部密钥",
    "研发资源",
    "生产资源",
    "个人资源",
    "默认分组",
  ]);
});

test("default group can move between groups and keeps its position and ungrouped entries", async ({
  page,
}) => {
  await setup(page);
  await expect(dialog(page).getByRole("button", { name: "删除分组 默认分组" })).toHaveCount(0);
  const source = await handle(page, "默认分组").boundingBox();
  const target = await handle(page, "个人资源").boundingBox();
  if (!source || !target) throw new Error("Missing group handles");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(dialog(page).getByRole("status")).toContainText("顺序已保存");
  await expect(rows(page)).toHaveText([...names, "默认分组"]);
  await handle(page, "默认分组").press("ArrowUp");
  await expect(dialog(page).getByRole("status")).toContainText("第 3 位");
  await expect(rows(page)).toHaveText(["研发资源", "生产资源", "默认分组", "个人资源"]);
  await dialog(page).getByLabel("新分组名称", { exact: true }).fill("新增资源");
  await dialog(page).getByRole("button", { name: "新建分组", exact: true }).click();
  await expect(rows(page)).toHaveText(["研发资源", "生产资源", "默认分组", "个人资源", "新增资源"]);
  page.once("dialog", (confirm) => confirm.accept());
  await dialog(page).getByRole("button", { name: "删除分组 研发资源", exact: true }).click();
  await expect(rows(page)).toHaveText(["生产资源", "默认分组", "个人资源", "新增资源"]);
  await dialog(page).getByRole("button", { name: "完成", exact: true }).click();
  await page.reload();
  await page.getByLabel("主密码", { exact: true }).fill("group-test-password");
  await page.getByRole("button", { name: "解锁密钥库", exact: true }).click();
  await expect(navNames(page)).toHaveText([
    "所有入口", "已置顶", "全部密钥", "生产资源", "默认分组", "个人资源", "新增资源",
  ]);
  await page.getByRole("button", { name: "默认分组 0", exact: true }).click();
  await page.locator(".actions").getByRole("button", { name: "新建入口", exact: true }).click();
  await expect(page.getByRole("combobox", { name: /^分组/ })).toHaveValue("");
  await page.getByLabel("名称", { exact: true }).fill("默认分组的文档");
  await page.getByLabel("网站地址", { exact: true }).fill("https://example.com/docs");
  await page.getByRole("button", { name: "保存入口", exact: true }).click();
  await expect(page.getByRole("button", { name: "默认分组 1", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "默认分组的文档", exact: true })).toBeVisible();
});
