'use strict';
// W35a · Frage 3 · Al, 22.10.2026 (Antwort auf W34a-Rückfrage 3): „Ja, sollen sie!" – Guardian Beast Hu („… immediately perform an additional Action with any Hero you control")
// bietet für einen vom Spieler kontrollierten (temporär [Steal] oder dauerhaft [Paraseed] übernommenen) Gegnerhelden AUCH Abilities und Heldeneffekte mit Aktionskosten an – nicht nur Hand-Karten.
// REGEL: `performImmediateActionAnyHero` / `canPerformImmediateActionAnyHero` mit `config.mitUebernommenenAktionen: true` (nur Hu) sammeln über `getActivatableAbilities` /
//   `getActiveHeroEffects` mit `heroSide` (Brettseite des Helden); die Prompt-Einträge tragen `charmedOwner` (= Brettseite), die Antwort `{ abilityActivation|heroEffectActivation, heroIdx, …, heroOwner }`.
//   Der Server nimmt einen übernommenen Helden nur an, wenn der Prompt genau diese Aktion für genau diesen Helden angeboten hat. Voraussetzungen wie beim eigenen Helden (Matrix unten:
//   Frozen/Stunned/Webbed/Negated/Aktionssperre/Einmal-Stempel/Spielerweite Sperre/Spielstart-Schutz gleich für eigen und übernommen); Hand/Gold/Wisdom und Einmal-Stempel gehören dem
//   KONTROLLEUR (Schlüssel `ability-action:<Ability>:<Spieler>` bzw. `engine.heroHoptKey(Heldenname, Spieler)` – wie in den normalen Wegen `doActivateAbility`/`doActivateHeroEffect`).
//   Die übrigen Nutzer von `performImmediateActionAnyHero` (ohne Flag) bleiben bei Hand-Karten.
// Aufruf: node docs/niche-tests/repro/W35/a-00-hu-uebernommene-helden-abilities-und-heldeneffekte-mit-aktionskosten.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const F = H.INERT.filler;
const CH = 'Champion, the Stormbringer', ADV = 'Adventurousness';
const HU = H.loadCardEffect('Guardian Beast Hu');

/** Szene: Halter h (am Zug), Hu auf Held 1 Slot 0 mit 5 Füllkarten in der eigenen Ablage; Hände: h [F,F], o [F,F,F]. */
async function aufbau(h, o2 = {}) {
  const o = 1 - h;
  const hands = [[], []]; hands[h] = o2.hand || [F, F]; hands[o] = [F, F, F];
  const t = await H.fresh({ hand: hands, discard: h === 0 ? [Array(5).fill(F), []] : [[], Array(5).fill(F)], deckSize: 20, active: h, hp: 800 });
  const hu = t.put(h, 1, 0, 'Guardian Beast Hu'); hu.turnPlayed = 1;
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => {
    const idx = d.cards.map((c, i) => i).slice(0, 5); return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } });
  return { t, hu, o };
}
const kann = (t, hu) => !!HU.canActivateCreatureEffect(t.engine._createContext(hu, { event: 'canCreatureEffectCheck' }));
const uebernehmen = async (t, h, o, art, hi = 0) => { if (art === 'temporaer') await t.run(() => t.engine.actionStealHero(h, o, hi)); else await t.run(() => t.engine.actionTakeHeroPermanently(h, o, hi)); await sleep(250); t.gs.activePlayer = h; t.phase(2); };
const geloescht = (t, h) => t.pile(h, 'deletedPile').length;
const hopt = (t, k) => (t.gs.hoptUsed || {})[k];
/** heroAction-Skript: merkt die Prompts, antwortet mit `antwort(d, n)`. */
function skript(t, antwort) {
  const rec = [];
  t.script.push({ match: d => d && d.type === 'heroAction', answer: (d) => { rec.push(d); return antwort(d, rec.length); } });
  return rec;
}
const eintrag = (d, liste, hi, seite) => ((d && d[liste]) || []).find(e => e.heroIdx === hi && (e.charmedOwner ?? null) === seite);

