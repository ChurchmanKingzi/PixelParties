'use strict';
// W52a · Punkt 4 (Al, 22.10.2026): „Nein, [AME] soll angeboten werden!" bei einem per Initiation Ritual angelegten Helden.
//   Anti Magic Enchantment: „Play this card immediately when an Artifact is equipped to a Hero by placing 1 Pollution Token … While that Artifact is equipped to a Hero, that Hero's controller may
//   once per turn make the Hero unaffected by a Spell that hits it."   Initiation Ritual: „… While a Hero is equipped via this effect, it is treated as an equippable Artifact."
//   → der angelegte Held IST ein Artifact, das angelegt wird: AME wird angeboten, der Schutz hängt an diesem angelegten Helden (solange er ausgerüstet ist).
// Matrix der Equip-Beobachter (Spalten: Hand-Equip Club of Gobbo | per Initiation Ritual angelegter Held | Tempelunas angehängte Fee), Beobachter beim Gegner des Anlegenden,
// AME beim Anlegenden selbst bzw. beim Gegner:
//   Afflicted Pests (equips or attaches) ........ ja | ja | nein (W50)
//   Cybug LOCUST (equips or attaches to a Hero they control) .. ja | ja (W52a: Subtyp-Filter um "als Artifact angelegter Held" erweitert) | nein
//   Cybug RHINOCEROS (places a card into a Support Zone) ...... ja | ja (W52a: vorher am Held vorbei) | nein
//   Anti Magic Enchantment (an Artifact is equipped) .......... ja | ja (W52a) | nein
//   Lunatic Hawk (Whenever you equip an ARTIFACT, its controller draws) ... ja | ja (W52a, siehe a-05) | nein
// Dazu: die Wirkung — ein Spell, der den Wirtshelden trifft, wird vom Kontrolleur wegverhandelt (einmal pro Zug), solange der Held ausgerüstet ist.
// Beide Sitze. Exit 0 = korrekt. Auf dem Stand vor W52a rot (AME wurde beim Initiation-Helden nicht angeboten, RHINOCEROS sah ihn nicht).
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const PESTS = 'Afflicted Pests', LOC = 'Cybug LOCUST', RHINO = 'Cybug RHINOCEROS', AME = 'Anti Magic Enchantment', CLUB = 'Club of Gobbo', INIT = 'Initiation Ritual';
const FUEL_LOC = "Treasure Hunter's Backpack", FUEL_RHINO = 'Excavator Bucket', FEE = 'Maya, the Nature Fairy', TEMPELUNA = 'Tempeluna, the Convergence Fairy';
const OBS = [PESTS, LOC, RHINO];

/** Initiation Ritual von `A` spielen: Held 1 war gefallen, wird an Held 0 gelegt. */
async function initiation(t, A, S) {
  await t.run(() => t.engine.actionDealDamage({ name: 'x', owner: S }, t.hero(A, 1), 9999, 'true'));
  t.gs.turn = 7; t.hero(A, 1).diedOnTurn = 5;
  t.reset();
  const r = await t.play(A, INIT, { noAutoConfirm: true });
  let pt = t.gs.potionTargeting;
  const v = (pt && pt.validTargets || []).filter(x => !x.ineligible).find(x => x.type === 'hero' && x.heroIdx === 1);
  if (v) await t.run(() => t.host.doConfirmPotion(t.room, A, { selectedIds: [v.id] }));
  pt = t.gs.potionTargeting;
  if (pt) { const w = (pt.validTargets || []).filter(x => !x.ineligible).find(x => x.heroIdx === 0 && (x.type === 'hero' || x.type === 'equip')); if (w) await t.run(() => t.host.doConfirmPotion(t.room, A, { selectedIds: [w.id] })); }
  return r;
}

