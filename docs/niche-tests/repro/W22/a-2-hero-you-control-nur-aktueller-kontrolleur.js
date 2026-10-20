'use strict';
// W22a · Frage 4 aus W21a · Al, 20.10.2026: Karten mit Text „Hero you control“ (Dark Deepsea God, Guard Change, Reincarnation, Deepsea Bats, Layn, Skeleton Necromancer, auch ähnliche):
//   „Nur der aktuelle Kontrolleur, inklusive eines temporären Kontrolleurs“.
// Regel: Diese Karten bieten Zonen/Helden NUR dem aktuellen Kontrolleur eines Helden an (dauerhaft ODER temporär übernommen) — nicht dem Besitzer eines abgegebenen Helden, auch nicht bei temporärer
//   Kontrolle (anders als die zentralen Platzier-Wege, `zonenRechtAmHeld`: W21a, dort darf der Besitzer bei temporärer Kontrolle platzieren). Ist der Ist-Zustand; dieses Repro sichert ihn.
// Aufbau je Zustand des Helden 0 von Sitz 0: 'normal' (Sitz 0 kontrolliert) · 'temporaer' (Sitz 1 hat ihn mit actionStealHero) · 'dauerhaft' (Sitz 1: actionTakeHeroPermanently).
//   Je Sicht (Sitz 0 = Besitzer, Sitz 1 = Gegner/Kontrolleur) wird die Karte benutzt; gemessen wird, ob Zonen des Helden 0:0 (Brettseite 0, Held 0) angeboten werden.
//   Erwartet: angeboten genau dem aktuellen Kontrolleur (normal: Sitz 0; übernommen: Sitz 1). Die Zonen der anderen Helden des Nutzers bleiben immer erreichbar (Kontrollprobe).
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ZUSTAENDE = ['normal', 'temporaer', 'dauerhaft'];
const wer = (z) => (z === 'normal' ? 0 : 1);   // aktueller Kontrolleur des Helden 0:0

async function aufbau(z, o = {}) {
  const t = await H.fresh({ deckSize: 30, active: 0, ...o });
  return t;
}
async function uebernehmen(t, z) {
  if (z === 'temporaer') await t.run(() => t.engine.actionStealHero(1, 0, 0));
  else if (z === 'dauerhaft') await t.run(() => t.engine.actionTakeHeroPermanently(1, 0, 0));
  await sleep(200);
}
const zonenDavon = (zonen, nutzer) => (zonen || []).filter(x => (x.owner ?? nutzer) === 0 && x.heroIdx === 0).length;
const eigene = (zonen, nutzer, seite, hi) => (zonen || []).filter(x => (x.owner ?? nutzer) === seite && x.heroIdx === hi).length;
// bevorzugt eine Zone des Helden 0:0 (falls angeboten), sonst die erste — so wird bei Übernahme wirklich seitenfremd gelegt
const nimmZiel00 = (d, nutzer) => { const z = d.zones.find(x => (x.owner ?? nutzer) === 0 && x.heroIdx === 0) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; };
const nimmErste = (d) => { const z = d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; };

/** Prüft ein Fenster: `angebot(sicht, zustand)` → Zonenliste, die dem Nutzer angeboten wurde (oder null = nichts angeboten). */
function pruefe(R, name, zustand, sicht, zonen, nutzerEigeneErwartet) {
  const erwartet = wer(zustand) === sicht;
  const n = zonenDavon(zonen, sicht);
  R.check(`${name} / Held 0:0 ${zustand} / Sicht Sitz ${sicht} (${sicht === 0 ? 'Besitzer' : 'Gegner'}): Zonen des Helden 0:0 ${erwartet ? 'angeboten' : 'NICHT angeboten'}`, erwartet ? n > 0 : n === 0, { n, zonen: (zonen || []).map(z => `${z.owner ?? sicht}:${z.heroIdx}:${z.slotIdx}`) });
  if (nutzerEigeneErwartet) R.check(`${name} / ${zustand} / Sicht Sitz ${sicht}: Kontrollprobe - Zonen des eigenen Helden ${nutzerEigeneErwartet.hi} bleiben angeboten`, eigene(zonen, sicht, sicht, nutzerEigeneErwartet.hi) > 0, (zonen || []).map(z => `${z.owner ?? sicht}:${z.heroIdx}:${z.slotIdx}`));
}

