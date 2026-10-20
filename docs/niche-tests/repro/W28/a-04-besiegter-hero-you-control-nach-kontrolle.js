'use strict';
// W28a · Audit „you control = aktuelle Kontrolle" · Al, 21.10.2026: „'you control' bezieht sich IMMER auf aktuelle Kontrolle, also Kontrolleur und nicht Besitzer."
// „Choose a DEFEATED Hero you control …": Golden Ankh (revive 100 HP), Divine Gift of Equality (revive mit den halben HP eines zweiten Ziels), Soul Transmigration Ritual (3 Level-0-Kreaturen opfern, voll heilen),
// dazu Divine Gift of Sacrifice („Choose ANOTHER Hero you control": Empfänger der Max-HP).
// Regel: angeboten werden die besiegten Helden, die der Spieler GERADE KONTROLLIERT — ein besiegter, an den Gegner abgegebener eigener Held NICHT, ein besiegter übernommener Gegnerheld (dauerhaft/temporär) JA.
//   Wiederbelebt wird der Held auf SEINER Brettseite.
// Aufbau: Sitz 0 mit drei Helden 0:0/0:1/0:2, Sitz 1 mit 1:0 (und 1:1). Zustände des Helden 0:0 bzw. 1:0: normal · abgegeben (dauerhaft / temporär) · übernommen (dauerhaft / temporär); danach wird der Held besiegt (hp 0).
// Aufruf: node docs/niche-tests/repro/W28/a-04-besiegter-hero-you-control-nach-kontrolle.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ZUSTAENDE = ['normal', 'abgegeben-dauerhaft', 'abgegeben-temporaer', 'uebernommen-dauerhaft', 'uebernommen-temporaer'];
const erwartetTot = (z) => (z === 'normal' ? ['0:0'] : z.startsWith('abgegeben') ? [] : (z.startsWith('uebernommen') ? ['0:0', '1:0'] : []));
const adr = (valid) => valid.filter(v => v.type === 'hero').map(v => `${v.owner}:${v.heroIdx}`).sort();
const gleich = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...b].sort());

// Held 0:0 ist in allen Zuständen tot (eigen); in „uebernommen-*" ist zusätzlich der Gegnerheld 1:0 tot und unter meiner Kontrolle.
async function aufbau(karte, z, o = {}) {
  const t = await H.fresh({ hand: [[karte, ...(o.hand || [])], []], deckSize: 30, deck: [Array(30).fill('Fireball'), Array(30).fill('Fireball')] });
  t.setHero(0, 0, 'Fern, the Ship Slave', 800); t.setHero(0, 1, 'Kohta, the Silent Observer', 800); t.setHero(0, 2, 'Fiona, the Princess of the Forgotten', 800);
  t.setHero(1, 0, 'Fern, the Ship Slave', 800); t.setHero(1, 1, 'Kohta, the Silent Observer', 800);
  for (const hi of [1, 2]) if (!o.keinGrant) t.grantFor(0, hi, karte);
  if (o.vorher) o.vorher(t);
  if (z === 'abgegeben-dauerhaft') { await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(250); }
  if (z === 'abgegeben-temporaer') { await t.engine.actionStealHero(1, 0, 0); await sleep(250); }
  if (z === 'uebernommen-dauerhaft') { await t.engine.actionTakeHeroPermanently(0, 1, 0); await sleep(250); }
  if (z === 'uebernommen-temporaer') { await t.engine.actionStealHero(0, 1, 0); await sleep(250); }
  t.gs.players[0].heroes[0].hp = 0;
  if (z.startsWith('uebernommen')) t.gs.players[1].heroes[0].hp = 0;
  return t;
}

