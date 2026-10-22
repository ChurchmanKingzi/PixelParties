'use strict';
// W53a · Punkt 3 (Al, 22.10.2026): „Der ATK-Bonus soll nur exakt der aktuelle Träger haben, und er soll pro Equip-Instanz exakt einmal hinzugefügt sein. Das gilt für alle ATK-gebenden Equips."
//   Anlass: Future Tech Gun gibt beim erneuten Anlegen nach dem Zerstören +40 ATK am Riffel-Träger. Befund: Das ist der Kartentext („40 times the number of 'Future Tech Gun' cards in your discard pile":
//   die zerstörte Kopie liegt in der Ablage) — kein Doppelbuchen; siehe Abschnitt (C).
// Alle 21 ATK-Stat-Equips (19 feste Boni + Ancient Tech Infinite Energy Core + Future Tech Gun):
//   Blade of the Frostbringer, Blade of the Swamp Witch, Club of Gobbo, Earth-Shattering Hammer, Explosivo's Sword, Future Tech Laser Cannon, Heart-Shaped Bow, Legendary Sword of a Barbarian King,
//   Lunatic Cycle - Full Moon, Mana-Consuming Blade, Modnir, Phalanx Pike, Sacred Hammer of the Volcano, Shattered Trident, Super-Killing Knife, The Hands of Big Gwen, The Master's Sword, The Sun Sword,
//   Vampiric Sword, Ancient Tech Infinite Energy Core (10 je Namen in der Ablage), Future Tech Gun (40 je Gun in der Ablage).
// Differenz-Test (beide Sitze): nach JEDER Sequenz hat jeder Held genau den ATK, den ein direkt so ausgerüsteter Held hätte (Grundwert + Summe der Boni der Karten, die JETZT an ihm liegen):
//   direkt · Slippery Fridge hin und zurück · Inheritance Ceremony · zerstört + neue Kopie · zurück auf die Hand + an anderem Helden · zwei Kopien (h0/h1, h0/h0) ·
//   Wirt besiegt + wiederbelebt · Seitenwechsel (Cybug-LOCUST-Weg, `actionTransferAttachment`) und zurück · am Gegnerhelden ausgerüstet.
// Weitere Wege (Fluch, Status am Wirt, Charme, Mechanik des Bausteins `actionSetAtkGrant`): a-04. Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });

const STATIC = {
  'Blade of the Frostbringer': 10, 'Blade of the Swamp Witch': 10, 'Club of Gobbo': 30, 'Earth-Shattering Hammer, Relic of Deri': 10,
  "Explosivo's Sword": 10, 'Future Tech Laser Cannon': 100, 'Heart-Shaped Bow, the Final Proof of Cuteness': 10, 'Legendary Sword of a Barbarian King': 10,
  'Lunatic Cycle - Full Moon': 100, 'Mana-Consuming Blade': 10, 'Modnir, Hammer of Coolness': 100, 'Phalanx Pike': 30, 'Sacred Hammer of the Volcano': 30,
  'Shattered Trident, Treasure of the Deepsea': 10, 'Super-Killing Knife, the Tool of Liquidation': 10, 'The Hands of Big Gwen': 10, "The Master's Sword": 10,
  'The Sun Sword': 20, 'Vampiric Sword': 10,
};
const DYN = {
  'Ancient Tech Infinite Energy Core': (t, c) => 10 * new Set((t.gs.players[c.controller ?? c.owner].discardPile || []).map(n => n.replace(/\s*\(.*\)$/, ''))).size,
  'Future Tech Gun': (t, c) => 40 * (t.gs.players[c.controller ?? c.owner].discardPile || []).filter(n => n === 'Future Tech Gun').length,
};
const ALL = [...Object.keys(STATIC), ...Object.keys(DYN)];
const GUN = 'Future Tech Gun';

