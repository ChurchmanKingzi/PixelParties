'use strict';
// W53a · Punkt 1 (Al, 22.10.2026): „Soll Ceremony die Fee überhaupt als Anhängsel mitnehmen?" — „Nein."
//   Tempelunas angehängte Fee (Hero-Karte, `counters._keinEquip` + `treatAsEquip` als Träger-Marke) wird von der Inheritance Ceremony weder zur Auswahl angeboten noch bewegt (analog zur Token-Ausnahme).
//   Die Fee verlässt Tempeluna nur durch Zerstören / Ablegen / Wirtstod (dann ist der gewonnene Effekt weg — Ruling ① der Karte, unverändert).
// Geprüft (beide Sitze):
//   (A) Ceremony: Fee wird NICHT angeboten, selbst bei „alles wählen" bleibt sie bei Tempeluna, Tempeluna behält den Effekt, KEIN onEquipLost/onEquipGained; Gegenprobe: ein Anhängsel (Energy Aura) und ein Equip (Club of Gobbo)
//       daneben werden weiter angeboten und umgehängt. Real angehängte Fee (Heldeneffekt) UND gesetzte Fee.
//   (B) Alle anderen Bewegungswege: Slippery Fridge (nicht angeboten, W52), `engine.actionTransferAttachment` (= Weg von Ceremony-Anhängsel, Cybug LOCUST, Secret Spell Book) → { success: false, feeBlocked },
//       `engine.actionMoveCard` Support → Support → ohne Wirkung, Cybug LOCUST sieht keinen Auslöser, `fuehreUmhaengenAus` greift nie (`istUmhaengbaresEquip` false) — jeweils kein Hook, keine Zustandsänderung.
//   (C) Secret Spell Book („take permanent control … you may place …"): die Fee wird nicht umgesetzt (keine Platzfrage), die KONTROLLE wechselt wie bei jeder Karte; Gegenprobe Club: Platzfrage + Umsetzen.
//   (D) Zerstören der Fee: Effekt weg, ein onEquipLost (attachment) — W52, unverändert.
// Auf dem Stand vor W53a rot (Ceremony bot die Fee an und hängte sie um). Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
const { istUmhaengbaresEquip } = require(U.H.ROOT + '/cards/effects/_equip-shared');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const TEMPELUNA = 'Tempeluna, the Convergence Fairy', FEE = 'Maya, the Nature Fairy', CLUB = 'Club of Gobbo', AURA = 'Energy Aura', CER = 'Inheritance Ceremony', BOOK = 'Secret Spell Book';
const FEECOUNTERS = { treatAsEquip: true, _tempelunaAttached: true, _keinEquip: true };

/** Spion auf Equip-Hooks. */
function spion(t) {
  const lost = [], gained = [];
  const orig = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (n, c) => {
    if (n === 'onEquipLost') lost.push({ name: c.lostName, kind: c.kind, reason: c.reason, move: c.isMove });
    if (n === 'onEquipGained') gained.push({ name: c.equipName, kind: c.kind, move: c.isMove });
    return orig(n, c);
  };
  return { lost, gained };
}

