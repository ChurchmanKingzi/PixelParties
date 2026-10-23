'use strict';
// NK2-04 · Mind Control (23.10.2026)
// Kartentext: „You can only use this Spell while 2 of your Heroes are defeated and your opponent permanently controls more than 1 undefeated Hero. Attach this card to 1 of your opponent's
//   Heroes. You gain permanent control of that Hero while this card is attached to it. This is treated as a negative status effect. If either player controls more than 2 Heroes, immediately send
//   this card to the discard pile." — Spell (Attachment), Magic Arts Lv1. Vorbild: Paraseed Control.
const H = require('../../lib/h.js');
const cpu = require('../../../../cards/effects/_cpu.js');
(async () => {
  const R = H.runner();
  const MC = 'Mind Control', STATUS = 'mind_controlled';
  const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
  const kontrolleur = (t, seite, hi) => t.engine.heroSideOf(seite, t.hero(seite, hi));
  const mcAm = (t, seite, hi) => t.inst(c => c.name === MC && c.zone === 'support' && c.owner === seite && c.heroIdx === hi);

  /** Sitz 0: Helden 1 und 2 besiegt, Held 0 lebt, Mind Control auf der Hand. Sitz 1: drei lebende Helden. */
  const frisch = async (o = {}) => {
    const t = await H.fresh({ hand: [[MC], []], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100, ...o.fresh });
    if (o.besiegt !== null) for (const hi of (o.besiegt || [1, 2])) t.hero(0, hi).hp = 0;
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === (o.zielSeite ?? 1) && x.heroIdx === (o.ziel ?? 1)); return v ? [v.id] : null; };
    return t;
  };
  const spiele = (t) => t.play(0, MC, { hero: 0 });

  R.section('A · Grundfall: anlegen, dauerhafte Kontrolle, Status');
  {
    const t = await frisch();
    const r = await spiele(t);
    const h = t.hero(1, 1);
    R.check('gespielt', r === true, r);
    R.check('Mind Control liegt in der Support Zone des gewählten Gegnerhelden (Held 1)', mcAm(t, 1, 1).length === 1, mcAm(t, 1, 1).length);
    R.check('der Held gehört dauerhaft Sitz 0 (permaControlBy/charmedBy, Kontrolleur)', h.permaControlBy === 0 && h.charmedBy === 0 && kontrolleur(t, 1, 1) === 0, { perma: h.permaControlBy, charm: h.charmedBy });
    R.check('der echte Status mind_controlled liegt am Helden (negativ, heilbar)', !!h.statuses?.[STATUS] && h.statuses[STATUS]._fromAttachment === MC, h.statuses);
    R.check('der Besitzer der Karte ist Sitz 0 (originalOwner)', mcAm(t, 1, 1)[0].originalOwner === 0, mcAm(t, 1, 1)[0].originalOwner);
    R.check('Sitz 0 kontrolliert jetzt 2 lebende Helden (Held 0 + der übernommene), der Gegner 2', t.engine.heroesControlledBy(0).filter(x => x.hero.hp > 0).length === 2 && t.engine.heroesControlledBy(1).filter(x => x.hero.hp > 0).length === 2);
    R.check('die Karte bleibt liegen (Obergrenze nicht überschritten), nicht in der Ablage', !t.pile(0, 'discardPile').includes(MC));
    R.check('keine Engine-Fehler, Audit sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('B · Spielbedingung');
  const nichtSpielbar = async (name, t) => {
    const r = await spiele(t);
    R.check(`${name}: nicht spielbar, nichts verändert`, r !== true && t.pile(0, 'hand').includes(MC) && mcAm(t, 1, 0).length + mcAm(t, 1, 1).length + mcAm(t, 1, 2).length === 0, { r });
  };
  await nichtSpielbar('nur ein eigener Held besiegt', await frisch({ besiegt: [2] }));
  await nichtSpielbar('kein eigener Held besiegt', await frisch({ besiegt: [] }));
  {
    const t = await frisch(); t.hero(1, 1).hp = 0; t.hero(1, 2).hp = 0;
    await nichtSpielbar('Gegner hat nur 1 unbesiegten Helden', t);
  }
  {
    const t = await frisch({ ziel: 0 }); t.hero(1, 2).hp = 0;
    const r = await spiele(t);
    R.check('Gegner hat genau 2 unbesiegte Helden: spielbar', r === true && mcAm(t, 1, 0).length === 1, { r });
  }
  {
    // Temporäre Kontrolle zählt für den, der sie ausübt, nicht als „permanent": der Gegner hat 3 lebende Helden, einen hat MEIN Charme geliehen
    const t = await frisch({ ziel: 1 });
    t.hero(1, 0).charmedBy = 0; t.hero(1, 0).charmedFromOwner = 1; t.hero(1, 0).charmedHeroIdx = 0;
    R.check('Aufbau: der geliehene Held zählt für den Gegner als dauerhaft seiner (3 lebende)', t.engine.heroesControlledBy(1, { permanentOnly: true }).filter(x => x.hero.hp > 0).length === 3);
    const r = await spiele(t);
    R.check('der von MIR geliehene Held ist kein Ziel (Held 0 ohne Karte); mit ihm kontrolliere ich danach 3 Helden → die Karte geht sofort in die Ablage (Obergrenze)',
      r === true && mcAm(t, 1, 0).length === 0 && mcAm(t, 1, 1).length === 0 && t.pile(0, 'discardPile').includes(MC) && kontrolleur(t, 1, 1) === 1, { r, disc: t.pile(0, 'discardPile'), k: kontrolleur(t, 1, 1) });
  }
  {
    const t = await frisch(); t.gs.firstTurnProtectedPlayer = 1;
    await nichtSpielbar('Erstrunden-Schutz des Gegners', t);
  }
  {
    const t = await frisch(); t.setHero(1, 2, 'Boris, the Guardian of Blackport', 800);
    await nichtSpielbar('Boris des Gegners (Kontroll-Karten gesperrt)', t);
  }
  {
    const t = await frisch();
    for (const hi of [0, 1, 2]) for (let z = 0; z < 3; z++) t.put(1, hi, z, 'Cute Bird');       // keine freie Support Zone beim Gegner
    await nichtSpielbar('kein Gegnerheld hat eine freie Support Zone', t);
  }

  R.section('C · Heilen (negativer Status) gibt die Kontrolle zurück');
  {
    const t = await frisch();
    await spiele(t);
    await t.run(() => t.engine.removeHeroStatus(1, 1, STATUS, { _viaCleanse: true }));
    R.check('Status entfernt → Karte in der Ablage ihres Besitzers (Sitz 0), nicht mehr am Helden', t.pile(0, 'discardPile').includes(MC) && mcAm(t, 1, 1).length === 0, { disc: t.pile(0, 'discardPile'), am: mcAm(t, 1, 1).length });
    const h = t.hero(1, 1);
    R.check('Kontrolle zurück beim Besitzer (Sitz 1): alle Kontrollmarken weg', h.permaControlBy === undefined && h.charmedBy === undefined && kontrolleur(t, 1, 1) === 1, { perma: h.permaControlBy, charm: h.charmedBy });
    R.check('keine Engine-Fehler, Audit sauber', sauber(t), { e: t.errors, a: t.audit() });
  }
  {
    const t = await frisch();
    await spiele(t);
    const hero = t.hero(1, 1);
    await t.run(() => t.engine.cleanseHeroStatuses(hero, 1, 1, [STATUS], 'Test'));
    await new Promise(r => setTimeout(r, 150));          // Aufräumen läuft als Microtask (fire-and-forget)
    R.check('cleanseHeroStatuses (Beer/Juice/Cure-Weg): Karte in der Ablage, Kontrolle zurück', t.pile(0, 'discardPile').includes(MC) && kontrolleur(t, 1, 1) === 1 && mcAm(t, 1, 1).length === 0, { disc: t.pile(0, 'discardPile'), k: kontrolleur(t, 1, 1) });
  }

  R.section('D · Jeder andere Austritt der Karte gibt die Kontrolle zurück');
  {
    const t = await frisch();
    await spiele(t);
    const inst = mcAm(t, 1, 1)[0];
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, inst));
    R.check('Karte zerstört → Kontrolle zurück, Status weg', kontrolleur(t, 1, 1) === 1 && !t.hero(1, 1).statuses?.[STATUS] && mcAm(t, 1, 1).length === 0, { k: kontrolleur(t, 1, 1), st: t.hero(1, 1).statuses });
  }
  {
    const t = await frisch();
    await spiele(t);
    await t.run(() => t.engine.actionDefeatHero({ name: 'Test', owner: 1 }, t.hero(1, 1), { unaufhaltsam: true }));
    R.check('der kontrollierte Held wird besiegt: die Karte geht, die Kontrolle kehrt zurück', t.hero(1, 1).hp <= 0 && mcAm(t, 1, 1).length === 0 && kontrolleur(t, 1, 1) === 1, { hp: t.hero(1, 1).hp, am: mcAm(t, 1, 1).length, k: kontrolleur(t, 1, 1) });
    R.check('Audit sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('E · Obergrenze: kontrolliert ein Spieler mehr als 2 Helden, geht die Karte sofort in die Ablage');
  {
    const t = await frisch();
    await spiele(t);
    R.check('Ausgang: Karte liegt', mcAm(t, 1, 1).length === 1);
    await t.run(() => t.engine.actionReviveHero(0, 1, 100, {}));          // mein besiegter Held 1 lebt wieder → ich kontrolliere 3 lebende
    R.check('nach meiner Wiederbelebung (3 lebende Helden): Karte in der Ablage, Kontrolle zurück', mcAm(t, 1, 1).length === 0 && t.pile(0, 'discardPile').includes(MC) && kontrolleur(t, 1, 1) === 1, { am: mcAm(t, 1, 1).length, disc: t.pile(0, 'discardPile'), k: kontrolleur(t, 1, 1), alive: t.engine.heroesControlledBy(0).filter(x => x.hero.hp > 0).length });
    R.check('keine Engine-Fehler', sauber(t), { e: t.errors, a: t.audit() });
  }
  {
    // Auch der GEGNER darf nicht mehr als 2 kontrollieren: er hatte einen besiegten Helden, der wiederbelebt wird.
    const t = await frisch({ ziel: 1 }); t.hero(1, 2).hp = 0;
    await spiele(t);                                          // Gegner: Helden 0 und 2... Held 1 gestohlen → lebt: Held 0 (2 lebende am Anfang → 1 danach)
    R.check('Ausgang: Gegner kontrolliert 1 lebenden Helden', t.engine.heroesControlledBy(1).filter(x => x.hero.hp > 0).length === 1);
    await t.run(() => t.engine.actionReviveHero(1, 2, 100, {}));
    R.check('Gegner belebt einen Helden wieder (2 lebende): Karte bleibt', mcAm(t, 1, 1).length === 1);
  }

  R.section('F · Schutz: Anti Magic, Resistance, Surprise-Fenster');
  {
    const t = await frisch(); t.setAbilities(1, 1, [['Resistance', 'Resistance', 'Resistance'], [], []]);
    const r = await spiele(t);
    R.check('Resistance Lv3 am Zielhelden: das Anlegen wird abgefangen — keine Karte am Helden, keine Kontrolle, die Karte ist gespielt (Ablage)', r === true && mcAm(t, 1, 1).length === 0 && kontrolleur(t, 1, 1) === 1 && t.pile(0, 'discardPile').includes(MC), { r, disc: t.pile(0, 'discardPile') });
  }
  {
    const t = await frisch(); t.setAbilities(1, 1, [['Anti Magic'], [], []]); t.hero(1, 1).statuses = t.hero(1, 1).statuses || {};
    const r = await spiele(t);
    R.note('Anti-Magic-Fähigkeit am Zielhelden (Lv1 deckt Lv1-Zauber?): Ergebnis', { r, control: kontrolleur(t, 1, 1), an: mcAm(t, 1, 1).length });
  }
  {
    // Flooding (Surprise: „chosen by an Attack or Spell. Negate") am Zielhelden
    const t = await frisch(); t.grantFor(1, 1, 'Flooding'); t.putSurprise(1, 1, 'Flooding');
    const r = await spiele(t);
    R.check('Flooding des Ziels negiert den Zauber: kein Anlegen, keine Kontrolle', mcAm(t, 1, 1).length === 0 && kontrolleur(t, 1, 1) === 1 && t.pile(1, 'discardPile').includes('Flooding'), { r, am: mcAm(t, 1, 1).length, k: kontrolleur(t, 1, 1) });
  }
  {
    // Black-Thorn Dragon: „unaffected by all Spells" — der Held mit ihm in der Support Zone ist gegen den Zauber gefeit
    const t = await frisch();
    const dr = t.put(1, 1, 0, 'Black-Thorn Dragon');
    const r = await spiele(t);
    R.note('Zielheld mit Black-Thorn Dragon (Spell-Immunität) — Mind Control Ergebnis', { r, control: kontrolleur(t, 1, 1), an: mcAm(t, 1, 1).length });
    void dr;
  }

  R.section('G · Zwei Kopien am selben Helden');
  {
    const t = await frisch({ fresh: { hand: [[MC, MC], []] } });
    await spiele(t);
    t.gs.activePlayer = 0; t.resetActions(0);
    await t.play(0, MC, { hero: 0 });
    const n = mcAm(t, 1, 1).length;
    R.check('Zweite Kopie am selben Helden: Kontrolle unverändert bei Sitz 0', kontrolleur(t, 1, 1) === 0, { n, k: kontrolleur(t, 1, 1) });
    // eine Kopie entfernen: die andere hält die Kontrolle
    if (n >= 2) {
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, mcAm(t, 1, 1)[0]));
      R.check('mit einer Kopie weniger hält die zweite die Kontrolle', kontrolleur(t, 1, 1) === 0, kontrolleur(t, 1, 1));
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, mcAm(t, 1, 1)[0]));
      R.check('ohne Kopie: Kontrolle zurück', kontrolleur(t, 1, 1) === 1, kontrolleur(t, 1, 1));
    } else R.note('nur eine Kopie am Helden gelandet (zweite verpufft)', { n });
  }

  R.section('H · Puzzle-Aufbau (kein onPlay): Kontrolle wird angelegt');
  {
    const t = await frisch();
    t.hero(1, 0).hp = 0; t.hero(1, 2).hp = 0;                 // Gegner: nur Held 1 lebt (Grenze: nach der Übernahme kontrolliert Sitz 0 zwei, Sitz 1 einen)
    const inst = t.engine._trackCard(MC, 1, 'support', 1, 0);
    t.gs.players[1].supportZones[1][0] = [MC];
    const scr = require('../../../../cards/effects/mind-control.js');
    await t.run(() => scr.puzzleAnheften(t.engine, inst));
    R.check('Puzzle-Aufbau: Mind Control am Gegnerhelden → Sitz 0 kontrolliert ihn dauerhaft; Besitzer der Karte = Sitz 0', t.hero(1, 1).permaControlBy === 0 && inst.originalOwner === 0, { perma: t.hero(1, 1).permaControlBy, oo: inst.originalOwner });
    t.hero(1, 0).hp = 800; t.hero(1, 0).permaControlBy = undefined; t.hero(1, 0).charmedBy = undefined;
    t.hero(0, 1).hp = 800;
    const inst2 = t.engine._trackCard(MC, 0, 'support', 0, 0);
    t.gs.players[0].supportZones[0][0] = [MC];
    await t.run(() => scr.puzzleAnheften(t.engine, inst2));
    R.check('Mind Control an MEINEM Helden: der Gegner kontrolliert ihn', t.hero(0, 0).permaControlBy === 1 && inst2.originalOwner === 1, { perma: t.hero(0, 0).permaControlBy });
  }

  R.section('I · CPU wählt den wertvollsten Helden');
  {
    const t = await frisch({ ziel: 2 });
    t.hero(1, 2).atk = 300; t.hero(1, 2).hp = 900; t.hero(1, 1).atk = 0; t.hero(1, 1).hp = 200;
    cpu.installCpuBrain(t.engine);
    t.targetFn = null;
    const r = await spiele(t);
    R.check('CPU-Sitz nimmt den Helden mit dem höchsten Wert (Held 2)', r === true && mcAm(t, 1, 2).length === 1 && kontrolleur(t, 1, 2) === 0, { r, k2: kontrolleur(t, 1, 2), am: [0, 1, 2].map(i => mcAm(t, 1, i).length) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