/** Erwarteter ATK eines Helden: Grundwert + Boni der Karten, die jetzt in seinen Support Zonen liegen. */
function erwartet(t, s, hi) {
  const h = t.gs.players[s].heroes[hi]; if (!h || !h.name) return null;
  if (h.statuses && h.statuses.cursed) return 0;
  let a = t.DB[h.name].atk || 0;
  for (const c of t.engine.cardInstances) {
    if (c.zone !== 'support' || t.engine.physicalSide(c) !== s || c.heroIdx !== hi) continue;
    if (STATIC[c.name] != null) a += STATIC[c.name]; else if (DYN[c.name]) a += DYN[c.name](t, c);
  }
  return a;
}
function pruefe(t) {
  const bad = [];
  for (let s = 0; s < 2; s++) for (let hi = 0; hi < 3; hi++) {
    const e = erwartet(t, s, hi); if (e == null) continue;
    const h = t.gs.players[s].heroes[hi];
    if (h.hp > 0 && h.atk !== e) bad.push(`S${s}H${hi} ${h.name.split(',')[0]}: atk ${h.atk} != erwartet ${e}`);
  }
  // Buchführung: jede Instanz in einer Support Zone trägt höchstens ihren Zielwert und einen Stempel, der auf IHREN Träger zeigt
  for (const c of t.engine.cardInstances) {
    if (STATIC[c.name] == null && !DYN[c.name]) continue;
    const ag = c.counters && c.counters.atkGranted || 0, st = c.counters && c.counters._atkTraeger;
    if (c.zone !== 'support') { if (ag) bad.push(`verwaiste Buchung ${c.name} (${c.zone}): ${ag}`); continue; }
    const hero = t.gs.players[t.engine.physicalSide(c)].heroes[c.heroIdx];
    if (ag > 0 && hero && hero.hp > 0 && !hero.statuses.cursed && (!st || st.seite !== t.engine.physicalSide(c) || st.heroIdx !== c.heroIdx)) bad.push(`Stempel ${c.name}: ${JSON.stringify(st)} != Träger ${t.engine.physicalSide(c)}/${c.heroIdx}`);
  }
  return bad;
}

async function aufbau(me, name, extraHand = []) {
  const t = await U.fresh(me, { hand: extraHand });
  if (name === 'Lunatic Cycle - Full Moon') t.put(me, 2, 0, 'Lunatic Cycle - Gibbous Moon');
  return t;
}
async function lege(t, me, name, hi, slot) {
  if (name === 'Modnir, Hammer of Coolness') {   // nur aus dem Coolness Stack spielbar: wie `actionTransferAttachment` einsetzen und `onPlay` feuern
    const s = slot ?? t.gs.players[me].supportZones[hi].findIndex(z => z.length === 0);
    const inst = t.put(me, hi, s, name);
    await t.run(() => t.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, card: inst, cardName: name, zone: 'support', heroIdx: hi, zoneSlot: s, _skipReactionCheck: true }));
    return inst;
  }
  const r = await U.lege(t, me, name, hi, slot);
  return t.inst(c => c.name === name && c.zone === 'support' && c.heroIdx === hi)[0] || { fail: r };
}

