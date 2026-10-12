'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  Dauerfeuer ("Barrage"): eine Karte X in ihre natürliche Zone legen und dann ein festes Skript echter Spielereignisse
//  laufen lassen (Schaden, Heilung, Beschwörung, Tod von Kreatur/Held, Status, Ziehen, Abwerfen, Gold, Zugwechsel ×2).
//  Gesammelt werden: verschluckte Engine-Fehler (console.error), Wurf-Ausnahmen, Hänger, Zustands-Auffälligkeiten.
//  Baseline (ohne X) wird abgezogen, damit Treiber-Fehler nicht X angelastet werden.
// ═══════════════════════════════════════════════════════════════════════════
const H = require('./h.js');
const { DB, loadCardEffect, PHASES, INERT } = H;

const D = INERT.creature, DB_ = INERT.big;

/** Treiber-Hilfe: Zielwahl-Funktion, die ein bestimmtes Ziel bevorzugt. */
function want(t, pred) {
  t.targetFn = (valid) => {
    const hit = valid.find(pred);
    return hit ? [hit.id] : (valid.length ? [valid[0].id] : []);
  };
}
const isHero = (owner, hi) => v => v.type === 'hero' && v.owner === owner && (hi == null || v.heroIdx === hi);
const isCre = (owner) => v => v.type === 'creature' && v.owner === owner;

async function safe(t, label, fn, tag) {
  try {
    if (t._refresh) await t._refresh();   // opts.refresh: Zustand (z. B. Held-Status) vor jedem Schritt erneut behaupten
    const r = await t.run(fn, { timeoutMs: 6000 }); if (r && r.hung) tag.hung.push(label); if (r && r.threw) tag.threw.push(label + ': ' + (r.threw.message || r.threw)); return r; }
  catch (e) { tag.threw.push(label + ': ' + e.message); }
}

/** Platziert X seiner Art entsprechend. side = Sitz, der X kontrolliert. Gibt Beschreibung der Platzierung. */
function place(t, name, side, variant, host = 0) {
  const cd = DB[name]; const gs = t.gs;
  const sub = (cd.subtype || '').toLowerCase();
  const ps = gs.players[side];
  const put = [];
  if (cd.cardType === 'Hero' || cd.cardType === 'Ascended Hero') {
    t.setHero(side, host, name, 800); put.push('hero' + host);
    return put;
  }
  if (cd.cardType === 'Ability') {
    const n = variant === 'lv3' ? 3 : 1;
    t.setAbilities(side, host, [Array(n).fill(name), [], []]); put.push('ability x' + n + ' @hero' + host);
    return put;
  }
  if (cd.cardType === 'Creature' || cd.cardType === 'Token' || cd.cardType === 'Creature/Token' || (cd.cardType === 'Artifact' && (sub === 'equipment' || sub === 'creature'))) {
    if (sub === 'surprise') { t.putSurprise(side, 0, name); put.push('surprise0'); }
    else { t.put(side, 0, 1, name); put.push('support h0 s1'); }
    if (variant === 'boardOnly') return put;   // nur aufs Brett (Differenztests: kein Einfluss durch Hand-/Ablage-Passive)
    // zusätzlich in Hand/Ablage (Passiv-Zonen)
    t.addHand(side, name); put.push('hand');
    ps.discardPile.push(name); engineTrackDiscard(t, name, side); put.push('discard');
    return put;
  }
  if (sub === 'surprise') { t.putSurprise(side, 0, name); put.push('surprise0'); t.addHand(side, name); put.push('hand'); return put; }
  if (sub === 'area') { t.putArea(side, name); put.push('area'); t.addHand(side, name); put.push('hand'); return put; }
  // Spell / Attack / Potion / Artifact (Normal, Reaction, Attachment …): Hand + Ablage + Deck-Oben
  t.addHand(side, name); put.push('hand');
  ps.discardPile.push(name); engineTrackDiscard(t, name, side); put.push('discard');
  ps.mainDeck.unshift(name); put.push('deck-top');
  return put;
}
function engineTrackDiscard(t, name, side) { try { t.engine._trackCard(name, side, 'discard'); } catch { /* manche Engines führen keine Ablage-Instanzen */ } }

