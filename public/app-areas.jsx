// ═══════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — AREA-HINTERGRÜNDE (eigenes Modul seit v1410)
//
//  Alles, was ein Area-Hintergrund braucht, steht HIER und nur hier:
//  die Registry `AREA_OVERLAYS`, die Schicht-Komponente
//  `<AreaBackgrounds>` und jede einzelne Szene. Vorher lagen die 26
//  Szenen verstreut zwischen Zeile 2800 und 6700 von app-board.jsx.
//
//  Nutzer: das Kampfbrett (app-board.jsx) und der Puzzle-Creator
//  (app-puzzle.jsx), beide ueber `window.AreaBackgrounds`. Waechter:
//  `scripts/check-areas.js` liest die Registry aus DIESER Datei und
//  prueft, dass jede referenzierte Pixelart-Datei existiert.
// ═══════════════════════════════════════════════════════════════════
const { useState, useEffect, useLayoutEffect, useRef, useMemo } = React;


// ═══════════════════════════════════════════════════════════════════
//  AREA-HINTERGRÜNDE — Schichtsystem (Al 7.9.)
//
//  Jede Area hat ein Overlay (CARD_API ★-Regel). Liegen mehrere, gilt:
//   • opaque       — füllt den Hintergrund vollständig → immer ZUUNTERST.
//                    Seit dem Pixelart-Umbau (v1410–v1415) sind alle
//                    ganzen Szenen opaque (Blood Rock, Shared Blood Tanks,
//                    Acid Rain, Cottage, Crystal Well, Dark Ocean, Deepsea
//                    Castle, Doom Clock, Graveyard, Paraseed Greenhouse,
//                    Rioting Village, Slippery Ice, Smuggler's Pier, dazu
//                    Board of Kings, Temple, Cosmic Depths, Pangaia).
//                    Seit v1440 sind ALLE Areas ganze Szenen und opaque.
//   • translucent  — deckt alles, aber halbdurchsichtig → in der Mitte.
//   • partial      — deckt nur Teile → obenauf.
//  Zwei VERSCHIEDENE opaque-Areas gleichzeitig: faseriger Schnitt
//  diagonal von links oben nach rechts unten — links/unten die Area des
//  betrachtenden Spielers, rechts/oben die des Gegners.
//  Neue Area: Komponente schreiben und HIER eintragen — sonst wird sie
//  nicht gerendert.
// ═══════════════════════════════════════════════════════════════════

const AREA_TIER_ORDER = ['opaque', 'translucent', 'partial'];
const AREA_OVERLAYS = {
  'Board of Kings':               { tier: 'opaque',      C: () => <BoardOfKingsOverlay /> },   // v1438: Kartenstil
  'Dark Ocean':                   { tier: 'opaque',      C: () => <DarkOceanOverlay /> },   // v1415: Kartenstil, ganze Szene
  'Doom Clock':                   { tier: 'opaque',      C: (p) => <DoomClockOverlay {...p} /> },   // v1420: liest Doom Counter   // v1415: Kartenstil, ganze Szene
  'Slippery Ice':                 { tier: 'opaque',      C: () => <SlipperyIceOverlay /> },   // v1415: Kartenstil, ganze Szene
  'Blood Rock':                   { tier: 'opaque',      C: () => <BloodRockOverlay /> },
  'Temple of Sacrifice':          { tier: 'opaque',      C: () => <TempleOfSacrificeOverlay /> },   // v1440: Kartenstil, Maya-Pyramide
  'The Cosmic Depths':            { tier: 'opaque',      C: () => <CosmicDepthsOverlay /> },   // v1440: Kartenstil
  'Pangaia, the Dino Domain':     { tier: 'opaque',      C: () => <PangaiaOverlay /> },   // v1439: Kartenstil
  'Graveyard of Limited Power':   { tier: 'opaque',      C: () => <GraveyardOfLimitedPowerOverlay /> },   // v1415: Kartenstil, ganze Szene
  'Paraseed Greenhouse':          { tier: 'opaque',      C: () => <ParaseedGreenhouseOverlay /> },   // v1415: Kartenstil, ganze Szene
  'The First Circle of Hell':     { tier: 'opaque',      C: () => <FirstCircleOfHellOverlay /> },   // v1440: Kartenstil (vorher translucent)
  "Tarleinn's Floating Island":   { tier: 'opaque',      C: () => <FloatingIslandOverlay /> },   // v1440: Kartenstil (vorher translucent)
  'Deepsea Castle':               { tier: 'opaque',      C: () => <DeepseaCastleOverlay /> },   // v1415: Kartenstil, ganze Szene
  'War Council Gathering Place':  { tier: 'opaque',      C: () => <WarCouncilOverlay /> },   // v1440: Kartenstil (vorher translucent)
  "Cottage at the Forest's Edge": { tier: 'opaque',      C: () => <CottageOverlay /> },   // v1415: Kartenstil, ganze Szene
  "Smuggler's Pier":              { tier: 'opaque',      C: () => <SmugglersPierOverlay /> },   // v1415: Kartenstil, ganze Szene
  'Acid Rain':                    { tier: 'opaque',      C: () => <AcidRainOverlay /> },   // v1412: ganzer Burghof
  'The Bonegrinder':              { tier: 'opaque',      C: () => <BonegrinderOverlay /> },   // v1440: Kartenstil (vorher partial)
  'Crystal Well':                 { tier: 'opaque',      C: () => <CrystalWellOverlay /> },   // v1415: Kartenstil, ganze Szene
  'Spider Hive':                  { tier: 'opaque',      C: () => <SpiderHiveOverlay /> },   // v1440: Kartenstil (vorher partial)
  'Wowhalla, the Hall of the Cool': { tier: 'opaque',    C: () => <WowhallaOverlay /> },   // v1440: Kartenstil (vorher partial)
  'Stinky Stables':               { tier: 'opaque',      C: () => <StinkyStablesOverlay /> },   // v1440: Kartenstil (vorher partial)
  'Rioting Village':              { tier: 'opaque',      C: () => <RiotingVillageOverlay /> },   // v1415: Kartenstil, ganze Szene
  'The Great Clock Tower "Big Gwen"': { tier: 'opaque',  C: () => <BigGwenOverlay /> },   // v1440: Kartenstil (vorher partial)
  'Shared Blood Tanks':           { tier: 'opaque',      C: () => <SharedBloodTanksOverlay /> },   // v1411: ganzer Raum
  // ★ v1440: jetzt ebenfalls 'opaque' (vorher bewusst 'partial', v1050).
  // Spatial Crevice ist die Karte, die zwei WEITERE Areas erlaubt — ihr
  // Hintergrund darf deren Hintergruende nicht verdraengen. Als ganze
  // Szene tut er das auch nicht: je Seite zaehlt die ZULETZT gelegte
  // opaque-Area, und die Crevice liegt in aller Regel zuerst. Als
  // 'partial' laege die deckende Szene dagegen OBEN auf allem.
  'Spatial Crevice':              { tier: 'opaque',      C: () => <SpatialCreviceOverlay /> },   // v1440: Kartenstil
};

/** Faserige Diagonale: Punkte von links oben nach rechts unten, leicht gezackt. */
function buildFrayedSeam(steps = 30) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const jitter = (i === 0 || i === steps) ? 0 : (Math.random() - 0.5) * 2.6;   // ±1.3 % quer zur Diagonale
    pts.push({ x: t * 100 + jitter, y: t * 100 - jitter });
  }
  return pts;
}

// Jede Schicht bekommt `isolation: isolate`: einige Overlays (Crystal
// Well, Dark Ocean, Doom Clock) tragen an ihrer Wurzel `zIndex: -1` und
// rutschten sonst im gemeinsamen Stapelkontext UNTER die opaque-Schicht
// (v825: Crystal Well unsichtbar hinter dem Schachbrett). Ein eigener
// Stapelkontext je Schicht haelt das innere z-Index innen; die Reihen-
// folge der Schichten ist die DOM-Reihenfolge.
function AreaBackgrounds({ areaZones, myIdx, oppIdx, spielstand }) {
  // ★ v1420: Szenen duerfen den Spielstand lesen (Doom Clock zeigt ihre
  // Doom Counter). Jede Komponente bekommt `besitzer` (Indizes der
  // Spieler, deren Area-Zone die Area enthaelt) und `spielstand` (ein
  // kleiner Auszug, vom Aufrufer gefuellt: Kampfbrett aus gameState,
  // Puzzle-Creator aus seinem Editorzustand).
  const seam = useMemo(() => buildFrayedSeam(), []);
  const mine = areaZones?.[myIdx] || [];
  const theirs = areaZones?.[oppIdx] || [];
  const besitzerVon = (n) => [myIdx, oppIdx].filter(i => (areaZones?.[i] || []).includes(n));
  const szene = (n) => { const C = AREA_OVERLAYS[n].C; return <C besitzer={besitzerVon(n)} spielstand={spielstand || {}} />; };
  const layers = [];
  for (const tier of AREA_TIER_ORDER) {
    const mineT = mine.filter(n => AREA_OVERLAYS[n]?.tier === tier);
    const theirsT = theirs.filter(n => AREA_OVERLAYS[n]?.tier === tier);
    if (tier === 'opaque') {
      // Je Seite zählt die zuletzt gelegte opaque-Area.
      const a = mineT[mineT.length - 1];
      const b = theirsT[theirsT.length - 1];
      if (a && b && a !== b) {
        const diag = seam.map(p => `${p.x.toFixed(2)}% ${p.y.toFixed(2)}%`).join(', ');
        const clipMine = `polygon(${diag}, 0% 100%)`;          // links/unten
        const clipTheirs = `polygon(${diag}, 100% 0%)`;        // rechts/oben
        layers.push(
          <div key={`op-${b}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', isolation: 'isolate', clipPath: clipTheirs }}>{szene(b)}</div>,
          <div key={`op-${a}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', isolation: 'isolate', clipPath: clipMine }}>{szene(a)}</div>,
          <svg key="op-seam" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline points={seam.map(p => `${p.x},${p.y}`).join(' ')} fill="none"
              stroke="rgba(0,0,0,0.55)" strokeWidth="0.9" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
              style={{ filter: 'blur(1.2px)' }} />
            <polyline points={seam.map(p => `${p.x},${p.y}`).join(' ')} fill="none"
              stroke="rgba(255,240,220,0.35)" strokeWidth="0.25" strokeLinejoin="round"
              strokeDasharray="1.2 0.7 0.4 0.9" vectorEffect="non-scaling-stroke" />
          </svg>,
        );
      } else {
        const only = a || b;
        if (only) layers.push(<div key={`op-${only}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', isolation: 'isolate' }}>{szene(only)}</div>);
      }
      continue;
    }
    for (const n of [...new Set([...mineT, ...theirsT])]) {
      layers.push(<div key={`${tier}-${n}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', isolation: 'isolate' }}>{szene(n)}</div>);
    }
  }
  return <>{layers}</>;
}

// ═══════════════════════════════════════════════════════════════════
//  PIXELART-SZENEN — gemeinsamer Baustein (v1410, Al 25.9.)
//
//  Ab v1410 werden die Area-Hintergruende als echte Pixelart gebaut:
//  in niedriger Aufloesung gemalte Ebenen (PNG unter
//  `public/areas/<area>/`), scharf hochskaliert wie die Karten, dazu
//  animierte Teile als eigene Ebenen oder Pixel-Elemente.
//
//  MASSSTAB. Jede Szene hat eine feste Kunsthoehe `artH` (Kunstpixel).
//  Die Wurzel ist ein Groessen-Container (`container-type: size`), also
//  ist ein Kunstpixel `--px = 100cqh / artH` — die Szene fuellt die
//  Brett-HOEHE exakt, egal wie hoch das Brett gerade ist.
//
//  BREITE. Das Brett ist deutlich breiter als 16:9 und waechst mit
//  Flying Islands weiter. Deshalb nie EIN gestrecktes Bild, sondern:
//    • `band`  — eine Kachel, die nach links und rechts WIEDERHOLT
//                wird, mittig verankert (die Kachelmitte sitzt auf der
//                Brettmitte, damit die Szene symmetrisch waechst);
//    • `piece` — ein Versatzstueck, einmalig, mittig (oder mit
//                `x` in Kunstpixeln neben der Mitte) verankert.
//  Beide haben die volle Kunsthoehe.
//
//  POSITIONEN fuer bewegte Pixel-Elemente: `ppArtX(x, bezugsbreite)`
//  (Kunstpixel relativ zu einem mittigen Versatzstueck) und `ppArt(n)`
//  (reine Laenge). So liegen Tropfen, Funken usw. genau auf den Pixeln
//  des Bildes, auf jeder Brettgroesse.
//
//  ANIMATIONEN nur per CSS-Keyframes: „Play Animations: aus" friert sie
//  dann ein (globale Regel), bewegte Einzelelemente tragen zusaetzlich
//  `pp-area-dyn` und werden dort ganz ausgeblendet. Anzahl bewegter
//  Elemente immer ueber `ppFxN` (Telefon-Deckel).
// ═══════════════════════════════════════════════════════════════════
const ppArt = (n) => `calc(${n} * var(--px))`;
const ppArtX = (x, bezugsbreite) => `calc(50% + ${x - bezugsbreite / 2} * var(--px))`;

function PixelScene({ artH, bg, className, children }) {
  return (
    <div className={'pp-pixel-scene ' + (className || '')} style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
      containerType: 'size', '--px': `calc(100cqh / ${artH})`,
      background: bg || '#000',
    }}>
      {children}
      <style>{`
        .pp-pixel-scene, .pp-pixel-scene * { image-rendering: pixelated; image-rendering: crisp-edges; }
        :root.no-animations .pp-area-dyn { display: none; }
        /* Gemeinsame Bewegungen (v1415). Bilder senkrecht gestapelt → ppBandN,
           nebeneinander → ppSpriteN, jeweils mit steps(1). */
        @keyframes ppBand2 { 0% { background-position: 50% 0%; } 50% { background-position: 50% 100%; } }
        @keyframes ppBand3 { 0% { background-position: 50% 0%; } 33.3% { background-position: 50% 50%; } 66.6% { background-position: 50% 100%; } }
        @keyframes ppSprite2 { 0% { background-position: 0 0; } 50% { background-position: 100% 0; } }
        @keyframes ppSprite3 { 0% { background-position: 0 0; } 33.3% { background-position: 50% 0; } 66.6% { background-position: 100% 0; } }
        @keyframes ppBob { from { translate: 0 0; } to { translate: 0 var(--bob, var(--px)); } }
        @keyframes ppDrehen { to { rotate: 360deg; } }
        .pp-quer { position: absolute; left: 0; }
        @keyframes ppQuerLtr { from { transform: translateX(calc(-30 * var(--px))); } to { transform: translateX(calc(100cqw + 10 * var(--px))); } }
        @keyframes ppQuerRtl { from { transform: translateX(calc(100cqw + 10 * var(--px))); } to { transform: translateX(calc(-30 * var(--px))); } }
        /* Weisses Funkelkreuz (Karten: Crystal Well), 3×3 Kunstpixel */
        .pp-px-funkeln {
          position: absolute; width: calc(3 * var(--px)); height: calc(3 * var(--px)); opacity: 0;
          background:
            linear-gradient(#fff, #fff) 50% 0 / var(--px) 100% no-repeat,
            linear-gradient(#fff, #fff) 0 50% / 100% var(--px) no-repeat;
        }
        @keyframes ppFunkeln { 0%, 60% { opacity: 0; } 64% { opacity: .6; } 70% { opacity: 1; } 80% { opacity: .6; } 84%, 100% { opacity: 0; } }
        /* Leichte Randabdunklung — die Karten bleiben das Hellste */
        .pp-rand-dim { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,.3) 100%); }
        /* Blutstropfen (Blood Rock, Shared Blood Tanks …): haengt, schwillt,
           faellt um --fall. Farben ueber --tropfen / --tropfen-dunkel. */
        .pp-px-tropfen {
          position: absolute; width: var(--px); height: calc(2 * var(--px)); transform-origin: top;
          background: var(--tropfen, #a41e14); box-shadow: 0 calc(-1 * var(--px)) 0 var(--tropfen-dunkel, #5a0909);
        }
        @keyframes ppPxTropfen {
          0%   { transform: translateY(0) scaleY(.5); opacity: 0; }
          10%  { opacity: 1; }
          62%  { transform: translateY(0) scaleY(1.4); opacity: 1; }
          90%  { transform: translateY(var(--fall)) scaleY(1); opacity: 1; }
          91%, 100% { transform: translateY(var(--fall)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/** CSS-Maske aus einer Pixelart-Schablone (weiss = sichtbar).
 *  `kachel: true` legt sie wie ein `PixelBand` (wiederholt, mittig
 *  verankert), sonst deckt sie ihr Element genau ab (fuer `PixelPiece`-
 *  grosse Ebenen). Genutzt fuer Blut in Tanks/Rohren/Stroemen. */
const ppMaske = (pfad, kachel) => ({
  WebkitMaskImage: `url(${pfad})`, maskImage: `url(${pfad})`,
  WebkitMaskRepeat: kachel ? 'repeat-x' : 'no-repeat', maskRepeat: kachel ? 'repeat-x' : 'no-repeat',
  WebkitMaskSize: kachel ? 'auto 100%' : '100% 100%', maskSize: kachel ? 'auto 100%' : '100% 100%',
  WebkitMaskPosition: '50% 0', maskPosition: '50% 0',
});

/** Wiederholte Kachel (volle Kunsthoehe, mittig verankert). */
function PixelBand({ src, style, className }) {
  return <div className={'pp-pixel-layer ' + (className || '')} style={{
    position: 'absolute', inset: 0,
    backgroundImage: `url(${src})`, backgroundRepeat: 'repeat-x',
    backgroundSize: 'auto 100%', backgroundPosition: '50% 0',
    ...style,
  }} />;
}

/** Einmaliges Versatzstueck: `w` Kunstpixel breit, Mitte bei `x` (Kunstpixel neben der Brettmitte). */
function PixelPiece({ src, w, x = 0, style, className }) {
  return <div className={'pp-pixel-layer ' + (className || '')} style={{
    position: 'absolute', top: 0, bottom: 0,
    left: `calc(50% + ${x - w / 2} * var(--px))`, width: ppArt(w),
    backgroundImage: `url(${src})`, backgroundRepeat: 'no-repeat', backgroundSize: '100% 100%',
    ...style,
  }} />;
}

// ═══════════════════════════════════════════════════════════════════
//  BLOOD ROCK — Festungsgefängnis im Blutfels (v1410, Kartenstil v1413,
//  Überarbeitung v1441 (Al 25.9.))
//
//  Al 25.9.: „eine alte Festung, die als Gefängnis fungiert und wo
//  Gefangene stetig gefoltert und ihr Blut von Vampiren geraubt wird."
//  STIL (Al 25.9., nach den ersten drei Szenen): die Hintergründe sollen
//  wie Als eigene Kartenmotive aussehen, nicht wie „gemalte" Szenen —
//  grobe Pixel (Kunsthöhe 100 statt 200), Flächen als unregelmäßiges
//  Pixelrauschen statt geordnetem Dithering, schwarze Fugen und Konturen,
//  satte Farben, weiche Leuchtflecken, nur leichte Randabdunklung.
//
//  DAS ROTE SIND BLUTSTRÖME, KEIN LICHT (Al 25.9.): aus den dunklen
//  Fenstern läuft Blut die Mauern hinab und sammelt sich in Lachen; unter
//  dem Fallgitter quillt es hervor und läuft die Treppe hinab. Nichts
//  hier leuchtet.
//
//  v1441 nach dem Kartenmotiv, auf dem Niveau der v1440-Szenen: hinter
//  allem der Blutfels — gewölbte, facettierte Brocken mit Klüften und
//  Schichtleisten, in den Fels gehauene vergitterte Verliese, aus denen
//  Rinnsale laufen. Davor die Wehrmauer mit Zinnen (einige abgebrochen),
//  Maschikuli, Schmutzspuren und Rissen, Zellenfenster mit Blutströmen,
//  ein Galgenbalken mit Hängekäfig, Ketten mit Fesseln, ein gefesseltes
//  Skelett, ein Kloakengitter, aus dem Blut in eine große Lache quillt;
//  die Türme der Kachel stehen an der Naht (weit außen). Mitte: der
//  Torbau wie auf der Karte — zwei vorspringende Flankentürme (Innen-
//  seiten sichtbar), Hauptbau mit vier Bogennischen (Blut rinnt an der
//  Rückwand herab, in einer hängt ein Skelett in Ketten), Wasserspeier,
//  aus denen Blut stürzt, Rundbogentor mit halb hochgezogenem Fallgitter
//  und Schädel-Schlussstein, darüber die lange vergitterte Zellengalerie
//  mit rostroter Sturzkante und der Oberbau. Hof aus unregelmäßigen
//  Platten in Tiefe, Blut in den Fugen, Lachen, Knochen, Geröll.
//
//  Ebenen (Kunsthöhe 100; Generator scratchpad gen/blood-rock.py, nicht
//  im Projekt): tile.png — Kachel 128; keep.png — Torbau 164, mittig;
//  keep-front.png — Brustwehr des Hauptbaus (vor der Wache);
//  mask-tile.png / mask-keep.png — Form der Ströme, durch die flow.png
//  (helle Schlieren, 8×16) nach unten läuft; ripple.png — Aufschlag in
//  der Lache (3 Bilder 9×3); mist.png — Blutnebel (Kachel 128×14);
//  bat.png (3 Bilder 7×5), bat-far.png (2 Bilder 5×3); vampire.png —
//  Vampirfürst (3 Bilder 11×9, Umhang weht); guard.png — Vampirwache
//  (2 Bilder 7×9); cage.png — Hängekäfig mit Gefangenem (4 Bilder 15×26,
//  pendelt); rat.png (2 Bilder 6×3); hands.png — Hände am Gitter.
//
//  Animiert: Blut läuft in allen Strömen, schlägt in den Lachen auf und
//  tropft aus Galerie, Verliesen und Käfig; der Käfig pendelt; hinter
//  den Gittern greifen ab und zu Hände nach den Stäben; der Vampirfürst
//  steht mit wehendem Umhang auf dem Oberbau, eine Wache patrouilliert
//  hinter der Brustwehr; Fledermäuse in zwei Tiefen (die fernen hinter
//  dem Torbau), Ratten huschen über den Hof, Blutnebel zieht. Licht
//  IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const BR = '/areas/blood-rock/';
const BR_KEEP_W = 164;
const BR_KACHEL = 128;
// Füße der Ströme = Lachen (Kunstpixel neben der Brettmitte). Kachel-Lachen
// wiederholen sich alle 128, der Torbau deckt |x| < 82 ab.
const BR_KACHEL_FUESSE = [[0, 79], [-44, 79], [14, 79], [-54, 79], [-18, 81]];
const BR_TORBAU_FUESSE = [[-72, 83], [70, 83], [-46, 82], [-28, 82], [28, 82], [47, 82], [-49, 82], [49, 82], [0, 92], [-5, 93], [6, 92]];
const BR_KAEFIG = [34, 45];                 // Haken (neben der Mitte, Kachel), Käfig 15×26
const BR_HAENDE_KACHEL = [[-28, 60]];       // Zellenfenster ohne Strom
const BR_HAENDE_TORBAU = [[51, 25], [99, 25], [75, 25]];   // Galerie (Stück-x, y)
const BR_GALERIE_TROPFEN = [54, 66, 90, 102];              // Sims der Galerie (Stück-x), y 30
// Tropfsteinspitzen am Felsüberhang (Kachel): Blut tropft bis hinter die Zinnen
const BR_TROPFSTEINE = [[-58, 9], [-42, 13], [-20, 8], [24, 10], [40, 7], [56, 9]];
// Kachel-Positionen (x neben der Mitte) für alle sichtbaren Wiederholungen
const brKachelX = (x, rand = 4) => {
  const out = [];
  for (let k = -3; k <= 3; k++) {
    const xx = x + k * BR_KACHEL;
    if (Math.abs(xx) > BR_KEEP_W / 2 + rand) out.push(xx);
  }
  return out;
};

const BloodRockOverlay = React.memo(function BloodRockOverlay() {
  const bats = useMemo(() => ppZufall(ppFxN(4), (i) => ({
    y: 3 + Math.random() * 22, dur: 18 + Math.random() * 14, delay: -Math.random() * 30,
    bob: 1 + Math.round(Math.random() * 2), bobDur: 1.4 + Math.random() * 1.2, flap: .3 + Math.random() * .12, rtl: i % 2 === 1,
  })), []);
  const batsFern = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    y: 2 + Math.random() * 14, dur: 34 + Math.random() * 16, delay: -Math.random() * 40,
    flap: .26 + Math.random() * .1, rtl: i % 2 === 0,
  })), []);
  const ripples = useMemo(() => {
    const out = [...BR_TORBAU_FUESSE];
    for (const [x, y] of BR_KACHEL_FUESSE) for (const xx of brKachelX(x)) out.push([xx, y]);
    return out.slice(0, ppFxN(30)).map(([x, y]) => ({ x, y, dur: .6 + Math.random() * .5, delay: -Math.random() * 2 }));
  }, []);
  const kaefige = useMemo(() => brKachelX(BR_KAEFIG[0], 8).map((x) => ({
    x, dur: 3.2 + Math.random() * .8, delay: -Math.random() * 4,
  })), []);
  const haende = useMemo(() => {
    const out = BR_HAENDE_TORBAU.map(([x, y]) => ({ left: ppArtX(x - 2, BR_KEEP_W), y }));
    for (const [x, y] of BR_HAENDE_KACHEL) for (const xx of brKachelX(x)) out.push({ left: ppArtX(xx - 2, 0), y });
    return out.slice(0, ppFxN(6)).map((h) => ({ ...h, dur: 9 + Math.random() * 9, delay: -Math.random() * 18 }));
  }, []);
  const tropfen = useMemo(() => {
    const out = BR_GALERIE_TROPFEN.map((x) => ({ left: ppArtX(x, BR_KEEP_W), y0: 30, y1: 33 }));
    for (const [x, y] of BR_TROPFSTEINE) for (const xx of brKachelX(x)) out.push({ left: ppArtX(xx, 0), y0: y, y1: 29 });
    for (const k of kaefige) out.push({ left: ppArtX(k.x + 1, 0), y0: BR_KAEFIG[1] + 25, y1: 78 });
    return out.slice(0, ppFxN(12)).map((d) => ({ ...d, dur: 3.2 + Math.random() * 2.6, delay: -Math.random() * 6 }));
  }, [kaefige]);
  const ratten = useMemo(() => ppZufall(ppFxN(2), (i) => ({
    y: 86 + i * 7 + Math.random() * 3, dur: 26 + Math.random() * 14, delay: -Math.random() * 30 - i * 11, rtl: i === 1,
  })), []);
  const wand = BR_KEEP_W;
  return (
    <PixelScene artH={100} bg="#140606" className="blood-rock-overlay">
      <PixelBand src={BR + 'tile.png'} />
      <div className="pp-pixel-layer br-strom" style={ppMaske(BR + 'mask-tile.png', true)} />
      {batsFern.map((b, i) => (
        <div key={'f' + i} className="pp-area-dyn pp-quer" style={ppQuer(b.y, b.dur, b.delay, b.rtl)}>
          <i className="br-bat-fern" style={{ transform: b.rtl ? 'scaleX(-1)' : undefined, animationDuration: `${b.flap.toFixed(2)}s` }} />
        </div>
      ))}
      <PixelPiece src={BR + 'keep.png'} w={wand} />
      <div className="pp-pixel-layer br-strom" style={{
        left: `calc(50% - ${wand / 2} * var(--px))`, right: 'auto', width: ppArt(wand),
        ...ppMaske(BR + 'mask-keep.png', false),
      }} />
      {/* Wache hinter der Brustwehr des Hauptbaus (Weg x 46–111, Füße y 40) */}
      <div className="br-wache-bahn" style={{ left: ppArtX(46, wand), top: ppArt(31) }}>
        <i className="br-wache" />
      </div>
      <PixelPiece src={BR + 'keep-front.png'} w={wand} />
      <i className="br-vampir" style={{ left: ppArtX(86, wand), top: 0 }} />
      {kaefige.map((k, i) => (
        <i key={'k' + i} className="br-kaefig" style={{
          left: ppArtX(k.x - 7, 0), top: ppArt(BR_KAEFIG[1]),
          animationDuration: `${k.dur.toFixed(2)}s`, animationDelay: `${k.delay.toFixed(2)}s`,
        }} />
      ))}
      {haende.map((h, i) => (
        <i key={'h' + i} className="pp-area-dyn br-haende" style={{
          left: h.left, top: ppArt(h.y), animation: `brHaende ${h.dur.toFixed(2)}s steps(1) ${h.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {ripples.map((r, i) => (
        <i key={'r' + i} className="pp-area-dyn br-kraeusel" style={{
          left: ppArtX(r.x - 4, 0), top: ppArt(r.y - 1),
          animation: `ppSprite3 ${r.dur.toFixed(2)}s steps(1) ${r.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {tropfen.map((d, i) => (
        <i key={'d' + i} className="pp-area-dyn pp-px-tropfen" style={{
          left: d.left, top: ppArt(d.y0), '--fall': ppArt(d.y1 - d.y0),
          '--tropfen': '#8a120d', '--tropfen-dunkel': '#3d0506',
          animation: `ppPxTropfen ${d.dur.toFixed(2)}s ease-in ${d.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      <div className="pp-pixel-layer br-mist" style={{ top: ppArt(70) }} />
      {ratten.map((r, i) => (
        <div key={'t' + i} className="pp-area-dyn br-ratte-bahn" style={{
          top: ppArt(r.y), animation: `${r.rtl ? 'brRatteRtl' : 'brRatteLtr'} ${r.dur.toFixed(1)}s linear ${r.delay.toFixed(1)}s infinite`,
        }}>
          <i className="br-ratte" style={{ transform: r.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      <div className="pp-pixel-layer br-mist br-mist-nah" style={{ top: ppArt(84) }} />
      {bats.map((b, i) => (
        <div key={'b' + i} className="pp-area-dyn pp-quer" style={ppQuer(b.y, b.dur, b.delay, b.rtl)}>
          <i className="br-bat" style={{
            '--bob': ppArt(b.bob), transform: b.rtl ? 'scaleX(-1)' : undefined,
            animationDuration: `${b.flap.toFixed(2)}s, ${b.bobDur.toFixed(2)}s`,
          }} />
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        /* Blut läuft: helle Schlieren wandern durch die Ströme nach unten */
        .br-strom {
          position: absolute; inset: 0;
          background: url(${BR}flow.png) 0 0 / calc(8 * var(--px)) calc(16 * var(--px)) repeat;
          animation: brStrom .8s steps(16) infinite;
        }
        @keyframes brStrom { from { background-position: 0 0; } to { background-position: 0 calc(16 * var(--px)); } }
        .br-kraeusel {
          position: absolute; width: calc(9 * var(--px)); height: calc(3 * var(--px));
          background: url(${BR}ripple.png) 0 0 / 300% 100% no-repeat;
        }
        .br-vampir {
          position: absolute; width: calc(11 * var(--px)); height: calc(9 * var(--px));
          background: url(${BR}vampire.png) 0 0 / 300% 100% no-repeat;
          animation: ppSprite3 1.2s steps(1) infinite;
        }
        .br-wache-bahn { position: absolute; animation: brWacheWeg 26s steps(65) infinite; }
        .br-wache {
          display: block; width: calc(7 * var(--px)); height: calc(9 * var(--px));
          background: url(${BR}guard.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .7s steps(1) infinite, brWacheWende 26s steps(1) infinite;
        }
        @keyframes brWacheWeg {
          0%, 8% { transform: translateX(0); }
          46%, 54% { transform: translateX(calc(65 * var(--px))); }
          92%, 100% { transform: translateX(0); }
        }
        @keyframes brWacheWende { 0% { transform: scaleX(1); } 50% { transform: scaleX(-1); } }
        .br-kaefig {
          position: absolute; width: calc(15 * var(--px)); height: calc(26 * var(--px));
          background: url(${BR}cage.png) 0 0 / 400% 100% no-repeat;
          animation-name: brPendel; animation-timing-function: steps(1); animation-iteration-count: infinite;
        }
        @keyframes brPendel {
          0% { background-position: 0 0; } 25% { background-position: 33.333% 0; }
          50% { background-position: 66.667% 0; } 75% { background-position: 100% 0; }
        }
        .br-haende {
          position: absolute; width: calc(5 * var(--px)); height: calc(3 * var(--px)); opacity: 0;
          background: url(${BR}hands.png) 0 0 / 100% 100% no-repeat;
        }
        @keyframes brHaende { 0%, 55% { opacity: 0; } 56%, 88% { opacity: 1; } 89%, 100% { opacity: 0; } }
        .br-mist {
          position: absolute; left: 0; right: 0; height: calc(14 * var(--px));
          background: url(${BR}mist.png) 0 0 / auto 100% repeat-x; opacity: .45;
          animation: brNebel 64s steps(128) infinite;
        }
        .br-mist-nah { opacity: .55; animation-duration: 44s; animation-direction: reverse; }
        @keyframes brNebel { from { background-position: 0 0; } to { background-position: calc(128 * var(--px)) 0; } }
        .br-bat {
          display: block; width: calc(7 * var(--px)); height: calc(5 * var(--px));
          background: url(${BR}bat.png) 0 0 / 300% 100% no-repeat;
          animation-name: ppSprite3, ppBob; animation-timing-function: steps(1), ease-in-out;
          animation-iteration-count: infinite; animation-direction: normal, alternate;
        }
        .br-bat-fern {
          display: block; width: calc(5 * var(--px)); height: calc(3 * var(--px));
          background: url(${BR}bat-far.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .3s steps(1) infinite;
        }
        .br-ratte-bahn { position: absolute; left: 0; }
        .br-ratte {
          display: block; width: calc(7 * var(--px)); height: calc(3 * var(--px));
          background: url(${BR}rat.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .18s steps(1) infinite;
        }
        @keyframes brRatteLtr {
          0% { transform: translateX(calc(-10 * var(--px))); }
          28%, 100% { transform: translateX(calc(100cqw + 10 * var(--px))); }
        }
        @keyframes brRatteRtl {
          0% { transform: translateX(calc(100cqw + 10 * var(--px))); }
          28%, 100% { transform: translateX(calc(-10 * var(--px))); }
        }
      `}</style>
    </PixelScene>
  );
});


// ═══════════════════════════════════════════════════════════════════
//  PANGAIA, THE DINO DOMAIN — die Dino-Insel (v1439, Al 25.9.)
//  Überarbeitung v1441 (Al 25.9.)
//
//  Nach dem Kartenmotiv: eine ganze Insel aus der Vogelperspektive —
//  dichter Dschungel aus schattierten Baumkronen, Lichtungen, Erdflecken,
//  Felsbrocken, Strand und Flachwasser an der Küste, ein Fluss vom
//  Vulkanfuß zur Bucht, ein See, der Vulkan mit Lavasee und Lavastrom.
//  Darauf kleine (eigentlich riesige) Dinosaurier: eine Brachiosaurus-
//  Herde grast, ein T-Rex streift umher, Raptoren flitzen, Flugsaurier
//  ziehen mit Schatten über alles hinweg. Wasser glitzert, Lava glüht,
//  der Vulkan raucht. Licht IMMER oben rechts.
//
//  v1441: jede Baumkrone einzeln aus kleinen Blattballen gemalt (Licht-
//  sichel oben rechts, dunkle Fuge unten links, Schlagschatten aus einem
//  Höhenpuffer), mehrere Baumarten (Laub in drei Grüntönen, blühende
//  Kronen, Nadelbäume, Palmen am Strandsaum, Farne); der Vulkan als
//  Höhenfeld mit Rinnen, Kraterwand und Lavasee, der Lavastrom läuft den
//  Hang hinab und dampfend in die rechte Bucht; Fluss mit Schlammufern,
//  See mit Flachwasser, Bach zur Küste, Lichtungen mit Trampelpfaden,
//  Felsbrocken, Nest mit Eiern, Skelett, umgestürztem Stamm und Fuß-
//  spuren im Sand; draußen Hochsee mit Felsinselchen und Riff.
//
//  Ebenen (Kunsthöhe 100; per Generator gemalt, der nicht im Projekt
//  liegt): sea.png — Kachel 128 (Hochsee); island.png — die Insel (260,
//  mittig; fernes Meer durchsichtig, dort liegt die Kachel); surf.png —
//  Brandung (2 Bilder übereinander); mask-water.png / mask-river.png /
//  mask-lava.png — Formen, durch die glitter.png (Glitzern, 32×96),
//  flow-river.png (16×8) und flow-lava.png (8×8) laufen; lava-glow.png —
//  gestufte Glut; brachio.png, trex.png, raptor.png, plesio.png (je 8
//  Bilder: rechts 2× Laufen, 2× Pause, links dasselbe — Licht bleibt oben
//  rechts); ptero.png + ptero-shadow.png (6 Bilder: R/L × 3 Flügel-
//  schläge); smoke.png (4), steam.png (3), bubble.png (3), ripple.png (3).
//
//  Animiert: das Meer, der See und der Fluss glitzern, die Brandung
//  schlägt an Strand und Seeufer, der Fluss strömt zur Bucht, die Lava
//  fließt und glüht, im Lavasee platzen Blasen, der Vulkan raucht, wo
//  die Lava ins Meer läuft, zischt Dampf. Die Brachiosaurier schreiten
//  pixelweise über ihre Lichtung und grasen, der T-Rex patrouilliert und
//  brüllt, ein Raptorenrudel rennt, hält schnuppernd an und rennt zurück,
//  in der unteren Bucht taucht ein Plesiosaurier auf und ab, im See
//  kräuselt es, Flugsaurier ziehen mit Schatten übers Brett.
// ═══════════════════════════════════════════════════════════════════
const PGN = '/areas/pangaia/';
const PGN_W = 260;
const pgnX = (x) => x - PGN_W / 2;              // Insel-x → Kunstpixel neben der Brettmitte
const PGN_KRATER = [[153, 22], [158, 24], [155, 26], [159, 21], [152, 25]];
const PGN_DAMPF = [208, 40];                    // Lava trifft das Meer
const PGN_SEE = [[181, 64], [192, 67], [186, 70], [196, 64]];
// Dinos: Blatt, Größe, Start (Insel-Pixel, oben links), Plan, Takt (s).
// Plan: ['w', n, dx, dy] = n Schritte laufen (je 1 Kunstpixel), ['g', n] = n Takte Pause.
const PGN_DINOS = [
  { art: 'brachio', w: 24, h: 14, x: 48, y: 40, takt: .34, plan: [['w', 10, 1, 0], ['g', 16], ['w', 10, -1, 0], ['g', 12]] },
  { art: 'brachio', w: 24, h: 14, x: 72, y: 50, takt: .38, plan: [['g', 14], ['w', 9, -1, 0], ['g', 18], ['w', 9, 1, 0]] },
  { art: 'trex', w: 19, h: 12, x: 174, y: 78, takt: .2, plan: [['w', 24, 1, 0], ['g', 10], ['w', 24, -1, 0], ['g', 14]] },
  { art: 'raptor', w: 12, h: 7, x: 110, y: 74, takt: .08, plan: [['w', 12, 1, 0], ['w', 4, 1, 1], ['w', 10, 1, 0], ['g', 30], ['w', 10, -1, 0], ['w', 4, -1, -1], ['w', 12, -1, 0], ['g', 40]] },
  { art: 'raptor', w: 12, h: 7, x: 105, y: 77, takt: .08, plan: [['w', 12, 1, 0], ['w', 4, 1, 1], ['w', 10, 1, 0], ['g', 30], ['w', 10, -1, 0], ['w', 4, -1, -1], ['w', 12, -1, 0], ['g', 40]], verz: -.5 },
  { art: 'raptor', w: 12, h: 7, x: 102, y: 72, takt: .08, plan: [['w', 12, 1, 0], ['w', 4, 1, 1], ['w', 10, 1, 0], ['g', 30], ['w', 10, -1, 0], ['w', 4, -1, -1], ['w', 12, -1, 0], ['g', 40]], verz: -1.1 },
  { art: 'plesio', w: 15, h: 9, x: 116, y: 90, takt: .55, plan: [['w', 10, 1, 0], ['g', 10], ['w', 10, -1, 0], ['g', 8]] },
];
// Plan → Keyframes (steps(1): jeder Takt ein ganzer Kunstpixel bzw. ein Bild)
function pgnGang(name, plan) {
  const takte = [];
  let x = 0, y = 0, dir = 1;
  for (const [art, n, dx = 0, dy = 0] of plan) {
    for (let i = 0; i < n; i++) {
      if (art === 'w') { if (dx) dir = Math.sign(dx); x += dx; y += dy; }
      const bild = (dir > 0 ? 0 : 4) + (art === 'w' ? i % 2 : 2 + (Math.floor(i / 3) % 2));
      takte.push([x, y, bild]);
    }
  }
  const N = takte.length;
  const kf = (p, [x, y, b]) => `${p}% { transform: translate(calc(${x} * var(--px)), calc(${y} * var(--px))); background-position: ${(b / 7 * 100).toFixed(3)}% 0; }`;
  return { css: `@keyframes ${name} { ${takte.map((t, i) => kf((i / N * 100).toFixed(3), t)).join(' ')} ${kf(100, takte[N - 1])} }`, n: N };
}

const PangaiaOverlay = React.memo(function PangaiaOverlay() {
  const dinos = useMemo(() => PGN_DINOS.slice(0, Math.max(4, ppFxN(PGN_DINOS.length))).map((d, i) => {
    const g = pgnGang('pgnGang' + i, d.plan);
    const dur = g.n * d.takt;
    return { ...d, css: g.css, name: 'pgnGang' + i, dur, delay: d.verz !== undefined ? d.verz : -Math.random() * dur };
  }), []);
  const flieger = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    y: [6, 52, 30][i] + Math.random() * 8, dur: 20 + Math.random() * 10, delay: -Math.random() * 30, rtl: i % 2 === 1,
  })), []);
  const rauch = useMemo(() => ppZufall(ppFxN(6), (i) => ({ dur: 5.5 + Math.random() * 2.5, delay: -i * 1.25 - Math.random(), dx: Math.round(Math.random() * 4) })), []);
  const dampf = useMemo(() => ppZufall(ppFxN(3), (i) => ({ dur: 2.6 + Math.random(), delay: -i * 1.0, dx: i - 1 })), []);
  const blasen = useMemo(() => PGN_KRATER.slice(0, ppFxN(PGN_KRATER.length)).map(([x, y]) => ({ x, y, dur: 2.2 + Math.random() * 2.2, delay: -Math.random() * 4 })), []);
  const kraeusel = useMemo(() => PGN_SEE.slice(0, ppFxN(PGN_SEE.length)).map(([x, y]) => ({ x, y, dur: 4 + Math.random() * 4, delay: -Math.random() * 8 })), []);
  const mitte = { left: `calc(50% - ${PGN_W / 2} * var(--px))`, width: ppArt(PGN_W), right: 'auto' };
  return (
    <PixelScene artH={100} bg="#123a96" className="pangaia-overlay">
      <PixelBand src={PGN + 'sea.png'} />
      <PixelPiece src={PGN + 'island.png'} w={PGN_W} />
      <div className="pp-pixel-layer pgn-glitzer" />
      <PixelPiece src={PGN + 'surf.png'} w={PGN_W} className="pp-area-dyn" style={{ backgroundSize: '100% 200%', animation: 'ppBand2 3.4s steps(1) infinite' }} />
      <div className="pp-pixel-layer pgn-fluss" style={{ ...mitte, ...ppMaske(PGN + 'mask-river.png', false) }} />
      <PixelPiece src={PGN + 'lava-glow.png'} w={PGN_W} className="pgn-glut" />
      <div className="pp-pixel-layer pgn-lava" style={{ ...mitte, ...ppMaske(PGN + 'mask-lava.png', false) }} />
      {blasen.map((b, i) => (
        <i key={'b' + i} className="pp-area-dyn pgn-blase" style={{ left: ppArtX(pgnX(b.x) - 1, 0), top: ppArt(b.y - 1), animation: `pgnBlubb ${b.dur.toFixed(2)}s steps(1) ${b.delay.toFixed(2)}s infinite` }} />
      ))}
      {kraeusel.map((k, i) => (
        <i key={'k' + i} className="pp-area-dyn pgn-kraeusel" style={{ left: ppArtX(pgnX(k.x) - 3, 0), top: ppArt(k.y - 1), animation: `pgnKraeusel ${k.dur.toFixed(2)}s steps(1) ${k.delay.toFixed(2)}s infinite` }} />
      ))}
      {dinos.map((d, i) => (
        <i key={'d' + i} className={'pp-area-dyn pgn-dino'} style={{
          left: ppArtX(pgnX(d.x), 0), top: ppArt(d.y), width: ppArt(d.w), height: ppArt(d.h),
          backgroundImage: `url(${PGN}${d.art}.png)`,
          animation: `${d.name} ${d.dur.toFixed(2)}s steps(1) ${d.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {dampf.map((r, i) => (
        <i key={'s' + i} className="pp-area-dyn pgn-dampf" style={{ left: ppArtX(pgnX(PGN_DAMPF[0]) - 3 + r.dx, 0), top: ppArt(PGN_DAMPF[1] - 6), animation: `pgnDampf ${r.dur.toFixed(2)}s steps(10) ${r.delay.toFixed(2)}s infinite, pgnDampfBild ${r.dur.toFixed(2)}s steps(1) ${r.delay.toFixed(2)}s infinite` }} />
      ))}
      {rauch.map((r, i) => (
        <i key={'r' + i} className="pp-area-dyn pgn-rauch" style={{ left: ppArtX(pgnX(156) - 6 + r.dx, 0), top: ppArt(24 - 10), animation: `pgnRauch ${r.dur.toFixed(2)}s steps(30) ${r.delay.toFixed(2)}s infinite, pgnRauchBild ${r.dur.toFixed(2)}s steps(1) ${r.delay.toFixed(2)}s infinite` }} />
      ))}
      {flieger.map((f, i) => (
        <div key={'f' + i} className="pp-area-dyn pp-quer" style={ppQuer(f.y, f.dur, f.delay, f.rtl)}>
          <div style={{ position: 'relative' }}>
            <i className={'pgn-ptero-schatten' + (f.rtl ? ' l' : '')} />
            <i className={'pgn-ptero' + (f.rtl ? ' l' : '')} />
          </div>
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        ${dinos.map(d => d.css).join('\n')}
        .pgn-dino { position: absolute; background-size: 800% 100%; background-repeat: no-repeat; }
        /* Glitzern auf allem Wasser: Maske = Wasser der Insel + alles außerhalb des Versatzstücks */
        .pgn-glitzer {
          position: absolute; inset: 0;
          background: url(${PGN}glitter.png) 0 0 / calc(32 * var(--px)) calc(96 * var(--px)) repeat;
          -webkit-mask-image: url(${PGN}mask-water.png), linear-gradient(to right, #fff calc(50% - ${PGN_W / 2} * var(--px)), transparent 0 calc(50% + ${PGN_W / 2} * var(--px)), #fff 0);
          mask-image: url(${PGN}mask-water.png), linear-gradient(to right, #fff calc(50% - ${PGN_W / 2} * var(--px)), transparent 0 calc(50% + ${PGN_W / 2} * var(--px)), #fff 0);
          -webkit-mask-size: calc(${PGN_W} * var(--px)) 100%, 100% 100%; mask-size: calc(${PGN_W} * var(--px)) 100%, 100% 100%;
          -webkit-mask-position: 50% 0, 0 0; mask-position: 50% 0, 0 0;
          -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
          animation: pgnGlitzer 2.7s steps(1) infinite;
        }
        @keyframes pgnGlitzer { 0% { background-position: 0 0; } 33.3% { background-position: calc(-11 * var(--px)) calc(32 * var(--px)); } 66.6% { background-position: calc(-5 * var(--px)) calc(64 * var(--px)); } }
        .pgn-fluss {
          position: absolute; top: 0; bottom: 0;
          background: url(${PGN}flow-river.png) 0 0 / calc(16 * var(--px)) calc(8 * var(--px)) repeat;
          animation: pgnFluss 2.4s steps(16) infinite;
        }
        @keyframes pgnFluss { from { background-position: 0 0; } to { background-position: calc(-16 * var(--px)) 0; } }
        .pgn-lava {
          position: absolute; top: 0; bottom: 0;
          background: url(${PGN}flow-lava.png) 0 0 / calc(8 * var(--px)) calc(8 * var(--px)) repeat;
          animation: pgnLavaFluss 2.2s steps(8) infinite;
        }
        @keyframes pgnLavaFluss { from { background-position: 0 0; } to { background-position: calc(8 * var(--px)) calc(8 * var(--px)); } }
        .pgn-glut { animation: pgnGlut 2.6s ease-in-out infinite alternate; }
        @keyframes pgnGlut { from { opacity: .5; } to { opacity: 1; } }
        .pgn-blase { position: absolute; width: calc(3 * var(--px)); height: calc(3 * var(--px)); background: url(${PGN}bubble.png) 0 0 / 300% 100% no-repeat; opacity: 0; }
        @keyframes pgnBlubb { 0%, 70% { opacity: 0; background-position: 0 0; } 72% { opacity: 1; background-position: 0 0; } 80% { background-position: 50% 0; } 88% { background-position: 100% 0; } 94%, 100% { opacity: 0; background-position: 100% 0; } }
        .pgn-kraeusel { position: absolute; width: calc(7 * var(--px)); height: calc(3 * var(--px)); background: url(${PGN}ripple.png) 0 0 / 300% 100% no-repeat; opacity: 0; }
        @keyframes pgnKraeusel { 0%, 76% { opacity: 0; background-position: 0 0; } 78% { opacity: 1; background-position: 0 0; } 85% { background-position: 50% 0; } 92% { background-position: 100% 0; } 98%, 100% { opacity: 0; background-position: 100% 0; } }
        .pgn-rauch { position: absolute; width: calc(11 * var(--px)); height: calc(11 * var(--px)); background: url(${PGN}smoke.png) 0 0 / 400% 100% no-repeat; opacity: 0; }
        @keyframes pgnRauch {
          0% { transform: translate(0, 0); opacity: 0; } 8% { opacity: .95; } 55% { opacity: .8; }
          100% { transform: translate(calc(30 * var(--px)), calc(-22 * var(--px))); opacity: 0; }
        }
        @keyframes pgnRauchBild { 0% { background-position: 0 0; } 20% { background-position: 33.33% 0; } 45% { background-position: 66.67% 0; } 75% { background-position: 100% 0; } }
        .pgn-dampf { position: absolute; width: calc(7 * var(--px)); height: calc(7 * var(--px)); background: url(${PGN}steam.png) 0 0 / 300% 100% no-repeat; opacity: 0; }
        @keyframes pgnDampf { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: .85; } 100% { transform: translate(calc(3 * var(--px)), calc(-10 * var(--px))); opacity: 0; } }
        @keyframes pgnDampfBild { 0% { background-position: 0 0; } 30% { background-position: 50% 0; } 65% { background-position: 100% 0; } }
        .pgn-ptero { position: absolute; left: 0; top: 0; width: calc(13 * var(--px)); height: calc(15 * var(--px)); background: url(${PGN}ptero.png) 0 0 / 600% 100% no-repeat; animation: pgnFlapR .66s steps(1) infinite; }
        .pgn-ptero-schatten { position: absolute; left: calc(-7 * var(--px)); top: calc(14 * var(--px)); width: calc(13 * var(--px)); height: calc(15 * var(--px)); background: url(${PGN}ptero-shadow.png) 0 0 / 600% 100% no-repeat; animation: pgnFlapR .66s steps(1) infinite; }
        .pgn-ptero.l, .pgn-ptero-schatten.l { animation-name: pgnFlapL; }
        @keyframes pgnFlapR { 0% { background-position: 0 0; } 33.3% { background-position: 20% 0; } 66.6% { background-position: 40% 0; } }
        @keyframes pgnFlapL { 0% { background-position: 60% 0; } 33.3% { background-position: 80% 0; } 66.6% { background-position: 100% 0; } }
      `}</style>
    </PixelScene>
  );
});


// ═══════════════════════════════════════════════════════════════════
//  BOARD OF KINGS — das riesige Marmor-Schachbrett im Königsgarten
//  (v1438, Al 25.9.; Überarbeitung v1441 (Al 25.9.))
//
//  Nach dem Kartenmotiv (Al, v1438): ein riesiges Schachbrett aus
//  poliertem Marmor (Felder mit Fase — oben/rechts im Licht, unten/links
//  im Schatten —, feinen Adern), dunkle Einfassung, violettgrauer
//  Pflasterrand, dahinter Blumenhecken. Die Schachfiguren des Motivs
//  bleiben WEG (Al). Das Brett ist so groß, dass es oben und unten aus
//  dem Bild läuft (10 Spalten à 12 Kunstpixel, wie abgenommen).
//
//  v1441 (Al: „deine haben ein anderes Level"): dieselbe Szene, deutlich
//  feiner gemalt. Jedes Marmorfeld ist ein eigenes Stück: fließende Adern
//  mit weichem Hof (in den hellen Feldern graublau, ab und zu golden; in
//  den dunklen silbrig), zweistufige Fase, Politurglanz oben rechts, ein
//  leiser Schimmer schräg über das Brett, dazu Absplitterungen an Ecken,
//  zwei Haarrisse, verwehte Blütenblätter und Blätter. Die Einfassung ist
//  dunkler Stein mit einer Bronze-Einlage und Nieten auf Höhe der Fugen.
//  Der Pflasterrand besteht aus einzeln schattierten Kopfsteinen mit
//  bemoosten Fugen, Unkraut und Kieseln; Brett und Hecken werfen Schatten
//  darauf, die Hecken hängen über. Dahinter ein Heckengarten von oben:
//  Heckenreihen aus Blattballen (jede Reihe eigene Laubfarbe und Blüten —
//  Rosa/Weiß, Gelb/Rot, Lila/Weiß, Rot/Rosa/Orange), Rasenstreifen mit
//  Gänseblümchen und Klee, Durchgänge mit Trittsteinen, ein Kiesweg.
//
//  Ebenen (Kunsthöhe 100; per Generator gemalt, der nicht im Projekt
//  liegt): hedge.png — Kachel 128 (Heckengarten ohne Blüten);
//  blossoms.png — die Blüten und Blattspitzen, 3 Bilder übereinander
//  (Wiegen im Wind, räumlich zusammenhängend); board.png — Versatzstück
//  160, mittig (Brett, Einfassung, Pflaster, überhängende Hecke — passt
//  pixelgenau auf die Kachel); glint.png (8 Bilder 11×11), petal.png
//  (4×3 Bilder 3×3), butterfly.png (2×3 Bilder 5×4), dove.png (3 Bilder
//  11×9), ladybug.png (2 Bilder 3×4), cloud.png (Wolkenschatten).
//
//  Animiert: Blüten und Blattspitzen wiegen, ein Glanzstreif huscht über
//  einzelne Felder, die Bronzenieten funkeln, Wolkenschatten ziehen über
//  Garten und Brett, Blütenblätter treiben taumelnd vorbei, Schmetterlinge
//  gaukeln über den Hecken (einer quert das Brett), Bienen summen um die
//  Blüten, ab und zu fliegt eine weiße Taube samt Schatten über die
//  Szene, Marienkäfer krabbeln über das Pflaster.
//  Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const BOK = '/areas/board-of-kings/';
const BOK_W = 160;                                   // Brett-Versatzstück
const BOK_BRETT = { feld: 12, spalten: 10, oy: -4 };  // Felder 12, 10 Spalten, erste Reihe bei y −4
// Kachel-x t (0..127) → Kunstpixel neben der Brettmitte, k-te Wiederholung
const bokKachel = (t, k) => t - 64 + 128 * k;
// Heckenmitten (Kachel-x) und sichtbare Wiederholungen links (k −1) / rechts (k 0/1)
const BOK_HECKEN = [[21, [-1, 1]], [51, [-1, 1]], [79, [-1, 1]], [107, [-1, 1]]];
const BOK_HECKEN_X = BOK_HECKEN.flatMap(([t, ks]) => ks.map(k => bokKachel(t, k)))
  .filter(x => Math.abs(x) > 80).sort((a, b) => Math.abs(a) - Math.abs(b));

const BoardOfKingsOverlay = React.memo(function BoardOfKingsOverlay() {
  const glanz = useMemo(() => ppZufall(ppFxN(6), () => {
    const col = Math.floor(Math.random() * BOK_BRETT.spalten), row = 1 + Math.floor(Math.random() * 7);
    return {
      x: -BOK_BRETT.feld * BOK_BRETT.spalten / 2 + col * BOK_BRETT.feld + 1, y: BOK_BRETT.oy + row * BOK_BRETT.feld + 1,
      dunkel: (col + row) % 2 === 1, dur: 6 + Math.random() * 6, delay: -Math.random() * 12,
    };
  }), []);
  const funkeln = useMemo(() => ppZufall(ppFxN(4), (i) => ({
    x: i % 2 ? 61 : -62, y: BOK_BRETT.oy + BOK_BRETT.feld * (1 + Math.floor(Math.random() * 8)),
    dur: 5 + Math.random() * 5, delay: -Math.random() * 10,
  })), []);
  const blaetter = useMemo(() => ppZufall(ppFxN(8), (i) => ({
    y: 4 + Math.random() * 86, dur: 16 + Math.random() * 12, delay: -Math.random() * 28, rtl: i % 2 === 1,
    farbe: i % 3, bob: 2 + Math.floor(Math.random() * 4), tumble: .5 + Math.random() * .5,
  })), []);
  const falter = useMemo(() => ppZufall(ppFxN(4), (i) => ({
    x: BOK_HECKEN_X[i % BOK_HECKEN_X.length] + (Math.random() - .5) * 8, y: 12 + Math.random() * 70,
    farbe: i % 3, dur: 7 + Math.random() * 5, delay: -Math.random() * 12, b: i % 2 === 1,
  })), []);
  const quer = useMemo(() => ppZufall(ppFxN(1), () => ({
    y: 20 + Math.random() * 50, dur: 34 + Math.random() * 10, delay: -Math.random() * 30, rtl: Math.random() < .5,
  })), []);
  const bienen = useMemo(() => ppZufall(ppFxN(6), (i) => ({
    x: BOK_HECKEN_X[i % 4] + (Math.random() - .5) * 12, y: 8 + Math.random() * 82,
    dur: 1.4 + Math.random() * 1.2, delay: -Math.random() * 3, b: i % 2 === 1, drift: 2 + Math.floor(Math.random() * 3),
  })), []);
  const tauben = useMemo(() => ppZufall(ppFxN(1), () => ({
    y: 14 + Math.random() * 50, dur: 46 + Math.random() * 14, delay: -Math.random() * 20, rtl: Math.random() < .5,
  })), []);
  const kaefer = useMemo(() => ppZufall(ppFxN(2), (i) => ({
    x: i ? 68 : -71, dur: 70 + Math.random() * 30, delay: -Math.random() * 80, ab: i === 1,
  })), []);
  return (
    <PixelScene artH={100} bg="#1c3a18" className="board-of-kings-overlay">
      <PixelBand src={BOK + 'hedge.png'} />
      <PixelBand src={BOK + 'blossoms.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 2.7s steps(1) infinite' }} />
      <PixelPiece src={BOK + 'board.png'} w={BOK_W} />
      {kaefer.map((k, i) => (
        <i key={'k' + i} className={'pp-area-dyn bok-kaefer' + (k.ab ? ' ab' : '')} style={{ left: ppArtX(k.x, 0), animationDuration: `${k.dur.toFixed(1)}s, .4s`, animationDelay: `${k.delay.toFixed(1)}s, 0s` }} />
      ))}
      {glanz.map((g, i) => (
        <i key={'g' + i} className={'pp-area-dyn bok-glanz' + (g.dunkel ? ' dunkel' : '')} style={{ left: ppArtX(g.x, 0), top: ppArt(g.y), animation: `bokGlanz ${g.dur.toFixed(2)}s steps(1) ${g.delay.toFixed(2)}s infinite` }} />
      ))}
      {funkeln.map((f, i) => (
        <i key={'f' + i} className="pp-area-dyn pp-px-funkeln bok-funkeln" style={{ left: ppArtX(f.x - 1, 0), top: ppArt(f.y - 1), animation: `ppFunkeln ${f.dur.toFixed(2)}s linear ${f.delay.toFixed(2)}s infinite` }} />
      ))}
      <i className="pp-area-dyn bok-wolke" />
      <i className="pp-area-dyn bok-wolke b" />
      {tauben.map((t, i) => (
        <div key={'ts' + i} className="pp-area-dyn bok-flug" style={{ top: ppArt(t.y + 8), marginLeft: ppArt(-6), animation: `${t.rtl ? 'bokFlugRtl' : 'bokFlugLtr'} ${t.dur.toFixed(1)}s linear ${t.delay.toFixed(1)}s infinite` }}>
          <i className="bok-taube schatten" style={{ transform: t.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      {bienen.map((b, i) => (
        <div key={'b' + i} className="pp-area-dyn bok-biene-ort" style={{ left: ppArtX(b.x, 0), top: ppArt(b.y), '--bob': ppArt(b.drift), animation: `ppBob ${(b.drift * 1.1).toFixed(2)}s steps(3) infinite alternate` }}>
          <i className="bok-biene" style={{ animation: `${b.b ? 'bokSummB' : 'bokSummA'} ${b.dur.toFixed(2)}s steps(2) ${b.delay.toFixed(2)}s infinite, bokFluegel .1s steps(1) infinite` }} />
        </div>
      ))}
      {falter.map((f, i) => (
        <div key={'s' + i} className="pp-area-dyn bok-falter-ort" style={{ left: ppArtX(f.x, 0), top: ppArt(f.y), animation: `${f.b ? 'bokGaukelnB' : 'bokGaukelnA'} ${f.dur.toFixed(2)}s steps(24) ${f.delay.toFixed(2)}s infinite` }}>
          <i className="bok-falter" style={{ backgroundPositionY: `${f.farbe * 50}%` }} />
        </div>
      ))}
      {quer.map((q, i) => (
        <div key={'q' + i} className="pp-area-dyn pp-quer" style={ppQuer(q.y, q.dur, q.delay, q.rtl)}>
          <i className="bok-falter" style={{ backgroundPositionY: '50%', animation: 'bokFlattern .32s steps(1) infinite, ppBob 1.6s steps(4) infinite alternate', '--bob': ppArt(6) }} />
        </div>
      ))}
      {blaetter.map((b, i) => (
        <div key={'p' + i} className="pp-area-dyn pp-quer" style={ppQuer(b.y, b.dur, b.delay, b.rtl)}>
          <i className="bok-blatt" style={{ backgroundPositionY: `${b.farbe * 50}%`, '--bob': ppArt(b.bob), animation: `bokTaumeln ${b.tumble.toFixed(2)}s steps(1) infinite, ppBob ${(b.bob * .55).toFixed(2)}s steps(${b.bob}) infinite alternate` }} />
        </div>
      ))}
      {tauben.map((t, i) => (
        <div key={'t' + i} className="pp-area-dyn bok-flug" style={{ top: ppArt(t.y), animation: `${t.rtl ? 'bokFlugRtl' : 'bokFlugLtr'} ${t.dur.toFixed(1)}s linear ${t.delay.toFixed(1)}s infinite` }}>
          <i className="bok-taube" style={{ transform: t.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .bok-glanz {
          position: absolute; width: calc(11 * var(--px)); height: calc(11 * var(--px));
          background: url(${BOK}glint.png) 0 0 / 800% 100% no-repeat; opacity: .85;
        }
        .bok-glanz.dunkel { opacity: .45; }
        @keyframes bokGlanz {
          0%, 88% { background-position-x: 0%; }
          89.5% { background-position-x: 14.29%; } 91% { background-position-x: 28.57%; }
          92.5% { background-position-x: 42.86%; } 94% { background-position-x: 57.14%; }
          95.5% { background-position-x: 71.43%; } 97% { background-position-x: 85.71%; }
          98.5%, 100% { background-position-x: 0%; }
        }
        .bok-funkeln { filter: sepia(1) saturate(2.2) brightness(1.05); }
        .bok-wolke {
          position: absolute; top: 0; left: 0; width: calc(112 * var(--px)); height: calc(60 * var(--px));
          background: url(${BOK}cloud.png) 0 0 / 100% 100% no-repeat;
          animation: bokWolke 52s linear infinite;
        }
        .bok-wolke.b { width: calc(56 * var(--px)); height: calc(30 * var(--px)); animation-duration: 37s; animation-delay: -21s; --wy: calc(58 * var(--px)); }
        @keyframes bokWolke {
          from { transform: translate(calc(-120 * var(--px)), var(--wy, calc(4 * var(--px)))); }
          to { transform: translate(calc(100cqw + 10 * var(--px)), calc(var(--wy, calc(4 * var(--px))) + 14 * var(--px))); }
        }
        .bok-blatt {
          display: block; width: calc(3 * var(--px)); height: calc(3 * var(--px));
          background-image: url(${BOK}petal.png); background-size: 400% 300%; background-repeat: no-repeat;
        }
        @keyframes bokTaumeln { 0% { background-position-x: 0%; } 25% { background-position-x: 33.33%; } 50% { background-position-x: 66.67%; } 75% { background-position-x: 100%; } }
        .bok-falter-ort { position: absolute; width: calc(5 * var(--px)); height: calc(4 * var(--px)); }
        .bok-falter {
          display: block; width: calc(5 * var(--px)); height: calc(4 * var(--px));
          background-image: url(${BOK}butterfly.png); background-size: 200% 300%; background-repeat: no-repeat;
          animation: bokFlattern .3s steps(1) infinite;
        }
        @keyframes bokFlattern { 0% { background-position-x: 0%; } 50% { background-position-x: 100%; } }
        @keyframes bokGaukelnA {
          0%, 100% { transform: translate(0, 0); } 15% { transform: translate(calc(5 * var(--px)), calc(-4 * var(--px))); }
          30% { transform: translate(calc(9 * var(--px)), calc(1 * var(--px))); } 45% { transform: translate(calc(4 * var(--px)), calc(6 * var(--px))); }
          60% { transform: translate(calc(-3 * var(--px)), calc(4 * var(--px))); } 75% { transform: translate(calc(-7 * var(--px)), calc(-2 * var(--px))); }
          88% { transform: translate(calc(-3 * var(--px)), calc(-5 * var(--px))); }
        }
        @keyframes bokGaukelnB {
          0%, 100% { transform: translate(0, 0); } 20% { transform: translate(calc(-6 * var(--px)), calc(-3 * var(--px))); }
          40% { transform: translate(calc(-2 * var(--px)), calc(-9 * var(--px))); } 55% { transform: translate(calc(5 * var(--px)), calc(-6 * var(--px))); }
          70% { transform: translate(calc(7 * var(--px)), calc(1 * var(--px))); } 85% { transform: translate(calc(2 * var(--px)), calc(4 * var(--px))); }
        }
        .bok-biene-ort { position: absolute; width: var(--px); height: var(--px); }
        .bok-biene { position: absolute; width: calc(2 * var(--px)); height: var(--px); background: linear-gradient(90deg, #1e1406 50%, #f0c23a 50%); }
        @keyframes bokFluegel { 0% { box-shadow: 0 calc(-1 * var(--px)) 0 rgba(230, 236, 245, .8); } 50% { box-shadow: var(--px) calc(-1 * var(--px)) 0 rgba(230, 236, 245, .55); } }
        @keyframes bokSummA {
          0%, 100% { transform: translate(0, 0); } 12.5% { transform: translate(calc(3 * var(--px)), calc(-2 * var(--px))); }
          25% { transform: translate(calc(5 * var(--px)), 0); } 37.5% { transform: translate(calc(3 * var(--px)), calc(2 * var(--px))); }
          50% { transform: translate(0, 0); } 62.5% { transform: translate(calc(-3 * var(--px)), calc(-2 * var(--px))); }
          75% { transform: translate(calc(-5 * var(--px)), 0); } 87.5% { transform: translate(calc(-3 * var(--px)), calc(2 * var(--px))); }
        }
        @keyframes bokSummB {
          0%, 100% { transform: translate(0, 0); } 20% { transform: translate(calc(4 * var(--px)), calc(-3 * var(--px))); }
          40% { transform: translate(calc(2 * var(--px)), calc(-5 * var(--px))); } 60% { transform: translate(calc(-3 * var(--px)), calc(-4 * var(--px))); }
          80% { transform: translate(calc(-4 * var(--px)), calc(-1 * var(--px))); }
        }
        .bok-flug { position: absolute; left: 0; }
        @keyframes bokFlugLtr { 0% { transform: translateX(calc(-30 * var(--px))); } 45%, 100% { transform: translateX(calc(100cqw + 20 * var(--px))); } }
        @keyframes bokFlugRtl { 0% { transform: translateX(calc(100cqw + 20 * var(--px))); } 45%, 100% { transform: translateX(calc(-30 * var(--px))); } }
        .bok-taube {
          display: block; width: calc(11 * var(--px)); height: calc(9 * var(--px));
          background: url(${BOK}dove.png) 0 0 / 300% 100% no-repeat;
          animation: bokSchlag .6s steps(1) infinite;
        }
        .bok-taube.schatten { filter: brightness(0); opacity: .22; }
        @keyframes bokSchlag { 0% { background-position: 0 0; } 25% { background-position: 50% 0; } 50% { background-position: 100% 0; } 75% { background-position: 50% 0; } }
        .bok-kaefer {
          position: absolute; top: 0; width: calc(3 * var(--px)); height: calc(4 * var(--px));
          background: url(${BOK}ladybug.png) 0 0 / 200% 100% no-repeat;
          animation-name: bokKrabbeln, ppSprite2; animation-timing-function: steps(120), steps(1); animation-iteration-count: infinite;
        }
        .bok-kaefer.ab { animation-name: bokKrabbelnAb, ppSprite2; }
        @keyframes bokKrabbeln {
          0% { transform: translateY(calc(104 * var(--px))); } 40% { transform: translateY(calc(50 * var(--px))); }
          55% { transform: translateY(calc(50 * var(--px))); } 100% { transform: translateY(calc(-8 * var(--px))); }
        }
        @keyframes bokKrabbelnAb {
          0% { transform: translateY(calc(-8 * var(--px))) rotate(180deg); } 45% { transform: translateY(calc(40 * var(--px))) rotate(180deg); }
          60% { transform: translateY(calc(40 * var(--px))) rotate(180deg); } 100% { transform: translateY(calc(104 * var(--px))) rotate(180deg); }
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  SHARED BLOOD TANKS — Blutkeller der Festung (v1411, Kartenstil v1413,
//  Überarbeitung v1441 (Al 25.9.))
//
//  Al 25.9.: „ein dunkler Kellerraum derselben Festung mit grossen Tanks
//  voller Blut und Knochen/Schaedeln darin."
//  STIL (Al 25.9., nach den ersten drei Szenen): die Hintergründe sollen
//  wie Als eigene Kartenmotive aussehen, nicht wie „gemalte" Szenen —
//  grobe Pixel (Kunsthöhe 100 statt 200), Flächen als unregelmäßiges
//  Pixelrauschen statt geordnetem Dithering, schwarze Fugen und Konturen,
//  satte Farben, weiche Leuchtflecken, nur leichte Randabdunklung.
//
//  „Shared" sichtbar: alle Tanks hängen an EINEM Rohrnetz, in der Mitte
//  steht das Pumpwerk. Der Blutspiegel steigt und fällt in ALLEN Tanks
//  und im Schauglas der Pumpe gleichzeitig; Blutpulse laufen im Pumptakt
//  von der Pumpe nach außen.
//
//  Überarbeitung v1441 (Al 25.9.: „deine haben ein anderes Level"):
//  dieselbe Szene, aber mit Tiefe und Material. Unter der Gewölbedecke
//  läuft ein Sammelrohr mit Schellen, Flanschen und Messing-Schaugläsern
//  (darin laufen die Pulse), von dem je ein Fallrohr mit Handrad in die
//  genietete Eisenhaube jedes Tanks führt. Tanks: Glaszylinder mit Rand-
//  schatten, Glanzstreifen, Messskala und Blutfilm unter der Haube,
//  Bodenring mit Ablasshahn, heller Steinsockel mit übergelaufenem Blut.
//  Zwischen den Tanks schmale Eisensäulen mit Laternen; das Verbindungs-
//  rohr mit den rot-weißen Manschetten (Kartenmotiv) läuft durch ein
//  Ventil mit rotem Hebel. Im Blut Schädel, Knochen, ein Brustkorb, eine
//  Hand — je tiefer, desto trüber; oben treiben ein Schädel und ein
//  Knochen. Das Pumpwerk: genieteter Kessel mit großem Schauglas, Mano-
//  meter, Kolben, Schwungrad, Feuerrost, Sicherheitsventil, Steigrohr ins
//  Sammelrohr. Boden aus Steinplatten mit Blutlachen, Abflussgittern,
//  Knochen und einem Eimer unter dem tropfenden Ventil.
//
//  Ebenen (Kunsthöhe 100; Generator gen/shared-blood-tanks.py im
//  Scratchpad): tile.png — Kachel 128 (zwei verschiedene Tanks, zwei
//  Säulen); blood.png (3 Wellenbilder, Kachel 128×300) hinter
//  mask-tank.png; flow.png (16×100) hinter mask-flow.png (Schaugläser);
//  tile-front.png (Glas vor dem Blut); tile-glow.png (Laternenschein);
//  pump.png (72, mittig); sight.png (Blutsäule im Schauglas);
//  flywheel.png (3 Bilder 17×17), piston.png (3×9), gauge.png (4 Bilder
//  5×5), fire.png (3 Bilder 13×5), flame.png (3 Bilder 3×3), steam.png
//  (3 Bilder 7×7), rat.png (2 Bilder 9×4), ripple.png (3 Bilder 5×2).
//
//  Animiert: Blutspiegel (alle Tanks + Schauglas, ganzzahlig im Sinus-
//  takt), Wellen, aufsteigende Blasen, Pulse im Sammelrohr (von der Mitte
//  nach außen, im Kolbentakt), Kolben, Schwungrad, Manometerzeiger,
//  Glut im Feuerrost, Dampf aus dem Sicherheitsventil, flackernde
//  Laternen, Tropfen aus den Ventilen mit Aufschlag, Tropfen vom
//  Sammelrohr, gelegentlich eine Ratte.
//  Tier `opaque`: die Szene ist ein ganzer Raum. Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const SBT = '/areas/shared-blood-tanks/';
const SBT_PUMP_W = 72;
const SBT_LEVEL_S = 8;            // ein Heben und Senken des Blutspiegels
const SBT_PULS_S = 1.2;           // Pumptakt (Kolben + Rohrpulse)
const SBT_SPIEGEL = 3;            // Hub des Blutspiegels (Kunstpixel, ±)
// Blutspiegel als ganzzahlige Stufen einer Sinuskurve (langsam an den Wenden)
const SBT_SPIEGEL_KF = Array.from({ length: 25 }, (_, i) =>
  `${(i / 24 * 100).toFixed(2)}% { transform: translateY(calc(${Math.round(-SBT_SPIEGEL * Math.cos(i / 24 * 2 * Math.PI))} * var(--px))); }`).join(' ');

const SharedBloodTanksOverlay = React.memo(function SharedBloodTanksOverlay() {
  // Blasen: Tanks bei 64·k neben der Brettmitte (k = 0 steht hinter der Pumpe)
  const blasen = useMemo(() => {
    const tanks = [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5];
    return ppZufall(ppFxN(24), (i) => ({
      x: tanks[i % tanks.length] * 64 - 17 + Math.floor(Math.random() * 35),
      dur: 3 + Math.random() * 3, delay: -Math.random() * 6, gross: Math.random() < .3,
    }));
  }, []);
  // Tropfen aus den Ventilen an den Säulen (Säulen bei 32 + 64·k) und vom Sammelrohr
  const tropfen = useMemo(() => [
    { x: 32, y0: 47, y1: 86, dur: 3.6 }, { x: -32, y0: 47, y1: 85, dur: 4.3 },
    { x: 96, y0: 47, y1: 86, dur: 5.1 }, { x: -96, y0: 47, y1: 85, dur: 3.9 },
    { x: 160, y0: 47, y1: 86, dur: 4.7 }, { x: -160, y0: 47, y1: 85, dur: 5.5 },
    { x: -37, y0: 10, y1: 37, dur: 6.2 }, { x: 37, y0: 10, y1: 37, dur: 5.8 }, { x: 91, y0: 10, y1: 37, dur: 6.8 },
  ].slice(0, ppFxN(9)).map(d => ({ ...d, delay: -Math.random() * d.dur })), []);
  const laternen = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    x: 32 + 64 * (i - 6), dur: 1.6 + Math.random() * 1.4, delay: -Math.random() * 3,
  })), []);
  const ratten = useMemo(() => ppZufall(ppFxN(2), (i) => ({
    y: 94 + i * 3, dur: 26 + Math.random() * 12, delay: -Math.random() * 30, rtl: i % 2 === 1,
  })), []);
  const dampf = useMemo(() => ppZufall(ppFxN(3), (i) => ({ dur: 3.2, delay: -i * 1.07 })), []);
  return (
    <PixelScene artH={100} bg="#120d0d" className="shared-blood-tanks-overlay">
      <PixelBand src={SBT + 'tile.png'} />
      {/* Blut in den Tanks: Maske = Glasinneres, darin hebt/senkt sich die Blutebene */}
      <div className="pp-pixel-layer" style={{ position: 'absolute', inset: 0, ...ppMaske(SBT + 'mask-tank.png', true) }}>
        <div className="sbt-spiegel">
          <PixelBand src={SBT + 'blood.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 .9s steps(1) infinite' }} />
        </div>
        {blasen.map((b, i) => (
          <i key={'b' + i} className={'pp-area-dyn sbt-blase' + (b.gross ? ' gross' : '')} style={{
            left: ppArtX(b.x, 0), top: ppArt(59),
            animation: `sbtBlase ${b.dur.toFixed(2)}s steps(22) ${b.delay.toFixed(2)}s infinite`,
          }} />
        ))}
      </div>
      {/* Pulse im Sammelrohr: links nach links, rechts nach rechts */}
      <div className="pp-pixel-layer sbt-puls links" style={ppMaske(SBT + 'mask-flow.png', true)} />
      <div className="pp-pixel-layer sbt-puls rechts" style={ppMaske(SBT + 'mask-flow.png', true)} />
      <PixelBand src={SBT + 'tile-front.png'} />
      {/* hinter dem Pumpwerk: Kolbenstange und Glut */}
      <i className="sbt-kolben" style={{ left: ppArtX(19, SBT_PUMP_W), top: ppArt(4) }} />
      <i className="sbt-glut" style={{ left: ppArtX(30, SBT_PUMP_W), top: ppArt(52) }} />
      <PixelPiece src={SBT + 'pump.png'} w={SBT_PUMP_W} />
      <div className="sbt-sicht" style={{ left: ppArtX(32, SBT_PUMP_W), top: ppArt(26) }}>
        <i className="sbt-sicht-blut" />
      </div>
      <i className="sbt-mano" style={{ left: ppArtX(47, SBT_PUMP_W), top: ppArt(27) }} />
      <i className="sbt-rad" style={{ left: ppArtX(0, SBT_PUMP_W), top: ppArt(46) }} />
      {dampf.map((d, i) => (
        <i key={'s' + i} className="pp-area-dyn sbt-dampf" style={{
          left: ppArtX(46, SBT_PUMP_W), top: ppArt(3),
          animation: `sbtDampf ${d.dur}s steps(12) ${d.delay.toFixed(2)}s infinite, sbtDampfBild ${d.dur}s steps(1) ${d.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {laternen.map((l, i) => (
        <i key={'l' + i} className="sbt-flamme" style={{
          left: ppArtX(l.x - 1, 0), top: ppArt(22),
          animation: `ppSprite3 ${(l.dur / 3).toFixed(2)}s steps(1) ${l.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      <PixelBand src={SBT + 'tile-glow.png'} className="sbt-schein" />
      {tropfen.map((d, i) => (
        <React.Fragment key={'d' + i}>
          <i className="pp-area-dyn pp-px-tropfen" style={{
            left: ppArtX(d.x, 0), top: ppArt(d.y0), '--fall': ppArt(d.y1 - d.y0),
            '--tropfen': '#9a1614', '--tropfen-dunkel': '#4a0607',
            animation: `ppPxTropfen ${d.dur}s ease-in ${d.delay.toFixed(2)}s infinite`,
          }} />
          <i className="pp-area-dyn sbt-kraeusel" style={{
            left: ppArtX(d.x - 2, 0), top: ppArt(d.y1 + 1),
            animation: `sbtKraeusel ${d.dur}s steps(1) ${d.delay.toFixed(2)}s infinite`,
          }} />
        </React.Fragment>
      ))}
      {ratten.map((r, i) => (
        <div key={'r' + i} className="pp-area-dyn sbt-ratte-bahn" style={{
          top: ppArt(r.y), animation: `${r.rtl ? 'sbtRatteRtl' : 'sbtRatteLtr'} ${r.dur.toFixed(1)}s linear ${r.delay.toFixed(1)}s infinite`,
        }}>
          <i className="sbt-ratte" style={{ transform: r.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .sbt-spiegel { position: absolute; inset: 0; animation: sbtSpiegel ${SBT_LEVEL_S}s steps(1) infinite; }
        @keyframes sbtSpiegel { ${SBT_SPIEGEL_KF} }
        .sbt-blase { position: absolute; width: var(--px); height: var(--px); background: #d0564a; opacity: 0; }
        .sbt-blase.gross { box-shadow: var(--px) 0 0 #a8302a, 0 var(--px) 0 #a8302a, var(--px) var(--px) 0 #7c1a18; background: #e27a6c; }
        @keyframes sbtBlase {
          0% { transform: translate(0, 0); opacity: 0; }
          8% { opacity: .9; }
          40% { transform: translate(var(--px), calc(-9 * var(--px))); }
          70% { transform: translate(0, calc(-16 * var(--px))); opacity: .9; }
          100% { transform: translate(var(--px), calc(-22 * var(--px))); opacity: 0; }
        }
        .sbt-puls {
          position: absolute; inset: 0;
          background: url(${SBT}flow.png) 0 0 / calc(16 * var(--px)) 100% repeat-x;
          animation: sbtPulsL ${SBT_PULS_S}s steps(16) infinite;
        }
        /* rechte Hälfte = gespiegelte linke (die Schaugläser liegen symmetrisch zur Mitte) */
        .sbt-puls { clip-path: inset(0 50% 0 0); }
        .sbt-puls.rechts { transform: scaleX(-1); }
        @keyframes sbtPulsL { from { background-position: 0 0; } to { background-position: calc(-16 * var(--px)) 0; } }
        .sbt-kolben {
          position: absolute; width: calc(3 * var(--px)); height: calc(9 * var(--px));
          background: url(${SBT}piston.png) 0 0 / 100% 100% no-repeat;
          animation: sbtKolben ${SBT_PULS_S}s steps(1) infinite;
        }
        @keyframes sbtKolben {
          0% { transform: translateY(0); } 20% { transform: translateY(calc(-1 * var(--px))); }
          35% { transform: translateY(calc(-2 * var(--px))); } 50% { transform: translateY(calc(-3 * var(--px))); }
          65% { transform: translateY(calc(-2 * var(--px))); } 80% { transform: translateY(calc(-1 * var(--px))); }
        }
        .sbt-glut {
          position: absolute; width: calc(13 * var(--px)); height: calc(5 * var(--px));
          background: url(${SBT}fire.png) 0 0 / 300% 100% no-repeat;
          animation: ppSprite3 .5s steps(1) infinite;
        }
        .sbt-sicht { position: absolute; width: calc(9 * var(--px)); height: calc(21 * var(--px)); overflow: hidden; }
        .sbt-sicht-blut {
          position: absolute; left: 0; top: calc(3 * var(--px)); width: 100%; height: calc(44 * var(--px));
          background: url(${SBT}sight.png) 0 0 / 100% 100% no-repeat;
          animation: sbtSpiegel ${SBT_LEVEL_S}s steps(1) infinite;
        }
        .sbt-mano {
          position: absolute; width: calc(5 * var(--px)); height: calc(5 * var(--px));
          background: url(${SBT}gauge.png) 0 0 / 400% 100% no-repeat;
          animation: sbtMano 2.4s steps(1) infinite;
        }
        @keyframes sbtMano {
          0% { background-position: 33.33% 0; } 18% { background-position: 66.67% 0; } 26% { background-position: 33.33% 0; }
          45% { background-position: 66.67% 0; } 52% { background-position: 100% 0; } 58% { background-position: 66.67% 0; }
          77% { background-position: 0 0; } 86% { background-position: 33.33% 0; }
        }
        .sbt-rad {
          position: absolute; width: calc(17 * var(--px)); height: calc(17 * var(--px));
          background: url(${SBT}flywheel.png) 0 0 / 300% 100% no-repeat;
          animation: ppSprite3 ${(SBT_PULS_S / 3).toFixed(2)}s steps(1) infinite;
        }
        .sbt-dampf {
          position: absolute; width: calc(7 * var(--px)); height: calc(7 * var(--px)); opacity: 0;
          background: url(${SBT}steam.png) 0 0 / 300% 100% no-repeat;
        }
        @keyframes sbtDampf {
          0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: .75; } 60% { opacity: .5; }
          100% { transform: translate(calc(4 * var(--px)), calc(-12 * var(--px))); opacity: 0; }
        }
        @keyframes sbtDampfBild { 0% { background-position: 0 0; } 30% { background-position: 50% 0; } 65% { background-position: 100% 0; } }
        .sbt-flamme {
          position: absolute; width: calc(3 * var(--px)); height: calc(3 * var(--px));
          background: url(${SBT}flame.png) 0 0 / 300% 100% no-repeat;
        }
        .sbt-schein { animation: sbtFlackern 3.1s steps(1) infinite; }
        @keyframes sbtFlackern {
          0% { opacity: .9; } 11% { opacity: .75; } 17% { opacity: 1; } 34% { opacity: .82; } 41% { opacity: .95; }
          58% { opacity: .7; } 63% { opacity: .9; } 79% { opacity: 1; } 88% { opacity: .8; }
        }
        .sbt-kraeusel {
          position: absolute; width: calc(5 * var(--px)); height: calc(2 * var(--px));
          background: url(${SBT}ripple.png) 0 0 / 300% 100% no-repeat; opacity: 0;
        }
        @keyframes sbtKraeusel {
          0%, 89% { opacity: 0; background-position: 0 0; }
          90% { opacity: 1; background-position: 0 0; } 94% { background-position: 50% 0; } 97% { background-position: 100% 0; }
          100% { opacity: 0; }
        }
        .sbt-ratte-bahn { position: absolute; left: 0; }
        .sbt-ratte {
          display: block; width: calc(9 * var(--px)); height: calc(4 * var(--px));
          background: url(${SBT}rat.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .18s steps(1) infinite;
        }
        @keyframes sbtRatteLtr {
          0% { transform: translateX(calc(-20 * var(--px))); }
          30% { transform: translateX(calc(100cqw + 10 * var(--px))); }
          30.01%, 100% { transform: translateX(calc(100cqw + 10 * var(--px))); }
        }
        @keyframes sbtRatteRtl {
          0% { transform: translateX(calc(100cqw + 10 * var(--px))); }
          30% { transform: translateX(calc(-20 * var(--px))); }
          30.01%, 100% { transform: translateX(calc(-20 * var(--px))); }
        }
      `}</style>
    </PixelScene>
  );
});


// ═══════════════════════════════════════════════════════════════════
//  ACID RAIN — Burghof im Säureregen (v1412, Kartenstil v1413,
//  Überarbeitung v1441 (Al 25.9.))
//
//  Vorlage: das Kartenmotiv (warme Ziegelmauer, gemeißelte Steinblöcke,
//  blauer Wassergraben, Pflasterplatz, dunkelroter Regen). „Säure wird
//  in diesem Spiel als DUNKELROT dargestellt" (Al 25.9.) — Regen,
//  Pfützen, Laufspuren und Strahlen sind dunkelrot, nichts davon leuchtet.
//  STIL (Al 25.9., nach den ersten drei Szenen): die Hintergründe sollen
//  wie Als eigene Kartenmotive aussehen, nicht wie „gemalte" Szenen —
//  grobe Pixel (Kunsthöhe 100 statt 200), Flächen als unregelmäßiges
//  Pixelrauschen statt geordnetem Dithering, schwarze Fugen und Konturen,
//  satte Farben, weiche Leuchtflecken, nur leichte Randabdunklung.
//
//  Die Szene: hinter den Zinnen ein dunkler Gewitterhimmel; eine warme
//  Ziegelmauer mit Wehrgang-Gesims, Schießscharten, Wasserspeiern (aus
//  deren Mäulern die Säure in den Graben schießt), toten Ranken, Moos und
//  dunkelroten Säure-Laufspuren; ein Steinsockel mit Algen an der
//  Wasserlinie. Im blauen Graben stehen gemeißelte Steinblöcke mit
//  Relieffiguren in einer Rundbogennische (sitzender König mit Krone und
//  Zepter, Ritter mit gesenktem Schwert), mit Säurespuren, Rissen und
//  Moos, gespiegelt im Wasser; dazu Steine, tote Binsen, Treibholz. In
//  der Mitte das Torhaus aus Quadern (eigene Zinnen, Wappenschild mit
//  Goldkrone, Rundbogen mit Schlussstein, halb hochgezogenes Fallgitter
//  vor dem beschlagenen Eichentor, zwei Wandlaternen, zerfressene blaue
//  Banner), davor Stufen und der gepflasterte Hof mit Randsteinen,
//  Säurepfützen, Gully, Fässern, Kisten, umgekipptem Eimer, rostigem
//  Helm, Speer, Schutt und Unkraut.
//
//  Ebenen (Kunsthöhe 100; Generator liegt nicht im Projekt):
//  sky.png — Gewitterhimmel (Kachel 128×12, zieht); tile.png — Kachel
//  128 (Mauer, Graben, Steinblöcke); court.png — Torhaus + Hof, Stück
//  224, mittig; glint.png — Lichtkräusel auf dem Wasser (3 Bilder
//  übereinander); mist.png — Säuredunst über dem Graben; rain-far/
//  -near.png — Regen-Kacheln 64×100 (nahtlos in x und y); bolt.png (2,
//  Querblitz 28×8 im Himmelsstreifen),
//  banner.png (3), spout.png (3), foam.png (3), splash.png (4),
//  ring.png (4), bubble.png (4), steam.png (4).
//
//  Animiert: Regen in zwei Tiefen, Aufschläge auf dem Pflaster, Ringe
//  auf dem Wasser, Säurestrahlen aus den Wasserspeiern mit Gischt,
//  Pfützen blubbern und dampfen, Wolken ziehen, Blitze hinter den Zinnen
//  mit Aufhellung, Banner wehen, Laternen flackern, Wasser kräuselt,
//  Dunst treibt über den Graben.
//
//  Tier `opaque` (vorher `partial`): Al 25.9., die Area soll ein
//  kompletter Hintergrund werden. Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const AR = '/areas/acid-rain/';
const AR_W = 224;                                   // Hofstück; Stück-x 112 = Brettmitte
// Wasserspeier (Kunstpixel neben der Brettmitte; Kachel 128 → alle 64 im Wechsel,
// die inneren ±32 verdeckt das Torhaus). Mund bei y 42, Wasser bei y 54.
const AR_SPEIER = [-224, -160, -96, 96, 160, 224];
// Säurepfützen auf dem Hof (x neben der Mitte, y, halbe Breite) — aus dem Generator
const AR_PFUETZEN = [[-18, 66, 4], [22, 72, 6], [-44, 84, 7], [48, 88, 8], [-4, 94, 6], [-80, 95, 7], [78, 95, 7]];
const AR_LATERNEN = [93.5, 132.5];                  // Glasmitte (Stück-x), y 34
const AR_BANNER = [81, 135];                        // linke Kante (Stück-x), hängt ab y 8
// halbe Hofbreite je Zeile (wie im Generator)
const arHofHalb = (y) => 36 + (y - 56) * (72 / 44);

const AcidRainOverlay = React.memo(function AcidRainOverlay() {
  const spritzer = useMemo(() => ppZufall(ppFxN(16), () => {
    const y = 60 + Math.random() * 38;
    const hw = arHofHalb(y) - 4;
    return { x: (Math.random() * 2 - 1) * hw, y, dur: 0.8 + Math.random() * 1.3, delay: -Math.random() * 2 };
  }), []);
  const ringe = useMemo(() => ppZufall(ppFxN(16), () => {
    const y = 57 + Math.random() * 41;
    const rand = arHofHalb(y) + 5;
    const x = (Math.random() < 0.5 ? -1 : 1) * (rand + Math.random() * (200 - rand));
    return { x, y, dur: 1.1 + Math.random() * 1.4, delay: -Math.random() * 2.5 };
  }), []);
  const dampf = useMemo(() => AR_PFUETZEN.slice(0, ppFxN(AR_PFUETZEN.length)).map(([x, y, w]) => ({
    x: x + (Math.random() * 2 - 1) * (w - 2), y, dur: 2.6 + Math.random() * 1.8, delay: -Math.random() * 4,
  })), []);
  const blasen = useMemo(() => AR_PFUETZEN.slice(0, ppFxN(AR_PFUETZEN.length)).map(([x, y, w]) => ({
    x: x + (Math.random() * 2 - 1) * (w - 2), y, dur: 1.2 + Math.random() * 1.2, delay: -Math.random() * 2,
  })), []);
  const speier = useMemo(() => AR_SPEIER.slice(0, ppFxN(AR_SPEIER.length)).map(() => ({
    dur: 0.3 + Math.random() * 0.12,
  })), []);
  return (
    <PixelScene artH={100} bg="#1e0e12" className="acid-rain-overlay">
      <div className="pp-pixel-layer ar-wolken" />
      <div className="pp-area-dyn ar-himmelblitz" />
      <i className="pp-area-dyn ar-blitz" style={{ left: ppArtX(-74, 0), top: 0, animation: 'arBlitz 13s steps(1) -4s infinite, arBlitzForm 13s steps(1) -4s infinite' }} />
      <i className="pp-area-dyn ar-blitz" style={{ left: ppArtX(58, 0), top: 0, animation: 'arBlitzFern 17s steps(1) -11s infinite', backgroundPosition: '100% 0' }} />
      <PixelBand src={AR + 'tile.png'} />
      <PixelBand src={AR + 'glint.png'} className="ar-glitzer" style={{ backgroundSize: 'auto 300%' }} />
      {AR_SPEIER.slice(0, speier.length).map((x, i) => (
        <React.Fragment key={'s' + i}>
          <i className="pp-area-dyn ar-strahl" style={{ left: ppArtX(x - 1, 0), top: ppArt(43), animationDuration: `${speier[i].dur.toFixed(2)}s` }} />
          <i className="pp-area-dyn ar-gischt" style={{ left: ppArtX(x - 3, 0), top: ppArt(54), animationDuration: `${(speier[i].dur * 1.3).toFixed(2)}s` }} />
        </React.Fragment>
      ))}
      <div className="pp-pixel-layer ar-dunst" style={{ top: ppArt(47) }} />
      <PixelPiece src={AR + 'court.png'} w={AR_W} />
      {AR_LATERNEN.map((x, i) => (
        <i key={'l' + i} className="ar-schein" style={{ left: ppArtX(x - 7, AR_W), top: ppArt(27), animationDelay: `${-i * .9}s` }} />
      ))}
      {AR_BANNER.map((x, i) => (
        <i key={'b' + i} className="ar-banner" style={{ left: ppArtX(x, AR_W), top: ppArt(8), animationDuration: `${1.1 + i * .17}s` }} />
      ))}
      {blasen.map((b, i) => (
        <i key={'bl' + i} className="pp-area-dyn ar-blase" style={{
          left: ppArtX(b.x - 1, 0), top: ppArt(b.y - 2),
          animation: `arBlase ${b.dur.toFixed(2)}s steps(1) ${b.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {dampf.map((d, i) => (
        <i key={'d' + i} className="pp-area-dyn ar-dampf" style={{
          left: ppArtX(d.x - 2, 0), top: ppArt(d.y - 8),
          animation: `ppSprite2 .5s steps(1) infinite, arDampf ${d.dur.toFixed(2)}s steps(6) ${d.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      <div className="pp-pixel-layer pp-area-dyn ar-regen fern" />
      {spritzer.map((s, i) => (
        <i key={'sp' + i} className="pp-area-dyn ar-spritzer" style={{
          left: ppArtX(s.x - 2, 0), top: ppArt(s.y - 2),
          animation: `arTreffer ${s.dur.toFixed(2)}s steps(1) ${s.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {ringe.map((r, i) => (
        <i key={'r' + i} className="pp-area-dyn ar-ring" style={{
          left: ppArtX(r.x - 3, 0), top: ppArt(r.y - 1),
          animation: `arTreffer ${r.dur.toFixed(2)}s steps(1) ${r.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      <div className="pp-pixel-layer pp-area-dyn ar-regen nah" />
      <div className="pp-area-dyn ar-blitzlicht" />
      <div className="pp-rand-dim" />
      <style>{`
        .ar-wolken {
          position: absolute; left: 0; right: 0; top: 0; height: calc(12 * var(--px));
          background: url(${AR}sky.png) 50% 0 / calc(128 * var(--px)) 100% repeat-x;
          animation: arWolken 90s steps(128) infinite;
        }
        @keyframes arWolken { from { background-position: 50% 0; } to { background-position: calc(50% - 128 * var(--px)) 0; } }
        /* Blitze zucken hinter den Zinnen: der Himmelsstreifen hellt auf, die Zinnen stehen als Scherenschnitt davor */
        .ar-himmelblitz {
          position: absolute; left: 0; right: 0; top: 0; height: calc(12 * var(--px)); background: #9c3a34; opacity: 0;
          animation: arBlitzLicht 13s steps(1) -4s infinite;
        }
        .ar-blitz {
          position: absolute; width: calc(28 * var(--px)); height: calc(8 * var(--px));
          background: url(${AR}bolt.png) 0 0 / 200% 100% no-repeat; opacity: 0;
        }
        @keyframes arBlitz {
          0%, 91% { opacity: 0; } 92% { opacity: 1; } 93% { opacity: 0; } 94.5% { opacity: 1; } 95.5%, 100% { opacity: 0; }
        }
        @keyframes arBlitzForm { 0%, 94% { background-position: 0 0; } 94.2%, 100% { background-position: 100% 0; } }
        @keyframes arBlitzFern { 0%, 95% { opacity: 0; } 95.6% { opacity: .75; } 96.4%, 100% { opacity: 0; } }
        .ar-blitzlicht {
          position: absolute; inset: 0; background: #ff6a54; mix-blend-mode: soft-light; opacity: 0;
          animation: arBlitzLicht 13s steps(1) -4s infinite;
        }
        @keyframes arBlitzLicht {
          0%, 91% { opacity: 0; } 92% { opacity: .5; } 93% { opacity: .1; } 94.5% { opacity: .4; } 95.5% { opacity: .12; } 96.5%, 100% { opacity: 0; }
        }
        /* Telefon-Lite: das bildschirmweite Mischebenen-Licht kostet dort Bildrate */
        @media (pointer: coarse) and (max-height: 600px) { .ar-blitzlicht { display: none; } }
        .ar-glitzer { animation: ppBand3 1.6s steps(1) infinite; }
        .ar-dunst {
          position: absolute; left: 0; right: 0; height: calc(16 * var(--px));
          background: url(${AR}mist.png) 0 0 / calc(128 * var(--px)) 100% repeat-x; opacity: .7;
          animation: arDunst 64s steps(128) infinite;
        }
        @keyframes arDunst { from { background-position: 0 0; } to { background-position: calc(-128 * var(--px)) 0; } }
        .ar-regen { position: absolute; inset: 0; background-size: calc(64 * var(--px)) calc(100 * var(--px)); background-repeat: repeat; }
        .ar-regen.fern { background-image: url(${AR}rain-far.png); animation: arRegenFern .8s steps(100) infinite; }
        .ar-regen.nah { background-image: url(${AR}rain-near.png); animation: arRegenNah 1.1s steps(200) infinite; }
        @keyframes arRegenFern { from { background-position: 0 0; } to { background-position: 0 calc(100 * var(--px)); } }
        @keyframes arRegenNah { from { background-position: 0 0; } to { background-position: 0 calc(200 * var(--px)); } }
        .ar-strahl {
          position: absolute; width: calc(3 * var(--px)); height: calc(12 * var(--px));
          background: url(${AR}spout.png) 0 0 / 300% 100% no-repeat; animation: ppSprite3 .33s steps(1) infinite;
        }
        .ar-gischt {
          position: absolute; width: calc(7 * var(--px)); height: calc(3 * var(--px));
          background: url(${AR}foam.png) 0 0 / 300% 100% no-repeat; animation: ppSprite3 .42s steps(1) infinite;
        }
        .ar-schein {
          position: absolute; width: calc(14 * var(--px)); height: calc(14 * var(--px)); border-radius: 50%;
          background: radial-gradient(circle, rgba(255,190,90,.34) 0%, rgba(255,150,60,.14) 45%, rgba(255,150,60,0) 70%);
          animation: arSchein 1.7s steps(1) infinite;
        }
        @keyframes arSchein { 0% { opacity: .85; } 18% { opacity: 1; } 31% { opacity: .7; } 52% { opacity: .95; } 71% { opacity: .78; } 86% { opacity: 1; } }
        .ar-banner {
          position: absolute; width: calc(8 * var(--px)); height: calc(17 * var(--px));
          background: url(${AR}banner.png) 0 0 / 300% 100% no-repeat; animation: ppSprite3 1.2s steps(1) infinite;
        }
        .ar-blase { position: absolute; width: calc(3 * var(--px)); height: calc(3 * var(--px)); background: url(${AR}bubble.png) 0 0 / 400% 100% no-repeat; }
        @keyframes arBlase {
          0%, 55% { background-position: 0 0; opacity: 0; } 56% { opacity: 1; background-position: 0 0; }
          68% { background-position: 33.33% 0; } 80% { background-position: 66.66% 0; } 90% { background-position: 100% 0; } 97%, 100% { opacity: 0; }
        }
        .ar-dampf { position: absolute; width: calc(5 * var(--px)); height: calc(8 * var(--px)); background: url(${AR}steam.png) 0 0 / 400% 100% no-repeat; }
        @keyframes arDampf {
          0% { transform: translateY(0); opacity: 0; } 15% { opacity: .9; } 60% { opacity: .6; }
          100% { transform: translateY(calc(-6 * var(--px))); opacity: 0; }
        }
        .ar-spritzer { position: absolute; width: calc(5 * var(--px)); height: calc(3 * var(--px)); background: url(${AR}splash.png) 0 0 / 400% 100% no-repeat; opacity: 0; }
        .ar-ring { position: absolute; width: calc(7 * var(--px)); height: calc(3 * var(--px)); background: url(${AR}ring.png) 0 0 / 400% 100% no-repeat; opacity: 0; }
        @keyframes arTreffer {
          0% { opacity: 1; background-position: 0 0; } 9% { background-position: 33.33% 0; }
          18% { background-position: 66.66% 0; } 28% { background-position: 100% 0; } 38%, 100% { opacity: 0; }
        }
      `}</style>
    </PixelScene>
  );
});


// ═══════════════════════════════════════════════════════════════════
//  ZEHN AREAS IM KARTENSTIL (v1415, Al 25.9.) — nach Als Kartenmotiven:
//  Cottage at the Forest's Edge, Crystal Well, Dark Ocean, Deepsea
//  Castle, Doom Clock, Graveyard of Limited Power, Paraseed Greenhouse,
//  Rioting Village, Slippery Ice, Smuggler's Pier. Alle Kunsthoehe 100,
//  alle `opaque` (ganze Szenen). Kunst per Generator gemalt, der nicht im
//  Projekt liegt; Bilder unter public/areas/<slug>/.
// ═══════════════════════════════════════════════════════════════════

/** Kleine Helfer fuer die wiederkehrenden Bewegungen dieser Szenen. */
const ppQuer = (y, dur, delay, rtl) => ({
  top: ppArt(y), animation: `${rtl ? 'ppQuerRtl' : 'ppQuerLtr'} ${dur}s linear ${delay}s infinite`,
});
const ppZufall = (n, f) => Array.from({ length: n }, (_, i) => f(i));

// ═══════════════════════════════════════════════════════════════════
//  COTTAGE AT THE FOREST'S EDGE (v1415, Kartenstil; Überarbeitung v1441
//  (Al 25.9.))
//
//  Karte: Blockhütte mit Tür, Fenstern, Efeu, Pfad, Wegweiser, Zaun.
//  Ruhig (Als früherer Wunsch): wiegende Efeublätter, Schmetterlinge,
//  einzelne fallende Blätter.
//  v1437 (Al 25.9.: „Detailgrad deutlich zu klein"): Dachtraufe mit
//  Nägeln, Blockbohlen mit Lichtkante, Maserung und Ästen, zwei Fenster
//  mit Sprossen, Vorhängen und warmem Innenlicht (eines mit Blumenkasten,
//  eines mit grünen Läden), Kräuterbündel, Hufeisen, Steinsockel, Wiese
//  mit Wildblumen, Steinen, Pilzen und Farnen, Efeu mit größeren
//  Blättern; Tür mit Beschlägen und Sturz, Stufe, Fußmatte, Laterne,
//  Schild mit Schnitzzeilen (keine Schrift), Holzstapel, Hackklotz mit
//  Axt, Zaun, Pfad mit Trittsteinen, Rotkehlchen auf dem Schild.
//
//  Überarbeitung v1441 (Al 25.9.): auf das Niveau der v1440-Szenen. Die
//  Hütte ist jetzt EIN Versatzstück (184 breit) mit Tiefe statt einer
//  endlosen Wand: bemoostes Schindeldach mit First und Ortgang, Stein-
//  schornstein, runde Blockbohlen mit Eckköpfen (Stirnholz mit Jahres-
//  ringen und Rissen), Feldsteinsockel. An den Seiten und hinter dem
//  Dach der WALDRAND in drei Tiefen (ferne dunstige Baumreihen im
//  Abendlicht, mittlere Stämme, nahe Bäume mit Borke, Wurzeln und Moos),
//  Unterholz mit Farnen, ein Staketenzaun an der Hauskante, davor die
//  Wiese. Abendstimmung: warmes Fenster- und Laternenlicht, schräge
//  Lichtbahnen durchs Laub. Schatten von Schild, Tonne, Traufe und Haus
//  fallen nach links unten.
//
//  Ebenen (Kunsthöhe 100; Generator liegt nicht im Projekt): far.png —
//  Kachel 96 (Abendhimmel, ferne Baumreihen, Bodendunst); tile.png —
//  Kachel 128 (Bäume, Unterholz, Zaun, Wiese mit Blumen, Steinen,
//  Pilzen, Klee); canopy.png — Laubkronen, 3 Bilder; shafts.png —
//  Lichtbahnen; grass.png — hohe Vordergrund-Halme mit Blüten, 3 Bilder;
//  cottage.png — die Hütte (Stück 184): Tür mit Füllungen, Beschlägen,
//  Knauf und Sturz, Stufe mit Matte, Hufeisen, zwei Fenster mit Kerze/
//  Krug und roten Vorhängen (links grüne Läden mit Herz, rechts Blumen-
//  kasten), Kräuterbündel, Laterne, Topfgeranie, Holzstapel, Regentonne,
//  Wegweiser, Hackklotz mit Axt, Pfad mit Trittsteinen; ivy.png — Efeu,
//  3 Bilder; glow.png / lantern-glow.png — Lichtschein; Sprites:
//  smoke.png (5), cat.png (4), robin.png (4), rabbit.png (4),
//  butterfly.png (2), leaf.png (3).
//
//  Animiert: Laub und Efeu wiegen, hohe Halme im Wind, Lichtbahnen
//  atmen, Rauch aus dem Schornstein zieht nach links, Fenster- und
//  Laternenlicht flackern, eine Katze auf der Fensterbank (Schwanz,
//  Blinzeln, Ohr), das Rotkehlchen auf dem Wegweiser, ein Hase in der
//  Wiese, Glühwürmchen am Waldrand, Schmetterlinge, fallende Blätter.
//  Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const COT = '/areas/cottage/';
const COT_W = 184;                         // Hüttenstück; Stück-x 92 = Brettmitte
const COT_KAMIN = [143, 6];                // Schornsteinmündung (Stück-x, y)
const CottageOverlay = React.memo(function CottageOverlay() {
  const falter = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    y: 40 + Math.random() * 46, dur: 22 + Math.random() * 14, delay: -Math.random() * 30,
    bob: 2 + Math.random() * 3, rtl: i % 2 === 1, farbe: i === 1 ? 'hue-rotate(160deg) saturate(.6) brightness(1.3)' : undefined,
  })), []);
  const blaetter = useMemo(() => ppZufall(ppFxN(6), () => ({
    x: Math.random() * 100, dur: 9 + Math.random() * 7, delay: -Math.random() * 14,
  })), []);
  // Glühwürmchen am Waldrand links und rechts der Hütte (und ein paar vorn in der Wiese)
  const gluehw = useMemo(() => ppZufall(ppFxN(14), (i) => {
    const seite = i % 2 ? 1 : -1;
    const vorn = i >= 10;
    return {
      x: vorn ? (Math.random() - .5) * 170 : seite * (96 + Math.random() * 90),
      y: vorn ? 74 + Math.random() * 20 : 34 + Math.random() * 36,
      dur: 2.4 + Math.random() * 2.6, delay: -Math.random() * 5,
      wdur: 6 + Math.random() * 6, wdelay: -Math.random() * 10,
    };
  }), []);
  const rauch = useMemo(() => ppZufall(ppFxN(4), (i) => ({ delay: -i * 1.6 })), []);
  return (
    <PixelScene artH={100} bg="#2e3c24" className="cottage-overlay">
      <PixelBand src={COT + 'far.png'} />
      <PixelBand src={COT + 'tile.png'} />
      <PixelBand src={COT + 'shafts.png'} className="cot-strahlen" />
      <PixelBand src={COT + 'canopy.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 3.3s steps(1) infinite' }} />
      {gluehw.map((g, i) => (
        <i key={'g' + i} className="pp-area-dyn cot-gluehw" style={{
          left: ppArtX(g.x, 0), top: ppArt(g.y),
          animation: `cotGlueh ${g.dur.toFixed(2)}s steps(1) ${g.delay.toFixed(2)}s infinite, cotSchweb ${g.wdur.toFixed(2)}s steps(6) ${g.wdelay.toFixed(2)}s infinite alternate`,
        }} />
      ))}
      <PixelBand src={COT + 'grass.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 2.1s steps(1) infinite' }} />
      {rauch.map((r, i) => (
        <i key={'r' + i} className="pp-area-dyn cot-rauch" style={{
          left: ppArtX(COT_KAMIN[0] - 3.5, COT_W), top: ppArt(COT_KAMIN[1] - 6), animationDelay: `${r.delay}s`,
        }} />
      ))}
      <PixelPiece src={COT + 'cottage.png'} w={COT_W} />
      <PixelPiece src={COT + 'ivy.png'} w={COT_W} style={{ backgroundSize: '100% 300%', animation: 'ppBand3 2.6s steps(1) infinite' }} />
      <PixelPiece src={COT + 'glow.png'} w={COT_W} className="cot-licht" />
      <PixelPiece src={COT + 'lantern-glow.png'} w={COT_W} className="cot-laterne" />
      <i className="cot-katze" style={{ left: ppArtX(37, COT_W), top: ppArt(46) }} />
      <i className="cot-vogel" style={{ left: ppArtX(108, COT_W), top: ppArt(33) }} />
      <i className="cot-hase" style={{ left: ppArtX(30, COT_W), top: ppArt(80) }} />
      {blaetter.map((b, i) => (
        <i key={'l' + i} className="pp-area-dyn cot-blatt" style={{ left: b.x + '%', animation: `cotFall ${b.dur.toFixed(2)}s linear ${b.delay.toFixed(2)}s infinite, ppSprite3 .9s steps(1) infinite` }} />
      ))}
      {falter.map((f, i) => (
        <div key={'f' + i} className="pp-area-dyn pp-quer" style={ppQuer(f.y, f.dur, f.delay, f.rtl)}>
          <i className="cot-falter" style={{ '--bob': ppArt(f.bob), transform: f.rtl ? 'scaleX(-1)' : undefined, filter: f.farbe }} />
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .cot-strahlen { animation: cotStrahl 7s steps(1) infinite; }
        @keyframes cotStrahl { 0% { opacity: .7; } 20% { opacity: .85; } 40% { opacity: 1; } 60% { opacity: .9; } 80% { opacity: .75; } }
        .cot-licht { animation: cotLicht 3.1s steps(1) infinite; }
        @keyframes cotLicht { 0% { opacity: .85; } 18% { opacity: 1; } 36% { opacity: .78; } 44% { opacity: .95; } 70% { opacity: .82; } 84% { opacity: 1; } }
        .cot-laterne { animation: cotLaterne 1.7s steps(1) infinite; }
        @keyframes cotLaterne { 0% { opacity: 1; } 23% { opacity: .75; } 27% { opacity: 1; } 61% { opacity: .85; } 64% { opacity: .65; } 68% { opacity: 1; } }
        .cot-rauch {
          position: absolute; width: calc(7 * var(--px)); height: calc(7 * var(--px)); opacity: 0;
          background: url(${COT}smoke.png) 0 0 / 500% 100% no-repeat;
          animation: cotRauch 6.4s steps(1) infinite, cotRauchZug 6.4s steps(26) infinite;
        }
        @keyframes cotRauch {
          0% { background-position: 0 0; opacity: .95; } 20% { background-position: 25% 0; }
          40% { background-position: 50% 0; opacity: .85; } 60% { background-position: 75% 0; opacity: .7; }
          80% { background-position: 100% 0; opacity: .45; } 100% { background-position: 100% 0; opacity: 0; }
        }
        @keyframes cotRauchZug { from { transform: translate(0, 0); } to { transform: translate(calc(-26 * var(--px)), calc(-7 * var(--px))); } }
        .cot-gluehw {
          position: absolute; width: var(--px); height: var(--px); background: #f4ff9a; opacity: 0;
          box-shadow: 0 0 calc(2 * var(--px)) calc(.5 * var(--px)) rgba(220, 255, 120, .55);
        }
        @keyframes cotGlueh { 0%, 45% { opacity: 0; } 50% { opacity: .6; } 56%, 74% { opacity: 1; } 80% { opacity: .5; } 85%, 100% { opacity: 0; } }
        @keyframes cotSchweb { from { translate: 0 0; } to { translate: calc(4 * var(--px)) calc(-3 * var(--px)); } }
        .cot-katze { position: absolute; width: calc(9 * var(--px)); height: calc(10 * var(--px)); background: url(${COT}cat.png) 0 0 / 400% 100% no-repeat; animation: cotKatze 7.3s steps(1) infinite; }
        @keyframes cotKatze {
          0% { background-position: 0 0; } 18% { background-position: 33.33% 0; } 24% { background-position: 0 0; }
          30% { background-position: 33.33% 0; } 36% { background-position: 0 0; } 55% { background-position: 66.67% 0; }
          57% { background-position: 0 0; } 78% { background-position: 100% 0; } 82% { background-position: 0 0; }
          90% { background-position: 66.67% 0; } 92%, 100% { background-position: 0 0; }
        }
        .cot-vogel { position: absolute; width: calc(9 * var(--px)); height: calc(8 * var(--px)); background: url(${COT}robin.png) 0 0 / 400% 100% no-repeat; animation: cotVogel 4.6s steps(1) infinite; }
        @keyframes cotVogel {
          0%, 30% { background-position: 0 0; } 34%, 44% { background-position: 33.33% 0; } 48% { background-position: 0 0; }
          56% { background-position: 100% 0; } 60% { background-position: 0 0; } 64% { background-position: 100% 0; }
          68% { background-position: 0 0; } 80%, 88% { background-position: 66.67% 0; } 92%, 100% { background-position: 0 0; }
        }
        .cot-hase { position: absolute; width: calc(11 * var(--px)); height: calc(10 * var(--px)); background: url(${COT}rabbit.png) 0 0 / 400% 100% no-repeat; animation: cotHase 5.9s steps(1) infinite; }
        @keyframes cotHase {
          0% { background-position: 0 0; } 14% { background-position: 100% 0; } 16% { background-position: 0 0; }
          18% { background-position: 100% 0; } 20% { background-position: 0 0; } 40% { background-position: 33.33% 0; }
          46% { background-position: 0 0; } 60%, 72% { background-position: 66.67% 0; } 74% { background-position: 0 0; }
          76%, 86% { background-position: 66.67% 0; } 88%, 100% { background-position: 0 0; }
        }
        .cot-falter {
          display: block; width: calc(5 * var(--px)); height: calc(4 * var(--px));
          background: url(${COT}butterfly.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .26s steps(1) infinite, ppBob 1.3s ease-in-out infinite alternate;
        }
        .cot-blatt {
          position: absolute; top: 0; width: calc(3 * var(--px)); height: calc(3 * var(--px));
          background: url(${COT}leaf.png) 0 0 / 300% 100% no-repeat; opacity: 0;
        }
        @keyframes cotFall {
          0% { transform: translate(0, 0); opacity: 0; } 8% { opacity: 1; }
          25% { transform: translate(calc(4 * var(--px)), calc(20 * var(--px))); }
          50% { transform: translate(calc(-2 * var(--px)), calc(44 * var(--px))); }
          75% { transform: translate(calc(3 * var(--px)), calc(68 * var(--px))); }
          92% { opacity: 1; } 100% { transform: translate(0, calc(90 * var(--px))); opacity: 0; }
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  CRYSTAL WELL — Edelsteinbrunnen im magischen blauen Gras
//  (v1415, Brunnen v1418; Überarbeitung v1441 (Al 25.9.))
//
//  Karte: Brunnen mit einem Ring aus bunten Edelsteinen, ringsum
//  MAGISCHES BLAUES GRAS (kein Wasser — Al 25.9.), ein Erdweg, Funkeln.
//  Nachbesserung v1416–v1418 (Al 25.9.): Brunnen gross, mit Tiefe, wie
//  eine TROCKENMAUER aus groben Kristallbrocken. v1418 ist ein Neubau:
//  der Brunnen ist EIN Koerper (Zylinderring), dessen Steine in 3D
//  definiert und per Z-Puffer projiziert werden — Oberseite, Aussenwand
//  und Innenwand lesen dieselbe Geometrie, deshalb keine Naehte zwischen
//  Flaechen. Wellige Lagerfugen, schraege Stossfugen, abgerundete Ecken
//  mit dunklen Luecken, Beulen und holprige Oberkante. Konturen in
//  dunklen Toenen der jeweiligen Steinfarbe. Wasserspiegel tiefer als
//  der Rand, bewegt (Wellen, Ringe, Funkeln).
//
//  Überarbeitung v1441 (Al 25.9.: „deine haben ein anderes Level"): der
//  Brunnen bleibt (nur die Innenwand wird zum Wasser hin dunkler und
//  nass), neu gemalt sind Umgebung, Wasser und alles Lebendige. Die
//  Wiese ist jetzt echtes Gras — Rauschen aus Blautönen, darauf fächernde
//  Büschel mit hellen Spitzen, große helle und dunkle Wiesenflecken.
//  Hinten dunkle blaue Büsche und ein Zaunrest, dann der gewundene Erdweg
//  aus Erdklumpen mit Kieseln, Radspuren und Uferschatten unter der
//  Grasbank; im Gras bemooste Felsen, Kristalldrusen in den Farben des
//  Brunnens, Leuchtpilze und Leuchtblumen. Der Brunnen steht auf einem
//  Pflasterkranz (graue Steine wie auf der Karte, Gras in den Fugen) und
//  wirft seinen Schatten nach links unten; vorne wachsen Büschel über
//  den Kranz. Im Schacht liegt das Wasser tief: oben die Spiegelung der
//  bunten Innenwand, zur Mitte ein magisches Glühen aus der Tiefe.
//
//  Ebenen (Kunsthöhe 100; per Generator gemalt, der nicht im Projekt
//  liegt): tile.png — Kachel 128 (Wiese, Weg, Büsche, Zaun, Felsen,
//  Drusen, Pilze, Blumen); glow.png — Leuchthöfe der Drusen, Pilze und
//  Blumen (Kachel, pulsiert); sway-a.png / sway-b.png — hohe Halme in
//  drei Neigungen übereinander (wiegen versetzt im Wind); ground.png —
//  Pflasterkranz und Schlagschatten (150, mittig); water.png — Wasser-
//  spiegel, 4 Bilder übereinander (Lichtringe laufen nach außen, die
//  Spiegelung zittert, Glitzer); well.png — der Brunnen; caustics.png —
//  Lichtspiel des Wassers an der Innenwand (3 Bilder); front.png —
//  Grasbüschel vor dem Kranz; well-glow.png — magischer Schein über dem
//  Brunnenmund (atmet); ring.png — Wasserring (4 Bilder 21×7);
//  butterfly.png — blauer Falter (2 Bilder 7×5).
//
//  Animiert: Gras wiegt in zwei Gruppen, Leuchthöfe und Brunnenschein
//  atmen, Wasser wogt, Tropfenringe breiten sich aus, Lichtflecken
//  tanzen an der Innenwand, Funken steigen aus dem Schacht, Edelsteine
//  und Drusen funkeln, Glühwürmchen schweben über der Wiese, Falter
//  flattern vorbei. Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const CWL = '/areas/crystal-well/';
const CWL_W = 150;                          // Brunnen-Stueck; Rand-Mitte (75, 44), Wasser (75, 51)
// Kachel-x t (0..127) → Kunstpixel neben der Brettmitte, k-te Wiederholung
const cwlKachel = (t, k) => t - 64 + 128 * k;
// Spitzen der Kristalldrusen in der Kachel (t, y)
const CWL_DRUSEN = [[104, 28], [101, 32], [107, 31], [40, 86], [74, 24]];

const CrystalWellOverlay = React.memo(function CrystalWellOverlay() {
  const funken = useMemo(() => ppZufall(ppFxN(22), (i) => {
    const a = Math.random() * Math.PI * 2;
    if (i < 10) return { x: Math.cos(a) * 58, y: 50 + Math.sin(a) * 22, dur: 1.8 + Math.random() * 2, delay: -Math.random() * 4 };
    if (i < 13) return { x: (Math.random() - .5) * 50, y: 47 + Math.random() * 9, dur: 1.4 + Math.random() * 1.6, delay: -Math.random() * 3 };
    const [t, y] = CWL_DRUSEN[i % CWL_DRUSEN.length];
    const k = [-2, -1, 1, 2][Math.floor(Math.random() * 4)];
    return { x: cwlKachel(t, k) + Math.round((Math.random() - .5) * 4), y: y + Math.round(Math.random() * 5), dur: 2.4 + Math.random() * 2, delay: -Math.random() * 5 };
  }), []);
  const ringe = useMemo(() => ppZufall(ppFxN(4), () => ({
    x: Math.round((Math.random() - .5) * 40), y: 49 + Math.round(Math.random() * 5), dur: 3.2 + Math.random() * 2.4, delay: -Math.random() * 6,
  })), []);
  const steigen = useMemo(() => ppZufall(ppFxN(8), () => ({
    x: Math.round((Math.random() - .5) * 52), y: 50 + Math.round(Math.random() * 6), dur: 3.5 + Math.random() * 3, delay: -Math.random() * 7,
  })), []);
  const gluehen = useMemo(() => ppZufall(ppFxN(14), () => ({
    x: Math.round((Math.random() - .5) * 420), y: 26 + Math.round(Math.random() * 70),
    dur: 5 + Math.random() * 5, delay: -Math.random() * 10, b: Math.random() < .5,
  })).filter(g => !(Math.abs(g.x) < 70 && g.y > 18 && g.y < 94)), []);
  const falter = useMemo(() => ppZufall(ppFxN(2), (i) => ({
    y: 30 + Math.random() * 50, dur: 24 + Math.random() * 12, delay: -Math.random() * 30, rtl: i % 2 === 1, bob: 2 + Math.random() * 2,
  })), []);
  return (
    <PixelScene artH={100} bg="#1664e8" className="crystal-well-overlay">
      <PixelBand src={CWL + 'tile.png'} />
      <PixelBand src={CWL + 'glow.png'} className="cwl-atmen" />
      <PixelBand src={CWL + 'sway-b.png'} className="cwl-wiegen b" style={{ backgroundSize: 'auto 300%' }} />
      <PixelBand src={CWL + 'sway-a.png'} className="cwl-wiegen" style={{ backgroundSize: 'auto 300%' }} />
      <PixelPiece src={CWL + 'ground.png'} w={CWL_W} />
      <PixelPiece src={CWL + 'water.png'} w={CWL_W} className="cwl-wasser" style={{ backgroundSize: '100% 400%' }} />
      {ringe.map((r, i) => (
        <i key={'r' + i} className="pp-area-dyn cwl-ring" style={{ left: ppArtX(r.x - 10, 0), top: ppArt(r.y - 3), animation: `cwlRing ${r.dur.toFixed(2)}s steps(1) ${r.delay.toFixed(2)}s infinite` }} />
      ))}
      <PixelPiece src={CWL + 'well.png'} w={CWL_W} />
      <PixelPiece src={CWL + 'caustics.png'} w={CWL_W} style={{ backgroundSize: '100% 300%', animation: 'ppBand3 1.2s steps(1) infinite' }} />
      <PixelPiece src={CWL + 'front.png'} w={CWL_W} />
      <PixelPiece src={CWL + 'well-glow.png'} w={CWL_W} className="cwl-atmen b" />
      {steigen.map((s, i) => (
        <i key={'s' + i} className="pp-area-dyn cwl-funke" style={{ left: ppArtX(s.x, 0), top: ppArt(s.y), animation: `cwlSteigen ${s.dur.toFixed(2)}s steps(26) ${s.delay.toFixed(2)}s infinite` }} />
      ))}
      {funken.map((f, i) => (
        <i key={'f' + i} className="pp-area-dyn pp-px-funkeln" style={{ left: ppArtX(f.x - 1, 0), top: ppArt(f.y - 1), animation: `ppFunkeln ${f.dur.toFixed(2)}s steps(1) ${f.delay.toFixed(2)}s infinite` }} />
      ))}
      {gluehen.map((g, i) => (
        <i key={'g' + i} className="pp-area-dyn cwl-gluehwurm" style={{ left: ppArtX(g.x, 0), top: ppArt(g.y), animation: `${g.b ? 'cwlSchwebenB' : 'cwlSchwebenA'} ${g.dur.toFixed(2)}s steps(24) ${g.delay.toFixed(2)}s infinite` }} />
      ))}
      {falter.map((f, i) => (
        <div key={'b' + i} className="pp-area-dyn pp-quer" style={ppQuer(f.y, f.dur, f.delay, f.rtl)}>
          <i className="cwl-falter" style={{ '--bob': ppArt(f.bob), transform: f.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .cwl-atmen { animation: cwlAtmen 3.4s ease-in-out infinite alternate; }
        .cwl-atmen.b { animation-duration: 2.6s; animation-delay: -1.3s; }
        @keyframes cwlAtmen { from { opacity: .45; } to { opacity: 1; } }
        /* Halme: Bild 0 links, 1 mitte, 2 rechts (übereinander) */
        .cwl-wiegen { animation: cwlWiegen 2.8s steps(1) infinite; }
        .cwl-wiegen.b { animation-duration: 3.5s; animation-delay: -1.1s; }
        @keyframes cwlWiegen {
          0% { background-position: 50% 50%; } 30% { background-position: 50% 100%; }
          55% { background-position: 50% 50%; } 80% { background-position: 50% 0%; }
        }
        .cwl-wasser { animation: cwlWasser 1.6s steps(1) infinite; }
        @keyframes cwlWasser {
          0% { background-position: 0 0%; } 25% { background-position: 0 33.333%; }
          50% { background-position: 0 66.667%; } 75% { background-position: 0 100%; }
        }
        .cwl-ring {
          position: absolute; width: calc(21 * var(--px)); height: calc(7 * var(--px)); opacity: 0;
          background: url(${CWL}ring.png) 0 0 / 400% 100% no-repeat;
        }
        @keyframes cwlRing {
          0% { opacity: 1; background-position: 0 0; } 10% { background-position: 33.333% 0; }
          20% { background-position: 66.667% 0; } 30% { background-position: 100% 0; } 40%, 100% { opacity: 0; }
        }
        .cwl-funke {
          position: absolute; width: var(--px); height: var(--px); background: #e8fcff; opacity: 0;
          box-shadow: 0 var(--px) 0 rgba(120, 210, 255, .55);
        }
        @keyframes cwlSteigen {
          0% { transform: translateY(0); opacity: 0; } 10% { opacity: 1; } 70% { opacity: .8; }
          100% { transform: translateY(calc(-26 * var(--px))); opacity: 0; }
        }
        .cwl-gluehwurm {
          position: absolute; width: var(--px); height: var(--px); background: #f2ffff; opacity: 0;
          box-shadow: var(--px) 0 0 rgba(140, 225, 255, .45), calc(-1 * var(--px)) 0 0 rgba(140, 225, 255, .45),
                      0 var(--px) 0 rgba(140, 225, 255, .45), 0 calc(-1 * var(--px)) 0 rgba(140, 225, 255, .45);
        }
        @keyframes cwlSchwebenA {
          0% { transform: translate(0, 0); opacity: 0; } 15% { opacity: 1; }
          35% { transform: translate(calc(4 * var(--px)), calc(-3 * var(--px))); opacity: .5; }
          55% { transform: translate(calc(7 * var(--px)), calc(-2 * var(--px))); opacity: 1; }
          80% { transform: translate(calc(9 * var(--px)), calc(-6 * var(--px))); opacity: .7; }
          100% { transform: translate(calc(11 * var(--px)), calc(-8 * var(--px))); opacity: 0; }
        }
        @keyframes cwlSchwebenB {
          0% { transform: translate(0, 0); opacity: 0; } 20% { opacity: .9; }
          40% { transform: translate(calc(-3 * var(--px)), calc(-4 * var(--px))); opacity: .4; }
          60% { transform: translate(calc(-6 * var(--px)), calc(-3 * var(--px))); opacity: 1; }
          100% { transform: translate(calc(-9 * var(--px)), calc(-9 * var(--px))); opacity: 0; }
        }
        .cwl-falter {
          display: block; width: calc(7 * var(--px)); height: calc(5 * var(--px));
          background: url(${CWL}butterfly.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .3s steps(1) infinite, ppBob 1.2s steps(3) infinite alternate;
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  DARK OCEAN — offene, dunkle See (v1415; Überarbeitung v1441, Al 25.9.)
//
//  Karte: dunkelgraue, FARBLOSE Meeresoberfläche. Als Vorgabe (5.8.):
//  dunkelgrau, entsättigt, bedrohlich, mit Seegang — die Karten dürfen
//  nicht verschleiert werden. Farblos bleibt farblos: alles in Grautönen
//  (nur der leichte Kaltstich des alten #323335).
//
//  Überarbeitung v1441 (Al 25.9.: „deine haben ein anderes Level"): mehr
//  Tiefe und Leben im Wasser. Leichte Perspektive (fern oben: kleinere
//  Wellen, Dunst; nah unten: größere, dunklere See), die Kräuselstriche
//  der Karte (heller Strich über dunklem, schwarze Grübchen), rollende
//  Wellenkämme in Sichelstücken mit Lichtkante, beleuchteter Rückseite
//  und dunkler Vorderflanke, Schaum auf den nahen Kämmen, Schaumkronen
//  mit Gischt, Strömungsschlieren, Wolkenschatten, Nebel, Regen, dunkle
//  Schemen unter der Oberfläche, Treibgut, eine Rückenflosse.
//
//  Ebenen (Kunsthöhe 100; Generator `dark-ocean.py`, nicht im Projekt):
//  tile.png — Kachel 128 (Grundwasser, Tiefenflecken, Kräuselstriche);
//  swell.png — Seegang, 18 Bilder übereinander (Kachel 128, Kämme rollen
//  auf den Betrachter zu, Periode drei Wellen); ripples.png — Windsee,
//  Kachel 96; current.png — Schaumschlieren, Kachel 192; shade.png —
//  Wolkenschatten, Kachel 256; fog.png — Nebel, Kachel 192; rain.png —
//  Regen 100×100 (nahtlos in x und y); ring.png — Tropfenring (5);
//  cap-l.png / cap-s.png — brechende Schaumkrone mit Gischt (8);
//  beast.png — Leviathan-Schemen (2); school.png — Fischschwarm-Schatten
//  (2); fin.png — Rückenflosse mit Kielwasser (3); debris.png — Treibgut
//  (Planke, Fass, Mastbruch mit Tau, Kiste; je 2 Bilder, Zeilen).
//
//  Animiert: der Seegang rollt heran, Windsee und Strömung treiben nach
//  links (Wind von rechts), Wolkenschatten und Nebel ziehen, Schaumkronen
//  brechen mit Gischt, Regen fällt schräg und setzt Tropfenringe, ab und
//  zu gleitet ein riesiger Schatten unter der Oberfläche vorbei, ein
//  Fischschwarm huscht, eine Flosse schneidet durchs Wasser, Treibgut
//  dümpelt vorüber, fernes Wetterleuchten. Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const DOC = '/areas/dark-ocean/';
const DOC_TREIBGUT = [0, 1, 2, 3];                  // Zeilen in debris.png (26×10 je Bild)
const DarkOceanOverlay = React.memo(function DarkOceanOverlay() {
  const kronen = useMemo(() => ppZufall(ppFxN(11), (i) => {
    const y = 18 + Math.random() * 78;
    return { x: 3 + Math.random() * 94, y, gross: y > 46, dur: 5 + Math.random() * 6, delay: -Math.random() * 11 };
  }), []);
  const tropfen = useMemo(() => ppZufall(ppFxN(18), () => ({
    x: Math.random() * 100, y: 4 + Math.random() * 93, dur: 1.3 + Math.random() * 1.6, delay: -Math.random() * 3,
  })), []);
  const treibgut = useMemo(() => {
    const start = Math.floor(Math.random() * 4);          // jedes Stück nur einmal
    return ppZufall(ppFxN(3), (i) => ({
    art: DOC_TREIBGUT[(start + i) % 4], y: 20 + i * 24 + Math.random() * 12,
    dur: 120 + Math.random() * 60, delay: -Math.random() * 180, bob: 1.7 + Math.random() * 1.2,
    }));
  }, []);
  const fische = useMemo(() => ppZufall(ppFxN(2), (i) => ({
    y: 25 + Math.random() * 55, dur: 26 + Math.random() * 12, delay: -Math.random() * 40, rtl: i === 0,
  })), []);
  return (
    <PixelScene artH={100} bg="#303134" className="dark-ocean-overlay">
      <PixelBand src={DOC + 'tile.png'} />
      <div className="pp-area-dyn doc-tier-bahn"><i className="doc-tier" /></div>
      {fische.map((f, i) => (
        <div key={'f' + i} className="pp-area-dyn pp-quer" style={ppQuer(f.y, f.dur, f.delay, f.rtl)}>
          <i className="doc-schwarm" style={{ transform: f.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      <PixelBand src={DOC + 'swell.png'} className="doc-see" style={{ backgroundSize: 'auto 1800%' }} />
      <PixelBand src={DOC + 'ripples.png'} className="doc-kraeusel" />
      <PixelBand src={DOC + 'current.png'} className="doc-stroemung" />
      <PixelBand src={DOC + 'shade.png'} className="doc-schatten" />
      {treibgut.map((t, i) => (
        <div key={'t' + i} className="pp-area-dyn pp-quer" style={ppQuer(t.y, t.dur, t.delay, true)}>
          <i className="doc-treibgut" style={{ backgroundPositionY: `${t.art * 100 / 3}%`, animationDuration: `1.3s, ${t.bob.toFixed(2)}s` }} />
        </div>
      ))}
      <div className="pp-area-dyn doc-flossen-bahn"><i className="doc-flosse" /></div>
      {kronen.map((k, i) => (
        <i key={'k' + i} className={'pp-area-dyn doc-krone' + (k.gross ? ' gross' : '')} style={{
          left: k.x + '%', top: ppArt(Math.round(k.y)),
          animation: `docKrone ${k.dur.toFixed(2)}s steps(1) ${k.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {tropfen.map((t, i) => (
        <i key={'r' + i} className="pp-area-dyn doc-ring" style={{
          left: t.x + '%', top: ppArt(Math.round(t.y)),
          animation: `docRing ${t.dur.toFixed(2)}s steps(1) ${t.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      <div className="pp-pixel-layer pp-area-dyn doc-regen" />
      <PixelBand src={DOC + 'fog.png'} className="doc-nebel" />
      <div className="pp-area-dyn doc-blitz" />
      <div className="pp-rand-dim" />
      <style>{`
        .doc-see { animation: docSee 8.1s steps(18) infinite; }
        @keyframes docSee { from { background-position: 50% 0; } to { background-position: 50% calc(-1800 * var(--px)); } }
        .doc-kraeusel { animation: docKraeusel 34s steps(96) infinite; opacity: .6; }
        @keyframes docKraeusel { from { background-position: 50% 0; } to { background-position: calc(50% - 96 * var(--px)) 0; } }
        .doc-stroemung { animation: docStroemung 110s steps(192) infinite; }
        @keyframes docStroemung { from { background-position: 50% 0; } to { background-position: calc(50% - 192 * var(--px)) 0; } }
        .doc-schatten { animation: docWolke 170s steps(256) infinite; }
        @keyframes docWolke { from { background-position: 50% 0; } to { background-position: calc(50% - 256 * var(--px)) 0; } }
        .doc-nebel { animation: docNebel 130s steps(192) infinite; }
        @keyframes docNebel { from { background-position: 50% 0; } to { background-position: calc(50% - 192 * var(--px)) 0; } }
        .doc-regen {
          position: absolute; inset: 0; opacity: .5;
          background: url(${DOC}rain.png) 0 0 / calc(100 * var(--px)) calc(100 * var(--px)) repeat;
          animation: docRegen 2.4s steps(100) infinite;
        }
        @keyframes docRegen { from { background-position: 0 0; } to { background-position: calc(-100 * var(--px)) calc(200 * var(--px)); } }
        .doc-ring { position: absolute; width: calc(7 * var(--px)); height: calc(4 * var(--px)); background: url(${DOC}ring.png) 0 0 / 500% 100% no-repeat; opacity: 0; }
        @keyframes docRing {
          0% { opacity: 1; background-position: 0 0; } 6% { background-position: 25% 0; } 12% { background-position: 50% 0; }
          19% { background-position: 75% 0; } 27% { background-position: 100% 0; } 35%, 100% { opacity: 0; }
        }
        .doc-krone { position: absolute; width: calc(14 * var(--px)); height: calc(8 * var(--px)); margin-left: calc(-7 * var(--px)); background: url(${DOC}cap-s.png) 0 0 / 800% 100% no-repeat; opacity: 0; }
        .doc-krone.gross { width: calc(22 * var(--px)); height: calc(12 * var(--px)); margin-left: calc(-11 * var(--px)); background-image: url(${DOC}cap-l.png); }
        @keyframes docKrone {
          0% { opacity: 1; background-position: 0 0; } 4% { background-position: 14.286% 0; } 8% { background-position: 28.571% 0; }
          12% { background-position: 42.857% 0; } 16% { background-position: 57.143% 0; } 21% { background-position: 71.429% 0; }
          27% { background-position: 85.714% 0; } 34% { background-position: 100% 0; } 42%, 100% { opacity: 0; }
        }
        .doc-tier-bahn { position: absolute; left: 0; top: calc(38 * var(--px)); animation: docTierZug 84s linear -20s infinite; }
        .doc-tier {
          display: block; width: calc(84 * var(--px)); height: calc(30 * var(--px));
          background: url(${DOC}beast.png) 0 0 / 200% 100% no-repeat; animation: ppSprite2 2.2s steps(1) infinite;
        }
        @keyframes docTierZug {
          0% { transform: translate(calc(-90 * var(--px)), calc(6 * var(--px))); }
          62% { transform: translate(calc(100cqw + 6 * var(--px)), calc(-4 * var(--px))); }
          100% { transform: translate(calc(100cqw + 6 * var(--px)), calc(-4 * var(--px))); }
        }
        .doc-schwarm { display: block; width: calc(26 * var(--px)); height: calc(12 * var(--px)); background: url(${DOC}school.png) 0 0 / 200% 100% no-repeat; animation: ppSprite2 .5s steps(1) infinite; opacity: .9; }
        .doc-flossen-bahn { position: absolute; left: 0; top: calc(66 * var(--px)); animation: docFlosseZug 58s linear -8s infinite; }
        .doc-flosse { display: block; width: calc(24 * var(--px)); height: calc(10 * var(--px)); background: url(${DOC}fin.png) 0 0 / 300% 100% no-repeat; animation: ppSprite3 .6s steps(1) infinite; }
        @keyframes docFlosseZug {
          0% { transform: translate(calc(-30 * var(--px)), 0); }
          38% { transform: translate(calc(100cqw + 6 * var(--px)), calc(-5 * var(--px))); }
          100% { transform: translate(calc(100cqw + 6 * var(--px)), calc(-5 * var(--px))); }
        }
        .doc-treibgut {
          display: block; width: calc(26 * var(--px)); height: calc(10 * var(--px));
          background: url(${DOC}debris.png) 0 0 / 200% 400% no-repeat;
          animation-name: docDuempeln, docWippen; animation-timing-function: steps(1); animation-iteration-count: infinite;
        }
        @keyframes docDuempeln { 0% { background-position-x: 0; } 50% { background-position-x: 100%; } }
        @keyframes docWippen { 0% { translate: 0 0; } 50% { translate: 0 var(--px); } }
        .doc-blitz {
          position: absolute; inset: 0; opacity: 0;
          background: linear-gradient(180deg, rgba(205,207,214,.2) 0%, rgba(205,207,214,.07) 45%, rgba(205,207,214,0) 80%);
          animation: docBlitz 23s steps(1) infinite;
        }
        @keyframes docBlitz { 0%, 88% { opacity: 0; } 88.4% { opacity: .8; } 88.9% { opacity: .15; } 89.6% { opacity: .55; } 90.3%, 100% { opacity: 0; } }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  DEEPSEA CASTLE — versunkene Burg (v1419, Überarbeitung v1441, Al 25.9.)
//
//  Karte: türkisfarbene Burg mit violetten Spitzdächern unter einem
//  fahlen Lichtstrahl, lavendelfarbenes Wasser. Tiefsee: Blasen steigen,
//  Schwebeteilchen sinken, Fische ziehen vorbei, Seegras wiegt.
//  Neubau v1419 (Al 25.9.: „mehr Detail und mehr Shading"): Türme als
//  schattierte Zylinder mit Ziegelreihen, Kegeldächer mit Schindeln und
//  Spitzkugel, Spitzbogenfenster mit hellem Rahmen, Gesimse und Zinnen,
//  Algen, Korallen, Seepocken. Licht IMMER von oben rechts. Die Fenster
//  glimmen unten türkis (eigene Ebene, atmet).
//
//  Überarbeitung v1441 (Al 25.9.): gleiche Burg, gleiche Palette, aber
//  neu gemalt und mit Tiefe. Burg (Stück 176): sieben Türme wie bisher,
//  jetzt vollständig (die äußeren kleinen Türme waren abgeschnitten),
//  Quader in versetzten Reihen mit Lichtkante, Kragsteinfriese unter den
//  Traufen, Gesimse mit Schlagschatten, Schindeldächer mit Glanzstreifen,
//  gestufter Bergfried mit violett gedeckten Zinnen, Rundfenster über
//  dem Spitzbogentor (Keilsteine, Bohlen, Eisenbänder, Ringe), Stufen und
//  Plattenweg. Bewuchs: Algenflecken (unten dichter), hängende Tangfäden,
//  Seepocken, Risse, Seesterne an der Mauer; am Fuß Sandverwehungen,
//  Felsbrocken, Ast-, Hirn- und Fächerkorallen, Röhrenschwämme, Anemonen,
//  eine versunkene Schatztruhe und eine Amphore.
//  Hintergrund in drei Tiefen statt der blassen Säulen: ganz fern eine
//  versunkene Stadt im Dunst (Türme mit Spitzdächern, Kuppelhalle,
//  Brückenbogen, gebrochener Turm), davor ein Felsgrat mit Säulen und
//  Tangstängeln, vorne ein Riff (facettierte Felsen, Korallen, Säulen-
//  ruine) und Sandboden mit Rippeln, Kieseln, Muscheln, Seesternen und
//  Seeigeln.
//
//  Ebenen (Kunsthöhe 100; Generator liegt nicht im Projekt): back.png —
//  Kachel 128 (Wasser als Pixelrauschen, ferne Stadt, Felsgrat);
//  rays.png — schräge Lichtfahnen (Kachel); kelp.png — hoher Tang hinter
//  der Burg (4 Bilder übereinander); tile.png — Riff und Meeresboden
//  (Kachel); caustics.png — Lichtnetz auf dem Sand (3 Bilder); beam.png —
//  der Lichtstrahl der Karte (48); castle.png / castle-glow.png — Burg und
//  Glimmen (176); weed.png — Seegras vorne (4 Bilder); fish.png (2 Arten
//  × 2 Bilder), school.png (Schwarm, 2), whale.png (Wal, 2), jelly.png (4),
//  crab.png (2), pennant.png (Wimpel, 3).
//
//  Animiert: Lichtfahnen wandern langsam und atmen, der Strahl pulsiert,
//  Kaustik flimmert auf dem Sand, Tang und Seegras wiegen, Fenster, Ro-
//  sette und Anemonen glimmen, Wimpel flattern in der Strömung, Glanz-
//  punkte an Turmspitzen und Truhe, ein Wal zieht fern vorbei, ein
//  Fischschwarm, einzelne Fische (vor und hinter der Burg), Quallen
//  steigen pulsierend auf, eine Krabbe läuft über den Sand, Blasen
//  steigen (auch aus der Truhe), Schwebeteilchen sinken.
//  Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const DSC = '/areas/deepsea-castle/';
const DSC_W = 176;                                   // Burgstück; Stück-x 88 = Brettmitte
const DSC_WIMPEL = [[53, 19], [123, 19]];            // Mastspitzen (Stück-x, y); wehen zur Mitte
const DSC_GLANZ = [[87, 1], [36, 1], [138, 1], [20, 35], [154, 35], [69, 89], [73, 89]];
const DSC_TRUHE = [70, 88];                          // Blasen aus dem Truhenspalt
const DeepseaCastleOverlay = React.memo(function DeepseaCastleOverlay() {
  const blasen = useMemo(() => ppZufall(ppFxN(12), () => ({
    x: Math.random() * 100, dur: 6 + Math.random() * 5, delay: -Math.random() * 11, gross: Math.random() < .3,
  })), []);
  const truhe = useMemo(() => ppZufall(ppFxN(3), (i) => ({ dur: 5.5 + i * .7, delay: -i * 2.1 - Math.random() })), []);
  const schnee = useMemo(() => ppZufall(ppFxN(18), () => ({
    x: Math.random() * 100, dur: 16 + Math.random() * 12, delay: -Math.random() * 28, hell: Math.random() < .4,
  })), []);
  const fische = useMemo(() => ppZufall(ppFxN(4), (i) => ({
    y: 34 + Math.random() * 40, dur: 22 + Math.random() * 16, delay: -Math.random() * 36, rtl: i % 2 === 0,
    art: i % 2, vorne: i >= 2,
  })), []);
  const quallen = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    x: [14, 81, 58][i] + Math.random() * 8, dur: 46 + Math.random() * 20, delay: -Math.random() * 60, puls: 1.5 + Math.random() * .5,
  })), []);
  const glanz = useMemo(() => DSC_GLANZ.slice(0, ppFxN(DSC_GLANZ.length)).map(() => ({
    dur: 3 + Math.random() * 3, delay: -Math.random() * 6,
  })), []);
  return (
    <PixelScene artH={100} bg="#bdb4e1" className="deepsea-castle-overlay">
      <PixelBand src={DSC + 'back.png'} />
      <div className="pp-area-dyn pp-quer" style={ppQuer(14, 120, -50, true)}><i className="dsc-wal" /></div>
      <div className="pp-area-dyn pp-quer" style={ppQuer(40, 52, -12, false)}><i className="dsc-schwarm" /></div>
      <PixelBand src={DSC + 'rays.png'} className="dsc-fahnen" />
      <PixelBand src={DSC + 'kelp.png'} className="dsc-wiegen" style={{ backgroundSize: 'auto 400%', animationDuration: '3.8s' }} />
      <PixelBand src={DSC + 'tile.png'} />
      <PixelBand src={DSC + 'caustics.png'} className="dsc-kaustik" style={{ backgroundSize: 'auto 300%' }} />
      {fische.filter(f => !f.vorne).map((f, i) => (
        <div key={'fh' + i} className="pp-area-dyn pp-quer" style={ppQuer(f.y, f.dur, f.delay, f.rtl)}>
          <i className="dsc-fisch" style={{ transform: f.rtl ? 'scaleX(-1)' : undefined, backgroundPositionY: f.art ? '100%' : '0%' }} />
        </div>
      ))}
      <PixelPiece src={DSC + 'castle.png'} w={DSC_W} />
      <PixelPiece src={DSC + 'castle-glow.png'} w={DSC_W} className="dsc-fenster" />
      <PixelPiece src={DSC + 'beam.png'} w={48} className="dsc-strahl" />
      {DSC_WIMPEL.map(([x, y], i) => (
        <i key={'w' + i} className="dsc-wimpel" style={{
          left: ppArtX(i ? x - 13 : x + 1, DSC_W), top: ppArt(y),
          transform: i ? 'scaleX(-1)' : undefined, animationDuration: `${1.1 + i * .17}s`,
        }} />
      ))}
      {glanz.map((g, i) => (
        <i key={'g' + i} className="pp-area-dyn pp-px-funkeln" style={{
          left: ppArtX(DSC_GLANZ[i][0] - 1, DSC_W), top: ppArt(DSC_GLANZ[i][1] - 1),
          animation: `ppFunkeln ${g.dur.toFixed(2)}s steps(1) ${g.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {quallen.map((q, i) => (
        <div key={'q' + i} className="pp-area-dyn dsc-qualle-weg" style={{ left: q.x + '%', animation: `dscAufsteigen ${q.dur.toFixed(1)}s steps(${Math.round(q.dur * 4)}) ${q.delay.toFixed(1)}s infinite` }}>
          <i className="dsc-qualle" style={{ animationDuration: `${q.puls.toFixed(2)}s` }} />
        </div>
      ))}
      {fische.filter(f => f.vorne).map((f, i) => (
        <div key={'fv' + i} className="pp-area-dyn pp-quer" style={ppQuer(f.y + 8, f.dur * .8, f.delay, f.rtl)}>
          <i className="dsc-fisch" style={{ transform: f.rtl ? 'scaleX(-1)' : undefined, backgroundPositionY: f.art ? '100%' : '0%' }} />
        </div>
      ))}
      <div className="pp-area-dyn pp-quer" style={ppQuer(90, 84, -20, false)}><i className="dsc-krabbe" /></div>
      <PixelBand src={DSC + 'weed.png'} className="dsc-wiegen" style={{ backgroundSize: 'auto 400%', animationDuration: '2.9s' }} />
      {schnee.map((s, i) => (
        <i key={'s' + i} className={'pp-area-dyn dsc-schnee' + (s.hell ? ' hell' : '')} style={{ left: s.x + '%', animation: `dscSinken ${s.dur.toFixed(1)}s steps(100) ${s.delay.toFixed(1)}s infinite` }} />
      ))}
      {blasen.map((b, i) => (
        <i key={'b' + i} className={'pp-area-dyn dsc-blase' + (b.gross ? ' gross' : '')} style={{ left: b.x + '%', animation: `dscSteigen ${b.dur.toFixed(1)}s steps(98) ${b.delay.toFixed(1)}s infinite` }} />
      ))}
      {truhe.map((b, i) => (
        <i key={'t' + i} className={'pp-area-dyn dsc-blase' + (i === 1 ? ' gross' : '')} style={{
          left: ppArtX(DSC_TRUHE[0], DSC_W), top: ppArt(DSC_TRUHE[1]),
          animation: `dscTruhe ${b.dur.toFixed(1)}s steps(88) ${b.delay.toFixed(1)}s infinite`,
        }} />
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .dsc-fahnen { animation: dscFahnen 96s steps(128) infinite, dscAtmen 7s ease-in-out infinite alternate; }
        @keyframes dscFahnen { from { background-position: 50% 0; } to { background-position: calc(50% - 128 * var(--px)) 0; } }
        @keyframes dscAtmen { from { opacity: .55; } to { opacity: 1; } }
        .dsc-wiegen { animation: dscWiegen 3.4s steps(1) infinite; }
        @keyframes dscWiegen { 0% { background-position: 50% 0%; } 25% { background-position: 50% 33.333%; } 50% { background-position: 50% 66.667%; } 75% { background-position: 50% 100%; } }
        .dsc-kaustik { opacity: .8; animation: ppBand3 2.4s steps(1) infinite; }
        .dsc-strahl { animation: dscStrahl 4.2s ease-in-out infinite alternate; }
        @keyframes dscStrahl { from { opacity: .6; } to { opacity: 1; } }
        .dsc-fenster { animation: dscFenster 3.6s ease-in-out infinite alternate; }
        @keyframes dscFenster { from { opacity: .45; } to { opacity: 1; } }
        .dsc-wimpel { position: absolute; width: calc(11 * var(--px)); height: calc(7 * var(--px)); background: url(${DSC}pennant.png) 0 0 / 300% 100% no-repeat; animation: ppSprite3 1.1s steps(1) infinite; }
        .dsc-fisch { display: block; width: calc(8 * var(--px)); height: calc(5 * var(--px)); background: url(${DSC}fish.png) 0 0 / 200% 200% no-repeat; animation: dscFlosse .5s steps(1) infinite; }
        @keyframes dscFlosse { 0% { background-position-x: 0%; } 50% { background-position-x: 100%; } }
        .dsc-schwarm { display: block; width: calc(24 * var(--px)); height: calc(10 * var(--px)); opacity: .7; background: url(${DSC}school.png) 0 0 / 200% 100% no-repeat; animation: ppSprite2 .6s steps(1) infinite, ppBob 3.2s steps(3) infinite alternate; --bob: calc(3 * var(--px)); }
        .dsc-wal { display: block; width: calc(40 * var(--px)); height: calc(13 * var(--px)); opacity: .42; transform: scaleX(-1); background: url(${DSC}whale.png) 0 0 / 200% 100% no-repeat; animation: ppSprite2 3.4s steps(1) infinite, ppBob 6.8s steps(3) infinite alternate; --bob: calc(3 * var(--px)); }
        @keyframes dscVier { 0% { background-position: 0 0; } 25% { background-position: 33.333% 0; } 50% { background-position: 66.667% 0; } 75% { background-position: 100% 0; } }
        .dsc-qualle-weg { position: absolute; top: 0; width: calc(7 * var(--px)); height: calc(11 * var(--px)); }
        .dsc-qualle { display: block; width: 100%; height: 100%; opacity: .85; background: url(${DSC}jelly.png) 0 0 / 400% 100% no-repeat; animation: dscVier 1.6s steps(1) infinite; }
        @keyframes dscAufsteigen {
          0% { transform: translate(0, calc(104 * var(--px))); }
          25% { transform: translate(calc(3 * var(--px)), calc(76 * var(--px))); }
          50% { transform: translate(0, calc(48 * var(--px))); }
          75% { transform: translate(calc(-3 * var(--px)), calc(20 * var(--px))); }
          100% { transform: translate(0, calc(-12 * var(--px))); }
        }
        .dsc-krabbe { display: block; width: calc(9 * var(--px)); height: calc(6 * var(--px)); background: url(${DSC}crab.png) 0 0 / 200% 100% no-repeat; animation: ppSprite2 .34s steps(1) infinite; }
        .dsc-schnee { position: absolute; top: 0; width: var(--px); height: var(--px); background: #efe6ff; opacity: .55; }
        .dsc-schnee.hell { opacity: .85; }
        @keyframes dscSinken { from { transform: translate(0, 0); } 50% { transform: translate(calc(3 * var(--px)), calc(50 * var(--px))); } to { transform: translate(0, calc(100 * var(--px))); } }
        .dsc-blase { position: absolute; top: calc(96 * var(--px)); width: var(--px); height: var(--px); background: #f4eeff; opacity: 0; }
        .dsc-blase.gross { width: calc(2 * var(--px)); height: calc(2 * var(--px)); background: transparent; box-shadow: inset 0 0 0 var(--px) #f4eeff; }
        @keyframes dscSteigen {
          0% { transform: translate(0, 0); opacity: 0; } 8% { opacity: .9; }
          50% { transform: translate(calc(2 * var(--px)), calc(-48 * var(--px))); }
          100% { transform: translate(0, calc(-98 * var(--px))); opacity: .2; }
        }
        @keyframes dscTruhe {
          0% { transform: translate(0, 0); opacity: 0; } 6% { opacity: .95; }
          30% { transform: translate(calc(-1 * var(--px)), calc(-26 * var(--px))); }
          60% { transform: translate(calc(1 * var(--px)), calc(-53 * var(--px))); }
          100% { transform: translate(0, calc(-90 * var(--px))); opacity: .15; }
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  DOOM CLOCK — die Uhr, die bis Mitternacht zählt
//  (v1415 Kartenstil, v1420 Doom Counter; Überarbeitung v1441 (Al 25.9.))
//
//  Karte: große dunkelrote Uhr mit Spirale und Totenschädeln an den
//  Viertelmarken. Als Vorgabe (5.8.): „ähnlich Big Gwen, aber
//  bedrohlicher", Sekunden TICKEN (60 harte Schritte, echte Uhrzeit).
//  v1420 (Al 25.9.): Himmel in dunklem, GEFÄHRLICHEM Rot. Stunden- und
//  Minutenzeiger zeigen die DOOM COUNTER: 0 = 11 Uhr, 20 = 12 Uhr,
//  dazwischen fließend (Minutenzeiger eine Umdrehung, Stundenzeiger
//  von der 11 zur 12). Liegen zwei Doom Clocks, zählt die, die dem
//  Ende näher ist. Je näher Mitternacht, desto schneller und heller
//  pocht der rote Schein hinter der Uhr.
//
//  Überarbeitung v1441: dieselbe Szene, neu gemalt. Die Uhr hängt an
//  einer Kette mit geriffelter Krone wie eine riesige Taschenuhr über
//  einem Wolkenmeer: gewölbter Eisenrand mit Rille, Nieten, gehämmerten
//  Dellen und Rost, darin der weinrote Zifferring mit Minutenstrichen,
//  Stundennieten und vier Schädeln (rote Augen), das Zifferblatt mit
//  schrägen Pinselschlieren wie auf der Karte und einem Riss. Die
//  Spirale ist eine eigene Ebene und zieht langsam nach innen in den
//  schwarzen Abgrund unter der Achse — je näher Mitternacht, desto
//  schneller. Ringsum statt Verlauf ein gemalter Himmel: dunkles Rot mit
//  schrägen Schlieren und violetten Strähnen, oben hängende Rauchbänke,
//  hinten ferne Gewittertürme vor dem glühenden Horizont (dort zucken
//  Blitze), vorn ein Wolkenmeer mit glühenden Kanten und vor dem unteren
//  Uhrrand dünne Schwaden.
//
//  Ebenen (Kunsthöhe 100; Generator gen/doom-clock.py, nicht im
//  Projekt): sky.png, smoke.png, clouds-far.png, clouds-near.png,
//  wisps.png (Kacheln 128), clock.png (Versatzstück 91), spiral.png
//  (14 Bilder 61×61 übereinander), hand-hour/-min/-sec.png, cap.png
//  (Achsschädel), gear.png / gear-s.png (je 3 Bilder, Zahnrad dreht
//  sich), crow.png (2 Bilder 7×4), bolt.png (3 Blitze 11×30).
//
//  Animiert: Zeiger (Doom Counter, gleiten bei Änderung hinüber),
//  Sekundenzeiger tickt, Spirale zieht nach innen, roter Schein pocht,
//  Schädelaugen glühen, Blitze in der Ferne, Wolken und Rauch ziehen
//  (je Ebene eigenes Tempo), Zahnräder schweben und drehen sich,
//  Krähen ziehen vorbei, Asche und Glut steigen. Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const DCL = '/areas/doom-clock/';
const DC_MITTE_Y = 49.5;
const DC_MAX = 20;
// Schädel an den Viertelmarken (Kunstpixel neben der Uhrmitte)
const DC_SCHAEDEL = [[0, -33], [33, 0], [0, 33], [-33, 0]];
// Zeigerbilder: Breite, Höhe, Drehpunkt (Pixel im Bild)
const DC_ZEIGER = { std: [9, 28, 4, 22], min: [7, 37, 3, 31], sek: [5, 44, 2, 34] };
// Schwebende Zahnräder (x neben der Mitte, y, groß?) — nur neben der Uhr
const DC_RAEDER = [[-60, 22, 0], [-86, 44, 1], [-140, 30, 0], [62, 30, 1], [96, 14, 0], [138, 46, 1]];
// Blitze in der Ferne (x neben der Mitte)
const DC_BLITZE = [-138, -96, -62, 66, 104, 146];
const DoomClockOverlay = React.memo(function DoomClockOverlay({ besitzer = [], spielstand = {} }) {
  const zaehler = Math.max(0, ...besitzer.map(i => spielstand.doomCounters?.[i] || 0));
  const t = Math.min(1, zaehler / DC_MAX);
  const winkelMin = 360 * t;               // 0 → :00, 20 → einmal herum
  const winkelStd = 330 + 30 * t;          // 11 Uhr → 12 Uhr
  const sek = useMemo(() => -new Date().getSeconds(), []);
  const asche = useMemo(() => ppZufall(ppFxN(18), () => ({
    x: Math.random() * 100, dur: 6 + Math.random() * 6, delay: -Math.random() * 12, glut: Math.random() < .5,
  })), []);
  const raeder = useMemo(() => DC_RAEDER.slice(0, ppFxN(6)).map(([x, y, gross], i) => ({
    x, y, gross, dreh: (gross ? 1.8 : 1.1) + Math.random() * .8, bob: 3 + Math.random() * 2.5,
    delay: -Math.random() * 6, rueck: i % 2 === 1,
  })), []);
  const blitze = useMemo(() => DC_BLITZE.slice(0, ppFxN(6)).map((x, i) => ({
    x, y: 18 + Math.random() * 8, bild: i % 3, dur: 7 + Math.random() * 9, delay: -Math.random() * 16,
  })), []);
  const kraehen = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    y: 6 + Math.random() * 26, dur: 22 + Math.random() * 16, delay: -Math.random() * 30, rtl: i % 2 === 0,
  })), []);
  const zeiger = (cls, stil) => {
    const [bw, bh, zx, zy] = DC_ZEIGER[cls];
    return (
      <i className={'dc-zeiger ' + cls} style={{
        left: ppArtX(-(zx + .5), 0), top: ppArt(DC_MITTE_Y - zy - .5), width: ppArt(bw), height: ppArt(bh),
        transformOrigin: `${ppArt(zx + .5)} ${ppArt(zy + .5)}`, ...stil,
      }} />
    );
  };
  return (
    <PixelScene artH={100} bg="#1a0409" className="doom-clock-overlay">
      <PixelBand src={DCL + 'sky.png'} />
      {blitze.map((b, i) => (
        <React.Fragment key={'b' + i}>
          <i className="pp-area-dyn dc-blitzschein" style={{ left: ppArtX(b.x - 20, 0), top: ppArt(b.y - 6), animation: `dcBlitz ${b.dur.toFixed(2)}s linear ${b.delay.toFixed(2)}s infinite` }} />
          <i className="pp-area-dyn dc-blitz" style={{ left: ppArtX(b.x - 5.5, 0), top: ppArt(b.y), backgroundPosition: `${b.bild * 50}% 0`, animation: `dcBlitz ${b.dur.toFixed(2)}s steps(1) ${b.delay.toFixed(2)}s infinite` }} />
        </React.Fragment>
      ))}
      <PixelBand src={DCL + 'clouds-far.png'} className="dc-ferne" />
      {kraehen.map((k, i) => (
        <div key={'k' + i} className="pp-area-dyn pp-quer" style={ppQuer(k.y, k.dur, k.delay, k.rtl)}>
          <i className="dc-kraehe" style={{ '--bob': ppArt(2), animation: 'ppSprite2 .3s steps(1) infinite, ppBob 1.7s ease-in-out infinite alternate', scale: k.rtl ? '-1 1' : undefined }} />
        </div>
      ))}
      {raeder.map((r, i) => (
        <i key={'r' + i} className={'pp-area-dyn dc-rad' + (r.gross ? ' gross' : '')} style={{
          left: ppArtX(r.x - (r.gross ? 6.5 : 4.5), 0), top: ppArt(r.y), '--bob': ppArt(3),
          animation: `ppSprite3 ${r.dreh.toFixed(2)}s steps(1) infinite ${r.rueck ? 'reverse' : ''}, ppBob ${r.bob.toFixed(2)}s steps(3) ${r.delay.toFixed(2)}s infinite alternate`,
        }} />
      ))}
      <PixelBand src={DCL + 'clouds-near.png'} className="dc-nah" />
      <PixelBand src={DCL + 'smoke.png'} className="dc-rauch" />
      <i className="dc-puls" style={{ '--dc-t': t, animationDuration: (3.2 - 2.4 * t).toFixed(2) + 's' }} />
      <PixelPiece src={DCL + 'clock.png'} w={91} />
      <i className="dc-spirale" style={{ animationDuration: (7 - 5 * t).toFixed(2) + 's' }} />
      {DC_SCHAEDEL.map(([dx, dy], i) => (
        <i key={'g' + i} className="pp-area-dyn dc-glut" style={{ left: ppArtX(dx - 4, 0), top: ppArt(DC_MITTE_Y + dy - 4.5), animationDelay: (-i * .7) + 's' }} />
      ))}
      {zeiger('std', { rotate: winkelStd + 'deg' })}
      {zeiger('min', { rotate: winkelMin + 'deg' })}
      {zeiger('sek', { animation: `ppDrehen 60s steps(60) ${sek}s infinite` })}
      <i className="dc-kappe" style={{ left: ppArtX(-3.5, 0), top: ppArt(DC_MITTE_Y - 3.5) }} />
      <PixelBand src={DCL + 'wisps.png'} className="dc-schwaden" />
      {asche.map((a, i) => (
        <i key={'a' + i} className={'pp-area-dyn dc-asche' + (a.glut ? ' glut' : '')} style={{ left: a.x + '%', animation: `dcAsche ${a.dur}s linear ${a.delay}s infinite` }} />
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        @keyframes dcWolken { from { background-position: 0 0; } to { background-position: calc(128 * var(--px)) 0; } }
        .dc-ferne { animation: dcWolken 300s steps(128) infinite; }
        .dc-nah { animation: dcWolken 170s steps(128) infinite; }
        .dc-rauch { animation: dcWolken 210s steps(128) infinite reverse; }
        .dc-schwaden { animation: dcWolken 75s steps(128) infinite; }
        .dc-puls {
          position: absolute; left: calc(50% - 60 * var(--px)); top: calc(${DC_MITTE_Y} * var(--px) - 60 * var(--px));
          width: calc(120 * var(--px)); height: calc(120 * var(--px)); border-radius: 50%;
          background: radial-gradient(circle, rgba(255,40,20,.55) 0%, rgba(200,10,10,.25) 40%, rgba(120,0,0,0) 70%);
          animation: dcPuls 3s ease-in-out infinite;
        }
        @keyframes dcPuls {
          0%, 100% { opacity: calc(.25 + .45 * var(--dc-t)); transform: scale(.95); }
          15% { opacity: calc(.45 + .55 * var(--dc-t)); transform: scale(1.04); }
          30% { opacity: calc(.3 + .45 * var(--dc-t)); transform: scale(.98); }
          42% { opacity: calc(.4 + .55 * var(--dc-t)); transform: scale(1.02); }
        }
        .dc-spirale {
          position: absolute; left: calc(50% - 30.5 * var(--px)); top: calc(${DC_MITTE_Y - 30.5} * var(--px));
          width: calc(61 * var(--px)); height: calc(61 * var(--px));
          background: url(${DCL}spiral.png) 0 0 / calc(61 * var(--px)) calc(854 * var(--px)) no-repeat;
          animation: dcSpirale 7s steps(14) infinite;
        }
        @keyframes dcSpirale { from { background-position: 0 0; } to { background-position: 0 calc(-854 * var(--px)); } }
        .dc-zeiger { position: absolute; background-size: 100% 100%; background-repeat: no-repeat; transition: rotate 1.4s cubic-bezier(.5, 0, .2, 1); }
        .dc-zeiger.std { background-image: url(${DCL}hand-hour.png); }
        .dc-zeiger.min { background-image: url(${DCL}hand-min.png); }
        .dc-zeiger.sek { background-image: url(${DCL}hand-sec.png); transition: none; }
        .dc-kappe { position: absolute; width: calc(7 * var(--px)); height: calc(7 * var(--px)); background: url(${DCL}cap.png) 0 0 / 100% 100% no-repeat; }
        .dc-glut {
          position: absolute; width: calc(8 * var(--px)); height: calc(8 * var(--px));
          background: radial-gradient(circle, rgba(255,40,40,.6) 0%, rgba(255,40,40,0) 70%);
          animation: dcGlut 2.8s ease-in-out infinite alternate;
        }
        @keyframes dcGlut { from { opacity: .25; } to { opacity: 1; } }
        .dc-blitz { position: absolute; width: calc(11 * var(--px)); height: calc(30 * var(--px)); background: url(${DCL}bolt.png) 0 0 / 300% 100% no-repeat; opacity: 0; }
        .dc-blitzschein {
          position: absolute; width: calc(40 * var(--px)); height: calc(40 * var(--px)); opacity: 0;
          background: radial-gradient(circle, rgba(255,120,80,.35) 0%, rgba(255,60,40,.12) 45%, rgba(255,40,20,0) 70%);
        }
        @keyframes dcBlitz { 0%, 90% { opacity: 0; } 91% { opacity: 1; } 92% { opacity: .15; } 93.5% { opacity: 1; } 96%, 100% { opacity: 0; } }
        .dc-rad { position: absolute; width: calc(9 * var(--px)); height: calc(9 * var(--px)); background: url(${DCL}gear-s.png) 0 0 / 300% 100% no-repeat; }
        .dc-rad.gross { width: calc(13 * var(--px)); height: calc(13 * var(--px)); background-image: url(${DCL}gear.png); }
        .dc-kraehe { display: block; width: calc(7 * var(--px)); height: calc(4 * var(--px)); background: url(${DCL}crow.png) 0 0 / 200% 100% no-repeat; }
        .dc-asche { position: absolute; top: calc(98 * var(--px)); width: var(--px); height: var(--px); background: #3a0a0a; opacity: 0; }
        .dc-asche.glut { background: #ff5a2a; }
        @keyframes dcAsche { 0% { transform: translate(0,0); opacity: 0; } 15% { opacity: .9; } 100% { transform: translate(calc(4 * var(--px)), calc(-64 * var(--px))); opacity: 0; } }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  GRAVEYARD OF LIMITED POWER — Friedhof im Kies (v1415, Kartenstil;
//  Überarbeitung v1441 (Al 25.9.))
//
//  Karte: Kiesboden, rosa Grabsteine mit rotem Schein, dunkler Baum mit
//  Laterne. Der rote Schein pulsiert, Seelen steigen aus den Gräbern,
//  Bodennebel zieht, die Laterne flackert. Draufsicht leicht von vorn
//  wie auf der Karte.
//
//  Überarbeitung v1441 (Al 25.9.: die neuen Szenen „haben ein anderes
//  Level"): Kies aus einzelnen, schattierten Steinchen statt flachem
//  Rauschen, Erdflecken, Unkraut, Laub, ein paar Knöchelchen. Die Gräber
//  stehen versetzt statt im Raster, hinten kleiner, vorn größer:
//  Rundbogensteine mit eingemeißeltem Kreuz und Inschriftstrichen,
//  Steinkreuze, ein zerbrochener Stein mit abgebrochenem Stück daneben,
//  ein hoher Spitzbogenstein; jeder auf einem Sockel mit Grabhügel davor,
//  mit Schlagschatten, Rissen, Moos, Flechten und Grasbüscheln; rote
//  Grablichter. Der Baum ist jetzt ein großer knorriger Baum mit Wurzeln,
//  Astloch, dürren Zweigen und Schlagschatten; die Laterne hängt an einer
//  Kette an seinem langen linken Ast und wirft einen warmen Lichtfleck
//  auf den Kies. Licht IMMER oben rechts.
//
//  Ebenen (Kunsthöhe 100; per Generator gemalt, der nicht im Projekt
//  liegt): tile.png — Kachel 128 (Kies + zwölf Gräber); glow-a.png /
//  glow-b.png — roter Schein zweier Gräbergruppen (pulsieren versetzt,
//  die eingemeißelten Kreuze glühen mit); candles.png — Flammen der
//  Grablichter (3 Bilder übereinander); tree.png — Baum, Stück 104,
//  rechts neben der Mitte; tree-glow.png — Laternenschein; lantern.png
//  (7×10), crow.png (10×8), soul.png (7×11) — je 3–4 Bilder
//  nebeneinander; fog.png — Bodennebel, Kachel 128.
//
//  Animiert: der rote Schein pulsiert (zwei Gruppen im Wechsel), Seelen
//  steigen schwankend aus den Gräbern und verblassen, rote Funken
//  glimmen auf, Grablichter und Laterne flackern (mit Schein), Motten
//  umschwirren die Laterne, eine Krähe im Baum dreht den Kopf und
//  krächzt, dürre Blätter fallen, Bodennebel zieht in zwei Lagen.
// ═══════════════════════════════════════════════════════════════════
const GYD = '/areas/graveyard/';
const GYD_TREE_W = 104, GYD_TREE_X = 64;                 // Baum-Stück, Mitte neben der Brettmitte
// Gräber in Kachel-Koordinaten: [Mitte x, Oberkante Stein, Sockel-Unterkante]
const GYD_GRAEBER = [[34, 8, 22], [62, 3, 20], [88, 9, 23], [48, 31, 46], [80, 28, 47], [30, 60, 71],
  [64, 53, 69], [98, 52, 72], [10, 79, 96], [46, 74, 95], [80, 80, 97], [114, 72, 94]];
// Kachel-x → Kunstpixel neben der Brettmitte (Kachelmitte = Brettmitte), Wiederholung k
const gydX = (x, k) => x - 64 + k * 128;
const GYD_LATERNE = { x: GYD_TREE_X - GYD_TREE_W / 2 + 27, y: 26 };   // Mitte, Oberkante
const GYD_KRAEHE = { x: GYD_TREE_X - GYD_TREE_W / 2 + 74, y: 6 };     // Mitte, Oberkante
const GraveyardOfLimitedPowerOverlay = React.memo(function GraveyardOfLimitedPowerOverlay() {
  const seelen = useMemo(() => ppZufall(ppFxN(9), () => {
    const [gx, , gb] = GYD_GRAEBER[Math.floor(Math.random() * GYD_GRAEBER.length)];
    const k = Math.floor(Math.random() * 3) - 1;
    return { x: gydX(gx, k), y: gb - 12, dur: 6 + Math.random() * 4, delay: -Math.random() * 10, bild: .5 + Math.random() * .3 };
  }), []);
  const funken = useMemo(() => ppZufall(ppFxN(14), () => {
    const [gx, gt, gb] = GYD_GRAEBER[Math.floor(Math.random() * GYD_GRAEBER.length)];
    const k = Math.floor(Math.random() * 5) - 2;
    return {
      x: gydX(gx, k) + Math.round((Math.random() - .5) * 12), y: gt + Math.round(Math.random() * (gb - gt)),
      dx: Math.round((Math.random() - .5) * 4), dur: 3 + Math.random() * 3, delay: -Math.random() * 6,
    };
  }), []);
  const blaetter = useMemo(() => ppZufall(ppFxN(3), () => ({
    x: GYD_TREE_X - 40 + Math.round(Math.random() * 80), y: 4 + Math.round(Math.random() * 18),
    dur: 9 + Math.random() * 6, delay: -Math.random() * 15, rot: Math.random() < .5,
  })), []);
  const motten = useMemo(() => ppZufall(ppFxN(2), (i) => ({ dur: 1.6 + i * .5, delay: -Math.random() * 2, rev: i % 2 === 1 })), []);
  return (
    <PixelScene artH={100} bg="#322e2f" className="graveyard-overlay">
      <PixelBand src={GYD + 'tile.png'} />
      <PixelBand src={GYD + 'glow-a.png'} className="gyd-schein" />
      <PixelBand src={GYD + 'glow-b.png'} className="gyd-schein b" />
      <PixelBand src={GYD + 'candles.png'} className="gyd-kerzen" style={{ backgroundSize: 'auto 300%' }} />
      <div className="pp-pixel-layer gyd-nebel" style={{ top: ppArt(30) }} />
      {seelen.map((s, i) => (
        <i key={'s' + i} className="pp-area-dyn gyd-seele" style={{
          left: ppArtX(s.x - 3, 0), top: ppArt(s.y),
          animation: `gydBild ${s.bild.toFixed(2)}s steps(1) infinite, gydSteigen ${s.dur.toFixed(2)}s steps(24) ${s.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {funken.map((f, i) => (
        <i key={'f' + i} className="pp-area-dyn gyd-funke" style={{
          left: ppArtX(f.x, 0), top: ppArt(f.y), '--dx': ppArt(f.dx),
          animation: `gydFunke ${f.dur.toFixed(2)}s steps(10) ${f.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      <PixelPiece src={GYD + 'tree.png'} w={GYD_TREE_W} x={GYD_TREE_X} />
      <PixelPiece src={GYD + 'tree-glow.png'} w={GYD_TREE_W} x={GYD_TREE_X} className="gyd-laternenschein" />
      <i className="gyd-laterne" style={{ left: ppArtX(GYD_LATERNE.x - 3, 0), top: ppArt(GYD_LATERNE.y) }} />
      {motten.map((m, i) => (
        <i key={'m' + i} className="pp-area-dyn gyd-motte" style={{
          left: ppArtX(GYD_LATERNE.x, 0), top: ppArt(GYD_LATERNE.y + 4),
          animation: `gydMotte ${m.dur.toFixed(2)}s steps(1) ${m.delay.toFixed(2)}s infinite${m.rev ? ' reverse' : ''}`,
        }} />
      ))}
      <i className="gyd-kraehe" style={{ left: ppArtX(GYD_KRAEHE.x - 5, 0), top: ppArt(GYD_KRAEHE.y) }} />
      {blaetter.map((b, i) => (
        <i key={'b' + i} className={'pp-area-dyn gyd-blatt' + (b.rot ? ' rot' : '')} style={{
          left: ppArtX(b.x, 0), top: ppArt(b.y),
          animation: `gydFallen ${b.dur.toFixed(2)}s steps(40) ${b.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      <div className="pp-pixel-layer gyd-nebel b" style={{ top: ppArt(72) }} />
      <div className="pp-rand-dim" />
      <style>{`
        .gyd-schein { animation: gydPuls 3.4s ease-in-out infinite alternate; }
        .gyd-schein.b { animation-delay: -3.4s; }
        @keyframes gydPuls { from { opacity: .35; } to { opacity: 1; } }
        .gyd-kerzen { animation: gydKerze .9s steps(1) infinite; }
        @keyframes gydKerze {
          0% { background-position: 50% 0%; } 22% { background-position: 50% 50%; } 38% { background-position: 50% 0%; }
          55% { background-position: 50% 100%; } 72% { background-position: 50% 50%; } 86% { background-position: 50% 100%; }
        }
        .gyd-laternenschein { animation: gydFlackern 2.3s steps(1) infinite; }
        @keyframes gydFlackern { 0% { opacity: 1; } 21% { opacity: .72; } 24% { opacity: 1; } 55% { opacity: .86; } 58% { opacity: .6; } 61% { opacity: .95; } 80% { opacity: .8; } 83% { opacity: 1; } }
        .gyd-laterne {
          position: absolute; width: calc(7 * var(--px)); height: calc(10 * var(--px));
          background: url(${GYD}lantern.png) 0 0 / 300% 100% no-repeat;
          animation: gydLaterne 1.15s steps(1) infinite;
        }
        @keyframes gydLaterne { 0% { background-position: 0 0; } 30% { background-position: 50% 0; } 42% { background-position: 0 0; } 70% { background-position: 100% 0; } 84% { background-position: 50% 0; } }
        .gyd-motte { position: absolute; width: var(--px); height: var(--px); background: #d8cdb8; }
        @keyframes gydMotte {
          0% { transform: translate(calc(4 * var(--px)), calc(-2 * var(--px))); }
          12% { transform: translate(calc(5 * var(--px)), calc(1 * var(--px))); }
          25% { transform: translate(calc(3 * var(--px)), calc(4 * var(--px))); }
          37% { transform: translate(calc(-1 * var(--px)), calc(5 * var(--px))); }
          50% { transform: translate(calc(-5 * var(--px)), calc(3 * var(--px))); }
          62% { transform: translate(calc(-6 * var(--px)), calc(0 * var(--px))); }
          75% { transform: translate(calc(-4 * var(--px)), calc(-3 * var(--px))); }
          87% { transform: translate(calc(0 * var(--px)), calc(-4 * var(--px))); }
        }
        .gyd-kraehe {
          position: absolute; width: calc(10 * var(--px)); height: calc(8 * var(--px));
          background: url(${GYD}crow.png) 0 0 / 300% 100% no-repeat;
          animation: gydKraehe 9s steps(1) infinite;
        }
        @keyframes gydKraehe {
          0%, 38% { background-position: 0 0; } 40%, 52% { background-position: 50% 0; } 54%, 70% { background-position: 0 0; }
          72%, 74% { background-position: 100% 0; } 76%, 78% { background-position: 0 0; } 80%, 82% { background-position: 100% 0; }
          84%, 100% { background-position: 0 0; }
        }
        .gyd-nebel {
          position: absolute; left: 0; right: 0; height: calc(24 * var(--px));
          background: url(${GYD}fog.png) 0 0 / auto 100% repeat-x; opacity: .75;
          animation: gydNebel 64s steps(128) infinite;
        }
        .gyd-nebel.b { animation-duration: 92s; animation-direction: reverse; opacity: .6; }
        @keyframes gydNebel { from { background-position: 0 0; } to { background-position: calc(128 * var(--px)) 0; } }
        .gyd-seele { position: absolute; width: calc(7 * var(--px)); height: calc(11 * var(--px)); background: url(${GYD}soul.png) 0 0 / 400% 100% no-repeat; opacity: 0; }
        @keyframes gydBild { 0% { background-position: 0 0; } 25% { background-position: 33.333% 0; } 50% { background-position: 66.667% 0; } 75% { background-position: 100% 0; } }
        @keyframes gydSteigen {
          0% { transform: translate(0, 0); opacity: 0; }
          15% { opacity: .85; }
          30% { transform: translate(var(--px), calc(-7 * var(--px))); }
          55% { transform: translate(calc(-1 * var(--px)), calc(-13 * var(--px))); opacity: .7; }
          80% { transform: translate(var(--px), calc(-19 * var(--px))); }
          100% { transform: translate(0, calc(-24 * var(--px))); opacity: 0; }
        }
        .gyd-funke { position: absolute; width: var(--px); height: var(--px); background: #ff5060; opacity: 0; }
        @keyframes gydFunke {
          0% { transform: translate(0, 0); opacity: 0; } 20% { opacity: .9; } 50% { opacity: .4; } 70% { opacity: .8; }
          100% { transform: translate(var(--dx), calc(-10 * var(--px))); opacity: 0; }
        }
        .gyd-blatt { position: absolute; width: calc(2 * var(--px)); height: var(--px); background: #5a2620; box-shadow: var(--px) 0 0 #7c3a26; opacity: 0; }
        .gyd-blatt.rot { background: #6a2c22; box-shadow: var(--px) 0 0 #3c1a17; }
        @keyframes gydFallen {
          0% { transform: translate(0, 0); opacity: 0; } 2% { opacity: 1; }
          10% { transform: translate(calc(2 * var(--px)), calc(6 * var(--px))); }
          20% { transform: translate(calc(-1 * var(--px)), calc(13 * var(--px))); }
          30% { transform: translate(calc(2 * var(--px)), calc(20 * var(--px))); }
          40% { transform: translate(0, calc(27 * var(--px))); opacity: 1; }
          55% { transform: translate(0, calc(27 * var(--px))); opacity: 0; }
          100% { transform: translate(0, calc(27 * var(--px))); opacity: 0; }
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  PARASEED GREENHOUSE — Gewächshaus mit Fleischbeet (v1415, Kartenstil)
//  Überarbeitung v1441 (Al 25.9.)
//
//  Karte: Gewächshaus mit grauen, diagonal gestreiften Glasscheiben, ein
//  Pflanztrog voll wucherndem Fleisch mit grellbunten Blüten. Als
//  früherer Wunsch (5.9.): „grellbunte Blumen, die ungesund und abartig
//  wirken".
//  v1428 (Al 25.9.): Schattengestalten raus, dafür mehr Detail: Stahl-
//  rahmen mit Nieten und Dachrinne, Scheiben mit trüben Pflanzen
//  dahinter, Kondenstropfen und einem Sprung, Kletterranken mit
//  Saugnäpfen, Fleischerde mit Adern, pochenden Pusteln und Knochen-
//  splittern, Trogfront mit Rippen, Rost und Schildchen.
//  v1429 (Al 25.9.: „die Pflanze mit dem Auge passt gar nicht", Pflanzen
//  brauchen mehr Detail): große Blütenköpfe mit einzelnen Blättern
//  (Tulpe, Glocke mit Staubgefäßen, Stachelblüte mit Samenkern), breite
//  Blätter mit Mittelrippe, Stiele mit Knoten und Dornen. In der Mitte
//  statt der Augenblüte ein wucherndes Samengewächs: klumpige, geäderte
//  Fleischkapsel, aufgeplatzt, Samen glühen giftgrün durch, Ranken an
//  der Spitze, Schleim tropft.
//  v1430 (Al 25.9.: „die Pflanzen bewegen sich alle perfekt im Takt",
//  mehr als zwei Bilder): jede Blume ist ein EIGENES Element mit eigenem
//  Bildband (8 Bilder: Mitte → rechts → Mitte → links, Stiel biegt sich
//  von unten nach oben) und eigener, zufälliger Dauer und Phase.
//
//  Überarbeitung v1441 (Al 25.9.: „deine haben ein anderes Level"):
//  dieselbe Szene, neu gemalt und mit Tiefe. Kachel 128 statt 64 (vier
//  verschiedene Scheibenspalten statt einer), das Fleisch in zwei Reihen
//  schattierter, nasser Wülste mit Blutergüssen, Adern, Pusteln,
//  Knochensplittern, Maden und einer Zahnreihe; die Blumen wurzeln
//  ZWISCHEN den Reihen und stehen nicht mehr im Raster, sondern werden je
//  Spiel verstreut (zehn Sorten: Tulpen, Glocken mit Staubgefäßen,
//  Stachelblüten mit Samenkern, Fleischtrauben mit Schlitzen, Schlund-
//  blüten mit Zähnen — grellbunt, fleckig). Die Kapsel ist größer, atmet
//  und hat Wurzeln, die übers Beet kriechen.
//
//  Ebenen (Kunsthöhe 100; per Generator gemalt, der nicht im Projekt
//  liegt): tile.png — Kachel 128: Dachscheiben, Traufbalken mit Nieten
//  und Rinne, Bewässerungsrohr mit Düsen und Handrad, Glaswand (trübe
//  Pflanzen dahinter, Streifen, Kondensat, Laufspuren, Schmutz und Moos
//  unten, Sprung mit Loch, Klebeband, gekippte Lüftungsklappe), Stahl-
//  rahmen mit Knotenblechen und Rost, Kletterranken mit Saugnäpfen,
//  hinterer Trogrand, hintere Fleischwülste mit Knospen; shafts.png —
//  Sonnenstrahlen durchs Glas; bloom.png — Blumen (8 Bilder × 10 Sorten,
//  Zelle 26×46); front.png — vordere Wülste, über den Rand hängendes
//  Fleisch und Schleimfäden, Trogrand mit Nieten, Rippenblech mit Laschen,
//  Rost, zwei Schildchen und einem Riss, durch den Fleisch quillt,
//  Fliesenboden mit Blut- und Schleimlache; tile-glow/front-glow.png —
//  Pusteln; pod.png — Samengewächs 64 breit (3 Bilder übereinander);
//  pod-glow.png — Samen; haze.png — fauliger Dunst (Kachel 128×26);
//  drop.png, fly.png, slug.png.
//
//  Animiert: Blumen wiegen einzeln (8 Bilder, eigene Dauer/Phase), die
//  Kapsel atmet, Samen glühen, Schleim tropft aus dem Riss, Pusteln
//  pochen, Wasser tropft aus den Düsen, Kondenstropfen laufen am Glas
//  herab, Sonnenstrahlen wandern (Wolken), fauliger Dunst zieht übers
//  Beet, Fleischfliegen schwirren
//  übers Beet, eine Nacktschnecke kriecht am Glas, Sporen steigen.
//  Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const PSG = '/areas/paraseed-greenhouse/';
const PSG_KACHEL = 128;
// Scheiben der Kachel (x-Bereiche, Kachel-x) und Scheibenreihen (y-Bereiche).
const PSG_SCHEIBEN = [[3, 29], [35, 61], [67, 93], [99, 125]];
const PSG_REIHEN = [[11, 24], [32, 43], [51, 62]];
// Düsen des Bewässerungsrohrs (Kachel-x), Wasser fällt bis ins Beet.
const PSG_DUESEN = [44, 108];
// Blumen: Zelle 26×46, Fuß bei (12, 45), 8 Bilder, 10 Sorten (Zeilen).
const PSG_BLUME = { w: 26, h: 46, fussX: 12, fussY: 45, bilder: 8, sorten: 10 };
const PSG_POD_W = 64;
const ParaseedGreenhouseOverlay = React.memo(function ParaseedGreenhouseOverlay() {
  // Blumen verstreut (nicht im Raster), die Kapsel in der Mitte frei lassen
  const blumen = useMemo(() => {
    const out = [];
    let letzte = -1;
    for (let x = -262 + Math.random() * 6; x < 262; x += 10 + Math.random() * 8) {
      if (Math.abs(x) < 19) continue;
      let sorte;
      do { sorte = Math.floor(Math.random() * PSG_BLUME.sorten); } while (sorte === letzte);
      letzte = sorte;
      out.push({
        x: Math.round(x), fuss: 76 + Math.floor(Math.random() * 5), sorte,
        dur: 2.4 + Math.random() * 1.8, delay: -Math.random() * 4,
      });
    }
    return out;
  }, []);
  const tropfen = useMemo(() => ppZufall(ppFxN(8), () => {
    const [a, e] = PSG_SCHEIBEN[Math.floor(Math.random() * 4)];
    const [r0, r1] = PSG_REIHEN[Math.floor(Math.random() * 3)];
    const k = Math.floor(Math.random() * 5) - 2;
    const y = r0 + Math.random() * (r1 - r0 - 5);
    return {
      x: Math.round(a + 1 + Math.random() * (e - a - 3)) - PSG_KACHEL / 2 + k * PSG_KACHEL, y: Math.round(y),
      fall: Math.max(3, Math.round(r1 - y - 2)), dur: 6 + Math.random() * 7, delay: -Math.random() * 13,
    };
  }), []);
  const duesen = useMemo(() => {
    const out = [];
    for (let k = -2; k <= 2; k++) PSG_DUESEN.forEach((x) => out.push({ x: x - PSG_KACHEL / 2 + k * PSG_KACHEL, dur: 2.6 + Math.random() * 2.4, delay: -Math.random() * 4 }));
    return out.slice(0, ppFxN(out.length));
  }, []);
  const fliegen = useMemo(() => ppZufall(ppFxN(4), () => ({
    x: Math.round((Math.random() - .5) * 220), y: 58 + Math.round(Math.random() * 10),
    dur: 3.5 + Math.random() * 3, delay: -Math.random() * 6, rtl: Math.random() < .5,
  })), []);
  const schnecke = useMemo(() => ppZufall(Math.min(1, ppFxN(1)), () => ({
    y: 55 + Math.floor(Math.random() * 4), dur: 260 + Math.random() * 80, delay: -Math.random() * 260,
  })), []);
  const sporen = useMemo(() => ppZufall(ppFxN(14), () => ({
    x: Math.random() * 100, y: 66 + Math.round(Math.random() * 8), dur: 7 + Math.random() * 6, delay: -Math.random() * 12,
    farbe: Math.random() < .5 ? '#c9ff2f' : '#ff6ad5',
  })), []);
  const B = PSG_BLUME;
  return (
    <PixelScene artH={100} bg="#7c807a" className="paraseed-greenhouse-overlay">
      <PixelBand src={PSG + 'tile.png'} />
      <PixelBand src={PSG + 'tile-glow.png'} className="psg-pochen" />
      <PixelBand src={PSG + 'shafts.png'} className="psg-strahlen" />
      {tropfen.map((t, i) => (
        <i key={'t' + i} className="pp-area-dyn psg-tropfen" style={{
          left: ppArtX(t.x, 0), top: ppArt(t.y), '--fall': ppArt(t.fall),
          animation: `psgTropfen ${t.dur.toFixed(2)}s steps(${t.fall * 2}) ${t.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {schnecke.map((s, i) => (
        <div key={'n' + i} className="pp-area-dyn pp-quer" style={{ top: ppArt(s.y), animation: `ppQuerRtl ${s.dur.toFixed(0)}s linear ${s.delay.toFixed(0)}s infinite` }}>
          <i className="psg-schnecke" />
        </div>
      ))}
      {duesen.map((d, i) => (
        <i key={'d' + i} className="pp-area-dyn pp-px-tropfen" style={{
          left: ppArtX(d.x, 0), top: ppArt(18), '--fall': ppArt(42),
          '--tropfen': '#c4d0cc', '--tropfen-dunkel': '#7e8a86',
          animation: `ppPxTropfen ${d.dur.toFixed(2)}s ease-in ${d.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {blumen.map((b, i) => (
        <i key={'b' + i} className="psg-blume" style={{
          left: ppArtX(b.x - B.fussX, 0), top: ppArt(b.fuss - B.fussY),
          backgroundPositionY: `${(b.sorte / (B.sorten - 1)) * 100}%`,
          animation: `psgWiegen ${b.dur.toFixed(2)}s steps(${B.bilder}) ${b.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      <div className="pp-pixel-layer psg-dunst" style={{ top: ppArt(52) }} />
      <PixelBand src={PSG + 'front.png'} />
      <PixelBand src={PSG + 'front-glow.png'} className="psg-pochen b" />
      <PixelPiece src={PSG + 'pod.png'} w={PSG_POD_W} className="psg-atmen" style={{ backgroundSize: '100% 300%' }} />
      <PixelPiece src={PSG + 'pod-glow.png'} w={PSG_POD_W} className="psg-samen" />
      <i className="pp-area-dyn pp-px-tropfen" style={{
        left: ppArtX(-1, 0), top: ppArt(56), '--fall': ppArt(18),
        '--tropfen': '#b6f25a', '--tropfen-dunkel': '#5c8a1c',
        animation: 'ppPxTropfen 4.6s ease-in -1.2s infinite',
      }} />
      <i className="pp-area-dyn pp-px-tropfen" style={{
        left: ppArtX(1, 0), top: ppArt(51), '--fall': ppArt(22),
        '--tropfen': '#b6f25a', '--tropfen-dunkel': '#5c8a1c',
        animation: 'ppPxTropfen 6.1s ease-in -3.9s infinite',
      }} />
      <div className="pp-pixel-layer psg-dunst b" style={{ top: ppArt(64) }} />
      {fliegen.map((f, i) => (
        <i key={'f' + i} className="pp-area-dyn psg-fliege" style={{
          left: ppArtX(f.x, 0), top: ppArt(f.y), transform: f.rtl ? 'scaleX(-1)' : undefined,
          animation: `ppSprite2 .12s steps(1) infinite, ${f.rtl ? 'psgSchwirrenB' : 'psgSchwirren'} ${f.dur.toFixed(2)}s steps(1) ${f.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {sporen.map((s, i) => (
        <i key={'s' + i} className="pp-area-dyn psg-spore" style={{
          left: s.x + '%', top: ppArt(s.y), background: s.farbe,
          animation: `psgSpore ${s.dur.toFixed(2)}s steps(40) ${s.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .psg-blume {
          position: absolute; width: calc(${B.w} * var(--px)); height: calc(${B.h} * var(--px));
          background: url(${PSG}bloom.png) 0 0 / ${B.bilder * 100}% ${B.sorten * 100}% no-repeat;
        }
        @keyframes psgWiegen { from { background-position-x: 0; } to { background-position-x: calc(-${B.w * B.bilder} * var(--px)); } }
        .psg-pochen { animation: psgPochen 1.9s ease-in-out infinite; }
        .psg-pochen.b { animation-delay: -.7s; animation-duration: 2.3s; }
        @keyframes psgPochen { 0%, 100% { opacity: .3; } 18% { opacity: 1; } 32% { opacity: .5; } 44% { opacity: .9; } }
        .psg-strahlen { animation: psgStrahlen 17s ease-in-out infinite; }
        @keyframes psgStrahlen { 0%, 100% { opacity: .9; } 30% { opacity: .35; } 45% { opacity: .15; } 60% { opacity: .6; } 80% { opacity: 1; } }
        .psg-atmen { animation: psgAtmen 3.8s steps(1) infinite; }
        @keyframes psgAtmen {
          0% { background-position: 0 0%; } 30% { background-position: 0 50%; } 45% { background-position: 0 100%; }
          70% { background-position: 0 50%; } 85% { background-position: 0 0%; }
        }
        .psg-samen { animation: psgSamen 2.6s ease-in-out infinite alternate; }
        @keyframes psgSamen { from { opacity: .3; } to { opacity: 1; } }
        .psg-tropfen {
          position: absolute; width: calc(2 * var(--px)); height: calc(3 * var(--px));
          background: url(${PSG}drop.png) 0 0 / 100% 100% no-repeat; opacity: 0;
        }
        @keyframes psgTropfen {
          0% { transform: translateY(0); opacity: 0; } 6% { opacity: 1; }
          45% { transform: translateY(calc(var(--fall) * .15)); }
          60% { transform: translateY(calc(var(--fall) * .25)); }
          94% { opacity: 1; } 100% { transform: translateY(var(--fall)); opacity: 0; }
        }
        .psg-schnecke {
          display: block; width: calc(7 * var(--px)); height: calc(4 * var(--px));
          background: url(${PSG}slug.png) 0 0 / 200% 100% no-repeat; animation: ppSprite2 1.6s steps(1) infinite;
        }
        .psg-fliege {
          position: absolute; width: calc(3 * var(--px)); height: calc(3 * var(--px));
          background: url(${PSG}fly.png) 0 0 / 200% 100% no-repeat;
        }
        @keyframes psgSchwirren {
          0% { translate: 0 0; } 10% { translate: calc(3 * var(--px)) calc(-2 * var(--px)); } 20% { translate: calc(6 * var(--px)) calc(-1 * var(--px)); }
          30% { translate: calc(8 * var(--px)) calc(-4 * var(--px)); } 40% { translate: calc(5 * var(--px)) calc(-6 * var(--px)); }
          50% { translate: calc(2 * var(--px)) calc(-5 * var(--px)); } 60% { translate: calc(-2 * var(--px)) calc(-3 * var(--px)); }
          70% { translate: calc(-5 * var(--px)) calc(-4 * var(--px)); } 80% { translate: calc(-4 * var(--px)) calc(-1 * var(--px)); }
          90% { translate: calc(-1 * var(--px)) calc(1 * var(--px)); } 100% { translate: 0 0; }
        }
        @keyframes psgSchwirrenB {
          0% { translate: 0 0; } 12% { translate: calc(-2 * var(--px)) calc(-3 * var(--px)); } 25% { translate: calc(2 * var(--px)) calc(-6 * var(--px)); }
          37% { translate: calc(6 * var(--px)) calc(-5 * var(--px)); } 50% { translate: calc(7 * var(--px)) calc(-2 * var(--px)); }
          62% { translate: calc(4 * var(--px)) 0; } 75% { translate: calc(1 * var(--px)) calc(-2 * var(--px)); }
          87% { translate: calc(-3 * var(--px)) calc(-1 * var(--px)); } 100% { translate: 0 0; }
        }
        .psg-dunst {
          position: absolute; left: 0; right: 0; height: calc(26 * var(--px));
          background: url(${PSG}haze.png) 0 0 / auto 100% repeat-x; opacity: .8; animation: psgDunst 70s steps(128) infinite;
        }
        .psg-dunst.b { opacity: .55; animation-duration: 95s; animation-direction: reverse; }
        @keyframes psgDunst { from { background-position: 0 0; } to { background-position: calc(${PSG_KACHEL} * var(--px)) 0; } }
        .psg-spore { position: absolute; width: var(--px); height: var(--px); opacity: 0; }
        @keyframes psgSpore {
          0% { transform: translate(0, 0); opacity: 0; } 12% { opacity: .9; }
          50% { transform: translate(calc(3 * var(--px)), calc(-28 * var(--px))); }
          100% { transform: translate(calc(-2 * var(--px)), calc(-58 * var(--px))); opacity: 0; }
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  RIOTING VILLAGE — Überarbeitung v1441 (Al 25.9.)
//
//  Karte: graue Bruchsteinmauer, dunkler Eingang, darin ein rotes Auge,
//  staubiger Trampelpfad auf grauem Grund. Ein Dorf im Aufruhr.
//
//  Als Vorgaben (bleiben):
//  • Neubau v1431: Das rote Auge ist NICHT an die Wand gemalt — es gehört
//    einer Schattengestalt, die aus einem Eingang schaut; das Auge schaut
//    umher und blinzelt. Die Mauern haben Risse, Scherben und Trümmer
//    liegen herum, es brennt (Brandherde, Rauch, Funken, Feuerschein).
//  • v1432 („die Fenster haben nur 2 Modi, die Feuer am Boden sind perfekt
//    gleichmäßig"): Kachel 192 breit, drei Hausabschnitte in leicht
//    verschiedenen Steintönen, sechs Fensterzustände — zerbrochen,
//    brennend, vernagelt, heil und dunkel, Fensterladen hängt schief,
//    herausgebrochenes Mauerloch mit Schutt. Trümmer, Planken und Scherben
//    liegen ZUFÄLLIG. Die Bodenfeuer stehen NICHT in der Kachel: jedes
//    Spiel würfelt Anzahl, Lage und Größe (drei Flammengrößen, jede mit
//    eigenem verkohlten Haufen und Schein).
//
//  Überarbeitung v1441 (Al 25.9.: „deine haben ein anderes Level"): statt
//  einer flachen Wand jetzt eine Häuserzeile mit Dächern und Tiefe.
//  Ebenen (Kunsthöhe 100; per Generator gemalt, der nicht im Projekt liegt):
//  sky.png — Kachel 128: verrauchter Nachthimmel, von unten rot angeleuchtet,
//  ferne Dachsilhouetten mit Kirchturm und fernen Bränden (sky-glow.png
//  flackert); haze.png — Rauchschwaden, ziehen langsam nach links;
//  tile.png — Kachel 192: Stroh-Walmdach mit Brandloch, Giebelhaus mit
//  Ziegeln und Fachwerk (vernagelte Tür, Fackelhalter), Schieferhaus mit
//  aufgerissenem Dach, Esse und angelehnter Leiter; Bruchsteinmauern mit
//  Rissen und Ruß, die sechs Fensterzustände, Gassen, Pflaster, Straße mit
//  Spurrillen, Pfütze, Fass, Kisten, Bretter, Wagenrad (tile-glow.png:
//  Feuerschein, flackert); house.png — Mittelstück 76: Treppengiebelhaus
//  mit Rundbogen-Eingang, die Tür aus der Angel gerissen, darin die
//  Kapuzengestalt mit Feuerschein-Kante (von der Fackel daneben), oben ein
//  zerbrochenes Fenster mit herauswehendem Vorhang und eins mit Brand
//  dahinter, schiefe Wetterfahne, Stufen, Schutt (house-glow.png).
//  Sprites: eye (5), sign (4), shutter (3), fire-s/m/l (6) + heap-s/m/l,
//  fire-win (6), fire-roof (6), torch (4), smoke (8), puff (4),
//  debris (10 Varianten), rioter (2 Figuren × 2 Richtungen × 4 Bilder).
//
//  Animiert: Bodenfeuer (zufällig) mit Glut, Schein und Rauchwölkchen,
//  Fensterflammen schlagen heraus, das Strohdach brennt, eine Rauchsäule
//  quillt, Fackeln flackern, Funken steigen, Asche rieselt, Rauch zieht,
//  ferne Brände glimmen, der Fensterladen und das Wirtshausschild
//  schaukeln, Aufrührer mit Fackel und Mistgabel ziehen an den Häusern
//  vorbei (HINTER dem Mittelhaus), das Auge schaut umher und blinzelt.
//  Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const RVG = '/areas/rioting-village/';
const RVG_HAUS_W = 76;
const RVG_KACHEL = 192;
// Positionen in der Kachel (Kunstpixel neben der Kachelmitte 96) — vom Generator
const RVG_FENSTERFEUER = [{ x: 45.5 - 96, y: 35 }, { x: 168.5 - 96, y: 34 }];   // Fenster-Oberkante
const RVG_DACHFEUER = [{ x: 42 - 96, y: 23 }];                                 // Unterkante Flammen
const RVG_FACKELN = [{ x: 107.5 - 96, y: 41 }];                                // Fackel-Fuß
const RVG_LADEN = { x: 127 - 96, y: 34 };                                       // Ladenbild oben links
// Mittelhaus (Stück-x → Brett-x: x - 38)
const RVG_AUGE = { x: 32.5 - 38, y: 46 };
const RVG_SCHILD = { x: 50 - 38, y: 45 };
const RVG_HAUSFACKEL = { x: 52.5 - 38, y: 49 };
const RVG_FEUER = { s: { w: 8, h: 10, hh: 4 }, m: { w: 10, h: 13, hh: 4 }, l: { w: 13, h: 17, hh: 5 } };
const RVG_BILDER = 6;
const RiotingVillageOverlay = React.memo(function RiotingVillageOverlay() {
  // Kachel-Dinge über die ganze Breite (−2 … +2 Kacheln), hinter dem Mittelhaus weglassen
  const kachel = useMemo(() => {
    const auf = (liste, verdeckt) => {
      const out = [];
      for (let k = -2; k <= 2; k++) for (const p of liste) {
        const x = p.x + k * RVG_KACHEL;
        if (Math.abs(x) < 230 && Math.abs(x) > verdeckt) out.push({ ...p, x });
      }
      return out;
    };
    return {
      fenster: auf(RVG_FENSTERFEUER, 36).map(f => ({ ...f, dur: .5 + Math.random() * .25, delay: -Math.random() })),
      dach: auf(RVG_DACHFEUER, 30).map(f => ({ ...f, dur: .6 + Math.random() * .2, delay: -Math.random() })),
      fackeln: auf(RVG_FACKELN, 36).map(f => ({ ...f, dur: .4 + Math.random() * .15 })),
      laeden: auf([RVG_LADEN], 44).map(l => ({ ...l, dur: 2.6 + Math.random() * 1.4, delay: -Math.random() * 3 })),
    };
  }, []);
  const feuer = useMemo(() => {
    // Bodenfeuer: zufällig verteilt, mit Mindestabstand, drei Größen
    const out = [];
    const n = ppFxN(7);
    for (let tries = 0; out.length < n && tries < 300; tries++) {
      const x = (Math.random() - .5) * 300, fuss = 72 + Math.random() * 25;
      if (Math.abs(x) < 26 && fuss < 76) continue;                         // nicht auf die Stufen
      if (out.some(f => Math.abs(f.x - x) < 22 && Math.abs(f.fuss - fuss) < 12)) continue;
      const g = ['s', 'm', 'm', 'l'][Math.floor(Math.random() * 4)];
      out.push({ g, x, fuss, ...RVG_FEUER[g], dur: .55 + Math.random() * .3, delay: -Math.random(),
        schein: (0.9 + Math.random() * .6).toFixed(2), pDur: 3.2 + Math.random() * 2, pDelay: -Math.random() * 5 });
    }
    return out;
  }, []);
  const truemmer = useMemo(() => {
    // Planken, Scherben, Kisten … zufällig, nicht auf den Feuern
    const out = [];
    for (let tries = 0; out.length < 14 && tries < 400; tries++) {
      const x = Math.round((Math.random() - .5) * 340), y = Math.round(67 + Math.random() * 31);
      if (Math.abs(x) < 30 && y < 71) continue;
      if (feuer.some(f => Math.abs(f.x - x) < 14 && Math.abs(f.fuss - y) < 7)) continue;
      if (out.some(t => Math.abs(t.x - x) < 18 && Math.abs(t.y - y) < 8)) continue;
      out.push({ x, y, v: Math.floor(Math.random() * 10) });
    }
    return out;
  }, [feuer]);
  const funken = useMemo(() => {
    const quellen = [...feuer.map(f => ({ x: f.x, y: f.fuss - f.h + 3 })), ...kachel.dach.map(d => ({ x: d.x, y: d.y - 14 }))];
    return ppZufall(ppFxN(20), () => {
      const q = quellen[Math.floor(Math.random() * quellen.length)];
      return { x: Math.round(q.x + (Math.random() - .5) * 6), y: Math.round(q.y), dur: 1.8 + Math.random() * 1.8, delay: -Math.random() * 3.6, hell: Math.random() < .4 };
    });
  }, [feuer, kachel]);
  const asche = useMemo(() => ppZufall(ppFxN(14), () => ({
    x: Math.random() * 100, y: Math.round(Math.random() * 40), dur: 7 + Math.random() * 6, delay: -Math.random() * 12,
  })), []);
  const aufruehrer = useMemo(() => ppZufall(ppFxN(2), (i) => ({
    rtl: i === 1, figur: i, dur: 42 + Math.random() * 18, delay: -Math.random() * 50 - i * 20,
  })), []);
  return (
    <PixelScene artH={100} bg="#3a3531" className="rioting-village-overlay">
      <PixelBand src={RVG + 'sky.png'} />
      <PixelBand src={RVG + 'sky-glow.png'} className="rvg-fern" />
      <PixelBand src={RVG + 'haze.png'} className="pp-area-dyn rvg-dunst" />
      <PixelBand src={RVG + 'tile.png'} />
      <PixelBand src={RVG + 'tile-glow.png'} className="rvg-schein" />
      {kachel.dach.map((d, i) => (
        <React.Fragment key={'d' + i}>
          <i className="rvg-rauchsaeule" style={{ left: ppArtX(d.x - 31, 0), top: ppArt(d.y - 38), animationDelay: (-i * .4) + 's' }} />
          <i className="rvg-dachfeuer" style={{ left: ppArtX(d.x - 9, 0), top: ppArt(d.y - 16), animation: `rvgDach ${d.dur.toFixed(2)}s steps(${RVG_BILDER}) ${d.delay.toFixed(2)}s infinite` }} />
        </React.Fragment>
      ))}
      {kachel.fenster.map((f, i) => (
        <i key={'w' + i} className="rvg-fensterfeuer" style={{ left: ppArtX(f.x - 4.5, 0), top: ppArt(f.y - 8), animation: `rvgFenster ${f.dur.toFixed(2)}s steps(${RVG_BILDER}) ${f.delay.toFixed(2)}s infinite` }} />
      ))}
      {kachel.fackeln.map((f, i) => (
        <i key={'t' + i} className="rvg-fackel" style={{ left: ppArtX(f.x - 2.5, 0), top: ppArt(f.y - 6), animationDuration: f.dur.toFixed(2) + 's' }} />
      ))}
      {kachel.laeden.map((l, i) => (
        <i key={'l' + i} className="rvg-laden" style={{ left: ppArtX(l.x, 0), top: ppArt(l.y), animationDuration: l.dur.toFixed(2) + 's', animationDelay: l.delay.toFixed(2) + 's' }} />
      ))}
      {aufruehrer.map((a, i) => (
        <div key={'a' + i} className="pp-area-dyn pp-quer" style={ppQuer(43, a.dur, a.delay, a.rtl)}>
          <i className="rvg-aufruehrer" style={{ backgroundPositionY: `${(a.figur * 2 + (a.rtl ? 1 : 0)) * 100 / 3}%` }} />
        </div>
      ))}
      <PixelPiece src={RVG + 'house.png'} w={RVG_HAUS_W} />
      <PixelPiece src={RVG + 'house-glow.png'} w={RVG_HAUS_W} className="rvg-schein" />
      <i className="rvg-augenglut" style={{ left: ppArtX(RVG_AUGE.x - 4, 0), top: ppArt(RVG_AUGE.y - 4) }} />
      <i className="rvg-auge" style={{ left: ppArtX(RVG_AUGE.x, 0), top: ppArt(RVG_AUGE.y) }} />
      <i className="rvg-fackel" style={{ left: ppArtX(RVG_HAUSFACKEL.x - 2.5, 0), top: ppArt(RVG_HAUSFACKEL.y - 6), animationDuration: '.47s' }} />
      <i className="rvg-schild" style={{ left: ppArtX(RVG_SCHILD.x, 0), top: ppArt(RVG_SCHILD.y) }} />
      {truemmer.map((t, i) => (
        <i key={'m' + i} className="rvg-truemmer" style={{ left: ppArtX(t.x - 8, 0), top: ppArt(t.y - 7), backgroundPositionX: `${t.v * 100 / 9}%` }} />
      ))}
      {feuer.map((f, i) => (
        <React.Fragment key={'b' + i}>
          <i className="rvg-bodenschein" style={{
            left: ppArtX(f.x - f.w * 1.7, 0), top: ppArt(f.fuss - f.w * 1.5), width: ppArt(f.w * 3.4), height: ppArt(f.w * 2.4),
            animationDuration: f.schein + 's', animationDelay: (-f.schein * i / 3).toFixed(2) + 's',
          }} />
          <i className="rvg-flamme" style={{
            left: ppArtX(f.x - f.w / 2, 0), top: ppArt(f.fuss - f.h + 1), width: ppArt(f.w), height: ppArt(f.h),
            backgroundImage: `url(${RVG}fire-${f.g}.png)`,
            '--rvg-lauf': `calc(${-RVG_BILDER * f.w} * var(--px))`,
            animation: `rvgFlackern ${f.dur.toFixed(2)}s steps(${RVG_BILDER}) ${f.delay.toFixed(2)}s infinite`,
          }} />
          <i className="rvg-haufen" style={{
            left: ppArtX(f.x - (f.w + 4) / 2, 0), top: ppArt(f.fuss - f.hh + 2), width: ppArt(f.w + 4), height: ppArt(f.hh),
            backgroundImage: `url(${RVG}heap-${f.g}.png)`,
          }} />
          <i className="pp-area-dyn rvg-puff" style={{
            left: ppArtX(Math.round(f.x) - 4, 0), top: ppArt(f.fuss - f.h - 6),
            animation: `rvgPuffBild ${f.pDur.toFixed(2)}s steps(1) ${f.pDelay.toFixed(2)}s infinite, rvgPuffWeg ${f.pDur.toFixed(2)}s steps(14) ${f.pDelay.toFixed(2)}s infinite`,
          }} />
        </React.Fragment>
      ))}
      {funken.map((f, i) => (
        <i key={'s' + i} className={'pp-area-dyn rvg-funke' + (f.hell ? ' hell' : '')} style={{ left: ppArtX(f.x, 0), top: ppArt(f.y), animation: `rvgFunke ${f.dur.toFixed(2)}s steps(26) ${f.delay.toFixed(2)}s infinite` }} />
      ))}
      {asche.map((a, i) => (
        <i key={'x' + i} className="pp-area-dyn rvg-asche" style={{ left: a.x + '%', top: ppArt(a.y), animation: `rvgAsche ${a.dur.toFixed(2)}s steps(60) ${a.delay.toFixed(2)}s infinite` }} />
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .rvg-fern { animation: rvgFern 3.4s steps(1) infinite; }
        @keyframes rvgFern { 0% { opacity: .7; } 20% { opacity: 1; } 45% { opacity: .8; } 70% { opacity: .95; } 85% { opacity: .65; } }
        .rvg-dunst { animation: rvgDunst 150s steps(128) infinite; opacity: .85; }
        @keyframes rvgDunst { from { background-position: 50% 0; } to { background-position: calc(50% - 128 * var(--px)) 0; } }
        .rvg-schein { animation: rvgSchein 1.1s steps(1) infinite; }
        @keyframes rvgSchein { 0% { opacity: .85; } 20% { opacity: 1; } 35% { opacity: .7; } 55% { opacity: .95; } 75% { opacity: .78; } }
        .rvg-dachfeuer { position: absolute; width: calc(18 * var(--px)); height: calc(17 * var(--px)); background: url(${RVG}fire-roof.png) 0 0 / ${RVG_BILDER * 100}% 100% no-repeat; }
        @keyframes rvgDach { from { background-position: 0 0; } to { background-position: calc(${-RVG_BILDER * 18} * var(--px)) 0; } }
        .rvg-fensterfeuer { position: absolute; width: calc(9 * var(--px)); height: calc(12 * var(--px)); background: url(${RVG}fire-win.png) 0 0 / ${RVG_BILDER * 100}% 100% no-repeat; }
        @keyframes rvgFenster { from { background-position: 0 0; } to { background-position: calc(${-RVG_BILDER * 9} * var(--px)) 0; } }
        .rvg-fackel { position: absolute; width: calc(5 * var(--px)); height: calc(7 * var(--px)); background: url(${RVG}torch.png) 0 0 / 400% 100% no-repeat; animation: rvgFackel .45s steps(4) infinite; }
        @keyframes rvgFackel { from { background-position: 0 0; } to { background-position: calc(-20 * var(--px)) 0; } }
        .rvg-rauchsaeule { position: absolute; width: calc(36 * var(--px)); height: calc(30 * var(--px)); background: url(${RVG}smoke.png) 0 0 / 800% 100% no-repeat; animation: rvgSaeule 2.2s steps(8) infinite; }
        @keyframes rvgSaeule { from { background-position: 0 0; } to { background-position: calc(-288 * var(--px)) 0; } }
        .rvg-laden { position: absolute; width: calc(10 * var(--px)); height: calc(14 * var(--px)); background: url(${RVG}shutter.png) 0 0 / 300% 100% no-repeat; animation: rvgLaden 3s steps(1) infinite; }
        @keyframes rvgLaden { 0%, 30% { background-position: 50% 0; } 38%, 55% { background-position: 100% 0; } 62%, 80% { background-position: 50% 0; } 88%, 96% { background-position: 0 0; } }
        .rvg-schild { position: absolute; width: calc(16 * var(--px)); height: calc(16 * var(--px)); background: url(${RVG}sign.png) 0 0 / 400% 100% no-repeat; animation: rvgSchild 3.6s steps(1) infinite; }
        @keyframes rvgSchild { 0% { background-position: 0 0; } 25% { background-position: 33.33% 0; } 50% { background-position: 66.67% 0; } 75% { background-position: 100% 0; } }
        .rvg-aufruehrer {
          display: block; width: calc(10 * var(--px)); height: calc(16 * var(--px));
          background-image: url(${RVG}rioter.png); background-size: 400% 400%; background-repeat: no-repeat;
          animation: rvgLaufen .8s steps(4) infinite;
        }
        @keyframes rvgLaufen { from { background-position-x: 0; } to { background-position-x: calc(-40 * var(--px)); } }
        .rvg-truemmer { position: absolute; width: calc(16 * var(--px)); height: calc(8 * var(--px)); background: url(${RVG}debris.png) 0 0 / 1000% 100% no-repeat; }
        .rvg-flamme { position: absolute; background-repeat: no-repeat; background-size: ${RVG_BILDER * 100}% 100%; }
        @keyframes rvgFlackern { from { background-position: 0 0; } to { background-position: var(--rvg-lauf) 0; } }
        .rvg-haufen { position: absolute; background-size: 100% 100%; background-repeat: no-repeat; }
        .rvg-bodenschein {
          position: absolute; border-radius: 50%;
          background: radial-gradient(ellipse, rgba(255,140,40,.42) 0%, rgba(255,90,20,.16) 45%, rgba(255,90,20,0) 70%);
          animation: rvgSchein 1.1s steps(1) infinite;
        }
        .rvg-puff { position: absolute; width: calc(9 * var(--px)); height: calc(8 * var(--px)); background: url(${RVG}puff.png) 0 0 / 400% 100% no-repeat; opacity: 0; }
        @keyframes rvgPuffBild { 0% { background-position: 0 0; opacity: .9; } 25% { background-position: 33.33% 0; opacity: .85; } 50% { background-position: 66.67% 0; opacity: .7; } 75% { background-position: 100% 0; opacity: .45; } 100% { background-position: 100% 0; opacity: 0; } }
        @keyframes rvgPuffWeg { from { transform: translate(0, 0); } to { transform: translate(calc(-4 * var(--px)), calc(-14 * var(--px))); } }
        .rvg-auge {
          position: absolute; width: calc(11 * var(--px)); height: calc(5 * var(--px));
          background: url(${RVG}eye.png) 0 0 / 500% 100% no-repeat;
          animation: rvgAuge 7s steps(1) infinite;
        }
        @keyframes rvgAuge {
          0%, 30% { background-position: 0 0; } 34%, 46% { background-position: 25% 0; }
          50%, 62% { background-position: 0 0; } 66%, 78% { background-position: 50% 0; }
          82%, 90% { background-position: 0 0; } 92% { background-position: 75% 0; }
          94% { background-position: 100% 0; } 96% { background-position: 75% 0; } 98%, 100% { background-position: 0 0; }
        }
        .rvg-augenglut {
          position: absolute; width: calc(19 * var(--px)); height: calc(13 * var(--px));
          background: radial-gradient(ellipse, rgba(255,30,20,.5) 0%, rgba(255,30,20,0) 70%);
          animation: rvgAugenglut 2.4s ease-in-out infinite alternate;
        }
        @keyframes rvgAugenglut { from { opacity: .45; } to { opacity: 1; } }
        .rvg-funke { position: absolute; width: var(--px); height: var(--px); background: #f47a1c; opacity: 0; }
        .rvg-funke.hell { background: #ffd060; }
        @keyframes rvgFunke { 0% { transform: translate(0,0); opacity: 0; } 8% { opacity: 1; } 70% { opacity: 1; } 100% { transform: translate(calc(-5 * var(--px)), calc(-26 * var(--px))); opacity: 0; } }
        .rvg-asche { position: absolute; width: var(--px); height: var(--px); background: #7a716b; opacity: 0; }
        @keyframes rvgAsche { 0% { transform: translate(0,0); opacity: 0; } 10% { opacity: .7; } 85% { opacity: .6; } 100% { transform: translate(calc(-18 * var(--px)), calc(60 * var(--px))); opacity: 0; } }
      `}</style>
    </PixelScene>
  );
});

// ── SLIPPERY ICE ─────────────────────────────────────────────────────
//  Karte: lavendelweiße Eisfläche mit diagonalen Glanzstreifen, blaues
//  Wasser mit Wellenzeichen, Pinguine rutschen auf dem Bauch.
//  v1433 (Al 25.9.): Wasser aufgehübscht — treppige Eiskante wie auf der
//  Karte mit sichtbarer Eisdicke, Schaum an der Kante, Tiefe nach unten,
//  Wellenzeichen und Lichtreflexe, die über drei Bilder wandern, dazu
//  treibende Schollen. Pinguine detaillierter (Gesicht mit roter Wange,
//  Glanz auf dem Rücken, schlagende Flossen) mit dem Bewegungsschleier
//  der Karte. Statt des Schilds ein STACHELIGER EISBLOCK, der ebenfalls
//  herumrutscht. Eis mit Rissen und Schneewehen. Licht IMMER oben rechts.
//
//  Überarbeitung v1441 (Al 25.9.: „deine haben ein anderes Level" — auf
//  das Niveau der v1440-Szenen gebracht). Dieselbe Szene, neu gemalt:
//  tile.png — Kachel 128: Eis als unregelmäßiges Pixelrauschen mit den
//  diagonalen Glanzstreifen der Karte (/, Rillen mit Glanzkante, breite
//  weiche Glanzbahnen), klare dunkle Eisfenster, gerade Eisrisse mit
//  heller Bruchfläche, eingeschlossene Luftblasen, Kratzspuren entlang
//  der Rutschbahnen, flache Schneewehen (Schweif nach links, oben rechts
//  beleuchtet, Schlagschatten unten links); treppige Eiskante mit heller
//  Lippe, Schneewülsten, 5 Pixel Eisdicke (Schichtlinie, Glanzstriche,
//  Tropfnasen) und dunkler Wasserlinie. water.png — 3 Bilder: Rauschen,
//  Dünung, untergetauchter Eissockel unter der Kante, Wellenzeichen der
//  Karte in versetzten Reihen, wandernde Glanzlichter. foam.png — Schaum
//  an der Wasserlinie (3 Bilder). center.png — Mittelstück 256, damit die
//  Kachel nicht sichtbar wiederholt: links eine treppige Eiszunge mit
//  einem unter klarem Eis eingefrorenen Fisch und Eisbrocken, rechts eine
//  große treibende Scholle mit Schneewehe, oben ein Rissnetz;
//  center-foam.png — deren Schaum (3 Bilder). drift.png — Schneefahnen.
//  Sprites: penguin.png (3 Bilder mit Schleier + Eissplittern),
//  spikeblock.png (2 Bilder, Deckfläche/Seite/Stirn, Schatten, eingefro-
//  rener Fisch, wandernder Glanz), floe.png (3 Schollen), swimmer.png
//  (schwimmender Pinguin mit Bugwelle), fish.png (springender Fisch).
//  Animiert: Wasser und Schaum, Schneetreiben zieht nach links (Wind von
//  rechts), Pinguine rutschen und schlagen mit den Flossen, der Eisblock
//  ruckt an und rutscht, Schollen treiben, ein Pinguin schwimmt, Fische
//  springen, Eis funkelt. Licht IMMER oben rechts.
const SLI = '/areas/slippery-ice/';
const SLI_MITTE = 256;              // Mittelstück; Stück-x 128 = Brettmitte
// v1434 (Al 25.9.: „zu viele Akteure, sie überlappen sich ständig —
// pro Höhenebene nur einen"): feste Bahnen, jede mit genau EINEM
// Akteur. Die Bahnen überschneiden sich nicht (Pinguin 10 hoch, Eisblock
// 30 hoch), und die unterste endet über der höchsten Stufe der
// Eiskante (Lippe y 61) — so rutscht nie etwas auf etwas anderem oder im Wasser.
const SLI_BAHNEN = [
  { art: 'pinguin', y: 0 },
  { art: 'block', y: 11 },
  { art: 'pinguin', y: 41 },
  { art: 'pinguin', y: 51 },
];
// Schollen treiben nur dort, wo das Mittelstück (Eiszunge links, große
// Scholle rechts) frei lässt.
const SLI_SCHOLLEN = [-170, -40, 5, 105, 160];
const SLI_FISCHE = [[-150, 90], [-30, 93], [100, 89], [175, 92]];   // Sprungstellen (x neben der Mitte, y)
const SlipperyIceOverlay = React.memo(function SlipperyIceOverlay() {
  const bahnen = useMemo(() => SLI_BAHNEN.slice(0, Math.max(2, ppFxN(SLI_BAHNEN.length))), []);
  // v1435 (Al 25.9.): Richtungen fest — der zweite Pinguin rutscht nach
  // links, die anderen nach rechts; der Block startet nach links.
  const pinguine = useMemo(() => bahnen.filter(b => b.art === 'pinguin').map((b, i) => ({
    y: b.y, dur: 7 + Math.random() * 6, delay: -Math.random() * 12, rtl: i === 1,
    bob: 1.1 + Math.random() * .8, flosse: .38 + Math.random() * .14,
  })), [bahnen]);
  const bloecke = useMemo(() => bahnen.filter(b => b.art === 'block').map(b => ({
    y: b.y, von: 50 + Math.random() * 60, bis: -120 + Math.random() * 40,
    dur: 7 + Math.random() * 5, delay: 0,
  })), [bahnen]);
  const schollen = useMemo(() => SLI_SCHOLLEN.slice(0, ppFxN(SLI_SCHOLLEN.length)).map((x, i) => ({
    x: x + (Math.random() - .5) * 10, y: 86 + Math.random() * 8, v: i % 3,
    dur: 9 + Math.random() * 6, delay: -Math.random() * 10,
  })), []);
  const schwimmer = useMemo(() => ppZufall(ppFxN(1), () => ({
    y: 92 + Math.random() * 2, dur: 55 + Math.random() * 20, delay: -Math.random() * 50, rtl: Math.random() < .5,
  })), []);
  const fische = useMemo(() => SLI_FISCHE.slice(0, ppFxN(SLI_FISCHE.length)).map(() => ({
    dur: 7 + Math.random() * 6, delay: -Math.random() * 12,
  })), []);
  const funken = useMemo(() => ppZufall(ppFxN(10), () => ({
    x: Math.random() * 100, y: 3 + Math.random() * 54, dur: 1.8 + Math.random() * 2, delay: -Math.random() * 4,
  })), []);
  return (
    <PixelScene artH={100} bg="#d2d1f7" className="slippery-ice-overlay">
      <PixelBand src={SLI + 'water.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 2.1s steps(1) infinite' }} />
      {schollen.map((s, i) => (
        <i key={'s' + i} className="pp-area-dyn sli-scholle" style={{
          left: ppArtX(s.x, 0), top: ppArt(s.y), backgroundPosition: `${s.v * 50}% 0`,
          animation: `sliTreiben ${s.dur.toFixed(2)}s steps(8) ${s.delay.toFixed(2)}s infinite alternate`,
        }} />
      ))}
      {schwimmer.map((s, i) => (
        <div key={'w' + i} className="pp-area-dyn sli-quer" style={{ top: ppArt(s.y), animation: `${s.rtl ? 'sliQuerRtl' : 'sliQuerLtr'} ${s.dur.toFixed(1)}s linear ${s.delay.toFixed(1)}s infinite` }}>
          <i className="sli-schwimmer" style={{ transform: s.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      {fische.map((f, i) => (
        <i key={'h' + i} className="pp-area-dyn sli-fisch" style={{
          left: ppArtX(SLI_FISCHE[i][0] - 6, 0), top: ppArt(SLI_FISCHE[i][1] - 11),
          animationDuration: f.dur.toFixed(2) + 's', animationDelay: f.delay.toFixed(2) + 's',
        }} />
      ))}
      <PixelBand src={SLI + 'tile.png'} />
      <PixelBand src={SLI + 'foam.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 1.6s steps(1) infinite' }} />
      <PixelPiece src={SLI + 'center.png'} w={SLI_MITTE} />
      <PixelPiece src={SLI + 'center-foam.png'} w={SLI_MITTE} style={{ backgroundSize: '100% 300%', animation: 'ppBand3 1.6s steps(1) infinite' }} />
      <div className="pp-pixel-layer pp-area-dyn sli-wind" />
      {funken.map((f, i) => (
        <i key={'f' + i} className="pp-area-dyn pp-px-funkeln" style={{ left: f.x + '%', top: ppArt(f.y), animation: `ppFunkeln ${f.dur.toFixed(2)}s steps(1) ${f.delay.toFixed(2)}s infinite` }} />
      ))}
      {bloecke.map((b, i) => (
        <i key={'b' + i} className="sli-block" style={{
          left: ppArtX(-18, 0), top: ppArt(b.y), '--von': ppArt(b.von), '--bis': ppArt(b.bis),
          animation: `sliBlock ${b.dur.toFixed(2)}s cubic-bezier(.35,0,.25,1) ${b.delay.toFixed(2)}s infinite alternate, sliGlanz 3.2s steps(1) infinite`,
        }} />
      ))}
      {pinguine.map((p, i) => (
        <div key={'p' + i} className="pp-area-dyn sli-quer" style={{ top: ppArt(p.y), animation: `${p.rtl ? 'sliQuerRtl' : 'sliQuerLtr'} ${p.dur.toFixed(2)}s linear ${p.delay.toFixed(2)}s infinite` }}>
          <div className="sli-rutscher" style={{ transform: p.rtl ? 'scaleX(-1)' : undefined, animationDuration: p.bob.toFixed(2) + 's' }}>
            <i className="sli-pinguin" style={{ animationDuration: p.flosse.toFixed(2) + 's' }} />
          </div>
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .sli-quer { position: absolute; left: 0; }
        @keyframes sliQuerLtr { from { transform: translateX(calc(-60 * var(--px))); } to { transform: translateX(calc(100cqw + 4 * var(--px))); } }
        @keyframes sliQuerRtl { from { transform: translateX(calc(100cqw + 4 * var(--px))); } to { transform: translateX(calc(-60 * var(--px))); } }
        .sli-rutscher { animation: sliRuckeln 1.4s steps(2) infinite; }
        @keyframes sliRuckeln { 0% { translate: 0 0; } 50% { translate: 0 calc(-1 * var(--px)); } }
        .sli-pinguin { display: block; width: calc(56 * var(--px)); height: calc(10 * var(--px)); background: url(${SLI}penguin.png) 0 0 / 300% 100% no-repeat; animation: ppSprite3 .45s steps(1) infinite; }
        .sli-block {
          position: absolute; width: calc(36 * var(--px)); height: calc(30 * var(--px));
          background: url(${SLI}spikeblock.png) 0 0 / 200% 100% no-repeat;
        }
        @keyframes sliBlock {
          0% { transform: translateX(var(--von)); } 8% { transform: translateX(var(--von)) translateY(calc(-1 * var(--px))); }
          12% { transform: translateX(var(--von)); } 100% { transform: translateX(var(--bis)); }
        }
        @keyframes sliGlanz { 0% { background-position: 0 0; } 50% { background-position: 100% 0; } }
        .sli-scholle { position: absolute; width: calc(12 * var(--px)); height: calc(6 * var(--px)); background: url(${SLI}floe.png) 0 0 / 300% 100% no-repeat; }
        @keyframes sliTreiben {
          0% { transform: translate(0, 0); } 25% { transform: translate(calc(2 * var(--px)), var(--px)); }
          50% { transform: translate(calc(4 * var(--px)), 0); } 75% { transform: translate(calc(6 * var(--px)), var(--px)); }
          100% { transform: translate(calc(8 * var(--px)), 0); }
        }
        .sli-schwimmer { display: block; width: calc(20 * var(--px)); height: calc(7 * var(--px)); background: url(${SLI}swimmer.png) 0 0 / 200% 100% no-repeat; animation: ppSprite2 .7s steps(1) infinite; }
        .sli-fisch {
          position: absolute; width: calc(12 * var(--px)); height: calc(12 * var(--px));
          background: url(${SLI}fish.png) 0 0 / 800% 100% no-repeat; animation-name: sliFisch; animation-timing-function: steps(1); animation-iteration-count: infinite;
        }
        @keyframes sliFisch {
          0% { background-position: 0 0; } 1.6% { background-position: calc(100% / 7) 0; } 3.2% { background-position: calc(200% / 7) 0; }
          4.8% { background-position: calc(300% / 7) 0; } 6.4% { background-position: calc(400% / 7) 0; } 8% { background-position: calc(500% / 7) 0; }
          9.6% { background-position: calc(600% / 7) 0; } 11.2%, 100% { background-position: 0 0; }
        }
        .sli-wind {
          position: absolute; inset: 0; background: url(${SLI}drift.png) 50% 0 / auto 100% repeat-x; opacity: .7;
          animation: sliWind 16s steps(128) infinite;
        }
        @keyframes sliWind { from { background-position: 50% 0; } to { background-position: calc(50% - 128 * var(--px)) 0; } }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  SMUGGLER'S PIER — Holzsteg im tiefblauen Meer (v1415, Überarbeitung
//  v1441, Al 25.9.)
//
//  Karte: tiefblaues Wasser, Holzsteg mit Pfosten, Kiste, Tauring,
//  Pfütze, Möwen. v1435 (Al 25.9.): Proportionen wie auf der Karte —
//  große Möwen (fliegend 27 breit, mit Schatten aufs Wasser). Das
//  Beiboot ist wieder raus (v1436, Al: perspektivisch unstimmig) und
//  bleibt raus. Kiste mit Deckel, Eckleisten, Strebe, Rahmen und
//  Schlagschatten — klar vom Steg abgesetzt. Mehr Detail: Planken mit
//  Maserung, Nägeln und Stößen, Stirnbalken, Pfähle mit Schaum und
//  Algen, Tauwicklung an den Pfosten, Fass, Fischernetz.
//
//  Überarbeitung v1441 (Al 25.9.: „deine haben ein anderes Level"):
//  Meer wie auf der Karte aus kurzen Wellenstrichen in neun Blautönen,
//  zwei Wellenzüge wandern darüber, auf den Kämmen blitzen helle Striche.
//  Der Steg läuft jetzt nach links bis an den Brettrand (Kachel, rechts-
//  bündig am Stegstück) — Pfosten im Kartenabstand (64), Planken unter-
//  schiedlich breit mit Maserung, Astlöchern, Stößen mit Lichtkante,
//  Nägeln an den Querträgern, Moos in den Fugen, Möwenklecksen; Stirn-
//  balken mit Bolzen, Seitenbalken mit Licht von rechts und Pfahlköpfen
//  mit Algen. Kiste in Aufsicht mit Vorderseite (Brandzeichen Anker,
//  Eisenwinkel), Tauring mit klar getrennten Windungen und dem Ende quer
//  darüber (wie auf der Karte), Fass mit gewölbtem Mantel und Reifen,
//  Fischernetz mit Rautenmaschen und Korkschwimmern, Schmugglerluke mit
//  Scharnieren und Ring, Klampe mit Tau, das über die Kante ins Wasser
//  abtaucht. Rechts im Wasser ein Dalben (drei gebundene Pfähle mit
//  Seepocken), ein einzelner Pfahlstumpf, ein treibender Tangteppich
//  und Felsen mit Tang und Seestern.
//
//  Ebenen (Kunsthöhe 100; Generator liegt nicht im Projekt):
//  water.png — Kachel 128, 3 Bilder übereinander; deck.png — Steg-
//  Kachel 128 (links vom Stück); pier.png — Stegkopf + Wasser-Beiwerk,
//  Stück 336 (Stück-x 160 = Brettmitte); foam.png — Schaum und
//  Spiegelung, 3 Bilder übereinander; puddle.png, gull-fly.png (4),
//  gull-side.png / gull-front.png (je 3), gull-shadow.png, barrel.png
//  (Treibfass, 3), fish.png (Fischschwarm-Schatten, 2), crab.png (2),
//  cloud.png (Wolkenschatten).
//
//  Animiert: Wellenzüge und Kämme, Schaum am Steg, am Dalben und an den
//  Felsen, Spiegelung des Dalbens, Pfütze mit wanderndem Reflex und
//  Kräuselring, Möwen fliegen (Schatten aufs Wasser), zwei sitzende
//  Möwen (Kopf drehen, blinzeln, rufen), Treibfass dümpelt, Fisch-
//  schwärme ziehen unter dem Steg durch, eine Krabbe läuft über den
//  Stirnbalken, Wolkenschatten ziehen, Glitzern auf dem Wasser.
//  Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const SMP = '/areas/smugglers-pier/';
const SMP_W = 336;                  // Stegstück; Stück-x 160 = Brettmitte
const SMP_L = -160;                 // linker Rand des Stücks neben der Mitte
const SMP_GLITZER = [               // Wasserstellen (x neben der Mitte, y)
  [-150, 6], [-122, 24], [-86, 9], [-58, 28], [-18, 5], [8, 22], [44, 12], [62, 32],
  [78, 48], [104, 26], [120, 62], [132, 44], [150, 18], [166, 70], [110, 92], [170, 34],
];
const SmugglersPierOverlay = React.memo(function SmugglersPierOverlay() {
  const moewen = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    // eigene Höhe je Möwe (13 hoch, 12er-Abstand) — sie fliegen nie übereinander
    y: [1, 13, 25][i] + Math.random() * 2, dur: 14 + Math.random() * 10, delay: -Math.random() * 25, rtl: i % 2 === 1,
    schlag: .55 + Math.random() * .25,
  })), []);
  const fische = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    y: [8, 58, 84][i] + Math.random() * 6, dur: 40 + Math.random() * 20, delay: -Math.random() * 60, rtl: i % 2 === 0,
  })), []);
  const wolken = useMemo(() => ppZufall(ppFxN(2), (i) => ({
    y: [-6, 44][i] + Math.random() * 10, dur: 90 + Math.random() * 40, delay: -Math.random() * 130,
  })), []);
  const glitzer = useMemo(() => SMP_GLITZER.slice(0, ppFxN(16)).map(([x, y]) => ({
    x, y, dur: 3 + Math.random() * 4, delay: -Math.random() * 7,
  })), []);
  return (
    <PixelScene artH={100} bg="#1646cc" className="smugglers-pier-overlay">
      <PixelBand src={SMP + 'water.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 2.4s steps(1) infinite' }} />
      {fische.map((f, i) => (
        <div key={'f' + i} className="pp-area-dyn pp-quer" style={ppQuer(f.y, f.dur, f.delay, f.rtl)}>
          <i className="smp-fische" style={{ transform: f.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      {glitzer.map((g, i) => (
        <i key={'g' + i} className="pp-area-dyn pp-px-funkeln" style={{ left: ppArtX(g.x - 1, 0), top: ppArt(g.y), animation: `ppFunkeln ${g.dur.toFixed(2)}s steps(1) ${g.delay.toFixed(2)}s infinite` }} />
      ))}
      <div className="pp-pixel-layer smp-steg" />
      <PixelPiece src={SMP + 'pier.png'} w={SMP_W} x={SMP_L + SMP_W / 2} />
      <PixelPiece src={SMP + 'foam.png'} w={SMP_W} x={SMP_L + SMP_W / 2} style={{ backgroundSize: '100% 300%', animation: 'ppBand3 1.5s steps(1) infinite' }} />
      <i className="smp-pfuetze" style={{ left: ppArtX(7, 0), top: ppArt(49) }} />
      <i className="smp-fass" style={{ left: ppArtX(74, 0), top: ppArt(17) }} />
      <i className="pp-area-dyn smp-krabbe" style={{ left: ppArtX(-20, 0), top: ppArt(36) }} />
      <i className="smp-moewe-vorn" style={{ left: ppArtX(-48, 0), top: ppArt(35) }} />
      <i className="smp-moewe-seite" style={{ left: ppArtX(17, 0), top: ppArt(80) }} />
      {moewen.map((m, i) => (
        <div key={'m' + i} className="pp-area-dyn pp-quer" style={ppQuer(m.y, m.dur, m.delay, m.rtl)}>
          <div style={{ transform: m.rtl ? 'scaleX(-1)' : undefined, position: 'relative' }}>
            <i className="smp-moewe-schatten" />
            <i className="smp-moewe" style={{ animationDuration: `${m.schlag.toFixed(2)}s, 1.7s` }} />
          </div>
        </div>
      ))}
      {wolken.map((w, i) => (
        <i key={'w' + i} className="pp-area-dyn smp-wolke" style={{ top: ppArt(w.y), animation: `smpWolke ${w.dur.toFixed(1)}s linear ${w.delay.toFixed(1)}s infinite` }} />
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .smp-steg {
          position: absolute; top: 0; bottom: 0; left: 0; width: calc(50% + ${SMP_L} * var(--px));
          background: url(${SMP}deck.png) 100% 0 / auto 100% repeat-x;
        }
        .smp-pfuetze { position: absolute; width: calc(28 * var(--px)); height: calc(18 * var(--px)); background: url(${SMP}puddle.png) 0 0 / 300% 100% no-repeat; animation: ppSprite3 1.4s steps(1) infinite; }
        .smp-fass { position: absolute; width: calc(18 * var(--px)); height: calc(12 * var(--px)); background: url(${SMP}barrel.png) 0 0 / 300% 100% no-repeat; animation: ppSprite3 2.2s steps(1) infinite; }
        .smp-moewe-vorn { position: absolute; width: calc(15 * var(--px)); height: calc(17 * var(--px)); background: url(${SMP}gull-front.png) 0 0 / 300% 100% no-repeat; animation: smpVorn 6.3s steps(1) infinite; }
        @keyframes smpVorn { 0%, 44% { background-position: 0 0; } 46%, 49% { background-position: 100% 0; } 51%, 70% { background-position: 0 0; } 72%, 90% { background-position: 50% 0; } 92%, 100% { background-position: 0 0; } }
        .smp-moewe-seite { position: absolute; width: calc(24 * var(--px)); height: calc(15 * var(--px)); background: url(${SMP}gull-side.png) 0 0 / 300% 100% no-repeat; animation: smpSeite 8.1s steps(1) -2.4s infinite; }
        @keyframes smpSeite { 0%, 40% { background-position: 0 0; } 42%, 58% { background-position: 50% 0; } 60%, 78% { background-position: 0 0; } 80%, 83% { background-position: 100% 0; } 85% { background-position: 0 0; } 87%, 90% { background-position: 100% 0; } 92%, 100% { background-position: 0 0; } }
        .smp-moewe {
          display: block; width: calc(27 * var(--px)); height: calc(13 * var(--px));
          background: url(${SMP}gull-fly.png) 0 0 / 400% 100% no-repeat;
          animation: smpFluegel .6s steps(4) infinite, ppBob 1.7s ease-in-out infinite alternate; --bob: calc(3 * var(--px));
        }
        @keyframes smpFluegel { from { background-position: 0 0; } to { background-position: calc(-108 * var(--px)) 0; } }
        .smp-moewe-schatten {
          position: absolute; left: calc(6 * var(--px)); top: calc(34 * var(--px)); width: calc(16 * var(--px)); height: calc(5 * var(--px));
          background: url(${SMP}gull-shadow.png) 0 0 / 100% 100% no-repeat;
        }
        .smp-fische { display: block; width: calc(16 * var(--px)); height: calc(7 * var(--px)); background: url(${SMP}fish.png) 0 0 / 200% 100% no-repeat; animation: ppSprite2 .9s steps(1) infinite; }
        .smp-krabbe {
          position: absolute; width: calc(9 * var(--px)); height: calc(5 * var(--px));
          background: url(${SMP}crab.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .3s steps(1) infinite, smpKrabbe 14s steps(36) infinite;
        }
        @keyframes smpKrabbe {
          0%, 12% { translate: 0 0; } 30%, 44% { translate: calc(18 * var(--px)) 0; } 52%, 60% { translate: calc(12 * var(--px)) 0; }
          78%, 88% { translate: calc(32 * var(--px)) 0; } 100% { translate: 0 0; }
        }
        .smp-wolke {
          position: absolute; left: 0; width: calc(72 * var(--px)); height: calc(26 * var(--px));
          background: url(${SMP}cloud.png) 0 0 / 100% 100% no-repeat;
        }
        @keyframes smpWolke { from { transform: translateX(calc(-80 * var(--px))); } to { transform: translateX(calc(100cqw + 10 * var(--px))); } }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  ELF WEITERE AREAS IM KARTENSTIL (v1440, Al 25.9.) — die letzten
//  Nicht-Pixelart-Hintergründe: Spatial Crevice, Spider Hive, Stinky
//  Stables, Tarleinn's Floating Island, Temple of Sacrifice, The
//  Bonegrinder, The Cosmic Depths, The First Circle of Hell, Big Gwen,
//  War Council Gathering Place, Wowhalla. Vorlagen: Als Ausschnitte
//  (Crevice, Hive, Stables, Island, Temple) bzw. die Kartenmotive. Alle
//  Kunsthöhe 100, alle `opaque` (ganze Szenen), Kunst per Generator
//  gemalt, der nicht im Projekt liegt; Bilder unter public/areas/<slug>/.
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
//  SPATIAL CREVICE — Riss im Raum am Meeresgrund (v1440, Al 25.9.)
//
//  Al 25.9.: „Crevice zeigt eine Tiefsee-Szenerie mit einem Riss im
//  Raum und einer Höllenlandschaft hinter dem Riss." Tiefsee in
//  dunklem, gesättigtem Blau (oben heller, nach unten dunkler) unter
//  einer schwarzen Felsdecke mit Tropfsteinen, ferne Riffe im Dunst,
//  tote knorrige Korallenbäume wie auf der Karte, Meeresboden mit
//  Felsbrocken, Kies, Muscheln, Seeigeln, weinroten Fächerkorallen und
//  Röhrenschwämmen. In der Mitte klafft der Riss: zerfetzter schwarz-
//  violetter Rand mit roten Splittern, Sprünge laufen ins Wasser, lose
//  Splitter schweben daneben. Durch den Riss: glühender Höllenhimmel
//  mit Rauchbändern, ferne Bergkette mit einem Vulkan (Glut über dem
//  Krater) und einer kleinen dunklen Gestalt auf dem Grat, schwarze
//  Felsmassive mit Glutkanten links und rechts, ein Lavafluss windet
//  sich nach vorn in einen Lavasee, Flammen züngeln am Ufer.
//  Licht IMMER oben rechts.
//
//  Ebenen (Kunsthöhe 100; per Generator gemalt, der nicht im Projekt
//  liegt): tile.png — Kachel 128 (Tiefsee); rays.png — Lichtbahnen;
//  shimmer.png — Kaustik (3 Bilder übereinander); weed.png — Seegras
//  (2 Bilder); glow.png — roter Schein des Risses, Stück 240;
//  hell.png — Höllenlandschaft, Stück 170; lava.png / flames.png —
//  je 3 Bilder übereinander; mask.png — Form des Risses (maskiert
//  Qualm und Flugwesen); smoke.png — Qualm, Kachel 64; rim.png — Rand
//  mit Splittern und Sprüngen (2 Bilder); fish.png (Anglerfisch mit
//  Leuchtköder), jelly.png (Qualle), imp.png (Flugwesen), je 2 Bilder.
//
//  Animiert: Lava fließt, Lava läuft die Vulkanflanken hinab, Flammen
//  flackern, Qualm zieht über den Höllenhimmel, kleine Flugwesen kreuzen ihn, der Rand
//  zuckt (Glutkanten springen), der rote Schein pulsiert, Glut treibt aus
//  dem Riss ins Wasser und erlischt, Blasen steigen, Schwebeteilchen
//  sinken, Kaustik flimmert, Lichtbahnen atmen, Seegras wiegt, ein
//  Anglerfisch und Quallen ziehen vorbei.
// ═══════════════════════════════════════════════════════════════════
const SC = '/areas/spatial-crevice/';
const SC_W = 170;                 // Riss-Stück; Rissmitte (85, 48)
const SC_GLOW_W = 240;
const SC_RX = 38, SC_RY = 34, SC_CY = 48;
const SpatialCreviceOverlay = React.memo(function SpatialCreviceOverlay() {
  // Glut: startet am Rand des Risses, treibt nach außen/oben ins Wasser, erlischt
  const glut = useMemo(() => ppZufall(ppFxN(16), () => {
    const a = Math.random() * Math.PI * 2;
    const r = .75 + Math.random() * .2;
    const weg = 10 + Math.random() * 18;
    return {
      x: Math.cos(a) * SC_RX * r, y: SC_CY + Math.sin(a) * SC_RY * r,
      dx: Math.cos(a) * weg + (Math.random() - .5) * 6, dy: Math.sin(a) * weg * .6 - 8 - Math.random() * 10,
      dur: 3 + Math.random() * 3, delay: -Math.random() * 6,
    };
  }), []);
  const blasen = useMemo(() => ppZufall(ppFxN(12), () => ({
    x: Math.random() * 100, dur: 6 + Math.random() * 5, delay: -Math.random() * 11, gross: Math.random() < .3,
  })), []);
  const schnee = useMemo(() => ppZufall(ppFxN(16), () => ({
    x: Math.random() * 100, dur: 16 + Math.random() * 12, delay: -Math.random() * 28,
  })), []);
  const fische = useMemo(() => ppZufall(ppFxN(2), (i) => ({
    y: 22 + Math.random() * 50, dur: 34 + Math.random() * 16, delay: -Math.random() * 40, rtl: i % 2 === 1,
  })), []);
  const quallen = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    y: 14 + Math.random() * 40, dur: 70 + Math.random() * 40, delay: -Math.random() * 100, rtl: i % 2 === 0,
    bob: 3 + Math.random() * 4,
  })), []);
  const flieger = useMemo(() => ppZufall(ppFxN(2), (i) => ({
    y: 16 + Math.random() * 22, dur: 11 + Math.random() * 6, delay: -Math.random() * 16, rtl: i % 2 === 1,
  })), []);
  return (
    <PixelScene artH={100} bg="#0c2144" className="spatial-crevice-overlay">
      <PixelBand src={SC + 'tile.png'} />
      <PixelBand src={SC + 'rays.png'} className="sc-strahlen" />
      <PixelBand src={SC + 'shimmer.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 2.7s steps(1) infinite' }} />
      {quallen.map((q, i) => (
        <div key={'q' + i} className="pp-area-dyn pp-quer" style={ppQuer(q.y, q.dur, q.delay, q.rtl)}>
          <i className="sc-qualle" style={{ '--bob': ppArt(q.bob) }} />
        </div>
      ))}
      <PixelPiece src={SC + 'glow.png'} w={SC_GLOW_W} className="sc-schein" />
      <PixelPiece src={SC + 'hell.png'} w={SC_W} />
      <div className="pp-pixel-layer sc-himmel" style={{
        position: 'absolute', top: 0, bottom: 0, left: `calc(50% - ${SC_W / 2} * var(--px))`, width: ppArt(SC_W),
        ...ppMaske(SC + 'mask.png', false),
      }}>
        <div className="sc-qualm" />
        {flieger.map((f, i) => (
          <i key={'f' + i} className="pp-area-dyn sc-flieger" style={{
            top: ppArt(f.y), animation: `${f.rtl ? 'scFlugRtl' : 'scFlugLtr'} ${f.dur}s linear ${f.delay}s infinite`,
          }}>
            <i className="sc-flieger-bild" />
          </i>
        ))}
      </div>
      <PixelPiece src={SC + 'lava.png'} w={SC_W} style={{ backgroundSize: '100% 300%', animation: 'ppBand3 1.5s steps(1) infinite' }} />
      <PixelPiece src={SC + 'flames.png'} w={SC_W} style={{ backgroundSize: '100% 300%', animation: 'ppBand3 .48s steps(1) infinite' }} />
      <PixelPiece src={SC + 'rim.png'} w={SC_W} className="sc-rand" style={{ backgroundSize: '100% 200%' }} />
      {glut.map((g, i) => (
        <i key={'g' + i} className="pp-area-dyn sc-glut" style={{
          left: ppArtX(g.x + SC_W / 2, SC_W), top: ppArt(g.y), '--dx': ppArt(g.dx), '--dy': ppArt(g.dy),
          animation: `scGlut ${g.dur}s linear ${g.delay}s infinite`,
        }} />
      ))}
      {fische.map((f, i) => (
        <div key={'fi' + i} className="pp-area-dyn pp-quer" style={ppQuer(f.y, f.dur, f.delay, f.rtl)}>
          <i className="sc-fisch" style={{ transform: f.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      <PixelBand src={SC + 'weed.png'} style={{ backgroundSize: 'auto 200%', animation: 'ppBand2 1.8s steps(1) infinite' }} />
      {schnee.map((s, i) => (
        <i key={'s' + i} className="pp-area-dyn sc-schnee" style={{ left: s.x + '%', animation: `scSinken ${s.dur}s linear ${s.delay}s infinite` }} />
      ))}
      {blasen.map((b, i) => (
        <i key={'b' + i} className={'pp-area-dyn sc-blase' + (b.gross ? ' gross' : '')} style={{ left: b.x + '%', animation: `scSteigen ${b.dur}s linear ${b.delay}s infinite` }} />
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .sc-strahlen { animation: scStrahlen 5.5s ease-in-out infinite alternate; }
        @keyframes scStrahlen { from { opacity: .35; } to { opacity: 1; } }
        .sc-schein { animation: scSchein 3.4s ease-in-out infinite; }
        @keyframes scSchein { 0%, 100% { opacity: .7; } 18% { opacity: 1; } 30% { opacity: .8; } 44% { opacity: .95; } }
        /* Rand zuckt: unregelmäßig zwischen zwei Bildern springen */
        .sc-rand { animation: scZucken 2.3s steps(1) infinite; }
        @keyframes scZucken {
          0% { background-position: 50% 0%; } 31% { background-position: 50% 100%; } 36% { background-position: 50% 0%; }
          58% { background-position: 50% 100%; } 63% { background-position: 50% 0%; } 67% { background-position: 50% 100%; }
          86% { background-position: 50% 0%; }
        }
        .sc-qualm {
          position: absolute; inset: 0; opacity: .75;
          background: url(${SC}smoke.png) 0 0 / auto 100% repeat-x;
          animation: scQualm 40s steps(128) infinite;
        }
        @keyframes scQualm { from { background-position: 0 0; } to { background-position: calc(-64 * var(--px)) 0; } }
        .sc-flieger { position: absolute; left: 0; display: block; }
        .sc-flieger-bild {
          display: block; width: calc(5 * var(--px)); height: calc(3 * var(--px));
          background: url(${SC}imp.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .34s steps(1) infinite, ppBob 1.1s ease-in-out infinite alternate;
        }
        @keyframes scFlugLtr { from { transform: translateX(calc(40 * var(--px))); } to { transform: translateX(calc(130 * var(--px))); } }
        @keyframes scFlugRtl { from { transform: translateX(calc(130 * var(--px))); } to { transform: translateX(calc(40 * var(--px))); } }
        .sc-glut { position: absolute; width: var(--px); height: var(--px); background: #ffc050; opacity: 0; }
        @keyframes scGlut {
          0% { transform: translate(0, 0); opacity: 0; background: #ffd060; }
          6% { opacity: 1; }
          35% { background: #f58a2c; }
          65% { background: #b8321a; opacity: .95; }
          85% { background: #5a1a2a; opacity: .7; }
          100% { transform: translate(var(--dx), var(--dy)); background: #1c2a4a; opacity: 0; }
        }
        .sc-fisch {
          display: block; width: calc(9 * var(--px)); height: calc(6 * var(--px));
          background: url(${SC}fish.png) 0 0 / 200% 100% no-repeat; animation: ppSprite2 .7s steps(1) infinite;
        }
        .sc-qualle {
          display: block; width: calc(5 * var(--px)); height: calc(7 * var(--px)); opacity: .85;
          background: url(${SC}jelly.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 1.6s steps(1) infinite, ppBob 3.2s ease-in-out infinite alternate;
        }
        .sc-schnee { position: absolute; top: 0; width: var(--px); height: var(--px); background: #9fb8e0; opacity: .55; }
        @keyframes scSinken { from { transform: translate(0, 0); } 50% { transform: translate(calc(3 * var(--px)), calc(50 * var(--px))); } to { transform: translate(0, calc(100 * var(--px))); } }
        .sc-blase { position: absolute; top: calc(96 * var(--px)); width: var(--px); height: var(--px); background: #b8d0f4; opacity: 0; }
        .sc-blase.gross { width: calc(2 * var(--px)); height: calc(2 * var(--px)); background: transparent; box-shadow: inset 0 0 0 var(--px) #b8d0f4; }
        @keyframes scSteigen {
          0% { transform: translate(0, 0); opacity: 0; } 8% { opacity: .8; }
          50% { transform: translate(calc(2 * var(--px)), calc(-48 * var(--px))); }
          100% { transform: translate(0, calc(-96 * var(--px))); opacity: .15; }
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  SPIDER HIVE — felsige Gebirgslandschaft voller Spinnen (v1440, Al 25.9.)
//
//  Al 25.9.: „Hive ist eine felsige Gebirgslandschaft mit Spinnennetzen
//  und diversen Rissen und Löchern voller Spinnen." Nach dem Kartenmotiv:
//  warme braune Felsriegel aus kantigen Brocken (dunkle Fugen, Lichtkante
//  oben rechts, Wandfuß im Schatten), dazwischen sandige Plateaus mit
//  Kieseln, Findlingen, Grasbüscheln und Knochen. Überall Risse, Spalten
//  und Höhlenlöcher, aus denen rote Spinnenaugen leuchten; weiße, schach-
//  brettartig durchbrochene Radnetze über Kanten und Spalten gespannt,
//  Eiersäcke an der Wand, grüne Ranken. Mittig der Nesthügel: drei Fels-
//  stufen mit großem Höhlenschlund (Felszähne wie Kieferklauen, Seiden-
//  vorhang, Eiersäcke an Fäden), darin die acht Augen der Riesenspinne.
//
//  Ebenen (Kunsthöhe 100; per Generator gemalt, der nicht im Projekt
//  liegt): tile.png — Kachel 128; tile-glow.png — roter Schein um die
//  Augen; vines.png — Ranken, 2 Bilder übereinander; hive.png — Nest-
//  hügel 150, mittig; hive-glow.png — Schein im Schlund; giant.png —
//  Riesenaugen (3 Bilder: auf/halb/zu); spider.png (2 Bilder 13×7),
//  spiderling.png (2 Bilder 5×3), hang.png (2 Bilder 7×7), prey.png
//  (3 Bilder 5×6, eingesponnene Beute).
//
//  Animiert: Augen blinzeln in den Löchern (dunkle Lider, zufällig
//  versetzt, manche ziehen sich länger zurück), der Augenschein atmet,
//  die Riesenspinne blinzelt, Spinnen krabbeln kleine Strecken hin und
//  her, Spinnenjunge huschen, Spinnen seilen sich von oben ab und klettern
//  wieder hoch, Tautropfen funkeln in den Netzen, Beute zappelt im Netz,
//  Staub rieselt von den Felskanten, Ranken wiegen. Licht IMMER oben
//  rechts.
// ═══════════════════════════════════════════════════════════════════
const SH = '/areas/spider-hive/';
const SH_W = 150;                                   // Nesthügel
const SH_RIESE = { x: 61, y: 49, w: 28, h: 8 };     // Riesenaugen im Schlund (im Hügel)
// Augenpaare (3×1, linkes Auge; Kunstpixel neben der Brettmitte), Netze
// [x, y, Radius] und Staubkanten [x, oben, unten] — vom Generator.
const SH_LIDER = [[-3,13],[-18,4],[28,22],[-29,20],[37,56],[37,58],[-37,59],[39,46],[-40,44],[40,44],[-51,6],[51,67],[-52,64],[60,11],[-68,11],[69,65],[-76,62],[77,6],[-84,58],[85,56],[93,22],[-97,13],[-100,15],[102,69],[-103,57],[110,4],[-112,11],[-112,66],[-113,9],[116,58],[117,56],[-118,67],[125,17],[-131,17],[138,67],[-139,56],[-140,58],[143,9],[144,11],[144,66],[-146,4],[153,57],[-154,69],[156,15],[159,13],[-163,22],[-171,56],[172,58],[-179,6],[180,62]];
const SH_NETZE = [[33,12,11],[-37,26,8],[52,23,8],[53,58,6],[-55,72,5],[-76,23,8],[86,21,5],[-92,61,7],[102,60,4],[122,45,6],[-126,69,5],[130,69,5],[-134,45,6],[-154,60,4],[164,61,7],[-170,21,5],[180,23,8]];
const SH_STAUB = [[-52,21,50],[52,24,46],[76,21,50],[-76,24,46],[-88,69,79],[90,74,84],[-102,16,48],[102,24,47],[-120,71,81],[-128,20,44],[128,20,44],[136,71,81],[154,16,48],[-154,24,47],[-166,74,84],[168,69,79],[-180,21,50],[180,24,46]];
// Eingesponnene Beute: im Netz im Felspass (Kachel) und im großen Netz am Hügel
const SH_BEUTE = [[-92, 61], [164, 61], [33, 12], [-220, 61]];

const SpiderHiveOverlay = React.memo(function SpiderHiveOverlay() {
  const lider = useMemo(() => SH_LIDER.slice(0, ppFxN(SH_LIDER.length)).map(([x, y]) => ({
    x, y, weg: Math.random() < .25, dur: 3 + Math.random() * 7, delay: -Math.random() * 10,
  })), []);
  const funkeln = useMemo(() => ppZufall(ppFxN(16), () => {
    const [x, y, r] = SH_NETZE[Math.floor(Math.random() * SH_NETZE.length)];
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]][Math.floor(Math.random() * 8)];
    const d = 1 + Math.floor(Math.random() * (r - 1));
    return { x: x + dx * d, y: y + dy * d, dur: 2.2 + Math.random() * 2.6, delay: -Math.random() * 5 };
  }), []);
  const krabbler = useMemo(() => ppZufall(ppFxN(8), () => {
    let x, y, weg;
    do {                                                          // ganze Strecke nicht im schwarzen Schlund
      x = Math.round((Math.random() - .5) * 340); y = Math.round(18 + Math.random() * 72);
      weg = Math.round((Math.random() < .5 ? -1 : 1) * (6 + Math.random() * 16));
    } while (Math.min(x, x + weg) < 28 && Math.max(x, x + weg) + 13 > -28 && y > 34 && y < 82);
    return { x, y, weg, dur: Math.abs(weg) * (.22 + Math.random() * .15), delay: -Math.random() * 10 };
  }), []);
  const junge = useMemo(() => ppZufall(ppFxN(6), (i) => {
    const gx = Math.round((Math.random() - .5) * 320), gy = Math.round(78 + Math.random() * 16);
    const weg = Math.round((i % 2 ? -1 : 1) * (10 + Math.random() * 14));
    return { x: gx + (i % 3) * 4, y: gy - (i % 2) * 3, weg, dur: Math.abs(weg) * .09, delay: -Math.random() * 6 };
  }), []);
  const seiler = useMemo(() => ppZufall(ppFxN(4), (i) => ({
    x: Math.round((i - 1.5) * 84 + (Math.random() - .5) * 40), tief: Math.round(14 + Math.random() * 26),
    dur: 11 + Math.random() * 8, delay: -Math.random() * 18,
  })), []);
  const staub = useMemo(() => ppZufall(ppFxN(10), () => {
    const [x, y0, y1] = SH_STAUB[Math.floor(Math.random() * SH_STAUB.length)];
    return { x: x + Math.round((Math.random() - .5) * 6), y0, fall: Math.min(10, y1 - y0), dur: 5 + Math.random() * 5, delay: -Math.random() * 10 };
  }), []);
  return (
    <PixelScene artH={100} bg="#7b5428" className="spider-hive-overlay">
      <PixelBand src={SH + 'tile.png'} />
      <PixelBand src={SH + 'tile-glow.png'} className="sh-glimmen" />
      <PixelBand src={SH + 'vines.png'} style={{ backgroundSize: 'auto 200%', animation: 'ppBand2 2.8s steps(1) infinite' }} />
      <PixelPiece src={SH + 'hive.png'} w={SH_W} />
      <PixelPiece src={SH + 'hive-glow.png'} w={SH_W} className="sh-glimmen sh-schlund" />
      <i className="sh-riese" style={{ left: ppArtX(SH_RIESE.x, SH_W), top: ppArt(SH_RIESE.y) }} />
      {lider.map((l, i) => (
        <i key={'l' + i} className="pp-area-dyn sh-lid" style={{
          left: ppArtX(l.x, 0), top: ppArt(l.y),
          animation: `${l.weg ? 'shWeg' : 'shBlinzeln'} ${l.dur.toFixed(2)}s steps(1) ${l.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {SH_BEUTE.map(([x, y], i) => (
        <i key={'p' + i} className="sh-beute" style={{ left: ppArtX(x + 1, 0), top: ppArt(y - 2), animationDelay: `${-i * 1.7}s` }} />
      ))}
      {funkeln.map((f, i) => (
        <i key={'f' + i} className="pp-area-dyn pp-px-funkeln" style={{ left: ppArtX(f.x - 1, 0), top: ppArt(f.y - 1), animation: `ppFunkeln ${f.dur.toFixed(2)}s steps(1) ${f.delay.toFixed(2)}s infinite` }} />
      ))}
      {staub.map((s, i) => (
        <i key={'s' + i} className="pp-area-dyn sh-staub" style={{
          left: ppArtX(s.x, 0), top: ppArt(s.y0), '--fall': ppArt(s.fall),
          animation: `shRieseln ${s.dur.toFixed(2)}s steps(${s.fall}) ${s.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {junge.map((j, i) => (
        <i key={'j' + i} className="pp-area-dyn sh-junges" style={{
          left: ppArtX(j.x, 0), top: ppArt(j.y), '--weg': ppArt(j.weg),
          animation: `shKrabbeln ${j.dur.toFixed(2)}s steps(${Math.abs(j.weg)}) ${j.delay.toFixed(2)}s infinite alternate, ppSprite2 .16s steps(1) infinite`,
        }} />
      ))}
      {krabbler.map((k, i) => (
        <i key={'k' + i} className="pp-area-dyn sh-spinne" style={{
          left: ppArtX(k.x, 0), top: ppArt(k.y), '--weg': ppArt(k.weg),
          animation: `shKrabbeln ${k.dur.toFixed(2)}s steps(${Math.abs(k.weg)}) ${k.delay.toFixed(2)}s infinite alternate, ppSprite2 .3s steps(1) infinite`,
        }} />
      ))}
      {seiler.map((s, i) => (
        <i key={'h' + i} className="pp-area-dyn sh-seiler" style={{
          left: ppArtX(s.x, 0), '--tief': ppArt(s.tief),
          animation: `shAbseilen ${s.dur.toFixed(2)}s steps(${s.tief + 10}) ${s.delay.toFixed(2)}s infinite, ppSprite2 .5s steps(1) infinite`,
        }} />
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .sh-glimmen { animation: shGlimmen 3.4s ease-in-out infinite alternate; }
        .sh-schlund { animation-duration: 4.6s; animation-delay: -1.3s; }
        @keyframes shGlimmen { from { opacity: .45; } to { opacity: 1; } }
        .sh-riese {
          position: absolute; width: calc(${SH_RIESE.w} * var(--px)); height: calc(${SH_RIESE.h} * var(--px));
          background: url(${SH}giant.png) 0 0 / 300% 100% no-repeat;
          animation: shRiese 9s steps(1) infinite;
        }
        @keyframes shRiese {
          0%, 61% { background-position: 0 0; } 62% { background-position: 50% 0; } 63%, 64% { background-position: 100% 0; }
          65% { background-position: 50% 0; } 66%, 86% { background-position: 0 0; } 87% { background-position: 50% 0; }
          88% { background-position: 100% 0; } 89% { background-position: 50% 0; } 90%, 100% { background-position: 0 0; }
        }
        .sh-lid { position: absolute; width: calc(3 * var(--px)); height: var(--px); background: #080403; opacity: 0; }
        @keyframes shBlinzeln { 0%, 90% { opacity: 0; } 91%, 93% { opacity: 1; } 94%, 100% { opacity: 0; } }
        @keyframes shWeg { 0%, 45% { opacity: 0; } 46%, 55% { opacity: 1; } 56%, 58% { opacity: 0; } 59%, 90% { opacity: 1; } 91%, 100% { opacity: 0; } }
        .sh-spinne { position: absolute; width: calc(13 * var(--px)); height: calc(7 * var(--px)); background: url(${SH}spider.png) 0 0 / 200% 100% no-repeat; }
        .sh-junges { position: absolute; width: calc(5 * var(--px)); height: calc(3 * var(--px)); background: url(${SH}spiderling.png) 0 0 / 200% 100% no-repeat; }
        @keyframes shKrabbeln { 0%, 12% { translate: 0 0; } 88%, 100% { translate: var(--weg) 0; } }
        .sh-seiler { position: absolute; top: 0; width: calc(7 * var(--px)); height: calc(7 * var(--px)); background: url(${SH}hang.png) 0 0 / 200% 100% no-repeat; }
        .sh-seiler::before {
          content: ''; position: absolute; left: calc(3 * var(--px)); bottom: calc(100% - var(--px)); width: var(--px); height: calc(110 * var(--px));
          background: rgba(236, 228, 214, .55);
        }
        @keyframes shAbseilen {
          0% { translate: 0 calc(-10 * var(--px)); } 30%, 62% { translate: 0 var(--tief); } 100% { translate: 0 calc(-10 * var(--px)); }
        }
        .sh-beute { position: absolute; width: calc(5 * var(--px)); height: calc(6 * var(--px)); background: url(${SH}prey.png) 0 0 / 300% 100% no-repeat; animation: shZappeln 5.2s steps(1) infinite; }
        @keyframes shZappeln {
          0%, 70% { background-position: 0 0; } 72% { background-position: 50% 0; } 75% { background-position: 100% 0; }
          78% { background-position: 50% 0; } 81% { background-position: 100% 0; } 84%, 92% { background-position: 0 0; }
          93% { background-position: 100% 0; } 96%, 100% { background-position: 0 0; }
        }
        .sh-staub { position: absolute; width: var(--px); height: var(--px); background: #c09452; opacity: 0; }
        @keyframes shRieseln {
          0% { translate: 0 0; opacity: 0; } 1% { opacity: .9; }
          24% { translate: 0 var(--fall); opacity: .9; }
          25%, 100% { translate: 0 var(--fall); opacity: 0; }
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  STINKY STABLES — ein RIESIGER Stall voller Dungberge (v1440, Al 25.9.)
//
//  Al 25.9.: „Stables zeigt einen *riesigen* Stall mit riesigen Bergen an
//  Dung." Der Witz ist der Maßstab: das Gebälk ist für Riesen gebaut,
//  der Dung türmt sich zu Bergen, und oben auf dem Grat läuft winzig eine
//  schwarz-weiße Kuh (wie im Kartenmotiv). Eine Riesenmistgabel steckt im
//  Hang, am Fuß lehnen eine Leiter und Heuballen in normaler Größe — sie
//  wirken daneben wie Spielzeug.
//
//  Ebenen (Kunsthöhe 100; per Generator gemalt, der nicht im Projekt
//  liegt): tile.png — Kachel 128 (Dachschalung mit Lichtritzen, Sparren,
//  Zugbalken, Riesenpfosten mit Kopfbändern, Eisenbändern und einem
//  Riesenhufeisen, Bretterwand mit Riegel, Seile, Steinpfeiler mit
//  Türrahmen, Heuraufe, Strohboden mit Halmen, Eimer, Heuballen, Jauche-
//  pfütze, hintere Dunghaufen und ein vorderer, angeschnittener Haufen);
//  heap.png — der Riesendungberg (200, mittig) aus langen, schrägen
//  Wülsten mit Kruste, Knubbeln, Trockenrissen, Stroh, Mistgabel, Leiter,
//  Heuballen und Schlagschatten; haze.png — grünlicher Dunst (Kachel
//  128×40, zwei Lagen ziehen gegeneinander); shafts.png — Lichtstrahlen
//  aus den Dachritzen (Kachel 128, halbdurchsichtig); cow.png (5 Bilder
//  14×9: 3 Laufen, 2 Grasen mit Schwanzwedeln); stink.png (3 Bilder 7×16);
//  puff.png (3 Bilder 9×9); bubble.png (4 Bilder 5×4); swallow.png
//  (2 Bilder 7×5); hen.png (2 Bilder 5×5).
//
//  Animiert: grünliche Gestankschwaden und -wolken steigen wellig von den
//  Bergen auf, der Dunst zieht, Fliegen schwirren in kleinen Schleifen um
//  die Gipfel, die Kuh läuft den Grat entlang, bleibt stehen, grast und
//  wedelt mit dem Schwanz, dreht um; Staub und Strohkörnchen rieseln durch
//  die Lichtstrahlen (die leise atmen), der Dung blubbert ab und zu,
//  Schwalben flitzen unterm Gebälk, zwei Hühner picken.
//  Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const SS = '/areas/stinky-stables/';
const SS_W = 200;                              // Dungberg-Stück
const SS_KUH = { x: 84, y: 13, weg: 22 };       // Kuh (14×9) links oben, Weg nach rechts
// Kachel-x t (0..127) → Kunstpixel neben der Brettmitte, k-te Wiederholung
const ssKachel = (t, k) => t - 64 + 128 * k;
// Gipfel (x neben der Mitte, y Oberfläche) — Quellen für Gestank und Fliegen
const SS_GIPFEL = [
  [-12, 22], [4, 22], [16, 22], [-40, 44], [34, 36], [-62, 60], [58, 50],
  ...[-2, -1, 1, 2].flatMap(k => [[ssKachel(50, k), 31], [ssKachel(116, k), 40], [ssKachel(96, k), 80]]),
];
const SS_BLASEN = [[62, 52], [126, 38], [88, 72], [150, 70], [40, 76], [108, 58], [170, 84]];
const SS_RITZEN = [41, 97];                   // Dachritzen (Kachel-x), Strahl fällt nach links unten

const StinkyStablesOverlay = React.memo(function StinkyStablesOverlay() {
  const schwaden = useMemo(() => {
    const quellen = [...SS_GIPFEL.slice(0, 7), ...SS_GIPFEL.slice(7).sort(() => Math.random() - .5)];
    return quellen.slice(0, ppFxN(12)).map(([x, y]) => ({
      x: x + (Math.random() - .5) * 8, y, dur: 4.5 + Math.random() * 3, delay: -Math.random() * 8,
    }));
  }, []);
  const wolken = useMemo(() => ppZufall(ppFxN(7), (i) => {
    const [x, y] = i < 3 ? SS_GIPFEL[[0, 3, 4][i]] : SS_GIPFEL[7 + Math.floor(Math.random() * (SS_GIPFEL.length - 7))];
    return { x: x + (Math.random() - .5) * 14, y: y + 2 + Math.random() * 6, dur: 6 + Math.random() * 3, delay: -Math.random() * 9 };
  }), []);
  const fliegen = useMemo(() => ppZufall(ppFxN(12), (i) => {
    const [x, y] = SS_GIPFEL[i % SS_GIPFEL.length];
    return {
      x: x + (Math.random() - .5) * 10, y: y - 4 - Math.random() * 5,
      dur: 1.1 + Math.random() * .9, delay: -Math.random() * 2, b: i % 2 === 1,
      drift: 3 + Math.random() * 3,
    };
  }), []);
  const staub = useMemo(() => ppZufall(ppFxN(14), () => {
    const t = SS_RITZEN[Math.floor(Math.random() * 2)] + Math.random() * 3;
    const k = Math.floor(Math.random() * 5) - 2;
    return { x: ssKachel(t, k), y: 4 + Math.random() * 6, dur: 11 + Math.random() * 8, delay: -Math.random() * 19 };
  }), []);
  const blasen = useMemo(() => SS_BLASEN.slice(0, ppFxN(SS_BLASEN.length)).map(([x, y]) => ({
    x, y, dur: 4 + Math.random() * 4, delay: -Math.random() * 8,
  })), []);
  const schwalben = useMemo(() => ppZufall(ppFxN(2), (i) => ({
    y: 16 + Math.random() * 16, dur: 9 + Math.random() * 6, delay: -Math.random() * 15, rtl: i % 2 === 1,
  })), []);
  return (
    <PixelScene artH={100} bg="#1a110a" className="stinky-stables-overlay">
      <PixelBand src={SS + 'tile.png'} />
      <PixelPiece src={SS + 'heap.png'} w={SS_W} />
      <i className="ss-huhn" style={{ left: ppArtX(24, SS_W), top: ppArt(84) }} />
      <i className="ss-huhn b" style={{ left: ppArtX(172, SS_W), top: ppArt(81) }} />
      <div className="ss-kuh-bahn" style={{ left: ppArtX(SS_KUH.x, SS_W), top: ppArt(SS_KUH.y) }}>
        <div className="ss-kuh-dreh">
          <i className="ss-kuh lauf" />
          <i className="ss-kuh grast" />
        </div>
      </div>
      {blasen.map((b, i) => (
        <i key={'b' + i} className="pp-area-dyn ss-blase" style={{ left: ppArtX(b.x - 2, SS_W), top: ppArt(b.y - 3), animation: `ssBlubb ${b.dur.toFixed(2)}s steps(1) ${b.delay.toFixed(2)}s infinite` }} />
      ))}
      <div className="pp-pixel-layer ss-dunst" style={{ top: ppArt(8) }} />
      <div className="pp-pixel-layer ss-dunst b" style={{ top: ppArt(44) }} />
      <PixelBand src={SS + 'shafts.png'} className="ss-strahlen" />
      {staub.map((s, i) => (
        <i key={'s' + i} className="pp-area-dyn ss-staub" style={{ left: ppArtX(s.x, 0), top: ppArt(s.y), animation: `ssRieseln ${s.dur.toFixed(2)}s steps(56) ${s.delay.toFixed(2)}s infinite` }} />
      ))}
      {wolken.map((w, i) => (
        <i key={'m' + i} className="pp-area-dyn ss-mief" style={{ left: ppArtX(w.x - 4, 0), top: ppArt(w.y - 9), animationDuration: `${w.dur.toFixed(2)}s`, animationDelay: `${w.delay.toFixed(2)}s` }} />
      ))}
      {schwaden.map((s, i) => (
        <i key={'g' + i} className="pp-area-dyn ss-schwade" style={{ left: ppArtX(s.x - 3, 0), top: ppArt(s.y - 16), animation: `ssSteigen ${s.dur.toFixed(2)}s steps(14) ${s.delay.toFixed(2)}s infinite, ppSprite3 .9s steps(1) infinite` }} />
      ))}
      {fliegen.map((f, i) => (
        <div key={'f' + i} className="pp-area-dyn ss-fliege-ort" style={{ left: ppArtX(f.x, 0), top: ppArt(f.y), '--bob': ppArt(f.drift), animation: `ppBob ${(f.drift * 0.9).toFixed(2)}s steps(4) infinite alternate` }}>
          <i className="ss-fliege" style={{ animation: `${f.b ? 'ssFlugB' : 'ssFlugA'} ${f.dur.toFixed(2)}s steps(2) ${f.delay.toFixed(2)}s infinite, ssSurr .12s steps(1) infinite` }} />
        </div>
      ))}
      {schwalben.map((s, i) => (
        <div key={'w' + i} className="pp-area-dyn pp-quer" style={ppQuer(s.y, s.dur, s.delay, s.rtl)}>
          <i className="ss-schwalbe" style={{ transform: s.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .ss-dunst {
          position: absolute; left: 0; right: 0; height: calc(40 * var(--px));
          background: url(${SS}haze.png) 0 0 / auto 100% repeat-x;
          animation: ssDunst 64s steps(128) infinite;
        }
        .ss-dunst.b { animation-duration: 90s; animation-direction: reverse; opacity: .8; }
        @keyframes ssDunst { from { background-position: 0 0; } to { background-position: calc(128 * var(--px)) 0; } }
        .ss-strahlen { animation: ssAtmen 5.3s ease-in-out infinite alternate; }
        @keyframes ssAtmen { from { opacity: .65; } to { opacity: 1; } }
        /* Kuh: Bahn (Weg), Drehen (Blickrichtung), Laufen/Grasen (Bilder) — ein 40-s-Takt */
        .ss-kuh-bahn { position: absolute; width: calc(14 * var(--px)); height: calc(9 * var(--px)); animation: ssKuhWeg 40s linear infinite; }
        .ss-kuh-dreh { position: absolute; inset: 0; animation: ssKuhDreh 40s steps(1) infinite; }
        .ss-kuh { position: absolute; inset: 0; background: url(${SS}cow.png) 0 0 / 500% 100% no-repeat; }
        .ss-kuh.lauf { animation: ssKuhLauf .75s steps(1) infinite, ssKuhZeigL 40s steps(1) infinite; }
        .ss-kuh.grast { animation: ssKuhGrast 2.6s steps(1) infinite, ssKuhZeigG 40s steps(1) infinite; }
        @keyframes ssKuhWeg {
          0% { transform: translateX(0); animation-timing-function: steps(${SS_KUH.weg}); }
          40%, 55% { transform: translateX(calc(${SS_KUH.weg} * var(--px))); }
          55% { animation-timing-function: steps(${SS_KUH.weg}); }
          92%, 100% { transform: translateX(0); }
        }
        @keyframes ssKuhDreh { 0% { transform: scaleX(1); } 55%, 100% { transform: scaleX(-1); } }
        @keyframes ssKuhZeigL { 0% { opacity: 1; } 40% { opacity: 0; } 55% { opacity: 1; } 92%, 100% { opacity: 0; } }
        @keyframes ssKuhZeigG { 0% { opacity: 0; } 40% { opacity: 1; } 55% { opacity: 0; } 92%, 100% { opacity: 1; } }
        @keyframes ssKuhLauf { 0% { background-position: 0 0; } 25% { background-position: 25% 0; } 50% { background-position: 0 0; } 75% { background-position: 50% 0; } }
        @keyframes ssKuhGrast { 0%, 55% { background-position: 75% 0; } 60%, 70% { background-position: 100% 0; } 75%, 80% { background-position: 75% 0; } 85%, 92% { background-position: 100% 0; } 96%, 100% { background-position: 75% 0; } }
        .ss-huhn { position: absolute; width: calc(5 * var(--px)); height: calc(5 * var(--px)); background: url(${SS}hen.png) 0 0 / 200% 100% no-repeat; animation: ssPicken 2.3s steps(1) infinite; }
        .ss-huhn.b { transform: scaleX(-1); animation-duration: 3.1s; animation-delay: -1.2s; }
        @keyframes ssPicken { 0%, 40% { background-position: 0 0; } 45%, 52% { background-position: 100% 0; } 57%, 62% { background-position: 0 0; } 67%, 74% { background-position: 100% 0; } 79%, 100% { background-position: 0 0; } }
        .ss-blase { position: absolute; width: calc(5 * var(--px)); height: calc(4 * var(--px)); background: url(${SS}bubble.png) 0 0 / 400% 100% no-repeat; }
        @keyframes ssBlubb { 0%, 72% { background-position: 0 0; } 76% { background-position: 33.33% 0; } 82% { background-position: 66.67% 0; } 90% { background-position: 33.33% 0; } 93% { background-position: 66.67% 0; } 96% { background-position: 100% 0; } 99%, 100% { background-position: 0 0; } }
        .ss-schwade { position: absolute; width: calc(7 * var(--px)); height: calc(16 * var(--px)); background: url(${SS}stink.png) 0 0 / 300% 100% no-repeat; opacity: 0; }
        @keyframes ssSteigen {
          0% { transform: translateY(calc(4 * var(--px))); opacity: 0; }
          20% { opacity: .85; } 70% { opacity: .6; }
          100% { transform: translateY(calc(-10 * var(--px))); opacity: 0; }
        }
        .ss-mief {
          position: absolute; width: calc(9 * var(--px)); height: calc(9 * var(--px)); opacity: 0;
          background: url(${SS}puff.png) 0 0 / 300% 100% no-repeat;
          animation-name: ssMiefSteigen, ssMiefBild; animation-timing-function: steps(18), steps(1); animation-iteration-count: infinite;
        }
        @keyframes ssMiefSteigen {
          0% { transform: translateY(0); opacity: 0; } 12% { opacity: .9; } 60% { opacity: .75; }
          100% { transform: translateY(calc(-18 * var(--px))); opacity: 0; }
        }
        @keyframes ssMiefBild { 0% { background-position: 0 0; } 30% { background-position: 50% 0; } 62%, 100% { background-position: 100% 0; } }
        .ss-staub { position: absolute; width: var(--px); height: var(--px); background: #f4dd9c; opacity: 0; }
        @keyframes ssRieseln {
          0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: .75; }
          50% { opacity: .4; } 60% { opacity: .8; } 90% { opacity: .5; }
          100% { transform: translate(calc(-23 * var(--px)), calc(56 * var(--px))); opacity: 0; }
        }
        .ss-fliege-ort { position: absolute; width: var(--px); height: var(--px); }
        .ss-fliege { position: absolute; width: var(--px); height: var(--px); background: #120b06; }
        @keyframes ssSurr { 0% { box-shadow: 0 calc(-1 * var(--px)) 0 rgba(215, 225, 235, .75); } 50% { box-shadow: var(--px) 0 0 rgba(215, 225, 235, .5); } }
        @keyframes ssFlugA {
          0% { transform: translate(0, 0); } 12.5% { transform: translate(calc(3 * var(--px)), calc(-2 * var(--px))); }
          25% { transform: translate(calc(5 * var(--px)), 0); } 37.5% { transform: translate(calc(3 * var(--px)), calc(2 * var(--px))); }
          50% { transform: translate(0, 0); } 62.5% { transform: translate(calc(-3 * var(--px)), calc(-2 * var(--px))); }
          75% { transform: translate(calc(-5 * var(--px)), 0); } 87.5% { transform: translate(calc(-3 * var(--px)), calc(2 * var(--px))); }
          100% { transform: translate(0, 0); }
        }
        @keyframes ssFlugB {
          0% { transform: translate(0, 0); } 20% { transform: translate(calc(4 * var(--px)), calc(-3 * var(--px))); }
          40% { transform: translate(calc(2 * var(--px)), calc(-6 * var(--px))); } 60% { transform: translate(calc(-3 * var(--px)), calc(-5 * var(--px))); }
          80% { transform: translate(calc(-4 * var(--px)), calc(-2 * var(--px))); } 100% { transform: translate(0, 0); }
        }
        .ss-schwalbe {
          display: block; width: calc(7 * var(--px)); height: calc(4 * var(--px));
          background: url(${SS}swallow.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .24s steps(1) infinite, ppBob 1.1s steps(3) infinite alternate; --bob: calc(3 * var(--px));
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  TARLEINN'S FLOATING ISLAND — Kartenstil (v1440, Al 25.9.)
//
//  Al 25.9.: „Floating Island ist eine satte, grüne schwebende Insel."
//  Nach dem Kartenmotiv, leicht von oben gesehen: kräftig blauer Himmel
//  mit Pixelwolken und einem Wolkenmeer tief unten, darin kleine
//  schwebende Felsinseln. Mitte: die große Insel — sattgrüne Wiese mit
//  Rauschen, schattierte Baumkronen mit Schlagschatten, Büsche mit
//  Blumenkränzen (rosa/gelb/rot/blau wie im Motiv), violettgraue
//  Felskuppe, grauer Stein, ein Quellteich mit Steinen, ein Fluss mit
//  Holzsteg, der über die Kante als Wasserfall in die Tiefe stürzt.
//  Darunter die Unterseite aus geschichteter Erde und Fels mit Fugen,
//  eingebetteten Steinen, Wurzeln und hängenden Ranken, nach unten in
//  Zacken spitz zulaufend.
//
//  Ebenen (Kunsthöhe 100; per Generator gemalt, der nicht im Projekt
//  liegt): sky.png — Kachel 128 (Himmel, ferne Wolkenstreifen);
//  clouds-back.png — Kachel 256 (Haufenwolken, Wolkenmeer), zieht
//  langsam; isle-a…e.png — kleine Inseln (je weiter weg, desto blasser),
//  schweben; island.png — Hauptinsel 200 breit, mittig; water.png —
//  Fluss + Wasserfall (3 Bilder übereinander); sway.png — Blumen und
//  Grasbüschel (2 Bilder); mist.png — Gischt am Fuß des Falls (3 Bilder);
//  clouds-front.png — Kachel 256, Schwaden vorn, zieht schneller;
//  bird.png (Schwalbe im Profil, 4 Bilder 11×7), butterfly.png (2 Bilder 5×4).
//
//  Animiert: Fluss und Wasserfall fließen, Gischt wallt und steigt,
//  die große Insel und die kleinen schweben auf und ab (ganze
//  Kunstpixel), Wolken ziehen in zwei Ebenen, Schwalben fliegen im Profil
//  (Kopf in Flugrichtung, Rückflüge gespiegelt),
//  Blumen und Gras wiegen, Schmetterlinge flattern über der Wiese,
//  Erdkrümel rieseln von den Zacken, Wasser glitzert.
//  Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const FI = '/areas/floating-island/';
const FI_W = 200;                         // Hauptinsel; Stück-x 100 = Brettmitte
const fiX = (x) => x - FI_W / 2;          // Stück-x → x neben der Mitte
const FI_FALL = { x: 63, y: 57 };         // Überlauf des Flusses (Stück-Koordinaten)
// Zacken der Unterseite (Stück-Koordinaten), von hier rieseln Krümel
const FI_ZACKEN = [[96, 96], [68, 79], [131, 82], [154, 68], [42, 62], [172, 53]];
// kleine Inseln: Bild, Breite, Höhe, Mitte neben der Brettmitte, Oberkante, Schwebedauer
const FI_INSELN = [
  { n: 'isle-a', w: 34, h: 30, x: -99, y: 58, dur: 5.3 },
  { n: 'isle-b', w: 26, h: 24, x: 104, y: 44, dur: 4.1 },
  { n: 'isle-c', w: 40, h: 34, x: -156, y: 12, dur: 6.2 },
  { n: 'isle-d', w: 20, h: 18, x: 152, y: 72, dur: 3.7 },
  { n: 'isle-e', w: 30, h: 26, x: 192, y: 18, dur: 5.8 },
  { n: 'isle-d', w: 20, h: 18, x: -204, y: 64, dur: 4.6 },
  { n: 'isle-b', w: 26, h: 24, x: 238, y: 58, dur: 4.9 },
];
// Flugbahnen der Schmetterlinge über der Wiese (Stück-Koordinaten)
const FI_FALTER = [[92, 30], [140, 40], [48, 40]];

const FloatingIslandOverlay = React.memo(function FloatingIslandOverlay() {
  const voegel = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    y: [6, 22, 40][i] + Math.random() * 4, dur: 20 + Math.random() * 12, delay: -Math.random() * 30,
    rtl: i % 2 === 1, schlag: .45 + Math.random() * .2,
  })), []);
  const falter = useMemo(() => FI_FALTER.slice(0, ppFxN(3)).map(([x, y], i) => ({
    x, y, dur: 9 + Math.random() * 5, delay: -Math.random() * 10, flip: i % 2 === 1,
  })), []);
  const kruemel = useMemo(() => ppZufall(ppFxN(8), (i) => {
    const [x, y] = FI_ZACKEN[i % FI_ZACKEN.length];
    return { x: x + Math.round(Math.random() * 2 - 1), y, fall: 10 + Math.random() * 14, dur: 3 + Math.random() * 3, delay: -Math.random() * 6 };
  }), []);
  const tropfen = useMemo(() => ppZufall(ppFxN(8), () => ({
    x: FI_FALL.x + (Math.random() < .5 ? -1 : 1) * (4 + Math.random() * 3), y: 64 + Math.random() * 10,
    fall: 14 + Math.random() * 10, dur: 1 + Math.random() * .8, delay: -Math.random() * 2,
  })), []);
  const gischt = useMemo(() => ppZufall(ppFxN(4), (i) => ({
    x: FI_FALL.x - 6 + i * 3 + Math.random() * 2, dur: 3 + Math.random() * 2, delay: -Math.random() * 5,
  })), []);
  const glanz = useMemo(() => ppZufall(ppFxN(4), (i) => ({
    x: [60, 58, 61, 63][i], y: [10, 30, 46, 70][i], dur: 2 + Math.random() * 2, delay: -Math.random() * 4,
  })), []);
  return (
    <PixelScene artH={100} bg="#1a5dd7" className="floating-island-overlay">
      <PixelBand src={FI + 'sky.png'} />
      <PixelBand src={FI + 'clouds-back.png'} className="fi-wolken-hinten" />
      {FI_INSELN.map((s, i) => (
        <i key={'s' + i} className="fi-insel" style={{
          left: ppArtX(s.x - s.w / 2, 0), top: ppArt(s.y), width: ppArt(s.w), height: ppArt(s.h),
          backgroundImage: `url(${FI}${s.n}.png)`, transform: i >= 5 ? 'scaleX(-1)' : undefined,
          animation: `fiSchweben ${s.dur}s steps(1) ${-i * 1.3}s infinite`,
        }} />
      ))}
      <div className="fi-schwebt">
        <PixelPiece src={FI + 'island.png'} w={FI_W} />
        <PixelPiece src={FI + 'water.png'} w={FI_W} style={{ backgroundSize: '100% 300%', animation: 'ppBand3 .6s steps(1) infinite' }} />
        <PixelPiece src={FI + 'sway.png'} w={FI_W} style={{ backgroundSize: '100% 200%', animation: 'ppBand2 2.2s steps(1) infinite' }} />
        {glanz.map((g, i) => (
          <i key={'g' + i} className="pp-area-dyn pp-px-funkeln" style={{ left: ppArtX(fiX(g.x) - 1, 0), top: ppArt(g.y - 1), animation: `ppFunkeln ${g.dur.toFixed(2)}s steps(1) ${g.delay.toFixed(2)}s infinite` }} />
        ))}
        {kruemel.map((k, i) => (
          <i key={'k' + i} className="pp-area-dyn fi-kruemel" style={{
            left: ppArtX(fiX(k.x), 0), top: ppArt(k.y), '--fall': ppArt(Math.round(k.fall)),
            animation: `fiRieseln ${k.dur.toFixed(2)}s steps(${Math.round(k.fall)}) ${k.delay.toFixed(2)}s infinite`,
          }} />
        ))}
        {tropfen.map((t, i) => (
          <i key={'t' + i} className="pp-area-dyn fi-tropfen" style={{
            left: ppArtX(fiX(Math.round(t.x)), 0), top: ppArt(Math.round(t.y)), '--fall': ppArt(Math.round(t.fall)),
            animation: `fiRieseln ${t.dur.toFixed(2)}s steps(${Math.round(t.fall)}) ${t.delay.toFixed(2)}s infinite`,
          }} />
        ))}
        <i className="fi-nebel" style={{ left: ppArtX(fiX(FI_FALL.x) - 12, 0), top: ppArt(88) }} />
        {gischt.map((g, i) => (
          <i key={'n' + i} className="pp-area-dyn fi-gischt" style={{
            left: ppArtX(fiX(g.x), 0), top: ppArt(90),
            animation: `fiGischt ${g.dur.toFixed(2)}s steps(8) ${g.delay.toFixed(2)}s infinite`,
          }} />
        ))}
        {falter.map((f, i) => (
          <i key={'f' + i} className="pp-area-dyn fi-falter-bahn" style={{
            left: ppArtX(fiX(f.x), 0), top: ppArt(f.y),
            animation: `fiFalterBahn ${f.dur.toFixed(2)}s linear ${f.delay.toFixed(2)}s infinite${f.flip ? ' reverse' : ''}`,
          }}><i className="fi-falter" /></i>
        ))}
      </div>
      <PixelBand src={FI + 'clouds-front.png'} className="fi-wolken-vorn" />
      {voegel.map((v, i) => (
        <div key={'v' + i} className="pp-area-dyn pp-quer" style={ppQuer(v.y, v.dur, v.delay, v.rtl)}>
          <i className="fi-vogel" style={{ transform: v.rtl ? 'scaleX(-1)' : undefined, animationDuration: `${v.schlag.toFixed(2)}s, 2.3s` }} />
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .fi-wolken-hinten { animation: fiZug 150s steps(256) infinite; }
        .fi-wolken-vorn { opacity: .92; animation: fiZug 60s steps(256) infinite; }
        @keyframes fiZug { from { background-position: 50% 0; } to { background-position: calc(50% + 256 * var(--px)) 0; } }
        .fi-schwebt { position: absolute; inset: 0; animation: fiSchweben 7s steps(1) infinite; }
        @keyframes fiSchweben {
          0% { translate: 0 0; } 18% { translate: 0 calc(-1 * var(--px)); } 42% { translate: 0 calc(-2 * var(--px)); }
          60% { translate: 0 calc(-1 * var(--px)); } 82% { translate: 0 0; } 100% { translate: 0 0; }
        }
        .fi-insel { position: absolute; background-size: 100% 100%; background-repeat: no-repeat; }
        .fi-kruemel, .fi-tropfen { position: absolute; width: var(--px); height: var(--px); background: #5a3a1e; opacity: 0; }
        .fi-tropfen { background: #bcd9ff; }
        @keyframes fiRieseln {
          0% { transform: translateY(0); opacity: 0; } 5% { opacity: 1; }
          80% { opacity: 1; } 100% { transform: translateY(var(--fall)); opacity: 0; }
        }
        .fi-nebel { position: absolute; width: calc(24 * var(--px)); height: calc(10 * var(--px)); background: url(${FI}mist.png) 0 0 / 300% 100% no-repeat; animation: ppSprite3 .9s steps(1) infinite; }
        .fi-gischt { position: absolute; width: calc(3 * var(--px)); height: calc(2 * var(--px)); background: #e3edfb; opacity: 0; box-shadow: var(--px) calc(-1 * var(--px)) 0 #f4f8fe; }
        @keyframes fiGischt {
          0% { transform: translate(0, 0); opacity: 0; } 15% { opacity: .85; }
          100% { transform: translate(calc(-4 * var(--px)), calc(-14 * var(--px))); opacity: 0; }
        }
        .fi-falter-bahn { position: absolute; }
        @keyframes fiFalterBahn {
          0% { transform: translate(0, 0); } 20% { transform: translate(calc(6 * var(--px)), calc(-4 * var(--px))); }
          40% { transform: translate(calc(12 * var(--px)), calc(1 * var(--px))); } 60% { transform: translate(calc(7 * var(--px)), calc(5 * var(--px))); }
          80% { transform: translate(calc(-2 * var(--px)), calc(2 * var(--px))); } 100% { transform: translate(0, 0); }
        }
        .fi-falter { display: block; width: calc(5 * var(--px)); height: calc(4 * var(--px)); background: url(${FI}butterfly.png) 0 0 / 200% 100% no-repeat; animation: ppSprite2 .24s steps(1) infinite; }
        /* Schwalbe im Profil, Bild schaut nach rechts (= ppQuerLtr); Rückflüge
           (ppQuerRtl) werden gespiegelt. Flügelschlag 4 Bilder, kaum Auf und Ab. */
        .fi-vogel {
          display: block; width: calc(11 * var(--px)); height: calc(7 * var(--px));
          background: url(${FI}bird.png) 0 0 / 400% 100% no-repeat;
          animation: fiFluegel .5s steps(4) infinite, ppBob 2.3s steps(2) infinite alternate; --bob: var(--px);
        }
        @keyframes fiFluegel { from { background-position: 0 0; } to { background-position: calc(-44 * var(--px)) 0; } }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  TEMPLE OF SACRIFICE — Maya-Stufenpyramide im Dschungel (v1440, Al 25.9.)
//
//  Al 25.9.: „Temple ist im Maya-Stil." Nach dem Kartenmotiv: eine
//  Stufenpyramide aus gelb-olivgoldenen Steinquadern mit dunklen Fugen
//  und Lichtkanten, mittig die breite Treppe hinauf zum Tempelhaus mit
//  dunklem Kraggewoelbe-Eingang, ueberkragendem Dachsims, Fries mit
//  Masken und Stufenmaeander, Dachkamm mit Durchbruechen. Ringsum
//  dichter Dschungel.
//
//  Ebenen (Kunsthoehe 100; per Generator gemalt, der nicht im Projekt
//  liegt): tile.png — Kachel 128 (Blattwerk in mehreren Tiefen, Staemme
//  mit Kletterpflanzen, rote Ranken wie auf der Karte, Blueten, Unterholz
//  mit Helikonien und Farnen, ueberwucherte Ruinensteine und eine Stele);
//  sway.png — Lianen, vordere Blaetter und Farne (3 Bilder, wiegen hin
//  und her); temple.png — Pyramide 200 breit, mittig: fuenf Stufen mit
//  Laufflaechen und Simsen, Moos und Ranken in den Fugen, Treppe mit
//  Wangen und Schlangenkoepfen, Rahmenbaeume mit Ast fuer den Ara,
//  Bueschen am Fuss. OPFER dezent: Altar vor der Tuer, eine dunkelrote
//  Rinne die Treppe hinab in eine Opferschale, vier Feuerschalen.
//
//  Animiert: Flammen in den Schalen (flames-l/-m, 4 Bilder) mit
//  flackerndem Feuerschein (temple-glow.png), Rauch steigt von Schalen
//  und Altar, in der Rinne sickert die dunkle Fluessigkeit langsam nach
//  unten (mask-rinne.png + flow.png), Lianen und Farne wiegen, der Ara
//  auf dem Ast nickt und lupft die Fluegel, ab und zu fliegt ein Ara
//  vorbei, Gluehwuermchen glimmen im Unterholz.
//  Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const TS = '/areas/temple-of-sacrifice/';
const TS_W = 200;
// Feuerschalen: Mitte x (neben der Brettmitte), Flammen-Oberkante y, Groesse
const TS_FEUER = [
  { x: -30, y: 23, g: 'l' }, { x: 30, y: 23, g: 'l' },
  { x: -50, y: 52, g: 'm' }, { x: 50, y: 52, g: 'm' },
];
const TS_FLAMME = { l: { w: 7, h: 10 }, m: { w: 5, h: 7 } };
const TempleOfSacrificeOverlay = React.memo(function TempleOfSacrificeOverlay() {
  const flammen = useMemo(() => TS_FEUER.map(f => ({
    ...f, ...TS_FLAMME[f.g], dur: .45 + Math.random() * .25, delay: -Math.random(),
  })), []);
  // Rauch: von den Schalen und aus dem Altar
  const rauch = useMemo(() => {
    const quellen = [...TS_FEUER.map(f => ({ x: f.x, y: f.y })), { x: 0, y: 30 }];
    return ppZufall(ppFxN(7), (i) => {
      const q = quellen[i % quellen.length];
      return { x: q.x, y: q.y, dur: 4 + Math.random() * 3, delay: -Math.random() * 7 };
    });
  }, []);
  const funken = useMemo(() => ppZufall(ppFxN(8), (i) => {
    const f = TS_FEUER[i % TS_FEUER.length];
    return { x: f.x + Math.round((Math.random() - .5) * 4), y: f.y + 2, dur: 1.6 + Math.random() * 1.4, delay: -Math.random() * 3 };
  }), []);
  const gluehen = useMemo(() => ppZufall(ppFxN(14), () => {
    const seite = Math.random() < .5 ? -1 : 1;
    return {
      x: seite * (40 + Math.random() * 150), y: 50 + Math.random() * 46,
      dur: 5 + Math.random() * 5, delay: -Math.random() * 10,
      dx: Math.round((Math.random() - .5) * 10), dy: -Math.round(2 + Math.random() * 6),
    };
  }), []);
  const flieger = useMemo(() => ppZufall(Math.min(1, ppFxN(1)), () => ({
    y: 6 + Math.random() * 14, dur: 34 + Math.random() * 12, delay: -Math.random() * 30, rtl: Math.random() < .5,
  })), []);
  return (
    <PixelScene artH={100} bg="#10251b" className="temple-of-sacrifice-overlay">
      <PixelBand src={TS + 'tile.png'} />
      <PixelBand src={TS + 'sway.png'} className="ts-wiegen" style={{ backgroundSize: 'auto 300%' }} />
      <PixelPiece src={TS + 'temple.png'} w={TS_W} />
      <div className="pp-pixel-layer ts-rinne" style={{
        left: `calc(50% - ${TS_W / 2} * var(--px))`, right: 'auto', width: ppArt(TS_W),
        ...ppMaske(TS + 'mask-rinne.png', false),
      }} />
      <PixelPiece src={TS + 'temple-glow.png'} w={TS_W} className="ts-schein" />
      {flammen.map((f, i) => (
        <i key={'f' + i} className="ts-flamme" style={{
          left: ppArtX(f.x - Math.floor(f.w / 2), 0), top: ppArt(f.y), width: ppArt(f.w), height: ppArt(f.h),
          backgroundImage: `url(${TS}flames-${f.g}.png)`, '--ts-lauf': `calc(${-4 * f.w} * var(--px))`,
          animation: `tsFlackern ${f.dur.toFixed(2)}s steps(4) ${f.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {rauch.map((r, i) => (
        <i key={'r' + i} className="pp-area-dyn ts-rauch" style={{
          left: ppArtX(r.x - 3, 0), top: ppArt(r.y - 5),
          animation: `tsRauch ${r.dur.toFixed(2)}s steps(28) ${r.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {funken.map((f, i) => (
        <i key={'s' + i} className="pp-area-dyn ts-funke" style={{
          left: ppArtX(f.x, 0), top: ppArt(f.y),
          animation: `tsFunke ${f.dur.toFixed(2)}s steps(14) ${f.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      <i className="ts-ara" style={{ left: ppArtX(60, 0), top: ppArt(35) }} />
      {gluehen.map((g, i) => (
        <i key={'g' + i} className="pp-area-dyn ts-gluehwurm" style={{
          left: ppArtX(g.x, 0), top: ppArt(g.y), '--dx': ppArt(g.dx), '--dy': ppArt(g.dy),
          animation: `tsGluehen ${g.dur.toFixed(2)}s steps(10) ${g.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {flieger.map((f, i) => (
        <div key={'a' + i} className="pp-area-dyn pp-quer" style={{
          top: ppArt(f.y), animation: `${f.rtl ? 'tsFlugRtl' : 'tsFlugLtr'} ${f.dur.toFixed(1)}s linear ${f.delay.toFixed(1)}s infinite`,
        }}>
          <i className="ts-ara-flug" style={{ transform: f.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .ts-wiegen { animation: tsPendel 3.2s steps(1) infinite; }
        @keyframes tsPendel {
          0% { background-position: 50% 0%; } 25% { background-position: 50% 50%; }
          50% { background-position: 50% 0%; } 75% { background-position: 50% 100%; }
        }
        .ts-rinne {
          position: absolute; top: 0; bottom: 0;
          background: url(${TS}flow.png) 0 0 / calc(4 * var(--px)) calc(16 * var(--px)) repeat;
          animation: tsSickern 6s steps(16) infinite;
        }
        @keyframes tsSickern { from { background-position: 0 0; } to { background-position: 0 calc(16 * var(--px)); } }
        .ts-schein { animation: tsSchein 1.3s steps(1) infinite; }
        @keyframes tsSchein { 0% { opacity: .85; } 18% { opacity: 1; } 34% { opacity: .7; } 52% { opacity: .95; } 70% { opacity: .78; } 86% { opacity: 1; } }
        .ts-flamme { position: absolute; background-repeat: no-repeat; background-size: 400% 100%; }
        @keyframes tsFlackern { from { background-position: 0 0; } to { background-position: var(--ts-lauf) 0; } }
        .ts-rauch { position: absolute; width: calc(6 * var(--px)); height: calc(5 * var(--px)); background: url(${TS}smoke.png) 0 0 / 100% 100% no-repeat; opacity: 0; }
        @keyframes tsRauch {
          0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: .8; }
          60% { opacity: .5; }
          100% { transform: translate(calc(-6 * var(--px)), calc(-28 * var(--px))); opacity: 0; }
        }
        .ts-funke { position: absolute; width: var(--px); height: var(--px); background: #ffb040; opacity: 0; }
        @keyframes tsFunke { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: 1; } 100% { transform: translate(calc(-2 * var(--px)), calc(-14 * var(--px))); opacity: 0; } }
        .ts-ara {
          position: absolute; width: calc(9 * var(--px)); height: calc(14 * var(--px));
          background: url(${TS}macaw.png) 0 0 / 300% 100% no-repeat;
          animation: tsAra 6.4s steps(1) infinite;
        }
        @keyframes tsAra {
          0%, 40% { background-position: 0 0; } 43%, 47% { background-position: 50% 0; } 50%, 53% { background-position: 0 0; }
          56%, 60% { background-position: 50% 0; } 63%, 76% { background-position: 0 0; }
          79%, 82% { background-position: 100% 0; } 84%, 86% { background-position: 0 0; } 88%, 91% { background-position: 100% 0; }
          93%, 100% { background-position: 0 0; }
        }
        .ts-ara-flug {
          display: block; width: calc(13 * var(--px)); height: calc(8 * var(--px));
          background: url(${TS}macaw-fly.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .42s steps(1) infinite, ppBob 1.1s ease-in-out infinite alternate; --bob: calc(3 * var(--px));
        }
        @keyframes tsFlugLtr {
          0% { transform: translateX(calc(-20 * var(--px))); } 45% { transform: translateX(calc(100cqw + 10 * var(--px))); }
          100% { transform: translateX(calc(100cqw + 10 * var(--px))); }
        }
        @keyframes tsFlugRtl {
          0% { transform: translateX(calc(100cqw + 10 * var(--px))); } 45% { transform: translateX(calc(-20 * var(--px))); }
          100% { transform: translateX(calc(-20 * var(--px))); }
        }
        .ts-gluehwurm {
          position: absolute; width: var(--px); height: var(--px); background: #f4ff9a; opacity: 0;
          box-shadow: 0 0 calc(2 * var(--px)) calc(.6 * var(--px)) rgba(210, 255, 90, .45);
        }
        @keyframes tsGluehen {
          0% { transform: translate(0, 0); opacity: 0; } 20% { opacity: .9; } 40% { opacity: .25; }
          60% { opacity: .95; } 80% { opacity: .3; }
          100% { transform: translate(var(--dx), var(--dy)); opacity: 0; }
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  THE BONEGRINDER — Kerker mit Knochenmühle (v1440, Al 25.9.)
//
//  Karte: ein Zauber rund um „Skeleton"-Kreaturen — im Kerker steht ein
//  eisernes Gerüst mit Kettenrahmen, darin zermahlen gezahnte Walzen
//  Knochen; links der Skeleton Healer, rechts der Loyal Bone Dog. Oben
//  verrauschter Bruchstein, darunter Mauerwerk aus dunkelbraun-grauen
//  und sandfarbenen Ziegeln.
//  Korrektur (Al 25.9.): der Linke trägt keinen Helmbusch, sondern einen
//  Helm mit ROTEM KREUZ — der Healer (grüne Handschuhe und Stiefel,
//  Sanitätstasche); rechts steht kein Skelett, sondern ein Knochenhund.
//
//  Ebenen (Kunsthöhe 100): tile.png (Kachel 128: Bruchstein-Gewölbe mit
//  Moos und Rinnspuren, Ziegelwand mit Abplatzern, Wandfackel im Halter
//  mit Rußfleck, Nische mit Schädeln, Riss mit Moos, Spinnweben, Platten-
//  boden mit Rissen, Knochen, Schädeln, Rippenkorb, Knochenhaufen, Pfütze,
//  Abflussgitter), tile-glow.png (Fackelschein), chains.png (Ketten mit
//  Fesseln, 3 Bilder), mill.png (Versatzstück 100: Deckenschacht, Ketten,
//  Eisengerüst, Trichter voller Knochen, Mahlgehäuse mit Fenster, Rutsche,
//  Wanne mit Knochenmehl, Knochenhaufen, Mehlsäcke, Schaufel),
//  mill-rollers.png / mill-wheels.png (je 3 Bilder: Mahlwalzen, Schwung-
//  rad, Zahnrad), healer.png (3 Bilder), dog.png (4 Bilder), bone.png,
//  flame.png, meal.png, rat.png.
//
//  Animiert: die Walzen drehen gegenläufig und ziehen einen Knochen ein,
//  Schwungrad und Zahnrad laufen mit, Knochen fallen aus dem Deckenschacht
//  in den Trichter, Knochenmehl rieselt aus der Rutsche und staubt auf dem
//  Haufen, die Ketten pendeln, Fackeln flackern mit warmem Schein, der
//  Healer klappert mit dem Kiefer, wippt und winkt mit dem grünen
//  Handschuh; der Hund wedelt, schnüffelt am Boden und bellt (Kiefer),
//  Staub schwebt, ab und zu huscht eine Ratte über den Boden.
//  Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const BGR = '/areas/bonegrinder/';
const BGR_MUEHLE_W = 100;
const BGR_KACHEL = 128;
const BGR_FACKEL_Y = 36;          // Oberkante Pechkopf; Fackeln bei u = 0 der Kachel
const BGR_HEILER_X = -60;         // Skeleton Healer links (Füße bei y 91)
const BGR_HUND_X = 63;            // Loyal Bone Dog rechts

const BonegrinderOverlay = React.memo(function BonegrinderOverlay() {
  // Fackeln: Kachel-u 0 liegt bei x = -64 + k·128 neben der Brettmitte
  const fackeln = useMemo(() => ppZufall(6, (i) => ({
    x: -BGR_KACHEL / 2 + (i - 2) * BGR_KACHEL,
    dur: .5 + Math.random() * .25, delay: -Math.random(), glut: 1.3 + Math.random() * .8,
  })), []);
  const knochen = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    x: -6 + Math.random() * 12, dur: 3.2 + Math.random() * 1.6, delay: -i * 1.4 - Math.random(),
    dreh: .3 + Math.random() * .2,
  })), []);
  const staubwolken = useMemo(() => ppZufall(ppFxN(6), () => ({
    x: -9 + Math.random() * 18, dur: 1.6 + Math.random() * 1.4, delay: -Math.random() * 3,
    dx: (Math.random() - .5) * 8,
  })), []);
  const staub = useMemo(() => ppZufall(ppFxN(14), () => ({
    x: Math.random() * 100, y: 10 + Math.random() * 80, dur: 10 + Math.random() * 10, delay: -Math.random() * 20,
  })), []);
  const ratte = useMemo(() => ({ dur: 9 + Math.random() * 4, delay: -Math.random() * 30, rtl: Math.random() < .5 }), []);
  return (
    <PixelScene artH={100} bg="#2a2422" className="bonegrinder-overlay">
      <PixelBand src={BGR + 'tile.png'} />
      <PixelBand src={BGR + 'tile-glow.png'} className="bg-schein" />
      <PixelBand src={BGR + 'chains.png'} className="bg-ketten" style={{ backgroundSize: 'auto 300%' }} />
      {fackeln.map((f, i) => (
        <React.Fragment key={'f' + i}>
          <i className="bg-glut" style={{
            left: ppArtX(f.x - 9, 0), top: ppArt(BGR_FACKEL_Y - 14), animation: `bgGlut ${f.glut.toFixed(2)}s steps(1) ${f.delay.toFixed(2)}s infinite`,
          }} />
          <i className="bg-flamme" style={{
            left: ppArtX(f.x - 2, 0), top: ppArt(BGR_FACKEL_Y - 7),
            animation: `bgFlackern ${f.dur.toFixed(2)}s steps(1) ${f.delay.toFixed(2)}s infinite`,
          }} />
        </React.Fragment>
      ))}
      <PixelPiece src={BGR + 'mill.png'} w={BGR_MUEHLE_W} />
      <PixelPiece src={BGR + 'mill-rollers.png'} w={BGR_MUEHLE_W} style={{ backgroundSize: '100% 300%', animation: 'ppBand3 .54s steps(1) infinite' }} />
      <PixelPiece src={BGR + 'mill-wheels.png'} w={BGR_MUEHLE_W} style={{ backgroundSize: '100% 300%', animation: 'ppBand3 .72s steps(1) infinite' }} />
      {knochen.map((k, i) => (
        <i key={'k' + i} className="pp-area-dyn bg-knochen" style={{
          left: ppArtX(k.x - 3, 0), top: ppArt(-5),
          animation: `bgFallen ${k.dur.toFixed(2)}s steps(1) ${k.delay.toFixed(2)}s infinite, ppSprite3 ${k.dreh.toFixed(2)}s steps(1) infinite`,
        }} />
      ))}
      <i className="bg-mehl" style={{ left: ppArtX(-1.5, 0), top: ppArt(65) }} />
      {staubwolken.map((s, i) => (
        <i key={'w' + i} className="pp-area-dyn bg-wolke" style={{
          left: ppArtX(s.x, 0), top: ppArt(71), '--dx': ppArt(s.dx),
          animation: `bgStauben ${s.dur.toFixed(2)}s steps(6) ${s.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      <i className="bg-heiler" style={{ left: ppArtX(BGR_HEILER_X - 10.5, 0), top: ppArt(60) }} />
      <i className="bg-hund" style={{ left: ppArtX(BGR_HUND_X - 12.5, 0), top: ppArt(75) }} />
      <div className="pp-area-dyn pp-quer" style={ppQuer(92, ratte.dur, ratte.delay, ratte.rtl)}>
        <i className="bg-ratte" style={{ transform: ratte.rtl ? undefined : 'scaleX(-1)' }} />
      </div>
      {staub.map((s, i) => (
        <i key={'d' + i} className="pp-area-dyn bg-staub" style={{
          left: s.x + '%', top: ppArt(s.y), animation: `bgSchweben ${s.dur.toFixed(1)}s steps(24) ${s.delay.toFixed(1)}s infinite`,
        }} />
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .bg-schein { animation: bgSchein 2.3s steps(1) infinite; }
        @keyframes bgSchein { 0% { opacity: .85; } 18% { opacity: 1; } 31% { opacity: .75; } 52% { opacity: .95; } 70% { opacity: .8; } 86% { opacity: 1; } }
        .bg-ketten { animation: bgPendel 3.6s steps(1) infinite; }
        @keyframes bgPendel { 0% { background-position: 50% 0%; } 25% { background-position: 50% 50%; } 50% { background-position: 50% 0%; } 75% { background-position: 50% 100%; } }
        .bg-glut {
          position: absolute; width: calc(18 * var(--px)); height: calc(18 * var(--px));
          background: radial-gradient(circle, rgba(255,170,70,.30) 0%, rgba(255,120,40,.12) 45%, rgba(255,120,40,0) 70%);
        }
        @keyframes bgGlut { 0% { opacity: .8; } 22% { opacity: 1; } 40% { opacity: .65; } 63% { opacity: .95; } 81% { opacity: .75; } }
        .bg-flamme {
          position: absolute; width: calc(5 * var(--px)); height: calc(8 * var(--px));
          background: url(${BGR}flame.png) 0 0 / 400% 100% no-repeat;
        }
        @keyframes bgFlackern { 0% { background-position: 0 0; } 25% { background-position: 33.333% 0; } 50% { background-position: 66.667% 0; } 75% { background-position: 100% 0; } }
        .bg-knochen {
          position: absolute; width: calc(7 * var(--px)); height: calc(7 * var(--px));
          background: url(${BGR}bone.png) 0 0 / 300% 100% no-repeat; opacity: 0;
        }
        @keyframes bgFallen {
          0%, 40% { transform: translateY(0); opacity: 0; }
          41% { transform: translateY(0); opacity: 1; }
          44% { transform: translateY(calc(2 * var(--px))); }
          47% { transform: translateY(calc(5 * var(--px))); }
          50% { transform: translateY(calc(9 * var(--px))); }
          53% { transform: translateY(calc(14 * var(--px))); opacity: 1; }
          55%, 100% { transform: translateY(calc(15 * var(--px))); opacity: 0; }
        }
        .bg-mehl {
          position: absolute; width: calc(3 * var(--px)); height: calc(7 * var(--px));
          background: url(${BGR}meal.png) 0 0 / 100% calc(8 * var(--px)) repeat-y;
          animation: bgRieseln .5s steps(8) infinite;
        }
        @keyframes bgRieseln { from { background-position: 0 0; } to { background-position: 0 calc(8 * var(--px)); } }
        .bg-wolke { position: absolute; width: var(--px); height: var(--px); background: #d9d3c5; opacity: 0; }
        @keyframes bgStauben {
          0% { transform: translate(0, 0); opacity: 0; } 15% { opacity: .8; }
          100% { transform: translate(var(--dx), calc(-7 * var(--px))); opacity: 0; }
        }
        .bg-heiler {
          position: absolute; width: calc(21 * var(--px)); height: calc(32 * var(--px));
          background: url(${BGR}healer.png) 0 0 / 300% 100% no-repeat;
          animation: bgKlappern 7.4s steps(1) -1.2s infinite;
        }
        @keyframes bgKlappern {
          0%, 38% { background-position: 0 0; }
          40% { background-position: 50% 0; } 42% { background-position: 0 0; }
          44% { background-position: 50% 0; } 46% { background-position: 0 0; }
          48% { background-position: 50% 0; } 50% { background-position: 0 0; }
          74% { background-position: 100% 0; } 90% { background-position: 0 0; }
        }
        /* Knochenhund: 4 Bilder — Ruhe, Schwanz, Schnüffeln, Bellen */
        .bg-hund {
          position: absolute; width: calc(25 * var(--px)); height: calc(17 * var(--px));
          background: url(${BGR}dog.png) 0 0 / 400% 100% no-repeat;
          animation: bgHund 6.8s steps(1) -2.5s infinite;
        }
        @keyframes bgHund {
          0% { background-position: 0 0; } 4% { background-position: 33.333% 0; } 8% { background-position: 0 0; }
          12% { background-position: 33.333% 0; } 16% { background-position: 0 0; } 20% { background-position: 33.333% 0; }
          24% { background-position: 0 0; }
          36% { background-position: 66.667% 0; } 54% { background-position: 0 0; }
          62% { background-position: 100% 0; } 64% { background-position: 0 0; }
          66% { background-position: 100% 0; } 68% { background-position: 0 0; }
          70% { background-position: 100% 0; } 72% { background-position: 0 0; }
          80% { background-position: 33.333% 0; } 84% { background-position: 0 0; }
          88% { background-position: 33.333% 0; } 92% { background-position: 0 0; }
        }
        .bg-ratte {
          display: block; width: calc(9 * var(--px)); height: calc(4 * var(--px));
          background: url(${BGR}rat.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .18s steps(1) infinite;
        }
        .bg-staub { position: absolute; width: var(--px); height: var(--px); background: #cfc3a8; opacity: 0; }
        @keyframes bgSchweben {
          0% { transform: translate(0, 0); opacity: 0; } 20% { opacity: .45; } 80% { opacity: .45; }
          100% { transform: translate(calc(6 * var(--px)), calc(-10 * var(--px))); opacity: 0; }
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  THE COSMIC DEPTHS — der tiefe Weltraum (v1440, Al 25.9.)
//
//  Nach dem Kartenmotiv: tiefes Nachtblau voller Sterne, oben ein blass
//  grün-grauer Mond, rechts „die Erde" — in Pixel Parties ausdrücklich
//  ein WÜRFEL (Al; wie auf The Cosmic Depths und Arrival from the Cosmic
//  Depths), links ARGOS, das rote Auge des Kosmos, in seinem schwarzen,
//  schattenhaften Körper (Al: kein lila Nebel). Kein Ringplanet (Al).
//
//  Ebenen (Kunsthöhe 100; per Generator gemalt, der nicht im Projekt
//  liegt): tile.png — Kachel 128 (Nachtblau als Pixelrauschen, violette
//  und blaue Nebel, dunkle Staubbahnen, Sterne in Größen und Farben,
//  ferne Galaxien, Sternhaufen); twinkle.png — 3 Bilder der hellen
//  Sterne (funkeln); nebula.png — durchsichtige Schleier, die langsam
//  wandern und atmen; center.png — Versatzstück 200, mittig: Mond mit
//  Kratern und Maria, der Erd-Würfel (orthografisch gedreht, drei
//  Flächen: oben am hellsten, rechts im Licht, links im Schatten; Ozeane,
//  Kontinente, Wüsten, Eis, Küstensäume, Atmosphärensaum an den Kanten,
//  Halo). cube-clouds.png — 32 Bilder NUR mit den Wolken des Würfels, je
//  Fläche schattiert; darin ziehen die Wolken um die Hochachse.
//  argos-body.png (3 Bilder, wabert: tiefschwarz, Rand sehr dunkles Blau/
//  Rot, Rauchsaum, Tentakelfetzen), rift.png (Argos' Auge, 3 Bilder: der
//  Spalt öffnet sich) + rift-glow.png (pulsiert). Sprites: saucer.png
//  (Invader-Untertasse, Lichter blinken), analyzer-r/l.png (Analyzer-
//  Drohnen im Dreierschwarm, je Richtung eigens beleuchtet), asteroid-
//  s/l.png (4 Drehbilder, Licht bleibt oben rechts), comet.png,
//  shoot.png (Sternschnuppe).
//
//  Animiert: Sterne funkeln (Kachelbilder + Funkelkreuze), Wolken ziehen
//  über den Erd-Würfel, Argos' Schatten wabert, sein Auge atmet und
//  glüht, rote Funken werden hineingesogen, Nebel wabert, Sternschnuppen,
//  ab und zu ein Komet, treibende Asteroiden und eine ferne Untertasse
//  (beide ziehen HINTER Mond und Würfel vorbei), ein Analyzer-Schwarm.
//  Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const CD = '/areas/cosmic-depths/';
const CD_W = 200;
const CD_WUERFEL_WOLKEN = { x: 126, y: 24, w: 48, h: 52, n: 32 };   // Wolkenbilder über dem Erd-Würfel (im Versatzstück)
const CD_AUGE = { x: 40, y: 58, w: 23, h: 45 };                      // Mitte von Argos' Auge
const CD_KOERPER = { w: 76, h: 98 };                                 // Schattenkörper, um das Auge zentriert

const CosmicDepthsOverlay = React.memo(function CosmicDepthsOverlay() {
  const funkeln = useMemo(() => ppZufall(ppFxN(10), () => ({
    x: Math.random() * 100, y: 2 + Math.random() * 94, dur: 2.6 + Math.random() * 3, delay: -Math.random() * 6,
  })), []);
  const schnuppen = useMemo(() => ppZufall(ppFxN(3), () => ({
    x: 15 + Math.random() * 85, y: 2 + Math.random() * 45, dur: 8 + Math.random() * 10, delay: -Math.random() * 18,
  })), []);
  const brocken = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    gross: i === 0, y: 12 + i * 29 + Math.random() * 12, dur: 80 + Math.random() * 50,
    delay: -Math.random() * 120, rtl: i % 2 === 1, dreh: 2.4 + Math.random() * 2.4, bob: 1 + Math.random() * 2,
  })), []);
  const schwaerme = useMemo(() => ppZufall(Math.min(1, ppFxN(1)), () => ({
    y: 80 + Math.random() * 8, dur: 44 + Math.random() * 14, delay: -Math.random() * 50, rtl: Math.random() < .5,
  })), []);
  const funken = useMemo(() => ppZufall(ppFxN(8), () => {
    const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 14;
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 1.3, dur: 2.2 + Math.random() * 2.2, delay: -Math.random() * 4.4 };
  }), []);
  return (
    <PixelScene artH={100} bg="#01021f" className="cosmic-depths-overlay">
      <PixelBand src={CD + 'tile.png'} />
      <PixelBand src={CD + 'twinkle.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 3.6s steps(1) infinite' }} />
      <div className="pp-pixel-layer cd-nebel" />
      {funkeln.map((f, i) => (
        <i key={'f' + i} className="pp-area-dyn pp-px-funkeln" style={{ left: f.x + '%', top: ppArt(f.y), animation: `ppFunkeln ${f.dur.toFixed(2)}s steps(1) ${f.delay.toFixed(2)}s infinite` }} />
      ))}
      {schnuppen.map((s, i) => (
        <i key={'s' + i} className="pp-area-dyn cd-schnuppe" style={{ left: s.x + '%', top: ppArt(s.y), animation: `cdSchnuppe ${s.dur.toFixed(2)}s linear ${s.delay.toFixed(2)}s infinite` }} />
      ))}
      <div className="pp-area-dyn pp-quer" style={ppQuer(37, 90, -38, true)}>
        <i className="cd-ufo" />
      </div>
      {brocken.map((b, i) => (
        <div key={'b' + i} className="pp-area-dyn pp-quer" style={ppQuer(b.y, b.dur.toFixed(1), b.delay.toFixed(1), b.rtl)}>
          <i className={'cd-brocken' + (b.gross ? ' gross' : '')} style={{
            '--bob': ppArt(b.bob.toFixed(1)),
            animation: `cdDreh4 ${b.dreh.toFixed(2)}s steps(1) infinite, ppBob ${(b.dreh * 1.3).toFixed(2)}s ease-in-out infinite alternate`,
          }} />
        </div>
      ))}
      <PixelPiece src={CD + 'center.png'} w={CD_W} />
      <i className="cd-wuerfel-wolken" style={{
        left: ppArtX(CD_WUERFEL_WOLKEN.x, CD_W), top: ppArt(CD_WUERFEL_WOLKEN.y),
        width: ppArt(CD_WUERFEL_WOLKEN.w), height: ppArt(CD_WUERFEL_WOLKEN.h),
      }} />
      <i className="cd-koerper" style={{ left: ppArtX(CD_AUGE.x - CD_KOERPER.w / 2, CD_W), top: ppArt(CD_AUGE.y - CD_KOERPER.h / 2) }} />
      <i className="cd-riss-schein" style={{ left: ppArtX(CD_AUGE.x - 22, CD_W), top: ppArt(CD_AUGE.y - 32) }} />
      <i className="cd-riss" style={{ left: ppArtX(CD_AUGE.x - Math.floor(CD_AUGE.w / 2), CD_W), top: ppArt(CD_AUGE.y - Math.floor(CD_AUGE.h / 2)) }} />
      {funken.map((f, i) => (
        <i key={'k' + i} className="pp-area-dyn cd-funke" style={{
          left: ppArtX(CD_AUGE.x, CD_W), top: ppArt(CD_AUGE.y), '--dx': ppArt(f.dx.toFixed(1)), '--dy': ppArt(f.dy.toFixed(1)),
          animation: `cdSog ${f.dur.toFixed(2)}s ease-in ${f.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      <div className="pp-area-dyn pp-quer" style={{ top: ppArt(9), animation: 'cdKometZug 95s linear -30s infinite' }}>
        <i className="cd-komet" />
      </div>
      {schwaerme.map((s, i) => (
        <div key={'d' + i} className="pp-area-dyn pp-quer" style={ppQuer(s.y, s.dur.toFixed(1), s.delay.toFixed(1), s.rtl)}>
          {[[0, 0], [-8, -5], [-8, 5]].map(([dx, dy], j) => (
            <i key={j} className="cd-drohne" style={{
              left: ppArt(s.rtl ? -dx : dx), top: ppArt(dy), backgroundImage: `url(${CD}analyzer-${s.rtl ? 'l' : 'r'}.png)`,
              animationDelay: `${-j * .13}s, ${-j * .7}s`,
            }} />
          ))}
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .cd-nebel {
          position: absolute; inset: 0;
          background: url(${CD}nebula.png) 0 0 / auto 100% repeat-x;
          animation: cdNebelZug 300s steps(128) infinite, cdNebelAtmen 11s ease-in-out infinite alternate;
        }
        @keyframes cdNebelZug { from { background-position: 0 0; } to { background-position: calc(128 * var(--px)) 0; } }
        @keyframes cdNebelAtmen { from { opacity: .45; } to { opacity: .9; } }
        /* Wolken des Erd-Würfels: fertig gezeichnete Bilder (je Fläche richtig
           schattiert), die Wolken ziehen darin um die Hochachse. */
        .cd-wuerfel-wolken {
          position: absolute;
          background: url(${CD}cube-clouds.png) 0 0 / ${CD_WUERFEL_WOLKEN.n * 100}% 100% no-repeat;
          animation: cdWuerfelWolken 40s steps(${CD_WUERFEL_WOLKEN.n}, jump-none) infinite;
        }
        @keyframes cdWuerfelWolken { from { background-position: 0% 0; } to { background-position: 100% 0; } }
        /* Argos' Schattenkörper wabert (3 Bilder, hin und zurück) */
        .cd-koerper {
          position: absolute; width: calc(${CD_KOERPER.w} * var(--px)); height: calc(${CD_KOERPER.h} * var(--px));
          background: url(${CD}argos-body.png) 0 0 / 300% 100% no-repeat;
          animation: cdRiss 6.4s steps(1) infinite;
        }
        .cd-riss-schein {
          position: absolute; width: calc(44 * var(--px)); height: calc(64 * var(--px));
          background: url(${CD}rift-glow.png) 0 0 / 100% 100% no-repeat;
          animation: cdSchein 2.8s ease-in-out infinite alternate;
        }
        @keyframes cdSchein { from { opacity: .45; } to { opacity: 1; } }
        .cd-riss {
          position: absolute; width: calc(${CD_AUGE.w} * var(--px)); height: calc(${CD_AUGE.h} * var(--px));
          background: url(${CD}rift.png) 0 0 / 300% 100% no-repeat;
          animation: cdRiss 2.8s steps(1) infinite;
        }
        @keyframes cdRiss { 0% { background-position: 0 0; } 25% { background-position: 50% 0; } 50% { background-position: 100% 0; } 75% { background-position: 50% 0; } }
        .cd-funke { position: absolute; width: var(--px); height: var(--px); background: #ff5a4a; opacity: 0; }
        @keyframes cdSog {
          0% { transform: translate(var(--dx), var(--dy)); opacity: 0; }
          20% { opacity: .9; }
          85% { opacity: .9; background: #ff2a6a; }
          100% { transform: translate(0, 0); opacity: 0; }
        }
        .cd-schnuppe {
          position: absolute; width: calc(12 * var(--px)); height: calc(6 * var(--px));
          background: url(${CD}shoot.png) 0 0 / 100% 100% no-repeat; opacity: 0;
        }
        @keyframes cdSchnuppe {
          0% { transform: translate(0, 0); opacity: 0; }
          1% { opacity: 1; }
          8% { opacity: 1; }
          10% { transform: translate(calc(-40 * var(--px)), calc(20 * var(--px))); opacity: 0; }
          100% { transform: translate(calc(-40 * var(--px)), calc(20 * var(--px))); opacity: 0; }
        }
        /* Der Komet zieht nur etwa jede anderthalb Minuten einmal vorbei */
        @keyframes cdKometZug {
          0% { transform: translate(calc(100cqw + 10 * var(--px)), 0); }
          45% { transform: translate(calc(-40 * var(--px)), calc(6 * var(--px))); }
          100% { transform: translate(calc(-40 * var(--px)), calc(6 * var(--px))); }
        }
        .cd-komet {
          display: block; width: calc(30 * var(--px)); height: calc(7 * var(--px));
          background: url(${CD}comet.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .35s steps(1) infinite;
        }
        .cd-ufo {
          display: block; width: calc(21 * var(--px)); height: calc(10 * var(--px));
          background: url(${CD}saucer.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .9s steps(1) infinite, ppBob 2.6s ease-in-out infinite alternate; --bob: calc(2 * var(--px));
        }
        .cd-brocken {
          display: block; width: calc(6 * var(--px)); height: calc(6 * var(--px));
          background: url(${CD}asteroid-s.png) 0 0 / 400% 100% no-repeat;
        }
        .cd-brocken.gross { width: calc(9 * var(--px)); height: calc(9 * var(--px)); background-image: url(${CD}asteroid-l.png); }
        @keyframes cdDreh4 { 0% { background-position: 0 0; } 25% { background-position: 33.333% 0; } 50% { background-position: 66.667% 0; } 75% { background-position: 100% 0; } }
        .cd-drohne {
          position: absolute; width: calc(10 * var(--px)); height: calc(6 * var(--px));
          background-size: 200% 100%; background-repeat: no-repeat;
          animation: ppSprite2 .4s steps(1) infinite, ppBob 1.9s ease-in-out infinite alternate; --bob: var(--px);
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  THE FIRST CIRCLE OF HELL — die Vorhoelle (v1440, Al 25.9.)
//
//  Karte: grauer, verrauschter Boden in mehreren nahen Grautoenen,
//  blasse, kahle, verlorene Seelen in grauen Lumpen stehen verwirrt
//  herum, eine mit „?" ueber dem Kopf.
//  Al 25.9.: „die ‚Vorhoelle': eine graue, triste, ENDLOSE Landschaft an
//  Kargheit, KEINEN felsigen Untergrund" — also keine Hoehle, kein Tor.
//  Szene: eine flache, endlose graue Ebene bis zum Horizont, darueber
//  ein trueber, konturloser Dunsthimmel, der am Horizont in den Boden
//  uebergeht. Tiefe durch Perspektive: nah grobe, kontrastreiche
//  Pixelklumpen, zur Ferne hin feiner, heller, dunstiger. Karg: nur
//  flache Rillen, flache Staubverwehungen, vereinzelte kleine Steine und
//  Fussspurketten, die ziellos im Kreis laufen. Licht IMMER oben rechts.
//
//  Ebenen (Kunsthoehe 100; per Generator gemalt, der nicht im Projekt
//  liegt): tile.png — Kachel 128 (Himmel + Ebene); haze.png — Dunst-
//  schwaden am Horizont (128×40); dust.png — Staub-/Ascheschleier ueber
//  dem Boden (128×24); soul.png — nahe Seelen (6 Bilder 9×14: stehen,
//  Schritt, Schritt, dasselbe nach links; 3 Varianten untereinander);
//  soul-mid.png — weiter entfernte Seelen (6 Bilder 6×10, 2 Varianten,
//  etwas dunstiger); soul-far.png — ferne blasse Silhouetten (2 Bilder
//  3×5); ask.png — das „?" (6×8).
//  Animiert: nahe und mittlere Seelen schlurfen ziellos hin und her
//  (ganze Kunstpixel), bleiben stehen, sehen sich um, ab und zu erscheint
//  ein „?"; zwei stehen nur herum und drehen den Kopf. Ferne Silhouetten
//  tauchen im Dunst auf, wanken und verschwinden wieder. Dunst wabert am
//  Horizont, Staubschleier ziehen ueber den Boden, Asche treibt langsam.
// ═══════════════════════════════════════════════════════════════════
const FC = '/areas/first-circle-of-hell/';
const FC_HORIZONT = 35;
// Steher: bleiben an ihrem Platz und sehen sich nur um (auch ohne Animation sichtbar)
const FC_STEHER = [{ x: -62, y: 74, v: 1, dur: 7 }, { x: 88, y: 86, v: 0, dur: 9, links: true }];
const FirstCircleOfHellOverlay = React.memo(function FirstCircleOfHellOverlay() {
  const seelen = useMemo(() => {
    const plaetze = FC_STEHER.map(s => [s.x, s.y]);
    return ppZufall(ppFxN(10), (i) => {
      // ein Drittel weiter hinten (klein), die Haelfte nahe der Mitte, der Rest weit verstreut
      const mitte = i % 3 === 2;
      let x, y, n = 0;
      do {
        x = (Math.random() - .5) * (i % 2 ? 340 : 170);
        y = mitte ? 46 + Math.random() * 14 : 64 + Math.random() * 32;
      } while (n++ < 40 && plaetze.some(([px, py]) => Math.abs(px - x) < (mitte ? 11 : 16) && Math.abs(py - y) < 11));
      plaetze.push([x, y]);
      const dur = 14 + Math.random() * 10;
      return {
        x: Math.round(x), y: Math.round(y), mitte, v: mitte ? i % 2 : i % 3, dur, delay: -Math.random() * dur,
        weg: (mitte ? 3 : 4) + Math.floor(Math.random() * (mitte ? 4 : 7)), links: Math.random() < .5,
        frage: Math.random() < .5, runde: Math.floor(Math.random() * 2),
      };
    });
  }, []);
  const ferne = useMemo(() => ppZufall(ppFxN(9), () => ({
    x: (Math.random() - .5) * 360, y: FC_HORIZONT + 1 + Math.random() * 6,
    dur: 18 + Math.random() * 18, delay: -Math.random() * 36, weg: 3 + Math.floor(Math.random() * 5),
    links: Math.random() < .5,
  })), []);
  const asche = useMemo(() => ppZufall(ppFxN(16), () => ({
    y: Math.random() * 90, dur: 30 + Math.random() * 30, delay: -Math.random() * 60,
    art: Math.random() < .3 ? ' dunkel' : Math.random() < .2 ? ' gross' : '',
  })), []);
  const seele = (s, key, dyn) => {
    const w = s.mitte ? 6 : 9, h = s.mitte ? 10 : 14;
    return (
      <div key={key} className={(dyn ? 'pp-area-dyn ' : '') + 'fc-seele'} style={{
        left: ppArtX(s.x - w / 2, 0), top: ppArt(s.y - h + 1), width: ppArt(w), height: ppArt(h), zIndex: s.y,
        '--weg': ppArt(s.links ? -s.weg : s.weg),
        animation: dyn ? `fcWandern ${s.dur}s steps(${s.weg}) ${s.delay}s infinite` : undefined,
      }}>
        <i className="fc-leib" style={{
          backgroundImage: `url(${FC}${s.mitte ? 'soul-mid' : 'soul'}.png)`,
          backgroundSize: s.mitte ? '600% 200%' : '600% 300%',
          backgroundPositionY: s.mitte ? `${s.v * 100}%` : `${s.v * 50}%`,
          transform: s.links ? 'scaleX(-1)' : undefined,
          animation: `${dyn ? 'fcSchritte' : 'fcUmsehen'} ${s.dur}s steps(1) ${s.delay || 0}s infinite`,
        }} />
        {s.frage && (
          <i className="pp-area-dyn fc-frage" style={{
            left: ppArt(w / 2 - 3), animation: `fcFrage ${2 * s.dur}s steps(1) ${(s.delay || 0) - s.runde * s.dur}s infinite`,
          }} />
        )}
      </div>
    );
  };
  return (
    <PixelScene artH={100} bg="#4f4e4b" className="first-circle-overlay">
      <PixelBand src={FC + 'tile.png'} />
      {ferne.map((f, i) => (
        <div key={'f' + i} className="pp-area-dyn fc-fern" style={{
          left: ppArtX(f.x - 1.5, 0), top: ppArt(f.y - 4), '--weg': ppArt(f.links ? -f.weg : f.weg),
          animation: `fcFern ${f.dur}s steps(${f.weg * 2}) ${f.delay}s infinite`,
        }}><i style={{ transform: f.links ? 'scaleX(-1)' : undefined }} /></div>
      ))}
      <div className="pp-pixel-layer fc-dunst" style={{ top: ppArt(FC_HORIZONT - 17) }} />
      <div className="pp-pixel-layer fc-dunst b" style={{ top: ppArt(FC_HORIZONT - 21) }} />
      <div className="pp-pixel-layer fc-staub hinten" style={{ top: ppArt(44) }} />
      <div className="fc-volk">
        {FC_STEHER.map((s, i) => seele({ ...s, frage: i === 0, runde: 0, delay: -i * 2.3 }, 'st' + i, false))}
        {seelen.map((s, i) => seele(s, 's' + i, true))}
      </div>
      {asche.map((a, i) => (
        <i key={'a' + i} className={'pp-area-dyn fc-asche' + a.art} style={{
          top: ppArt(a.y), animation: `fcAsche ${a.dur}s linear ${a.delay}s infinite`,
        }} />
      ))}
      <div className="pp-pixel-layer fc-staub vorn" style={{ top: ppArt(74) }} />
      <div className="pp-rand-dim" />
      <style>{`
        .fc-dunst {
          position: absolute; left: 0; right: 0; height: calc(40 * var(--px));
          background: url(${FC}haze.png) 0 0 / auto 100% repeat-x; opacity: .7;
          animation: fcZiehen 140s steps(128) infinite, fcWabern 9s ease-in-out infinite alternate;
        }
        .fc-dunst.b { opacity: .45; animation-duration: 200s, 13s; animation-direction: reverse, alternate; }
        @keyframes fcWabern { from { opacity: .35; } to { opacity: .75; } }
        .fc-staub {
          position: absolute; left: 0; right: 0; height: calc(24 * var(--px));
          background: url(${FC}dust.png) 0 0 / auto 100% repeat-x;
          animation: fcZiehen 90s steps(128) infinite;
        }
        .fc-staub.hinten { opacity: .45; height: calc(12 * var(--px)); animation-duration: 130s; animation-direction: reverse; }
        .fc-staub.vorn { opacity: .55; }
        @keyframes fcZiehen { from { background-position: 0 0; } to { background-position: calc(128 * var(--px)) 0; } }
        .fc-fern { position: absolute; width: calc(3 * var(--px)); height: calc(5 * var(--px)); opacity: 0; }
        .fc-fern i {
          position: absolute; inset: 0; background: url(${FC}soul-far.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 1.4s steps(1) infinite;
        }
        @keyframes fcFern {
          0% { opacity: 0; transform: translateX(0); } 20% { opacity: .9; }
          80% { opacity: .9; } 100% { opacity: 0; transform: translateX(var(--weg)); }
        }
        .fc-volk { position: absolute; inset: 0; }
        .fc-seele { position: absolute; }
        .fc-leib { position: absolute; inset: 0; background-repeat: no-repeat; background-position-x: 0; }
        /* Bilder: 0 stehen, 1/2 Schritt (rechts), 3 stehen, 4/5 Schritt (links) */
        @keyframes fcWandern {
          0% { transform: translateX(0); } 40%, 55% { transform: translateX(var(--weg)); } 95%, 100% { transform: translateX(0); }
        }
        @keyframes fcSchritte {
          0% { background-position-x: 20%; } 5% { background-position-x: 40%; } 10% { background-position-x: 20%; }
          15% { background-position-x: 40%; } 20% { background-position-x: 20%; } 25% { background-position-x: 40%; }
          30% { background-position-x: 20%; } 35% { background-position-x: 40%; }
          40% { background-position-x: 0%; } 46% { background-position-x: 60%; } 50% { background-position-x: 0%; }
          55% { background-position-x: 80%; } 60% { background-position-x: 100%; } 65% { background-position-x: 80%; }
          70% { background-position-x: 100%; } 75% { background-position-x: 80%; } 80% { background-position-x: 100%; }
          85% { background-position-x: 80%; } 90% { background-position-x: 100%; }
          95% { background-position-x: 60%; }
        }
        @keyframes fcUmsehen {
          0% { background-position-x: 0%; } 38% { background-position-x: 60%; } 52% { background-position-x: 0%; }
          80% { background-position-x: 60%; } 84% { background-position-x: 0%; }
        }
        .fc-frage {
          position: absolute; top: calc(-9 * var(--px));
          width: calc(6 * var(--px)); height: calc(8 * var(--px));
          background: url(${FC}ask.png) 0 0 / 100% 100% no-repeat; opacity: 0;
        }
        @keyframes fcFrage {
          0%, 20.4% { opacity: 0; transform: translateY(var(--px)); }
          20.5% { opacity: 1; transform: translateY(var(--px)); }
          21% { opacity: 1; transform: translateY(0); }
          26.9% { opacity: 1; transform: translateY(0); }
          27%, 100% { opacity: 0; transform: translateY(0); }
        }
        .fc-asche { position: absolute; left: 0; width: var(--px); height: var(--px); background: #9a978f; opacity: .6; }
        .fc-asche.dunkel { background: #4a4946; }
        .fc-asche.gross { width: calc(2 * var(--px)); background: #a8a59d; }
        @keyframes fcAsche {
          0% { transform: translate(calc(-10 * var(--px)), 0); }
          25% { transform: translate(calc(25cqw), calc(3 * var(--px))); }
          50% { transform: translate(calc(50cqw), calc(-1 * var(--px))); }
          75% { transform: translate(calc(75cqw), calc(4 * var(--px))); }
          100% { transform: translate(calc(100cqw + 10 * var(--px)), calc(8 * var(--px))); }
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  THE GREAT CLOCK TOWER „BIG GWEN" — Uhrturm über der Industriestadt
//  (v1440, Al 25.9.)
//
//  Nach dem Kartenmotiv (Pollution): ein hoher Big-Ben-Verschnitt aus
//  hellbraunem Stein mit weißem Zifferblatt im goldenen Rahmen und
//  dunklem Spitzhelm, ringsum die Stadt bei Nacht in Blau und Violett.
//  Hinten Fabriken mit Sägezahndach, Schlote mit roten Warnlichtern und
//  ein Gasometer, davor eine Häuserzeile (Ziegel und Putz, Gauben,
//  Schornsteine, Läden mit Markisen), ein blauer Park mit runden
//  violetten Bäumen, Laternen und Blumenrabatten vor den Bäumen — das
//  Bunte der Karte sind BLUMEN (Al 25.9.): rosa, gelbe, orange, weiße
//  und hellblaue Blüten auf dunklem Blaugrün —, vorn Kopfsteinpflaster. Mittig der Turm über
//  fast die ganze Höhe: Sockel mit Portal, Schaft mit Lisenen und
//  Lanzettfenstern, Maßwerk-Galerie, Uhrenstube mit Ecktürmchen,
//  Glockenstube, Spitzhelm mit Fialen, Krabben und Turmknauf.
//
//  Ebenen (Kunsthöhe 100; per Generator gemalt, der nicht im Projekt
//  liegt): sky.png (Kachel 128, Himmel mit Smogschlieren), moon.png,
//  city.png (Kachel 128, Stadt + Park, Himmel durchsichtig),
//  lights-a/b/c.png (erleuchtete Fenster), beacons.png, lamp-glow.png,
//  flowers.png (Rabatten, 3 Ebenen übereinander: gerade, rechts, links
//  geneigt), smog.png (Kachel), tower.png und
//  tower-glow.png (Versatzstück 64), hand-min.png / hand-hour.png (je
//  60 Bilder 23×23 — die Zeiger sind für jeden Winkel pixelgenau
//  gerastert, also KEINE Browser-Rotation), daw.png (2 Bilder 7×4),
//  smoke.png, smoke-big.png.
//
//  Animiert: die Zeiger laufen wirklich (wie die alte Szene: Minuten-
//  zeiger 60 s je Umlauf, springt jede Sekunde; Stundenzeiger 12 min je
//  Umlauf, beide ab der echten Uhrzeit), das Zifferblatt glimmt, Dohlen
//  kreisen um die Turmspitze (hinter dem Helm verschwinden sie) und
//  ziehen übers Brett, Rauch steigt aus Schloten und Schornsteinen,
//  Fenster gehen an und aus, Warnlichter blinken, Smog treibt, Laternen
//  flackern, die Blumen wiegen sich im Wind, Glühwürmchen tanzen über
//  den Beeten. Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const GW = '/areas/big-gwen/';
const GW_TURM_W = 64;
const GW_ZB = { x: 32, y: 41 };          // Zifferblatt-Mitte im Turmbild (Pixel)
const GW_ZEIGER = 23;                    // Zeigerbild 23×23, 60 Bilder nebeneinander
// Schlote (groß) und Schornsteine (klein): Oberkante in Kachel-Koordinaten (Kachel 128)
const GW_SCHLOTE = [
  { x: 22, y: 17, gross: true }, { x: 32.5, y: 24, gross: true }, { x: 103, y: 13, gross: true }, { x: 65.5, y: 28, gross: true },
  { x: 16.5, y: 34 }, { x: 25.5, y: 37 }, { x: 57.5, y: 31 }, { x: 66.5, y: 37 }, { x: 98.5, y: 33 }, { x: 107.5, y: 37 },
];
// Mond rechts oben neben dem Turm — in einer Lücke zwischen den Schloten
// der Kachel (die liegen bei −42, −31,5, +1,5 und +39 neben der Mitte).
const GW_MOND_X = 62;
const BigGwenOverlay = React.memo(function BigGwenOverlay() {
  // Echte Uhrzeit als Startpunkt der Zeiger
  const zeit = useMemo(() => {
    const d = new Date();
    const s = d.getSeconds() + d.getMilliseconds() / 1000;
    return { min: -s, std: -((d.getMinutes() % 12) * 60 + s) };
  }, []);
  const rauch = useMemo(() => {
    const out = [];
    for (let k = -2; k <= 2; k++) {
      for (const s of GW_SCHLOTE) {
        const x = s.x - 64 + k * 128;
        if (Math.abs(x) < 17 && s.y > 20) continue;              // hinter dem Turm
        out.push({ x, y: s.y, gross: !!s.gross });
      }
    }
    out.sort(() => Math.random() - .5);
    return out.slice(0, ppFxN(22)).map(r => ({
      ...r, dur: (r.gross ? 5 : 3.6) + Math.random() * 2.5, delay: -Math.random() * 7,
    }));
  }, []);
  const gluehen = useMemo(() => ppZufall(ppFxN(12), () => ({
    x: (Math.random() - .5) * 300, y: 70 + Math.random() * 9,
    dur: 5 + Math.random() * 4, delay: -Math.random() * 9, blink: 1.6 + Math.random() * 1.8,
  })), []);
  const dohlen = useMemo(() => ppZufall(ppFxN(4), () => ({
    rx: 12 + Math.random() * 16, ry: 2 + Math.random() * 4, cy: 7 + Math.random() * 12,
    dur: 3.5 + Math.random() * 3, delay: -Math.random() * 12, flap: .22 + Math.random() * .12,
  })), []);
  const zieher = useMemo(() => ppZufall(ppFxN(2), (i) => ({
    y: 4 + Math.random() * 22, dur: 26 + Math.random() * 14, delay: -Math.random() * 30, rtl: i % 2 === 1,
  })), []);
  const zeiger = (bild, anim) => (
    <i className="gw-zeiger" style={{
      left: ppArtX(GW_ZB.x - (GW_ZEIGER - 1) / 2, GW_TURM_W), top: ppArt(GW_ZB.y - (GW_ZEIGER - 1) / 2),
      backgroundImage: `url(${GW}${bild})`, animation: anim,
    }} />
  );
  return (
    <PixelScene artH={100} bg="#120f30" className="big-gwen-overlay">
      <PixelBand src={GW + 'sky.png'} />
      <i className="gw-mond" style={{ left: ppArtX(GW_MOND_X - 8.5, 0), top: ppArt(3) }} />
      <PixelBand src={GW + 'smog.png'} className="gw-smog" />
      <PixelBand src={GW + 'city.png'} />
      <PixelBand src={GW + 'lights-a.png'} className="gw-licht-a" />
      <PixelBand src={GW + 'lights-b.png'} className="gw-licht-b" />
      <PixelBand src={GW + 'lights-c.png'} className="gw-licht-c" />
      <PixelBand src={GW + 'beacons.png'} className="gw-warnlicht" />
      <PixelBand src={GW + 'flowers.png'} style={{ backgroundSize: 'auto 300%', animation: 'gwWiegen 3.2s steps(1) infinite' }} />
      <PixelBand src={GW + 'lamp-glow.png'} className="gw-laterne" />
      {gluehen.map((g, i) => (
        <i key={'g' + i} className="pp-area-dyn gw-gluehwurm" style={{
          left: ppArtX(g.x, 0), top: ppArt(g.y),
          animation: `gwSchwirren ${g.dur.toFixed(2)}s ease-in-out ${g.delay.toFixed(2)}s infinite, gwLeuchten ${g.blink.toFixed(2)}s steps(1) ${g.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {rauch.map((r, i) => (
        <i key={'r' + i} className={'pp-area-dyn gw-rauch' + (r.gross ? ' gross' : '')} style={{
          left: ppArtX(r.x - (r.gross ? 4.5 : 3), 0), top: ppArt(r.y - (r.gross ? 6 : 4)),
          animation: `${r.gross ? 'gwRauchGross' : 'gwRauch'} ${r.dur.toFixed(2)}s ease-out ${r.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {dohlen.map((d, i) => (
        <div key={'d' + i} className="pp-area-dyn gw-kreis-x" style={{
          left: ppArtX(-d.rx - 3.5, 0), top: ppArt(d.cy - d.ry - 2), '--gw-rx': ppArt(2 * d.rx),
          animation: `gwKreisX ${d.dur}s ease-in-out ${d.delay}s infinite alternate, gwTiefe ${2 * d.dur}s steps(1) ${d.delay}s infinite`,
        }}>
          <div className="gw-kreis-y" style={{ '--gw-ry': ppArt(2 * d.ry), animation: `gwKreisY ${d.dur}s ease-in-out ${d.delay - d.dur / 2}s infinite alternate` }}>
            <i className="gw-dohle" style={{ animation: `ppSprite2 ${d.flap.toFixed(2)}s steps(1) infinite` }} />
          </div>
        </div>
      ))}
      <PixelPiece src={GW + 'tower.png'} w={GW_TURM_W} />
      <PixelPiece src={GW + 'tower-glow.png'} w={GW_TURM_W} className="gw-schein" />
      {zeiger('hand-hour.png', `gwZeiger 720s steps(60) ${zeit.std.toFixed(2)}s infinite`)}
      {zeiger('hand-min.png', `gwZeiger 60s steps(60) ${zeit.min.toFixed(2)}s infinite`)}
      <i className="gw-achse" style={{ left: ppArtX(GW_ZB.x, GW_TURM_W), top: ppArt(GW_ZB.y) }} />
      <PixelBand src={GW + 'smog.png'} className="gw-smog vorn" />
      {zieher.map((z, i) => (
        <div key={'z' + i} className="pp-area-dyn pp-quer" style={ppQuer(z.y, z.dur, z.delay, z.rtl)}>
          <i className="gw-dohle" style={{ '--bob': ppArt(2), animation: 'ppSprite2 .28s steps(1) infinite, ppBob 1.5s ease-in-out infinite alternate' }} />
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .gw-mond {
          position: absolute;
          width: calc(17 * var(--px)); height: calc(17 * var(--px));
          background: url(${GW}moon.png) 0 0 / 100% 100% no-repeat;
        }
        .gw-smog { animation: gwSmog 150s steps(128) infinite; opacity: .9; }
        .gw-smog.vorn { opacity: .3; animation-duration: 95s; animation-direction: reverse; }
        @keyframes gwSmog { from { background-position: 0 0; } to { background-position: calc(128 * var(--px)) 0; } }
        .gw-licht-a { animation: gwAtmen 4.6s ease-in-out infinite alternate; }
        @keyframes gwAtmen { from { opacity: .78; } to { opacity: 1; } }
        .gw-licht-b { animation: gwAnAusB 23s steps(1) infinite; }
        @keyframes gwAnAusB { 0% { opacity: 1; } 38% { opacity: 0; } 61% { opacity: 1; } 83% { opacity: 0; } 87% { opacity: 1; } }
        .gw-licht-c { animation: gwAnAusC 31s steps(1) -9s infinite; }
        @keyframes gwAnAusC { 0% { opacity: 0; } 22% { opacity: 1; } 57% { opacity: 0; } 64% { opacity: 1; } 90% { opacity: 0; } }
        .gw-warnlicht { animation: gwBlink 2.2s steps(1) infinite; }
        @keyframes gwBlink { 0% { opacity: 1; } 45% { opacity: .12; } }
        .gw-laterne { animation: gwLaterne 1.9s steps(1) infinite; }
        @keyframes gwLaterne { 0% { opacity: 1; } 21% { opacity: .8; } 25% { opacity: 1; } 58% { opacity: .88; } 62% { opacity: .7; } 66% { opacity: 1; } }
        /* Blumen wiegen: gerade – rechts – gerade – links */
        @keyframes gwWiegen { 0% { background-position: 50% 0%; } 25% { background-position: 50% 50%; } 50% { background-position: 50% 0%; } 75% { background-position: 50% 100%; } }
        .gw-gluehwurm {
          position: absolute; width: var(--px); height: var(--px); background: #e4f47a; opacity: 0;
          box-shadow: 0 0 calc(2 * var(--px)) calc(.5 * var(--px)) rgba(210, 240, 110, .45);
        }
        @keyframes gwSchwirren {
          0%, 100% { transform: translate(0, 0); } 25% { transform: translate(calc(4 * var(--px)), calc(-3 * var(--px))); }
          50% { transform: translate(calc(7 * var(--px)), calc(-1 * var(--px))); } 75% { transform: translate(calc(3 * var(--px)), calc(2 * var(--px))); }
        }
        @keyframes gwLeuchten { 0% { opacity: 0; } 30% { opacity: .5; } 40% { opacity: 1; } 70% { opacity: .5; } 80%, 100% { opacity: 0; } }
        .gw-schein { animation: gwSchein 5.5s ease-in-out infinite alternate; }
        @keyframes gwSchein { from { opacity: .55; } to { opacity: 1; } }
        .gw-zeiger {
          position: absolute; width: calc(${GW_ZEIGER} * var(--px)); height: calc(${GW_ZEIGER} * var(--px));
          background-repeat: no-repeat; background-size: calc(${60 * GW_ZEIGER} * var(--px)) 100%;
        }
        @keyframes gwZeiger { from { background-position: 0 0; } to { background-position: calc(${-60 * GW_ZEIGER} * var(--px)) 0; } }
        .gw-achse { position: absolute; width: var(--px); height: var(--px); background: #e8b83a; }
        .gw-rauch { position: absolute; width: calc(6 * var(--px)); height: calc(5 * var(--px)); background: url(${GW}smoke.png) 0 0 / 100% 100% no-repeat; opacity: 0; }
        .gw-rauch.gross { width: calc(9 * var(--px)); height: calc(7 * var(--px)); background-image: url(${GW}smoke-big.png); }
        @keyframes gwRauch {
          0% { transform: translate(0, 0) scale(.5); opacity: 0; } 12% { opacity: .8; }
          100% { transform: translate(calc(-7 * var(--px)), calc(-16 * var(--px))) scale(1.5); opacity: 0; }
        }
        @keyframes gwRauchGross {
          0% { transform: translate(0, 0) scale(.5); opacity: 0; } 10% { opacity: .9; }
          100% { transform: translate(calc(-10 * var(--px)), calc(-20 * var(--px))) scale(1.8); opacity: 0; }
        }
        .gw-kreis-x { position: absolute; }
        @keyframes gwKreisX { from { transform: translateX(0); } to { transform: translateX(var(--gw-rx)); } }
        @keyframes gwKreisY { from { transform: translateY(0); } to { transform: translateY(var(--gw-ry)); } }
        @keyframes gwTiefe { 0% { z-index: 1; } 50% { z-index: 0; } }
        .gw-dohle { display: block; width: calc(7 * var(--px)); height: calc(4 * var(--px)); background: url(${GW}daw.png) 0 0 / 200% 100% no-repeat; }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  WAR COUNCIL GATHERING PLACE — Kriegsrat auf der Festungsbruecke (v1440, Al 25.9.)
//
//  Al 25.9.: „Gathering Place soll eine BRUECKE darstellen, keinen
//  Innenraum!" Nach dem Kartenmotiv: die violettgraue Quadermauer ist die
//  Bruestung der Bruecke, der graue unregelmaessige Steinboden ihr Deck,
//  auf dem sich die Krieger mit den roten Helmbueschen versammeln. Die
//  Figuren selbst bleiben WEG (darauf liegen die Karten) — gezeigt wird
//  der Ort. Blick schraeg von oben auf das breite Steindeck.
//
//  Ebenen (Kunsthoehe 100; per Generator gemalt, der nicht im Projekt
//  liegt): sky.png — Kachel 128, Himmel mit fernen Bergketten (Schnee
//  im Licht) und Waldtal; castle.png — ferne Burg auf einem Felsgrat
//  (40, links der Mitte); river.png — Kachel, die Tiefe unter der
//  Bruecke (Felsen, Fluss mit Schaum); tile.png — Kachel 128: hintere
//  Bruestung mit Zinnen und Schiessscharten, Pfeiler mit Zinnenkrone,
//  Fahnenstange und Laterne, Feuerschale und Wasserfass, Speerstaender
//  mit Rundschilden und Helm, Flagsteindeck (Moos in den Fugen, Gras,
//  Flechten, Laub, eine Pfuetze mit Himmelsspiegel), vorn Bordstein,
//  Stirnwand und Konsolen, darunter der Blick in die Tiefe; flags.png —
//  4 Bilder, rote Fahnen mit goldenem Helm; council.png — Mitte 144:
//  Rundplatz ueber dem Mittelpfeiler (das Deck buchtet vorn aus), darauf
//  der Kriegstisch mit Karte (Kueste, Fluss, Waelder, Berge, Grenze,
//  rote und blaue Steine, ein Dolch steckt darin), Helm, Tischlaterne,
//  Schriftrolle, vier Lehnstuehle, zwei Feuerschalen; glow.png /
//  council-glow.png — Laternen- und Feuerschein.
//
//  Animiert: Fahnen wehen kraeftig im Wind (nach rechts), Feuer in den
//  Schalen flackern (fire.png, 4 Bilder) mit Funken und Rauch, die der
//  Wind nach rechts treibt, der Schein pulsiert, Wolken ziehen, Voegel
//  kreisen vorbei, der Fluss tief unten fliesst, Laub weht ueber das
//  Deck. Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const WC = '/areas/war-council/';
const WC_W = 144;
const WC_KACHEL = 128;
const WC_KACHEL_SCHALE = { x: 32 - 64, fuss: 47 };     // Feuerschale der Kachel (neben der Kachelmitte)
const WC_MITTE_SCHALEN = [-54, 54];                     // Feuerschalen auf dem Rundplatz
const WC_MITTE_FUSS = 64;

const WarCouncilOverlay = React.memo(function WarCouncilOverlay() {
  const schalen = useMemo(() => {
    const out = WC_MITTE_SCHALEN.map(x => ({ x, fuss: WC_MITTE_FUSS }));
    for (let k = -3; k <= 3; k++) {
      const x = WC_KACHEL_SCHALE.x + k * WC_KACHEL;
      if (Math.abs(x) > WC_W / 2 - 4) out.push({ x, fuss: WC_KACHEL_SCHALE.fuss });
    }
    return out.map(s => ({ ...s, dur: .5 + Math.random() * .25, delay: -Math.random() }));
  }, []);
  const funken = useMemo(() => ppZufall(ppFxN(10), (i) => {
    const s = schalen[i % schalen.length];
    return { x: s.x + Math.round((Math.random() - .5) * 4), y: s.fuss - 16, dur: 1.4 + Math.random() * 1.2, delay: -Math.random() * 3 };
  }), [schalen]);
  const rauch = useMemo(() => ppZufall(ppFxN(6), (i) => {
    const s = schalen[i % schalen.length];
    return { x: s.x, y: s.fuss - 22, dur: 4 + Math.random() * 2, delay: -Math.random() * 6 };
  }), [schalen]);
  const wolken = useMemo(() => ppZufall(ppFxN(4), (i) => ({
    y: -1 + Math.random() * 9, dur: 70 + Math.random() * 50, delay: -Math.random() * 120, art: i % 2,
  })), []);
  const voegel = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    y: 3 + Math.random() * 10, dur: 26 + Math.random() * 14, delay: -Math.random() * 40, bob: 1 + Math.random() * 2, rtl: i === 2,
  })), []);
  const laub = useMemo(() => ppZufall(ppFxN(6), () => ({
    y: 44 + Math.random() * 36, dur: 9 + Math.random() * 7, delay: -Math.random() * 16, bob: 2 + Math.random() * 3,
  })), []);
  return (
    <PixelScene artH={100} bg="#4a66a2" className="war-council-overlay">
      <PixelBand src={WC + 'sky.png'} />
      {wolken.map((w, i) => (
        <div key={'w' + i} className="pp-area-dyn pp-quer" style={ppQuer(w.y, w.dur.toFixed(1), w.delay.toFixed(1), false)}>
          <i className="wc-wolke" style={{ backgroundPosition: w.art ? '100% 0' : '0 0' }} />
        </div>
      ))}
      <PixelPiece src={WC + 'castle.png'} w={40} x={-28} />
      {voegel.map((v, i) => (
        <div key={'v' + i} className="pp-area-dyn pp-quer" style={ppQuer(v.y, v.dur.toFixed(1), v.delay.toFixed(1), v.rtl)}>
          <i className="wc-vogel" style={{ '--bob': ppArt(v.bob), transform: v.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      <PixelBand src={WC + 'river.png'} className="wc-fluss" />
      <PixelBand src={WC + 'tile.png'} />
      <PixelBand src={WC + 'flags.png'} style={{ backgroundSize: 'auto 400%', animation: 'wcFahnen .84s steps(1) infinite' }} />
      <PixelBand src={WC + 'glow.png'} className="wc-schein" />
      <PixelPiece src={WC + 'council.png'} w={WC_W} />
      <PixelPiece src={WC + 'council-glow.png'} w={WC_W} className="wc-schein b" />
      {schalen.map((s, i) => (
        <i key={'f' + i} className="wc-feuer" style={{ left: ppArtX(s.x - 4, 0), top: ppArt(s.fuss - 19), animation: `wcFeuer ${s.dur.toFixed(2)}s steps(4) ${s.delay.toFixed(2)}s infinite` }} />
      ))}
      {funken.map((f, i) => (
        <i key={'s' + i} className="pp-area-dyn wc-funke" style={{ left: ppArtX(f.x, 0), top: ppArt(f.y), animation: `wcFunke ${f.dur.toFixed(2)}s steps(14) ${f.delay.toFixed(2)}s infinite` }} />
      ))}
      {rauch.map((r, i) => (
        <i key={'r' + i} className="pp-area-dyn wc-rauch" style={{ left: ppArtX(r.x - 2, 0), top: ppArt(r.y), animation: `wcRauch ${r.dur.toFixed(2)}s steps(16) ${r.delay.toFixed(2)}s infinite` }} />
      ))}
      {laub.map((l, i) => (
        <div key={'l' + i} className="pp-area-dyn pp-quer" style={ppQuer(l.y, l.dur.toFixed(1), l.delay.toFixed(1), false)}>
          <i className="wc-blatt" style={{ '--bob': ppArt(l.bob) }} />
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        @keyframes wcFahnen {
          0% { background-position: 50% 0%; } 25% { background-position: 50% 33.333%; }
          50% { background-position: 50% 66.667%; } 75% { background-position: 50% 100%; }
        }
        .wc-fluss { animation: wcFluss 16s steps(128) infinite; }
        @keyframes wcFluss { from { background-position: 50% 0; } to { background-position: calc(50% + 128 * var(--px)) 0; } }
        .wc-schein { animation: wcSchein 1.3s steps(1) infinite; }
        .wc-schein.b { animation-duration: 1.7s; animation-delay: -.4s; }
        @keyframes wcSchein { 0% { opacity: .85; } 18% { opacity: 1; } 34% { opacity: .72; } 52% { opacity: .95; } 70% { opacity: .8; } 86% { opacity: 1; } }
        .wc-feuer {
          position: absolute; width: calc(9 * var(--px)); height: calc(10 * var(--px));
          background: url(${WC}fire.png) 0 0 / 400% 100% no-repeat;
        }
        @keyframes wcFeuer { from { background-position: 0 0; } to { background-position: calc(-36 * var(--px)) 0; } }
        .wc-funke { position: absolute; width: var(--px); height: var(--px); background: #ffb040; opacity: 0; }
        @keyframes wcFunke {
          0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: 1; }
          60% { transform: translate(calc(5 * var(--px)), calc(-9 * var(--px))); }
          100% { transform: translate(calc(12 * var(--px)), calc(-15 * var(--px))); opacity: 0; }
        }
        .wc-rauch {
          position: absolute; width: calc(4 * var(--px)); height: calc(3 * var(--px)); opacity: 0;
          background: rgba(96, 90, 112, .55); box-shadow: inset calc(-1 * var(--px)) calc(1 * var(--px)) 0 rgba(60, 54, 74, .5);
        }
        @keyframes wcRauch {
          0% { transform: translate(0, 0); opacity: 0; } 15% { opacity: .75; }
          100% { transform: translate(calc(18 * var(--px)), calc(-14 * var(--px))); opacity: 0; }
        }
        .wc-wolke { display: block; width: calc(24 * var(--px)); height: calc(8 * var(--px)); background-image: url(${WC}cloud.png); background-size: 200% 100%; background-repeat: no-repeat; }
        .wc-vogel {
          display: block; width: calc(5 * var(--px)); height: calc(3 * var(--px));
          background: url(${WC}bird.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .42s steps(1) infinite, ppBob 1.6s ease-in-out infinite alternate;
        }
        .wc-blatt {
          display: block; width: calc(2 * var(--px)); height: calc(2 * var(--px));
          background: url(${WC}leaf.png) 0 0 / 300% 100% no-repeat;
          animation: ppSprite3 .5s steps(1) infinite, ppBob .9s ease-in-out infinite alternate;
        }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  WOWHALLA, THE HALL OF THE COOL (v1440, Al 25.9.)
//
//  Karte (Als große Fassung): eine STEAMPUNK-Hallenstadt auf dem Eis —
//  Bauten aus goldbraunen, vernieteten Blechplatten mit schmalen dunklen
//  Schlitzfenstern und Rundbögen, dunkelgrüne, geschwungene Pagodendächer
//  mit hornartig hochgebogenen Spitzen und Dachreitern, GROSSE Zahnräder
//  aus Bronze (und graue aus Stahl), teils halb hinter den Bauten, teils
//  an den Wänden; Stahl-Gitterstelzen, ein schwarzer Schornstein auf
//  einem Gitterturm mit riesiger dunkler Rauchsäule. Türkiser Himmel mit
//  Pixelwolken, Boden aus diagonal gestreiftem Eis, ein Pfad aus Eis-
//  schollen zum Tor, dunkle wurzelartige Eisrisse am Gebäudefuß.
//  Al 25.9.: „Es soll einen STEAMPUNK-Vibe haben!" — kein Fachwerk.
//
//  Ebenen (Kunsthöhe 100; per Generator gemalt, der nicht im Projekt
//  liegt): tile.png — Kachel 128 (Himmel, ferne Dampf-Stadt im Dunst mit
//  Türmen, Zahnrädern, Gittermasten und einer Rohrleitung auf Stelzen,
//  Eisfläche mit Brocken, Rissen und Wehen); clouds.png — Wolken (Kachel
//  128); hall.png — die Hallen, Stück WH_W breit, OHNE die drehenden
//  Zahnräder; gears.png — Atlas: je Zahnrad eine Zeile mit 4 Bildern (=
//  eine Zahnteilung); smoke.png — Rauchsäule (8 Bilder); steam.png —
//  Dampfstoß (6 Bilder); snow-far.png / snow-near.png — Schneefall-
//  Kacheln 64×100, nahtlos in x und y.
//
//  Animiert: die Zahnräder DREHEN sich in Pixelbildern (kein weiches
//  Rotieren) — alle mit demselben Takt je Zahnteilung, also gleicher
//  Umfangsgeschwindigkeit; wo sie sich berühren, greifen sie gegenläufig
//  ineinander (Phase vom Generator). Die Rauchsäule quillt und steigt,
//  Dampf zischt aus Rohrenden, Schnee fällt in zwei Tiefen (der ferne
//  hinter den Hallen), Eisschollen und Eis glitzern, Wolken ziehen.
//  Licht IMMER oben rechts.
// ═══════════════════════════════════════════════════════════════════
const WH = '/areas/wowhalla/';
// <gen> (vom Generator geschrieben — nicht von Hand ändern)
const WH_W = 176;                                   // Hallenstück; Stück-x 88 = Brettmitte
const WH_ATLAS = [128, 248];                        // gears.png (Kunstpixel)
// Zahnräder: Mitte (Stück-x, y), Größe S, Zeile im Atlas, hinten = hinter den Hallen
const WH_ZAHNRAEDER = [
  { x: 65, y: 36, s: 32, zeile: 0, hinten: true },   // b1: 14 Zähne, bronze
  { x: 113, y: 31, s: 22, zeile: 32, hinten: true },   // b2: 9 Zähne, steel
  { x: 16, y: 33, s: 22, zeile: 54, hinten: true },   // b3: 9 Zähne, steel
  { x: 118, y: 50, s: 22, zeile: 76, hinten: true },   // b4: 8 Zähne, bronze
  { x: 176, y: 64, s: 24, zeile: 98, hinten: true },   // b5: 10 Zähne, bronze
  { x: 38, y: 57, s: 22, zeile: 122, hinten: false },   // l1: 8 Zähne, bronze
  { x: 25, y: 52, s: 20, zeile: 144, hinten: false },   // l2: 7 Zähne, bronze
  { x: 36, y: 70, s: 20, zeile: 164, hinten: false },   // l3: 7 Zähne, bronze
  { x: 57, y: 70, s: 22, zeile: 184, hinten: false },   // m1: 8 Zähne, bronze
  { x: 111, y: 72, s: 22, zeile: 206, hinten: false },   // r1: 8 Zähne, bronze
  { x: 101, y: 63, s: 20, zeile: 228, hinten: false },   // r2: 7 Zähne, bronze
];
const WH_RAUCH = { x: 112, w: 48, h: 33, n: 8 };    // Rauchbild, linke Kante im Stück
const WH_DAMPF = [[110, 29], [54, 43], [150, 38]];   // offene Rohrenden
const WH_GLITZER = [[98, 99], [87, 93], [91, 96], [89, 96], [80, 92], [98, 93]];   // Eisschollen
// </gen>
const WH_TAKT = 0.9;                 // Sekunden je Zahnteilung (für ALLE Räder gleich)
const WowhallaOverlay = React.memo(function WowhallaOverlay() {
  const dampf = useMemo(() => WH_DAMPF.slice(0, ppFxN(WH_DAMPF.length)).map(() => ({
    dur: 3.2 + Math.random() * 3, delay: -Math.random() * 6,
  })), []);
  const glitzer = useMemo(() => ppZufall(ppFxN(12), (i) => i < WH_GLITZER.length
    ? { x: WH_GLITZER[i][0] - WH_W / 2, y: WH_GLITZER[i][1], dur: 2 + Math.random() * 2.5, delay: -Math.random() * 4 }
    : { x: (Math.random() - .5) * 340, y: 74 + Math.random() * 24, dur: 2.4 + Math.random() * 2.5, delay: -Math.random() * 5 }), []);
  const rad = (g, i) => (
    <i key={'z' + i} className="wh-rad" style={{
      left: ppArtX(g.x - g.s / 2, WH_W), top: ppArt(g.y - g.s / 2), width: ppArt(g.s), height: ppArt(g.s),
      '--s': ppArt(g.s), backgroundPositionY: `calc(${-g.zeile} * var(--px))`,
    }} />
  );
  return (
    <PixelScene artH={100} bg="#8fd6dc" className="wowhalla-overlay">
      <PixelBand src={WH + 'tile.png'} />
      <PixelBand src={WH + 'clouds.png'} className="wh-wolken" />
      <div className="pp-pixel-layer pp-area-dyn wh-schnee fern" />
      {WH_ZAHNRAEDER.map((g, i) => g.hinten ? rad(g, i) : null)}
      <PixelPiece src={WH + 'hall.png'} w={WH_W} />
      {WH_ZAHNRAEDER.map((g, i) => g.hinten ? null : rad(g, i))}
      <i className="wh-rauch" style={{ left: ppArtX(WH_RAUCH.x, WH_W), top: 0 }} />
      {dampf.map((d, i) => (
        <i key={'d' + i} className="pp-area-dyn wh-dampf" style={{
          left: ppArtX(WH_DAMPF[i][0] - 3, WH_W), top: ppArt(WH_DAMPF[i][1] - 8),
          animation: `whDampf ${d.dur.toFixed(2)}s steps(1) ${d.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {glitzer.map((g, i) => (
        <i key={'g' + i} className="pp-area-dyn pp-px-funkeln" style={{ left: ppArtX(g.x - 1, 0), top: ppArt(g.y - 1), animation: `ppFunkeln ${g.dur.toFixed(2)}s steps(1) ${g.delay.toFixed(2)}s infinite` }} />
      ))}
      <div className="pp-pixel-layer pp-area-dyn wh-schnee nah" />
      <div className="pp-rand-dim" />
      <style>{`
        .wh-wolken { animation: whWolken 140s steps(128) infinite; }
        @keyframes whWolken { from { background-position: 50% 0; } to { background-position: calc(50% - 128 * var(--px)) 0; } }
        .wh-schnee { position: absolute; inset: 0; background-size: calc(64 * var(--px)) calc(100 * var(--px)); background-repeat: repeat; }
        .wh-schnee.fern { background-image: url(${WH}snow-far.png); opacity: .7; animation: whFallFern 24s steps(200) infinite; }
        .wh-schnee.nah { background-image: url(${WH}snow-near.png); animation: whFallNah 11s steps(300) infinite; }
        @keyframes whFallFern { from { background-position: 0 0; } to { background-position: calc(-64 * var(--px)) calc(200 * var(--px)); } }
        @keyframes whFallNah { from { background-position: 0 0; } to { background-position: calc(-64 * var(--px)) calc(300 * var(--px)); } }
        .wh-rad {
          position: absolute; background-image: url(${WH}gears.png); background-repeat: no-repeat;
          background-size: calc(${WH_ATLAS[0]} * var(--px)) calc(${WH_ATLAS[1]} * var(--px));
          background-position-x: 0; animation: whRad ${WH_TAKT}s steps(4) infinite;
        }
        @keyframes whRad { from { background-position-x: 0; } to { background-position-x: calc(-4 * var(--s)); } }
        .wh-rauch {
          position: absolute; width: calc(${WH_RAUCH.w} * var(--px)); height: calc(${WH_RAUCH.h} * var(--px));
          background: url(${WH}smoke.png) 0 0 / ${WH_RAUCH.n * 100}% 100% no-repeat;
          animation: whRauch 1.9s steps(${WH_RAUCH.n}) infinite;
        }
        @keyframes whRauch { from { background-position: 0 0; } to { background-position: calc(${-WH_RAUCH.n * WH_RAUCH.w} * var(--px)) 0; } }
        .wh-dampf { position: absolute; width: calc(8 * var(--px)); height: calc(9 * var(--px)); background: url(${WH}steam.png) 0 0 / 600% 100% no-repeat; }
        @keyframes whDampf {
          0% { background-position: 0 0; } 4% { background-position: 20% 0; } 8% { background-position: 40% 0; }
          12% { background-position: 60% 0; } 16% { background-position: 80% 0; } 20% { background-position: 100% 0; }
          24%, 100% { background-position: 0 0; }
        }
      `}</style>
    </PixelScene>
  );
});

// ===== CROSS-FILE EXPORTS =====
// Kampfbrett und Puzzle-Creator zeichnen DIESELBE Schicht (v1202).
window.AreaBackgrounds = AreaBackgrounds;
