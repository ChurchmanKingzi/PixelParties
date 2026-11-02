// Pixelart-Portierungen (Canvas), Batch 26 (dritte Welle, alle übrigen Effekte): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
//
// Typen dieser Datei: weird_doll_grow.
// Geprüft und bewusst UNVERÄNDERT (laufen schon als Canvas oder hängen am DOM-Kartenbild):
//   udp_land (ppPunktBild), uncool_smoke (ppPunktBild), unreasonable_steam (ppPunktBild), vengeful_slash (ppPunktBild), voodoo_swap / winged_haress_feathers / winged_haress_slash /
//   zira_impact (ppSalve), moe_heart (ppSzene), glass_wall_up (ppGlasWand, Canvas) — alle schon Pixelart-Leinwand;
//   whirlwind_spin (kein eigenes Bild: dreht das ECHTE Heldenkarten-Element über die Klasse `whirlwind-spinning`, 2 s — das Kartenbild selbst ist die Animation).

// ═════════════════════════════════════════════════════════════════
//  Weird Doll: wachsende Puppe (`weird_doll_grow`) — PIXELART; eine Matroschka-Puppe schwillt über dem Helden an, wenn eine Ability auf den Ablagestapel geschickt wird
//
//  Wie vorher (700 ms, `x`/`y` = Heldenmitte, Ursprung der Zone -1): die Puppe poppt winzig auf (Größe 0,2), schwillt in Stufen auf 0,7 → 1,7 → 2,6 → 3,4 (Emoji-Höhe 52 px) und
//  blendet dabei aus (Deckung 0 → 1 → 0,85 → 0,4 → 0, als Bayer-Dither). Statt des Emoji wird die Puppe Pixel für Pixel in der jeweiligen Größe gemalt (rotes Kopftuch mit gelben Punkten,
//  Gesicht mit Wangen, rotes Kleid mit Schürze und Blume, blauer Saum, dunkler Umriss, Licht von links); statt des rosa Scheins ein gedithert rosa Hof. Feste Palette, kein Alpha-Verlauf.
// ═════════════════════════════════════════════════════════════════
const PP_FX26_PUPPE = {
  umriss: ppHex('#3a0000'), rot: ppHex('#e92f38'), rotHell: ppHex('#fe7476'), rotDunkel: ppHex('#b21a29'),
  haut: ppHex('#f7e0b5'), wange: ppHex('#fe6794'), mund: ppHex('#b21a29'), auge: ppHex('#3a0000'),
  gelb: ppHex('#fff196'), gold: ppHex('#fad54a'), blau: ppHex('#4e82cb'), blauDunkel: ppHex('#2f539d'), rosa: ppHex('#fc69c6'), hof: ppHex('#f8b4c8'),
};
/** Ist (u, v) — Längeneinheit = Gesamthöhe der Puppe, Mitte = Puppenmitte — innerhalb der Silhouette (Kopf + eiförmiger Körper)? */
function ppFx26PuppeDrin(u, v) {
  const kopf = (u * u) / (0.22 * 0.22) + ((v + 0.25) * (v + 0.25)) / (0.23 * 0.23) <= 1;
  const koerper = (u * u) / (0.32 * 0.32) + ((v - 0.1) * (v - 0.1)) / (0.4 * 0.4) <= 1;
  return kopf || koerper;
}
/** Farbe der Puppe an (u, v), `px` = Rasterpixel je Einheit (für die Umrissbreite), (X, Y) für das Dither-Raster. */
function ppFx26PuppeFarbe(u, v, px, X, Y) {
  const P = PP_FX26_PUPPE;
  if (!ppFx26PuppeDrin(u, v)) return null;
  const d = 1 / px;
  if (!ppFx26PuppeDrin(u - d, v) || !ppFx26PuppeDrin(u + d, v) || !ppFx26PuppeDrin(u, v - d) || !ppFx26PuppeDrin(u, v + d)) return P.umriss;
  const licht = 0.5 - u * 1.6 + (ppBayer(X, Y) - 0.5) * 0.5;                                  // Licht von links
  const stoff = (licht > 0.78 ? P.rotHell : licht > 0.28 ? P.rot : P.rotDunkel);
  if ((u * u) / (0.22 * 0.22) + ((v + 0.25) * (v + 0.25)) / (0.23 * 0.23) <= 1) {
    // Kopf: Gesicht in der Mitte, Kopftuch drumherum
    const gesicht = (u * u) / (0.145 * 0.145) + ((v + 0.2) * (v + 0.2)) / (0.135 * 0.135) <= 1;
    if (gesicht) {
      const au = Math.abs(u);
      if (Math.abs(v + 0.215) < 0.5 / px + 0.012 && au > 0.045 && au < 0.045 + Math.max(0.035, 1.2 / px)) return P.auge;
      if (Math.abs(v + 0.13) < 0.6 / px + 0.01 && au < 0.03 + 0.4 / px) return P.mund;
      if (au > 0.08 && au < 0.125 && Math.abs(v + 0.16) < 0.03) return P.wange;
      return P.haut;
    }
    // gelbe Punkte auf dem Tuch
    const gx = Math.floor((u + 0.5) * 9), gy = Math.floor((v + 0.5) * 9);
    if (((gx + gy) & 1) === 0 && ((u + 0.5) * 9 - gx) < 0.45 && ((v + 0.5) * 9 - gy) < 0.45 && px > 7) return P.gold;
    return stoff;
  }
  // Körper
  if (v > 0.38) return v > 0.4 ? (licht > 0.3 ? P.blau : P.blauDunkel) : stoff;                  // blauer Saum
  const schuerze = (u * u) / (0.19 * 0.19) + ((v - 0.17) * (v - 0.17)) / (0.2 * 0.2) <= 1;
  if (schuerze) {
    const blume = u * u + (v - 0.15) * (v - 0.15);
    if (blume < 0.0025 + 0.5 / (px * px)) return P.gold;                                          // Blütenmitte
    if (blume < 0.0121 && ((Math.atan2(v - 0.15, u) * 2.5 / Math.PI + 8) % 1) < 0.5) return P.rosa;   // Blütenblätter
    return P.gelb;
  }
  return stoff;
}

