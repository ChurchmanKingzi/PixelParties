'use strict';
// W54a · Punkt 2 (Al, 22.10.2026: „Ja" auf „Soll [eine Karte, die nach Teleportation Powder nicht zurückkehren kann] wie ein normaler Abgang behandelt werden (`onEquipLost`)?"):
//   Kehrt eine mitgenommene Karte nicht zurück (ihre Zone ist fremdbesetzt UND der Held hat keinen freien Platz), bleibt sie draußen. Das gilt jetzt als normaler Abgang vom Helden:
//   `onEquipLost` mit `reason: 'teleportLost'` an alle Zustandslauscher (Taio, Toras, Aufstiegs-Bereitschaft, Tempeluna …), die Karte räumt sich selbst auf (ATK-Bonus, Fluch, Fee-Effekt),
//   Zustand danach == „die Karte hat nie dort gelegen". ALLE anderen Fälle (Verschwinden, normales Auftauchen, Rückkehr auf den Ausweichplatz) bleiben hook-frei (W53a/a-05).
// Geprüft (beide Sitze): Szenen Taio · Toras · Riffel (Aufstiegs-Bereitschaft) · Tempeluna (Fee) · Fluch; Hook-Wächter (nur der Abgang feuert: je verlorene Karte genau ein `onCardLeaveZone` an die Karte selbst
//   und ein `onEquipLost` mit Grund `teleportLost`; KEIN Enter/EquipGained/onPlay/Surprise-Fenster); Zustandsdifferenz zur Referenzszene „Karte lag nie dort"; eine Karte kehrt zurück, die andere nicht
//   (die zurückkehrende feuert nichts, behält Id/Zähler); Gegenprobe: genug Platz → gar kein Hook; Resistance-Schalter (`resistancePruefung`) — Verschwinden ohne Prüfung feuert keinen einzigen Hook.
// Auf dem Stand vor W54a rot (kein Hook, Taio/Toras/Bereitschaft/Fee/Fluch blieben auf dem Zustand „Karte liegt noch"). Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const TP = 'Teleportation Powder', TAIO = 'Taio, the Sun Fencer', TORAS = 'Toras, Master of all Weapons', RIF = 'Future Tech Gunslinger Riffel', TEMPELUNA = 'Tempeluna, the Convergence Fairy', FEE = 'Maya, the Nature Fairy';
const GUN = 'Future Tech Gun', CORE = 'Ancient Tech Infinite Energy Core', CLUB = 'Club of Gobbo', PIKE = 'Phalanx Pike', SUN = 'The Sun Sword';
const BLANK = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
const ENTER_ART = ['onCardEnterZone', 'onEquipGained', 'onPlay', 'onCreatureSummoned', 'onAscension', 'onHeroRevive'];

/** Wächter: schreibt jeden `runHooks`-Namen (mit Kontext für Equip-Meldungen) UND die Fenster-Verteiler mit, solange `an` gesetzt ist. */
function waechter(t) {
  const w = { an: false, namen: [], verlust: [], leave: [] };
  const orig = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (n, c) => {
    if (w.an) { w.namen.push(n); if (n === 'onEquipLost') w.verlust.push({ name: c && c.lostName, reason: c && c.reason, von: c && c.fromOwner, held: c && c.fromHeroIdx, isMove: c && c.isMove }); if (n === 'onCardLeaveZone') w.leave.push({ name: c && c.leavingCard && c.leavingCard.name, nur: !!(c && c._onlyCard) }); }
    return orig(n, c);
  };
  const proto = Object.getPrototypeOf(t.engine);
  for (const m of Object.getOwnPropertyNames(proto)) {
    if (!/^(_checkSurpriseOn|_scanSurprisesAgainst|fireEquipGained)/.test(m) || typeof proto[m] !== 'function') continue;
    const f = proto[m];
    t.engine[m] = function (...a) { if (w.an) w.namen.push('fn:' + m); return f.apply(this, a); };
  }
  return w;
}