/** Standard-Brett: je Seite Dummys auf allen Helden, damit Ziele und Opfer existieren. */
function board(t) {
  for (const s of [0, 1]) for (let hi = 0; hi < 3; hi++) {
    if (!t.zone(s, hi, 0)) t.put(s, hi, 0, D);
    if (hi === 0 && !t.zone(s, hi, 2)) t.put(s, hi, 2, DB_);
  }
  for (const s of [0, 1]) { t.gs.players[s].discardPile.push(D, DB_); }
}

/**
 * Das Dauerfeuer. opts: { name, side:0|1, variant }.
 * Ergebnis: { errors:[], threw:[], hung:[], audit:[], census:[], placed:[] }
 */
async function barrage(opts) {
  const { name, side = 0, variant = '' } = opts;
  const t = await H.fresh({ hand: [[], []], deckSize: 12, gold: 120 });
  const tag = { threw: [], hung: [] };
  t._capture();
  if (opts.refresh) t._refresh = () => opts.refresh(t);
  const res = { name, side, variant, errors: [], threw: tag.threw, hung: tag.hung, audit: [], census: [], placed: [], gameOver: null };
  const useX = name != null;
  try {
    board(t);
    if (useX) res.placed = place(t, name, side, variant, opts.host ?? 0);
    if (opts.mod) await opts.mod(t, useX ? t.find(name, 'support') : null);
    // Treiberkarten in die Hände
    t.addHand(0, 'Fireball'); t.addHand(0, 'Heal'); t.addHand(0, D); t.addHand(0, D);
    t.addHand(1, 'Fireball'); t.addHand(1, D); t.addHand(1, 'Heal');
    for (const s of [0, 1]) t.grantFor(s, 0, 'Fireball');
    for (const s of [0, 1]) t.grantFor(s, 0, 'Heal');
    t.gs.activePlayer = 0; t.gs.currentPhase = PHASES.ACTION;
    const before = t.census();

    // ── Zug A (Sitz 0): Gegner-Held beschießen, eigenen heilen, beschwören ──
    want(t, isHero(1, 0));
    await safe(t, 'A1 Fireball→Gegner-Held', () => t.play(0, 'Fireball', { hero: 0 }), tag);
    want(t, isHero(0, 0));
    await safe(t, 'A2 Heal→eigener Held', () => t.play(0, 'Heal', { hero: 0 }), tag);
    want(t, () => false);
    await safe(t, 'A3 Beschwörung', () => t.play(0, D, { hero: 1, slot: 1 }), tag);
    // Primitive: Status, Gold, Ziehen, Abwerfen
    const e = t.engine;
    await safe(t, 'A4 Status burned/poisoned/frozen auf eigenen Helden 1', async () => {
      await e.addHeroStatus(0, 1, 'burned', { duration: 2, appliedBy: 1 });
      await e.addHeroStatus(0, 2, 'poisoned', { duration: 2, appliedBy: 1, stacks: 1 });
      await e.addHeroStatus(1, 1, 'frozen', { duration: 1, appliedBy: 0 });
    }, tag);
    await safe(t, 'A5 Kreatur-Status', async () => {
      const c = t.find(D, 'support'); if (c) { await e.applyCreatureStatus(c, 'frozen', { sourceOwner: 1 }); await e.applyCreatureStatus(c, 'poisoned', { sourceOwner: 1 }); }
    }, tag);
    await safe(t, 'A6 Gold +30/-20', async () => { await e.actionGainGold(0, 30); await e.actionSpendGold(0, 20); await e.actionGainGold(1, 15); }, tag);
    await safe(t, 'A7 Ziehen 2 / Abwerfen 1 / Mill 1', async () => { await e.actionDrawCards(0, 2); await e.actionMillCards(1, 1); }, tag);
    await safe(t, 'A8 Kreatur töten (alle Dummys)', async () => {
      for (const c of e.cardInstances.filter(c => c.zone === 'support' && c.name === D).slice(0, 3)) {
        const tgt = c; await e.actionDealCreatureDamage({ name: 'Test', owner: 1 }, tgt, 999, 'creature');
      }
    }, tag);
    // ── Zugwechsel A→B ──
    await safe(t, 'T1 Zug endet (Sitz 0)', () => t.endTurn(), tag);
    // ── Zug B (Sitz 1) ──
    t.gs.currentPhase = PHASES.ACTION;
    want(t, isHero(0, 0));
    await safe(t, 'B1 Fireball Sitz1→Held von Sitz 0', () => t.play(1, 'Fireball', { hero: 0 }), tag);
    await safe(t, 'B2 Beschwörung Sitz 1', () => t.play(1, D, { hero: 1, slot: 1 }), tag);
    await safe(t, 'B3 Heldentod Sitz 0 Held 1', async () => { const h = t.hero(0, 1); h.hp = 1; await e.actionDealDamage({ name: 'Test', owner: 1, heroIdx: 0 }, h, 50, 'creature'); }, tag);
    await safe(t, 'B4 Wiederbeleben', async () => { await e.actionReviveHero(0, 1, 100, {}); }, tag);
    await safe(t, 'T2 Zug endet (Sitz 1)', () => t.endTurn(), tag);
    // ── Zug C (Sitz 0), Kampf bis zum Spielende ──
    t.gs.currentPhase = PHASES.ACTION;
    want(t, isHero(1, 0));
    await safe(t, 'C1 Fireball→Gegner-Held (bei niedrigen HP)', async () => { t.hero(1, 0).hp = 100; return t.play(0, 'Fireball', { hero: 0 }); }, tag);
    await safe(t, 'C2 Alle Gegner-Helden töten → Spielende', async () => {
      for (const hi of [0, 1, 2]) { const h = t.hero(1, hi); if (h && h.name && h.hp > 0) { h.hp = 1; await e.actionDealDamage({ name: 'Test', owner: 0, heroIdx: 0 }, h, 100, 'creature'); } }
    }, tag);
    res.gameOver = t.engine.over && t.engine.over.called ? { winner: t.engine.over.winnerIdx, reason: t.engine.over.reason } : null;
    res.audit = t.audit();
    res.census = t.censusDiff(before, t.census());
    res.fp = fingerprint(t);
  } catch (e) { tag.threw.push('Harness: ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); }
  finally { t._release(); }
  res.errors = t.errors.slice();
  res.warns = t.warns.slice();
  return res;
}

/** Zustands-Fingerabdruck am Ende des Dauerfeuers (für Differenzvergleiche): Gold, Hände, Stapel, Helden, Brett, Log-Histogramm. */
function fingerprint(t) {
  const gs = t.gs;
  const hist = {};
  for (const l of t.logs) hist[l.type] = (hist[l.type] || 0) + 1;
  return JSON.stringify({
    gold: gs.players.map(p => p.gold), hand: gs.players.map(p => [...p.hand].sort()), deck: gs.players.map(p => p.mainDeck.length),
    discard: gs.players.map(p => [...p.discardPile].sort()), deleted: gs.players.map(p => [...(p.deletedPile || [])].sort()),
    heroes: gs.players.map(p => p.heroes.map(h => h && h.name ? [h.hp, h.maxHp, h.atk, Object.keys(h.statuses || {}).sort()] : null)),
    sup: gs.players.map(p => p.supportZones.map(h => h.map(z => z.join('+')))),
    surprise: gs.players.map(p => p.surpriseZones), area: gs.areaZones, hist,
  });
}

/** Normiert eine Fehlerzeile zu einer Signatur (Zahlen/IDs raus). */
function sig(s) { return String(s).replace(/\([0-9a-f]{8}-[0-9a-f]{3}\)/g, '(id)').replace(/[0-9a-f]{8}-[0-9a-f]{3}/g, 'id').replace(/\b\d+\b/g, 'N').slice(0, 260); }

module.exports = { barrage, place, board, sig, fingerprint };
