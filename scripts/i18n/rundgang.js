// Rundgang durch die Hauptbildschirme auf Deutsch, sammelt englische Reste. Voraussetzung: Server auf :3111 und ein Testkonto Tester1/test123 (Anmeldung per Entwicklungs-Mailer-Code). Aufruf: node scripts/i18n/rundgang.js
// Klickt die Hauptbereiche durch (Deutsch) und sammelt englische Reste (Texte ohne Uebersetzung).
const { chromium } = require('playwright');
const fs = require('fs');
const SCREENS = [
  ['ONLINE SPIELEN', 'play'], ['GEGEN CPU', 'cpu'], ['TÄGLICHE HERAUSFORDERUNG', 'daily'], ['RÄTSEL ERSTELLEN', 'puzzle-create'], ['RÄTSEL VERSUCHEN', 'puzzle-browse'],
  ['DECK-EDITOR', 'deck'], ['SHOP', 'shop'], ['PROFIL', 'profile'], ['SPIELANLEITUNG', 'tutorials'],
];
const ENG = /\b(the|of|to|you|your|and|with|for|from|this|that|is|are|will|can|cannot|all|any|each|when|after|before|choose|select|click|play|pack|deck|card|hero|win|lose|gold|level|more|less|no|not|new|back|save|cancel|confirm|delete|buy|open|close|loading|error|failed|please|try|again|empty|none|your|own|owned|equip|equipped|preview|price|free|daily|weekly|reward|rewards|claim|claimed|friends?|chat|online|offline|rank|ranked|settings|profile|name|color|avatar|sleeve|board|skin|skins|shop|search|filter|sort|all)\b/i;
(async () => {
  const b = await chromium.launch(); const result = {};
  for (const [label, tag] of SCREENS) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => localStorage.setItem('pp-lang', 'de'));
    await p.goto('http://localhost:3111/', { waitUntil: 'load' }); await p.waitForTimeout(4000);
    await p.getByPlaceholder('Benutzername oder E-Mail').fill('Tester1'); await p.getByPlaceholder('Passwort').fill('test123');
    await p.getByRole('button', { name: 'ANMELDEN' }).last().click(); await p.waitForTimeout(5000);
    await p.evaluate(() => PP_I18N.miss.clear());
    await p.getByText(label, { exact: true }).first().click({ timeout: 4000 }).catch(e => console.log('klick fehlgeschlagen', label));
    await p.waitForTimeout(3500);
    // zusaetzlich einmal jeden sichtbaren Reiter/Knopf mit kurzem Text anklicken (ausser Kauf/Abmelden/Loeschen)
    const labels = await p.evaluate(() => [...document.querySelectorAll('button, [role=tab]')].filter(e => e.offsetParent).map(e => (e.textContent || '').trim()).filter(t => t && t.length < 28 && !/ABMELDEN|KAUFEN|LÖSCHEN|LOESCHEN|ZURÜCK|SCHLIESSEN|×|✕|ERSTELLEN|SPEICHERN|PROFIL ÄNDERN|ÜBERNEHMEN/i.test(t)));
    for (const t of [...new Set(labels)].slice(0, 14)) { await p.getByText(t, { exact: true }).first().click({ timeout: 1200 }).catch(() => {}); await p.waitForTimeout(700); }
    await p.screenshot({ path: 'crawl-' + tag + '.png' });
    const miss = await p.evaluate(() => { const de = new Set(Object.values(PP_I18N.ui)); const parts = [...Object.values(PP_I18N.ui)]; return [...PP_I18N.miss].filter(t => !de.has(t) && !/^[^A-Za-z]*$/.test(t) && !parts.some(v => v.includes(t))); });
    result[tag] = { englisch: miss.filter(t => ENG.test(t)), uebrige: miss.filter(t => !ENG.test(t)).slice(0, 25), fehler: errs.slice(0, 3) };
    console.log(tag, 'englisch:', result[tag].englisch.length, 'uebrige:', miss.length - result[tag].englisch.length, 'fehler:', errs.length);
    await ctx.close();
  }
  fs.writeFileSync('crawl-result.json', JSON.stringify(result, null, 1)); await b.close();
})();
