'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Ultimate Weapon Experiment"  (v1296)
//  Spell (Normal) — Support Magic Lv1
//
//  "Search your deck for an Ascended Hero whose Ascension Conditions are
//   fulfilled by a Hero you control and play it on top of that Hero.
//   Then, heal that Ascended Hero's HP completely and remove all
//   negative status effects from it. This counts as an additional Action."
//
//  Rulings (Al, 23.9.):
//   • Die Karte unterbindet das Rundenende durch die Ascension NICHT.
//     Es feuert — sofern die Form es nicht selbst unterdrueckt (Waflav-
//     Formen: `blockEndPhaseOnAscend`) — NACH der Aufloesung dieser
//     Karte. Weg: `gs._spellEndsTurn`, das `doPlaySpell` erst nach der
//     Aufloesung einloest.
//   • Ascension-Bonus ganz normal, Kosten (Waflav-Formen) ganz normal.
//     Beides macht `performAscension` selbst — hier wird NICHTS davon
//     uebersprungen.
//
//  Bauteile:
//   • `performAscension(… { fromDeck: true, skipChain: true })` — Deck
//     statt Hand (v1296), keine zweite Kette (diese Karte hatte ihre).
//   • „fulfilled": dieselbe Pruefung wie der normale Aufstieg —
//     `ascensionCondition` der Zielkarte, sonst `ascensionReady` samt
//     Zielname am Helden; dazu die gedruckte Namensbindung.
//   • KEINE Such-Sperre (Als Ruling 23.9.): die gilt nur fuer „vom Deck
//     suchen und auf die HAND nehmen" — diese Karte spielt den Ascended
//     Hero direkt aufs Feld. Die Stapel-Sperre (`pileOutAllowed`, „keine
//     Karten aus dem Deck") gilt dagegen weiter.
//   • Abbrechbar bis zum Zusagepunkt (Als Regel 23.9.); der Reveal wird
//     bis dahin zurueckgehalten (`_holdCardReveal`, CARD_API).
// ═══════════════════════════════════════════
const CARD_NAME = 'Ultimate Weapon Experiment';

function bedingungErfuellt(engine, pi, heroIdx, name) {
  const gs = engine.gs;
  const hero = gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (!engine.getAscendedFormsFor(hero.name).includes(name)) return false;
  const script = require('./_loader').loadCardEffect(name);
  if (script?.plainHeroForm) return false;
  if (typeof script?.ascensionCondition === 'function') {
    try { return !!script.ascensionCondition(gs, pi, heroIdx, engine); } catch { return false; }
  }
  return !!hero.ascensionReady
    && (hero.ascensionTarget === name || (hero.ascensionTargets || []).includes(name));
}

/** { name → [heroIdx …] } fuer alle Ascended Heroes im Deck mit mind. einem Wirt. */
function kandidaten(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return new Map();
  if (typeof engine.pileOutAllowed === 'function' && !engine.pileOutAllowed(pi, 'deck', {})) return new Map();
  const db = engine._getCardDB();
  const out = new Map();
  for (const name of new Set(ps.mainDeck || [])) {
    if (db[name]?.cardType !== 'Ascended Hero') continue;
    const wirte = (ps.heroes || []).map((_, hi) => hi).filter(hi => bedingungErfuellt(engine, pi, hi, name));
    if (wirte.length) out.set(name, wirte);
  }
  return out;
}

