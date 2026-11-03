import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("website icons load directly after unlock, fall back on failure and refresh after editing", async ({
  page,
  browserName,
}, testInfo) => {
  const icon = await readFile(new URL("../public/icon.svg", import.meta.url));
  const requests: { url: string; referer: string | undefined }[] = [];
  const servers: Server[] = [];
  // Playwright aborts /favicon.ico when request interception is enabled.
  // Real local HTTP servers exercise image loading without interception.
  const serveIcon = async (missing = false) => {
    const server = createServer((request, response) => {
      requests.push({
        url: `http://${request.headers.host}${request.url}`,
        referer: request.headers.referer,
      });
      response.writeHead(missing ? 404 : 200, {
        "Content-Type": missing ? "text/plain" : "image/svg+xml",
        "Cache-Control": "no-store",
      });
      response.end(missing ? "Not found" : icon);
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing icon server address");
    return `http://127.0.0.1:${address.port}`;
  };
  const successOrigin = await serveIcon();
  const missingOrigin = await serveIcon(true);
  const updatedOrigin = await serveIcon();
  try {
    await page.goto("/");
    expect(requests).toHaveLength(0);
    await page.getByLabel("主密码", { exact: true }).fill("icon-test-password");
    await page
      .getByLabel("确认主密码", { exact: true })
      .fill("icon-test-password");
    await page.getByRole("button", { name: "创建密钥库", exact: true }).click();
    for (const [name, url] of [
      ["有图标的网站", `${successOrigin}/private?token=private-query#section`],
      ["无图标的网站", `${missingOrigin}/login`],
    ]) {
      await page
        .locator(".actions")
        .getByRole("button", { name: "新建入口", exact: true })
        .click();
      await page.getByLabel("名称", { exact: true }).fill(name!);
      await page.getByLabel("网站地址", { exact: true }).fill(url!);
      await page.getByRole("button", { name: "保存入口", exact: true }).click();
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
    }
    const success = page.locator(".card").filter({
      has: page.getByRole("heading", { name: "有图标的网站", exact: true }),
    });
    const missing = page.locator(".card").filter({
      has: page.getByRole("heading", { name: "无图标的网站", exact: true }),
    });
    await expect(success.locator(".website-icon img")).toHaveClass("is-loaded");
    expect(
      await success
        .locator(".website-icon img")
        .evaluate((node) => (node as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    await expect(missing.locator(".kind-web > svg")).toBeVisible();
    await expect(missing.locator(".website-icon img")).toHaveCount(0);
    expect(requests).toEqual([
      { url: `${successOrigin}/favicon.ico`, referer: undefined },
      { url: `${missingOrigin}/favicon.ico`, referer: undefined },
    ]);
    if (browserName === "chromium") {
      for (const colorScheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        for (const width of [1440, 320]) {
          await page.setViewportSize({ width, height: 960 });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.screenshot({
            path: testInfo.outputPath(`icons-${colorScheme}-${width}.png`),
            fullPage: true,
          });
        }
      }
    }
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.getByLabel("编辑 无图标的网站", { exact: true }).click();
    await page.getByLabel("网站地址", { exact: true }).fill(updatedOrigin);
    await page.getByRole("button", { name: "保存入口", exact: true }).click();
    await expect(missing.locator(".website-icon img")).toHaveClass("is-loaded");
    const requestCount = requests.length;
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "欢迎回来", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".website-icon img")).toHaveCount(0);
    expect(requests).toHaveLength(requestCount);
    await page.getByLabel("主密码", { exact: true }).fill("icon-test-password");
    await page.getByRole("button", { name: "解锁密钥库", exact: true }).click();
    await expect(success.locator(".website-icon img")).toHaveClass("is-loaded");
    await expect(missing.locator(".website-icon img")).toHaveClass("is-loaded");
  } finally {
    for (const server of servers) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }
});
