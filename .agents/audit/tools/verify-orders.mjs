import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = path.resolve(import.meta.dirname, "..", "shots");
const exeCandidates = [
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe",
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1234\\chrome-win\\chrome.exe",
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe",
];
const exe = exeCandidates.find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
const page = await ctx.newPage();

async function shot(name) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: false });
  console.log("shot:", name, "->", page.url());
}

try {
  // Fresh account end-to-end
  await page.goto(BASE + "/sign-up", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const email = "audit+" + Date.now() + "@example.com";
  const nameField = page.locator('input[name="name"], input[id*="name" i]').first();
  if (await nameField.count()) await nameField.fill("Audit Tester");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("AuditPass!2026");
  await page.locator('button[type="submit"], form button').first().click();
  await page.waitForTimeout(3000);
  console.log("after sign-up url:", page.url());

  // Buy two different products for a nicer summary
  for (let k = 0; k < 2; k++) {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const links = page.locator('a[href*="/app/products/"]');
    await links.nth(k * 3).click();
    await page.waitForTimeout(1500);
    const addBtn = page.getByRole("button", { name: /add/i }).first();
    if (await addBtn.count()) { await addBtn.click(); await page.waitForTimeout(1000); }
  }
  await page.goto(BASE + "/app/cart", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const orderBtn = page.getByRole("button", { name: /place order/i }).first();
  if (await orderBtn.count()) { await orderBtn.click(); await page.waitForTimeout(3000); }
  await shot("v2-order-detail");

  await page.goto(BASE + "/app/orders", { waitUntil: "domcontentloaded" });
  await shot("v1-orders-list");

  const orderLink = page.locator('a[href*="/app/orders/"]').first();
  if (await orderLink.count()) {
    await orderLink.click();
    await page.waitForTimeout(1800);
    await shot("v2-order-detail");
  }
} catch (e) {
  console.error("ERROR:", e.message);
  await shot("v9-error");
} finally {
  await browser.close();
}