(async () => {
  const R = U.H.runner();
  for (const me of [0, 1]) {
    const op = 1 - me;
    R.section(`Sitz ${me}: ${ALL.length} ATK-Equips × Wege`);
    for (const name of ALL) {
      const fehler = [];
      const chk = (wid, t) => { const b = pruefe(t); if (t.errors.length) b.push('ERR ' + t.errors[0]); if (b.length) fehler.push(wid + ': ' + b.join('; ')); };
      const zerstoere = (t, i) => t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: op }, i, {}));

      { const t = await aufbau(me, name); const i = await lege(t, me, name, 0); if (i.fail !== undefined) fehler.push('direkt nicht legbar ' + JSON.stringify(i.fail)); chk('direkt', t); }
      { const t = await aufbau(me, name); await lege(t, me, name, 0); t.reset();
        await U.bewege(t, me, 'fridge', { name, nach: 1 }); chk('Fridge h0→h1', t);
        t.reset(); await U.bewege(t, me, 'fridge', { name, nach: 0 }); chk('Fridge zurück h1→h0', t); }
      { const t = await aufbau(me, name); await lege(t, me, name, 0); t.reset(); await U.bewege(t, me, 'ceremony', { name, nach: 1 }); chk('Ceremony h0→h1', t); }
      { const t = await aufbau(me, name, [name]); const i = await lege(t, me, name, 0); t.reset();
        await zerstoere(t, i); chk('zerstört', t); await lege(t, me, name, 0); chk('zerstört + neue Kopie', t); }
      { const t = await aufbau(me, name); const i = await lege(t, me, name, 0); t.reset();
        await t.run(() => t.engine.actionMoveCard(i, 'hand', -1, -1, { source: 'Test', sourceOwner: op })); chk('zurück auf die Hand', t);
        await lege(t, me, name, 1); chk('Hand → neu an h1', t); }
      { const t = await aufbau(me, name, [name]); await lege(t, me, name, 0); await lege(t, me, name, 1); chk('zwei Kopien h0/h1', t); }
      { const t = await aufbau(me, name, [name]); await lege(t, me, name, 0); await lege(t, me, name, 0); chk('zwei Kopien h0/h0', t); }
      { const t = await aufbau(me, name); await lege(t, me, name, 0); t.reset();
        await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: op }, t.hero(me, 0), 5000, 'attack')); chk('Wirt besiegt', t);
        await t.run(() => t.engine.actionReviveHero(me, 0, 100, { source: 'Test' })); chk('wiederbelebt', t); }
      { const t = await aufbau(me, name); const i = await lege(t, me, name, 0); t.reset();
        const r = await t.run(() => t.engine.actionTransferAttachment(i, op, 0, 0, { sourceName: 'Test', anleger: op }));
        chk('Seitenwechsel zum Gegnerhelden' + (r && r.success ? '' : ' (abgelehnt ' + JSON.stringify(r) + ')'), t);
        if (r && r.success) { t.reset(); await t.run(() => t.engine.actionTransferAttachment(i, me, 1, 0, { sourceName: 'Test', anleger: me })); chk('Seitenwechsel zurück an h1', t); } }
      { const t = await aufbau(me, name); await t.play(me, name, { hero: 0, targetOwner: op, active: me }); chk('am Gegnerhelden ausgerüstet', t); }
      R.check(`${name}: jede Sequenz == direkt ausgerüstet (ATK aller Helden beider Sitze, Buchführung, Stempel)`, fehler.length === 0, fehler);
    }

    // ═══ (C) Future Tech Gun und Riffel: +40 beim erneuten Anlegen ist der Kartentext ═══
    //   Riffel („equip it … from your deck") legt nach dem Zerstören eine zweite Gun an: in der Ablage liegt 1 Gun → +40. Differenz zu „direkt so angelegt": gleiche Ablage, Gun direkt aus der Hand.
    { const RIF = 'Future Tech Gunslinger Riffel';
      const t = await U.fresh(me, { hand: [GUN], heroes: { [me]: [RIF, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] }, opts: { deckSize: 20 } });
      t.setDeck(me, [GUN, 'ZZ Dummy', 'ZZ Dummy', GUN]);
      const basis = t.DB[RIF].atk;
      await U.lege(t, me, GUN, 0);
      R.check('Riffel+Gun: Gun angelegt, Ablage leer → kein Bonus (0 Guns in der Ablage)', t.hero(me, 0).atk === basis, t.hero(me, 0).atk);
      const i = t.find(GUN, 'support'); await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, i, {}));
      R.check('Riffel+Gun: zerstört → Bonus weg', t.hero(me, 0).atk === basis, t.hero(me, 0).atk);
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: GUN, source: 'discard' }) });
      const r = await t.activateHero(me, 0, {});
      R.check('Riffel+Gun: Riffel legt eine zweite Gun an → +40 (die zerstörte Kopie liegt in der Ablage; Text: 40 × Guns in der Ablage), genau EINMAL', r === true && t.hero(me, 0).atk === basis + 40 && t.find(GUN, 'support').counters.atkGranted === 40, { r, atk: t.hero(me, 0).atk, ag: t.find(GUN, 'support') && t.find(GUN, 'support').counters });
      const j = t.find(GUN, 'support'); await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, j, {}));
      R.check('Riffel+Gun: auch die zweite zerstört → Bonus weg (nicht am Ex-Träger), Ablage hat 2 Guns', t.hero(me, 0).atk === basis && t.pile(me, 'discardPile').filter(n => n === GUN).length === 2, { atk: t.hero(me, 0).atk, d: t.pile(me, 'discardPile') });
      R.check('Riffel+Gun: sauber', t.errors.length === 0 && pruefe(t).length === 0, { e: t.errors, p: pruefe(t) });
      // Gegenprobe „direkt so angelegt": gleiche Ablage (1 Gun), Gun direkt aus der Hand
      const d = await U.fresh(me, { hand: [GUN], heroes: { [me]: [RIF, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] }, opts: { deckSize: 20, discard: [0, 1].map(s => s === me ? [GUN] : []) } });
      await U.lege(d, me, GUN, 0);
      R.check('Gegenprobe: Gun direkt angelegt bei 1 Gun in der Ablage → ebenfalls +40 (== Riffel-Weg)', d.hero(me, 0).atk === basis + 40, d.hero(me, 0).atk); }
  }
  R.finish();
})();
