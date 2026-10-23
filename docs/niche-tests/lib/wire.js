'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  Pixel Parties – Leitungs-Harness (W63d): „WAS sieht der Gegner/Zuschauer WANN?"
//
//  Baut auf lib/h.js auf, ergänzt es aber um drei Dinge, die h.js bewusst nicht hat:
//
//   1. Eine ZEITLEISTE (t.tl) aus allen Socket-Nachrichten, die an den Gegner-Sitz und an einen Zuschauer gehen
//      (server.js `io.to(sid).emit` UND `engine.io.to(sid).emit`), verschränkt mit den Fragen, die die Karte
//      dem Spieler stellt (Prompt-Galerien, Zielwahl, Ja/Nein …) und seinen Antworten.
//   2. MENSCH-MODUS: Sitz 0 und 1 sind KEINE CPU. Die Engine läuft auf dem echten Menschenpfad
//      (`promptGeneric` wartet auf `resolveGenericPrompt`, `promptEffectTarget` auf `resolveEffectPrompt`/`doConfirmPotion`) —
//      genau so, wie der Server die Socket-Antworten (`effect_prompt_response`, `confirm_potion`, `cancel_potion`) verarbeitet.
//      Ein „Mensch-Antworter" (Pumpe) beantwortet jede offene Frage nach einer Politik oder bricht an der k-ten abbrechbaren Stelle ab.
//      Dadurch greift auch der zurückgehaltene Auftritt (`gs._pendingCardReveal`: committet NACH der letzten abbrechbaren Frage, VOR dem ersten Effektschritt — W64b) und der Zustandspuffer wie im Spiel.
//   3. (W64b) Pro Empfänger (Gegner-Sitze, Zuschauer) die Reihenfolge „Auftritt → erster Effekt": `r.pro[sid] = { R, wechsel, ereignis, effektLog, ersterEffekt, vorEffekt }`, geprüft von `W.pruefeDurchlauf`.
//
//  Benutzung:
//      const W = require('../../../lib/wire.js');
//      const t = await W.fresh({ hand: [['Fireball'], []] });
//      const r = await W.spiele(t, 0, 'Fireball', { hero: 0, cancelAt: null });   // cancelAt: null = durchspielen, k = an der k-ten abbrechbaren Stelle abbrechen
//      r.leaks     → Nachrichten an Gegner/Zuschauer, die die Karte VOR der letzten abbrechbaren Stelle verraten haben
//      r.tl        → die komplette Zeitleiste
//  Namen: Sitz 'S<n>' = Spieler n, 'SPEC' = Zuschauer.
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const ROOT = process.env.PP_ROOT || path.resolve(__dirname, '../../..');
// ── Socket-Aufzeichnung VOR dem Laden von server.js einhängen ──
const { Server } = require(ROOT + '/node_modules/socket.io');
const TAP = { tl: null, scanState: false };
function tapEmit(sid, ev, data) {
  if (!TAP.tl) return;
  const e = { k: 'wire', sid, ev, data };
  if (ev === 'game_state' || ev === 'spectator_state') {
    if (!TAP.scanState) { e.data = null; e.stateSkipped = true; }
    else { try { e.json = JSON.stringify(data); } catch { e.json = ''; } e.data = null; }
  }
  TAP.tl.push(e);
}
Server.prototype.to = function (sid) { const ids = Array.isArray(sid) ? sid : [sid]; const o = { emit: (ev, d) => { ids.forEach(s => tapEmit(s, ev, d)); return true; }, to: (s2) => Server.prototype.to.call(this, s2) }; return o; };
Server.prototype.emit = function (ev, d) { tapEmit('*', ev, d); return true; };

const H = require('./h.js');
const { DB, PHASES, INERT } = H;
const NOOP = () => {};

