'use strict';
// Create Secret Room (Spell, Magic Arts Lv1): „Choose a card from your deck and place it into the user's Surprise Zone face-down. Whenever the user is chosen by an
// opponent's card or effect, you may add the card you placed to your hand. If the card is a Surprise and the user can use it, you may flip it face-up and activate it
// instead as if its activation condition was fulfilled. If the user has at least Trapping 1, this Spell's level is treated as 0 and it counts as an additional Action."
// Geprueft wird der ECHTE Spielweg (`host.doPlaySpell`), das Surprise-Fenster `_checkSurpriseWindow` und die Einsatzregeln (Trapping, freie Surprise Zone, Bakhm) —
// und dass die Karte NIRGENDS revealed wird (Als Vorgabe 11.10.): keine Reveals, verdeckte Fluege, Logs ohne Namen, private Abfragen.
//   node scripts/skilltest-e2e/create-secret-room.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { loadCardEffect } = require('../../cards/effects/_loader');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const CARD = 'Create Secret Room';
const DB = require('../../cards/effects/_card-db').getCardDB();
const SURP = 'Booby Trap';                     // Surprise-Spell mit Skript, Destruction Magic Lv1
const SURP_HOCH = 'Firewall';                   // Surprise-Spell mit Skript, Destruction Magic Lv3
const KRE = Object.values(DB).filter(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === 0 && !/Token|Race Boat/.test(c.name)).map(c => c.name).sort()[0];
const stapel = (name, n) => Array.from({ length: n }, () => name);

/** Sitz 0 wirkt/trägt den Raum (Magic Arts `ma`, Trapping `tr`, Destruction Magic `dm` an Held 0), Sitz 1 ist der Gegner. */
async function fresh(opts = {}) {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  let out;
  try { out = await runGame({ seats: 2, setupOnly: true, noProfileSeats: [0, 1], seed: 11 }); }
  finally { console.log = oL; console.error = oE; }
  const { room, host, engine, gs } = out;
  gs.turn = 5; gs.activePlayer = 0; gs.currentPhase = opts.phase || 3; gs.firstTurnProtectedPlayer = null; gs.skillTest = null;
  const [p0, p1] = gs.players;
  p0.abilityZones = p0.abilityZones.map((_, hi) => [stapel('Magic Arts', hi === 0 ? (opts.ma ?? 1) : 0), stapel('Trapping', hi === 0 ? (opts.tr ?? 0) : 0), stapel('Destruction Magic', hi === 0 ? (opts.dm ?? 1) : 0)]);
  p1.abilityZones = p1.abilityZones.map(() => [[], [], []]);
  for (const ps of [p0, p1]) {
    ps.supportZones = ps.supportZones.map(() => [[], [], []]);
    ps.surpriseZones = ps.surpriseZones.map(() => []);
    for (const h of ps.heroes) { h.hp = 800; h.maxHp = 800; h.statuses = {}; }
    ps.discardPile = []; ps.deletedPile = []; ps.hand = []; ps.heroesActedThisTurn = [];
  }
  engine.cardInstances = engine.cardInstances.filter(c => c.zone !== 'support' && c.zone !== 'surprise');
  p0.hand = opts.hand || [CARD];
  engine.cardInstances = engine.cardInstances.filter(c => !(c.zone === 'hand' && c.owner === 0));
  for (const h of p0.hand) engine._trackCard(h, 0, 'hand');
  p0.mainDeck = [SURP, SURP, KRE, SURP_HOCH, ...(opts.deck || [])];
  const t = { room, host, engine, gs, p0, p1, events: [], logs: [], optionen: [], antwort: 'hand', waehle: SURP, gallerien: [], reveals: [] };
  engine.promptGeneric = async (pi, d) => {
    if (d.type === 'cardGallery') { t.gallerien.push(d.cards.map(c => c.name)); t.privat = t.privat || []; t.privat.push(d._privat === true); return t.waehle ? { cardName: t.waehle } : { cancelled: true }; }
    if (d.type === 'deckSearchReveal') { t.reveals.push(d.cardName); return { confirmed: true }; }
    if (d.type === 'optionPicker') { t.optionen.push(d.options.map(o => o.id)); t.privat = t.privat || []; t.privat.push(d._privat === true); t.zeigt = d.showCard; return { optionId: t.antwort }; }
    return undefined;
  };
  const origBc = engine._broadcastEvent.bind(engine);
  engine._broadcastEvent = (ev, data, opts) => { t.events.push({ ev, data, opts }); return origBc(ev, data, opts); };
  const origLog = engine.log.bind(engine);
  engine.log = (type, data) => { t.logs.push({ type, data }); return origLog(type, data); };
  return t;
}
const spiele = (t, heroIdx = 0) => t.host.doPlaySpell(t.room, 0, { cardName: CARD, handIndex: 0, heroIdx });
const zone = (t, seat = 0, hi = 0) => (t.gs.players[seat].surpriseZones[hi] || []);
const zInst = (t, seat = 0, hi = 0) => t.engine.cardInstances.find(c => c.zone === 'surprise' && c.owner === seat && c.heroIdx === hi);
const tuer = (t) => t.events.filter(e => e.ev === 'play_zone_animation' && e.data && e.data.type === 'secret_room_open');
const zaehle = (arr, n) => arr.filter(x => x === n).length;
/** Der Gegner (Sitz 1) wählt Held 0 von Sitz 0 — wie ein gegnerischer Angriff im Surprise-Fenster. */
const waehle = (t, o = {}) => t.engine._checkSurpriseWindow(
  [o.ziel || { type: 'hero', owner: 0, heroIdx: 0, cardName: t.p0.heroes[0].name }],
  o.quelle || { name: 'Test Attack', owner: 1, heroIdx: 0, controller: 1 }, { damageType: 'attack', ...(o.opts || {}) });

