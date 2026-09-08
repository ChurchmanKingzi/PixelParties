// ═══════════════════════════════════════════
//  CARD EFFECT: "Audience with a hostile King"
//  Spell (Decay Magic, Lv 1) — Normal. Inherent additional Action.
//
//  "Choose an Ascended Hero your opponent controls and Descend it by
//   sending the Ascended Hero from the top of it to the discard pile.
//   This counts as an additional Action."
//
//  ── ALS RULINGS (31.8.), BINDEND ──────────────────────────────────
//  ① Das ist ein NORMALER Descend: er kann nicht toeten (Boden bei 1),
//     reduziert aber die HP um die gedruckte max-HP-Differenz — und
//     GEGEN DIESE REDUKTION GIBT ES KEINEN SCHUTZ. Beides erledigt
//     `performDescend` selbst (v674-Regel, OHNE `notADescend`); die
//     Reduktion laeuft nie durch die Schadensleitung, also greifen
//     weder Schilde noch Schadensauloeser. Hier NICHTS nachbauen.
//  ② Waflav: nur die OBERSTE Form wird abgelegt. Liegt darunter noch
//     eine Ascended Form, bleibt er in ihr statt zur Basis zu fallen —
//     das ist der Ein-Ebenen-Pop des Formstapels, unveraendert.
//  ③ Zielschutz ist davon getrennt: `untargetable`/`invisible` prueft
//     der Ziel-Dispatcher zentral wie bei jedem Helden-Ziel. Als
//     Verbot betrifft den SCHUTZ VOR DER REDUKTION, nicht die Wahl.
//
//  Der Engine-Unterbau (v675): normal aufgestiegene Helden (Monia Bot
//  ueber das Jetpack) fuehren KEINEN `_formStack`. `performDescend`
//  faellt seit v675 auf die Abstammungslinie zurueck — ohne den
//  Rueckfall waere diese Karte gegen die meisten Ascended Heroes ein
//  stiller Blindgaenger gewesen.
//
//  Umleitung: das Zielfenster laeuft mit Quelle, also oeffnet der
//  Standard-Scan (v672) beim Gegner die Umleiter. Monia Bot DARF sich
//  vor eine verbuendete Ascended werfen — sie ist selbst Ascended und
//  steht damit in der Zielliste; die Engine prueft die Mitgliedschaft.
// ═══════════════════════════════════════════

const CARD_NAME = 'Audience with a hostile King';
const RITUAL_MS = 1150;   // Laenge der dunklen-Magie-Animation im Client

/** Lebende Ascended Heroes des Gegners. */
function zulaessigeZiele(engine, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  const cardDB = engine._getCardDB();
  return engine.getHeroTargets(oppIdx)
    .filter(t => cardDB[t.cardName]?.cardType === 'Ascended Hero');
}

module.exports = {
  requiresTarget: true,
  // ^ Blinded-Gating, wie bei jedem zielenden Spell (_hooks.js).
  inherentAction: true,

  /** Spielbar nur, wenn der Gegner einen lebenden Ascended Hero hat. */
  spellPlayCondition(gs, pi, engine) {
    return zulaessigeZiele(engine, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // Frisch erheben — zwischen Spielbarkeits-Gate und Aufloesung
      // liegt die Kette (Negation, Reaktionen, Formwechsel).
      const ziele = zulaessigeZiele(engine, pi);
      if (ziele.length === 0) { gs._spellCancelled = true; return; }

      const selectedIds = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME,
        source: CARD_NAME,
        description: 'Choose an Ascended Hero your opponent controls and Descend it. The Ascended Hero on top is sent to the discard pile.',
        confirmLabel: '🜏 Descend!',
        confirmClass: 'btn-danger',
        cancellable: true,
        maxTotal: 1,
      });
      if (!selectedIds || selectedIds.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      // Nach Umleitung erneut gegen die Zielliste aufloesen — die
      // zurueckgegebene ID kann ein anderer (ebenfalls Ascended) Held
      // sein als der angeklickte.
      const ziel = ziele.find(t => t.id === selectedIds[0]);
      const zielHeld = ziel ? gs.players[ziel.owner]?.heroes?.[ziel.heroIdx] : null;
      if (!ziel || !zielHeld?.name || zielHeld.hp <= 0) {
        gs._spellCancelled = true;
        return;
      }
      // Formwechsel waehrend der Kette (Waflav ist selbst gewechselt,
      // ein anderer Effekt hat schon abgestiegen): kein Ascended mehr →
      // die Karte verpufft, ist aber gespielt und bezahlt.
      if (engine._getCardDB()[zielHeld.name]?.cardType !== 'Ascended Hero') {
        engine.log('audience_fizzle', {
          player: ps.username, target: zielHeld.name, reason: 'not_ascended',
        });
        engine.sync();
        return;
      }

      const obersteForm = zielHeld.name;

      // Dunkle, verbotene Magie auf dem Ascended Hero — Sichtbarkeit
      // VOR der Zustandsaenderung, damit das Ritual auf der noch
      // getragenen Form spielt.
      engine._broadcastEvent('dark_ritual', {
        owner: ziel.owner, heroIdx: ziel.heroIdx,
      });
      await engine._delay(RITUAL_MS);

      // Der eigentliche Abstieg: Ein-Ebenen-Pop, oberste Form in die
      // Ablage (Standardweg), HP-Regel v674 (Boden bei 1, kein Revive,
      // kein Schutz). KEIN `notADescend` — das hier IST ein Descend.
      const r = await engine.performDescend(ziel.owner, ziel.heroIdx, {});
      if (!r?.success) {
        // Sollte nach den Pruefungen oben nicht eintreten (stackloser
        // Waflav waere der einzige Weg) — dann verpufft die Karte laut
        // statt still.
        engine.log('audience_fizzle', {
          player: ps.username, target: obersteForm, reason: 'descend_failed',
        });
        engine.sync();
        return;
      }

      engine.log('audience_with_a_hostile_king', {
        player: ps.username,
        opponent: gs.players[ziel.owner]?.username,
        removed: obersteForm,
        now: zielHeld.name,
      });
      engine.sync();
    },
  },

  /** CPU: die Form mit den meisten gedruckten HP herunterreissen —
   *  das ist zugleich die groesste HP-Reduktion und der groesste
   *  Wertverlust fuer den Gegner. Ehrliche Faustregel statt
   *  Effektbewertung. */
  cpuResponse(engine, promptKind, promptData) {
    if (promptKind === 'effectTarget'
        && (promptData?.config?.title === CARD_NAME
            || promptData?.config?.source === CARD_NAME)) {
      const ziele = promptData.validTargets || [];
      if (ziele.length === 0) return undefined;
      const cardDB = engine._getCardDB();
      const wert = t => cardDB[t.cardName]?.hp || 0;
      const bestes = ziele.slice().sort((a, b) => wert(b) - wert(a))[0];
      return [bestes.id];
    }
    return undefined;
  },
};