/** Gleiche Optionen wie H.fresh; zusätzlich: scanState (game_state-Nachrichten als JSON mitschneiden, langsam). */
async function fresh(o = {}) {
  const t = await H.fresh(o);
  const { engine, gs, room, host } = t;
  TAP.scanState = !!o.scanState;
  t.tl = []; TAP.tl = t.tl;
  // Sitzkennungen: Spieler 0..n-1 und ein Zuschauer
  for (let i = 0; i < gs.players.length; i++) { gs.players[i].socketId = 'S' + i; if (room.players[i]) room.players[i].socketId = 'S' + i; gs.players[i].userId = gs.players[i].userId || ('u' + i); }
  room.spectators = [{ socketId: 'SPEC', userId: 'spec', username: 'Zuschauer' }];
  // engine.io: aufzeichnende Attrappe
  engine.io = { to: (sid) => ({ emit: (ev, d) => { tapEmit(sid, ev, d); return true; } }), emit: (ev, d) => tapEmit('*', ev, d), sockets: { sockets: new Map() } };
  // echte Zustandsversender (wie im Spiel), damit sync()/sendGameState wirklich an die Sitze gehen
  if (host.sendGameState) { engine.sendGameState = host.sendGameState; engine.sendSpectatorGameState = host.sendSpectatorGameState; }
  // MENSCH-MODUS
  engine._isSelfPlay = false; engine._cpuPlayerIdx = -1;
  delete engine.promptGeneric;            // zurück auf die Prototyp-Methode (Menschenpfad)
  delete engine._getCpuTargetResponse;
  // Fragen in die Zeitleiste schreiben
  const pg = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async (pi, d, ...r) => { t.tl.push({ k: 'prompt', pi, d, kind: 'generic', cancellable: !!(d && d.cancellable) }); return pg(pi, d, ...r); };
  const pe = engine.promptEffectTarget.bind(engine);
  engine.promptEffectTarget = async (pi, valid, config = {}) => { t.tl.push({ k: 'prompt', pi, d: { type: 'target', title: config && (config.title || config.description), config }, kind: 'target', cancellable: !!(config && config.cancellable) }); return pe(pi, valid, config); };
  // Engine-Log in die Zeitleiste (der Auftritts-Eintrag `card_played` etc. geht über `log`)
  const lg = engine.log.bind(engine);
  engine.log = (type, data) => { t.tl.push({ k: 'log', type, data }); return lg(type, data); };
  t.W = true;
  return t;
}

const CANCEL = Symbol('cancel');
const REICH_CRE0 = () => Object.values(DB).find(c => c.cardType === 'Creature' && c.level === 0 && (c.subtype || '') === 'Normal').name;

/** Antwort auf eine Generic-Frage nach der Standardpolitik „zustimmen / ersten Eintrag nehmen". */
function standardAntwort(t, pi, d) {
  const e = t.engine;
  if (d.type === 'confirm') return { confirmed: true };
  if (d.type === 'cardGallery' && Array.isArray(d.cards) && d.cards.length) { const c = d.cards.find(x => x.selectable !== false) || d.cards[0]; return { cardName: c.name, source: c.source }; }
  if (d.type === 'optionPicker' && Array.isArray(d.options) && d.options.length) return { optionId: d.options[0].id };
  if (d.type === 'cardNamePicker') return { cardName: REICH_CRE0() };
  try { const r = e._getCpuGenericResponse({ ...d, cancellable: false }, pi); if (r !== undefined && r !== null && r !== true) return r; } catch { /* unten */ }
  return { cancelled: true };
}
function ziele(valid, config) {
  const elig = (valid || []).filter(v => !v.ineligible);
  const need = Math.max(1, (config && (config.minRequired || config.minTargets)) || 1);
  return elig.slice(0, need).map(v => v.id);
}

/**
 * Spielt `name` von Sitz `seat` über den echten Spielweg und beantwortet alle Fragen wie ein Mensch.
 *   o.cancelAt   null | k   — beim k-ten (0-basiert) ABBRECHBAREN Prompt abbrechen (Abbruch-Knopf)
 *   o.persist    true       — ab dem k-ten an JEDER weiteren abbrechbaren Stelle ebenfalls abbrechen (Spiel erneut geöffnete Auswahl = ganz zurück)
 *   o.answer     (entry) => Antwort | undefined   — eigene Antworten (entry: {kind, pi, d, valid, config, nr})
 *   o.call       () => Promise   — eigener Anstoß statt t.play (Aktivierungswege); o.hero, o.slot, ... wie t.play
 *   o.undoneFn   (t) => bool     — woran man erkennt, dass ein Abbruch alles zurückgegeben hat (Standard: Karte liegt noch auf der Hand)
 * Rückgabe: { result, tl, prompts, cancelSeen, cancelled, leaks, appearances, lastCancellableIdx, ... }
 */