(async () => {
  console.log('Das Skript');
  {
    const s = loadCardEffect(CARD), cd = DB[CARD];
    check('Spell, Normal, Lv1, Magic Arts', cd && cd.cardType === 'Spell' && cd.subtype === 'Normal' && cd.level === 1 && cd.spellSchool1 === 'Magic Arts' && !cd.spellSchool2, cd);
    check('Kartentext (neu): Surprise-Zone, „can use it“, „level is treated as 0“', cd && /^Choose a card from your deck and place it into the user's Surprise Zone face-down\. Whenever the user is chosen by an opponent's card or effect, you may add the card you placed to your hand\. If the card is a Surprise and the user can use it, you may flip it face-up and activate it instead as if its activation condition was fulfilled\. If the user has at least Trapping 1, this Spell's level is treated as 0 and it counts as an additional Action\.$/.test(cd.effect), cd && cd.effect);
    check('`reduceCardLevel`, `inherentAction` (Funktion), `canPlayWithHero`, `spellPlayCondition`', typeof s.reduceCardLevel === 'function' && typeof s.inherentAction === 'function' && typeof s.canPlayWithHero === 'function' && typeof s.spellPlayCondition === 'function');
  }

  console.log('Einlegen: jede Karte des Decks');
  {
    const t = await fresh();
    const deckVorher = t.p0.mainDeck.length;
    const r = await spiele(t);
    check('der Zauber läuft durch', r === true, r);
    check('Galerie (privat): die verschiedenen Karten des Decks (auch Nicht-Surprises)', t.gallerien.length === 1 && t.gallerien[0].includes(SURP) && t.gallerien[0].includes(KRE) && new Set(t.gallerien[0]).size === t.gallerien[0].length, t.gallerien);
    check('die Karte liegt VERDECKT in der Surprise Zone von Held 0', zone(t).length === 1 && zone(t)[0] === SURP && zInst(t) && zInst(t).faceDown === true, { z: zone(t) });
    check('Geheimraum-Marke an der Instanz (Einsetzender = Sitz 0)', zInst(t).counters.secretRoom && zInst(t).counters.secretRoom.placer === 0, zInst(t).counters);
    check('eine Kopie weniger im Deck', t.p0.mainDeck.length === deckVorher - 1 && zaehle(t.p0.mainDeck, SURP) === 1, { n: t.p0.mainDeck.length });
    check('KEIN Reveal: kein `deckSearchReveal`-Angebot, kein `card_reveal`, die Karte ist dem Gegner NICHT bekannt (`knownToOpponent` fehlt)', t.reveals.length === 0 && !t.events.some(e => e.ev === 'card_reveal') && zInst(t).knownToOpponent !== true, { rv: t.reveals });
    const flug = t.events.filter(e => e.ev === 'play_pile_transfer' && e.data.from === 'deck' && e.data.to === 'surprise');
    const andereFlug = flug.filter(e => e.opts && Array.isArray(e.opts.toPlayers) && !e.opts.toPlayers.includes(0));
    const eigenFlug = flug.filter(e => e.opts && Array.isArray(e.opts.toPlayers) && e.opts.toPlayers.includes(0));
    check('Der Flug Deck → Surprise Zone geht verdeckt an alle ANDEREN (Name „?“, `faceDown`) und mit der echten Karte nur an den Einsetzenden', andereFlug.length === 1 && andereFlug[0].data.cardName === '?' && andereFlug[0].data.faceDown === true && eigenFlug.length === 1 && eigenFlug[0].data.cardName === SURP && !eigenFlug[0].opts.toSpectators, { flug: flug.map(e => ({ n: e.data.cardName, o: e.opts })) });
    check('…und KEIN an alle gesendetes Ereignis nennt die Karte (Wortsuche über alle ungerichteten Ereignisse und Logzeilen)', !t.events.filter(e => !(e.opts && e.opts.toPlayers)).some(e => JSON.stringify(e.data).includes(SURP)) && !t.logs.some(l => JSON.stringify(l.data).includes(SURP)), { ev: t.events.filter(e => !(e.opts && e.opts.toPlayers) && JSON.stringify(e.data).includes(SURP)).map(e => e.ev), lg: t.logs.filter(l => JSON.stringify(l.data).includes(SURP)).map(l => l.type) });
    check('Animation `secret_room_open` auf der Surprise Zone (Ziel mit zoneType surprise)', tuer(t).length === 1 && tuer(t)[0].data.targets[0].zoneType === 'surprise' && tuer(t)[0].data.targets[0].owner === 0 && tuer(t)[0].data.targets[0].heroIdx === 0, tuer(t));
    check('Create Secret Room liegt in der Ablage', t.p0.discardPile.includes(CARD) && t.p0.hand.length === 0, t.p0.discardPile);
    check('Log `secret_room_set` (Held, OHNE Kartenname)', t.logs.some(l => l.type === 'secret_room_set' && !('card' in l.data) && l.data.hero), t.logs.filter(l => /secret/.test(l.type)));
  }
  {
    const t = await fresh({ ma: 1 });
    t.waehle = KRE;
    await spiele(t);
    check('auch eine Kreatur (nie eine Surprise) darf in den Raum — sie liegt verdeckt in der Surprise Zone', zone(t)[0] === KRE && zInst(t).faceDown === true && zInst(t).counters.secretRoom, { z: zone(t) });
  }
  {
    const t = await fresh();
    t.waehle = null;
    const r = await spiele(t);
    check('Galerie abgebrochen: nichts platziert, die Karte bleibt auf der Hand', r === true && t.p0.hand.includes(CARD) && zone(t).length === 0 && tuer(t).length === 0, { r, hand: t.p0.hand });
  }

  console.log('Private Abfragen: der Gegner sieht ihren Inhalt nicht');
  {
    const t = await fresh();
    await spiele(t);
    t.antwort = 'no';
    await waehle(t);
    check('Kartenwahl und Auslöse-Angebot sind als `_privat` gekennzeichnet', t.privat && t.privat.length === 2 && t.privat.every(Boolean), t.privat);
    const { effectPromptFuer } = require('../../server.js').skillTestHandlers;
    const ep = { type: 'cardGallery', ownerIdx: 0, promptId: 7, title: CARD, cards: [{ name: SURP }, { name: KRE }], description: 'secret', _privat: true };
    const fuerBesitzer = effectPromptFuer(ep, 0), fuerGegner = effectPromptFuer(ep, 1), fuerZuschauer = effectPromptFuer(ep, -1);
    check('`effectPromptFuer`: der Besitzer sieht die Galerie, der Gegner und die Zuschauer eine leere Hülle (Typ und Titel bleiben)', fuerBesitzer.cards.length === 2 && fuerGegner.cards.length === 0 && fuerZuschauer.cards.length === 0 && fuerGegner.type === 'cardGallery' && fuerGegner.title === CARD && fuerGegner.description === '' && !JSON.stringify(fuerGegner).includes(SURP), { fuerGegner });
    const op = { type: 'optionPicker', ownerIdx: 0, promptId: 8, title: CARD, showCard: SURP, description: SURP, options: [{ id: 'hand', label: 'Add ' + SURP }, { id: 'no', label: 'No' }], _privat: true };
    const og = effectPromptFuer(op, 1);
    check('…ebenso das Angebot: keine Karte (`showCard`), keine Beschriftung — nur die Optionen-IDs', !('showCard' in og) && og.options.map(o => o.id).join() === 'hand,no' && !JSON.stringify(og).includes(SURP), { og });
    check('…Abfragen OHNE `_privat` bleiben unverändert für alle', effectPromptFuer({ type: 'confirm', ownerIdx: 0, message: 'x', showCard: SURP }, 1).showCard === SURP);
  }

  console.log('Nur mit FREIER Surprise Zone (auch bei Bakhm)');
  {
    const t = await fresh();
    t.p0.surpriseZones[0] = [SURP]; t.engine._trackCard(SURP, 0, 'surprise', 0, 0).faceDown = true;
    const s = loadCardEffect(CARD);
    check('Held 0 hat die Zone belegt, Held 1/2 frei → `canPlayWithHero` falsch für 0, wahr für 1; `spellPlayCondition` wahr', s.canPlayWithHero(t.gs, 0, 0, DB[CARD], t.engine) === false && s.canPlayWithHero(t.gs, 0, 1, DB[CARD], t.engine) === true && s.spellPlayCondition(t.gs, 0, t.engine) === true);
    const r = await spiele(t, 0);
    check('Spiel mit dem Helden mit belegter Zone schlägt fehl: Karte bleibt auf der Hand, Zone unverändert', r !== true && t.p0.hand.includes(CARD) && zone(t)[0] === SURP && t.gallerien.length === 0, { r });
  }
  {
    const t = await fresh();
    for (let hi = 0; hi < 3; hi++) { t.p0.surpriseZones[hi] = [SURP]; t.engine._trackCard(SURP, 0, 'surprise', hi, 0); }
    check('alle Surprise Zones belegt → `spellPlayCondition` falsch (Karte grau)', loadCardEffect(CARD).spellPlayCondition(t.gs, 0, t.engine) === false);
  }
  {
    // Bakhm: seine Support Zones sind freie Surprise-Plätze — für diese Karte zählt trotzdem NUR die echte Surprise Zone.
    const t = await fresh();
    t.p0.heroes[0].name = 'Bakhm, the Desert Digger';
    t.p0.surpriseZones[0] = [SURP]; t.engine._trackCard(SURP, 0, 'surprise', 0, 0).faceDown = true;
    check('Bakhm mit freien Support-Zonen, aber belegter Surprise Zone → NICHT spielbar', loadCardEffect(CARD).canPlayWithHero(t.gs, 0, 0, DB[CARD], t.engine) === false);
    t.p0.surpriseZones[0] = []; t.engine.cardInstances = t.engine.cardInstances.filter(c => c.zone !== 'surprise');
    check('Bakhm mit freier Surprise Zone → spielbar', loadCardEffect(CARD).canPlayWithHero(t.gs, 0, 0, DB[CARD], t.engine) === true);
    await spiele(t);
    check('…die Karte liegt dann in der Surprise Zone (nicht in einer Support Zone)', zone(t)[0] === SURP && t.p0.supportZones[0].every(z => z.length === 0), { z: zone(t), sup: t.p0.supportZones[0] });
  }

  console.log('Trapping 1: Stufe 0 und zusätzliche Aktion');
  {
    const t = await fresh({ ma: 0, tr: 1, phase: 2 });
    const e = t.engine;
    check('Trapping 1 ohne Magic Arts: die Stufe der Handkopie zählt als 0', e.effectiveCardLevel(DB[CARD], 0, { heroIdx: 0, handIndex: 0, handIdx: 0 }) === 0, e.effectiveCardLevel(DB[CARD], 0, { heroIdx: 0, handIdx: 0 }));
    check('…der Held erfüllt die Stufenanforderung (`heroMeetsLevelReq`)', e.heroMeetsLevelReq(0, 0, DB[CARD], { handIdx: 0 }) === true);
    check('…`cardHasInherentAction` wahr für Held 0 (Trapping), falsch für Held 1', e.cardHasInherentAction(0, 0, DB[CARD]) === true && e.cardHasInherentAction(0, 1, DB[CARD]) === false);
    check('…Held 1 (kein Magic Arts, kein Trapping) erfüllt die Stufe nicht', e.heroMeetsLevelReq(0, 1, DB[CARD], { handIdx: 0 }) === false);
    const r = await spiele(t, 0);
    check('Main Phase 1: Spielen läuft durch, die Aktion bleibt frei (Phase unverändert, Held nicht „acted“)', r === true && zone(t).length === 1 && t.gs.currentPhase === 2 && !t.p0.heroesActedThisTurn.includes(0) && !t.gs._pendingActionBurn, { r, ph: t.gs.currentPhase, acted: t.p0.heroesActedThisTurn });
  }
  {
    const t = await fresh({ ma: 1, tr: 0, phase: 3 });
    const e = t.engine;
    check('Magic Arts 1, kein Trapping: Stufe bleibt 1, keine Zusatzaktion', e.effectiveCardLevel(DB[CARD], 0, { heroIdx: 0, handIdx: 0 }) === 1 && e.cardHasInherentAction(0, 0, DB[CARD]) === false);
    const r = await spiele(t, 0);
    check('…Spielen kostet die Aktion (Held „acted“ oder Phase weiter)', r === true && zone(t).length === 1 && (t.p0.heroesActedThisTurn.includes(0) || t.gs.currentPhase !== 3), { ph: t.gs.currentPhase, acted: t.p0.heroesActedThisTurn });
  }
  {
    const t = await fresh({ ma: 0, tr: 0 });
    const r = await spiele(t, 0);
    check('weder Magic Arts noch Trapping: nicht wirkbar', r !== true && t.p0.hand.includes(CARD) && zone(t).length === 0, { r });
  }
  {
    const t = await fresh({ ma: 0, tr: 1, hand: [CARD, CARD] });
    const e = t.engine;
    check('zwei Kopien auf der Hand: die Senkung wird nicht verdoppelt (Stufe 0 für beide)', e.effectiveCardLevel(DB[CARD], 0, { heroIdx: 0, handIdx: 0 }) === 0 && e.effectiveCardLevel(DB[CARD], 0, { heroIdx: 0, handIdx: 1 }) === 0);
  }

  console.log('Auslöser: „chosen by an opponent“ → Hand');
  {
    const t = await fresh();
    await spiele(t);
    t.events.length = 0; t.antwort = 'hand';
    const r = await waehle(t);
    check('Der Gegner wählt den Helden: Angebot an den Besitzer (Hand / Aktivieren / Nein)', t.optionen.length === 1 && t.optionen[0].includes('hand') && t.optionen[0].includes('activate') && t.optionen[0].includes('no'), t.optionen);
    check('„Add to hand“: die Karte ist auf der Hand, die Zone leer, die Marke weg, nichts negiert', t.p0.hand.includes(SURP) && zone(t).length === 0 && !zInst(t) && (r === null || r.effectNegated !== true), { hand: t.p0.hand, z: zone(t), r });
    check('…Flug Surprise Zone → Hand und Tür-Animation', t.events.some(e => e.ev === 'play_pile_transfer' && e.data.from === 'surprise' && e.data.to === 'hand') && tuer(t).length === 1, t.events.map(e => e.ev));
    check('…Log `secret_room_hand` (Held, Quelle) OHNE Kartenname', t.logs.some(l => l.type === 'secret_room_hand' && !('card' in l.data) && l.data.by === 'Test Attack'), t.logs.filter(l => /secret/.test(l.type)));
    const hflug = t.events.filter(e => e.ev === 'play_pile_transfer' && e.data.from === 'surprise' && e.data.to === 'hand');
    check('…der Flug zur Hand ist für alle anderen verdeckt („?“) und zeigt die echte Karte nur dem Einsetzenden', hflug.length === 2 && hflug.filter(e => e.data.cardName === '?' && e.data.faceDown === true && !e.opts.toPlayers.includes(0)).length === 1 && hflug.filter(e => e.data.cardName === SURP && e.opts.toPlayers.includes(0)).length === 1, hflug.map(e => ({ n: e.data.cardName, o: e.opts })));
    check('…keine Logzeile `card_added_to_hand`/`pile_take` mit dem Kartennamen, und keine ungerichtete Meldung nennt ihn', !t.logs.some(l => /card_added_to_hand|pile_take/.test(l.type) && l.data.card === SURP) && !t.logs.some(l => JSON.stringify(l.data).includes(SURP)) && !t.events.filter(e => !(e.opts && e.opts.toPlayers)).some(e => JSON.stringify(e.data).includes(SURP)), { lg: t.logs.filter(l => JSON.stringify(l.data).includes(SURP)).map(l => l.type) });
  }
  {
    const t = await fresh();
    await spiele(t);
    t.antwort = 'no';
    await waehle(t);
    check('„Leave it“: die Karte bleibt verdeckt liegen, kein Hand-Zugang', zone(t)[0] === SURP && zInst(t).counters.secretRoom && !t.p0.hand.includes(SURP), { z: zone(t), hand: t.p0.hand });
    t.antwort = 'hand';
    await waehle(t);
    check('…beim nächsten Anvisieren wird sie wieder angeboten', t.optionen.length === 2 && t.p0.hand.includes(SURP), t.optionen);
  }

  console.log('Auslöser: Aktivieren statt Hand (nur Surprise, nur nutzbar)');
  {
    const t = await fresh({ ma: 1 });
    await spiele(t);
    const aufrufe = [];
    t.engine._activateSurprise = async (pi, hi, name, src, script, o) => { aufrufe.push({ pi, hi, name, src: src.cardName, hatSkript: !!script && script.isSurprise === true, o }); return null; };
    t.antwort = 'activate';
    const r = await waehle(t);
    check('„Activate now“: die Engine aktiviert die Surprise über den NORMALEN Weg (`_activateSurprise`) mit der echten Quelle', aufrufe.length === 1 && aufrufe[0].name === SURP && aufrufe[0].pi === 0 && aufrufe[0].hi === 0 && aufrufe[0].src === 'Test Attack' && aufrufe[0].hatSkript, aufrufe);
    check('…ohne dass die Surprise-Bedingung (`surpriseTrigger`) geprüft wurde und ohne Hand-Zugang', !t.p0.hand.includes(SURP) && (r === null || r.effectNegated !== true), { hand: t.p0.hand, r });
    check('…Log `secret_room_activate` und Tür-Animation', t.logs.some(l => l.type === 'secret_room_activate' && l.data.card === SURP) && tuer(t).length >= 1, t.logs.filter(l => /secret/.test(l.type)));
  }
  {
    // Wird die aktivierte Surprise-Wirkung „negiert“, meldet das Fenster es weiter (der wählende Effekt entfällt).
    const t = await fresh({ ma: 1 });
    await spiele(t);
    t.engine._activateSurprise = async () => ({ effectNegated: true });
    t.antwort = 'activate';
    const r = await waehle(t);
    check('negiert die aktivierte Surprise den Effekt, gibt das Fenster `effectNegated` zurück', r && r.effectNegated === true, r);
  }
  {
    // Der Held kann die Surprise NICHT nutzen (Stufe) → nur Hand / Nein.
    const t = await fresh({ ma: 1 });
    t.waehle = SURP_HOCH;
    await spiele(t);
    t.antwort = 'hand';
    await waehle(t);
    check('eine Surprise, die der Held nicht nutzen kann (zu hohe Stufe), bietet nur „Add to hand“ und „Nein“', t.optionen.length === 1 && !t.optionen[0].includes('activate') && t.optionen[0].includes('hand'), t.optionen);
  }
  {
    // Keine Surprise (Kreatur) → nur Hand / Nein.
    const t = await fresh({ ma: 1 });
    t.waehle = KRE;
    await spiele(t);
    await waehle(t);
    check('eine Nicht-Surprise bietet nur „Add to hand“ und „Nein“', t.optionen.length === 1 && !t.optionen[0].includes('activate') && t.p0.hand.includes(KRE), { opt: t.optionen, hand: t.p0.hand });
  }

  {
    // Echte Aktivierung (ohne Spion): Booby Trap läuft über den normalen Weg, danach liegt die Karte in der Ablage.
    const t = await fresh({ ma: 1, dm: 1 });
    await spiele(t);
    const hpAngreifer = t.p1.heroes[0].hp;
    t.antwort = 'activate';
    const r = await waehle(t);
    check('echte Aktivierung: die Surprise wurde aufgedeckt und ausgelöst (Log `surprise_activated`)', t.logs.some(l => l.type === 'surprise_activated' && l.data.card === SURP), t.logs.map(l => l.type).slice(-8));
    check('…danach: Zone leer, Karte in der Ablage des Besitzers, kein Hand-Zugang', zone(t).length === 0 && t.p0.discardPile.includes(SURP) && !t.p0.hand.includes(SURP), { z: zone(t), abl: t.p0.discardPile });
    check('…die Surprise wirkte auf die echte Quelle (der Angreifer, Held 0 des Gegners, hat Schaden genommen)', t.p1.heroes[0].hp < hpAngreifer, { vorher: hpAngreifer, nachher: t.p1.heroes[0].hp });
  }

  console.log('Auslöser: wann NICHT');
  {
    const t = await fresh();
    await spiele(t);
    await waehle(t, { quelle: { name: 'Eigener Effekt', owner: 0, heroIdx: 1, controller: 0 } });
    check('ein EIGENER Effekt (auch von einem anderen eigenen Helden) löst nicht aus', t.optionen.length === 0 && zone(t)[0] === SURP, t.optionen);
    await waehle(t, { quelle: { name: 'Flächenschlag', owner: 1, heroIdx: 0, controller: 1, _isAoeCheck: true } });
    check('ein Flächenschlag wählt niemanden → kein Angebot', t.optionen.length === 0, t.optionen);
    await waehle(t, { ziel: { type: 'creature', owner: 0, heroIdx: 0, slotIdx: 0, cardName: KRE } });
    check('eine gewählte KREATUR des Helden löst nicht aus (nur der Held selbst)', t.optionen.length === 0, t.optionen);
  }
  {
    const t = await fresh();
    await spiele(t);
    t.p0.heroes[0].statuses.frozen = { duration: 1 };
    await waehle(t);
    check('ein eingefrorener Held kann nicht reagieren → kein Angebot', t.optionen.length === 0 && zone(t)[0] === SURP, t.optionen);
    t.p0.heroes[0].statuses = {}; t.p0.heroes[0].hp = 0;
    await waehle(t);
    check('ein toter Held löst nicht aus', t.optionen.length === 0, t.optionen);
  }
  {
    // Ein anderer Held des Gegners/dessen Surprise Zone: nur die Zone des GEWÄHLTEN Helden zählt.
    const t = await fresh();
    await spiele(t);
    await waehle(t, { ziel: { type: 'hero', owner: 0, heroIdx: 1, cardName: t.p0.heroes[1].name } });
    check('wird ein ANDERER Held gewählt, bleibt der Raum zu', t.optionen.length === 0 && zone(t)[0] === SURP, t.optionen);
  }

  console.log('CPU-Entscheidung der Karte');
  {
    const t = await fresh({ ma: 1 });
    const s = loadCardEffect(CARD);
    t.engine._cpuPlayerIdx = 0;
    const g1 = s.cpuResponse(t.engine, 'generic', { title: CARD, type: 'cardGallery', cards: [{ name: KRE }, { name: SURP }] });
    check('Galerie: die CPU wählt eine Surprise, die ihr Held auslösen kann', g1 && g1.cardName === SURP, g1);
    const g2 = s.cpuResponse(t.engine, 'generic', { title: CARD, type: 'cardGallery', cards: [{ name: KRE }] });
    check('…ohne solche Surprise die erste Karte', g2 && g2.cardName === KRE, g2);
    const o1 = s.cpuResponse(t.engine, 'generic', { title: CARD, type: 'optionPicker', options: [{ id: 'hand' }, { id: 'activate' }, { id: 'no' }] });
    const o2 = s.cpuResponse(t.engine, 'generic', { title: CARD, type: 'optionPicker', options: [{ id: 'hand' }, { id: 'no' }] });
    check('Angebot: aktivieren, wenn möglich, sonst auf die Hand', o1 && o1.optionId === 'activate' && o2 && o2.optionId === 'hand', { o1, o2 });
  }

  console.log(fails === 0 ? '\nALLE GRÜN' : `\n${fails} FEHLER`);
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
