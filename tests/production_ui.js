const { chromium, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
module.exports = async ({ base, tokens, admin, db }) => {
  const browser = await chromium.launch({ channel: "chromium" });
  const out = path.join(__dirname, "../artifacts/ui");
  fs.mkdirSync(out, { recursive: true });
  try {
    for (const [name, route, cookie] of [
      ["family", "/", tokens["client-b"]],
      ["operations", "/ops/", admin],
      ["partner", "/partner/", tokens["partner-a"]],
    ]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      let failures = [];
      page.on("pageerror", (e) => failures.push(e.message));
      await page.goto(base + route);
      await expect(
        page.getByRole("heading", { name: "Welcome back." }),
      ).toBeVisible();
      await page.screenshot({
        path: path.join(out, `${name}-signin.png`),
        fullPage: true,
      });
      await context.addCookies([
        {
          name: "fh_session",
          value: cookie.split("=")[1],
          url: base,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      await page.reload();
      await expect(
        page.getByRole("heading", {
          name:
            name === "family"
              ? "Your family, cared for."
              : name === "operations"
                ? "Care, coordinated."
                : "Make care personal.",
        }),
      ).toBeVisible();
      await page.screenshot({
        path: path.join(out, `${name}-desktop.png`),
        fullPage: true,
      });
      if (name === "family") {
        await page
          .getByRole("button", { name: "My parents", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Add your first parent" })
          .click();
        await page.getByLabel("Parent’s full name").fill("UI Test Parent");
        await page
          .getByLabel("Phone number", { exact: true })
          .fill("1234567890");
        await page.getByLabel("City / locality").fill("Test City");
        await page.getByLabel("Full home address").fill("Test Home");
        await page.getByLabel("Home latitude").fill("17");
        await page.getByLabel("Home longitude").fill("78");
        await page.getByRole("button", { name: "Save & continue" }).click();
        await expect(
          page.getByRole("heading", { name: "UI Test Parent" }),
        ).toBeVisible();
        // Parent screen uses Add parent; navigate to care requests for booking.
        await page
          .getByRole("button", { name: "Care requests", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Request care", exact: true })
          .click();
        await page
          .locator("select[name=parentId]")
          .selectOption({ label: "UI Test Parent" });
        await page
          .getByLabel("What support is needed?")
          .fill("Pharmacy pickup");
        await page
          .getByLabel("Preferred date and time")
          .fill("2027-01-15T10:00");
        await page
          .getByLabel("Details for your care team")
          .fill("Collect prescription from the local pharmacy.");
        await page.getByRole("button", { name: "Send care request" }).click();
        await expect(
          page.getByRole("heading", { name: "Pharmacy pickup" }),
        ).toBeVisible();
      }
      if (name === "operations") {
        await page
          .getByRole("button", { name: "Care partners", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Review verification" })
          .first()
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.getByRole("button", { name: "Close dialog" }).click();
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Toggle navigation" }).click();
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await expect(page.locator("h1")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      if (overflow) throw Error(`${name}: horizontal mobile overflow`);
      await page.screenshot({
        path: path.join(out, `${name}-mobile.png`),
        fullPage: true,
      });
      if (failures.length) throw Error(failures.join("\n"));
      console.log(
        `PASS ${name}: desktop/mobile, session restoration, navigation, no runtime errors`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }
};
