'use strict';
// W31a · Frage 3 aus W28a · Al, 22.10.2026: Kreatur in der Zone eines dauerhaft übernommenen Helden – gehört sie dem Übernehmer? –
//   „Nein! Creatures sind unabhängig von Heroes und haben ihren *eigenen* owner. Dieser kann wechseln, etwa via Dark Gear, und muss nicht unbedingt dem des Heroes entsprechen.
//    Den Hero zu stehlen, stiehlt NICHT seine Creatures mit!"
// Regel: Besitz/Kontrolle einer Kreatur ist unabhängig vom Helden, in dessen Zone sie steht. Der Roh-Wert `inst.controller ?? inst.owner` (= `kontrolleurVon`) gilt überall – auch im Kontext
//   der Kreatur-Hooks (`ctx.cardOwner`/`cardController` via `effektiveSeiten`; vorher folgte die Kreatur bei DAUERHAFTER Übernahme dem Übernehmer des Helden: „zwei Wahrheiten").
//   Die Zone bleibt auf der Brettseite des Helden. Kreaturen wechseln den Besitzer nur über Kreatur-Wechsel (Dark Gear/`actionTransferCreature`, `actionStealCreature`, Charme der Kreatur).
// Aufbau je Besitzer-Sitz b (0/1) und Zustand des Helden b:0 (normal · temporär gestohlen · dauerhaft übernommen durch den Gegner t = 1-b):
//   Kreatur in der Zone b:0:0 und b:0:1. Gemessen: Zuordnung (Kontrolleur, effektive Seiten, Kontext), Zielsammler (`getCreatureTargets`), Opfer-Kandidaten, Golden Vermin (Gold → Karte für
//   den Kontrolleur der KREATUR), Harpthenean War Counselor (Gold geht an den Kreaturen-Kontrolleur, Zählung der Counselors), Aktivierung (Besitzer ja / Übernehmer des Helden nein),
//   Tod der Kreatur (Ablage beim Besitzer), Rückgabe des Helden (Kreatur unverändert), Dark Gear (`actionTransferCreature` → Kontrolle wechselt, Held bleibt beim Übernehmer),
//   Gegenprobe: eine vom Übernehmer SELBST in die Zone beschworene Kreatur gehört dem Übernehmer.
// Aufruf: node docs/niche-tests/repro/W31/a-03-kreaturen-sind-unabhaengig-von-heroes.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ZUSTAENDE = ['normal', 'temporaer', 'dauerhaft'];
const D = H.INERT.creature;

async function aufbau(b, z, o = {}) {
  const t = await H.fresh({ hand: [[], []], deckSize: 30, gold: [50, 50], active: b, ...o });
  return t;
}
async function uebernehmen(t, z, b) {
  const nehmer = 1 - b;
  if (z === 'temporaer') await t.run(() => t.engine.actionStealHero(nehmer, b, 0));
  else if (z === 'dauerhaft') await t.run(() => t.engine.actionTakeHeroPermanently(nehmer, b, 0));
  await sleep(250);   // Harness-Falle: onTakeControl läuft asynchron nach
}