async function spiele(t, seat, name, o = {}) {
  const { engine, gs, host, room } = t;
  const startIdx = t.tl.length;
  // W64b: Ausgangszustand von Gegner(n) und Zuschauer EXPLIZIT in die Zeitleiste schreiben (Dedupe-Cache umgangen) — Bezugspunkt für „erster Zustandswechsel".
  if (host.sendGameStateErzwungen) { for (let i = 0; i < gs.players.length; i++) if (i !== seat) host.sendGameStateErzwungen(room, i); host.sendSpectatorGameState && host.sendSpectatorGameState(room); }
  const handVorher = gs.players[seat].hand.filter(x => x === name).length;
  let cancellableSeen = 0, cancelled = false, done = false;
  const nr = { n: 0 };
  const entryFromPending = () => {
    if (engine._pendingGenericPrompt && gs.effectPrompt) return { kind: 'generic', pi: gs.effectPrompt.ownerIdx, d: gs.effectPrompt };
    if (engine._pendingPrompt && gs.potionTargeting && gs.potionTargeting.isEffectPrompt) return { kind: 'target', pi: gs.potionTargeting.ownerIdx, valid: gs.potionTargeting.validTargets, config: gs.potionTargeting.config || {}, d: { type: 'target', title: gs.potionTargeting.config && gs.potionTargeting.config.title } };
    return null;
  };
  let lastId = null, lastKind = null;
  const pump = async () => {
    while (!done) {
      await new Promise(r => setImmediate(r));
      const en = entryFromPending();
      if (!en) continue;
      const id = en.kind === 'generic' ? en.d.promptId : gs.potionTargeting;
      if (id === lastId && en.kind === lastKind) continue;       // dieselbe Frage nicht doppelt beantworten
      lastId = id; lastKind = en.kind;
      const cancellable = (en.pi === seat) && (en.kind === 'generic' ? !!en.d.cancellable : !!en.config.cancellable);   // nur Fragen AN DEN SPIELER zählen als Abbruchstellen
      const entry = { ...en, nr: nr.n++, cancellable };
      t.tl.push({ k: 'answer-begin', nr: entry.nr, kind: en.kind, cancellable, type: en.d && en.d.type, pi: en.pi });
      if (cancellable && o.cancelAt != null && (o.persist ? cancellableSeen >= o.cancelAt : cancellableSeen === o.cancelAt)) {
        cancellableSeen++; cancelled = true;
        t.tl.push({ k: 'cancel', nr: entry.nr });
        if (en.kind === 'generic') engine.resolveGenericPrompt({ cancelled: true }, en.d.promptId);
        else { gs.potionTargeting = null; engine.resolveEffectPrompt(null, { cancelled: true }); }
        continue;
      }
      if (cancellable) cancellableSeen++;
      let a = o.answer ? o.answer(entry) : undefined;
      if (a === CANCEL) { cancelled = true; t.tl.push({ k: 'cancel', nr: entry.nr }); if (en.kind === 'generic') engine.resolveGenericPrompt({ cancelled: true }, en.d.promptId); else { gs.potionTargeting = null; engine.resolveEffectPrompt(null, { cancelled: true }); } continue; }
      if (en.kind === 'generic') {
        if (a === undefined) a = standardAntwort(t, en.pi, en.d);
        t.tl.push({ k: 'answer', nr: entry.nr, kind: 'generic', a });
        engine.resolveGenericPrompt(a, en.d.promptId);
      } else {
        if (a === undefined) a = ziele(en.valid, en.config);
        t.tl.push({ k: 'answer', nr: entry.nr, kind: 'target', a });
        await host.doConfirmPotion(room, en.pi, { selectedIds: a });
      }
    }
  };
  const pumpP = pump();
  // Der Anstoß selbst (ein echter do*-Handler). Danach evtl. offene Ziel-Session (Spielweg „potionTargeting") ebenfalls menschlich beantworten.
  let result;
  try {
    result = o.call ? await t.run(o.call, o) : await t.play(seat, name, { ...o, noAutoConfirm: true });   // o.call: eigener Anstoß (Aktivierungswege: Kreatur-/Helden-/Ausrüstungs-Effekt, Fähigkeit …)
    let guard = 0;
    while (gs.potionTargeting && gs.potionTargeting.ownerIdx === seat && !gs.potionTargeting.isEffectPrompt && guard++ < 6) {
      const pt = gs.potionTargeting;
      const valid = (pt.validTargets || []).filter(v => !v.ineligible);
      const cancellable = !!(pt.config && pt.config.cancellable);
      const entry = { kind: 'session', pi: seat, valid, config: pt.config || {}, d: { type: 'target', title: pt.potionName }, nr: nr.n++, cancellable };
      t.tl.push({ k: 'prompt', pi: seat, kind: 'session', d: entry.d, cancellable });
      t.tl.push({ k: 'answer-begin', nr: entry.nr, kind: 'session', cancellable, type: 'target' });
      if (cancellable && o.cancelAt != null && (o.persist ? cancellableSeen >= o.cancelAt : cancellableSeen === o.cancelAt)) {
        cancellableSeen++; cancelled = true; t.tl.push({ k: 'cancel', nr: entry.nr });
        gs.potionTargeting = null;     // Server `cancel_potion`: Ziel-Session schließen
        try { engine.resolveEffectPrompt(null, { cancelled: true }); } catch { /* kein offener Prompt */ }
        break;
      }
      if (cancellable) cancellableSeen++;
      let a = o.answer ? o.answer(entry) : undefined;
      if (a === CANCEL) { cancelled = true; t.tl.push({ k: 'cancel', nr: entry.nr }); gs.potionTargeting = null; try { engine.resolveEffectPrompt(null, { cancelled: true }); } catch { /* ok */ } break; }
      if (a === undefined) a = ziele(valid, pt.config);
      t.tl.push({ k: 'answer', nr: entry.nr, kind: 'session', a });
      result = await t.run(() => host.doConfirmPotion(room, seat, { selectedIds: a }), o);
    }
  } finally { done = true; await pumpP; }
  const tl = t.tl.slice(startIdx);
  const handNachher = gs.players[seat].hand.filter(x => x === name).length;
  const out = analyse(t, seat, name, tl, { result, cancelled, cancellableSeen });
  out.handVorher = handVorher; out.handNachher = handNachher;
  out.undone = cancelled && (o.undoneFn ? !!o.undoneFn(t) : (handNachher >= handVorher && handVorher > 0));   // Karte liegt nach dem Abbruch noch auf der Hand = nie gespielt (Aktivierungen: o.undoneFn, z. B. Rundensperre nicht verbraucht)
  return out;
}

