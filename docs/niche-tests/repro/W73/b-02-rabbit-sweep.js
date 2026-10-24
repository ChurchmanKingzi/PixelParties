'use strict';
// W73b-02 · Cheering Rabbit — Differenz-Sweep über ALLE Normal-Attacks und -Spells (cards.json)
// Welt A ohne, Welt B mit Kaninchen beim wirkenden Helden: der Gesamtschaden an den gegnerischen Zielen muss in B um ein VIELFACHES von 50 größer sein (ein Bonus je Schadensvorgang),
// sobald die Karte in A überhaupt Schaden gemacht hat. Karten ohne Schaden: B = A. Auffälligkeiten (Bonus fehlt / kein Vielfaches / Fehler) werden gelistet.
const H = require('../../lib/h.js');
const fs = require('fs');
const cards = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '../../../../data/cards.json'), 'utf8'));
const KANDIDATEN = cards.filter(c => (c.cardType === 'Attack' || c.cardType === 'Spell') && c.subtype === 'Normal' && !c.banned);
const OHNE_SCHADEN = new Set(['Phoenix Bombardment']);   // HP auf 1 setzen ist Trefferpunkt-Verlust, kein Schaden
const nurFilter = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;

const HERO_HP = 5000;
function schaden(t) {
  let s = 0, gekappt = false;
  for (let hi = 0; hi < 3; hi++) { s += HERO_HP - t.hp(1, hi); if (t.hp(1, hi) <= 0) gekappt = true; }
  for (const [p, hi] of [[1, 0], [1, 1]]) { const k = t.find(H.INERT.big, 'support', p, hi); if (k) s += 1000 - (k.counters.currentHp ?? 1000); else { s += 1000; gekappt = true; } }
  return { s, gekappt };
}
async function welt(name, mitHase) {
  const t = await H.fresh({
    hand: [[name, 'ZZ Filler', 'ZZ Filler'], ['ZZ Filler', 'ZZ Filler']],
    discard: [['ZZ Dummy', 'ZZ Dummy Big', 'ZZ Filler'], ['ZZ Dummy']],
    deckSize: 12, hp: HERO_HP,
  });
  t.grantFor(0, 0, name);
  t.put(1, 0, 0, H.INERT.big); t.put(1, 1, 0, H.INERT.big); t.put(0, 1, 0, H.INERT.creature);
  if (mitHase) t.put(0, 0, 1, 'Cheering Rabbit');
  t.gs.players[0].heroes[0].atk = 100; t.gs.players[0].heroes[0].baseAtk = 100;
  let r, fehler = null;
  try { r = await t.play(0, name, { hero: 0 }); } catch (e) { fehler = String(e && e.message || e); }
  const sc = schaden(t);
  return { t, r, fehler, dmg: sc.s, gekappt: sc.gekappt, errors: t.errors.slice(), hung: t.hung, audit: t.audit() };
}

(async () => {
  const R = H.runner();
  R.section(`Sweep über ${KANDIDATEN.length} Normal-Attacks/-Spells`);
  let n = 0, mitSchaden = 0; const schlecht = [], keinBonus = [], ok = [], kappt = [];
  for (const c of KANDIDATEN) {
    if (nurFilter && !nurFilter.test(c.name)) continue;
    n++;
    let a, b;
    try { a = await welt(c.name, false); b = await welt(c.name, true); }
    catch (e) { schlecht.push(`${c.name}: Aufbau warf ${e.message}`); continue; }
    const probleme = [];
    const neueErr = b.errors.filter(e => !a.errors.includes(e));
    if (neueErr.length) probleme.push('Fehler: ' + neueErr.join(' | ').slice(0, 200));
    if (b.hung && !a.hung) probleme.push('hängt in Welt B');
    if (b.fehler && !a.fehler) probleme.push('Ausnahme: ' + b.fehler);
    const neuAudit = b.audit.filter(x => !a.audit.includes(x));
    if (neuAudit.length) probleme.push('Zustand: ' + neuAudit.join(' | ').slice(0, 200));
    const diff = b.dmg - a.dmg;
    if (a.dmg > 0) {
      mitSchaden++;
      if (a.gekappt || b.gekappt) { kappt.push(c.name); continue; }   // Ziel gestorben: der Schaden ist durch die Trefferpunkte gedeckelt
      if (diff === 0) { if (!OHNE_SCHADEN.has(c.name)) keinBonus.push(`${c.name} (Schaden ${a.dmg})`); }
      else if (c.name === 'Ricochet') ok.push(`Ricochet +${diff} (Kette: Folgetreffer = Hälfte des Vorgängers, kein erneuter Bonus — W49a)`);
      else if (diff % 50 !== 0 || diff < 0) probleme.push(`Differenz ${diff} (A ${a.dmg}, B ${b.dmg})`);
      else ok.push(`${c.name} +${diff}`);
    } else if (diff !== 0) probleme.push(`Schaden ohne Karte? A ${a.dmg}, B ${b.dmg}`);
    if (probleme.length) schlecht.push(`${c.name}: ${probleme.join(' ; ')}`);
  }
  R.check(`Sweep: ${n} Karten, ${schlecht.length} mit Auffälligkeit`, schlecht.length === 0, schlecht.slice(0, 40));
  R.check(`Schaden machende Karten: ${mitSchaden}; ohne Bonus: ${keinBonus.length}`, keinBonus.length === 0, keinBonus.slice(0, 60));
  R.note(`Ziel starb (Betrag gedeckelt, nicht geprüft): ${kappt.join(', ')}`);
  R.note(`Karten mit Bonus: ${ok.length}: ${ok.join(', ')}`);
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