/** Wird die Aktion `art` ('ability' | 'effect') vom Held 0 (eigen oder übernommen) in der Hu-Aktion angeboten? */
async function angeboten(h, art, fremd, bed) {
  const o = 1 - h;
  const { t } = await aufbau(h);
  const seite = fremd ? o : h;
  if (art === 'ability') t.setAbilities(seite, 0, [[ADV, ADV], [], []]); else t.setHero(seite, 0, CH, 800);
  if (fremd) await uebernehmen(t, h, o, 'temporaer');
  if (bed) bed(t, seite, h, o);
  t.gs.activePlayer = h; t.phase(2);
  const rec = skript(t, () => ({ cancelled: true }));
  await t.run(() => t.engine.performImmediateActionAnyHero(h, { title: 'x', cancellable: true, mitUebernommenenAktionen: true }));
  const ok = rec.length > 0 && !!eintrag(rec[0], art === 'ability' ? 'activatableAbilities' : 'activatableHeroEffects', 0, fremd ? o : null);
  return { ok, saubere: sauber(t) };
}
const BED = {
  'ohne Besonderheit': { ab: true, ef: true },
  'Frozen': { f: (t, s) => t.heroStatus(s, 0, 'frozen'), ab: false, ef: false },
  'Stunned': { f: (t, s) => t.heroStatus(s, 0, 'stunned'), ab: false, ef: false },
  'Webbed': { f: (t, s) => t.heroStatus(s, 0, 'webbed'), ab: false, ef: false },
  'Negated (hart)': { f: (t, s) => t.heroStatus(s, 0, 'negated'), ab: false, ef: false },
  'Negated (leicht: nur der Effekt)': { f: (t, s) => t.heroStatus(s, 0, 'negated', { appliedTurn: 0, effectOnly: true }), ab: true, ef: false },
  'Bound': { f: (t, s) => t.heroStatus(s, 0, 'bound'), ab: true, ef: true },
  'Held-Aktionssperre des Zuges': { f: (t, s) => { t.hero(s, 0)._actionLockedTurn = t.gs.turn; }, ab: false, ef: false },
  'Einmal-Stempel der Ability (Spieler h)': { f: (t, s, h) => { t.gs.hoptUsed = { ...(t.gs.hoptUsed || {}), ['ability-action:' + ADV + ':' + h]: t.gs.turn }; }, ab: false, ef: true },
  'Einmal-Stempel des Heldeneffekts (Spieler h)': { f: (t, s, h) => { t.gs.hoptUsed = { ...(t.gs.hoptUsed || {}), [t.engine.heroHoptKey(CH, h)]: t.gs.turn }; }, ab: true, ef: false },
  'spielerweite Aktionssperre (Kent)': { f: (t, s, h) => { t.gs.players[h]._playerActionLockedTurn = t.gs.turn; }, ab: false, ef: false },
  'Spielstart-Schutz des Gegners (Champion)': { f: (t, s, h, o) => { t.gs.firstTurnProtectedPlayer = o; }, ab: true, ef: false },
};

