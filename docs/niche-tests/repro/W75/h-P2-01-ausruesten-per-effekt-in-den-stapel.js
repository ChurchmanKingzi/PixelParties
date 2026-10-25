'use strict';
// W75 · Darion — Audit P2: Ausruesten PER EFFEKT (Cool Repair, Treasure Hunter's Backpack, Future Tech Copy Device, Initiation Ritual) bei einem Helden, dessen Equip-Stapel
// schon liegt und dessen uebrige Zonen alle belegt sind. Kartentext Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Cool Repair: „Choose an equippable Artifact from your discard pile and equip it to a Hero you control …"; Backpack: „Search your deck for an Equipment Artifact … equip it …";
// Copy Device: „… this Artifact's name, Cost and effect become that Artifact's …" (als Ausruestung wird sie eine); Initiation Ritual: „Equip [a dead Hero] to a living Hero's free Support Zone."
// Erwartet: die Karte ist spielbar (kein „freie Zone noetig"), landet OBEN im Stapel (kein zweiter Platz), keine Rueckfrage „welches Equip?" fuer den ZIELPLATZ, Zustand sauber.
// Aufruf: node docs/niche-tests/repro/W75/h-P2-01-ausruesten-per-effekt-in-den-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, TU = 'Tushu, the Knowledge Keeper';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite, slot = 1, namen = NAMEN) {
  const ps = t.gs.players[seite];
  ps.supportZones[0][slot] = [];
  return namen.map(n => { ps.supportZones[0][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', 0, slot); i.turnPlayed = 1; return i; });
}
/** Alle uebrigen Zonen von Held 0 belegen: ohne den Stapel gaebe es keinen freien Platz. */
function fuelle(t, seite) { for (const s of [0, 2]) t.put(seite, 0, s, H.INERT.creature); }
const zone = (t) => t.gs.players[0].supportZones[0][1];
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const platzFragen = (t) => t.prompts.filter(p => p.d.type === 'instancePick').length;

(async () => {
  const R = H.runner();
  let t;

  R.section('1) Cool Repair: Equip aus der Ablage in den Stapel (alle Zonen belegt)');
  t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [['Cool Repair'], [F]], discard: [['Glass Sword'], []], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  stapel(t, 0); fuelle(t, 0);
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Glass Sword', source: 'discard' }) });
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.slotIdx === 1)?.id ?? valid[0].id];
  R.check('canActivate trotz voller Zonen', require('../../../../cards/effects/cool-repair.js').canActivate(t.gs, 0, t.engine) === true);
  await t.play(0, 'Cool Repair', { hero: 0 });
  R.check('Glass Sword liegt oben im Stapel, Ablage ohne Glass Sword', JSON.stringify(zone(t)) === JSON.stringify([...NAMEN, 'Glass Sword']) && !t.pile(0, 'discardPile').includes('Glass Sword'), [zone(t), t.pile(0, 'discardPile')]);
  R.check('keine Rueckfrage „welches Equip?" fuer den Zielplatz', platzFragen(t) === 0, t.prompts.map(p => p.d.type));
  R.check('Sauber', sauber(t), [t.errors, t.audit()]);

  R.section("2) Treasure Hunter's Backpack: Equip aus dem Deck in den Stapel (alle Zonen belegt)");
  t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [["Treasure Hunter's Backpack"], [F]], deck: [['Glass Sword', ...Array(10).fill(F)], Array(10).fill(F)], gold: 500 });
  stapel(t, 0); fuelle(t, 0);
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Glass Sword' }) });
  t.targetFn = (valid) => valid.length ? [valid.find(v => v.type === 'equip' && v.slotIdx === 1)?.id ?? valid[0].id] : [];
  R.check('canActivate trotz voller Zonen', require('../../../../cards/effects/treasure-hunter-s-backpack.js').canActivate(t.gs, 0, t.engine) === true);
  await t.play(0, "Treasure Hunter's Backpack", { hero: 0 });
  R.check('Glass Sword liegt oben im Stapel, nicht mehr im Deck', JSON.stringify(zone(t)) === JSON.stringify([...NAMEN, 'Glass Sword']) && !t.pile(0, 'mainDeck').includes('Glass Sword'), [zone(t)]);
  R.check('keine Rueckfrage „welches Equip?" fuer den Zielplatz', platzFragen(t) === 0, t.prompts.map(p => p.d.type));
  R.check('Sauber', sauber(t), [t.errors, t.audit()]);

  R.section('3) Future Tech Copy Device kopiert eine Ausruestung: kommt in den Stapel, faellt zum Zugende wieder ab');
  t = await H.fresh({ active: 0, heroes: [[D, TU, null], [F, null, null]], hand: [['Future Tech Copy Device'], [F]], discard: [['Future Tech Jetpack'], []], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  stapel(t, 0); fuelle(t, 0);
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Future Tech Jetpack', source: 'discard' }) });
  R.check('canActivate trotz voller Zonen', require('../../../../cards/effects/future-tech-copy-device.js').canActivate(t.gs, 0, t.engine) === true);
  await t.play(0, 'Future Tech Copy Device', { hero: 0 });
  R.check('Copy Device liegt oben im Stapel (kein zweiter Platz)', JSON.stringify(zone(t)) === JSON.stringify([...NAMEN, 'Future Tech Copy Device']), zone(t));
  R.check('Sauber', sauber(t), [t.errors, t.audit()]);
  await t.run(() => t.engine._expireBorrowedIdentities());
  R.check('Zugende: nur das Copy Device verlaesst den Stapel, die anderen bleiben', JSON.stringify(zone(t)) === JSON.stringify(NAMEN) && t.pile(0, 'discardPile').includes('Future Tech Copy Device'), [zone(t), t.pile(0, 'discardPile')]);
  R.check('Sauber nach dem Abfall', sauber(t), [t.errors, t.audit()]);

  R.section('3b) Copy Device als erste Ausruestung ohne Stapel, danach ein weiteres Equip: beide teilen den Platz');
  t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [['Future Tech Copy Device', 'Club of Gobbo'], [F]], discard: [['Future Tech Jetpack'], []], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Future Tech Jetpack', source: 'discard' }) });
  await t.play(0, 'Future Tech Copy Device', { hero: 0, slot: 0 });
  await t.play(0, 'Club of Gobbo', { hero: 0, slot: 2 });
  R.check('beide in EINER Zone', t.gs.players[0].supportZones[0].filter(z => z.length).length === 1 && t.gs.players[0].supportZones[0].flat().length === 2, t.gs.players[0].supportZones[0]);
  R.check('Sauber', sauber(t), [t.errors, t.audit()]);

  R.section('4) Initiation Ritual: gefallener Held wird Equip des Darion (Stapel, alle Zonen belegt)');
  t = await H.fresh({ active: 0, heroes: [[D, TU, null], [F, null, null]], hand: [['Initiation Ritual'], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  stapel(t, 0); fuelle(t, 0);
  t.gs.players[0].heroes[1].hp = 0; t.gs.players[0].heroes[1].diedOnTurn = 1;
  t.targetFn = (valid) => valid.length ? [valid.find(v => v.type === 'hero' && v.heroIdx === 1)?.id ?? valid[0].id] : [];
  R.check('canActivate trotz voller Zonen', require('../../../../cards/effects/initiation-ritual.js').canActivate(t.gs, 0, t.engine) === true);
  await t.play(0, 'Initiation Ritual', { hero: 0 });
  R.check('der Gefallene liegt oben im Stapel', JSON.stringify(zone(t)) === JSON.stringify([...NAMEN, TU]), zone(t));
  R.check('Sauber', sauber(t), [t.errors, t.audit()]);

  R.finish();
})();
