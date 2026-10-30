// Pixelart-Portierungen heisser Effekte (Canvas statt vieler CSS-animierter DOM-Elemente) — Gemeinsamer Baustein.
// Die DOM-Fassungen stehen in `ANIM_REGISTRY` (app-board.jsx); `app-fx-1.jsx` … `app-fx-8.jsx` (nach app-board geladen) ersetzen einzelne Eintraege durch Leinwand-Fassungen auf Basis von
// `ppR1Leinwand` (app-board.jsx). Grund: jeder DOM-Effekt mit hunderten animierten Elementen musste beim Start von der Pixel-Pipeline (public/pixel-anim.js) einzeln gebacken werden
// (100–700 ms Hauptfaden-Blockade je Effekt, s. Messreihe 30.10.2026).
// Test: `window.__ppFxAlt = true` (vor dem Effektstart) laesst die DOM-Fassungen stehen — Vorher/Nachher-Vergleich mit dem Skript fxshot.js.
function ppFxUeberschreiben(typ, komponente) {
  if (window.__ppFxAlt) return;
  ANIM_REGISTRY[typ] = komponente;
}
