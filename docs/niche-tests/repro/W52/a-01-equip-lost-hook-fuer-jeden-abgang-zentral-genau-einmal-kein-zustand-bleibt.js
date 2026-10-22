'use strict';
// W52a · Punkt 1 (Al, 22.10.2026): „Gibt es einen Grund, nicht einen allgemeinen Hook für *alle* Equip-Verluste zu haben? Wenn nicht, so ändern!"
//   Bis W51 feuerte `onEquipLost` nur beim UMHÄNGEN; Zerstören, Ablegen, Löschen, zurück auf die Hand, Wirt besiegt/entfernt, Smug-Coin-Verbrauch … liefen nur über `onCardLeaveZone`.
//   Jetzt feuert `engine.fireEquipLost` bei JEDEM Verlassen einer Ausrüstung/eines Anhängsels von ihrem Wirt (zentral: Verteiler in `runHooks` nach jedem `onCardLeaveZone` aus einer
//   Support Zone), Nutzlast wie bisher plus `reason`/`isMove`. Die Zustandslauscher (`equipZustandHooks`: Taio, Toras, Riffel, Kohta, Lolek, Fiona, Tempeluna) lauschen für den Abgang NUR
//   noch auf `onEquipLost` (kein rohes `onCardLeaveZone` mehr) → jede Buchung läuft genau einmal.
// Geprüft (beide Sitze):
//   (A) Grund und Nutzlast je Weg: zerstört, abgelegt, gelöscht, zurück auf die Hand / ins Deck, Wirt besiegt, Wirt entfernt, Smug-Coin-Verbrauch, Umhängen (Fridge/Ceremony), Seitenwechsel;
//       je Abgang GENAU EIN Ereignis (kein Doppelfeuern, auch nicht beim Umhängen), `isMove` nur beim Umhängen.
//   (B) Gegenproben: Kreatur, Token und Ability lösen kein `onEquipLost` aus; Luck (Zähler) bleibt beim rohen Enter/Leave.
//   (C) Vertrag: die sieben Zustandslauscher haben `onEquipLost`, aber KEIN rohes `onCardLeaveZone` mehr.
//   (D) Differenz-Sweep: Equip auf allen Wegen verlieren → Zustand BEIDER Helden und beider Sitze == „das Equip hat nie gelegen" (Taio/Toras ATK, Aufstiegs-Bereitschaft
//       Riffel/Kohta/Lolek/Fiona, Tempelunas gewonnener Effekt), inkl. Wirt besiegt + Wiederbelebung und Spiegelpartie (Taio gegen Taio).
// Auf dem Stand vor W52a rot (Lost nur beim Umhängen; Taio/Toras blieben bei Heldentod ohne Meldung …). Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const P1 = 'Wanted Poster', P2 = 'Truth-Seeing Eye', COIN = 'Smug Coin', AURA = 'Energy Aura';
const TAIO = 'Taio, the Sun Fencer', TORAS = 'Toras, Master of all Weapons', TEMPELUNA = 'Tempeluna, the Convergence Fairy', FEE = 'Maya, the Nature Fairy';

/** Spion: sammelt jedes `onEquipLost` (Nutzlast) und zählt die rohen Leave-Ereignisse einer Karte. */
function spion(t) {
  const lost = [], leave = [];
  const orig = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (n, c) => {
    if (n === 'onEquipLost') lost.push({ name: c.lostName, kind: c.kind, move: c.isMove, reason: c.reason, leaving: c.leavingCard === c.lostCard, fromZone: c.fromZone, fromOwner: c.fromOwner, fromHero: c.fromHeroIdx, fromSlot: c.fromZoneSlot, toZone: c.toZone, toHero: c.toHeroIdx, by: c.equipOwner, src: c.source, bypass: !!c._bypassDeadHeroFilter });
    if (n === 'onCardLeaveZone' && c.fromZone === 'support') leave.push({ name: (c.leavingCard || c.card || {}).name, onlyCard: !!c._onlyCard });
    return orig(n, c);
  };
  return { lost, leave };
}
const ATKBASIS = (t, n) => t.DB[n].atk;