(async () => {
  const R = H.runner();
  for (const b of [0, 1]) for (const z of ZUSTAENDE) {
    const nehmer = 1 - b;
    R.section(`Besitzer Sitz ${b} · Held ${b}:0 ${z}`);

    // ── 1 · Zuordnung ──
    { const t = await aufbau(b, z);
      const inst = t.put(b, 0, 0, D); inst.turnPlayed = 1;
      await uebernehmen(t, z, b);
      const es = t.engine.effektiveSeiten(inst);
      const ctx = t.engine._createContext(inst, {});
      R.check(`${z}: kontrolleurVon(Kreatur) = Besitzer Sitz ${b}`, t.engine.kontrolleurVon(inst) === b, t.engine.kontrolleurVon(inst));
      R.check(`${z}: effektiveSeiten(Kreatur): owner und controller = ${b} (nicht der Übernehmer des Helden)`, es.owner === b && es.controller === b, es);
      R.check(`${z}: Kontext der Kreatur-Hooks: cardOwner = cardController = ${b}`, ctx.cardOwner === b && ctx.cardController === b, [ctx.cardOwner, ctx.cardController]);
      R.check(`${z}: Brettseite der Zone bleibt beim Helden (cardHeroOwner = ${b})`, ctx.cardHeroOwner === b && t.engine.physicalSide(inst) === b, [ctx.cardHeroOwner, t.engine.physicalSide(inst)]);
      const ziel = (p) => t.engine.getCreatureTargets(p).some(x => x.cardInstance === inst);
      R.check(`${z}: getCreatureTargets(Besitzer) enthält die Kreatur, getCreatureTargets(Übernehmer) nicht`, ziel(b) && !ziel(nehmer), [ziel(b), ziel(nehmer)]);
      const opfer = (p) => t.engine.getSacrificableCreatures(p).some(x => (x.inst || x) === inst || x.id === inst.id);
      R.check(`${z}: Opfer-Kandidaten: nur der Besitzer der Kreatur`, opfer(b) && !opfer(nehmer), [opfer(b), opfer(nehmer)]);
      R.check(`${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    // ── 2 · Golden Vermin: „when YOU would gain Gold … draw 1 card instead" – der Kontrolleur der Kreatur ──
    { const t = await aufbau(b, z);
      const v = t.put(b, 0, 0, 'Golden Vermin'); v.turnPlayed = 1;
      await uebernehmen(t, z, b);
      const handB = t.pile(b, 'hand').length, handN = t.pile(nehmer, 'hand').length, goldB = t.gs.players[b].gold, goldN = t.gs.players[nehmer].gold;
      await t.run(() => t.engine.actionGainGold(nehmer, 4));
      R.check(`${z}: Gold des ÜBERNEHMERS des Helden wird NICHT ersetzt (er kontrolliert die Kreatur nicht)`, t.gs.players[nehmer].gold === goldN + 4 && t.pile(nehmer, 'hand').length === handN, [t.gs.players[nehmer].gold - goldN, t.pile(nehmer, 'hand').length - handN]);
      await t.run(() => t.engine.actionGainGold(b, 4));
      R.check(`${z}: Gold des Kreaturen-Kontrolleurs (Besitzer ${b}) wird durch eine Karte ersetzt`, t.gs.players[b].gold === goldB && t.pile(b, 'hand').length === handB + 1, [t.gs.players[b].gold - goldB, t.pile(b, 'hand').length - handB]);
      R.check(`${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    // ── 3 · Harpthenean War Counselor: aktiver Effekt, Gold an den Kreaturen-Kontrolleur, Zählung der Counselors ──
    { const t = await aufbau(b, z);
      const h = t.put(b, 0, 0, 'Harpthenean War Counselor'); h.turnPlayed = 1;
      t.put(b, 1, 0, 'Cykyran War Counselor').turnPlayed = 1;   // zweite Kreatur (anderer Held, bleibt beim Besitzer)
      await uebernehmen(t, z, b);
      t.gs.activePlayer = b; t.phase(2);
      const angebot = (p) => (t.engine.getActivatableCreatures(p) || []).filter(e => e.owner === b && e.heroIdx === 0 && e.zoneSlot === 0);
      R.check(`${z}: der Besitzer der Kreatur bekommt die Aktivierung angeboten`, angebot(b).length === 1, angebot(b));
      t.gs.activePlayer = nehmer;
      R.check(`${z}: der Übernehmer des Helden bekommt die Kreatur NICHT angeboten`, angebot(nehmer).length === 0, angebot(nehmer));
      const klick = await t.run(() => t.host.doActivateCreatureEffect(t.room, nehmer, { heroIdx: 0, zoneSlot: 0, charmedOwner: b }));
      R.check(`${z}: ein direkter Klick des Übernehmers auf die Kreatur wird abgelehnt`, klick === false, klick);
      t.gs.activePlayer = b; t.phase(2); t.resetActions(b);
      t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Harpthenean War Counselor', answer: () => ({ optionId: 'gold' }) });
      const goldB = t.gs.players[b].gold, goldN = t.gs.players[nehmer].gold;
      await t.activateCreature(b, 0, 0);
      R.check(`${z}: Aktivierung durch den Besitzer: 20 Gold (2 War Counselors) an den Besitzer ${b}`, t.gs.players[b].gold === goldB + 20 && t.gs.players[nehmer].gold === goldN, [t.gs.players[b].gold - goldB, t.gs.players[nehmer].gold - goldN]);
      R.check(`${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    // ── 4 · Tod der Kreatur: Ablage beim Besitzer, Held bleibt ──
    { const t = await aufbau(b, z);
      const inst = t.put(b, 0, 0, D);
      await uebernehmen(t, z, b);
      const ablB = t.pile(b, 'discardPile').length, ablN = t.pile(nehmer, 'discardPile').length;
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: nehmer, controller: nehmer }, inst));
      R.check(`${z}: die zerstörte Kreatur liegt in der Ablage ihres Besitzers ${b}`, t.pile(b, 'discardPile').length === ablB + 1 && t.pile(nehmer, 'discardPile').length === ablN, [t.pile(b, 'discardPile'), t.pile(nehmer, 'discardPile')]);
      R.check(`${z}: Held ${b}:0 weiter bei seinem Kontrolleur`, t.engine.kontrolleurVonHeld(b, 0) === (z === 'normal' ? b : nehmer), t.engine.kontrolleurVonHeld(b, 0));
      R.check(`${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    if (z === 'normal') continue;

    // ── 5 · Rückgabe des Helden: Kreatur unverändert ──
    { const t = await aufbau(b, z);
      const inst = t.put(b, 0, 0, D);
      await uebernehmen(t, z, b);
      const vorher = [inst.owner, inst.controller, t.engine.kontrolleurVon(inst), t.engine.effektiveSeiten(inst).controller];
      await t.run(() => t.engine.actionReturnHeroControl(b, 0));
      const nachher = [inst.owner, inst.controller, t.engine.kontrolleurVon(inst), t.engine.effektiveSeiten(inst).controller];
      R.check(`${z}: Held zurück → Kreatur unverändert (Besitzer/Kontrolleur gleich vorher/nachher, = ${b})`, JSON.stringify(vorher) === JSON.stringify(nachher) && nachher.slice(2).every(x => x === b), { vorher, nachher });
      R.check(`${z}: Held wieder bei ${b}`, t.engine.kontrolleurVonHeld(b, 0) === b, t.engine.kontrolleurVonHeld(b, 0));
      R.check(`${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    // ── 6 · Dark Gear: Kreatur wechselt die Kontrolle (Zone beim Dieb), der Held bleibt beim Übernehmer ──
    { const t = await aufbau(b, z);
      const inst = t.put(b, 0, 0, D);
      await uebernehmen(t, z, b);
      const r = await t.run(() => t.engine.actionTransferCreature(inst, nehmer, 0, 0, { controller: nehmer }));
      const nach = t.inst(c => c.id === inst.id)[0];
      R.check(`${z}: actionTransferCreature (Dark-Gear-Weg) → die Kreatur wird vom Dieb ${nehmer} kontrolliert`, !!nach && t.engine.kontrolleurVon(nach) === nehmer && t.engine.effektiveSeiten(nach).controller === nehmer, { r, ctrl: nach && [nach.owner, nach.controller] });
      R.check(`${z}: der Held ${b}:0 bleibt unverändert (Kontrolleur ${nehmer})`, t.engine.kontrolleurVonHeld(b, 0) === nehmer, t.engine.kontrolleurVonHeld(b, 0));
      R.check(`${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    // ── 6b · Dark Gear in die Zone des übernommenen Helden: die Kreatur eines anderen Helden des Besitzers wechselt zum Dieb und steht dann in der Zone des übernommenen Helden (Brettseite des Besitzers) ──
    { const t = await aufbau(b, z);
      const inst = t.put(b, 1, 0, D);
      await uebernehmen(t, z, b);
      const r = await t.run(() => t.engine.actionTransferCreature(inst, b, 0, 1, { controller: nehmer }));
      const nach = t.inst(c => c.id === inst.id)[0];
      R.check(`${z}: Dark-Gear-Weg in eine Zone des übernommenen Helden ${b}:0 → Kontrolle beim Dieb ${nehmer}, Brettseite bleibt ${b}`, !!nach && t.engine.kontrolleurVon(nach) === nehmer && t.engine.effektiveSeiten(nach).controller === nehmer && t.engine.physicalSide(nach) === b && nach.heroIdx === 0, { r, nach: nach && [nach.owner, nach.controller, nach.heroIdx] });
      R.check(`${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    // ── 7 · Steal Creature (temporär) in der Zone eines übernommenen Helden ──
    { const t = await aufbau(b, z);
      const inst = t.put(b, 0, 0, D);
      await uebernehmen(t, z, b);
      const ok = t.engine.actionStealCreature(nehmer, inst);
      R.check(`${z}: Kreatur-Diebstahl (temporär) wirkt: Kontrolle beim Dieb ${nehmer}, cardOwner im Kontext = ${nehmer}`, ok === true && t.engine.kontrolleurVon(inst) === nehmer && t.engine._createContext(inst, {}).cardOwner === nehmer, { ok, k: t.engine.kontrolleurVon(inst) });
      R.check(`${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }

    // ── 8 · Gegenprobe: eine vom Übernehmer selbst in die Zone des übernommenen Helden beschworene Kreatur gehört ihm ──
    { const t = await aufbau(b, z, { hand: [[], []], active: nehmer });
      await uebernehmen(t, z, b);
      t.setHand(nehmer, [D]);
      const rk = await t.play(nehmer, D, { hero: 0, slot: 1, charmedOwner: b, noGrant: true });
      const inst = t.inst(c => c.zone === 'support' && c.heroIdx === 0 && c.zoneSlot === 1 && c.name === D)[0];
      R.check(`${z}: der Übernehmer beschwört über den übernommenen Helden`, rk === true && !!inst, { rk });
      R.check(`${z}: diese Kreatur gehört und wird kontrolliert vom Übernehmer ${nehmer} (steht auf der Brettseite ${b})`, !!inst && t.engine.kontrolleurVon(inst) === nehmer && t.engine.effektiveSeiten(inst).controller === nehmer && t.engine.physicalSide(inst) === b, inst && [inst.owner, inst.controller, t.engine.physicalSide(inst)]);
      R.check(`${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
  }
  R.finish();
})();