/** Szenen: Held 0 von `op` trägt `karten` (Reihenfolge = Zone 0, 1, 2); `ohne` = Referenz (die genannten Karten haben NIE dort gelegen). */
const SZENEN = {
  taio: { held: TAIO, karten: [CLUB], bau: async () => {} },
  taio2: { held: TAIO, karten: [CLUB, GUN] , bau: async (t, op) => { t.setDiscard(op, [GUN, GUN]); } },
  toras: { held: TORAS, karten: [CLUB, PIKE], bau: async () => {} },
  riffel: { held: RIF, karten: [CORE, GUN], bau: async (t, op) => { t.setDiscard(op, ['ZZ Filler', GUN]); await t.run(() => t.engine.runHooks('onGameStart', {})); } },
  fluch: { held: TAIO, karten: [], bau: async (t, op) => { await U.haenge(t, op, 'Curse', 0); } },
  tempeluna: { held: TEMPELUNA, karten: [], bau: async (t, op) => {
    t.gs.players[op].hand.push(FEE);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: FEE, source: 'hand' }) });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    await t.activateHero(op, 0, {}); } },
};
async function bauen(me, op, sz, ohne = []) {
  const S = SZENEN[sz];
  const t = await U.fresh(me, { hand: [TP, ...(sz === 'fluch' ? [] : [])], heroes: { [op]: [S.held, ...BLANK] } });
  if (sz === 'fluch') t.addHand(op, 'Curse');
  await S.bau(t, op);
  for (const k of S.karten) if (!ohne.includes(k)) await U.lege(t, op, k, 0);
  await t.run(() => t.engine.runHooks('onAnyActionResolved', {}));
  return t;
}
const heldZustand = (t, op) => {
  const h = t.gs.players[op].heroes[0], hi = t.inst(c => c.zone === 'hero' && c.owner === op && c.heroIdx === 0)[0];
  return JSON.parse(JSON.stringify({
    atk: h.atk, hp: h.hp, maxHp: h.maxHp, cursed: !!(h.statuses && h.statuses.cursed), stash: h._cursedAtkSuppressed === undefined ? '-' : h._cursedAtkSuppressed, bereit: !!h.ascensionReady,
    gewonnen: (h.gainedEffectNames || []).slice().sort(), taio: hi && hi.counters._taioAtkTotal || 0, toras: hi && hi.counters.torasAtkBonus || 0,
  }));
};
const trifft = (t, op) => { t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === op && y.heroIdx === 0); return x ? [x.id] : null; }; };
/** Potion spielen, Gegner-Zug, Zonen (alle drei) fremd besetzen, Rückkehr zu Beginn des eigenen Zuges. Gibt die Wächter-Daten zurück. */
async function teleportiere(t, me, op, w, { blockiere = [0, 1, 2], vorAbwesenheit } = {}) {
  trifft(t, op); t.gs.activePlayer = me; t.phase(3); t.reset();
  const sk0 = U.H.loadCardEffect(TP), resolve0 = sk0.resolve;   // nur das Verschwinden selbst beobachten (nicht die Spielweg-Hooks afterPotionUsed/onAnyActionResolved)
  sk0.resolve = async function (...a) { w.an = true; try { return await resolve0.apply(this, a); } finally { w.an = false; } };
  let r; try { r = await t.play(me, TP, { hero: 0, active: me }); } finally { sk0.resolve = resolve0; }
  const beimVerschwinden = w.namen.slice(); w.namen.length = 0; w.verlust.length = 0; w.leave.length = 0;
  for (const z of blockiere) t.put(op, 0, z, 'ZZ Dummy Big');
  await t.endTurn();
  if (vorAbwesenheit) await vorAbwesenheit();
  const sk = U.H.loadCardEffect(TP), frueh0 = sk.hooks.onTurnStartEarly;
  sk.hooks.onTurnStartEarly = async function (...a) { w.an = true; try { return await frueh0.apply(this, a); } finally { w.an = false; } };
  try { await t.endTurn(); } finally { sk.hooks.onTurnStartEarly = frueh0; }
  return { r, beimVerschwinden, beiRueckkehr: w.namen.slice(), verlust: w.verlust.slice(), leave: w.leave.slice() };
}

