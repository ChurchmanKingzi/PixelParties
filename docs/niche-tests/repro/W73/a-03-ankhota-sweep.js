'use strict';
// W73a-03 · Ankhota-Sweep: mit Ankhota auf dem Brett darf KEINE Kreatur-Karte vom Brett in eine Hand gelangen – über keinen Weg.
//   Jede Karte des Spiels (Spells, Attacks, Artefakte, Tränke, Kreatur-Effekte) wird gespielt/aktiviert; Opfer: echte Deepsea-Kreaturen (Bounce-/Swap-Wege) und inerte Kreaturen
//   auf beiden Seiten. Verletzung = ein Opfername steht danach öfter in einer Hand als vorher.
const H = require('../../lib/h.js');
const fs = require('fs');
const path = require('path');
const cards = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../data/cards.json'), 'utf8'));
const CARD = 'Ankhota, the Burier';
const nurFilter = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
const OPFER = ['Deepsea Witch', 'ZZ Dummy', 'ZZ Dummy Big', 'Cute Bird', 'Sparkfly Worker'];

function aufbau(t) {
  t.put(0, 2, 0, CARD);
  const a = t.put(0, 1, 0, 'Deepsea Witch'); a.turnPlayed = 1;
  t.put(0, 0, 1, 'ZZ Dummy');
  t.put(0, 2, 1, 'Cute Bird');
  const b = t.put(1, 0, 0, 'Deepsea Witch'); b.turnPlayed = 1;
  t.put(1, 1, 0, 'ZZ Dummy Big');
  t.put(1, 2, 0, 'Sparkfly Worker');
  t.put(1, 2, 1, 'Cute Bird');
}
const handZaehlung = (t) => {
  const m = {};
  for (let s = 0; s < t.n; s++) for (const n of t.gs.players[s].hand) if (OPFER.includes(n)) m[n] = (m[n] || 0) + 1;
  return m;
};

async function lauf(name, wie) {
  const t = await H.fresh({ hand: [[name, 'ZZ Filler'], ['ZZ Filler', 'ZZ Filler']], discard: [['ZZ Filler'], ['ZZ Filler']], deck: [Array(14).fill('ZZ Filler'), Array(14).fill('ZZ Filler')] });
  aufbau(t);
  const cd = t.DB[name];
  t.grantFor(0, 0, name); t.grantFor(0, 1, name);
  t.gs.players[0].heroes[0].atk = 100;
  let vorHand = handZaehlung(t);
  try {
    if (wie === 'spielen') await t.play(0, name, /Creature/.test(cd.cardType) ? { hero: 1, slot: 0 } : { hero: 0, slot: 2 });   // Kreaturen in den besetzten Platz (Deepsea-Swap)
    else if (wie === 'kreatur') {
      t.put(0, 0, 0, name).turnPlayed = 0;
      vorHand = handZaehlung(t);
      await t.activateCreature(0, 0, 0, {});
    }
    await t.run(() => t.engine._runPostChainActions());
  } catch (e) { /* Ausnahmen beurteilt die Gegenprobe der Engine-Fehler nicht – nur die Hand zählt */ }
  const nach = handZaehlung(t);
  const mehr = Object.keys(nach).filter(n => (nach[n] || 0) > (vorHand[n] || 0));
  return { mehr, ankhotaDa: t.engine.cardInstances.some(c => c.name === CARD && c.zone === 'support'), t };
}

(async () => {
  const R = H.runner();
  R.section('Sweep: keine Kreatur geht mit Ankhota vom Brett auf die Hand');
  const schlecht = []; let n = 0, mitAnkhotaOffen = 0;
  for (const c of cards) {
    if (c.banned || (nurFilter && !nurFilter.test(c.name))) continue;
    const wege = [];
    if (['Spell', 'Attack', 'Artifact', 'Potion'].includes(c.cardType)) wege.push('spielen');
    if (/Creature/.test(c.cardType) && c.name !== CARD) wege.push('spielen', 'kreatur');
    for (const wie of wege) {
      n++;
      let r;
      try { r = await lauf(c.name, wie); } catch (e) { schlecht.push(`${c.name} [${wie}]: Aufbau warf ${String(e.message).slice(0, 80)}`); continue; }
      if (r.ankhotaDa) mitAnkhotaOffen++;
      if (r.ankhotaDa && r.mehr.length) schlecht.push(`${c.name} [${wie}]: auf die Hand gelangt: ${r.mehr.join(', ')}`);
    }
  }
  R.note(`Läufe: ${n}, davon mit noch stehendem Ankhota am Ende: ${mitAnkhotaOffen}`);
  R.check(`keine Kreatur geht trotz Ankhota auf die Hand (${schlecht.length} Verletzungen)`, schlecht.length === 0, schlecht.slice(0, 40));
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
