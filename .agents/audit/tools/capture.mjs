import { chromium } from "playwright-core";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = path.resolve(import.meta.dirname, "..", "shots");
const exeCandidates = [
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe",
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1234\\chrome-win\\chrome.exe",
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe",
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1228\\chrome-win\\chrome.exe",
];
import fs from "node:fs";
const exe = exeCandidates.find((p) => fs.existsSync(p));
if (!exe) { console.error("no chromium found"); process.exit(1); }

const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
const page = await ctx.newPage();

async function shot(name) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: false });
  console.log("shot:", name, "->", page.url());
}
async function fullshot(name) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: true });
  console.log("fullshot:", name, "->", page.url());
}

try {
  // 01 home
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await fullshot("01-home-full");
  await shot("01b-home-viewport");

  // 02 sign-up
  await page.goto(BASE + "/sign-up", { waitUntil: "domcontentloaded" });
  await shot("02-sign-up");

  const email = "audit+" + Date.now() + "@example.com";
  const pw = "AuditPass!2026";
  // try common field names
  const nameField = page.locator('input[name="name"], input[id*="name" i]').first();
  if (await nameField.count()) await nameField.fill("Audit Tester");
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  const pwFields = page.locator('input[type="password"]');
  const n = await pwFields.count();
  for (let i = 0; i < n; i++) await pwFields.nth(i).fill(pw);
  await shot("03-sign-up-filled");
  await page.locator('button[type="submit"], form button').first().click();
  await page.waitForTimeout(2500);
  await shot("04-after-sign-up");

  // 05 catalog = home; go home and open the first product
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const prodLink = page.locator('a[href*="/app/products/"]').first();
  if (await prodLink.count()) {
    await prodLink.click();
    await page.waitForTimeout(1800);
  } else {
    console.log("no product link found on home");
  }
  await fullshot("06-product-detail");

  // 07 add to cart
  const addBtn = page.getByRole("button", { name: /add|ajouter|panier|cart/i }).first();
  if (await addBtn.count()) {
    await addBtn.click();
    await page.waitForTimeout(1200);
  }
  await shot("07-added-to-cart");

  // 08 cart
  await page.goto(BASE + "/app/cart", { waitUntil: "domcontentloaded" });
  await fullshot("08-cart");

  // 09 checkout / place order
  const orderBtn = page.getByRole("button", { name: /checkout|order|commander|passer/i }).first();
  if (await orderBtn.count()) {
    await orderBtn.click();
    await page.waitForTimeout(2500);
  }
  await fullshot("09-after-checkout");

  // 10 orders
  await page.goto(BASE + "/app/orders", { waitUntil: "domcontentloaded" });
  await fullshot("10-orders");

  // 11 order detail
  const orderLink = page.locator('a[href*="/app/orders/"]').first();
  if (await orderLink.count()) {
    await orderLink.click();
    await page.waitForTimeout(1500);
    await fullshot("11-order-detail");
  }

  // 12 account
  await page.goto(BASE + "/app/account", { waitUntil: "domcontentloaded" });
  await fullshot("12-account");

  // 13 sign-in page (fresh context view)
  await page.goto(BASE + "/sign-in", { waitUntil: "domcontentloaded" });
  await shot("13-sign-in");

  console.log("done. account:", email);
} catch (e) {
  console.error("ERROR:", e.message);
  await shot("99-error-state").catch(() => {});
} finally {
  await browser.close();
}
