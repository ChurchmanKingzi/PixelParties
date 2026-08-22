// ═══════════════════════════════════════════════════════════════════
//  GETEILTES MODUL — EINE POTION AUS EINEM KARTENSKRIPT AUSLOESEN
//
//  Ein Kartenskript kann keinen Trank ueber den Serverpfad einsetzen.
//  Tuscan Mystic hat den Weg gebaut („immediately resolve one of
//  them"); Future Tech Potion Launcher braucht denselben („play it
//  immediately, if possible"). Statt einer zweiten Fassung, die
//  auseinanderlaeuft, liegt er hier — Als Hinweis 21.8., dass beide
//  Karten dasselbe tun.
//
//  Rueckgabe `false` heisst FIZZELN, nicht Abbruch: die Potion konnte
//  nicht wirken (gesperrt, eigenes Gate zu, keine legalen Ziele). Was
//  danach mit der Karte geschieht, entscheidet der Aufrufer — Tuscan
//  Mystic loescht sie, der Potion Launcher legt sie in die Ablage.
// ═══════════════════════════════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

/** Kann die gewaehlte Potion ueberhaupt aufloesen — und wenn ja, wie? */
async function loesePotionAus(engine, pi, potionName) {
  const script = loadCardEffect(potionName);
  if (!script || typeof script.resolve !== 'function') return false;

  // Sicherheitsnetz zur Sperre oben: kommt der Effekt doch bis hierher,
  // fizzelt die Potion, statt eine gesperrte Aktivierung durchzulassen.
  // (Fizzeln ist ein zulaessiger Ausgang — beide Karten werden trotzdem
  // geloescht, Als Ruling 16.8.)
  if (engine.arePotionsLockedFor(pi)) return false;

  const gs = engine.gs;

  // Eigenes Gate der Potion (z.B. "nur wenn ein Held verletzt ist").
  if (typeof script.canActivate === 'function'
      && !script.canActivate(gs, pi, engine)) return false;

  // Zielwahlfreie Potion — direkt aufloesen, wie im Serverzweig.
  if (!script.getValidTargets || !script.targetingConfig) {
    await script.resolve(engine, pi, [], []);
    return true;
  }

  // Mit Zielwahl: Ziele holen. Keine legalen Ziele ⇒ fizzelt (Als
  // Ruling, Beispiel Elixir of Recovery bei vollen Helden).
  let ziele = [];
  try { ziele = script.getValidTargets(gs, pi, engine) || []; } catch { ziele = []; }
  if (!ziele.length) return false;

  const cfg = typeof script.targetingConfig === 'function'
    ? script.targetingConfig(gs, pi)
    : (script.targetingConfig || {});

  const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
    title: potionName,
    description: cfg.description || `Choose a target for ${potionName}.`,
    confirmLabel: cfg.confirmLabel || '✨ Resolve!',
    confirmClass: cfg.confirmClass || 'btn-info',
    // NICHT abbrechbar: die Karte sagt "immediately resolve one of
    // them". Die Wahlfreiheit lag in der Abfrage davor.
    cancellable: false,
    maxTotal: cfg.maxPerType ? undefined : 1,
  });
  if (!gewaehlt || !gewaehlt.length) return false;

  if (typeof script.validateSelection === 'function'
      && !script.validateSelection(gewaehlt, ziele)) return false;

  await script.resolve(engine, pi, gewaehlt, ziele);
  return true;
}

/**
 * ★ EINE GESPIELTE POTION WIRD GELOESCHT, NICHT ABGELEGT
 * [Als Regel 21.8.: „Wenn eine Potion gespielt wird (via Tuscan Mystic,
 *  Potion Launcher oder irgendeinen ähnlichen Effekt), soll sie deleted
 *  werden."]
 *
 * Steht hier und nicht in den Karten, damit jeder kuenftige Effekt
 * dieser Bauart denselben Weg nimmt — Ziel-STAPEL und ANIMATION in
 * einem. Der sichtbare Flug ist Pflicht (Als Regel: jede Bewegung
 * zwischen Stapeln wird gezeigt); er wird VOR der Umbuchung gesendet,
 * sonst startet er an einem Stapel, in dem die Karte schon fehlt.
 *
 * @param {string} von  Startstapel des Fluges — 'potionDeck' (Vorgabe)
 *                      oder 'hand', je nachdem, woher die Karte kam.
 */
async function verbrauchePotion(engine, pi, name, opts = {}) {
  const ps = engine.gs?.players?.[pi];
  if (!ps || !name) return false;
  if (!ps.deletedPile) ps.deletedPile = [];

  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: name, from: opts.von || 'potionDeck', to: 'deleted',
  });
  const halten = opts.holdMs != null ? opts.holdMs : 480;
  if (halten > 0) await engine._delay(halten);

  ps.deletedPile.push(name);
  engine.sync();
  return true;
}

module.exports = { loesePotionAus, verbrauchePotion };
