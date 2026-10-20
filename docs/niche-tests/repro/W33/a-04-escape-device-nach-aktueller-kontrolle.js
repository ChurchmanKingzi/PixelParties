'use strict';
// W33a · Punkt 4 · Al, 22.10.2026: „Escape Device soll, wie **alle** Karten, die 'Hero you control' sagen, nach **aktueller Kontrolle** gehen, also Kontrolleur, nicht Owner."
// Kartentext: „Play this card immediately when a Hero you control would be affected by an Attack or Spell whose level is equal to or lower than the number of "Future Tech Escape Device" cards in your
//   discard pile. Negate all effects (including damage) the Attack or Spell has on that Hero. You can only use 1 "Future Tech Escape Device" on each of your Heroes per turn."
// REGEL: „a Hero you control" = der Held, den der Spieler GERADE kontrolliert (`heroSideOf`): ein übernommener Gegnerheld (dauerhaft/temporär) ja, ein an den Gegner abgegebener eigener Held nein.
//   Die Effekt-Immunität liegt auf der BRETTSEITE des geschützten Helden (`t.owner`), die Einmal-Sperre je Held (Schlüssel `<Seite>:<Index>` für Helden der Gegenspalte, damit sie nicht mit dem gleich
//   indizierten eigenen Helden kollidiert). Zusätzlich geprüft (derselbe Audit): Dream World Switcheroo („a Hero you control is chosen"), Chaorc Interception („a target you control"), MOE Shield
//   („targets you control"), Cute Familiar („a Hero you control with at least Charme 2" – Zusatzaktion).
// Aufruf: node docs/niche-tests/repro/W33/a-04-escape-device-nach-aktueller-kontrolle.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ESC = 'Future Tech Escape Device';
const F = H.INERT.filler;

// h hält Escape Device (hand), o ist der Angreifer; Ablage von h: 2 Escape (Fireball ist Lv 2)
async function aufbau(h, n = 1) {
  const hand = [[], []]; hand[h] = Array(n).fill(ESC);
  const disc = [[], []]; disc[h] = [ESC, ESC, ESC];
  const t = await H.fresh({ hand, discard: disc, deck: [Array(30).fill(F), Array(30).fill(F)], gold: [100, 100], active: 1 - h });
  return t;
}
const quelle = (o) => ({ name: 'Fireball', owner: o, controller: o, heroIdx: 1, cardType: 'Spell' });
const ziel = (t, s, hi) => ({ id: `hero-${s}-${hi}`, type: 'hero', owner: s, heroIdx: hi, cardName: t.hero(s, hi).name });
const fenster = (t, o, ziele) => t.run(() => t.engine._checkPostTargetHandReactions(ziele, quelle(o), { damageType: 'spell', dealsDamage: true, ausZielwahl: true }));
const imm = (t, s, hi) => !!t.engine.hasEffectImmunity(s, hi);

