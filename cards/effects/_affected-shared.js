// ═══════════════════════════════════════════
//  GETEILT: „Wurde dieser Held gerade vom GEGNER getroffen?"
//
//  Anlass (v1067, Als Befund 14.9.): „Es gibt ziemlich sicher schon
//  andere Effekte, die auf jeden Hit inklusive Status/Buffs/Debuffs
//  reagieren — da muss auch das neue On-Buff-System benutzt werden."
//
//  Er hatte recht. „Charm of Balance" traegt woertlich denselben
//  Trigger wie „The Stormblade" („Whenever that Hero is affected by an
//  opponent's card or effect") und lauschte nur auf ZWEI der vier
//  Wege — Schaden und Status. Heilungen und Buffs des Gegners liefen
//  daran vorbei.
//
//  ── DIE VIER WEGE ─────────────────────────────────────────────────
//  Ein Held kann auf genau vier Arten von einem Effekt erreicht
//  werden, und fuer jede gibt es einen Hook, der erst feuert, wenn
//  wirklich etwas angekommen ist:
//
//    afterDamage      — Schaden ist gelandet
//    afterHeal        — Heilung ist gelandet
//    onStatusApplied  — Status liegt an
//    afterBuff        — Buff liegt an   (v1066 neu; vorher gab es nur
//                       das abbrechbare BEFORE_HERO_EFFECT, das zu
//                       frueh feuert und spaeter abgebrochene Buffs
//                       mitzaehlen wuerde)
//
//  Jeder Hook liefert Ziel und Quelle in einer ANDEREN Form. Genau
//  diese vier Formen kennt dieses Modul — und sonst niemand. Wer den
//  Trigger nachbaut, ruft `getroffenVon` und muss die Formen nicht
//  kennen.
//
//  ── QUELLE IST PFLICHT ────────────────────────────────────────────
//  Ohne erkennbare Quelle wird NICHT ausgeloest. Das ist die sichere
//  Richtung: lieber einmal zu wenig als beim eigenen Heilzauber.
//  `scripts/check-effect-source.js` haelt dagegen, dass neue Karten die
//  Quelle auch wirklich mitgeben.
// ═══════════════════════════════════════════

/** Seite einer Quelle (Karteninstanz oder schlichtes {owner}-Objekt). */
function quellenSeite(source) {
  if (!source || typeof source !== 'object') return null;
  const s = source.controller ?? source.owner;
  return (typeof s === 'number' && s >= 0) ? s : null;
}

/** Heldenobjekt → {owner, heroIdx}, oder null. */
function heldenPlatz(engine, hero) {
  if (!hero) return null;
  for (let pi = 0; pi < (engine.gs.players || []).length; pi++) {
    const hi = (engine.gs.players[pi]?.heroes || []).indexOf(hero);
    if (hi >= 0) return { owner: pi, heroIdx: hi };
  }
  return null;
}

/**
 * Hat ein GEGNER von `meineSeite` gerade den Helden
 * (`meineSeite`, `meinHeroIdx`) getroffen?
 *
 * @param {string} art  'afterDamage' | 'afterHeal' | 'onStatusApplied' | 'afterBuff'
 * @param {object} ctx  der Hook-Kontext, unveraendert
 * @returns {number|null} die Seite des Verursachers, oder null
 */
function getroffenVon(art, ctx, meineSeite, meinHeroIdx) {
  const engine = ctx._engine;
  if (!engine) return null;

  let zielOwner = null, zielHeroIdx = null, quelle = null;

  if (art === 'afterDamage') {
    if (!(ctx.amount > 0) && !(ctx.realDealt > 0)) return null;
    const platz = heldenPlatz(engine, ctx.target);
    if (!platz) return null;                    // Kreaturenschaden
    zielOwner = platz.owner; zielHeroIdx = platz.heroIdx;
    quelle = ctx.source;

  } else if (art === 'afterHeal') {
    if (!(ctx.healedAmount > 0)) return null;
    zielOwner = ctx.targetOwner; zielHeroIdx = ctx.targetHeroIdx;
    quelle = ctx.source;

  } else if (art === 'onStatusApplied') {
    const platz = heldenPlatz(engine, ctx.target);
    if (!platz) return null;                    // Kreaturen-Status
    zielOwner = platz.owner; zielHeroIdx = platz.heroIdx;
    // `appliedBy` ist die uebliche Angabe (Snow Cannon, Trunk Sand);
    // die gestempelten opts liegen zusaetzlich am Status selbst, was
    // „Charm of Balance" seit jeher liest.
    const o = ctx.opts || ctx.target?.statuses?.[ctx.statusName] || {};
    quelle = (typeof o.appliedBy === 'number') ? { owner: o.appliedBy }
      : (typeof o.sourceOwner === 'number') ? { owner: o.sourceOwner }
      : o.source;

  } else if (art === 'afterBuff') {
    zielOwner = ctx.targetOwner; zielHeroIdx = ctx.targetHeroIdx;
    const o = ctx.opts || {};
    quelle = (typeof o.sourceOwner === 'number') ? { owner: o.sourceOwner } : o.source;

  } else {
    return null;
  }

  if (zielOwner !== meineSeite) return null;
  if (zielHeroIdx !== meinHeroIdx) return null;

  const verursacher = quellenSeite(quelle);
  if (verursacher == null || verursacher === meineSeite) return null;
  return verursacher;
}

/** Die vier Hook-Namen, damit Karten sie nicht abschreiben. */
const TREFFER_HOOKS = ['afterDamage', 'afterHeal', 'onStatusApplied', 'afterBuff'];

/**
 * Baut den kompletten Hook-Satz fuer „dieser Held wurde vom Gegner
 * getroffen". `fn(ctx, verursacher)` laeuft genau dann, wenn es
 * wirklich ein gegnerischer Treffer auf `holeHeld(ctx)` war.
 *
 * @param {(ctx:object) => ({owner:number, heroIdx:number}|null)} holeHeld
 * @param {(ctx:object, verursacher:number) => any} fn
 */
function trefferHooks(holeHeld, fn) {
  const satz = {};
  for (const art of TREFFER_HOOKS) {
    satz[art] = async (ctx) => {
      const held = holeHeld(ctx);
      if (!held) return;
      const verursacher = getroffenVon(art, ctx, held.owner, held.heroIdx);
      if (verursacher == null) return;
      await fn(ctx, verursacher);
    };
  }
  return satz;
}

module.exports = { quellenSeite, heldenPlatz, getroffenVon, trefferHooks, TREFFER_HOOKS };