/** Wer ist „Gegner/Zuschauer" von `seat`? Sitzkennungen der Leitung. */
function fremd(t, seat) { const out = new Set(['SPEC']); for (let i = 0; i < t.gs.players.length; i++) if (i !== seat) out.add('S' + i); return out; }

/**
 * Auswertung der Zeitleiste. „Auftritt" = jede Nachricht an Gegner/Zuschauer, die den Kartennamen enthält
 * (card_reveal, Flug, Showcase …) ODER der Log-Eintrag der Karte (`card_played` …, im Zustand/Protokoll sichtbar).
 * „Leck" = ein Auftritt vor dem letzten abbrechbaren Prompt (bzw. überhaupt, wenn abgebrochen wurde).
 */
function analyse(t, seat, name, tl, extra) {
  const fr = fremd(t, seat);
  const hat = (e) => {
    if (e.k !== 'wire' || !fr.has(e.sid)) return false;
    if (e.ev === 'game_state' || e.ev === 'spectator_state') return !!(e.json && e.json.includes(JSON.stringify(name).slice(1, -1)));
    try { return JSON.stringify(e.data).includes(JSON.stringify(name).slice(1, -1)); } catch { return false; }
  };
  const idxOf = (pred) => { const r = []; tl.forEach((e, i) => { if (pred(e)) r.push(i); }); return r; };
  const appearances = idxOf(e => hat(e) && e.ev !== 'game_state' && e.ev !== 'spectator_state');
  const stateLeaks = idxOf(e => hat(e) && (e.ev === 'game_state' || e.ev === 'spectator_state'));
  // KANAL-Lecks: nur die Felder, über die eine Frage/Zielwahl/auflösende Karte verraten wird (Zielwahl, Abfrage, `resolvingCard`) — unabhängig davon, ob der Name sonst öffentlich auf dem Brett steht (Helden, Areas, Abilities)
  const kanalLeaks = idxOf(e => {
    if (!hat(e) || !(e.ev === 'game_state' || e.ev === 'spectator_state')) return false;
    let o; try { o = JSON.parse(e.json); } catch { return false; }
    const nm = name;
    const s = (x) => { try { return JSON.stringify(x) || ''; } catch { return ''; } };
    if (o.potionTargeting && s(o.potionTargeting).includes(nm)) return true;
    if (o.effectPrompt && s(o.effectPrompt).includes(nm)) return true;
    return (o.players || []).some(p => p && p.resolvingCard && s(p.resolvingCard).includes(nm));
  });
  // ── W64b: Auftritt VOR dem ersten Effekt (Al, 23.10.2026) ─────────────────────────────────────────────
  // Je Empfänger (Gegner-Sitze und Zuschauer): Index des ersten Auftritts (R) und des ersten EFFEKTS — a) ein Zustand (game_state), dessen Brett-/Hand-/Stapel-/Gold-/Statusstand vom Ausgangszustand abweicht,
  // b) ein Ereignis, das keine Ankündigung ist (alles außer card_reveal, hand_to_board_fly, ability_activated, potion_resolved und Protokollzeilen der Karte selbst), c) eine Effekt-Protokollzeile.
  const ANKUENDIGUNG = new Set(['card_reveal', 'hand_to_board_fly', 'ability_activated', 'potion_resolved', 'action_log', 'summon_effect', 'effect_source_glow']);
  const ANKUENDIGUNGS_LOG = /(_activated|_played|_summoned|_placed|_fizzle|_cancelled|_blocked)$/;
  const digestJ = (j) => { let o; try { o = JSON.parse(j); } catch { return null; }
    return JSON.stringify([(o.players || []).map(p => [(p.heroes || []).map(h => h && [h.hp, h.atk, JSON.stringify(h.statuses || {}), JSON.stringify(h.buffs || {})]), p.supportZones, p.hand ? p.hand.length : p.handCount, p.deckCount, p.potionDeckCount, p.discardPile && p.discardPile.length, p.deletedPile && p.deletedPile.length, p.gold, p.abilityZones, p.permanents && p.permanents.length, p.drawLocked, p.handLocked]), o.areaZones, o.doomCounters, o.turn]); };
  const pro = {};
  for (const sid of fr) {
    const mine = tl.map((e, i) => [e, i]).filter(([e]) => e.k === 'wire' && e.sid === sid);
    const stateJ = mine.filter(([e]) => (e.ev === 'game_state' || e.ev === 'spectator_state') && e.json);
    const base = stateJ.length ? digestJ(stateJ[0][0].json) : null;     // der erzwungene Ausgangszustand steht am Anfang der Zeitleiste
    const R = (() => { const a = mine.find(([e]) => e.ev !== 'game_state' && e.ev !== 'spectator_state' && hat(e)); return a ? a[1] : -1; })();
    const wechsel = base == null ? -1 : (() => { const a = stateJ.slice(1).find(([e]) => digestJ(e.json) !== base); return a ? a[1] : -1; })();
    const ereignis = (() => { const a = mine.find(([e]) => e.ev !== 'game_state' && e.ev !== 'spectator_state' && e.ev !== 'opponent_targeting' && !ANKUENDIGUNG.has(e.ev)); return a ? a[1] : -1; })();
    const effektLog = (() => { const a = mine.find(([e]) => e.ev === 'action_log' && e.data && !hat(e) && !ANKUENDIGUNGS_LOG.test(String(e.data.type || '')) && e.data.type !== 'phase_start'); return a ? a[1] : -1; })();
    const erste = [wechsel, ereignis, effektLog].filter(x => x >= 0).sort((a, b) => a - b)[0];
    pro[sid] = { R, wechsel, ereignis, effektLog, ersterEffekt: erste ?? -1, vorEffekt: R >= 0 && (erste == null || R < erste) };
  }
  const cancellablePrompts = idxOf(e => e.k === 'answer-begin' && e.cancellable);
  const cancelIdx = idxOf(e => e.k === 'cancel');
  const lastCancellableIdx = cancellablePrompts.length ? cancellablePrompts[cancellablePrompts.length - 1] : -1;
  // Grenze: bei Abbruch die Abbruchstelle, sonst der letzte abbrechbare Prompt (nach ihm gibt es keinen Abbruch mehr)
  const grenze = cancelIdx.length ? cancelIdx[0] : lastCancellableIdx;
  const leaks = appearances.filter(i => i < grenze || (cancelIdx.length && i > grenze));
  const wireOpp = tl.filter(e => e.k === 'wire' && fr.has(e.sid) && e.ev !== 'game_state' && e.ev !== 'spectator_state');
  const sehen = (e) => ({ sid: e.sid, ev: e.ev, d: (() => { try { return JSON.stringify(e.data).slice(0, 80); } catch { return '?'; } })() });
  return {
    result: extra.result, cancelled: extra.cancelled, cancellableSeen: extra.cancellableSeen,
    tl, appearances, stateLeaks, kanalLeaks, leaks, grenze, lastCancellableIdx, pro,
    leakEvents: leaks.map(i => sehen(tl[i])),
    // Nachrichten an Gegner/Zuschauer, die NICHT den Namen enthalten (Animationen etc.), mit Position relativ zur Grenze
    fremdVorGrenze: wireOpp.filter(e => tl.indexOf(e) < grenze).map(sehen),
    appearanceAfter: appearances.filter(i => i > grenze).length,
    sawAtAll: appearances.length > 0,
  };
}