(async () => {
  const R = U.H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' (Gegner Sitz ' + op + ')');
    /** Echter Weg: Tempeluna bei Held 0, Maya auf der Hand, Heldeneffekt aktivieren (Fee anhängen). */
    const echt = async (extra = []) => {
      const t = await U.fresh(me, { hand: [FEE, ...extra], heroes: { [me]: [TEMPELUNA, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] }, opts: { deckSize: 30 } });
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: FEE, source: 'hand' }) });
      await t.run(() => t.engine.runHooks('onGameStart', {}));
      t.reset();
      const r = await t.activateHero(me, 0, {});
      return { t, r, fee: t.inst(c => c.name === FEE && c.zone === 'support')[0] };
    };
    /** Gesetzte Fee (wie W51/b-03). */
    const gesetzt = async (extraHand = []) => {
      const t = await U.fresh(me, { hand: extraHand, heroes: { [me]: [TEMPELUNA, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] } });
      const inst = t.put(me, 0, 0, FEE, { counters: { ...FEECOUNTERS } });
      t.engine.grantHeroEffect(me, 0, FEE, { traeger: inst });
      return { t, fee: inst };
    };
    const hatEffekt = (t) => (t.hero(me, 0).gainedEffectNames || []).includes(FEE);

    // ═══ (A) Ceremony ═══
    { const { t, r, fee } = await echt([CER]);
      R.check('Ausgang: Fee real angehängt, Tempeluna hat den Effekt', r === true && !!fee && hatEffekt(t), { r, g: t.hero(me, 0).gainedEffectNames });
      const s = spion(t); t.reset();
      // „alles wählen": jede angebotene Equip-Karte, Zielheld 1
      t.targetFn = (v, cfg) => ((cfg && cfg.title) === CER && v.some(x => x.type === 'equip')) ? v.filter(x => x.type === 'equip').map(x => x.id) : (() => { const h = v.find(x => x.type === 'hero' && x.heroIdx === 1); return h ? [h.id] : undefined; })();
      await t.play(me, CER, { hero: 0, active: me });
      const angeboten = t.targets.flatMap(x => x.valid).filter(v => v.type === 'equip').map(v => v.cardName);
      R.check('Ceremony: die Fee wird NICHT angeboten', !angeboten.includes(FEE), angeboten);
      R.check('Ceremony: Fee bleibt bei Tempeluna (Held 0), Tempeluna behält den Effekt, Held 1 gewinnt ihn nicht', U.wo(t, me, FEE).join() === '0' && hatEffekt(t) && !(t.hero(me, 1).gainedEffectNames || []).includes(FEE), { w: U.wo(t, me, FEE), g0: t.hero(me, 0).gainedEffectNames, g1: t.hero(me, 1).gainedEffectNames });
      R.check('Ceremony: kein onEquipLost / onEquipGained für die Fee', !s.lost.some(x => x.name === FEE) && !s.gained.some(x => x.name === FEE), { lost: s.lost, gained: s.gained });
      R.check('Ceremony: sauber (die unsichtbaren Träger der Grundfeen Luna/Tempeste sind keine Geister)', t.errors.length === 0 && t.audit().every(x => /^Geister-Instanz "(Luna, the Flame Fairy|Tempeste, the Weather Fairy)"/.test(x)), { e: t.errors, a: t.audit() }); }

    // Gegenprobe: Fee + Energy Aura (Anhängsel) + Club (Equip) liegen an Tempeluna — Aura und Club wandern, die Fee nicht
    { const { t, fee } = await gesetzt([CLUB, AURA, CER]);
      await U.lege(t, me, CLUB, 0); await U.haenge(t, me, AURA, 0);
      const s = spion(t); t.reset();
      t.targetFn = (v, cfg) => ((cfg && cfg.title) === CER && v.some(x => x.type === 'equip')) ? v.filter(x => x.type === 'equip').map(x => x.id) : (() => { const h = v.find(x => x.type === 'hero' && x.heroIdx === 1); return h ? [h.id] : undefined; })();
      await t.play(me, CER, { hero: 0, active: me });
      const angeboten = t.targets.flatMap(x => x.valid).filter(v => v.type === 'equip').map(v => v.cardName);
      R.check('Gegenprobe: Club und Energy Aura werden angeboten, die Fee nicht', angeboten.includes(CLUB) && angeboten.includes(AURA) && !angeboten.includes(FEE), angeboten);
      R.check('Gegenprobe: Club und Aura liegen jetzt an Held 1, die Fee bleibt an Held 0 samt Effekt', U.wo(t, me, CLUB).join() === '1' && U.wo(t, me, AURA).join() === '1' && U.wo(t, me, FEE).join() === '0' && hatEffekt(t), { club: U.wo(t, me, CLUB), aura: U.wo(t, me, AURA), fee: U.wo(t, me, FEE) });
      R.check('Gegenprobe: onEquipLost für Club (equip) und Aura (attachment), keiner für die Fee', s.lost.some(x => x.name === CLUB && x.kind === 'equip') && s.lost.some(x => x.name === AURA && x.kind === 'attachment') && !s.lost.some(x => x.name === FEE), s.lost);
      R.check('Gegenprobe: sauber', U.sauber(t), { e: t.errors, a: t.audit() }); }

    // ═══ (B) alle anderen Wege ═══
    { const { t, fee } = await gesetzt([U.F]);
      const s = spion(t);
      const vorher = JSON.stringify({ c: fee.counters, w: U.wo(t, me, FEE), g: t.hero(me, 0).gainedEffectNames });
      t.reset();
      const r1 = await t.run(() => t.engine.actionTransferAttachment(fee, me, 1, 0, { sourceName: 'Test', anleger: me }));
      R.check('actionTransferAttachment (Weg von Ceremony-Anhängsel, LOCUST, Secret Spell Book): { success: false, feeBlocked }', r1 && r1.success === false && r1.feeBlocked === true, r1);
      const r1b = await t.run(() => t.engine.actionTransferAttachment(fee, op, 0, 0, { sourceName: 'Test', anleger: op }));
      R.check('actionTransferAttachment zur Gegenseite (LOCUST-Weg): ebenfalls blockiert', r1b && r1b.success === false && r1b.feeBlocked === true, r1b);
      await t.run(() => t.engine.actionMoveCard(fee, 'support', 1, 0, { source: 'Test', sourceOwner: op }));
      await t.run(() => t.engine.actionMoveCard(fee, 'support', 2, 1, { source: 'Test', sourceOwner: me, newOwner: op }));
      R.check('actionMoveCard Support → Support (anderer Held / andere Seite): ohne Wirkung', U.wo(t, me, FEE).join() === '0' && fee.heroIdx === 0 && fee.zoneSlot === 0 && U.wo(t, op, FEE).length === 0, { w: U.wo(t, me, FEE), h: fee.heroIdx, z: fee.zoneSlot });
      R.check('istUmhaengbaresEquip(Fee) false (Fridge/Ceremony-Equip-Teil greifen nie)', istUmhaengbaresEquip(t.engine, fee) === false, 0);
      const locust = U.H.loadCardEffect('Cybug LOCUST');
      R.check('Cybug LOCUST: kein Auslöser für die Fee', locust.surpriseEquipTrigger(t.gs, op, 0, { equipOwner: me, heroController: me, cardInstance: fee, cardName: FEE }, t.engine, op) === false, 0);
      const nachher = JSON.stringify({ c: fee.counters, w: U.wo(t, me, FEE), g: t.hero(me, 0).gainedEffectNames });
      R.check('kein Wegversuch ändert die Fee (Zähler, Platz, Effekt) und löst einen Hook aus', vorher === nachher && s.lost.length === 0 && s.gained.length === 0, { vorher, nachher, lost: s.lost, gained: s.gained });
      R.check('sauber', U.sauber(t), { e: t.errors, a: t.audit() });
      // Fridge: nur die Fee liegt → nicht angeboten, Fridge hängt nichts um
      t.reset(); U.wahl(t, { name: null, nach: 1 });
      await t.play(me, U.F, { hero: 1, active: me });
      const ang = t.targets.flatMap(x => x.valid).filter(v => v.type === 'equip').map(v => v.cardName);
      R.check('Slippery Fridge: die Fee wird nicht angeboten und bleibt', !ang.includes(FEE) && U.wo(t, me, FEE).join() === '0' && hatEffekt(t), { ang, w: U.wo(t, me, FEE) }); }

    // ═══ (C) Secret Spell Book ═══
    //   Die Fee gehört MIR ursprünglich (`originalOwner`), liegt aber an Tempeluna des Gegners (Sitz op, vom Gegner kontrolliert) → vom Buch betroffen. Daneben mein Club (Gegenprobe).
    { const t = await U.fresh(me, { hand: [BOOK, CLUB], heroes: { [op]: [TEMPELUNA, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] } });
      const fee = t.put(op, 0, 0, FEE, { counters: { ...FEECOUNTERS } }); fee.originalOwner = me;
      t.engine.grantHeroEffect(op, 0, FEE, { traeger: fee });
      const club = t.put(op, 1, 0, CLUB, { counters: { atkGranted: 30 } }); club.originalOwner = me; t.hero(op, 1).atk += 30;
      t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
      t.reset();
      const r = await t.play(me, BOOK, { hero: 0, active: me });
      const gefragt = t.prompts.filter(p => p.d && p.d.type === 'zonePick').map(p => p.d.previewCardName);
      R.check('Secret Spell Book gespielt', r === true, { r, e: t.errors });
      R.check('Platzfrage für den Club, KEINE für die Fee', gefragt.includes(CLUB) && !gefragt.includes(FEE), gefragt);
      R.check('Fee bleibt an Tempeluna (Sitz ' + op + ', Held 0), Effekt bleibt', U.wo(t, op, FEE).join() === '0' && (t.hero(op, 0).gainedEffectNames || []).includes(FEE), { w: U.wo(t, op, FEE), g: t.hero(op, 0).gainedEffectNames });
      R.check('Kontrolle der Fee wechselt (wie bei jeder betroffenen Karte), die Fee steht weiter dort', (fee.controller ?? fee.owner) === me && fee.zone === 'support' && fee.heroIdx === 0, { c: fee.controller, o: fee.owner, z: fee.zone });
      R.check('Club wurde umgesetzt (zu einem eigenen Helden, Bonus vom Gegnerhelden 1 abgezogen)', U.wo(t, me, CLUB).length === 1 && t.hero(op, 1).atk === t.DB[t.hero(op, 1).name].atk, { w: U.wo(t, me, CLUB), a: t.hero(op, 1).atk });
      R.check('Secret Spell Book: sauber', U.sauber(t), { e: t.errors, a: t.audit() }); }

    // ═══ (D) Zerstören: Effekt weg ═══
    { const { t, fee } = await gesetzt();
      const s = spion(t); t.reset();
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: op }, fee, {}));
      R.check('Fee zerstört: Tempeluna verliert den Effekt, genau ein onEquipLost (attachment, destroyed)', !hatEffekt(t) && s.lost.length === 1 && s.lost[0].name === FEE && s.lost[0].kind === 'attachment' && s.lost[0].reason === 'destroyed', { g: t.hero(me, 0).gainedEffectNames, lost: s.lost }); }
  }
  R.finish();
})();