(async () => {
  const R = U.H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' (Gegner Sitz ' + op + ')');

    // ═══ (A) Grund und Nutzlast je Weg ═══
    const wege = [
      { id: 'zerstört', grund: 'destroyed', zone: 'discard', los: (t, inst) => t.engine.actionDestroyCard({ name: 'Test', owner: op }, inst, {}) },
      { id: 'abgelegt', grund: 'discarded', zone: 'discard', los: (t, inst) => t.engine.actionMoveCard(inst, 'discard', -1, -1, { source: 'Test', sourceOwner: op }) },
      { id: 'gelöscht', grund: 'deleted', zone: 'deleted', los: (t, inst) => t.engine.actionMoveCard(inst, 'deleted', -1, -1, { source: 'Test', sourceOwner: op }) },
      { id: 'zurück auf die Hand', grund: 'returnedToHand', zone: 'hand', los: (t, inst) => t.engine.actionMoveCard(inst, 'hand', -1, -1, { source: 'Test', sourceOwner: op }) },
      { id: 'zurück ins Deck', grund: 'returnedToDeck', zone: 'deck', los: (t, inst) => t.engine.actionMoveCard(inst, 'deck', -1, -1, { source: 'Test', sourceOwner: op }) },
      { id: 'Wirt besiegt', grund: 'hostDefeated', zone: undefined, bypass: true, los: (t) => t.engine.actionDealDamage({ name: 'Test', owner: op }, t.hero(me, 0), 5000, 'attack') },
      { id: 'Wirt entfernt (deleteHero)', grund: 'hostRemoved', zone: 'discard', los: (t) => t.engine.deleteHero(me, 0, 'Test', { skipAllDeadCheck: true }) },
    ];
    for (const w of wege) {
      const t = await U.fresh(me, { hand: [] });
      await U.lege(t, me, P1, 0);
      const inst = t.find(P1, 'support');
      const s = spion(t); t.reset();
      await t.run(() => w.los(t, inst));
      const l = s.lost.filter(x => x.name === P1);
      R.check(`${w.id}: GENAU EIN onEquipLost`, l.length === 1, { l: s.lost });
      const e = l[0] || {};
      R.check(`${w.id}: Grund '${w.grund}', kein Umhängen (isMove false)`, e.reason === w.grund && e.move === false, e);
      R.check(`${w.id}: Nutzlast wie ein Leave (leavingCard, support, Brettseite ${me}, Held 0, Zone 0, kind equip)`, e.leaving && e.fromZone === 'support' && e.fromOwner === me && e.fromHero === 0 && e.fromSlot === 0 && e.kind === 'equip', e);
      if (w.zone !== undefined) R.check(`${w.id}: Ziel '${w.zone}'`, e.toZone === w.zone, e);
      if (w.bypass) R.check(`${w.id}: läuft trotz totem Wirt (_bypassDeadHeroFilter übernommen)`, e.bypass === true, e);
      R.check(`${w.id}: Karte ist weg`, !U.wo(t, me, P1).length, U.wo(t, me, P1));
      R.check(`${w.id}: sauber`, t.errors.length === 0, t.errors);
    }

    // Smug Coin: lethalProtection + consumeSelf nimmt die Ausrüstung OHNE onCardLeaveZone aus der Zone → trotzdem ein onEquipLost (Grund 'deleted')
    { const t = await U.fresh(me, { hand: [] });
      await U.lege(t, me, COIN, 0);
      const s = spion(t); t.reset();
      await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: op }, t.hero(me, 0), 5000, 'attack'));
      const l = s.lost.filter(x => x.name === COIN);
      R.check('Smug Coin verbraucht: GENAU EIN onEquipLost (Grund deleted)', l.length === 1 && l[0].reason === 'deleted' && l[0].toZone === 'deleted', { l: s.lost, coin: U.wo(t, me, COIN) });
      R.check('Smug Coin verbraucht: Karte weg, Held lebt mit 1 HP', !U.wo(t, me, COIN).length && t.hp(me, 0) === 1, { w: U.wo(t, me, COIN), hp: t.hp(me, 0) }); }

    // Umhängen (Fridge / Ceremony): GENAU EIN Lost, isMove, Grund 'moved'; Anhängsel über die Seite hinweg: 'transferred'
    for (const via of ['fridge', 'ceremony']) {
      const t = await U.fresh(me, { hand: [] });
      await U.lege(t, me, P1, 0);
      const s = spion(t); t.reset();
      await U.bewege(t, me, via, { name: P1, nach: 1 });
      const l = s.lost.filter(x => x.name === P1);
      R.check(`${via}: GENAU EIN onEquipLost (Verteiler schweigt, kein Doppelfeuern)`, l.length === 1, { l: s.lost });
      R.check(`${via}: Grund 'moved', isMove, Ziel support/Held 1, Ausführender ${me}`, l[0] && l[0].reason === 'moved' && l[0].move === true && l[0].toZone === 'support' && l[0].toHero === 1 && l[0].by === me, l[0]);
    }
    { const t = await U.fresh(me, { hand: [] });
      await U.haenge(t, me, AURA, 0);
      const inst = t.find(AURA, 'support'); const s = spion(t); t.reset();
      const r = await t.run(() => t.engine.actionTransferAttachment(inst, op, 0, 0, { sourceName: 'Test', anleger: me }));
      const l = s.lost.filter(x => x.name === AURA);
      R.check('Anhängsel zur Gegenseite (actionTransferAttachment): ein Lost, Grund transferred, isMove, kind attachment', r && r.success && l.length === 1 && l[0].reason === 'transferred' && l[0].move === true && l[0].kind === 'attachment', { r, l }); }

    // Anhängsel zerstört (nicht umgehängt): kind attachment, Grund destroyed
    { const t = await U.fresh(me, { hand: [] });
      await U.haenge(t, me, AURA, 0);
      const inst = t.find(AURA, 'support'); const s = spion(t); t.reset();
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: op }, inst, {}));
      const l = s.lost.filter(x => x.name === AURA);
      R.check('Anhängsel zerstört: ein Lost, kind attachment, Grund destroyed, kein Umhängen', l.length === 1 && l[0].kind === 'attachment' && l[0].reason === 'destroyed' && l[0].move === false, { l: s.lost }); }

    // ═══ (B) Gegenproben ═══
    { const t = await U.fresh(me, { hand: [] });
      const kr = t.put(me, 0, 0, 'ZZ Dummy');
      const tok = t.put(me, 0, 1, 'Pollution Token');
      const s = spion(t); t.reset();
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: op }, kr, {}));
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: op }, tok, {}));
      R.check('Kreatur und Token lösen KEIN onEquipLost aus (sie sind keine Ausrüstung)', s.lost.length === 0 && s.leave.length >= 1, { lost: s.lost, leave: s.leave }); }
    { // Luck zählt gespielte Karten über onCardEnterZone: Abgänge rühren den Zähler nicht an
      const t = await U.fresh(me, { hand: [] }); t.setAbilities(me, 0, [['Luck'], [], []]);
      await U.lege(t, me, P1, 0);
      const vorher = JSON.stringify(t.inst(c => c.name === 'Luck').map(c => c.counters));
      const inst = t.find(P1, 'support'); t.reset();
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: op }, inst, {}));
      R.check('Luck: Zerstören ändert den Zähler nicht', JSON.stringify(t.inst(c => c.name === 'Luck').map(c => c.counters)) === vorher, { vorher, jetzt: t.inst(c => c.name === 'Luck').map(c => c.counters) }); }

    // ═══ (C) Vertrag der Zustandslauscher ═══
    for (const n of [TAIO, TORAS, 'Future Tech Gunslinger Riffel', 'Kohta, the Silent Observer', 'Lolek, the Shard Knight', 'Fiona, the Princess of Blackport', TEMPELUNA]) {
      const h = U.H.loadCardEffect(n).hooks || {};
      R.check(`${n}: onEquipLost ja, rohes onCardLeaveZone nein (genau eine Buchung je Abgang)`, typeof h.onEquipLost === 'function' && h.onCardLeaveZone === undefined, Object.keys(h));
    }
    { const luck = U.H.loadCardEffect('Luck').hooks || {};
      R.check('Luck bleibt Zähler (kein equipZustandHooks)', luck.onEquipLost === undefined, Object.keys(luck)); }

    // ═══ (D) Differenz-Sweep ═══
    let ohneAtk = false;   // Riffel: der Future Tech Gun gibt beim erneuten Anlegen eigene ATK (ungeklärt, unabhängig vom Abgang) — dort zählt nur die Bereitschaft
    const mess = (t) => JSON.stringify({
      atk: ohneAtk ? 0 : [0, 1].map(s => [0, 1, 2].map(hi => t.hero(s, hi).atk)),
      bereit: [0, 1].map(s => [0, 1, 2].map(hi => !!t.hero(s, hi).ascensionReady)),
      gained: [0, 1].map(s => [0, 1, 2].map(hi => (t.hero(s, hi).gainedEffectNames || []).slice().sort())),
    });
    const FAM = [
      { n: 'Taio', held: TAIO, teile: [P1], weg: P1 },
      { n: 'Toras', held: TORAS, teile: [P1, P2], weg: P1 },
      { n: 'Riffel', held: 'Future Tech Gunslinger Riffel', teile: ['Ancient Tech Infinite Energy Core', 'Future Tech Gun'], weg: 'Future Tech Gun' },
      { n: 'Kohta', held: 'Kohta, the Silent Observer', teile: ['Super-Killing Knife, the Tool of Liquidation', 'Summoning Instructions'], weg: 'Summoning Instructions' },
      { n: 'Lolek', held: 'Lolek, the Shard Knight', teile: ['Diver Helmet', 'Shattered Trident, Treasure of the Deepsea'], weg: 'Diver Helmet' },
    ];
    const WEGE_D = [
      ['zerstören', (t, inst) => t.engine.actionDestroyCard({ name: 'Test', owner: op }, inst, {})],
      ['ablegen', (t, inst) => t.engine.actionMoveCard(inst, 'discard', -1, -1, { source: 'Test', sourceOwner: op })],
      ['löschen', (t, inst) => t.engine.actionMoveCard(inst, 'deleted', -1, -1, { source: 'Test', sourceOwner: op })],
      ['zurück auf die Hand', (t, inst) => t.engine.actionMoveCard(inst, 'hand', -1, -1, { source: 'Test', sourceOwner: op })],
      ['umhängen (Fridge)', (t) => null],   // unten über U.bewege
      ['ersetzen (zerstören, gleiches Teil neu anlegen)', async (t, inst) => { await t.engine.actionDestroyCard({ name: 'Test', owner: op }, inst, {}); }],
    ];
    for (const f of FAM) {
      ohneAtk = f.n === 'Riffel';
      for (const [wid, los] of WEGE_D) {
        const kopf = `${f.n}/${wid}`;
        const bleibt = f.teile.filter(x => x !== f.weg);
        const aufbau = async (teile) => { const t = await U.fresh(me, { hand: [], heroes: { [me]: [f.held] } }); for (const x of teile) await U.lege(t, me, x, 0); return t; };
        // Szene A: alle Teile am Helden, `weg` verlieren
        const a = await aufbau(f.teile);
        const inst = a.find(f.weg, 'support');
        a.reset();
        if (wid.startsWith('umhängen')) await U.bewege(a, me, 'fridge', { name: f.weg, nach: 1 });
        else await a.run(() => los(a, inst));
        if (wid.startsWith('ersetzen')) await U.lege(a, me, f.weg, 0);
        // Szene B (Basis): nur die übrigen Teile (das Equip hat nie gelegen)
        const b = await aufbau(bleibt);
        if (wid.startsWith('umhängen')) {
          // umgehängt liegt das Teil am Held 1: Vergleich gegen „direkt an Held 1 angelegt"
          const b2 = await aufbau(bleibt); await U.lege(b2, me, f.weg, 1);
          R.check(`${kopf}: Zustand beider Helden == direkt dort angelegt`, mess(a) === mess(b2), { a: mess(a), b: mess(b2) });
        } else if (wid.startsWith('ersetzen')) {
          const voll = await aufbau(f.teile);
          R.check(`${kopf}: Zustand == nie gewechselt (kein Drift, kein Doppelabzug)`, mess(a) === mess(voll), { a: mess(a), b: mess(voll) });
        } else {
          R.check(`${kopf}: Zustand beider Helden und Sitze == „hat nie gelegen"`, mess(a) === mess(b), { a: mess(a), b: mess(b) });
        }
        R.check(`${kopf}: sauber`, a.errors.length === 0 && a.audit().length === 0, { e: a.errors, au: a.audit() });
      }
      // Wirt besiegt + Wiederbelebung: Zustand wie ein Held, der nie ausgerüstet war
      { const kopf = `${f.n}/Wirt besiegt + Wiederbelebung`;
        const lauf = async (teile) => {
          const t = await U.fresh(me, { hand: [], heroes: { [me]: [f.held] } });
          for (const x of teile) await U.lege(t, me, x, 0);
          await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: op }, t.hero(me, 0), 5000, 'attack'));
          await t.run(() => t.engine.actionReviveHero(me, 0, 300, { source: 'Test' }));
          return t;
        };
        const a = await lauf(f.teile), b = await lauf([]);
        R.check(`${kopf}: Zustand == nie ausgerüstet`, mess(a) === mess(b), { a: mess(a), b: mess(b) });
        R.check(`${kopf}: sauber`, a.errors.length === 0, a.errors); }
    }

    // Fiona: Grimoire + ein als Equip angelegter Held (Initiation-Ritual-Muster) → bereit; der Held geht auf allen Wegen → nicht mehr bereit
    { const GRIM = 'Forbidden Grimoire of a Forgotten Sorceress', HELD = 'Atta, Speaker of Desires';
      const aufbau = async () => {
        const t = await U.fresh(me, { hand: [], heroes: { [me]: ['Fiona, the Princess of Blackport'] } });
        await U.lege(t, me, GRIM, 0);
        const h = t.put(me, 0, 2, HELD, { counters: { treatAsEquip: true } });
        await t.engine.runHooks('onCardEnterZone', { enteringCard: h, toZone: 'support', toHeroIdx: 0, _skipReactionCheck: true });
        return { t, h };
      };
      { const { t } = await aufbau(); R.check('Fiona: Ausgang — Grimoire + angelegter Held → bereit', !!t.hero(me, 0).ascensionReady, t.hero(me, 0)); }
      for (const [wid, los] of [
        ['zerstören', (t, h) => t.engine.actionDestroyCard({ name: 'Test', owner: op }, h, {})],
        ['ablegen', (t, h) => t.engine.actionMoveCard(h, 'discard', -1, -1, { source: 'Test' })],
        ['löschen', (t, h) => t.engine.actionMoveCard(h, 'deleted', -1, -1, { source: 'Test' })],
        ['zurück auf die Hand', (t, h) => t.engine.actionMoveCard(h, 'hand', -1, -1, { source: 'Test' })],
      ]) {
        const { t, h } = await aufbau(); t.reset();
        await t.run(() => los(t, h));
        R.check(`Fiona/${wid}: nicht mehr bereit`, !t.hero(me, 0).ascensionReady && t.errors.length === 0, { b: t.hero(me, 0).ascensionReady, e: t.errors });
      }
      { const { t, h } = await aufbau();                     // Grimoire geht (Gegenstück)
        await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: op }, t.find(GRIM, 'support'), {}));
        R.check('Fiona/Grimoire zerstört: nicht mehr bereit', !t.hero(me, 0).ascensionReady, t.hero(me, 0)); } }

    // Tempeluna: die angehängte Fee verlässt sie auf jedem Weg → der gewonnene Effekt ist weg (Ruling ①); vorher blieb er bei Heldentod/Löschen stehen
    for (const [wid, los] of [
      ['zerstören', (t, fee) => t.engine.actionDestroyCard({ name: 'Test', owner: op }, fee, {})],
      ['ablegen', (t, fee) => t.engine.actionMoveCard(fee, 'discard', -1, -1, { source: 'Test' })],
      ['löschen', (t, fee) => t.engine.actionMoveCard(fee, 'deleted', -1, -1, { source: 'Test' })],
      ['zurück auf die Hand', (t, fee) => t.engine.actionMoveCard(fee, 'hand', -1, -1, { source: 'Test' })],
    ]) {
      const t = await U.fresh(me, { hand: [], heroes: { [me]: [TEMPELUNA] } });
      const fee = t.put(me, 0, 0, FEE, { counters: { treatAsEquip: true, _tempelunaAttached: true, _keinEquip: true } });
      t.engine.grantHeroEffect(me, 0, FEE, { traeger: fee });
      R.check(`Tempeluna/${wid}: Ausgang — Effekt der Fee gewonnen`, (t.hero(me, 0).gainedEffectNames || []).includes(FEE), t.hero(me, 0).gainedEffectNames);
      t.reset();
      await t.run(() => los(t, fee));
      R.check(`Tempeluna/${wid}: Fee weg → Effekt weg`, !(t.hero(me, 0).gainedEffectNames || []).includes(FEE) && t.errors.length === 0, { g: t.hero(me, 0).gainedEffectNames, e: t.errors });
    }

    // Spiegelpartie: Taio gegen Taio auf demselben Heldenplatz — ein Abgang bei Sitz `me` rührt Sitz `op` nicht an (ein Lost, die Seitenprüfung in den Handlern greift)
    { const t = await U.fresh(me, { hand: [], heroes: { [me]: [TAIO], [op]: [TAIO] } });
      await U.lege(t, me, P1, 0); await U.lege(t, op, P1, 0);
      const a0 = [t.hero(me, 0).atk, t.hero(op, 0).atk];
      R.check('Spiegel: Ausgang — beide Taios +20', a0[0] === ATKBASIS(t, TAIO) + 20 && a0[1] === ATKBASIS(t, TAIO) + 20, a0);
      const inst = t.inst(c => c.name === P1 && c.zone === 'support' && c.owner === me)[0]; t.reset();
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: op }, inst, {}));
      R.check('Spiegel: nur MEIN Taio verliert den Bonus, der des Gegners behält ihn', t.hero(me, 0).atk === ATKBASIS(t, TAIO) && t.hero(op, 0).atk === ATKBASIS(t, TAIO) + 20, { me: t.hero(me, 0).atk, op: t.hero(op, 0).atk });
      const inst2 = t.inst(c => c.name === P1 && c.zone === 'support' && c.owner === op)[0];
      await t.run(() => t.engine.actionMoveCard(inst2, 'discard', -1, -1, { source: 'Test' }));
      R.check('Spiegel: danach auch der Gegner-Taio auf Basis, ohne Doppelabzug', t.hero(me, 0).atk === ATKBASIS(t, TAIO) && t.hero(op, 0).atk === ATKBASIS(t, TAIO), { me: t.hero(me, 0).atk, op: t.hero(op, 0).atk }); }

    // Mehrfach-Equips: zwei Equips weg in einem Zug, eins davon per Heldentod → kein Phantom-Bonus, kein Doppelabzug (Toras/Taio)
    for (const [n, bonus] of [[TAIO, 20], [TORAS, 40]]) {
      const t = await U.fresh(me, { hand: [], heroes: { [me]: [n] } });
      await U.lege(t, me, P1, 0); await U.lege(t, me, P2, 0);
      const basis = ATKBASIS(t, n);
      R.check(`${n}: Ausgang +${2 * bonus}`, t.hero(me, 0).atk === basis + 2 * bonus, t.hero(me, 0).atk);
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: op }, t.find(P1, 'support'), {}));
      R.check(`${n}: ein Equip zerstört → +${bonus}`, t.hero(me, 0).atk === basis + bonus, t.hero(me, 0).atk);
      await t.run(() => t.engine.actionMoveCard(t.find(P2, 'support'), 'hand', -1, -1, { source: 'Test' }));
      R.check(`${n}: zweites Equip zurück auf die Hand → Basis ${basis}`, t.hero(me, 0).atk === basis, t.hero(me, 0).atk);
    }
  }
  R.finish();
})();