/** Kurzdarstellung der Zeitleiste fürs Lesen. */
function drucke(r, say = console.log) {
  r.tl.forEach((e, i) => {
    if (e.k === 'wire') { if (e.ev === 'game_state' || e.ev === 'spectator_state') return; say(`  ${String(i).padStart(3)} → ${e.sid.padEnd(4)} ${e.ev} ${(() => { try { return JSON.stringify(e.data).slice(0, 90); } catch { return ''; } })()}`); }
    else if (e.k === 'prompt') say(`  ${String(i).padStart(3)} ? Frage[${e.kind}] S${e.pi} ${e.d && e.d.type} "${(e.d && e.d.title) || ''}" ${e.cancellable ? '(abbrechbar)' : ''}`);
    else if (e.k === 'answer-begin') say(`  ${String(i).padStart(3)} ? ... ${e.cancellable ? 'abbrechbar' : 'Pflicht'}`);
    else if (e.k === 'answer') say(`  ${String(i).padStart(3)} ! Antwort ${JSON.stringify(e.a).slice(0, 80)}`);
    else if (e.k === 'cancel') say(`  ${String(i).padStart(3)} ✕ ABBRUCH`);
    else if (e.k === 'log' && /played|cast|reveal|activated|equipped|summon/.test(e.type)) say(`  ${String(i).padStart(3)} L log ${e.type} ${JSON.stringify(e.data).slice(0, 80)}`);
  });
}