/** Eine Szene: Anlegender A, Beobachter-Besitzer S mit einem Surprise (obs) auf Held 2 + Brennstoff + AME auf der Hand. */
async function szene(A, S, obs, art) {
  const hand = [[], []];
  hand[S].push(FUEL_LOC, FUEL_RHINO, AME);
  if (art === 'init') hand[A].push(INIT);
  if (art === 'club') hand[A].push(CLUB);
  const heroes = [null, null];
  if (art === 'fee') heroes[A] = [TEMPELUNA, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
  if (art === 'fee') hand[A].push(FEE);
  const t = await H.fresh({ hand, gold: [800, 800], deckSize: 30, active: A, ...(art === 'fee' ? { heroes } : {}), abilities: art === 'init' ? { [A]: { 1: [['Fighting', 'Fighting'], ['Luck'], []] } } : {} });
  t.putSurprise(S, 2, obs); t.grantFor(S, 2, obs);
  t.put(S, 0, 0, H.INERT.creature);   // Pests braucht ein Ziel
  t.script.push({ match: (d) => d.type === 'confirm' && [PESTS, LOC, RHINO, AME].includes(d.title), answer: () => false });   // alles ablehnen: gemessen wird nur, ob angeboten wird
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: FEE, source: 'hand' }) });
  const vorherT = t.targetFn;
  t.targetFn = (v, cfg) => (cfg && cfg.title === PESTS) ? [(v.find(x => x.cardName === H.INERT.creature) || v[0]).id] : (vorherT ? vorherT(v, cfg) : undefined);
  let r;
  if (art === 'club') { t.reset(); r = await t.play(A, CLUB, { hero: 0, slot: 0 }); }
  else if (art === 'init') r = await initiation(t, A, S);
  else { await t.run(() => t.engine.runHooks('onGameStart', {})); t.reset(); r = await t.activateHero(A, 0, {}); }
  const gefragt = (n) => t.prompts.some(p => p.d && p.d.title === n || (n === PESTS && /Afflicted Pests/.test(JSON.stringify(p.d))));
  return { t, r, gefragt };
}

