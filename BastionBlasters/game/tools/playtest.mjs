// Chromium-Test: node tools/playtest.mjs <url> <outdir> [scenario]
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? '.';
const scenario = process.argv[4] ?? 'watch';
const exe = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/01_menu.png` });
if (scenario === 'watch') {
  await page.getByText('Watch Bot vs Bot').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/02_start.png` });
  await page.keyboard.press('3');
  await page.waitForTimeout(12000);
  await page.screenshot({ path: `${out}/03_battle12.png` });
  await page.waitForTimeout(25000);
  await page.screenshot({ path: `${out}/04_battle37.png` });
}
console.log(errors.slice(0, 20).join('\n') || 'no console errors');
await browser.close();
