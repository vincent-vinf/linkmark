import { expect, test } from "@playwright/test";

test("every palette supports both color modes with readable semantic colors", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "外观", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "外观设置" });
  for (const mode of ["浅色", "深色"]) {
    await settings.getByText(mode, { exact: true }).click();
    for (const name of ["岩墨", "海盐", "松雾", "暖砂"]) {
      await settings.getByText(name, { exact: true }).click();
      const contrasts = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const luminance = (token: string) => {
          const raw = style.getPropertyValue(`--${token}`).trim().slice(1);
          const hex =
            raw.length === 3
              ? [...raw].map((character) => character + character).join("")
              : raw;
          const values = [0, 2, 4].map((offset) => {
            const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
            return value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          });
          return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
        };
        return [
          ["ink", "canvas"],
          ["muted", "canvas"],
          ["muted", "surface"],
          ["muted", "surface-2"],
          ["subtle", "surface"],
          ["rail-ink", "rail"],
          ["rail-muted", "rail"],
          ["rail-ink", "rail-active"],
          ["on-accent", "accent"],
          ["accent", "accent-soft"],
        ].map(([foreground, background]) => {
          const a = luminance(foreground),
            b = luminance(background);
          return {
            foreground,
            background,
            ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          };
        });
      });
      for (const contrast of contrasts)
        expect(
          contrast.ratio,
          `${name}/${mode}: ${contrast.foreground} on ${contrast.background}`,
        ).toBeGreaterThanOrEqual(4.5);
    }
  }
  await settings.getByRole("button", { name: "完成", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "外观", exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "sand");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("system mode follows changes while an explicit mode stays fixed", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "外观", exact: true }).click();
  await page.getByText("浅色", { exact: true }).click();
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByText("跟随系统", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "外观设置" }),
  ).not.toBeVisible();
});

test("legacy and invalid preferences never prevent opening the locked app", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("linkmark-appearance");
    localStorage.setItem("linkmark-theme", "dark");
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.evaluate(() =>
    localStorage.setItem("linkmark-appearance", "{broken"),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "创建你的私人密钥库" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-palette",
    "graphite",
  );
});

test("appearance stays usable with blocked preference storage and keyboard navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "外观", exact: true }).click();
  await page.getByRole("radio", { name: "浅色", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "深色", exact: true }),
  ).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByText("海盐", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "ocean");
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "创建你的私人密钥库" }),
  ).toBeVisible();
});