(async () => {
  const R = H.runner();
  for (const h of [0, 1]) {
    const o = 1 - h;

    // ── 1 · Ability eines übernommenen Helden (Adventurousness: Gold) ──
    for (const art of ['temporaer', 'dauerhaft']) {
      R.section(`Halter Sitz ${h} · Ability des übernommenen Helden (${art}): Adventurousness Lv2 des Gegnerhelden`);
      const { t, hu } = await aufbau(h, { hand: [] });
      t.setAbilities(o, 0, [[ADV, ADV], [], []]);
      R.check('VOR der Übernahme ist Hu nicht aktivierbar (nichts zu spielen)', !kann(t, hu) && t.engine.canPerformImmediateActionAnyHero(h, { title: 'x', mitUebernommenenAktionen: true }) === false, null);
      await uebernehmen(t, h, o, art);
      R.check('NACH der Übernahme ist Hu aktivierbar (die Ability genügt – ohne Hand-Karten)', kann(t, hu), null);
      R.check('canPerformImmediateActionAnyHero: mit Flag ja, ohne Flag (übrige Nutzer) nein', t.engine.canPerformImmediateActionAnyHero(h, { title: 'x', mitUebernommenenAktionen: true }) === true && t.engine.canPerformImmediateActionAnyHero(h, { title: 'x' }) === false, null);
      const rec = skript(t, () => ({ abilityActivation: true, heroIdx: 0, zoneIdx: 0, heroOwner: o }));
      const g0 = t.gs.players[h].gold, go0 = t.gs.players[o].gold;
      const r = await t.activateCreature(h, 1, 0);
      const d = rec[0];
      R.check(`Prompt bietet die Ability mit charmedOwner ${o} an (Stufe 2)`, !!eintrag(d, 'activatableAbilities', 0, o) && eintrag(d, 'activatableAbilities', 0, o).level === 2, d && d.activatableAbilities);
      R.check('Hu hat gespielt (5 Karten gelöscht), Ability gewirkt: der KONTROLLEUR erhält 20 Gold (Stufe des Helden), der Besitzer nichts', r === true && geloescht(t, h) === 5 && t.gs.players[h].gold === g0 + 20 && t.gs.players[o].gold === go0, { r, del: geloescht(t, h), g: t.gs.players[h].gold - g0, go: t.gs.players[o].gold - go0 });
      R.check(`Einmal-Stempel gehört dem Spieler (ability-action:${ADV}:${h}), nicht dem Besitzer`, hopt(t, 'ability-action:' + ADV + ':' + h) === t.gs.turn && hopt(t, 'ability-action:' + ADV + ':' + o) === undefined, t.gs.hoptUsed);
      const inst = t.engine.cardInstances.find(c => c.name === ADV && c.zone === 'ability' && c.heroIdx === 0 && t.engine.physicalSide(c) === o);
      R.check('Instanz der Ability danach wieder beim Besitzer (owner/controller zurückgesetzt, kein heroOwner-Rest)', !!inst && inst.owner === o && (inst.controller ?? inst.owner) === o && inst.heroOwner === undefined, inst && { o: inst.owner, c: inst.controller, ho: inst.heroOwner });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
    }

    // ── 2 · Heldeneffekt mit Aktionskosten eines übernommenen Helden (Champion) ──
    for (const art of ['temporaer', 'dauerhaft']) {
      R.section(`Halter Sitz ${h} · Heldeneffekt des übernommenen Helden (${art}): Champion, the Stormbringer`);
      const { t, hu } = await aufbau(h);
      t.setHero(o, 0, CH, 800);
      await uebernehmen(t, h, o, art);
      const rec = skript(t, () => ({ heroEffectActivation: true, heroIdx: 0, effectName: CH, heroOwner: o }));
      t.script.push({ match: d => d && d.type === 'handPick', answer: () => ({ selectedCards: [{ cardName: F, handIndex: 0 }], selectedIndices: [0] }) });
      const hHand0 = t.pile(h, 'hand').length;
      const r = await t.activateCreature(h, 1, 0);
      const d = rec[0];
      R.check(`Prompt bietet den Heldeneffekt mit charmedOwner ${o} und actionCost an`, !!eintrag(d, 'activatableHeroEffects', 0, o) && eintrag(d, 'activatableHeroEffects', 0, o).actionCost === true, d && d.activatableHeroEffects);
      R.check('Hu hat gespielt (5 Karten gelöscht); der Effekt lief mit den Karten des KONTROLLEURS (1 Karte aus SEINER Hand in SEINE Ablage, 1 gezogen; die 5 Hu-Karten sind gelöscht), der Gegner (Besitzer) musste ablegen', r === true && geloescht(t, h) === 5 && t.pile(h, 'hand').length === hHand0 && t.pile(h, 'discardPile').length === 1 && t.prompts.some(p => p.pi === o && /Forced Discard/.test(p.d.title || '')), { r, hand: t.pile(h, 'hand').length, abl: t.pile(h, 'discardPile').length });
      R.check(`Einmal-Stempel des Heldeneffekts gehört dem Spieler (${h})`, hopt(t, t.engine.heroHoptKey(CH, h)) === t.gs.turn && hopt(t, t.engine.heroHoptKey(CH, o)) === undefined, t.gs.hoptUsed);
      const inst = t.engine.cardInstances.find(c => c.zone === 'hero' && c.heroIdx === 0 && t.engine.physicalSide(c) === o);
      R.check('Heldeninstanz danach wieder beim Besitzer', !!inst && inst.owner === o && inst.heroOwner === undefined, inst && { o: inst.owner, ho: inst.heroOwner });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
    }

    // ── 3 · Gegenprobe: eigener Held (Ability und Heldeneffekt) ──
    R.section(`Halter Sitz ${h} · Gegenprobe: eigener Held mit Ability/Heldeneffekt (unverändert)`);
    { const { t, hu } = await aufbau(h, { hand: [] });
      t.setAbilities(h, 0, [[ADV, ADV], [], []]); t.gs.activePlayer = h; t.phase(2);
      const rec = skript(t, () => ({ abilityActivation: true, heroIdx: 0, zoneIdx: 0 }));
      const g0 = t.gs.players[h].gold;
      const r = await t.activateCreature(h, 1, 0);
      R.check('eigene Ability wird ohne charmedOwner angeboten und wirkt (+20 Gold)', r === true && !!eintrag(rec[0], 'activatableAbilities', 0, null) && t.gs.players[h].gold === g0 + 20, { r, g: t.gs.players[h].gold - g0 });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { const { t, hu } = await aufbau(h);
      t.setHero(h, 0, CH, 800); t.gs.activePlayer = h; t.phase(2);
      const rec = skript(t, () => ({ heroEffectActivation: true, heroIdx: 0, effectName: CH }));
      t.script.push({ match: d => d && d.type === 'handPick', answer: () => ({ selectedCards: [{ cardName: F, handIndex: 0 }], selectedIndices: [0] }) });
      const r = await t.activateCreature(h, 1, 0);
      R.check('eigener Heldeneffekt wird ohne charmedOwner angeboten und wirkt', r === true && !!eintrag(rec[0], 'activatableHeroEffects', 0, null) && hopt(t, t.engine.heroHoptKey(CH, h)) === t.gs.turn, { r });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // ── 4 · Eigen ↔ übernommen: gleiche Voraussetzungen (Matrix) ──
    R.section(`Halter Sitz ${h} · Matrix: Voraussetzungen für eigenen und übernommenen Helden gleich`);
    for (const [name, b] of Object.entries(BED)) {
      for (const [art, erwartet] of [['ability', b.ab], ['effect', b.ef]]) {
        const e = await angeboten(h, art, false, b.f), f = await angeboten(h, art, true, b.f);
        R.check(`${art === 'ability' ? 'Ability' : 'Heldeneffekt'} · ${name}: eigen ${e.ok ? 'angeboten' : 'nicht angeboten'}, übernommen ${f.ok ? 'angeboten' : 'nicht angeboten'} (erwartet beide: ${erwartet ? 'angeboten' : 'nicht'})`, e.ok === erwartet && f.ok === erwartet && e.saubere && f.saubere, { eigen: e.ok, fremd: f.ok });
      }
    }

    // ── 5 · Nur angebotene Aktionen werden angenommen ──
    R.section(`Halter Sitz ${h} · nicht angebotene Antworten werden abgelehnt`);
    { // Gegnerheld 0 hat die Ability, aber NICHT übernommen; übernommen wird Held 1 (ohne Ability)
      const { t, hu } = await aufbau(h);
      t.setAbilities(o, 0, [[ADV, ADV], [], []]); t.setHero(o, 1, CH, 800);
      await uebernehmen(t, h, o, 'temporaer', 1);
      let n = 0;
      const rec = skript(t, (d) => (++n === 1 ? { abilityActivation: true, heroIdx: 0, zoneIdx: 0, heroOwner: o } : (n === 2 ? { heroEffectActivation: true, heroIdx: 0, effectName: CH, heroOwner: o } : { cancelled: true })));
      const g0 = t.gs.players[h].gold;
      const r = await t.activateCreature(h, 1, 0);
      R.check('Ability von Gegnerheld 0 (nicht kontrolliert) wird abgelehnt (Prompt kommt erneut), ebenso der Heldeneffekt von Held 0; Abbruch: kein Gold, nichts gelöscht', rec.length >= 3 && t.gs.players[h].gold === g0 && geloescht(t, h) === 0 && !hopt(t, 'ability-action:' + ADV + ':' + h), { prompts: rec.length, del: geloescht(t, h) });
      R.check('der kontrollierte Held 1 bietet seinen Champion-Effekt an', !!eintrag(rec[0], 'activatableHeroEffects', 1, o), rec[0] && rec[0].activatableHeroEffects);
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { // Antwort ohne heroOwner für einen Index, den nur der übernommene Held anbietet
      const { t, hu } = await aufbau(h, { hand: [] });
      t.setAbilities(o, 0, [[ADV, ADV], [], []]);
      await uebernehmen(t, h, o, 'temporaer');
      let n = 0;
      const rec = skript(t, () => (++n === 1 ? { abilityActivation: true, heroIdx: 0, zoneIdx: 0 } : { cancelled: true }));
      const g0 = t.gs.players[h].gold;
      await t.activateCreature(h, 1, 0);
      R.check('ohne heroOwner zählt die Antwort für den EIGENEN Helden 0 (der hat keine Ability): keine Wirkung, kein Gold', t.gs.players[h].gold === g0 && !hopt(t, 'ability-action:' + ADV + ':' + h), { g: t.gs.players[h].gold - g0 });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // ── 6 · Einmal-Stempel je Spieler: eigene und übernommene Kopie teilen ihn ──
    R.section(`Halter Sitz ${h} · Einmal-Stempel: eigene und übernommene Adventurousness teilen den Stempel des Spielers`);
    { const { t, hu } = await aufbau(h, { hand: [] });
      t.setAbilities(h, 2, [[ADV], [], []]); t.setAbilities(o, 0, [[ADV, ADV, ADV], [], []]);
      await uebernehmen(t, h, o, 'temporaer');
      const rec = skript(t, (d, n) => (n === 1 ? { abilityActivation: true, heroIdx: 0, zoneIdx: 0, heroOwner: o } : { cancelled: true }));
      const g0 = t.gs.players[h].gold;
      const r1 = await t.run(() => t.engine.performImmediateActionAnyHero(h, { title: 'x', cancellable: true, mitUebernommenenAktionen: true }));
      R.check('erster Prompt bietet BEIDE Kopien an (eigen Lv1, übernommen Lv3); die übernommene (Lv3) wirkt: +30 Gold', rec.length === 1 && !!eintrag(rec[0], 'activatableAbilities', 2, null) && !!eintrag(rec[0], 'activatableAbilities', 0, o) && t.gs.players[h].gold === g0 + 30 && r1.played === true, { n: rec.length, g: t.gs.players[h].gold - g0 });
      const r2 = await t.run(() => t.engine.performImmediateActionAnyHero(h, { title: 'x', cancellable: true, mitUebernommenenAktionen: true }));
      R.check('danach bietet ein weiterer Prompt keine der beiden Kopien mehr an (ein Stempel je Spieler und Zug)', rec.length === 1 && r2.played === false, { n: rec.length, r2 });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // ── 7 · Übrige Nutzer (ohne Flag) bleiben bei Hand-Karten ──
    R.section(`Halter Sitz ${h} · übrige Nutzer von performImmediateActionAnyHero: übernommene Helden nur mit Hand-Karten`);
    { const { t } = await aufbau(h, { hand: ['Fireball'] });
      t.grantFor(o, 0, 'Fireball'); t.setAbilities(o, 0, [[ADV, ADV], [], []].map((z, i) => (i === 0 ? [ADV, ADV] : z))); t.grantFor(o, 0, 'Fireball');
      t.setHero(o, 1, CH, 800);
      await uebernehmen(t, h, o, 'temporaer'); await t.run(() => t.engine.actionStealHero(h, o, 1)); await sleep(250); t.gs.activePlayer = h; t.phase(2);
      const rec = skript(t, () => ({ cancelled: true }));
      await t.run(() => t.engine.performImmediateActionAnyHero(h, { title: "The Master's Plan", cancellable: true }));
      const d = rec[0];
      R.check('ohne Flag: Fireball wird über den übernommenen Helden weiterhin angeboten (Hand-Karten, W34a)', !!d && ((d.fremdeHelden || {}).Fireball || []).some(f => f.heroOwner === o && f.heroIdx === 0), d && d.fremdeHelden);
      R.check('ohne Flag: KEINE Ability und KEIN Heldeneffekt eines übernommenen Helden im Prompt', !!d && (d.activatableAbilities || []).every(e => !e.charmedOwner) && (d.activatableHeroEffects || []).every(e => !e.charmedOwner), d && { a: d.activatableAbilities, e: d.activatableHeroEffects });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { const { t } = await aufbau(h, { hand: [] });
      t.setAbilities(o, 0, [[ADV, ADV], [], []]);
      await uebernehmen(t, h, o, 'temporaer');
      let n = 0;
      const rec = skript(t, () => (++n === 1 ? { abilityActivation: true, heroIdx: 0, zoneIdx: 0, heroOwner: o } : { cancelled: true }));
      const g0 = t.gs.players[h].gold;
      const r = await t.run(() => t.engine.performImmediateActionAnyHero(h, { title: 'Shamanic Curse', cancellable: true }));
      R.check('ohne Flag: der (nicht angebotene) Ability-Versuch wird abgelehnt; nur Abbruch bleibt — kein Gold, nichts gespielt', t.gs.players[h].gold === g0 && r.played === false, { r });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // ── 8 · Bleed: es blutet der HANDELNDE (übernommene) Held, nicht der gleich nummerierte eigene ──
    R.section(`Halter Sitz ${h} · Bleed nach der Aktion des übernommenen Helden trifft den übernommenen Helden (Charme-Schutz gilt wie sonst)`);
    for (const art of ['ability', 'effect']) for (const uebernahme of ['temporaer', 'dauerhaft']) {
      const { t } = await aufbau(h, art === 'ability' ? { hand: [] } : undefined);
      if (art === 'ability') t.setAbilities(o, 0, [[ADV, ADV], [], []]); else t.setHero(o, 0, CH, 800);
      await uebernehmen(t, h, o, uebernahme);
      t.heroStatus(o, 0, 'bleeding'); t.heroStatus(h, 0, 'bleeding');   // der übernommene Held 0 UND der gleich nummerierte eigene Held 0 bluten; nur der handelnde zahlt
      skript(t, () => (art === 'ability' ? { abilityActivation: true, heroIdx: 0, zoneIdx: 0, heroOwner: o } : { heroEffectActivation: true, heroIdx: 0, effectName: CH, heroOwner: o }));
      t.script.push({ match: d => d && d.type === 'handPick', answer: () => ({ selectedCards: [{ cardName: F, handIndex: 0 }], selectedIndices: [0] }) });
      const eigen0 = t.hp(h, 0), fremd0 = t.hp(o, 0);
      await t.activateCreature(h, 1, 0);
      const bleed = t.lg('bleed_damage').length, blockiert = t.lg('damage_blocked').some(l => l.reason === 'charmed');
      R.check(`${art === 'ability' ? 'Ability' : 'Heldeneffekt'} (${uebernahme}): der gleich nummerierte EIGENE Held verliert nichts`, t.hp(h, 0) === eigen0, { eigen: eigen0 - t.hp(h, 0) });
      R.check(`${art === 'ability' ? 'Ability' : 'Heldeneffekt'} (${uebernahme}): der übernommene (handelnde) Held blutet — ${uebernahme === 'dauerhaft' ? '50 Schaden' : 'der Charme-Schutz fängt den Schaden ab'}`, bleed === 1 && (uebernahme === 'dauerhaft' ? t.hp(o, 0) === fremd0 - 50 : (t.hp(o, 0) === fremd0 && blockiert)), { bleed, fremd: fremd0 - t.hp(o, 0), blockiert });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