(async () => {
  const R = H.runner();
  for (const h of [0, 1]) {
    const o = 1 - h;

    R.section(`Halter Sitz ${h} · Gegenprobe: eigener Held`);
    { const t = await aufbau(h);
      await fenster(t, o, [ziel(t, h, 0)]);
      R.check('eigener Held h:0 getroffen → Escape Device wirkt (Immunität auf h:0, Karte aus der Hand)', imm(t, h, 0) && !t.pile(h, 'hand').includes(ESC), { imm: imm(t, h, 0), hand: t.pile(h, 'hand') });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Halter Sitz ${h} · Gegnerheld übernommen`);
    for (const art of ['dauerhaft', 'temporaer']) {
      const t = await aufbau(h);
      if (art === 'dauerhaft') await t.run(() => t.engine.actionTakeHeroPermanently(h, o, 0)); else await t.run(() => t.engine.actionStealHero(h, o, 0));
      await sleep(250);
      await fenster(t, o, [ziel(t, o, 0)]);
      R.check(`${art}: übernommener Gegnerheld ${o}:0 getroffen → Escape Device wirkt, Immunität auf der Brettseite ${o}:0`, imm(t, o, 0) && !t.pile(h, 'hand').includes(ESC), { imm: imm(t, o, 0), hand: t.pile(h, 'hand') });
      R.check(`${art}: der gleich indizierte eigene Held ${h}:0 ist NICHT immun`, !imm(t, h, 0), null);
      R.check(`${art}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
    { // echter Spielweg: der Angreifer (anderer Held) zielt mit Fireball auf den übernommenen Helden
      const t = await aufbau(h);
      await t.run(() => t.engine.actionTakeHeroPermanently(h, o, 0)); await sleep(250);
      t.targetFn = (valid) => { const x = valid.find(v => v.type === 'hero' && v.owner === o && v.heroIdx === 0); return x ? [x.id] : [valid[0].id]; };
      t.gs.activePlayer = o; t.phase(3);
      const r = await t.play(o, 'Fireball', { hero: 1 });
      R.check(`Fireball von Sitz ${o} (Held 1) auf den von ${h} übernommenen ${o}:0 → Escape Device negiert, HP bleibt 800`, r === true && t.hp(o, 0) === 800 && !t.pile(h, 'hand').includes(ESC) && t.pile(h, 'discardPile').length === 4, { r, hp: t.hp(o, 0), hand: t.pile(h, 'hand'), abl: t.pile(h, 'discardPile').length });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Halter Sitz ${h} · eigener Held abgegeben`);
    for (const art of ['dauerhaft', 'temporaer']) {
      const t = await aufbau(h);
      if (art === 'dauerhaft') await t.run(() => t.engine.actionTakeHeroPermanently(o, h, 0)); else await t.run(() => t.engine.actionStealHero(o, h, 0));
      await sleep(250);
      await fenster(t, o, [ziel(t, h, 0)]);
      R.check(`${art}: abgegebener eigener Held ${h}:0 getroffen → KEIN Escape Device (er wird nicht kontrolliert), Karte bleibt auf der Hand`, !imm(t, h, 0) && t.pile(h, 'hand').includes(ESC), { imm: imm(t, h, 0), hand: t.pile(h, 'hand') });
      R.check(`${art}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }

    R.section(`Halter Sitz ${h} · Einmal-Sperre je Held (kein Zusammenstoß gleich indizierter Helden)`);
    { const t = await aufbau(h, 3);
      await t.run(() => t.engine.actionTakeHeroPermanently(h, o, 0)); await sleep(250);
      await fenster(t, o, [ziel(t, o, 0)]);
      R.check(`1. Einsatz auf den übernommenen ${o}:0`, imm(t, o, 0) && t.pile(h, 'hand').length === 2, { hand: t.pile(h, 'hand').length });
      await fenster(t, o, [ziel(t, h, 0)]);
      R.check(`2. Einsatz auf den gleich indizierten EIGENEN ${h}:0 ist erlaubt (anderer Held)`, imm(t, h, 0) && t.pile(h, 'hand').length === 1, { hand: t.pile(h, 'hand').length });
      await fenster(t, o, [ziel(t, o, 0)]);
      R.check(`3. Einsatz auf ${o}:0 im selben Zug: gesperrt (1 je Held und Zug), Karte bleibt auf der Hand`, !imm(t, o, 0) && t.pile(h, 'hand').length === 1, { imm: imm(t, o, 0), hand: t.pile(h, 'hand').length });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
  }

  // ── weitere „you control"-Reaktionen, die denselben Fehler hatten (Audit): Dream World Switcheroo, MOE Shield, Chaorc Interception ──
  R.section('Dream World Switcheroo · MOE Shield · Chaorc Interception: getroffener Held nach Kontrolle');
  const sw = H.loadCardEffect('Dream World Switcheroo'), moe = H.loadCardEffect('MOE Shield'), ci = H.loadCardEffect('Chaorc Interception');
  for (const h of [0, 1]) {
    const o = 1 - h;
    for (const art of ['normal', 'abgegeben', 'uebernommen']) {
      const t = await H.fresh({ hand: [[], []], deck: [Array(30).fill(F), Array(30).fill(F)], gold: [100, 100], active: o });
      const tr = t.put(h, 1, 0, H.INERT.creature); tr.counters.attachedHero = 'Gon, the Frostbringer';   // Dream-Lander-Träger (Umlenkziel für Switcheroo)
      t.put(h, 2, 0, 'Chaorc Pyre Grill Master').turnPlayed = 1;                                          // Chaorc als Opfer für Chaorc Interception
      if (art === 'abgegeben') { await t.run(() => t.engine.actionTakeHeroPermanently(o, h, 0)); await sleep(250); }
      if (art === 'uebernommen') { await t.run(() => t.engine.actionTakeHeroPermanently(h, o, 0)); await sleep(250); }
      const [zs, zi] = art === 'uebernommen' ? [o, 0] : [h, 0];
      const ziele = [ziel(t, zs, zi)];
      const q = { name: 'Fireball', owner: o, controller: o, heroIdx: 1, cardType: 'Spell' };
      const soll = art !== 'abgegeben';
      const e = t.engine, g = t.gs;
      R.check(`Switcheroo / Halter ${h} / ${art}: ${soll ? 'bietet sich an' : 'bietet sich NICHT an'}`, !!sw.postTargetCondition(g, h, e, ziele, q, { damageType: 'spell' }) === soll, null);
      R.check(`MOE Shield / Halter ${h} / ${art}: ${soll ? 'bietet sich an' : 'bietet sich NICHT an'}`, !!moe.postTargetCondition(g, h, e, ziele, q) === soll, null);
      R.check(`Chaorc Interception / Halter ${h} / ${art}: ${soll ? 'bietet sich an' : 'bietet sich NICHT an'}`, !!ci.postTargetCondition(g, h, e, ziele, q) === soll, null);
      R.check(`${art}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }

  // ── Cute Familiar: „make a Hero you control with at least Charme 2 perform an additional Action" ──
  R.section('Cute Familiar · Charme-2-Held nach Kontrolle');
  for (const h of [0, 1]) {
    const o = 1 - h;
    const CH2 = [['Charme', 'Charme']];
    for (const art of ['eigen', 'abgegeben', 'uebernommen']) {
      const t = await H.fresh({ hand: [[], []], deck: [Array(30).fill(F), Array(30).fill(F)], gold: [100, 100], active: h });
      const cf = t.put(h, 2, 0, 'Cute Familiar'); cf.turnPlayed = 1;
      if (art === 'eigen') t.setAbilities(h, 0, CH2);
      if (art === 'abgegeben') { t.setAbilities(h, 0, CH2); await t.run(() => t.engine.actionTakeHeroPermanently(o, h, 0)); await sleep(250); }
      if (art === 'uebernommen') { t.setAbilities(o, 0, CH2); await t.run(() => t.engine.actionTakeHeroPermanently(h, o, 0)); await sleep(250); }
      const soll = art !== 'abgegeben';
      R.check(`Cute Familiar / Halter ${h} / Charme-2-Held ${art}: Effekt ${soll ? 'aktivierbar' : 'NICHT aktivierbar'}`, !!t.engine.creatureEffectScriptAllows(cf) === soll, null);
      R.check(`${art}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