(async () => {
  const R = H.runner();
  for (const [A, S] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + A + ' legt an, Sitz ' + S + ' beobachtet');
    const SOLL = {   // art → Beobachter → feuert?
      club: { [PESTS]: 1, [LOC]: 1, [RHINO]: 1 },
      init: { [PESTS]: 1, [LOC]: 1, [RHINO]: 1 },
      fee: { [PESTS]: 0, [LOC]: 0, [RHINO]: 0 },
    };
    const AMESOLL = { club: 1, init: 1, fee: 0 };
    for (const art of ['club', 'init', 'fee']) {
      const label = { club: 'Hand-Equip (Club of Gobbo)', init: 'Initiation Ritual (Held als Equip)', fee: 'Tempeluna (angehängte Fee)' }[art];
      let ameZ = null;
      for (const o of OBS) {
        const z = await szene(A, S, o, art);
        if (!ameZ) ameZ = z;
        R.check(`${label}: gespielt/angelegt`, art === 'fee' ? z.r === true : (art === 'club' ? z.r === true : z.t.inst(c => c.zone === 'support' && c.owner === A && c.heroIdx === 0 && c.counters && c.counters.treatAsEquip).length > 0), { r: z.r, p: z.t.prompts.map(p => p.d.title || p.d.type) });
        R.check(`${label} → ${o} ${SOLL[art][o] ? 'feuert' : 'feuert NICHT'}`, z.gefragt(o) === !!SOLL[art][o], { prompts: z.t.prompts.map(p => p.d.title || p.d.type) });
        R.check(`${label} → ${o}: keine Engine-Fehler`, z.t.errors.length === 0, z.t.errors);
      }
      R.check(`${label} → Anti Magic Enchantment ${AMESOLL[art] ? 'wird angeboten' : 'bleibt still'}`, ameZ.gefragt(AME) === !!AMESOLL[art], { prompts: ameZ.t.prompts.map(p => p.d.title || p.d.type) });
    }

    // ── AME beim ANLEGENDEN selbst (eigene Aktion): auch dann wird angeboten ──
    { const hand = [[], []]; hand[A].push(INIT, AME);
      const t = await H.fresh({ hand, gold: [800, 800], deckSize: 30, active: A, abilities: { [A]: { 1: [['Fighting', 'Fighting'], ['Luck'], []] } } });
      t.script.push({ match: (d) => d.type === 'confirm' && d.title === AME, answer: () => false });
      await initiation(t, A, S);
      R.check('Eigenes Initiation Ritual: AME auf der eigenen Hand wird angeboten', t.prompts.some(p => p.d && p.d.title === AME), t.prompts.map(p => p.d.title || p.d.type)); }

    // ── Die Wirkung: AME angenommen → der Schutz hängt am angelegten Helden; ein Spell auf den Wirt wird (einmal pro Zug) wegverhandelt ──
    { const hand = [[], []]; hand[A].push(INIT, AME); hand[S].push('Fireball');
      const t = await H.fresh({ hand, gold: [800, 800], deckSize: 30, active: A, abilities: { [A]: { 1: [['Fighting', 'Fighting'], ['Luck'], []] } } });
      t.script.push({ match: (d) => d.type === 'confirm' && d.title === AME && /Play Anti Magic Enchantment/.test(d.message || ''), answer: () => ({ confirmed: true }) });
      await initiation(t, A, S);
      const gelegt = t.inst(c => c.zone === 'support' && c.owner === A && c.heroIdx === 0 && c.counters && c.counters.treatAsEquip)[0];
      R.check('AME angenommen: der Initiation-Held trägt die Verzauberung (antiMagicEnchanted, 1 Ladung, Buff-Marke)', !!gelegt && gelegt.counters.antiMagicEnchanted && gelegt.counters.antiMagicEnchanted.charges === 1 && gelegt.counters.antiMagicEnchanted.ownerPi === A && !!(gelegt.counters.buffs || {}).anti_magic_enchanted,
        { c: gelegt && gelegt.counters, p: t.prompts.map(p => p.d.title || p.d.type), e: t.errors });
      R.check('AME angenommen: AME aus der Hand in der Ablage, ein Pollution Token liegt', t.pile(A, 'discardPile').includes(AME) && t.inst(c => c.name === 'Pollution Token' && c.zone === 'support' && c.owner === A).length === 1, { d: t.pile(A, 'discardPile') });
      // Der Gegner wirft Fireball auf den Wirtshelden; der Kontrolleur (A) verneint das Wegverhandeln zuerst NICHT: er sagt ja
      const hpVor = t.hp(A, 0);
      t.script.push({ match: (d) => d.type === 'confirm' && d.title === AME && /about to hit/.test(d.message || ''), answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === A && x.heroIdx === 0); return h ? [h.id] : undefined; };
      t.reset();
      t.gs.activePlayer = S;
      await t.play(S, 'Fireball', { hero: 0, active: S });
      const gefragt = t.prompts.some(p => p.d && p.d.title === AME && /about to hit/.test(p.d.message || ''));
      R.check('Fireball auf den Wirtshelden: der Kontrolleur wird gefragt und der Treffer wegverhandelt (HP unverändert)', gefragt && t.hp(A, 0) === hpVor, { gefragt, hpVor, hp: t.hp(A, 0), p: t.prompts.map(p => p.d.title || p.d.type), e: t.errors });
      R.check('Ladung verbraucht (einmal pro Zug)', !!gelegt && !!gelegt.counters.antiMagicEnchanted && gelegt.counters.antiMagicEnchanted.charges === 0, gelegt && gelegt.counters.antiMagicEnchanted); }

    // ── Lunatic Hawk: der Initiation-Held zählt als Artifact (Details: a-05) ──
    { const hand = [[], []]; hand[S].push(INIT);
      const t = await H.fresh({ hand, gold: [800, 800], deckSize: 30, active: S, abilities: { [S]: { 1: [['Fighting', 'Fighting'], ['Luck'], []] } } });
      t.put(S, 2, 0, 'Lunatic Hawk'); t.put(S, 2, 1, 'Lunatic Cycle - Crescent Moon'); t.put(S, 2, 2, 'Lunatic Cycle - Full Moon');
      const vor = t.pile(S, 'hand').length;
      await initiation(t, S, A);
      R.check('Lunatic Hawk (2+): Initiation Ritual des Hawk-Besitzers → 1 Karte gezogen (Hand: −1 Ritual +1 = unverändert)', t.pile(S, 'hand').length === vor, { vor, nach: t.pile(S, 'hand').length }); }
  }
  R.finish();
})();