(async () => {
  const R = H.runner();

  // ── Skeleton Necromancer (Aktivierung: Karte abwerfen, Skelett aus der Ablage in die freie Zone eines Helden, den ich kontrolliere) ──
  for (const z of ZUSTAENDE) for (const sicht of [0, 1]) {
    R.section(`Skeleton Necromancer · Held 0:0 ${z} · Sicht Sitz ${sicht}`);
    const t = await aufbau(z, { hand: [[H.INERT.filler], [H.INERT.filler]], discard: [['Skeleton Bard'], ['Skeleton Bard']] });
    await uebernehmen(t, z);
    t.put(sicht, 1, 0, 'Skeleton Necromancer').turnPlayed = 1;
    t.gs.activePlayer = sicht; t.phase(2);
    let zonen = null;
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Skeleton Bard' }) });
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { zonen = d.zones.slice(); return nimmErste(d); } });
    await t.activateCreature(sicht, 1, 0);
    pruefe(R, 'Skeleton Necromancer', z, sicht, zonen, { hi: 1 });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Layn, Master of Deri's Relic (Heldeneffekt: bis zu 3 Stufe-1-Kreaturen gleichen Namens aus der Ablage in freie Zonen von Helden, die ich kontrolliere) ──
  const LM = "Layn, Master of Deri's Relic";
  for (const z of ZUSTAENDE) for (const sicht of [0, 1]) {
    R.section(`Layn, Master of Deri's Relic · Held 0:0 ${z} · Sicht Sitz ${sicht}`);
    const heroes = [[H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]], [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
    heroes[sicht][1] = LM;
    const t = await aufbau(z, { heroes, discard: [['Treasure Skeleton', 'Treasure Skeleton', 'Treasure Skeleton'], ['Treasure Skeleton', 'Treasure Skeleton', 'Treasure Skeleton']] });
    await uebernehmen(t, z);
    let zonen = null;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === LM, answer: () => ({ cardName: 'Treasure Skeleton' }) });
    t.script.push({ match: d => /zone/i.test(d.type || ''), answer: (d) => { if (!zonen) zonen = (d.zones || d.options || []).slice(); return nimmErste({ zones: d.zones || d.options }); } });
    await t.activateHero(sicht, 1, { effect: LM });
    pruefe(R, 'Layn', z, sicht, zonen, { hi: sicht === 0 ? 2 : 2 });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Deepsea Bats (On-Summon: Deepsea-Kreatur Stufe <= 1 aus der Ablage in die freie Zone eines Helden, den ich kontrolliere) ──
  for (const z of ZUSTAENDE) for (const sicht of [0, 1]) {
    R.section(`Deepsea Bats · Held 0:0 ${z} · Sicht Sitz ${sicht}`);
    const t = await aufbau(z, { hand: [['Deepsea Bats'], ['Deepsea Bats']], discard: [['Deepsea Zombie'], ['Deepsea Zombie']] });
    await uebernehmen(t, z);
    let zonen = null;
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: 'Deepsea Zombie' }) });
    t.script.push({ match: d => d.type === 'zonePick' && /Deepsea Bats/.test(d.title || ''), answer: (d) => { zonen = d.zones.slice(); return nimmErste(d); } });
    t.gs.activePlayer = sicht;
    const r = await t.play(sicht, 'Deepsea Bats', { hero: 1 });
    R.check('Bats gespielt', r === true && !!t.find('Deepsea Bats', 'support'), r);
    pruefe(R, 'Deepsea Bats', z, sicht, zonen, { hi: 1 });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Guard Change (Kreaturen, die ich kontrolliere, in freie Zonen ANDERER Helden, die ich kontrolliere) ──
  for (const z of ZUSTAENDE) for (const sicht of [0, 1]) {
    R.section(`Guard Change · Held 0:0 ${z} · Sicht Sitz ${sicht}`);
    const t = await aufbau(z, { hand: [['Guard Change'], ['Guard Change']] });
    await uebernehmen(t, z);
    const X = t.put(sicht, 2, 0, H.INERT.big); X.counters.currentHp = 1000; X.counters.maxHp = 1000;
    t.engine.isCpuPlayer = () => false;
    let zonen = null;
    t.script.push({ match: d => d.type === 'guardChangeMove', answer: (d) => { zonen = (d.creatures || []).flatMap(c => c.dests || []); return { done: true }; } });
    t.gs.activePlayer = sicht;
    await t.play(sicht, 'Guard Change', { hero: 1 });
    pruefe(R, 'Guard Change', z, sicht, zonen, { hi: 1 });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Reincarnation, Kreatur-Zweig (Kreatur Stufe <= 4 aus der Ablage in die freie Zone eines Helden, den ich kontrolliere) ──
  for (const z of ZUSTAENDE) for (const sicht of [0, 1]) {
    R.section(`Reincarnation (Kreatur) · Held 0:0 ${z} · Sicht Sitz ${sicht}`);
    const t = await aufbau(z, { hand: [['Reincarnation'], ['Reincarnation']], discard: [['Deepsea Zombie'], ['Deepsea Zombie']] });
    await uebernehmen(t, z);
    let zonen = null;
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Deepsea Zombie' }) });
    t.script.push({ match: d => d.type === 'zonePick' && /Reincarnation/.test(d.title || ''), answer: (d) => { zonen = d.zones.slice(); return nimmErste(d); } });
    t.gs.activePlayer = sicht;
    const r = await t.play(sicht, 'Reincarnation', { hero: 1 });
    R.check('Reincarnation gespielt', r === true && !!t.find('Deepsea Zombie', 'support'), { r, hand: t.pile(sicht, 'hand') });
    pruefe(R, 'Reincarnation', z, sicht, zonen, { hi: 1 });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Staff of Illusions („…place it into the Support Zone of any Hero you control“) ──
  for (const z of ZUSTAENDE) for (const sicht of [0, 1]) {
    R.section(`Staff of Illusions · Held 0:0 ${z} · Sicht Sitz ${sicht}`);
    const t = await aufbau(z, { hand: [['Staff of Illusions', H.INERT.creature], ['Staff of Illusions', H.INERT.creature]], gold: [100, 100] });
    await uebernehmen(t, z);
    let zonen = null;
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: (d.cards[0].name || d.cards[0]), source: d.cards[0].source }) });
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { zonen = d.zones.slice(); return nimmZiel00(d, sicht); } });
    t.gs.activePlayer = sicht;
    const r = await t.play(sicht, 'Staff of Illusions', { hero: 1 });
    const ill = t.find(H.INERT.creature, 'support');
    R.check('Staff gespielt, die Illusion steht und gehört/wird kontrolliert vom Nutzer', !!ill && (ill.controller ?? ill.owner) === sicht, { r, hand: t.pile(sicht, 'hand') });
    if (wer(z) === sicht) R.check('seitenfremd/eigen gelegt: die Illusion steht in der Zone des Helden 0:0', !!ill && ill.heroIdx === 0 && t.engine.physicalSide(ill) === 0, ill && { h: ill.heroIdx, s: t.engine.physicalSide(ill) });
    pruefe(R, 'Staff of Illusions', z, sicht, zonen, { hi: 1 });
    await t.endTurn(); await t.endTurn();
    R.check('Rückkehr der Illusion ins Deck des Nutzers (auch seitenfremd), Zustand sauber', !t.find(H.INERT.creature, 'support') && t.pile(sicht, 'mainDeck').includes(H.INERT.creature), { deck: t.pile(sicht, 'mainDeck').includes(H.INERT.creature) });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Cloudy Slime („…place a level 0 Creature from your hand into the free Support Zone of any Hero you control“) ──
  for (const z of ZUSTAENDE) for (const sicht of [0, 1]) {
    R.section(`Cloudy Slime · Held 0:0 ${z} · Sicht Sitz ${sicht}`);
    const t = await aufbau(z, { hand: [['Cloudy Slime', H.INERT.creature], ['Cloudy Slime', H.INERT.creature]] });
    await uebernehmen(t, z);
    let zonen = null;
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: (d.cards[0].name || d.cards[0]) }) });
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { if (!zonen) zonen = d.zones.slice(); return nimmZiel00(d, sicht); } });
    t.gs.activePlayer = sicht;
    const r = await t.play(sicht, 'Cloudy Slime', { hero: 1 });
    const platziert = t.find(H.INERT.creature, 'support');
    R.check('Slime gespielt, die platzierte Kreatur wird vom Nutzer kontrolliert', !!t.find('Cloudy Slime', 'support') && !!platziert && (platziert.controller ?? platziert.owner) === sicht, { r, pr: t.prompts.map(p => p.d.type) });
    if (wer(z) === sicht) R.check('die Kreatur steht in der Zone des Helden 0:0 (Brettseite 0)', !!platziert && platziert.heroIdx === 0 && t.engine.physicalSide(platziert) === 0, platziert && { h: platziert.heroIdx, s: t.engine.physicalSide(platziert) });
    pruefe(R, 'Cloudy Slime', z, sicht, zonen, { hi: 1 });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Dark Deepsea God (Tribut: Kreaturen zurück auf die Hand, DDG steigt in EINE der freiwerdenden Zonen — nur eines Helden, den ich kontrolliere) ──
  for (const z of ZUSTAENDE) for (const sicht of [0, 1]) {
    R.section(`Dark Deepsea God · Held 0:0 ${z} · Sicht Sitz ${sicht}`);
    const t = await aufbau(z, { hand: [['Dark Deepsea God'], ['Dark Deepsea God']] });
    await uebernehmen(t, z);
    // Tribute: eine Kreatur in der Zone des Helden 0:0 (kontrolliert vom Nutzer) und eine bei einem anderen, immer kontrollierten Helden des Nutzers
    const a = t.put(0, 0, 0, 'Deepsea Succubus'); if (sicht === 1) t.engine.markiereSeitenfremd(a, 1);   // gehört/steht bei Sitz 0, vom Nutzer (Sitz 1) kontrolliert
    const b = t.put(sicht, 1, 0, 'Deepsea Reaper');
    a.turnPlayed = 1; b.turnPlayed = 1;
    if (sicht === 1 && z === 'normal') { /* Held 0:0 gehört dem Gegner: die Kreatur dort ist gestohlen/seitenfremd und kein Tribut des Nutzers */ }
    t.gs.turn = 5;
    let zonen = null;
    t.targetFn = (valid) => valid.filter(x => x.type === 'equip').map(x => x.id);
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { zonen = d.zones.slice(); const x = d.zones.find(q => (q.owner ?? sicht) === 0 && q.heroIdx === 0) || d.zones[0]; return { heroIdx: x.heroIdx, slotIdx: x.slotIdx, owner: x.owner }; } });
    t.gs.activePlayer = sicht;
    const r = await t.play(sicht, 'Dark Deepsea God', { hero: 1, slot: 0, noGrant: true });
    R.check('DDG gespielt', r === true && !!t.find('Dark Deepsea God', 'support'), { r, hand: t.pile(sicht, 'hand') });
    const x = zonen;
    if (z === 'normal' && sicht === 1) { /* ohne eigene Zone 0:0 kein Angebot dort; der Nutzer hat keinen Tribut bei 0:0 */ }
    if (wer(z) === sicht) pruefe(R, 'Dark Deepsea God', z, sicht, x, null);
    else R.check(`Dark Deepsea God / Held 0:0 ${z} / Sicht Sitz ${sicht}: Zone des Helden 0:0 NICHT angeboten`, zonenDavon(x, sicht) === 0, (x || []).map(q => `${q.owner ?? sicht}:${q.heroIdx}:${q.slotIdx}`));
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  // ── Ähnliche Karten (Kartentext „… Support Zone of any Hero you control“): Lone Survivor (Teal Fishing Rod und The Master's Key lesen schon `heroesControlledBy`, nur gelesen) ──
  const AEHNLICH = [
    ['Lone Survivor', { discard: ['ZZ Dummy'] }, {}],
  ];
  for (const [karte, pile] of AEHNLICH) for (const z of ZUSTAENDE) for (const sicht of [0, 1]) {
    R.section(`${karte} · Held 0:0 ${z} · Sicht Sitz ${sicht}`);
    const hand = [[], []]; hand[sicht] = [karte, ...(pile.hand || [])];
    const disc = [[], []]; disc[sicht] = pile.discard || [];
    const t = await aufbau(z, { hand, discard: disc });
    await uebernehmen(t, z);
    let zonen = null;
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: (d.cards[0].name || d.cards[0]), source: d.cards[0].source }) });
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { zonen = d.zones.slice(); return nimmErste(d); } });
    t.gs.activePlayer = sicht;
    const r = await t.play(sicht, karte, { hero: 1 });
    R.check(`${karte}: Zonenwahl beobachtet`, !!zonen, { r, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });
    if (zonen) pruefe(R, karte, z, sicht, zonen, { hi: 1 });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
