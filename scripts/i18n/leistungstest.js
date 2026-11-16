// Leistungstest EN vs DE (Start, Spielfeld, Leerlauf bei 6-facher CPU-Drosselung). Voraussetzung: Server auf :3111 (PORT=3111 node server.js), Playwright. Aufruf: RUNS=5 IDLE_MS=8000 node scripts/i18n/leistungstest.js
// Leistungstest: Start (bis Login sichtbar / bis Spielfeld) und Leerlauf auf dem Spielfeld, EN vs DE, CPU 6x gedrosselt.
const { chromium } = require('playwright');
const fs = require('fs');
const RUNS = +process.env.RUNS || 3, IDLE_MS = +process.env.IDLE_MS || 8000;
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
async function one(browser, lang) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await p.addInitScript(l => localStorage.setItem('pp-lang', l), lang);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await cdp.send('Performance.enable');
  const res = {};
  const t0 = Date.now();
  await p.goto('http://localhost:3111/', { waitUntil: 'load' });
  await p.waitForSelector('input[type=password]', { timeout: 60000 });
  res.loginMs = Date.now() - t0;
  res.navTiming = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
  res.transferKB = Math.round((await p.evaluate(() => performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), 0))) / 1024);
  // Gast-Spiel gegen CPU starten
  await p.getByText(/TRY AS GUEST|ALS GAST SPIELEN/).first().click(); await p.waitForTimeout(3500);
  const t1 = Date.now();
  await p.getByText(/Nao, (the|die) Barrier/).first().click(); await p.waitForSelector('[data-hero-owner]', { timeout: 90000 }).catch(() => {});
  res.boardMs = Date.now() - t1;
  await p.waitForTimeout(6000);
  const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const a = await m(); const stat0 = await p.evaluate(() => window.PP_I18N && PP_I18N.stat ? { ...PP_I18N.stat } : null);
  await p.waitForTimeout(IDLE_MS);
  const b = await m(); const stat1 = await p.evaluate(() => window.PP_I18N && PP_I18N.stat ? { ...PP_I18N.stat } : null);
  const d = k => Math.round((b[k] - a[k]) * 1000);
  res.idle = { task: d('TaskDuration'), script: d('ScriptDuration'), layout: d('LayoutDuration'), style: d('RecalcStyleDuration') };
  if (stat1) res.i18n = { calls: stat1.calls - (stat0 ? stat0.calls : 0), mut: stat1.mut - (stat0 ? stat0.mut : 0), ms: Math.round(stat1.ms - (stat0 ? stat0.ms : 0)), maxMs: Math.round(stat1.max) };
  res.heapMB = Math.round(b.JSHeapUsedSize / 1048576);
  await ctx.close(); return res;
}
(async () => {
  const b = await chromium.launch(); const out = { en: [], de: [] };
  for (let i = 0; i < RUNS; i++) for (const l of ['en', 'de']) out[l].push(await one(b, l));
  const med = (arr, f) => { const v = arr.map(f).filter(x => x != null); return v.sort((x, y) => x - y)[Math.floor(v.length / 2)]; };
  for (const l of ['en', 'de']) {
    const r = out[l];
    console.log(l.toUpperCase(), JSON.stringify({ loginMs: med(r, x => x.loginMs), boardMs: med(r, x => x.boardMs), dcl: med(r, x => x.navTiming.dcl), load: med(r, x => x.navTiming.load), transferKB: med(r, x => x.transferKB),
      idle_task_ms: med(r, x => x.idle.task), idle_script_ms: med(r, x => x.idle.script), idle_layout_ms: med(r, x => x.idle.layout), idle_style_ms: med(r, x => x.idle.style), heapMB: med(r, x => x.heapMB), i18n: r[0].i18n }));
  }
  fs.writeFileSync('perf-result.json', JSON.stringify(out, null, 1)); await b.close();
})();