(async () => {
  const R = U.H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} spielt die Potion, Sitz ${op} verliert den Helden 0`);

    // ═══ (A) Szenen mit allen Zonen fremdbesetzt: die Karten bleiben draußen und gehen als normaler Abgang ab ═══
    for (const sz of ['taio', 'taio2', 'toras', 'riffel', 'fluch', 'tempeluna']) {
      const S = SZENEN[sz];
      const t = await bauen(me, op, sz); const w = waechter(t);
      const vor = heldZustand(t, op);
      const karten = S.karten.slice();
      R.check(`${sz}: Ausgang aufgebaut (${karten.join(' + ') || sz}), keine Fehler`, t.errors.length === 0 && t.gs.players[op].heroes[0].name === S.held, { e: t.errors.slice(0, 2), h: t.gs.players[op].heroes[0].name });
      const ids = new Set(t.inst(c => c.zone === 'support' && c.owner === op && c.heroIdx === 0 && c.zoneSlot >= 0 && c.name !== 'ZZ Dummy Big').map(c => c.id));
      const d = await teleportiere(t, me, op, w);
      R.check(`${sz}: Held ist wieder da`, t.gs.players[op].heroes[0].name === S.held && t.gs.players[op]._teleportedAway === undefined, { h: t.gs.players[op].heroes[0].name });
      R.check(`${sz}: beim VERSCHWINDEN nur die Resistance-Prüfung (beforeHeroEffect)`, d.beimVerschwinden.every(n => n === 'beforeHeroEffect'), d.beimVerschwinden);
      const erwartet = sz === 'fluch' ? ['Curse'] : sz === 'tempeluna' ? [FEE] : karten;
      const verloren = d.verlust.map(v => v.name).sort();
      R.check(`${sz}: genau ein onEquipLost je nicht zurückkehrender Karte (${erwartet.join(', ')}), Grund „teleportLost", Besitzer ${op}, Held 0, kein Umhängen`,
        JSON.stringify(verloren) === JSON.stringify(erwartet.slice().sort()) && d.verlust.every(v => v.reason === 'teleportLost' && v.von === op && v.held === 0 && !v.isMove), d.verlust);
      R.check(`${sz}: je Karte genau ein onCardLeaveZone, nur an die Karte selbst (keine Zähler-Rundrufe)`, d.leave.length === erwartet.length && d.leave.every(l => l.nur), d.leave);
      R.check(`${sz}: bei der Rückkehr KEIN Enter-/EquipGained-/onPlay-/Surprise-Fenster`, !d.beiRueckkehr.some(n => ENTER_ART.includes(n) || n.startsWith('fn:')), d.beiRueckkehr);
      R.check(`${sz}: die verlorenen Karten liegen nicht auf dem Brett (keine Instanz, nicht in der Zone)`, !t.inst(c => ids.has(c.id)).some(c => c.zone === 'support') && erwartet.every(n => !t.gs.players[op].supportZones[0].flat().includes(n) || n === 'ZZ Dummy Big'), t.gs.players[op].supportZones[0]);
      // Referenz: dieselbe Szene, in der die Karten NIE dort lagen (und kein Teleport)
      const ref = await bauen(me, op, sz, karten.slice());
      if (sz === 'fluch') { const cu = ref.find('Curse', 'support'); if (cu) await ref.run(() => ref.engine.actionDestroyCard({ name: 'T', owner: me }, cu, {})); }
      if (sz === 'tempeluna') { const fee = ref.find(FEE, 'support'); if (fee) await ref.run(() => ref.engine.actionDestroyCard({ name: 'T', owner: me }, fee, {})); }
      const soll = heldZustand(ref, op), ist = heldZustand(t, op);
      R.check(`${sz}: Zustand des Helden == Referenz „Karte lag nie dort" (ATK, HP, Fluch, Bereitschaft, gewonnene Effekte, Taio-/Toras-Zähler)`, JSON.stringify(ist) === JSON.stringify(soll), { ist, soll, vor });
      R.check(`${sz}: Zustand hat sich gegenüber VOR dem Teleport geändert (Probe, dass die Karte etwas bewirkt hatte)`, JSON.stringify(vor) !== JSON.stringify(ist), { vor, ist });
      if (sz === 'riffel') R.check('riffel: Aufstiegs-Bereitschaft stand VOR dem Teleport und ist nach dem Abgang von Core und Gun weg', vor.bereit === true && ist.bereit === false, { vor: vor.bereit, ist: ist.bereit });
      if (sz === 'fluch') R.check('fluch: der Held ist nicht mehr verflucht und hat seine ATK zurück (die Fluch-Karte ist draußen geblieben)', vor.cursed === true && vor.atk === 0 && ist.cursed === false && ist.atk === t.DB[TAIO].atk, { vor, ist });
      if (sz === 'tempeluna') R.check('tempeluna: der Effekt der Fee ist weg (gewonnene Effekte ohne Maya)', vor.gewonnen.includes(FEE) && !ist.gewonnen.includes(FEE), { vor: vor.gewonnen, ist: ist.gewonnen });
      R.check(`${sz}: sauber`, t.errors.length === 0 && t.audit().filter(x => !/slot-1/.test(x)).length === 0, { e: t.errors.slice(0, 2), a: t.audit().slice(0, 2) });
    }

    // ═══ (B) Eine Karte kehrt zurück (Ausweichplatz), die andere nicht: nur die verlorene feuert ═══
    { const t = await U.fresh(me, { hand: [TP], heroes: { [op]: [TAIO, ...BLANK] } });
      await U.lege(t, op, CLUB, 0, 0); await U.lege(t, op, PIKE, 0, 2);
      const w = waechter(t);
      const club = t.find(CLUB, 'support'), clubId = club.id, clubAg = club.counters.atkGranted;
      const d = await teleportiere(t, me, op, w, { blockiere: [0, 2] });   // Zone 1 bleibt frei: der Club (Zone 0, besetzt) weicht dorthin aus, die Pike (Zone 2, besetzt) findet nichts mehr
      const clubNach = t.find(CLUB, 'support'), pikeNach = t.find(PIKE, 'support');
      R.check('(B) der Club weicht auf die freie Zone 1 aus: dieselbe Id, derselbe Zähler, KEIN Hook für ihn', !!clubNach && clubNach.id === clubId && clubNach.zoneSlot === 1 && clubNach.counters.atkGranted === clubAg && !d.verlust.some(v => v.name === CLUB) && !d.leave.some(l => l.name === CLUB), { club: clubNach && [clubNach.id, clubNach.zoneSlot], clubId, verlust: d.verlust });
      R.check('(B) nur die Pike (kein Platz) geht ab: ein onEquipLost „teleportLost"', !pikeNach && d.verlust.length === 1 && d.verlust[0].name === PIKE && d.verlust[0].reason === 'teleportLost', { verlust: d.verlust, pike: !!pikeNach });
      R.check('(B) Taios ATK == Grundwert + Club (30) + Taio-Bonus für EIN Artifact (20); die Pike ist weg samt ihrem Bonus (30 + 20)', t.hero(op, 0).atk === t.DB[TAIO].atk + 30 + 20, { atk: t.hero(op, 0).atk, soll: t.DB[TAIO].atk + 50 });
      R.check('(B) sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors.slice(0, 2), a: t.audit().slice(0, 2) }); }

    // ═══ (C) Gegenprobe: genug Platz → KEIN Hook beim Verschwinden (außer Resistance-Prüfung) und KEINER bei der Rückkehr ═══
    { const t = await U.fresh(me, { hand: [TP], heroes: { [op]: [TAIO, ...BLANK] } });
      await U.lege(t, op, CLUB, 0, 0);
      const w = waechter(t);
      const d = await teleportiere(t, me, op, w, { blockiere: [] });
      R.check('(C) Platz da: keine Hooks bei der Rückkehr, keine Abgangsmeldung', d.beiRueckkehr.filter(n => n !== 'onTurnStartEarly').length === 0 && d.verlust.length === 0 && d.leave.length === 0, { b: d.beiRueckkehr, v: d.verlust });
      R.check('(C) Platz da: Club liegt wieder, ATK wie vorher (Grundwert + 30 + 20)', !!t.find(CLUB, 'support') && t.hero(op, 0).atk === t.DB[TAIO].atk + 50, t.hero(op, 0).atk); }

    // ═══ (D) Resistance-Schalter: ohne Prüfung feuert das Verschwinden keinen einzigen Hook (und Resistance-Helden werden dann teleportiert) — W55: Al hat entschieden, Resistance schützt vor Powder; der Schalter bleibt `true`, dieser Test belegt nur die Mechanik ═══
    for (const schalter of [true, false]) {
      const sk = U.H.loadCardEffect(TP); const alt = sk.resistancePruefung;
      try {
        sk.resistancePruefung = schalter;
        const t = await U.fresh(me, { hand: [TP], heroes: { [op]: [TAIO, ...BLANK] } });
        t.setAbilities(op, 0, [['Resistance', 'Resistance', 'Resistance'], [], []]);
        const w = waechter(t);
        const d = await teleportiere(t, me, op, w, { blockiere: [] });
        if (schalter) R.check('(D) Schalter an (Stand W13/Q144): beim Verschwinden läuft die Resistance-Prüfung (beforeHeroEffect); Resistance Lv3 blockt', d.beimVerschwinden.includes('beforeHeroEffect') && d.beimVerschwinden.every(n => n === 'beforeHeroEffect'), d.beimVerschwinden);
        else R.check('(D) Schalter aus: beim Verschwinden KEIN Hook (auch kein beforeHeroEffect)', d.beimVerschwinden.length === 0, d.beimVerschwinden);
      } finally { sk.resistancePruefung = alt; }
    }
  }
  R.finish();
})();
