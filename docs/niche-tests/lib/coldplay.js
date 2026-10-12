'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  Kaltstart-Batterie: jede Handkarte in mehreren Standard-/Feind-Zuständen über den ECHTEN Spielweg ausspielen.
//  Geprüft: Ausnahmen, Hänger, Zustandsfehler, verschwundene Karten, und die Pflichtregel „zielende Karten sind abbrechbar"
//  (Abbruch ⇒ Karte bleibt auf der Hand, Gold/HP/Ablage/Aktion unverändert).
// ═══════════════════════════════════════════════════════════════════════════
const H = require('./h.js');
const { DB, PHASES, INERT } = H;
const D = INERT.creature, DBIG = INERT.big;

const VARIANTS = [
  { id: 'rich', desc: 'Volles Brett beiderseits, Hand/Deck/Ablage gefüllt' },
  { id: 'confirmNo', desc: 'wie rich, aber alle Ja/Nein-Fragen mit Nein', confirm: false },
  { id: 'cancel', desc: 'wie rich, aber jede Zielwahl wird abgebrochen', cancel: true },
  { id: 'lastTarget', desc: 'wie rich, aber es wird stets das LETZTE zulässige Ziel gewählt', last: true },
  { id: 'oppEmpty', desc: 'Gegner ohne Kreaturen' },
  { id: 'ownEmpty', desc: 'keine eigenen Kreaturen, leere Ablage, leeres Deck, nur die Karte auf der Hand' },
  { id: 'oppLow', desc: 'alle Gegner-Helden bei 30 HP (Tod/Spielende)', oppHp: 30 },
  { id: 'deck1', desc: 'Deck mit genau 1 Karte', deck: 1 },
  { id: 'gold0', desc: 'Gold 0', gold: 0 },
  { id: 'oppHeroOne', desc: 'Gegner hat nur 1 Held (200 HP)', oneOppHero: true },
];

function setup(t, name, v) {
  const cd = DB[name];
  const gs = t.gs;
  const empty = v.id === 'ownEmpty';
  for (const s of [0, 1]) {
    for (let hi = 0; hi < 3; hi++) {
      if (s === 1 && v.id === 'oppEmpty') continue;
      if (s === 0 && empty) continue;
      if (!t.zone(s, hi, 0)) t.put(s, hi, 0, D);
      if (hi === 0 && !(s === 0 && empty) && !t.zone(s, hi, 1)) t.put(s, hi, 1, DBIG);
    }
  }
  if (v.oneOppHero) { gs.players[1].heroes[1] = { name: null, hp: 0, maxHp: 0, atk: 0, baseAtk: 0, statuses: {} }; gs.players[1].heroes[2] = { name: null, hp: 0, maxHp: 0, atk: 0, baseAtk: 0, statuses: {} }; for (const c of t.inst(c => c.owner === 1 && c.heroIdx > 0)) t.engine._untrackCard(c.id); gs.players[1].supportZones[1] = [[], [], []]; gs.players[1].supportZones[2] = [[], [], []]; t.hero(1, 0).hp = 200; t.hero(1, 0).maxHp = 200; }
  if (v.oppHp) for (const h of gs.players[1].heroes) if (h && h.name) { h.hp = v.oppHp; }
  for (const s of [0, 1]) {
    gs.players[s].discardPile = empty ? [] : [D, DBIG, INERT.filler];
    gs.players[s].mainDeck = empty ? [] : Array(v.deck ?? 12).fill(D);
    if (v.deck === 1) gs.players[s].mainDeck = [DBIG];
    gs.players[s].gold = v.gold ?? 100;
  }
  // Hand: die Karte + Füller
  t.setHand(0, empty ? [name] : [name, INERT.filler, INERT.filler]);
  t.setHand(1, empty ? [] : [INERT.filler, INERT.filler]);
  gs.activePlayer = 0;
  // Sicht auf Helden-Stand merken
  t.grantFor(0, 0, name);
}

/** Zustandsfingerabdruck für die Abbruch-Prüfung. */
function fingerprint(t) {
  const gs = t.gs;
  return JSON.stringify({
    hand: gs.players.map(p => p.hand), gold: gs.players.map(p => p.gold),
    hp: gs.players.map(p => p.heroes.map(h => h && [h.hp, h.maxHp, h.atk, Object.keys(h.statuses || {}).sort()])),
    discard: gs.players.map(p => p.discardPile), deck: gs.players.map(p => p.mainDeck.length), deleted: gs.players.map(p => p.deletedPile),
    sup: gs.players.map(p => p.supportZones), area: gs.areaZones, surprise: gs.players.map(p => p.surpriseZones),
    acts: gs.players.map(p => [p._actionsPlayedThisPhase || 0, p._actionsPlayedThisTurn || 0, (p.heroesActedThisTurn || []).length]),
    creatures: t.engine.cardInstances.filter(c => c.zone === 'support').map(c => [c.name, c.owner, c.heroIdx, c.zoneSlot, JSON.stringify(c.counters), JSON.stringify(c.statuses)]),
    abil: gs.players.map(p => p.abilityZones),
    once: gs.players.map(p => p._oncePerGameUsed ? [...p._oncePerGameUsed] : []),
  });
}

async function coldplay(name, v, opts = {}) {
  const cd = DB[name];
  const t = await H.fresh({ hand: [[], []], gold: 100 });
  t._capture();
  const rec = { name, variant: v.id, type: cd.cardType, sub: cd.subtype };
  try {
    t.policy.confirm = v.confirm !== false;
    t.policy.cancelTargets = !!v.cancel;
    if (v.last) t.targetFn = (valid) => valid.length ? [valid[valid.length - 1].id] : [];
    setup(t, name, v);
    const before = t.census();
    const fp0 = fingerprint(t);
    const sub = (cd.subtype || '').toLowerCase();
    t.reset();
    t._capture();   // reset leert errors – Capture bleibt
    let r;
    if (cd.cardType === 'Hero' || cd.cardType === 'Ascended Hero' || cd.cardType === 'Token') { rec.skipped = 'Typ'; return rec; }
    r = await t.play(0, name, { hero: 0, noGrant: true });
    rec.result = r && r.runaway ? 'runaway' : (r && r.threw ? 'threw' : (r && r.hung ? 'hung' : r));
    rec.prompts = t.prompts.length; rec.targetPrompts = t.targets.length;
    rec.errors = [...new Set(t.errors)].slice(0, 5);
    rec.audit = t.audit().slice(0, 5);
    const after = t.census();
    const dec = [];
    for (const [k, c] of before) { const d = (after.get(k) || 0) - c; if (d < 0 && !/Token/.test(k) && !(DB[k] && DB[k].cardType === 'Token')) dec.push(`${k}: ${d}`); }
    rec.lost = dec;
    rec.gameOver = t.engine.over && t.engine.over.called ? t.engine.over.reason : null;
    if (v.cancel && t.targets.length > 0) {
      const fp1 = fingerprint(t);
      rec.cancelUnchanged = (fp0 === fp1);
      if (!rec.cancelUnchanged) {
        // Was hat sich geändert? (grobe Diagnose)
        const a = JSON.parse(fp0), b = JSON.parse(fp1); const diff = [];
        for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diff.push(k);
        rec.cancelDiff = diff;
      }
    }
    rec.stillInHand = t.gs.players[0].hand.includes(name);
    rec.gold = [t.gs.players[0].gold, t.gs.players[1].gold];
  } catch (e) { rec.harness = (e && e.stack || String(e)).split('\n').slice(0, 3).join(' | '); }
  finally { t._release(); }
  return rec;
}

module.exports = { coldplay, VARIANTS };