const ppFx26PuppeWachsen = (() => {
  const GROESSE = 52 * 0.88;                                                                       // Höhe der Puppe bei Maßstab 1 in Bildschirmpixeln (Emoji 52 px)
  const ENDE = 700;
  const BREITE = Math.ceil(GROESSE * 3.4 * 0.82 / 3) * 3 + 24, HOEHE = Math.ceil(GROESSE * 3.4 * 1.02 / 3) * 3 + 24;
  return ppR1Leinwand((g, t, sz) => {
    const u = t / ENDE;
    if (u >= 1) return;
    const [op, sc] = ppKf(u, [[0, [0, 0.2]], [0.18, [1, 0.7]], [0.45, [0.85, 1.7]], [0.75, [0.4, 2.6]], [1, [0, 3.4]]]);
    if (op <= 0.02) return;
    const H = Math.max(3, Math.round(GROESSE * sc / sz.S)), cx = Math.round(sz.cx), cy = Math.round(sz.cy);
    // rosa Hof (hart gedithert), liegt hinter der Puppe
    g.glow(cx, cy, H * 0.45, H * 0.58, [PP_FX26_PUPPE.hof], op * 0.55, 1.4);
    const R = Math.ceil(H * 0.5) + 1;
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      if (op < 1 && ppBayer(cx + i, cy + j) >= op) continue;                                    // gedithert weggelassen: gar nicht erst berechnen
      const c = ppFx26PuppeFarbe(i / H, j / H, H, cx + i, cy + j);
      if (c) g.put(cx + i, cy + j, c);
    }
  }, ENDE + 40, { breite: BREITE, hoehe: HOEHE });
})();
ppFxUeberschreiben('weird_doll_grow', ppFx26PuppeWachsen);