/**
 * Standard-Protokolltest einer Karte: ein DURCHLAUF (alle Fragen zustimmend beantwortet) und je ein ABBRUCH-Lauf für jede abbrechbare Stelle.
 *   mk()            async () => frische Szene (W.fresh …) — pro Lauf neu aufgebaut
 *   o.callFn(t)     (optional) eigener Anstoß statt t.play, mit der frischen Szene `t` (Aktivierungswege); `name` ist dann der Name, unter dem der Auftritt gesucht wird (Karte, Held, Area …)
 * Rückgabe { clean, cancels: [{k, r}] } — `r` wie bei `spiele`.
 */
async function durchlauf(mk, seat, name, o = {}) {
  const lauf = async (extra) => { const t = await mk(); const r = await spiele(t, seat, name, { ...o, ...(o.callFn ? { call: () => o.callFn(t) } : {}), ...extra }); return { t, r }; };
  const clean = await lauf({});
  const nCanc = clean.r.tl.filter(e => e.k === 'answer-begin' && e.cancellable).length;
  const cancels = [];
  for (let k = 0; k < Math.min(nCanc, o.maxCancel ?? 8); k++) cancels.push({ k, ...(await lauf({ cancelAt: k, persist: true })) });
  return { clean, cancels, nCanc };
}

