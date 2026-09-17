#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 *  WAECHTER: „you may discard X to do Y" gehoert in den Lernkanal
 *  (v1040, Als Regel 12.9.)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Jeder Effekt, bei dem der Spieler freiwillig eine Karte ABWIRFT, um
 * etwas auszuloesen, ist eine Kosten-Entscheidung — und die gehoert in
 * den Kosten-Abwurf-Lernkanal (`costFor` / `costKind`, s. CARD_API).
 * Ohne die Kennzeichnung lernt die CPU fuer genau diese Karte NIE, wann
 * sich die Zahlung lohnt; sie faellt auf eine Faustregel zurueck, die
 * fuer Abwurf-DUELLE geschrieben wurde.
 *
 * Der Waechter liest die Kartentexte, sucht das Muster „discard … to …"
 * und prueft, ob das zugehoerige Skript den Kanal bedient:
 *   • `costFor:` am Prompt (selbst gesetzt), ODER
 *   • `harpyformerDiscardCost(…)` (setzt es fuer die Familie), ODER
 *   • die ausdrueckliche Abmeldung `COST-DISCARD-CHANNEL: n/a`
 *     samt Begruendung im Skript — fuer Faelle, in denen der Abwurf
 *     KEINE frei gewaehlte Kosten ist (erzwungener Abwurf, Abwurf als
 *     Nebenwirkung, Abwurf-Duell).
 *
 * ALTBESTAND: Die Grundlinie (`cost-discard-baseline.json`) haelt die
 * Karten fest, die es beim Einfuehren des Waechters schon gab. Sie
 * duerfen rot bleiben, ohne den Lauf zu faerben — aber NEUE Karten
 * nicht. `--update` schreibt die Grundlinie neu (bewusst, nicht
 * beilaeufig!).
 */
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const KARTEN = path.join(WURZEL, 'data', 'cards.json');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const GRUNDLINIE = path.join(__dirname, 'cost-discard-baseline.json');

const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// „you may discard a Wealth Ability from your hand to gain 5 Gold",
// „discard 2 cards to …" — das Muster ist „abwerfen, UM etwas zu tun".
const MUSTER = /discard [^.]{0,70}?(card|ability|from your hand)[^.]{0,90}? to /i;

const karten = JSON.parse(fs.readFileSync(KARTEN, 'utf8'));
const treffer = [];
for (const c of karten) {
  if (!MUSTER.test(c.effect || '')) continue;
  const datei = path.join(EFFEKTE, slug(c.name) + '.js');
  if (!fs.existsSync(datei)) continue;          // ohne Skript nichts zu pruefen
  const quelle = fs.readFileSync(datei, 'utf8');
  if (/costFor\s*:/.test(quelle)) continue;
  if (/harpyformerDiscardCost\s*\(/.test(quelle)) continue;
  if (/COST-DISCARD-CHANNEL:\s*n\/a/.test(quelle)) continue;
  treffer.push(c.name);
}
treffer.sort();

if (process.argv.includes('--update')) {
  fs.writeFileSync(GRUNDLINIE, JSON.stringify({ bekannt: treffer }, null, 2) + '\n', 'utf8');
  console.log(`[check-cost-discard] Grundlinie neu geschrieben: ${treffer.length} bekannte Karten.`);
  process.exit(0);
}

let bekannt = [];
try { bekannt = JSON.parse(fs.readFileSync(GRUNDLINIE, 'utf8')).bekannt || []; } catch { /* keine Grundlinie */ }
const neu = treffer.filter(n => !bekannt.includes(n));

if (neu.length === 0) {
  console.log(`[check-cost-discard] OK — ${treffer.length} Karte(n) mit Abwurfkosten ohne Kanal, alle in der Grundlinie.`);
  process.exit(0);
}

console.log(`[check-cost-discard] ${neu.length} NEUE Karte(n) mit Abwurfkosten OHNE Lernkanal:\n`);
for (const n of neu) console.log(`  ✗ ${n}`);
console.log(`
  Jeder Effekt nach dem Muster „you may discard X to do Y" muss den
  Kosten-Abwurf-Lernkanal bedienen (CARD_API: „Lernkanal fuer
  ABWURFKOSTEN"):

    const ok = await engine.promptGeneric(pi, {
      type: 'forceDiscardCancellable',
      costFor: CARD_NAME,          // ← Pflicht
      costKind: 'gold',            // ← Sorte der Gegenleistung
      …
    });

  Ist der Abwurf KEINE frei gewaehlte Kosten (erzwungen, Nebenwirkung,
  Abwurf-Duell), im Skript abmelden:

    // COST-DISCARD-CHANNEL: n/a — <Begruendung>

  Altbestand bereinigt? \`node scripts/check-cost-discard.js --update\`.
`);
process.exit(1);
