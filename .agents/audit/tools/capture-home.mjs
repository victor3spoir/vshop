import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3000";
const OUT = path.resolve(import.meta.dirname, "..", "shots");
const exeCandidates = [
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe",
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1234\\chrome-win\\chrome.exe",
];
const exe = exeCandidates.find((p) => fs.existsSync(p));
if (!exe) { console.error("no chromium"); process.exit(1); }
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1024 } })).newPage();
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, "v3-home-full.png"), fullPage: true });
console.log("shot:", page.url());
await browser.close();