const KARTEN = [
  { name: 'Golden Ankh', wirkt: (t, s, h) => t.hp(s, h) === 100 },
  { name: 'Divine Gift of Equality', keinGrant: true, wirkt: (t, s, h) => t.hp(s, h) === 400,   // zweites Ziel: Gegnerheld 1:1 (800 → halbiert 400); der Wirker braucht keine Schule
    zweitesZiel: (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 1); return h ? [h.id] : null; } },
  { name: 'Soul Transmigration Ritual', wirkt: (t, s, h) => t.hp(s, h) === t.hero(s, h).maxHp && t.hp(s, h) > 0,
    vorher: (t) => { for (const [hi, sl] of [[1, 0], [1, 1], [1, 2]]) t.put(0, hi, sl, H.INERT.creature); }, hand: [] },
];

(async () => {
  const R = H.runner();
  for (const k of KARTEN) {
    for (const z of ZUSTAENDE) {
      R.section(`${k.name} · ${z}`);
      const t = await aufbau(k.name, z, k);
      if (k.name === 'Divine Gift of Equality') { /* der Wirker 0:1 hat keine Spell-School-Abilities nötig; Ziel-Held 0:0/1:0 braucht keine */ }
      let angeboten = null;
      t.targetFn = (valid) => {
        if (!valid.some(v => v.type === 'hero')) return valid.filter(v => !v.ineligible).slice(0, 3).map(v => v.id);   // Opferwahl (Soul Transmigration Ritual): 3 Kreaturen
        if (!angeboten) angeboten = adr(valid); return null;
      };
      t.policy.cancelTargets = true;
      const r = await t.play(0, k.name, { hero: 1, phase: undefined });
      const soll = erwartetTot(z);
      if (soll.length === 0) {
        R.check(`${k.name} / ${z}: kein besiegter kontrollierter Held ⇒ Karte nicht spielbar (kein Ziel angeboten)`, angeboten === null && (r === false || t.pile(0, 'hand').includes(k.name)), { angeboten, r });
      } else {
        R.check(`${k.name} / ${z}: angeboten ${soll.join(', ')}`, gleich(angeboten, soll), { angeboten, r });
      }
      R.check(`${k.name} / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
    // Wirkung: übernommener toter Gegnerheld 1:0 wird auf SEINER Brettseite wiederbelebt, der gleich indizierte eigene 0:0 bleibt tot
    for (const z of ['uebernommen-dauerhaft', 'uebernommen-temporaer']) {
      const t = await aufbau(k.name, z, k);
      let n = 0;
      t.targetFn = (valid) => {
        if (!valid.some(v => v.type === 'hero')) return valid.filter(v => !v.ineligible).slice(0, 3).map(v => v.id);   // Opferwahl
        n++; if (k.zweitesZiel && n > 1) return k.zweitesZiel(valid); const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0); return [(h || valid[0]).id]; };
      const r = await t.play(0, k.name, { hero: 1 });
      R.check(`${k.name} / ${z}: der übernommene Gegnerheld 1:0 lebt wieder (Brettseite 1)`, k.wirkt(t, 1, 0), { r, hp10: t.hp(1, 0), max: t.hero(1, 0).maxHp, hp00: t.hp(0, 0) });
      R.check(`${k.name} / ${z}: der eigene gleich indizierte Held 0:0 bleibt tot`, t.hp(0, 0) === 0, t.hp(0, 0));
      R.check(`${k.name} / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
    { const t = await aufbau(k.name, 'normal', k);
      let n = 0;
      t.targetFn = (valid) => {
        if (!valid.some(v => v.type === 'hero')) return valid.filter(v => !v.ineligible).slice(0, 3).map(v => v.id);   // Opferwahl
        n++; if (k.zweitesZiel && n > 1) return k.zweitesZiel(valid); return [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id]; };
      const r = await t.play(0, k.name, { hero: 1 });
      R.check(`${k.name} / normal: der eigene tote Held 0:0 lebt wieder (Gegenprobe)`, k.wirkt(t, 0, 0), { r, hp: t.hp(0, 0) });
      R.check(`${k.name} / normal: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
  }
  R.finish();
})();