/**
 * Standardprüfung eines Durchlaufs (R = H.runner()).
 *
 * Eine abbrechbare Stelle ist nur dann eine ECHTE Abbruchstelle des Kartenspiels, wenn ein Abbruch dort die Karte zurückgibt (sie liegt danach noch auf der Hand = „undone").
 * Fragen NACH dem Verbrauch der Karte („darf ich zusätzlich …?", Wahl nach bezahlten Kosten) sind keine Abbruchstellen des Spiels — dort darf die Karte schon gezeigt sein.
 * Aus den Abbruch-Läufen ergibt sich deshalb die GRENZE: die letzte Stelle, an der ein Abbruch die Karte noch zurückgibt. Erwartet:
 *   • DURCHLAUF: Karte gespielt; der Gegner UND der Zuschauer sehen die Karte (Auftritt) — aber erst NACH der Grenze; der Zustand (game_state) verrät sie vorher nicht.
 *   • ABBRUCH an einer echten Abbruchstelle: weder Gegner noch Zuschauer haben je etwas über die Karte erhalten (Ereignis, Protokollzeile, Zustand); die Karte liegt noch auf der Hand.
 * o.seat        Sitz des Spielers (Standard 0)
 * o.nCanc       erwartete Mindestzahl abbrechbarer Stellen
 * o.nEcht       erwartete Mindestzahl ECHTER Abbruchstellen (Standard 1)
 * o.keinAuftritt  true = Karte zeigt sich beim Durchlauf nicht (nur prüfen, dass vor der Grenze nichts kam)
 * o.oeffentlich   true = der Name steht ohnehin öffentlich auf dem Brett (Held, Area, Ability): im Zustand zählen nur Zielwahl-/Abfrage-/resolvingCard-Felder
 */
function pruefeDurchlauf(R, label, d, o = {}) {
  const c = d.clean.r;
  const seat = o.seat ?? 0;
  R.check(`${label}: Durchlauf ohne Engine-Fehler`, d.clean.t.errors.length === 0, d.clean.t.errors);
  if (o.nCanc != null) R.check(`${label}: mindestens ${o.nCanc} abbrechbare Stelle(n) (gefunden ${d.nCanc})`, d.nCanc >= o.nCanc, d.nCanc);
  const echte = d.cancels.filter(x => x.r.undone).map(x => x.k);
  R.check(`${label}: mindestens ${o.nEcht ?? 1} echte Abbruchstelle(n) (Abbruch gibt die Karte zurück) — gefunden ${echte.length}`, echte.length >= (o.nEcht ?? 1), echte);
  const canIdx = []; c.tl.forEach((e, i) => { if (e.k === 'answer-begin' && e.cancellable) canIdx.push(i); });
  const kMax = echte.length ? Math.max(...echte) : -1;
  const grenze = kMax >= 0 ? canIdx[kMax] : -1;
  const vorGrenze = (idxs) => idxs.filter(i => i < grenze);
  R.check(`${label}: KEIN Auftritt (Ereignis/Protokoll/Flug) für Gegner/Zuschauer vor der letzten echten Abbruchstelle`, vorGrenze(c.appearances).length === 0,
    vorGrenze(c.appearances).map(i => `${c.tl[i].sid}:${c.tl[i].ev}`));
  const _sl = (r) => (o.oeffentlich ? r.kanalLeaks : r.stateLeaks);   // oeffentlich: der Name steht ohnehin auf dem Brett (Held, Area, Ability) — dann zählen nur die Frage-/Zielwahl-Felder
  R.check(`${label}: KEIN Kartenname im Zustand (game_state) an Gegner/Zuschauer vor der letzten echten Abbruchstelle`, vorGrenze(_sl(c)).length === 0, vorGrenze(_sl(c)).slice(0, 5));
  if (!o.keinAuftritt) {
    R.check(`${label}: nach dem Commit sieht der Gegner die Karte`, c.appearances.some(i => i > grenze && c.tl[i].sid !== 'SPEC' && c.tl[i].sid !== 'S' + seat), c.appearances.length);
    R.check(`${label}: nach dem Commit sieht der Zuschauer die Karte`, c.appearances.some(i => i > grenze && c.tl[i].sid === 'SPEC'), c.appearances.length);
  }
  // W64b (Al, 23.10.2026): „Auftritte VOR BEGINN der Effekte streamen (aber nach dem Confirm)": je Empfänger kommt der Auftritt vor dem ersten Effekt-Ereignis, Effekt-Protokollzeile und Zustandswechsel.
  if (!o.keinAuftritt && !o.ohneEffektOrdnung) {
    for (const [sid, p] of Object.entries(c.pro || {})) {
      if (p.R < 0) continue;       // sieht die Karte gar nicht (oben geprüft)
      R.check(`${label}: ${sid} — Auftritt VOR dem ersten Effekt (Ereignis ${p.ereignis}, Zeile ${p.effektLog}, Zustandswechsel ${p.wechsel}; Auftritt ${p.R})`, p.vorEffekt, p);
    }
  }
  for (const { k, r, t } of d.cancels) {
    R.check(`${label}: Abbruch an Stelle ${k} — abgebrochen`, r.cancelled, r.cancellableSeen);
    R.check(`${label}: Abbruch an Stelle ${k} — keine Engine-Fehler`, t.errors.length === 0, t.errors);
    if (!r.undone) continue;     // keine echte Abbruchstelle: die Karte war da schon verbraucht
    R.check(`${label}: Abbruch an Stelle ${k} — Gegner/Zuschauer haben NICHTS über die Karte erhalten`, r.appearances.length === 0, r.leakEvents.length ? r.leakEvents : r.appearances.map(i => r.tl[i].ev));
    R.check(`${label}: Abbruch an Stelle ${k} — kein Kartenname im Zustand`, _sl(r).length === 0, _sl(r).length);
  }
}

