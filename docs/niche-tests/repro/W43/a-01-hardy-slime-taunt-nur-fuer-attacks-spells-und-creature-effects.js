'use strict';
// W43a · Punkt 1 · Al, 22.10.2026: „NUR Attacks, Spells und Creature effects, mit der Einschränkung, dass sie Hardy Slime selbst treffen können sollen. Den Effekttext ändern wie accordingly zu
//  ‚all Attacks, Spells and Creature effects, if possible.'"
// Kartentext Hardy Slime: „When you summon this Creature, your opponent has to choose it with all Attacks, Spells and Creature effects they use until your next turn, if possible."
// Regel: der Taunt (Skript-Deklaration `tauntNurAttackSpellKreatur`) gilt NUR, wenn die Zielwahl von einem Attack, einem Spell oder einem Creature effect stammt (`engine.tauntGiltFuerQuelle`, EINE Stelle für
//  alle Wege). Als Attack/Spell zählen auch Effekte, die als Attack/Spell ZÄHLEN (Heldeneffekte Broghan & Co., Alice, Gegenstandseffekte, Greatmaw-Treffer). KEIN Taunt bei Artefakt-, Trank-, Ability-,
//  Helden- (ohne Attack/Spell-Wertung), Equip-Effekten, Reaktions-Artefakten. ★ W44a (Al): Surprises zählen NACH IHREM cardType (Attack/Spell/Creature) — Gold Trap, Jumpscare, Bluff binden den Taunt jetzt (umgestellte
//  Zellen: A, C, D „Gold Trap/Jumpscare/Bluff"); der Deepsea Horror Clown hat dieselbe Einschränkung wie der Slime (umgestellt: E1). Die Einschränkung „wenn Hardy Slime selbst ein mögliches Ziel ist" (W41a/W42a) bleibt.
// (A) Klassifikation `tauntGiltFuerQuelle` für alle Quellenarten (Tabelle)  (B) JA-Quellen über die echten Spielwege: alle Attack-zählenden Effekte (W39-Treiber), Attack, Spell, Kreatureneffekt (aktiviert,
//     Tod-Trigger, Spielen), Kreatur-Surprises  (C) NEIN-Quellen über die echten Spielwege: Trank, Artefakt, Equip, Ability, Heldeneffekt, Surprise (Spell), Reaktions-Artefakt — jeweils mit gemischter Liste,
//     in der der Slime ein mögliches Ziel ist (Beweis: es liegt an der Quelle, nicht an der Liste)  (D) Gegenproben: ohne Taunt, Slime nicht wählbar, Held-only  (E) andere Spötter unverändert
// Beide Sitze. Exit 1 auf der Basis 032abddf (B nur teilweise, C, E1), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W43/a-01-hardy-slime-taunt-nur-fuer-attacks-spells-und-creature-effects.js   (Exit 0 = korrekt)
const L = require('../W39/_helfer.js');
const { H } = L;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

/** Taunt-Stempel wie ihn Hardy Slime beim Beschwören setzt (die Skript-Deklaration kommt über den Kartennamen). */
function stempel(t, slime, gegen, name) {
  slime.turnPlayed = 1;
  slime.counters.forcesTargeting = true; slime.counters.forcesTargeting_pi = gegen; slime.counters.forcesTargeting_untilTurn = (t.gs.turn || 0) + 1;
  slime.counters.buffs = { ...(slime.counters.buffs || {}), forcesTargeting: true };
  return slime;
}
/** Angebotene (wählbare) Ziele der Slime-Seite je Zielwahl, in der der Slime-Seite-Ziele stehen. */
const gegnerListen = (t, op, wer) => t.targets.filter(x => (wer == null || x.who === wer) && x.valid.some(v => v.owner === op)).map(x => x.valid.filter(v => v.owner === op).map(v => v.id).sort().join(','));
const nurSlime = (t, op, slimeId, wer) => { const l = gegnerListen(t, op, wer); return l.length >= 1 && l.every(x => x === slimeId); };
/** Gemischte Liste: der Slime UND mindestens ein weiteres Gegnerziel waren wählbar (kein Taunt). */
const gemischt = (t, op, slimeId, wer) => { const l = gegnerListen(t, op, wer); return l.some(x => x.split(',').includes(slimeId) && x.split(',').length >= 2); };

