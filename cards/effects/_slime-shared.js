// ═══════════════════════════════════════════
//  Baustein: „Slime"-Kreaturen — Stufenanstieg zu Beginn des eigenen Zugs.
//
//  Kartentext (Cloudy, Fiery, Hardy, Icy, Rocky, Shadowy, Shiny, Slimy, Sparky, Splashy Slime):
//  „At the beginning of each of your turns, you MAY increase this Creature's level on your side of the board by 1."
//
//  Als Ruling (Al 26.10.): „may" = eine Ja/Nein-Frage statt automatischer Erhöhung. Nein/Abbruch = die Stufe bleibt, es wird nichts
//  verbraucht (der Anstieg selbst ist die einzige Wirkung). Die CPU nimmt die Erhöhung wie bisher immer (`cpuAutoConfirm`).
// ═══════════════════════════════════════════

/**
 * `onTurnStart`-Hook einer Slime-Karte (statt `ctx.changeLevel(1)` ohne Frage).
 * @param {string} cardName  Kartenname (Titel der Frage)
 */
function slimeLevelUpHook(cardName) {
  return async (ctx) => {
    if (!ctx.isMyTurn) return;
    const ja = await ctx.promptConfirmEffect({
      title: cardName,
      message: `Increase ${cardName}'s level by 1?`,
      cpuAutoConfirm: true,
    });
    if (!ja) return;
    await ctx.changeLevel(1);
  };
}

module.exports = { slimeLevelUpHook };