/**
 * Reiche Standard-Szene für Protokolltests: beide Seiten haben Hand, Deck, Ablage und ein Brett mit Kreaturen, damit Zielwahlen, Galerien und Zonenfragen etwas anzubieten haben.
 *   seat          Wer spielt (am Zug). Standard 0.
 *   karten        Namen, die zusätzlich in die Hand des Spielers kommen (gespielt wird per `spiele`/`t.play`)
 *   board         (t, seat) => … zusätzliche Aufbauten
 * Gehört `name` nicht in die Szene (er soll NIRGENDS öffentlich stehen), prüft der Aufrufer das selbst.
 */
const _cards = Object.values(DB);
const _pick = (f, n) => _cards.filter(f).slice(0, n).map(c => c.name);
const REICH = {
  EQUIP: _pick(c => c.cardType === 'Artifact' && /equipment/i.test(c.subtype || '') && (c.cost || 0) <= 50, 6),
  CRE: _pick(c => c.cardType === 'Creature' && c.level === 0 && (c.subtype || '') === 'Normal', 10),
  SPL: _pick(c => c.cardType === 'Spell' && (c.subtype || '') === 'Normal' && c.level === 0, 6),
  ART: _pick(c => c.cardType === 'Artifact' && (c.subtype || '') === 'Normal', 4),
  POT: _pick(c => c.cardType === 'Potion', 3),
};
async function reicheSzene(o = {}) {
  const seat = o.seat ?? 0, opp = 1 - seat;
  // Die zu spielende Karte steht NIRGENDS sonst in der Szene (sonst verrät ein Namenstreffer im Zustand/Protokoll nichts über den Auftritt): aus Deck, Ablage und den Gegnerkarten gefiltert.
  const frei = (a) => a.filter(n => !(o.karten || []).includes(n));
  const deck = frei([...REICH.EQUIP, ...REICH.CRE, ...REICH.SPL, ...REICH.ART, ...REICH.POT]).concat(Array(10).fill(INERT.creature));
  const hand = [[], []]; hand[seat] = [...(o.karten || []), ...frei(REICH.SPL.slice(0, 2)), ...frei(REICH.CRE.slice(0, 2))]; hand[opp] = frei([REICH.SPL[0], REICH.CRE[0], REICH.CRE[1]]);
  const dec = [deck.slice(), deck.slice()];
  const disc = [[], []]; disc[seat] = frei([...REICH.CRE.slice(0, 3), ...REICH.SPL.slice(0, 2), REICH.EQUIP[0]]); disc[opp] = frei([...REICH.CRE.slice(3, 6), REICH.SPL[2]]);
  const t = await fresh({ scanState: o.scanState !== false, hand, deck: dec, discard: disc, potionDeck: [frei(REICH.POT), frei(REICH.POT)], gold: [300, 300], active: seat, heroes: o.heroes });
  t.put(seat, 1, 0, INERT.big).turnPlayed = 1; t.put(seat, 2, 0, INERT.creature).turnPlayed = 1;
  t.put(opp, 0, 0, INERT.big).turnPlayed = 1; t.put(opp, 1, 0, INERT.creature).turnPlayed = 1; t.put(opp, 2, 1, INERT.big).turnPlayed = 1;
  if (o.board) await o.board(t, seat);
  return t;
}

module.exports = Object.assign({}, H, { fresh, spiele, drucke, CANCEL, TAP, analyse, fremd, durchlauf, pruefeDurchlauf, reicheSzene, REICH });