/** Szene: Slime der Gegenseite (`op`) mit Taunt gegen `me`; eine weitere Gegner-Kreatur; eine eigene Kreatur. */
async function szene(me, op, hand, o = {}) {
  const hands = [[], []]; hands[o.handSeite ?? me] = hand.slice();
  const t = await H.fresh({ hand: hands, hp: 800, deckSize: 20, active: o.aktiv ?? me, gold: 200 });
  const andere = t.put(op, 1, 0, H.INERT.creature); andere.turnPlayed = 1;
  const eigene = t.put(me, 2, 1, H.INERT.creature); eigene.turnPlayed = 1;
  let slime = null;
  if (!o.ohneSlime) { slime = t.put(op, 2, 2, 'Hardy Slime'); if (!o.ohneTaunt) stempel(t, slime, me); else slime.turnPlayed = 1; }
  return { t, slime };
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const slimeId = `equip-${op}-2-2`;

    // ── (A) Klassifikation ──
    {
      const { t } = await szene(me, op, []);
      const e = t.engine;
      const HN = L.HN;
      const ja = {
        'Attack-Karte (Hand)': { name: 'Attack', zone: 'hand' },
        'Spell-Karte (Hand)': { name: 'Fireball', zone: 'hand' },
        'Reaktions-Spell (Hand): Cure': { name: 'Cure', zone: 'hand' },
        'Kreatur auf dem Brett (aktivierter/Trigger-Effekt): Skeleton Archer': { name: 'Skeleton Archer', zone: 'support' },
        'Kreatur aus der Hand (Beschwören/Kosten): 500 Piranhas': { name: '500 Piranhas in a Monster Suit', zone: 'hand' },
        'Kreatur in der Ablage (Tod-Trigger): Heli Troopers': { name: 'Mischief Militia - Heli Troopers', zone: 'discard' },
        'Kreatur (W42a-Liste): Cardinal Beast Baihu': { name: 'Cardinal Beast Baihu', zone: 'support' },
        'Kreatur (W42a-Liste): Cardinal Beast Zhuque': { name: 'Cardinal Beast Zhuque', zone: 'support' },
        'Kreatur (W42a-Liste): Bomblebee': { name: 'Bomblebee', zone: 'support' },
        'Kreatur (W42a-Liste): Dive Bomblebee': { name: 'Dive Bomblebee', zone: 'support' },
        'Kreatur (W42a-Liste): Cheeky Monkee': { name: 'Cheeky Monkee', zone: 'support' },
        'Kreatur (W42a-Liste): Lovely Teddy': { name: 'Lovely Teddy', zone: 'support' },
        'Kreatur (W42a-Liste): Spirit of the Forbidden Grimoire': { name: 'Spirit of the Forbidden Grimoire', zone: 'support' },
        'Spell (W42a-Liste): The White Army': { name: 'The White Army', zone: 'hand' },
        'Spell (W42a-Liste): Sun Beam': { name: 'Sun Beam', zone: 'hand' },
        'Surprise (Spell, verdeckt/aufgedeckt): Gold Trap': { name: 'Gold Trap', zone: 'surprise' },   // W44a (Al): Surprise zählt nach cardType — vorher NEIN
        'Surprise (Spell): Jumpscare': { name: 'Jumpscare', zone: 'surprise' },   // W44a: vorher NEIN
        'Surprise (Attack): Bluff': { name: 'Bluff', zone: 'surprise' },   // W44a: vorher NEIN
        'Kreatur-Surprise (aufgedeckt): Water Golem': { name: 'Water Golem', zone: 'surprise' },
        'Kreatur-Surprise (aufgedeckt): Afflicted Vermin': { name: 'Afflicted Vermin', zone: 'surprise' },
        'Artefakt-Kreatur auf dem Brett: Debt-O-Tron Model Missing Parts': { name: 'Debt-O-Tron Model Missing Parts', zone: 'support' },
        'Heldeneffekt, der als Attack zählt: Broghan': { name: HN.Broghan, zone: 'hero' },
        'Heldeneffekt, der als Attack zählt: Brackle': { name: HN.Brackle, zone: 'hero' },
        'Heldeneffekt, der als Attack zählt: Arthor': { name: HN.Arthor, zone: 'hero' },
        'Heldeneffekt, der als Attack zählt: Heragas': { name: HN.Heragas, zone: 'hero' },
        'Heldeneffekt, der als Attack zählt: Kohta': { name: HN.Kohta, zone: 'hero' },
        'Heldeneffekt, der als Spell zählt: Alice': { name: HN.Alice, zone: 'hero' },
        'Gegenstandseffekt als Attack: Javelin Throw': { name: 'Javelin Throw', zone: 'hand' },
        'Gegenstandseffekt als Attack: Sword in a Bottle': { name: 'Sword in a Bottle', zone: 'hand' },
        'Gegenstandseffekt als Attack: Bamboo Staff (Ausrüstung)': { name: 'Bamboo Staff', zone: 'support' },
        'Gegenstandseffekt als Attack: Sacrificial Dagger (Ausrüstung)': { name: 'Sacrificial Dagger', zone: 'support' },
        "Gegenstandseffekt als Attack: Crusader's Cutlass (Ausrüstung)": { name: "Crusader's Cutlass", zone: 'support' },
        'Stempel treatedAsAttack (Alluring Light, Greatmaw, Duel …)': { name: 'Irgendein Held', zone: 'hero', treatedAsAttack: { level: 0 } },
      };
      const nein = {
        'Artefakt (Hand): Book of Doom': { name: 'Book of Doom', zone: 'hand' },
        'Artefakt (Hand): Ushabti of the Great Pharaoh': { name: 'Ushabti of the Great Pharaoh', zone: 'hand' },
        'Trank: Poison Vial': { name: 'Poison Vial', zone: 'hand' },
        'Trank: Acid Vial': { name: 'Acid Vial', zone: 'hand' },
        'Ausrüstung (Equip-Effekt): Pocket Catapult': { name: 'Pocket Catapult', zone: 'support' },
        'Ausrüstung (Equip-Effekt): Future Tech Bazooka': { name: 'Future Tech Bazooka', zone: 'support' },
        'Ability: Occultism': { name: 'Occultism', zone: 'ability' },
        'Ability: Diplomacy': { name: 'Diplomacy', zone: 'ability' },
        'Ability: Singing': { name: 'Singing', zone: 'ability' },
        'gewöhnlicher Heldeneffekt: Siphem': { name: HN.Siphem, zone: 'hero' },
        'gewöhnlicher Heldeneffekt: Locke': { name: 'Locke, the Unseen Saboteur', zone: 'hero' },
        'Hero-Passiv: Pes\'zet': { name: 'Pes\'zet, the Plague Bringer', zone: 'hero' },
        'Ascended Hero: Swampborne Waflav': { name: 'Swampborne Waflav', zone: 'hero' },
        'Ascended Hero: Deep-Drowned Waflav': { name: 'Deep-Drowned Waflav', zone: 'hero' },
        'Reaktions-Artefakt: Bomb Arrow': { name: 'Bomb Arrow', zone: 'hand' },
        'Reaktions-Artefakt: Racket Arrow': { name: 'Racket Arrow', zone: 'hand' },
        'Area-Spell, der schon im Spiel liegt: Acid Rain': { name: 'Acid Rain', zone: 'area' },
        'Anhang (Spell), der schon am Helden liegt: Anti Magic Enchantment': { name: 'Anti Magic Enchantment', zone: 'support' },
      };
      for (const [k, q] of Object.entries(ja)) R.check(`A ${k} → Taunt JA`, e.tauntGiltFuerQuelle(q) === true, q);
      for (const [k, q] of Object.entries(nein)) R.check(`A ${k} → Taunt NEIN`, e.tauntGiltFuerQuelle(q) === false, q);
      R.check('A Quelle unbekannt (null / kein Name / Name nicht in der Kartendatenbank) → Taunt JA (Ist-Zustand)', e.tauntGiltFuerQuelle(null) === true && e.tauntGiltFuerQuelle({ zone: 'hand' }) === true && e.tauntGiltFuerQuelle('Skill Test') === true && e.tauntGiltFuerQuelle({ name: 'ZZ gibt es nicht' }) === true);
      R.check('A Kartenname als Zeichenkette wird wie eine Handkarte gelesen', e.tauntGiltFuerQuelle('Fireball') === true && e.tauntGiltFuerQuelle('Book of Doom') === false);
    }

    // ── (B) JA-Quellen über die echten Spielwege ──
    {   // Effekte, die als Attack/Spell zählen, und echte Attack-/Spell-Karten (W39-Treiber): der Gegner-Teil der Zielwahl ist NUR der Slime
      const namen = ['Echte Attack', 'Echter Spell', 'Broghan', 'Brackle', 'Arthor', 'Heragas', 'Kohta', 'Alice', 'Javelin Throw', 'Sword in a Bottle', 'Bamboo Staff', 'Sacrificial Dagger', 'Infected Greatmaw',
        "Crusader's Arm-Cannon", "Crusader's Cutlass", "Crusader's Flintlock", "Crusader's Hookshot"];
      for (const name of namen) {
        const r = await L.szene(name, me, op, { ziel: 'creature', vorbereiten: async (t) => { stempel(t, t.put(op, 2, 2, 'Hardy Slime'), me); } });
        R.check(`B ${name}: nur der Slime ist als Gegnerziel wählbar (Taunt JA)`, nurSlime(r.t, op, slimeId, me), gegnerListen(r.t, op));
        R.check(`B ${name}: keine Engine-Fehler, Zustand sauber`, sauber(r.t), { errors: r.t.errors, audit: r.t.audit() });
      }
    }
    {   // Kreatureneffekt, aktiviert (Skeleton Archer)
      const { t } = await szene(me, op, []);
      const a = t.put(me, 0, 0, 'Skeleton Archer'); a.turnPlayed = 1; t.phase(2);
      await t.activateCreature(me, 0, 0);
      R.check('B Kreatur aktiviert (Skeleton Archer): nur der Slime wählbar', nurSlime(t, op, slimeId, me), gegnerListen(t, op));
      R.check('B Skeleton Archer: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    {   // Kreatureneffekt, Tod-Trigger (Mischief Militia - Heli Troopers: „When this Creature is defeated, you may choose a target …")
      const { t } = await szene(me, op, []);
      const h = t.put(me, 0, 0, 'Mischief Militia - Heli Troopers'); h.turnPlayed = 1;
      await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: op }, h));
      R.check('B Kreatur, Tod-Trigger (Heli Troopers): nur der Slime wählbar', nurSlime(t, op, slimeId, me), gegnerListen(t, op));
    }
    {   // Kreatur aus der Hand spielen (500 Piranhas: „Choose a Creature your opponent controls and defeat it to play this card")
      const { t } = await szene(me, op, ['500 Piranhas in a Monster Suit']);
      await t.play(me, '500 Piranhas in a Monster Suit', { hero: 0 });
      R.check('B Kreatur gespielt (500 Piranhas, Kosten-/Opfer-Wahl): nur der Slime wählbar', nurSlime(t, op, slimeId, me), gegnerListen(t, op));
    }
    {   // Spells: Sun Beam, The White Army (selbstgebaute gemischte Listen)
      const { t } = await szene(me, op, ['Sun Beam']);
      await t.play(me, 'Sun Beam');
      R.check('B Spell Sun Beam: nur der Slime wählbar', nurSlime(t, op, slimeId, me), gegnerListen(t, op));
      const s2 = await szene(me, op, ['The White Army']);
      for (let i = 0; i < 3; i++) { const c = s2.t.put(me, 0, i, H.INERT.creature); c.turnPlayed = 1; }
      await s2.t.play(me, 'The White Army');
      R.check('B Spell The White Army: nur der Slime wählbar', nurSlime(s2.t, op, slimeId, me), gegnerListen(s2.t, op));
    }
    {   // Kreatur-Surprise: Afflicted Vermin („Activate this Surprise when either player summons a Creature. Choose a different Creature and defeat it")
      const { t } = await szene(me, op, [H.INERT.creature]);
      t.putSurprise(me, 0, 'Afflicted Vermin'); t.grantFor(me, 0, 'Afflicted Vermin');
      await t.play(me, H.INERT.creature, { hero: 1, slot: 0 });
      R.check('B Kreatur-Surprise (Afflicted Vermin): nur der Slime wählbar (Creature effect)', nurSlime(t, op, slimeId, me), { l: gegnerListen(t, op), prompts: t.targets.map(x => x.config && x.config.title) });
    }
    {   // Kreatur-Surprise: Water Golem — der Gegner schickt eine Surprise per Skeleton Archer in die Ablage
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: op, gold: 200 });
      const andere = t.put(op, 1, 0, H.INERT.creature); andere.turnPlayed = 1;
      stempel(t, t.put(op, 2, 2, 'Hardy Slime'), me);
      const arch = t.put(op, 0, 0, 'Skeleton Archer'); arch.turnPlayed = 1;
      t.putSurprise(me, 0, 'Water Golem'); t.putSurprise(me, 1, 'Gold Trap'); t.grantFor(me, 0, 'Water Golem');
      t.targetFn = (v) => { const sp = v.find(x => x.type === 'surprise' && x.owner === me && x.heroIdx === 1); return [(sp || v[0]).id]; };
      t.gs.activePlayer = op; t.phase(2);
      await t.activateCreature(op, 0, 0);
      const golem = t.targets.filter(x => x.config && x.config.title === 'Water Golem');
      R.check('B Kreatur-Surprise (Water Golem, „choose a target your opponent controls"): nur der Slime wählbar', golem.length === 1 && golem[0].who === me && golem[0].valid.filter(v => v.owner === op).map(v => v.id).join(',') === slimeId, t.targets.map(x => (x.config && x.config.title) + ':' + x.valid.map(v => v.id).join('+')));
    }

    // ── (C) NEIN-Quellen über die echten Spielwege (gemischte Liste, Slime ein mögliches Ziel) ──
    {
      const probe = async (name, hand, f, wer) => {
        const { t } = await szene(me, op, hand);
        await f(t);
        R.check(`C ${name}: KEIN Taunt (Slime und weitere Gegnerziele wählbar)`, gemischt(t, op, slimeId, wer ?? me), gegnerListen(t, op, wer ?? me));
        R.check(`C ${name}: keine Engine-Fehler, Zustand sauber`, sauber(t), { errors: t.errors, audit: t.audit() });
        return t;
      };
      await probe('Trank Poison Vial', ['Poison Vial'], t => t.play(me, 'Poison Vial'));
      await probe('Trank Acid Vial', ['Acid Vial'], t => t.play(me, 'Acid Vial'));
      await probe('Artefakt Book of Doom', ['Book of Doom'], t => t.play(me, 'Book of Doom'));
      await probe('Artefakt Ushabti of the Great Pharaoh', ['Ushabti of the Great Pharaoh'], t => t.play(me, 'Ushabti of the Great Pharaoh'));
      await probe('Ausrüstung Pocket Catapult (Equip-Effekt)', [], async t => { t.put(me, 0, 0, 'Pocket Catapult'); t.phase(3); await t.activateEquip(me, 0, 0); });
      await probe('Ability Occultism (freie Aktivierung)', [], async t => { t.setAbilities(me, 0, [['Occultism'], [], []]); t.gs.activePlayer = me; t.phase(2); await t.run(() => t.host.doActivateFreeAbility(t.room, me, { heroIdx: 0, zoneIdx: 0 })); });
      const sip = await L.szene('Siphem', me, op, { ziel: 'creature', vorbereiten: async (t) => { stempel(t, t.put(op, 2, 2, 'Hardy Slime'), me); } });
      R.check('C gewöhnlicher Heldeneffekt Siphem: KEIN Taunt (Slime und weitere Gegnerziele wählbar)', gemischt(sip.t, op, slimeId, me), gegnerListen(sip.t, op, me));
      R.check('C Siphem: sauber', sauber(sip.t), { errors: sip.t.errors, audit: sip.t.audit() });
    }
    {   // Surprise (Spell): Gold Trap („You gain that Gold instead. Then, you may choose any Creature on the board and add it to your hand") — W44a (Al): zählt nach cardType als Spell → Taunt
      const { t } = await szene(me, op, []);
      t.putSurprise(me, 0, 'Gold Trap'); t.grantFor(me, 0, 'Gold Trap');
      await t.run(() => t.engine.actionGainGold(op, 30, { name: 'x', owner: op }));
      R.check('C Surprise Gold Trap (Spell/Surprise): Taunt JA (W44a; nur der Slime wählbar)', nurSlime(t, op, slimeId, me), gegnerListen(t, op, me));
      R.check('C Gold Trap: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    {   // Surprise (Spell): Jumpscare (aufgeschobene Zielwahl nach dem Angriff des Gegners) — W44a (Al): zählt nach cardType als Spell → Taunt
      const t = await H.fresh({ hand: me === 0 ? [[], ['Attack']] : [['Attack'], []], hp: 800, deckSize: 20, active: op, gold: 200 });
      const andere = t.put(op, 1, 0, H.INERT.creature); andere.turnPlayed = 1;
      stempel(t, t.put(op, 2, 2, 'Hardy Slime'), me);
      t.putSurprise(me, 0, 'Jumpscare'); t.grantFor(me, 0, 'Jumpscare');
      for (let hi = 0; hi < 3; hi++) t.hero(op, hi).atk = 100;
      t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0); return [(h || v[0]).id]; };
      await t.play(op, 'Attack', { hero: 0 });
      const js = t.targets.filter(x => x.config && x.config.title === 'Jumpscare');
      R.check('C Surprise Jumpscare (Spell/Surprise): Taunt JA (W44a; auf der Gegnerseite nur der Slime wählbar)', js.length === 1 && js[0].who === me && js[0].valid.filter(v => v.owner === op).map(v => v.id).join(',') === slimeId, t.targets.map(x => (x.config && x.config.title) + ':' + x.valid.map(v => v.id).join('+')));
    }
    {   // Reaktions-Artefakt: Racket Arrow („Choose a Creature your opponent controls and return it …") in der Antwort auf den eigenen Attack
      const { t } = await szene(me, op, ['Attack', 'Racket Arrow']);
      for (let hi = 0; hi < 3; hi++) t.hero(me, hi).atk = 100;
      await t.play(me, 'Attack', { hero: 0 });
      const pfeil = t.targets.filter(x => x.config && x.config.title === 'Racket Arrow');
      R.check('C Reaktions-Artefakt Racket Arrow: KEIN Taunt (Slime und die andere Gegner-Kreatur wählbar)', pfeil.length === 1 && pfeil[0].valid.filter(v => v.owner === op).map(v => v.id).sort().join(',') === ['equip-' + op + '-1-0', slimeId].sort().join(','), t.targets.map(x => (x.config && x.config.title) + ':' + x.valid.map(v => v.id).join('+')));
    }

    // ── (D) Gegenproben ──
    {   // ohne Taunt-Stempel: nichts ist gefiltert, auch nicht bei Attack/Spell
      const { t } = await szene(me, op, ['Attack'], { ohneTaunt: true });
      for (let hi = 0; hi < 3; hi++) t.hero(me, hi).atk = 100;
      await t.play(me, 'Attack', { hero: 0 });
      R.check('D ohne Taunt (Stempel fehlt): Attack bietet den Slime UND weitere Ziele an', gemischt(t, op, slimeId, me), gegnerListen(t, op, me));
    }
    {   // Slime nicht wählbar (`untargetable_all`): auch bei einem Attack kein Taunt
      const { t, slime } = await szene(me, op, ['Attack']);
      slime.counters.untargetable_all = true;
      for (let hi = 0; hi < 3; hi++) t.hero(me, hi).atk = 100;
      await t.play(me, 'Attack', { hero: 0 });
      const l = gegnerListen(t, op, me);
      R.check('D Slime selbst nicht wählbar: kein Taunt, die übrigen Gegnerziele bleiben wählbar', l.length === 1 && l[0].split(',').length >= 3 && !l[0].split(',').includes(slimeId), l);
    }
    {   // Held-only-Effekt (Attack-Karte, aber Liste nur mit Helden → der Slime ist kein mögliches Ziel): kein Taunt (engine-Ebene, Quelle = Attack-Karte)
      const { t } = await szene(me, op, []);
      const heldenListe = [0, 1, 2].map(i => ({ id: `hero-${op}-${i}`, type: 'hero', owner: op, heroIdx: i, cardName: 'x' }));
      let angebot = null;
      t.targetFn = (v) => { angebot = v.filter(x => !x.ineligible).map(x => x.id).sort().join(','); return [v[0].id]; };
      const quelle = t.engine._trackCard('Attack', me, 'hand');
      await t.run(async () => { await t.engine.promptEffectTarget(me, heldenListe, { title: 'Held-only', sourceCard: quelle, cancellable: true }); });
      R.check('D Held-only-Liste mit Attack-Quelle: der Slime ist kein mögliches Ziel → alle drei Helden wählbar', angebot === [0, 1, 2].map(i => `hero-${op}-${i}`).join(','), angebot);
    }
    {   // direkte Zielwahl mit ausdrücklicher Quelle: dieselbe gemischte Liste, nur die Quelle wechselt
      const quellen = { 'Attack': true, 'Fireball': true, 'Skeleton Archer': true, 'Book of Doom': false, 'Poison Vial': false, 'Occultism': false, 'Gold Trap': true, 'Bomb Arrow': false };   // W44a: Gold Trap (Spell-Surprise) → Taunt
      for (const [name, taunt] of Object.entries(quellen)) {
        const { t } = await szene(me, op, []);
        const l = [0, 1, 2].map(i => ({ id: `hero-${op}-${i}`, type: 'hero', owner: op, heroIdx: i, cardName: 'x' }));
        for (const inst of t.engine.cardInstances) if (inst.zone === 'support' && inst.owner === op && inst.name !== 'Test') l.push({ id: `equip-${op}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: op, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
        let angebot = null;
        t.targetFn = (v) => { angebot = v.filter(x => !x.ineligible).map(x => x.id).sort().join(','); return [v[0].id]; };
        const zone = name === 'Skeleton Archer' ? 'support' : name === 'Occultism' ? 'ability' : name === 'Gold Trap' ? 'surprise' : 'hand';
        await t.run(async () => { await t.engine.promptEffectTarget(me, l, { title: 'Mischliste', sourceCard: { name, owner: me, controller: me, heroIdx: 0, zone }, cancellable: true }); });
        R.check(`D gleiche gemischte Liste, Quelle ${name}: ${taunt ? 'Taunt (nur der Slime)' : 'KEIN Taunt (alle Gegnerziele)'}`, taunt ? angebot === slimeId : angebot.split(',').length === 5 && angebot.split(',').includes(slimeId), angebot);
      }
    }

    // ── (E) andere Spötter bleiben unverändert (nur Hardy Slime deklariert die Einschränkung) ──
    {   // Deepsea Horror Clown: W44a (Al): gleiche Einschränkung wie Hardy Slime („all Attacks, Spells and Creature effects they use") — ein Trank muss ihn NICHT wählen (Repro W44/a-03)
      const t = await H.fresh({ hand: me === 0 ? [['Poison Vial'], []] : [[], ['Poison Vial']], hp: 800, deckSize: 20, active: me, gold: 200 });
      const andere = t.put(op, 1, 0, H.INERT.creature); andere.turnPlayed = 1;
      stempel(t, t.put(op, 2, 2, 'Deepsea Horror Clown'), me);
      await t.play(me, 'Poison Vial');
      R.check('E1 Deepsea Horror Clown (W44a): ein Trank muss ihn nicht wählen (Clown und weitere Gegnerziele wählbar)', gemischt(t, op, slimeId, me), gegnerListen(t, op, me));
    }
    {   // Doomed Town Guard („Your opponent can't choose other Creatures you control", v849 Book of Doom): bleibt für Artefakte
      const t = await H.fresh({ hand: me === 0 ? [['Book of Doom'], []] : [[], ['Book of Doom']], hp: 800, deckSize: 20, active: me, gold: 200 });
      const andere = t.put(op, 1, 0, H.INERT.creature); andere.turnPlayed = 1;
      const g = t.put(op, 2, 2, 'Doomed Town Guard'); g.turnPlayed = 1;
      g.counters.forcesTargeting = true; g.counters.forcesTargeting_creaturesOnly = true; g.counters.buffs = { forcesTargeting: true, forcesTargeting_creaturesOnly: true };
      await t.play(me, 'Book of Doom');
      const l = gegnerListen(t, op, me);
      R.check('E2 Doomed Town Guard (v849): auch ein Artefakt kann die anderen Kreaturen nicht wählen (Wächter + Helden bleiben wählbar)', l.length === 1 && l[0].split(',').includes(slimeId) && !l[0].split(',').includes(`equip-${op}-1-0`) && l[0].split(',').includes(`hero-${op}-0`), l);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