module.exports = {
  activeIn: ['hand'],
  inherentAction: true,            // „This counts as an additional Action."
  // Bewusst KEIN `blockedBySearchLock` — siehe Kopf (Ruling 23.9.).

  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    return !eng || kandidaten(eng, pi).size > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const abbruch = () => { gs._spellCancelled = true; };

      gs._holdCardReveal = true;
      try {
        const k = kandidaten(engine, pi);
        if (k.size === 0) { abbruch(); return; }

        // ① Welcher Ascended Hero? — Galerie aus dem Deck, abbrechbar.
        const wahl = await engine.promptGeneric(pi, {
          type: 'cardGallery',
          title: CARD_NAME, source: CARD_NAME,
          description: 'Choose an Ascended Hero from your deck whose Ascension Conditions a Hero you control fulfills.',
          cards: [...k.keys()].map(name => ({ name, source: 'deck' })),
          searchPile: 'deck',
          cancellable: true,
        });
        const name = wahl?.cardName;
        if (!name || !k.has(name)) { abbruch(); return; }

        // ② Auf welchen Helden? — nur fragen, wenn mehrere passen.
        let heroIdx = k.get(name)[0];
        if (k.get(name).length > 1) {
          const wirte = k.get(name);
          const ziele = (ps.heroes || []).map((h, hi) => ({
            id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h?.name,
            // Helden, die die Bedingung NICHT erfuellen, ausgegraut zeigen.
            ...(wirte.includes(hi) ? {} : { ineligible: true }),
          })).filter(t => t.cardName && (ps.heroes[t.heroIdx]?.hp > 0));
          const ids = await engine.promptEffectTarget(pi, ziele, {
            title: CARD_NAME, source: CARD_NAME, previewCardName: name,
            description: `Choose the Hero ${name} is played on top of.`,
            confirmLabel: '🧪 Ascend!', confirmClass: 'btn-success',
            cancellable: true, maxTotal: 1, greenSelect: true,
            _skipRedirectCheck: true, _skipPostTargetReactions: true,
          });
          const t = ziele.find(z => z.id === ids?.[0] && !z.ineligible);
          if (!t) { abbruch(); return; }
          heroIdx = t.heroIdx;
        }
        // Zustand kann sich zwischen Angebot und Antwort verschoben haben.
        if (!bedingungErfuellt(engine, pi, heroIdx, name)) { abbruch(); return; }

        // ── ZUSAGEPUNKT: ab hier sieht der Gegner die Karte ──
        gs._holdCardReveal = false;
        engine._firePendingCardReveal();

        const res = await engine.performAscension(pi, heroIdx, name, -1, {
          fromDeck: true, skipChain: true, source: CARD_NAME,
        });
        if (!res?.success) {
          engine.log('ultimate_weapon_experiment', { player: ps.username, card: name, ok: false });
          engine.sync();
          return;
        }

        // ③ Voll heilen, alle entfernbaren negativen Status weg.
        const hero = ps.heroes[heroIdx];
        if (hero?.name && hero.hp > 0) {
          const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: ctx.cardHeroIdx ?? -1 };
          const fehlt = (hero.maxHp || 0) - hero.hp;
          if (fehlt > 0) await engine.actionHealHero(quelle, hero, fehlt);
          const keys = engine.getRemovableHeroStatuses(hero);
          if (keys.length) engine.cleanseHeroStatuses(hero, pi, heroIdx, keys, CARD_NAME);
        }

        // ④ Rundenende der Ascension — NACH dieser Karte (Ruling).
        // `'baseMechanic'`: das Zugende gehoert dem Aufstieg (Grundmechanik),
        // nicht dieser Karte — Tuscan Prisoner haelt es nicht auf (server.js).
        if (res.skipEndPhase) gs._spellEndsTurn = 'baseMechanic';

        engine.log('ultimate_weapon_experiment', { player: ps.username, card: name, hero: hero?.name, ok: true, endsTurn: !!res.skipEndPhase });
        engine.sync();
      } finally {
        delete gs._holdCardReveal;
      }
    },
  },

  // CPU: immer spielen, wenn es einen Kandidaten gibt; erste Galerie-
  // Karte, erster erlaubter Held.
  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'cardGallery' && payload?.title === CARD_NAME) {
      const e = (payload.cards || [])[0];
      return e ? { cardName: e.name, source: e.source } : undefined;
    }
    if (kind === 'effectTarget') {
      const t = (payload?.validTargets || []).find(x => !x.ineligible);
      return t ? [t.id] : undefined;
    }
    return undefined;
  },

  _test: { kandidaten, bedingungErfuellt },
};
