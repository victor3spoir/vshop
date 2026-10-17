import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3000";
const OUT = path.resolve(import.meta.dirname, "..", "shots");
const exeCandidates = [
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe",
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1234\\chrome-win\\chrome.exe",
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe",
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1228\\chrome-win\\chrome.exe",
];
const exe = exeCandidates.find((p) => fs.existsSync(p));
if (!exe) { console.error("no chromium found"); process.exit(1); }

const browser = await chromium.launch({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
const page = await ctx.newPage();

async function fullshot(name) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: true });
  console.log("fullshot:", name, "->", page.url());
}

try {
  // sign up a fresh account so cart interactions work
  await page.goto(BASE + "/sign-up", { waitUntil: "domcontentloaded" });
  const email = "audit+" + Date.now() + "@example.com";
  const pw = "AuditPass!2026";
  const nameField = page.locator('input[name="name"], input[id*="name" i]').first();
  if (await nameField.count()) await nameField.fill("Audit Tester");
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  const pwFields = page.locator('input[type="password"]');
  const n = await pwFields.count();
  for (let i = 0; i < n; i++) await pwFields.nth(i).fill(pw);
  await page.locator('button[type="submit"], form button').first().click();
  await page.waitForTimeout(2500);

  // open the first product from home
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.locator('a[href*="/app/products/"]').first().click();
  await page.waitForTimeout(1800);
  await fullshot("v3-product-detail");

  // bump quantity to 2 and add to cart
  const inc = page.getByRole("button", { name: /increase quantity/i }).first();
  if (await inc.count()) await inc.click();
  const addBtn = page.getByRole("button", { name: /add to cart|add more/i }).first();
  if (await addBtn.count()) { await addBtn.click(); await page.waitForTimeout(1500); }
  await fullshot("v3-product-detail-added");
} finally {
  await browser.close();
}
