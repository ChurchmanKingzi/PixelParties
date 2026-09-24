// ═══════════════════════════════════════════════════════════════════
//  GETEILTES MODUL — „ONCE PER TURN, WHEN <HELD> PERFORMS <X>,
//  DRAW A CARD FROM YOUR POTION DECK." (v1326)
//
//  Zwei Karten tragen denselben Satz, nur mit anderem Ausloeser:
//    • Bonded Companion Mellvy — „when the corresponding Hero performs
//      an Action"
//    • The Brewer's Blade      — „when the equipped Hero performs an
//      Attack"
//  Vorher lebte der Ablauf allein in Mellvy. Statt einer zweiten
//  Fassung, die auseinanderlaeuft, liegt er hier; die Karte liefert nur
//  noch, WER handelt (`held`) und WELCHE Handlung zaehlt (`passt`).
//
//  ── ABLAUF ────────────────────────────────────────────────────────
//    1. Handlung des richtigen Helden?  (`held`, `passt`)
//       Kanal: `handlungsHooks` (`_action-shared.js`) — jede Aktion aus
//       jedem Aktionspfad UND Reaktionen, die dieser Held wirkt (Als
//       Vorgabe 17.9.: „performs" umfasst Reactions).
//    2. Einmal pro Runde — SOFT, je Instanz (blosses „Once per turn",
//       Wortlaut-Regel v249). Einheitszaehler `_charges.js`.
//    3. Wuerde der Zug ueberhaupt etwas bringen? Leeres Potion Deck oder
//       gesperrte Hand/Ziehen → KEIN Ausloesen: kein Auftritt, keine
//       verbrauchte Nutzung (CARD_API: „kein Auftritt, wenn der Effekt
//       im konkreten Fall nichts bewirkt"). Ein abfangender Effekt
//       (`BEFORE_DRAW_BATCH`, z.B. Intrude) ist dagegen ein echtes
//       Verhindern — dort ist die Karte ausgeloest und die Nutzung weg.
//    4. Nutzung verbuchen, Auftritt an BEIDE Spieler
//       (`showTriggeredEffect`), Glanz am Platz der Karte.
//    5. Zustand VOR dem Zug rausschicken, kurz warten, dann ziehen —
//       sonst sieht der Hand-Diff-Melder des Clients keinen Zwischen-
//       stand und die Karte poppt ohne Flug in die Hand (Als Befund
//       12.9., Mellvy).
//    6. Logzeile `potion_trigger_draw` — EIN Formatierer im Client fuer
//       alle Karten dieser Bauart (app-board.jsx).
//
//  Ziehen immer ueber `actionDrawFromPotionDeck`: nur dort greifen
//  Sperren, Zieh-Hooks, Philosopher's Stone und Tuscan Mystic.
// ═══════════════════════════════════════════════════════════════════

const { usesLeft, spendUse } = require('./_charges');
const { handlungsHooks } = require('./_action-shared');

/**
 * Standard-Glanz: der Engine-Helfer am Brettplatz der Instanz
 * (Sim-Wache, Entprellung und Vorlauf inklusive).
 */
async function standardGlanz(engine, inst, seite) {
  if (!engine || !inst) return;
  await engine.effectSourceGlow(seite, inst.name, { inst, origin: 'board' });
}

/**
 * Baut die Hooks einer Karte „Once per turn, when <Held> performs <X>,
 * draw a card from your Potion Deck."
 *
 * @param {object}   cfg
 * @param {string}   cfg.name     Kartenname (Auftritt, Log)
 * @param {string}   cfg.useKey   Schluessel des Einheitszaehlers
 * @param {function} cfg.held     (ctx) → { owner, heroIdx } | null —
 *                                wessen Handlung zaehlt
 * @param {function} [cfg.passt]  (ctx) → bool — zaehlt DIESE Handlung?
 *                                Ohne Angabe: jede.
 * @param {string}   [cfg.anlass] Wortlaut fuer das Log ('Action'/'Attack')
 * @param {function} [cfg.glow]   (engine, inst, seite) → Promise|void —
 *                                eigener Glanz (Companions)
 * @returns {object} Hook-Objekt zum Einspreizen in `hooks`
 */
function potionZugBeiHandlung({ name, useKey, held, passt, anlass = 'Action', glow }) {
  const ZAEHLER = { key: useKey, max: 1 };

  return handlungsHooks(async (ctx) => {
    const engine = ctx._engine;
    const gs = engine?.gs;
    if (!gs) return;

    // 1) Der richtige Held, die richtige Handlung.
    const wer = held(ctx);
    if (!wer) return;
    if (ctx.playerIdx !== wer.owner || ctx.heroIdx !== wer.heroIdx) return;
    if (typeof passt === 'function' && !passt(ctx)) return;

    // 2) Einmal pro Runde, je Instanz.
    const inst = ctx.card;
    if (!inst || usesLeft(inst, gs, ZAEHLER) <= 0) return;

    // 3) Brächte der Zug etwas? „your Potion Deck" = der Kontrolleur.
    const zieher = ctx.cardController ?? ctx.cardOwner;
    const ps = gs.players?.[zieher];
    if (!ps || (ps.potionDeck || []).length === 0) return;
    if (ps.handLocked || ps.drawLocked) return;

    // 4) Ausgeloest.
    spendUse(inst, gs, ZAEHLER);
    await engine.showTriggeredEffect(name);
    if (typeof glow === 'function') await glow(engine, inst, zieher);
    else await standardGlanz(engine, inst, zieher);

    // 5) Zwischenstand, dann ziehen.
    engine.sync();
    await engine._delay(180);
    const gezogen = await engine.actionDrawFromPotionDeck(zieher, 1);

    // 6) Log — auch bei abgefangenem Zug, die Karte HAT ausgeloest.
    const heldName = gs.players?.[wer.owner]?.heroes?.[wer.heroIdx]?.name || null;
    engine.log('potion_trigger_draw', {
      player: ps.username, card: name, hero: heldName, anlass,
      drawn: Array.isArray(gezogen) ? gezogen.length : 0,
    });
    engine.sync();
  });
}

module.exports = { potionZugBeiHandlung };
