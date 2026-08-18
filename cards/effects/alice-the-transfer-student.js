// ═══════════════════════════════════════════
//  CARD EFFECT: "Alice, the Transfer Student"
//  Hero (400 HP / 30 ATK, Startabilities Decay Magic + Infiltration)
//
//  "Creatures with identical names in the Support Zones of a Hero you
//   control share 1 Support Zone. This effect persists even when this
//   Hero is defeated and cannot be negated."
//
//  Das Modul selbst ist winzig — die ganze Mechanik steht in
//  `_alice-shared.js`. Hier wird sie nur SCHARFGESCHALTET.
//
//  ── Warum ein Spielerschalter und kein Brettzustand ──
//  Zwei Klauseln im Kartentext verlangen es:
//   • „persists even when this Hero is defeated" — ein Effekt, der an
//     ihrer Anwesenheit haengt, waere mit ihrem Tod weg.
//   • „cannot be negated" — ein Effekt, der ueber ihre Hook-Kette
//     laeuft, waere durch `statuses.negated` stumm. Die Engine filtert
//     negierte Karten aus `runHooks` heraus; ein Schalter, der bereits
//     gesetzt ist, interessiert das nicht mehr.
//  `ps._aliceShareActive` wird gesetzt und NIE wieder geloescht. Damit
//  sind beide Klauseln woertlich erfuellt, ohne dass irgendein
//  Negations- oder Entfernungspfad eine Ausnahme kennen muesste.
//
//  ── Zwei Ausloeser ──
//  `onGameStart` deckt den Normalfall ab (sie ist eine Startheldin).
//  `onPlay` faengt die Wege ab, auf denen ein Held spaeter ins Spiel
//  kommt. Beide rufen dieselbe Zeile; mehrfaches Scharfschalten ist
//  wirkungslos.
//
//  ⚠ OFFEN (an Al gemeldet, 18.8.): die OBERFLAECHE fehlt noch. Der
//  Stapel wird im Spielstand gefuehrt und die Engine fragt bei einem
//  Stapel nach, WELCHE Kopie gemeint ist — aber das Brett zeigt bislang
//  keine Stueckzahl, und die Instanz-Galerie ist noch nicht gezeichnet.
//  Solange Alice kein Kartenbild hat, ist sie ohnehin nicht waehlbar;
//  die Mechanik kann also nicht versehentlich in ein echtes Spiel
//  geraten.
// ═══════════════════════════════════════════

const { armSharing } = require('./_alice-shared');

module.exports = {
  activeIn: ['hero'],

  // ★ 18.8.: „cannot be negated" und „persists even when defeated"
  // woertlich genommen — die Hooks laufen auch an einer gefallenen
  // oder stumm geschalteten Alice. Sie sind aber nur noch Beiwerk:
  // `sharingActive` leitet die Wirkung inzwischen LIVE aus dem Team
  // ab und braucht gar keinen Ausloeser mehr. Genau daran war es
  // gescheitert — `runHooks` verwirft Helden-Hooks bei `hp <= 0`,
  // eine tot startende Alice (Puzzle-Editor) sah ihr `onGameStart` nie.
  bypassDeadHeroFilter: true,
  bypassStatusFilter: true,

  hooks: {
    onGameStart: (ctx) => { armSharing(ctx.gameState, ctx.cardOwner); },
    onPlay: (ctx) => { armSharing(ctx.gameState, ctx.cardOwner); },
  },
};
