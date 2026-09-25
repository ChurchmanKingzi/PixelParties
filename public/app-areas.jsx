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
//  BLOOD ROCK — Festungsgefaengnis im Blutfels (v1410, Kartenstil v1413)
//
//  Al 25.9.: „eine alte Festung, die als Gefaengnis fungiert und wo
//  Gefangene stetig gefoltert und ihr Blut von Vampiren geraubt wird."
//  STIL (Al 25.9., nach den ersten drei Szenen): die Hintergruende sollen
//  wie Als eigene Kartenmotive aussehen, nicht wie „gemalte" Szenen —
//  grobe Pixel (Kunsthoehe 100 statt 200), Flaechen als unregelmaessiges
//  Pixelrauschen statt geordnetem Dithering, schwarze Fugen und Konturen,
//  satte Farben, weiche Leuchtflecken, nur leichte Randabdunklung.
//
//  DAS ROTE SIND BLUTSTROEME, KEIN LICHT (Al 25.9.): aus den dunklen
//  Fenstern laeuft Blut die Mauern hinab und sammelt sich in Lachen; unter
//  dem Fallgitter quillt es hervor und laeuft die Treppe hinab. Nichts
//  hier leuchtet.
//
//  Ebenen (Kunsthoehe 100; per Generator gemalt, der nicht im Projekt
//  liegt): tile.png — Kachel 64 (Blutfels, Wehrmauer mit Turm, Zellen-
//  fenster, Hof); keep.png — Torbau 96, mittig; mask-tile.png /
//  mask-keep.png — Form der Stroeme, durch die flow.png (Schlieren, 8×16)
//  nach unten laeuft; ripple.png — Aufschlag in der Lache (3 Bilder 7×2);
//  mist.png — Blutnebel; bat.png (2 Bilder 5×4), vampire.png (2 Bilder
//  5×6, Silhouette mit roten Augen).
// ═══════════════════════════════════════════════════════════════════
const BR = '/areas/blood-rock/';
const BR_KEEP_W = 96;
// Fuesse der Blutstroeme (Kunstpixel neben der Brettmitte): Kachel-Stroeme
// wiederholen sich alle 64, der Torbau deckt |x| < 48 ab.
const BR_KACHEL_FUESSE = [-0.5, -24.5, 22.5];
const BR_TORBAU_FUESSE = [[-42, 72], [-24.5, 72], [23.5, 72], [41, 72], [0, 79]];

const BloodRockOverlay = React.memo(function BloodRockOverlay() {
  const bats = useMemo(() => Array.from({ length: ppFxN(5) }, (_, i) => ({
    y: 2 + Math.random() * 18,
    dur: 16 + Math.random() * 14,
    delay: -Math.random() * 30,
    bob: 1 + Math.random() * 2,
    bobDur: 1.6 + Math.random() * 1.4,
    flap: 0.2 + Math.random() * 0.12,
    rtl: i % 2 === 1,
  })), []);
  // Aufschlag der Stroeme in ihren Lachen
  const ripples = useMemo(() => {
    const out = [];
    for (let k = -4; k <= 4; k++) {
      for (const x0 of BR_KACHEL_FUESSE) {
        const x = x0 + k * 64;
        if (Math.abs(x) >= BR_KEEP_W / 2) out.push([x, 72]);
      }
    }
    return [...BR_TORBAU_FUESSE, ...out].slice(0, ppFxN(40)).map(([x, y]) => ({
      x, y, dur: 0.5 + Math.random() * 0.3, delay: -Math.random(),
    }));
  }, []);
  // Tropfen aus den vergitterten Fensterreihen des Torbaus
  const drips = useMemo(() => [
    { x: 30, y0: 34, y1: 37, dur: 5.2, delay: -3.3 },
    { x: 66, y0: 34, y1: 37, dur: 4.6, delay: -0.9 },
    { x: 44, y0: 19, y1: 21, dur: 3.9, delay: -2.0 },
    { x: 55, y0: 19, y1: 21, dur: 4.4, delay: -0.3 },
  ].slice(0, ppFxN(4)), []);
  return (
    <PixelScene artH={100} bg="#140606" className="blood-rock-overlay">
      <PixelBand src={BR + 'tile.png'} />
      <div className="pp-pixel-layer br-strom" style={ppMaske(BR + 'mask-tile.png', true)} />
      <PixelPiece src={BR + 'keep.png'} w={BR_KEEP_W} />
      <div className="pp-pixel-layer br-strom" style={{
        left: `calc(50% - ${BR_KEEP_W / 2} * var(--px))`, right: 'auto', width: ppArt(BR_KEEP_W),
        ...ppMaske(BR + 'mask-keep.png', false),
      }} />
      {ripples.map((r, i) => (
        <i key={'r' + i} className="pp-area-dyn br-kraeusel" style={{
          left: ppArtX(r.x - 3.5, 0), top: ppArt(r.y),
          animation: `brKraeusel ${r.dur}s steps(1) ${r.delay}s infinite`,
        }} />
      ))}
      <i className="br-vampir" style={{ left: ppArtX(57, BR_KEEP_W), top: ppArt(0) }} />
      <div className="pp-pixel-layer br-mist" style={{ top: ppArt(76) }} />
      <div className="pp-pixel-layer br-mist br-mist-hoch" style={{ top: ppArt(18) }} />
      {bats.map((b, i) => (
        <div key={'b' + i} className="pp-area-dyn br-bat-bahn" style={{
          top: ppArt(b.y), animation: `${b.rtl ? 'brBatRtl' : 'brBatLtr'} ${b.dur}s linear ${b.delay}s infinite`,
        }}>
          <div className="br-bat" style={{
            '--bob': ppArt(b.bob),
            transform: b.rtl ? 'scaleX(-1)' : undefined,
            animation: `brBatFlap ${b.flap}s steps(1) infinite, brBatBob ${b.bobDur}s ease-in-out infinite alternate`,
          }} />
        </div>
      ))}
      {drips.map((d, i) => (
        <i key={'d' + i} className="pp-area-dyn pp-px-tropfen" style={{
          left: ppArtX(d.x, BR_KEEP_W), top: ppArt(d.y0), '--fall': ppArt(d.y1 - d.y0),
          '--tropfen': '#8c0c0a', '--tropfen-dunkel': '#3f0606',
          animation: `ppPxTropfen ${d.dur}s ease-in ${d.delay}s infinite`,
        }} />
      ))}
      <div className="br-dim" />
      <style>{`
        /* Blut laeuft: helle Schlieren wandern durch die Stroeme nach unten */
        .br-strom {
          position: absolute; inset: 0;
          background: url(${BR}flow.png) 0 0 / calc(8 * var(--px)) calc(16 * var(--px)) repeat;
          animation: brStrom .7s linear infinite;
        }
        @keyframes brStrom { from { background-position: 0 0; } to { background-position: 0 calc(16 * var(--px)); } }
        .br-kraeusel {
          position: absolute; width: calc(7 * var(--px)); height: calc(2 * var(--px));
          background: url(${BR}ripple.png) 0 0 / 300% 100% no-repeat;
        }
        @keyframes brKraeusel { 0% { background-position: 0 0; } 33.3% { background-position: 50% 0; } 66.6% { background-position: 100% 0; } }
        .br-vampir {
          position: absolute; width: calc(5 * var(--px)); height: calc(6 * var(--px));
          background: url(${BR}vampire.png) 0 0 / 200% 100% no-repeat;
          animation: brUmhang .9s steps(1) infinite;
        }
        @keyframes brUmhang { 0% { background-position: 0 0; } 50% { background-position: 100% 0; } }
        .br-mist {
          position: absolute; left: 0; right: 0; height: calc(14 * var(--px));
          background: url(${BR}mist.png) 0 0 / auto 100% repeat-x; opacity: .55;
          animation: brNebel 48s steps(64) infinite;
        }
        .br-mist-hoch { opacity: .45; animation-duration: 70s; animation-direction: reverse; }
        @keyframes brNebel { from { background-position: 0 0; } to { background-position: calc(64 * var(--px)) 0; } }
        .br-bat-bahn { position: absolute; left: 0; }
        .br-bat {
          width: calc(5 * var(--px)); height: calc(4 * var(--px));
          background: url(${BR}bat.png) 0 0 / 200% 100% no-repeat;
        }
        @keyframes brBatFlap { 0% { background-position: 0 0; } 50% { background-position: 100% 0; } }
        @keyframes brBatBob { from { translate: 0 0; } to { translate: 0 var(--bob); } }
        @keyframes brBatLtr { from { transform: translateX(calc(-10 * var(--px))); } to { transform: translateX(calc(100cqw + 10 * var(--px))); } }
        @keyframes brBatRtl { from { transform: translateX(calc(100cqw + 10 * var(--px))); } to { transform: translateX(calc(-10 * var(--px))); } }
        .br-dim {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,.32) 100%);
        }
      `}</style>
    </PixelScene>
  );
});


// ── PANGAIA, THE DINO DOMAIN ─────────────────────────────────────────
//  v1439 (Al 25.9.) nach dem Kartenmotiv: eine ganze Insel aus der
//  Vogelperspektive — dichter Dschungel aus schattierten Baumkronen,
//  Lichtungen, Erdflecken, Felsbrocken, Strand und Flachwasser an der
//  Kueste, ein Fluss vom Vulkanfuss zur Bucht, ein See, der Vulkan mit
//  Lavasee und Lavastrom. Darauf kleine (eigentlich riesige) Dinosaurier:
//  eine Brachiosaurus-Herde grast, ein T-Rex streift umher, Raptoren
//  flitzen, Flugsaurier ziehen mit Schatten ueber alles hinweg. Wasser
//  glitzert, Lava glueht, der Vulkan raucht. Licht IMMER oben rechts.
const PGN = '/areas/pangaia/';
const PGN_W = 250;
const PGN_VULKAN = { x: 150 - 125, y: 26 };
const PGN_DINOS = [
  // Art, Breite, Hoehe, Start (neben der Mitte), Weg, Dauer
  { art: 'brachio', w: 14, h: 7, x: -84, y: 44, weg: 18, dur: 16 },
  { art: 'brachio', w: 14, h: 7, x: -70, y: 53, weg: 16, dur: 19 },
  { art: 'trex', w: 9, h: 6, x: 56, y: 66, weg: 16, dur: 11 },
  { art: 'raptor', w: 5, h: 3, x: -26, y: 74, weg: 24, dur: 5 },
  { art: 'raptor', w: 5, h: 3, x: -20, y: 78, weg: 22, dur: 5.6 },
];
const PangaiaOverlay = React.memo(function PangaiaOverlay() {
  const dinos = useMemo(() => PGN_DINOS.slice(0, Math.max(3, ppFxN(PGN_DINOS.length))).map(d => ({
    ...d, delay: -Math.random() * d.dur,
  })), []);
  const flieger = useMemo(() => ppZufall(ppFxN(2), (i) => ({
    y: 14 + i * 38 + Math.random() * 8, dur: 18 + Math.random() * 8, delay: -Math.random() * 20, rtl: i % 2 === 1,
  })), []);
  const rauch = useMemo(() => ppZufall(ppFxN(5), () => ({ dur: 4 + Math.random() * 2, delay: -Math.random() * 6 })), []);
  return (
    <PixelScene artH={100} bg="#123a96" className="pangaia-overlay">
      <PixelBand src={PGN + 'sea.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 1.8s steps(1) infinite' }} />
      <PixelPiece src={PGN + 'island.png'} w={PGN_W} style={{ backgroundSize: '100% 300%', animation: 'ppBand3 1.4s steps(1) infinite' }} />
      <PixelPiece src={PGN + 'lava-glow.png'} w={PGN_W} className="pgn-lava" />
      {dinos.map((d, i) => (
        <i key={'d' + i} className="pp-area-dyn pgn-dino" style={{
          left: ppArtX(d.x, 0), top: ppArt(d.y), width: ppArt(d.w), height: ppArt(d.h), '--weg': ppArt(d.weg),
          backgroundImage: `url(${PGN}${d.art}.png)`,
          animation: `pgnWandern ${d.dur}s linear ${d.delay.toFixed(2)}s infinite, ppSprite2 ${d.art === 'raptor' ? .25 : .6}s steps(1) infinite`,
        }} />
      ))}
      {rauch.map((r, i) => (
        <i key={'r' + i} className="pp-area-dyn pgn-rauch" style={{ left: ppArtX(PGN_VULKAN.x - 3, 0), top: ppArt(PGN_VULKAN.y - 4), animation: `pgnRauch ${r.dur.toFixed(2)}s ease-out ${r.delay.toFixed(2)}s infinite` }} />
      ))}
      {flieger.map((f, i) => (
        <div key={'f' + i} className="pp-area-dyn pp-quer" style={ppQuer(f.y, f.dur, f.delay, f.rtl)}>
          <div style={{ position: 'relative', transform: f.rtl ? 'scaleX(-1)' : undefined }}>
            <i className="pgn-schatten" />
            <i className="pgn-ptero" />
          </div>
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .pgn-lava { animation: pgnLava 2.2s ease-in-out infinite alternate; }
        @keyframes pgnLava { from { opacity: .45; } to { opacity: 1; } }
        .pgn-dino { position: absolute; background-size: 200% 100%; background-repeat: no-repeat; }
        @keyframes pgnWandern {
          0% { transform: translateX(0) scaleX(1); } 49.99% { transform: translateX(var(--weg)) scaleX(1); }
          50% { transform: translateX(var(--weg)) scaleX(-1); } 100% { transform: translateX(0) scaleX(-1); }
        }
        .pgn-rauch { position: absolute; width: calc(6 * var(--px)); height: calc(5 * var(--px)); border-radius: 50%; background: rgba(70, 64, 60, .75); box-shadow: inset calc(-1 * var(--px)) calc(1 * var(--px)) 0 rgba(40, 36, 34, .6); opacity: 0; }
        @keyframes pgnRauch { 0% { transform: translate(0, 0) scale(.5); opacity: 0; } 15% { opacity: .85; } 100% { transform: translate(calc(8 * var(--px)), calc(-24 * var(--px))) scale(1.8); opacity: 0; } }
        .pgn-ptero { display: block; width: calc(10 * var(--px)); height: calc(9 * var(--px)); background: url(${PGN}ptero.png) 0 0 / 200% 100% no-repeat; animation: ppSprite2 .5s steps(1) infinite; }
        .pgn-schatten { position: absolute; left: calc(1 * var(--px)); top: calc(16 * var(--px)); width: calc(7 * var(--px)); height: calc(6 * var(--px)); border-radius: 50%; background: rgba(0, 20, 0, .35); }
      `}</style>
    </PixelScene>
  );
});


// ── BOARD OF KINGS ───────────────────────────────────────────────────
//  v1438 (Al 25.9.) nach dem Kartenmotiv: ein riesiges Schachbrett aus
//  poliertem Marmor (Felder mit Fase — oben/rechts im Licht, unten/links
//  im Schatten —, feinen Adern), dunkle Einfassung, violettgrauer
//  Pflasterrand, dahinter Blumenhecken. Die Schachfiguren des Motivs
//  bleiben WEG (Al). Animiert: Glanz huscht ueber einzelne Felder, ein
//  Wolkenschatten zieht, Blueten wiegen, Bluetenblaetter treiben.
//  Licht IMMER oben rechts.
const BOK = '/areas/board-of-kings/';
const BOK_W = 144, BOK_FELD = 12, BOK_SPALTEN = 10, BOK_OY = -4;
const BoardOfKingsOverlay = React.memo(function BoardOfKingsOverlay() {
  const glanz = useMemo(() => ppZufall(ppFxN(5), () => {
    const col = Math.floor(Math.random() * BOK_SPALTEN), row = Math.floor(Math.random() * 8);
    return {
      x: -BOK_W / 2 + 12 + col * BOK_FELD + 1, y: BOK_OY + row * BOK_FELD + 1,
      dur: 4 + Math.random() * 4, delay: -Math.random() * 8,
    };
  }), []);
  const blaetter = useMemo(() => ppZufall(ppFxN(7), (i) => ({
    y: 5 + Math.random() * 85, dur: 12 + Math.random() * 10, delay: -Math.random() * 20, rtl: i % 2 === 1,
  })), []);
  return (
    <PixelScene artH={100} bg="#305a2a" className="board-of-kings-overlay">
      <PixelBand src={BOK + 'hedge.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 2.4s steps(1) infinite' }} />
      <PixelPiece src={BOK + 'board.png'} w={BOK_W} />
      {glanz.map((g, i) => (
        <i key={'g' + i} className="pp-area-dyn bok-glanz" style={{ left: ppArtX(g.x, 0), top: ppArt(g.y), animation: `bokGlanz ${g.dur.toFixed(2)}s steps(10) ${g.delay.toFixed(2)}s infinite` }} />
      ))}
      <i className="pp-area-dyn bok-wolke" />
      {blaetter.map((b, i) => (
        <div key={'b' + i} className="pp-area-dyn pp-quer" style={ppQuer(b.y, b.dur, b.delay, b.rtl)}>
          <i className="bok-blatt" />
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .bok-glanz {
          position: absolute; width: calc(10 * var(--px)); height: calc(10 * var(--px));
          background: url(${BOK}glint.png) 0 0 / 100% 100% no-repeat; opacity: 0;
        }
        @keyframes bokGlanz {
          0%, 80% { opacity: 0; transform: translate(calc(-6 * var(--px)), calc(6 * var(--px))); }
          84% { opacity: 1; } 96% { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(6 * var(--px)), calc(-6 * var(--px))); }
        }
        .bok-wolke {
          position: absolute; top: 0; left: 0; width: calc(110 * var(--px)); height: calc(70 * var(--px));
          background: radial-gradient(ellipse, rgba(20,24,40,.22) 0%, rgba(20,24,40,.12) 45%, rgba(20,24,40,0) 70%);
          animation: bokWolke 38s linear infinite;
        }
        @keyframes bokWolke {
          from { transform: translate(calc(-120 * var(--px)), calc(10 * var(--px))); }
          to { transform: translate(calc(100cqw + 10 * var(--px)), calc(30 * var(--px))); }
        }
        .bok-blatt { display: block; width: calc(2 * var(--px)); height: calc(2 * var(--px)); background: url(${BOK}petal.png) 0 0 / 300% 100% no-repeat; animation: ppSprite3 .9s steps(1) infinite, ppBob 1.3s ease-in-out infinite alternate; --bob: calc(4 * var(--px)); }
      `}</style>
    </PixelScene>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  SHARED BLOOD TANKS — Blutkeller der Festung (v1411, Kartenstil v1413)
//
//  Al 25.9.: „ein dunkler Kellerraum derselben Festung mit grossen Tanks
//  voller Blut und Knochen/Schaedeln darin."
//  STIL (Al 25.9., nach den ersten drei Szenen): die Hintergruende sollen
//  wie Als eigene Kartenmotive aussehen, nicht wie „gemalte" Szenen —
//  grobe Pixel (Kunsthoehe 100 statt 200), Flaechen als unregelmaessiges
//  Pixelrauschen statt geordnetem Dithering, schwarze Fugen und Konturen,
//  satte Farben, weiche Leuchtflecken, nur leichte Randabdunklung.
//
//  „Shared" sichtbar: alle Tanks haengen an EINEM Rohrnetz, in der Mitte
//  steht das Pumpwerk. Der Blutspiegel steigt und faellt in ALLEN Tanks
//  und im Sichtglas der Pumpe gleichzeitig; Blutpulse laufen im Pumptakt
//  von der Pumpe nach aussen.
//
//  Ebenen (Kunsthoehe 100): tile.png (Kachel 64: Ziegelwand, Tank mit
//  Glas, Eisenpfeiler mit rot-weisser Manschette, Sockel, Boden),
//  tile-front.png (Glanzlichter), blood.png (3 Wellenbilder, Schaedel)
//  hinter mask-tank.png, flow.png hinter mask-tube.png, pump.png (48,
//  mittig) + wheel/piston/stream.png.
//
//  Tier `opaque` (vorher `partial`): die Szene ist ein ganzer Raum.
// ═══════════════════════════════════════════════════════════════════
const SBT = '/areas/shared-blood-tanks/';
const SBT_PUMP_W = 48;
const SBT_LEVEL_S = 7.5;          // ein Heben/Senken des Blutspiegels
const SBT_PULS_S = 1.1;           // Pumptakt (Kolben + Rohrpulse)

const SharedBloodTanksOverlay = React.memo(function SharedBloodTanksOverlay() {
  // Blasen: je Tank (Tankmitte bei k·64 − 2 Kunstpixeln neben der Brettmitte)
  const bubbles = useMemo(() => {
    const out = [];
    for (const k of [-2, -1, 1, 2]) {            // k = 0 steht hinter der Pumpe
      for (let j = 0; j < ppFxN(3); j++) {
        out.push({ x: k * 64 - 2 - 17 + Math.random() * 34, dur: 2.6 + Math.random() * 2.4, delay: -Math.random() * 5 });
      }
    }
    return out;
  }, []);
  // Tropfen aus den beiden Ventilmanschetten neben der Pumpe
  const drips = [{ x: 26, dur: 3.4, delay: -1 }, { x: -38, dur: 4.1, delay: -2.6 }];
  return (
    <PixelScene artH={100} bg="#101010" className="shared-blood-tanks-overlay">
      <PixelBand src={SBT + 'tile.png'} />
      <div className="pp-pixel-layer" style={{ position: 'absolute', inset: 0, ...ppMaske(SBT + 'mask-tank.png', true) }}>
        <div className="sbt-blut" style={{ backgroundImage: `url(${SBT}blood.png)` }} />
        {bubbles.map((b, i) => (
          <i key={'bl' + i} className="pp-area-dyn sbt-blase" style={{
            left: ppArtX(b.x, 0), top: ppArt(62),
            animation: `sbtBlase ${b.dur}s linear ${b.delay}s infinite`,
          }} />
        ))}
      </div>
      <div className="pp-pixel-layer sbt-fluss links" style={{ ...ppMaske(SBT + 'mask-tube.png', true), backgroundImage: `url(${SBT}flow.png)` }} />
      <div className="pp-pixel-layer sbt-fluss rechts" style={{ ...ppMaske(SBT + 'mask-tube.png', true), backgroundImage: `url(${SBT}flow.png)` }} />
      <PixelBand src={SBT + 'tile-front.png'} />
      <PixelPiece src={SBT + 'pump.png'} w={SBT_PUMP_W} />
      <div className="sbt-sicht" style={{ left: ppArtX(21, SBT_PUMP_W), top: ppArt(37) }}>
        <i className="sbt-sicht-blut" />
      </div>
      <i className="sbt-strahl" style={{ left: ppArtX(23, SBT_PUMP_W), top: ppArt(10) }} />
      <i className="sbt-zeiger" style={{ left: ppArtX(14, SBT_PUMP_W), top: ppArt(37) }} />
      <i className="sbt-rad" style={{ left: ppArtX(30, SBT_PUMP_W), top: ppArt(38) }} />
      <i className="sbt-kolben" style={{ left: ppArtX(32, SBT_PUMP_W), top: ppArt(14) }} />
      {drips.map((d, i) => (
        <i key={'d' + i} className="pp-area-dyn pp-px-tropfen" style={{
          left: ppArtX(d.x, 0), top: ppArt(48), '--fall': ppArt(30),
          '--tropfen': '#88070a', '--tropfen-dunkel': '#5f0706',
          animation: `ppPxTropfen ${d.dur}s ease-in ${d.delay}s infinite`,
        }} />
      ))}
      <div className="sbt-dim" />
      <style>{`
        .sbt-blut {
          position: absolute; left: 0; right: 0; top: 0; height: 100%;
          background-repeat: repeat-x; background-size: auto 300%; background-position: 50% 0%;
          animation: sbtWelle .6s steps(1) infinite, sbtSpiegel ${SBT_LEVEL_S}s ease-in-out infinite alternate;
        }
        @keyframes sbtWelle {
          0% { background-position: 50% 0%; } 33.3% { background-position: 50% 50%; } 66.6% { background-position: 50% 100%; }
        }
        @keyframes sbtSpiegel { from { transform: translateY(calc(-2 * var(--px))); } to { transform: translateY(calc(2 * var(--px))); } }
        .sbt-blase { position: absolute; width: var(--px); height: var(--px); background: #c4686a; opacity: 0; }
        @keyframes sbtBlase {
          0% { transform: translate(0, 0); opacity: 0; }
          10% { opacity: .9; }
          50% { transform: translate(var(--px), calc(-11 * var(--px))); }
          88% { opacity: .9; }
          100% { transform: translate(0, calc(-22 * var(--px))); opacity: 0; }
        }
        .sbt-fluss {
          position: absolute; inset: 0; background-repeat: repeat-x; background-size: auto 100%;
          animation: sbtFlussL ${SBT_PULS_S}s steps(8) infinite;
        }
        .sbt-fluss.links { clip-path: inset(0 50% 0 0); }
        .sbt-fluss.rechts { clip-path: inset(0 0 0 50%); animation-name: sbtFlussR; }
        @keyframes sbtFlussL { from { background-position: 0 0; } to { background-position: calc(-8 * var(--px)) 0; } }
        @keyframes sbtFlussR { from { background-position: 0 0; } to { background-position: calc(8 * var(--px)) 0; } }
        .sbt-sicht { position: absolute; width: calc(6 * var(--px)); height: calc(26 * var(--px)); overflow: hidden; }
        .sbt-sicht-blut {
          position: absolute; left: 0; right: 0; top: calc(9 * var(--px)); height: calc(30 * var(--px));
          background: linear-gradient(180deg, #aa4c4e 0, #aa4c4e var(--px), #85292c var(--px), #85292c calc(12 * var(--px)), #5f0706 calc(12 * var(--px)));
          animation: sbtSpiegel ${SBT_LEVEL_S}s ease-in-out infinite alternate;
        }
        .sbt-strahl {
          position: absolute; width: calc(2 * var(--px)); height: calc(13 * var(--px));
          background: url(${SBT}stream.png) 0 0 / 100% calc(8 * var(--px)) repeat-y;
          animation: sbtStrahl .5s steps(8) infinite;
        }
        @keyframes sbtStrahl { from { background-position: 0 0; } to { background-position: 0 calc(8 * var(--px)); } }
        .sbt-zeiger {
          position: absolute; width: var(--px); height: calc(3 * var(--px)); background: #b01e18;
          transform-origin: 50% 100%; animation: sbtZeiger 2.3s steps(1) infinite;
        }
        @keyframes sbtZeiger {
          0% { rotate: 30deg; } 12% { rotate: 40deg; } 20% { rotate: 25deg; } 41% { rotate: 50deg; }
          47% { rotate: 58deg; } 55% { rotate: 42deg; } 74% { rotate: 34deg; } 88% { rotate: 52deg; }
        }
        .sbt-rad {
          position: absolute; width: calc(5 * var(--px)); height: calc(5 * var(--px));
          background: url(${SBT}wheel.png) 0 0 / 200% 100% no-repeat;
          animation: sbtRad 1.6s steps(1) infinite;
        }
        @keyframes sbtRad { 0% { background-position: 0 0; } 50% { background-position: 100% 0; } }
        .sbt-kolben {
          position: absolute; width: calc(2 * var(--px)); height: calc(14 * var(--px));
          background: url(${SBT}piston.png) 0 0 / 100% 100% no-repeat;
          animation: sbtKolben ${SBT_PULS_S}s steps(1) infinite;
        }
        @keyframes sbtKolben {
          0% { transform: translateY(0); } 25% { transform: translateY(calc(-2 * var(--px))); }
          50% { transform: translateY(calc(-4 * var(--px))); } 75% { transform: translateY(calc(-2 * var(--px))); }
        }
        .sbt-dim {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,.32) 100%);
        }
      `}</style>
    </PixelScene>
  );
});


// ═══════════════════════════════════════════════════════════════════
//  ACID RAIN — Burghof im Saeureregen (v1412, Kartenstil v1413)
//
//  Vorlage: das Kartenmotiv (warme Ziegelmauer, gemeisselte Steinbloecke,
//  blauer Wassergraben, Pflasterplatz, dunkelroter Regen). „Saeure wird
//  in diesem Spiel als dunkelrot dargestellt" (Al 25.9.).
//  STIL (Al 25.9., nach den ersten drei Szenen): die Hintergruende sollen
//  wie Als eigene Kartenmotive aussehen, nicht wie „gemalte" Szenen —
//  grobe Pixel (Kunsthoehe 100 statt 200), Flaechen als unregelmaessiges
//  Pixelrauschen statt geordnetem Dithering, schwarze Fugen und Konturen,
//  satte Farben, weiche Leuchtflecken, nur leichte Randabdunklung.
//
//  Ebenen (Kunsthoehe 100): tile.png (Kachel 64: Ziegelmauer mit
//  Waechterblock, Graben), plaza.png (200, mittig, Pfuetzen), gate.png
//  (44, mittig), haze.png (roter Dunst), rain-far/-near.png (Kacheln
//  32×32), splash.png (4 Bilder), steam.png (3 Bilder), bolt.png.
//
//  Tier `opaque` (vorher `partial`): Al 25.9., die Area soll ein
//  kompletter Hintergrund werden.
// ═══════════════════════════════════════════════════════════════════
const AR = '/areas/acid-rain/';
const AR_PLAZA_W = 200;
// Saeurepfuetzen auf dem Platz (Platz-Koordinaten, aus dem Generator) — dort dampft es
const AR_PFUETZEN = [[95, 64], [112, 76], [76, 86], [130, 92], [100, 95]];

const AcidRainOverlay = React.memo(function AcidRainOverlay() {
  const splashes = useMemo(() => Array.from({ length: ppFxN(22) }, () => ({
    x: Math.random() * 100,                        // % der Brettbreite
    y: 54 + Math.random() * 44,                    // Kunstpixel (Graben/Platz)
    dur: 0.9 + Math.random() * 1.4,
    delay: -Math.random() * 2.3,
  })), []);
  const steams = useMemo(() => AR_PFUETZEN.slice(0, ppFxN(5)).map(([x, y]) => ({
    x, y, dur: 2.4 + Math.random() * 1.8, delay: -Math.random() * 4,
  })), []);
  return (
    <PixelScene artH={100} bg="#2a1414" className="acid-rain-overlay">
      <PixelBand src={AR + 'tile.png'} />
      <PixelPiece src={AR + 'plaza.png'} w={AR_PLAZA_W} />
      <PixelPiece src={AR + 'gate.png'} w={44} />
      {steams.map((d, i) => (
        <i key={'st' + i} className="pp-area-dyn ar-dampf" style={{
          left: ppArtX(d.x - 2, AR_PLAZA_W), top: ppArt(d.y - 6),
          animation: `arDampfBild .45s steps(1) infinite, arDampf ${d.dur}s ease-out ${d.delay}s infinite`,
        }} />
      ))}
      <div className="pp-pixel-layer ar-dunst" />
      <div className="pp-pixel-layer ar-regen fern" />
      {splashes.map((s, i) => (
        <i key={'sp' + i} className="pp-area-dyn ar-spritzer" style={{
          left: s.x + '%', top: ppArt(s.y - 2),
          animation: `arSpritzer ${s.dur}s steps(1) ${s.delay}s infinite`,
        }} />
      ))}
      <div className="pp-pixel-layer ar-regen nah" />
      <i className="pp-area-dyn ar-blitz" style={{ left: '27%', top: 0 }} />
      <div className="pp-area-dyn ar-blitzlicht" />
      <div className="ar-dim" />
      <style>{`
        .ar-dunst {
          position: absolute; left: 0; right: 0; top: calc(30 * var(--px)); height: calc(20 * var(--px));
          background: url(${AR}haze.png) 0 0 / auto 100% repeat-x; opacity: .8;
          animation: arDunst 60s linear infinite;
        }
        @keyframes arDunst { from { background-position: 0 0; } to { background-position: calc(-64 * var(--px)) 0; } }
        .ar-regen {
          position: absolute; inset: 0;
          background-size: calc(32 * var(--px)) calc(32 * var(--px)); background-repeat: repeat;
        }
        .ar-regen.fern { background-image: url(${AR}rain-far.png); animation: arRegen .6s linear infinite; }
        .ar-regen.nah  { background-image: url(${AR}rain-near.png); animation: arRegen .34s linear infinite; }
        @keyframes arRegen { from { background-position: 0 0; } to { background-position: 0 calc(32 * var(--px)); } }
        .ar-spritzer {
          position: absolute; width: calc(4 * var(--px)); height: calc(3 * var(--px));
          background: url(${AR}splash.png) 0 0 / 400% 100% no-repeat; opacity: 0;
        }
        @keyframes arSpritzer {
          0%   { opacity: 1; background-position: 0 0; }
          8%   { background-position: 33.33% 0; }
          16%  { background-position: 66.66% 0; }
          26%  { background-position: 100% 0; }
          36%, 100% { opacity: 0; }
        }
        .ar-dampf {
          position: absolute; width: calc(4 * var(--px)); height: calc(6 * var(--px));
          background: url(${AR}steam.png) 0 0 / 300% 100% no-repeat; opacity: 0;
        }
        @keyframes arDampfBild { 0% { background-position: 0 0; } 33.3% { background-position: 50% 0; } 66.6% { background-position: 100% 0; } }
        @keyframes arDampf {
          0% { opacity: 0; transform: translateY(0); }
          20% { opacity: .9; }
          100% { opacity: 0; transform: translateY(calc(-5 * var(--px))); }
        }
        .ar-blitz {
          position: absolute; width: calc(9 * var(--px)); height: calc(18 * var(--px));
          background: url(${AR}bolt.png) 0 0 / 100% 100% no-repeat; opacity: 0;
          animation: arBlitz 13s steps(1) infinite;
        }
        .ar-blitzlicht {
          position: absolute; inset: 0; background: #ff5a4a; mix-blend-mode: soft-light; opacity: 0;
          animation: arBlitz 13s steps(1) infinite;
        }
        /* Telefon-Lite: das bildschirmweite Mischebenen-Licht kostet dort Bildrate */
        @media (pointer: coarse) and (max-height: 600px) { .ar-blitzlicht { display: none; } }
        @keyframes arBlitz {
          0%, 91% { opacity: 0; } 92% { opacity: .55; } 93% { opacity: 0; } 94.5% { opacity: .4; } 95.5%, 100% { opacity: 0; }
        }
        .ar-dim {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,.32) 100%);
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

// ── COTTAGE AT THE FOREST'S EDGE ────────────────────────────────────
//  Karte: Blockhuette mit Tuer, Fenstern, Efeu, Pfad, Wegweiser, Zaun.
//  Ruhig (Als frueherer Wunsch): wiegende Efeublaetter, Schmetterlinge,
//  einzelne fallende Blaetter.
//  v1437 (Al 25.9.: „Detailgrad deutlich zu klein"): Kachel 128 breit.
//  Dachtraufe mit Naegeln, Blockbohlen unterschiedlich lang mit Licht-
//  kante, Maserung und Aesten, zwei Fenster mit Sprossen, Vorhaengen und
//  warmem Innenlicht (eines mit Blumenkasten, eines mit gruenen Laeden),
//  Kraeuterbuendel, Hufeisen, Steinsockel, Wiese mit Bueschen, Wildblumen,
//  Steinen, Pilzen und Farnen, Efeuranken mit groesseren Blaettern. Mitte:
//  Tuer mit Beschlaegen, Guckfenster und Sturz, Stufe, Fussmatte,
//  Laterne, Schild mit Schnitzzeilen, Holzstapel, Hackklotz mit Axt,
//  Zaun, Pfad mit Trittsteinen. Animiert zusaetzlich: Gras im Wind,
//  Laterne und Fensterlicht flackern, ein Rotkehlchen auf dem Schild.
//  Licht IMMER oben rechts.
const COT = '/areas/cottage/';
const CottageOverlay = React.memo(function CottageOverlay() {
  const falter = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    y: 34 + Math.random() * 50, dur: 22 + Math.random() * 14, delay: -Math.random() * 30,
    bob: 2 + Math.random() * 3, rtl: i % 2 === 1,
  })), []);
  const blaetter = useMemo(() => ppZufall(ppFxN(5), () => ({
    x: Math.random() * 100, dur: 8 + Math.random() * 6, delay: -Math.random() * 12,
  })), []);
  return (
    <PixelScene artH={100} bg="#3a2a14" className="cottage-overlay">
      <PixelBand src={COT + 'tile.png'} />
      <PixelBand src={COT + 'window-glow.png'} className="cot-licht" />
      <PixelBand src={COT + 'grass-wind.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 2.1s steps(1) infinite' }} />
      <PixelBand src={COT + 'leaves.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 2.4s steps(1) infinite' }} />
      <PixelPiece src={COT + 'front.png'} w={140} />
      <PixelPiece src={COT + 'lantern-glow.png'} w={140} className="cot-laterne" />
      <i className="cot-vogel" style={{ left: ppArtX(26, 0), top: ppArt(33) }} />
      {blaetter.map((b, i) => (
        <i key={'l' + i} className="pp-area-dyn cot-blatt" style={{ left: b.x + '%', animation: `cotFall ${b.dur}s linear ${b.delay}s infinite, ppSprite3 .9s steps(1) infinite` }} />
      ))}
      {falter.map((f, i) => (
        <div key={'f' + i} className="pp-area-dyn pp-quer" style={ppQuer(f.y, f.dur, f.delay, f.rtl)}>
          <i className="cot-falter" style={{ '--bob': ppArt(f.bob), transform: f.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .cot-licht { animation: cotLicht 3.1s ease-in-out infinite alternate; }
        @keyframes cotLicht { from { opacity: .6; } to { opacity: 1; } }
        .cot-laterne { animation: cotLaterne 1.7s steps(1) infinite; }
        @keyframes cotLaterne { 0% { opacity: 1; } 23% { opacity: .75; } 27% { opacity: 1; } 61% { opacity: .85; } 64% { opacity: .65; } 68% { opacity: 1; } }
        .cot-vogel { position: absolute; width: calc(7 * var(--px)); height: calc(6 * var(--px)); background: url(${COT}bird.png) 0 0 / 300% 100% no-repeat; animation: cotVogel 4.2s steps(1) infinite; }
        @keyframes cotVogel { 0%, 50% { background-position: 0 0; } 54%, 58% { background-position: 50% 0; } 62%, 66% { background-position: 0 0; } 70%, 74% { background-position: 50% 0; } 78%, 90% { background-position: 100% 0; } 94%, 100% { background-position: 0 0; } }
        .cot-falter {
          display: block; width: calc(5 * var(--px)); height: calc(4 * var(--px));
          background: url(${COT}butterfly.png) 0 0 / 200% 100% no-repeat;
          animation: ppSprite2 .26s steps(1) infinite, ppBob 1.3s ease-in-out infinite alternate;
        }
        .cot-blatt {
          position: absolute; top: 0; width: calc(2 * var(--px)); height: calc(2 * var(--px));
          background: url(${COT}leaf.png) 0 0 / 300% 100% no-repeat; opacity: 0;
        }
        @keyframes cotFall {
          0% { transform: translate(0, 0); opacity: 0; } 8% { opacity: 1; }
          25% { transform: translate(calc(4 * var(--px)), calc(18 * var(--px))); }
          50% { transform: translate(calc(-2 * var(--px)), calc(40 * var(--px))); }
          75% { transform: translate(calc(3 * var(--px)), calc(62 * var(--px))); }
          92% { opacity: 1; } 100% { transform: translate(0, calc(80 * var(--px))); opacity: 0; }
        }
      `}</style>
    </PixelScene>
  );
});

// ── CRYSTAL WELL ─────────────────────────────────────────────────────
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
const CWL = '/areas/crystal-well/';
const CWL_W = 150;                          // Brunnen-Stueck; Rand-Mitte (75, 44), Wasser (75, 57)
const CrystalWellOverlay = React.memo(function CrystalWellOverlay() {
  const funken = useMemo(() => ppZufall(ppFxN(18), (i) => {
    const a = Math.random() * Math.PI * 2;
    if (i < 9) return { x: Math.cos(a) * 56, y: 44 + Math.sin(a) * 19, dur: 1.6 + Math.random() * 1.8, delay: -Math.random() * 3 };
    if (i < 14) return { x: (Math.random() - .5) * 64, y: 54 + Math.random() * 8, dur: 1.4 + Math.random() * 1.6, delay: -Math.random() * 3 };
    return { x: (Math.random() - .5) * 240, y: 30 + Math.random() * 66, dur: 2 + Math.random() * 2, delay: -Math.random() * 4 };
  }), []);
  const ringe = useMemo(() => ppZufall(ppFxN(3), () => ({
    x: (Math.random() - .5) * 46, y: 55 + Math.random() * 6, dur: 3 + Math.random() * 2, delay: -Math.random() * 5,
  })), []);
  return (
    <PixelScene artH={100} bg="#1f6ef0" className="crystal-well-overlay">
      <PixelBand src={CWL + 'tile.png'} />
      <PixelBand src={CWL + 'grass-wind.png'} style={{ backgroundSize: 'auto 200%', animation: 'ppBand2 1.6s steps(1) infinite' }} />
      <PixelPiece src={CWL + 'well-shadow.png'} w={CWL_W} />
      <PixelPiece src={CWL + 'well-water.png'} w={CWL_W} style={{ backgroundSize: '100% 300%', animation: 'ppBand3 .9s steps(1) infinite' }} />
      {ringe.map((r, i) => (
        <i key={'r' + i} className="pp-area-dyn cwl-ring" style={{ left: ppArtX(r.x - 8, 0), top: ppArt(r.y - 3), animation: `cwlRing ${r.dur}s ease-out ${r.delay}s infinite` }} />
      ))}
      <PixelPiece src={CWL + 'well.png'} w={CWL_W} />
      {funken.map((f, i) => (
        <i key={i} className="pp-area-dyn pp-px-funkeln" style={{ left: ppArtX(f.x - 1, 0), top: ppArt(f.y - 1), animation: `ppFunkeln ${f.dur}s steps(1) ${f.delay}s infinite` }} />
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .cwl-ring {
          position: absolute; width: calc(16 * var(--px)); height: calc(6 * var(--px));
          border: var(--px) solid rgba(150, 205, 255, .85); border-radius: 50%; opacity: 0;
        }
        @keyframes cwlRing { 0% { transform: scale(.2); opacity: 0; } 15% { opacity: .9; } 100% { transform: scale(1.6); opacity: 0; } }
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

// ── DEEPSEA CASTLE ───────────────────────────────────────────────────
//  Karte: tuerkisfarbene Burg mit violetten Spitzdaechern unter einem
//  fahlen Lichtstrahl, lavendelfarbenes Wasser. Tiefsee: Blasen steigen,
//  Schwebeteilchen sinken, Fische ziehen vorbei, Seegras wiegt.
//  Neubau v1419 (Al 25.9.: „mehr Detail und mehr Shading"): Tuerme als
//  schattierte Zylinder mit Ziegelreihen, Kegeldaecher mit Schindeln und
//  Spitzkugel, Spitzbogenfenster mit hellem Rahmen, Gesimse und Zinnen,
//  Algen, Korallen, Seepocken. Licht IMMER von oben rechts. Die Fenster
//  glimmen unten tuerkis (eigene Ebene, atmet).
const DSC = '/areas/deepsea-castle/';
const DeepseaCastleOverlay = React.memo(function DeepseaCastleOverlay() {
  const blasen = useMemo(() => ppZufall(ppFxN(14), () => ({
    x: Math.random() * 100, dur: 5 + Math.random() * 5, delay: -Math.random() * 10, gross: Math.random() < .3,
  })), []);
  const schnee = useMemo(() => ppZufall(ppFxN(16), () => ({
    x: Math.random() * 100, dur: 14 + Math.random() * 10, delay: -Math.random() * 24,
  })), []);
  const fische = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    y: 30 + Math.random() * 45, dur: 20 + Math.random() * 14, delay: -Math.random() * 30, rtl: i % 2 === 0,
  })), []);
  return (
    <PixelScene artH={100} bg="linear-gradient(180deg, #e3cefd 0%, #c1b3e5 30%, #9e9dc7 62%, #74739f 100%)" className="deepsea-castle-overlay">
      <PixelBand src={DSC + 'tile.png'} />
      <PixelPiece src={DSC + 'beam.png'} w={40} className="dsc-strahl" />
      {fische.map((f, i) => (
        <div key={'fi' + i} className="pp-area-dyn pp-quer" style={ppQuer(f.y, f.dur, f.delay, f.rtl)}>
          <i className="dsc-fisch" style={{ transform: f.rtl ? 'scaleX(-1)' : undefined }} />
        </div>
      ))}
      <PixelPiece src={DSC + 'castle.png'} w={128} />
      <PixelPiece src={DSC + 'castle-glow.png'} w={128} className="dsc-fenster" />
      <PixelBand src={DSC + 'seaweed.png'} style={{ backgroundSize: 'auto 200%', animation: 'ppBand2 1.4s steps(1) infinite' }} />
      {schnee.map((s, i) => (
        <i key={'s' + i} className="pp-area-dyn dsc-schnee" style={{ left: s.x + '%', animation: `dscSinken ${s.dur}s linear ${s.delay}s infinite` }} />
      ))}
      {blasen.map((b, i) => (
        <i key={'b' + i} className={'pp-area-dyn dsc-blase' + (b.gross ? ' gross' : '')} style={{ left: b.x + '%', animation: `dscSteigen ${b.dur}s linear ${b.delay}s infinite` }} />
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .dsc-strahl { animation: dscStrahl 4.2s ease-in-out infinite alternate; }
        @keyframes dscStrahl { from { opacity: .65; } to { opacity: 1; } }
        .dsc-fenster { animation: dscFenster 3.6s ease-in-out infinite alternate; }
        @keyframes dscFenster { from { opacity: .45; } to { opacity: 1; } }
        .dsc-fisch { display: block; width: calc(7 * var(--px)); height: calc(4 * var(--px)); background: url(${DSC}fish.png) 0 0 / 200% 100% no-repeat; animation: ppSprite2 .5s steps(1) infinite; }
        .dsc-schnee { position: absolute; top: 0; width: var(--px); height: var(--px); background: #efe6ff; opacity: .7; }
        @keyframes dscSinken { from { transform: translate(0, 0); } 50% { transform: translate(calc(3 * var(--px)), calc(50 * var(--px))); } to { transform: translate(0, calc(100 * var(--px))); } }
        .dsc-blase { position: absolute; top: calc(96 * var(--px)); width: var(--px); height: var(--px); border: 0; background: #f4eeff; opacity: 0; }
        .dsc-blase.gross { width: calc(2 * var(--px)); height: calc(2 * var(--px)); background: transparent; box-shadow: inset 0 0 0 var(--px) #f4eeff; }
        @keyframes dscSteigen {
          0% { transform: translate(0, 0); opacity: 0; } 8% { opacity: .9; }
          50% { transform: translate(calc(2 * var(--px)), calc(-48 * var(--px))); }
          100% { transform: translate(0, calc(-98 * var(--px))); opacity: .2; }
        }
      `}</style>
    </PixelScene>
  );
});

// ── DOOM CLOCK ───────────────────────────────────────────────────────
//  Karte: grosse dunkelrote Uhr mit Spirale und Totenschaedeln an den
//  Viertelmarken. Als Vorgabe (5.8.): „aehnlich Big Gwen, aber
//  bedrohlicher", Sekunden TICKEN (60 harte Schritte, echte Uhrzeit).
//  v1420 (Al 25.9.): Himmel in dunklem, GEFAEHRLICHEM Rot. Stunden- und
//  Minutenzeiger zeigen die DOOM COUNTER: 0 = 11 Uhr, 20 = 12 Uhr,
//  dazwischen fliessend (Minutenzeiger eine Umdrehung, Stundenzeiger
//  von der 11 zur 12). Liegen zwei Doom Clocks, zaehlt die, die dem
//  Ende naeher ist. Je naeher Mitternacht, desto schneller und heller
//  pocht der rote Schein hinter der Uhr.
const DCL = '/areas/doom-clock/';
const DC_MITTE_Y = 49.5;
const DC_MAX = 20;
const DoomClockOverlay = React.memo(function DoomClockOverlay({ besitzer = [], spielstand = {} }) {
  const zaehler = Math.max(0, ...besitzer.map(i => spielstand.doomCounters?.[i] || 0));
  const t = Math.min(1, zaehler / DC_MAX);
  const winkelMin = 360 * t;               // 0 → :00, 20 → einmal herum
  const winkelStd = 330 + 30 * t;          // 11 Uhr → 12 Uhr
  const sek = useMemo(() => -new Date().getSeconds(), []);
  const asche = useMemo(() => ppZufall(ppFxN(18), () => ({
    x: Math.random() * 100, dur: 6 + Math.random() * 6, delay: -Math.random() * 12, glut: Math.random() < .5,
  })), []);
  const zeiger = (cls, L, w, stil) => (
    <i className={'dc-zeiger ' + cls} style={{
      left: `calc(50% - ${(w + 2) / 2} * var(--px))`, top: ppArt(DC_MITTE_Y - L + 1),
      width: ppArt(w + 2), height: ppArt(L), ...stil,
    }} />
  );
  return (
    <PixelScene artH={100} bg="radial-gradient(ellipse 70% 85% at 50% 52%, #7a0c10 0%, #520709 32%, #2c0405 62%, #140102 100%)" className="doom-clock-overlay">
      <div className="pp-pixel-layer dc-rauch" />
      <div className="pp-pixel-layer dc-wolken" />
      <i className="dc-puls" style={{ '--dc-t': t, animationDuration: (3.2 - 2.4 * t).toFixed(2) + 's' }} />
      <PixelPiece src={DCL + 'clock.png'} w={90} style={{ top: ppArt(5), bottom: 'auto', height: ppArt(90) }} />
      {[[0, -30], [30, 0], [0, 30], [-30, 0]].map(([dx, dy], i) => (
        <i key={'g' + i} className="pp-area-dyn dc-glut" style={{ left: ppArtX(dx - 4, 0), top: ppArt(DC_MITTE_Y + dy - 4), animationDelay: (-i * .7) + 's' }} />
      ))}
      {zeiger('std', 19, 3, { rotate: winkelStd + 'deg' })}
      {zeiger('min', 28, 3, { rotate: winkelMin + 'deg' })}
      {zeiger('sek', 33, 1, { animation: `ppDrehen 60s steps(60) ${sek}s infinite` })}
      <i className="dc-kappe" style={{ left: ppArtX(-3.5, 0), top: ppArt(DC_MITTE_Y - 3.5) }} />
      {asche.map((a, i) => (
        <i key={'a' + i} className={'pp-area-dyn dc-asche' + (a.glut ? ' glut' : '')} style={{ left: a.x + '%', animation: `dcAsche ${a.dur}s linear ${a.delay}s infinite` }} />
      ))}
      <div className="dc-dim" />
      <style>{`
        .dc-rauch {
          position: absolute; left: 0; right: 0; top: 0; height: calc(40 * var(--px));
          background: url(${DCL}smoke.png) 0 0 / auto 100% repeat-x; animation: dcWolken 110s linear infinite reverse;
        }
        .dc-wolken {
          position: absolute; left: 0; right: 0; top: calc(64 * var(--px)); height: calc(30 * var(--px));
          background: url(${DCL}clouds.png) 0 0 / auto 100% repeat-x; animation: dcWolken 80s linear infinite;
        }
        @keyframes dcWolken { from { background-position: 0 0; } to { background-position: calc(128 * var(--px)) 0; } }
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
        .dc-zeiger { position: absolute; transform-origin: 50% 100%; background-size: 100% 100%; background-repeat: no-repeat; transition: rotate 1.4s cubic-bezier(.5, 0, .2, 1); }
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
        .dc-asche { position: absolute; top: calc(98 * var(--px)); width: var(--px); height: var(--px); background: #3a0a0a; opacity: 0; }
        .dc-asche.glut { background: #ff5a2a; }
        @keyframes dcAsche { 0% { transform: translate(0,0); opacity: 0; } 15% { opacity: .9; } 100% { transform: translate(calc(4 * var(--px)), calc(-64 * var(--px))); opacity: 0; } }
        .dc-dim { position: absolute; inset: 0; background: radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,.45) 100%); }
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

// ── PARASEED GREENHOUSE ──────────────────────────────────────────────
//  Karte: Gewaechshaus mit grauen, diagonal gestreiften Glasscheiben, ein
//  Pflanztrog voll wucherndem Fleisch mit grellbunten Blueten. Als
//  frueherer Wunsch (5.9.): „grellbunte Blumen, die ungesund und abartig
//  wirken".
//  v1428 (Al 25.9.): Schattengestalten raus, dafuer mehr Detail: Stahl-
//  rahmen mit Nieten und Dachrinne, Scheiben mit trueben Pflanzen
//  dahinter, Kondenstropfen und einem Sprung, Kletterranken mit
//  Saugnaepfen, Fleischerde mit Adern, pochenden Pusteln und Knochen-
//  splittern, Trogfront mit Rippen, Rost und Schildchen.
//  v1429 (Al 25.9.: „die Pflanze mit dem Auge passt gar nicht", Pflanzen
//  brauchen mehr Detail): grosse Bluetenkoepfe mit einzelnen Blaettern
//  (Tulpe, Glocke mit Staubgefaessen, Stachelbluete mit Samenkern), breite
//  Blaetter mit Mittelrippe, Stiele mit Knoten und Dornen. In der Mitte
//  statt der Augenbluete ein wucherndes Samengewaechs: klumpige, geaederte
//  Fleischkapsel, aufgeplatzt, Samen gluehen giftgruen durch, Ranken an
//  der Spitze, Schleim tropft. Licht IMMER oben rechts. Animiert: Blueten
//  wiegen einzeln und versetzt (8 Bilder, v1430), Pusteln pochen, Samen gluehen, Schleim tropft, Tropfen laufen
//  am Glas herab, Sporen steigen.
const PSG = '/areas/paraseed-greenhouse/';
// Scheiben der Kachel (x-Bereiche), in denen Tropfen laufen duerfen.
const PSG_SCHEIBEN = [[3, 29], [35, 61]];
// v1430 (Al 25.9.: „die Pflanzen bewegen sich alle perfekt im Takt",
// mehr als zwei Bilder): jede Blume ist ein EIGENES Element mit eigenem
// Bildband (8 Bilder: Mitte → rechts → Mitte → links, Stiel biegt sich
// von unten nach oben) und eigener, zufaelliger Dauer und Phase.
// Plaetze je 64er-Kachel wie im Generator; Fuss bei Kunst-y 69.
const PSG_PFLANZEN_X = [8, 24, 40, 55];
const PSG_PFLANZE = { w: 28, h: 34, fussX: 13, top: 37, bilder: 8 };
const ParaseedGreenhouseOverlay = React.memo(function ParaseedGreenhouseOverlay() {
  const sporen = useMemo(() => ppZufall(ppFxN(14), () => ({
    x: Math.random() * 100, dur: 6 + Math.random() * 5, delay: -Math.random() * 10, farbe: Math.random() < .5 ? '#c9ff2f' : '#ff6ad5',
  })), []);
  const pflanzen = useMemo(() => {
    const out = [];
    for (let k = -4; k <= 4; k++) {
      PSG_PFLANZEN_X.forEach((px, art) => out.push({
        x: px - 32 + k * 64, art,
        dur: 2.2 + Math.random() * 1.6, delay: -Math.random() * 4,
      }));
    }
    return out;
  }, []);
  const tropfen = useMemo(() => ppZufall(ppFxN(6), () => {
    const [a, e] = PSG_SCHEIBEN[Math.floor(Math.random() * 2)];
    const k = Math.floor(Math.random() * 7) - 3;
    return { x: a + Math.random() * (e - a) - 32 + k * 64, y: 5 + Math.random() * 20, dur: 5 + Math.random() * 6, delay: -Math.random() * 11 };
  }), []);
  return (
    <PixelScene artH={100} bg="#7c807a" className="paraseed-greenhouse-overlay">
      <PixelBand src={PSG + 'tile.png'} />
      <PixelBand src={PSG + 'tile-glow.png'} className="psg-pochen" />
      <PixelBand src={PSG + 'glass.png'} />
      {tropfen.map((t, i) => (
        <i key={'t' + i} className="pp-area-dyn psg-tropfen" style={{ left: ppArtX(t.x, 0), top: ppArt(t.y), animation: `psgTropfen ${t.dur}s ease-in ${t.delay}s infinite` }} />
      ))}
      {pflanzen.map((p, i) => (
        <i key={'p' + i} className="psg-pflanze" style={{
          left: ppArtX(p.x - PSG_PFLANZE.fussX, 0), top: ppArt(PSG_PFLANZE.top),
          backgroundImage: `url(${PSG}plant-${p.art}.png)`,
          animation: `psgWiegen ${p.dur.toFixed(2)}s steps(${PSG_PFLANZE.bilder}) ${p.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      <PixelPiece src={PSG + 'pod.png'} w={40} />
      <PixelPiece src={PSG + 'pod-glow.png'} w={40} className="psg-samen" />
      <i className="pp-area-dyn pp-px-tropfen" style={{
        left: ppArtX(3, 0), top: ppArt(38), '--fall': ppArt(25),
        '--tropfen': '#b6f25a', '--tropfen-dunkel': '#5c8a1c',
        animation: 'ppPxTropfen 4.6s ease-in -1.2s infinite',
      }} />
      {sporen.map((s, i) => (
        <i key={'s' + i} className="pp-area-dyn psg-spore" style={{ left: s.x + '%', background: s.farbe, animation: `psgSpore ${s.dur}s linear ${s.delay}s infinite` }} />
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .psg-pflanze {
          position: absolute; width: calc(${PSG_PFLANZE.w} * var(--px)); height: calc(${PSG_PFLANZE.h} * var(--px));
          background-size: ${PSG_PFLANZE.bilder * 100}% 100%; background-repeat: no-repeat; background-position: 0 0;
        }
        @keyframes psgWiegen { from { background-position: 0 0; } to { background-position: calc(-${PSG_PFLANZE.w * PSG_PFLANZE.bilder} * var(--px)) 0; } }
        .psg-pochen { animation: psgPochen 1.9s ease-in-out infinite; }
        @keyframes psgPochen { 0%, 100% { opacity: .35; } 18% { opacity: 1; } 32% { opacity: .55; } 44% { opacity: .9; } }
        .psg-tropfen {
          position: absolute; width: calc(2 * var(--px)); height: calc(3 * var(--px));
          background: url(${PSG}drop.png) 0 0 / 100% 100% no-repeat; opacity: 0;
        }
        @keyframes psgTropfen {
          0% { transform: translateY(0); opacity: 0; } 8% { opacity: 1; }
          40% { transform: translateY(calc(6 * var(--px))); }
          55% { transform: translateY(calc(8 * var(--px))); }
          92% { opacity: 1; } 100% { transform: translateY(calc(34 * var(--px))); opacity: 0; }
        }
        .psg-samen { animation: psgSamen 2.6s ease-in-out infinite alternate; }
        @keyframes psgSamen { from { opacity: .35; } to { opacity: 1; } }
        .psg-spore { position: absolute; top: calc(66 * var(--px)); width: var(--px); height: var(--px); opacity: 0; }
        @keyframes psgSpore { 0% { transform: translate(0,0); opacity: 0; } 15% { opacity: .9; } 50% { transform: translate(calc(3 * var(--px)), calc(-30 * var(--px))); } 100% { transform: translate(calc(-2 * var(--px)), calc(-62 * var(--px))); opacity: 0; } }
      `}</style>
    </PixelScene>
  );
});

// ── RIOTING VILLAGE ──────────────────────────────────────────────────
//  Neubau v1431 (Al 25.9.): Das rote Auge ist NICHT an die Wand gemalt —
//  es gehoert einer Schattengestalt, die aus einem Eingang schaut. Die
//  Mauern haben Risse, Scherben und Truemmer liegen herum, es brennt.
//  Kachel: Bruchsteinmauer mit Rissen und Loechern, ein zerbrochenes und
//  ein brennendes Fenster (Russ darueber), Schutt, Planken, Scherben,
//  Trampelpfad, ein verkohlter Truemmerhaufen. Mitte: Steinbogen-Eingang,
//  der Tuerfluegel aus der Angel gerissen, darin die Kapuzengestalt mit
//  Feuerschein-Kante; ihr Auge schaut umher und blinzelt. Brandherde
//  lodern (eigene Flammenbilder), Rauch und Funken steigen, der
//  Feuerschein flackert. Licht IMMER oben rechts.
//  v1432 (Al 25.9.: „die Fenster haben nur 2 Modi, die Feuer am Boden
//  sind perfekt gleichmaessig"): Kachel 192 breit (drei Hausabschnitte,
//  leicht verschiedene Steintoene) mit sechs Fensterzustaenden —
//  zerbrochen, brennend, vernagelt, heil und dunkel, Fensterladen
//  haengt schief, herausgebrochenes Mauerloch mit Schutt. Truemmer,
//  Planken und Scherben liegen zufaellig. Die Bodenfeuer stehen NICHT
//  mehr in der Kachel: jedes Spiel wuerfelt Anzahl, Lage und Groesse
//  (drei Flammengroessen, jede mit eigenem verkohlten Haufen und Schein).
const RVG = '/areas/rioting-village/';
const RVG_TUER_W = 56;
const RVG_KACHEL = 192;
// brennende Fenster der Kachel: Mitte x (neben Kachelmitte 96), Flammen-Oberkante
const RVG_FENSTERFEUER = [{ x: 33 - 96, y: 16 }, { x: 157.5 - 96, y: 16 }];
const RVG_FEUER = { s: { w: 7, h: 9 }, m: { w: 9, h: 12 }, l: { w: 12, h: 16 } };
const RiotingVillageOverlay = React.memo(function RiotingVillageOverlay() {
  const feuer = useMemo(() => {
    const out = [];
    // Bodenfeuer: zufaellig verteilt, mit Mindestabstand, drei Groessen
    const n = ppFxN(7);
    for (let tries = 0; out.length < n && tries < 200; tries++) {
      const x = (Math.random() - .5) * 280, fuss = 70 + Math.random() * 26;
      if (Math.abs(x) < 16 && fuss < 72) continue;                    // nicht in den Eingang
      if (out.some(f => Math.abs(f.x - x) < 18 && Math.abs(f.fuss - fuss) < 10)) continue;
      const g = ['s', 'm', 'm', 'l'][Math.floor(Math.random() * 4)];
      const { w, h } = RVG_FEUER[g];
      out.push({ art: 'boden', g, x, fuss, y: fuss - h + 1, w, h });
    }
    for (let k = -2; k <= 2; k++) {
      for (const f of RVG_FENSTERFEUER) {
        const x = f.x + k * RVG_KACHEL;
        if (Math.abs(x) > RVG_TUER_W / 2 + 2) out.push({ art: 'fenster', x, y: f.y, w: 7, h: 10 });
      }
    }
    return out.map(f => ({ ...f, dur: .38 + Math.random() * .3, delay: -Math.random() }));
  }, []);
  const rauch = useMemo(() => feuer.filter(f => f.art === 'boden' || Math.random() < .6).slice(0, ppFxN(14)).map(f => ({
    x: f.x, y: f.y, dur: 3.5 + Math.random() * 2.5, delay: -Math.random() * 6,
  })), [feuer]);
  const funken = useMemo(() => ppZufall(ppFxN(18), () => {
    const f = feuer[Math.floor(Math.random() * feuer.length)];
    return { x: f.x + (Math.random() - .5) * 6, y: f.y + 4, dur: 1.6 + Math.random() * 1.6, delay: -Math.random() * 3 };
  }), [feuer]);
  return (
    <PixelScene artH={100} bg="#3a3531" className="rioting-village-overlay">
      <PixelBand src={RVG + 'tile.png'} />
      <PixelBand src={RVG + 'window-glow.png'} className="rvg-schein" />
      {feuer.filter(f => f.art === 'boden').map((f, i) => (
        <React.Fragment key={'b' + i}>
          <i className="rvg-bodenschein" style={{
            left: ppArtX(f.x - f.w * 1.6, 0), top: ppArt(f.fuss - f.w * 1.6), width: ppArt(f.w * 3.2), height: ppArt(f.w * 2.4),
            animationDuration: (0.9 + Math.random() * .6).toFixed(2) + 's', animationDelay: (-Math.random()).toFixed(2) + 's',
          }} />
          <i className="rvg-haufen" style={{
            left: ppArtX(f.x - (f.w + 4) / 2, 0), top: ppArt(f.fuss - Math.max(4, Math.floor((f.w + 4) / 2)) + 2),
            width: ppArt(f.w + 4), height: ppArt(Math.max(4, Math.floor((f.w + 4) / 2))),
            backgroundImage: `url(${RVG}embers-${f.w}.png)`,
          }} />
        </React.Fragment>
      ))}
      <PixelPiece src={RVG + 'doorway.png'} w={RVG_TUER_W} />
      <i className="rvg-augenglut" style={{ left: ppArtX(-8, 0), top: ppArt(26) }} />
      <i className="rvg-auge" style={{ left: ppArtX(-5.5, 0), top: ppArt(29.5) }} />
      {feuer.map((f, i) => (
        <i key={'f' + i} className="rvg-flamme" style={{
          left: ppArtX(f.x - f.w / 2, 0), top: ppArt(f.y), width: ppArt(f.w), height: ppArt(f.h),
          backgroundImage: `url(${RVG}${f.art === 'fenster' ? 'flames-window' : 'flames-' + f.g}.png)`,
          '--rvg-lauf': `calc(${-4 * f.w} * var(--px))`,
          animation: `rvgFlackern ${f.dur.toFixed(2)}s steps(4) ${f.delay.toFixed(2)}s infinite`,
        }} />
      ))}
      {rauch.map((r, i) => (
        <i key={'r' + i} className="pp-area-dyn rvg-rauch" style={{ left: ppArtX(r.x - 3, 0), top: ppArt(r.y - 5), animation: `rvgRauch ${r.dur.toFixed(2)}s ease-out ${r.delay.toFixed(2)}s infinite` }} />
      ))}
      {funken.map((f, i) => (
        <i key={'s' + i} className="pp-area-dyn rvg-funke" style={{ left: ppArtX(f.x, 0), top: ppArt(f.y), animation: `rvgFunke ${f.dur.toFixed(2)}s linear ${f.delay.toFixed(2)}s infinite` }} />
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .rvg-schein { animation: rvgSchein 1.1s steps(1) infinite; }
        @keyframes rvgSchein { 0% { opacity: .85; } 20% { opacity: 1; } 35% { opacity: .7; } 55% { opacity: .95; } 75% { opacity: .78; } }
        .rvg-flamme { position: absolute; background-repeat: no-repeat; background-size: 400% 100%; }
        @keyframes rvgFlackern { from { background-position: 0 0; } to { background-position: var(--rvg-lauf) 0; } }
        .rvg-haufen { position: absolute; background-size: 100% 100%; background-repeat: no-repeat; }
        .rvg-bodenschein {
          position: absolute; border-radius: 50%;
          background: radial-gradient(ellipse, rgba(255,140,40,.45) 0%, rgba(255,90,20,.18) 45%, rgba(255,90,20,0) 70%);
          animation: rvgSchein 1.1s steps(1) infinite;
        }
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
          position: absolute; width: calc(16 * var(--px)); height: calc(11 * var(--px));
          background: radial-gradient(ellipse, rgba(255,30,20,.55) 0%, rgba(255,30,20,0) 70%);
          animation: rvgAugenglut 2.4s ease-in-out infinite alternate;
        }
        @keyframes rvgAugenglut { from { opacity: .45; } to { opacity: 1; } }
        .rvg-rauch { position: absolute; width: calc(6 * var(--px)); height: calc(5 * var(--px)); background: url(${RVG}smoke.png) 0 0 / 100% 100% no-repeat; opacity: 0; }
        @keyframes rvgRauch {
          0% { transform: translate(0, 0) scale(.6); opacity: 0; } 12% { opacity: .85; }
          100% { transform: translate(calc(5 * var(--px)), calc(-30 * var(--px))) scale(1.6); opacity: 0; }
        }
        .rvg-funke { position: absolute; width: var(--px); height: var(--px); background: #ffb040; opacity: 0; }
        @keyframes rvgFunke { 0% { transform: translate(0,0); opacity: 0; } 10% { opacity: 1; } 100% { transform: translate(calc(3 * var(--px)), calc(-24 * var(--px))); opacity: 0; } }
      `}</style>
    </PixelScene>
  );
});

// ── SLIPPERY ICE ─────────────────────────────────────────────────────
//  Karte: lavendelweisse Eisflaeche mit diagonalen Glanzstreifen, blaues
//  Wasser mit Wellenzeichen, Pinguine rutschen auf dem Bauch.
//  v1433 (Al 25.9.): Wasser aufgehuebscht — treppige Eiskante wie auf der
//  Karte mit sichtbarer Eisdicke, Schaum an der Kante, Tiefe nach unten,
//  Wellenzeichen und Lichtreflexe, die ueber drei Bilder wandern, dazu
//  treibende Schollen. Pinguine detaillierter (Gesicht mit roter Wange,
//  Glanz auf dem Ruecken, schlagende Flossen) mit dem Bewegungsschleier
//  der Karte. Statt des Schilds ein STACHELIGER EISBLOCK, der ebenfalls
//  herumrutscht. Eis mit Rissen und Schneewehen. Licht IMMER oben rechts.
const SLI = '/areas/slippery-ice/';
// v1434 (Al 25.9.: „zu viele Akteure, sie ueberlappen sich staendig —
// pro Hoehenebene nur einen"): feste Bahnen, jede mit genau EINEM
// Akteur. Die Bahnen ueberschneiden sich nicht (Pinguin 8 hoch, Eisblock
// 30 hoch), und die unterste endet ueber der hoechsten Stufe der
// Eiskante (y 60) — so rutscht nie etwas auf etwas anderem oder im Wasser.
const SLI_BAHNEN = [
  { art: 'pinguin', y: 1 },
  { art: 'block', y: 11 },
  { art: 'pinguin', y: 42 },
  { art: 'pinguin', y: 51 },
];
const SlipperyIceOverlay = React.memo(function SlipperyIceOverlay() {
  const bahnen = useMemo(() => SLI_BAHNEN.slice(0, Math.max(2, ppFxN(SLI_BAHNEN.length))), []);
  // v1435 (Al 25.9.): Richtungen fest — der zweite Pinguin rutscht nach
  // links, die anderen nach rechts; der Block startet nach links.
  const pinguine = useMemo(() => bahnen.filter(b => b.art === 'pinguin').map((b, i) => ({
    y: b.y, dur: 6 + Math.random() * 6, delay: -Math.random() * 12, rtl: i === 1,
    bob: 1.1 + Math.random() * .8,
  })), [bahnen]);
  const bloecke = useMemo(() => bahnen.filter(b => b.art === 'block').map(b => ({
    y: b.y, von: 50 + Math.random() * 60, bis: -120 + Math.random() * 40,
    dur: 7 + Math.random() * 5, delay: 0,
  })), [bahnen]);
  const schollen = useMemo(() => ppZufall(ppFxN(4), () => ({
    x: (Math.random() - .5) * 220, y: 78 + Math.random() * 14, dur: 9 + Math.random() * 6, delay: -Math.random() * 10,
  })), []);
  const funken = useMemo(() => ppZufall(ppFxN(10), () => ({
    x: Math.random() * 100, y: 4 + Math.random() * 52, dur: 1.8 + Math.random() * 2, delay: -Math.random() * 4,
  })), []);
  return (
    <PixelScene artH={100} bg="#dad9f7" className="slippery-ice-overlay">
      <PixelBand src={SLI + 'water.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 1.5s steps(1) infinite' }} />
      {schollen.map((s, i) => (
        <i key={'s' + i} className="pp-area-dyn sli-scholle" style={{ left: ppArtX(s.x, 0), top: ppArt(s.y), animation: `sliTreiben ${s.dur.toFixed(2)}s ease-in-out ${s.delay.toFixed(2)}s infinite alternate` }} />
      ))}
      <PixelBand src={SLI + 'tile.png'} />
      {funken.map((f, i) => (
        <i key={'f' + i} className="pp-area-dyn pp-px-funkeln" style={{ left: f.x + '%', top: ppArt(f.y), animation: `ppFunkeln ${f.dur}s steps(1) ${f.delay}s infinite` }} />
      ))}
      {bloecke.map((b, i) => (
        <i key={'b' + i} className="sli-block" style={{
          left: ppArtX(-17, 0), top: ppArt(b.y), '--von': ppArt(b.von), '--bis': ppArt(b.bis),
          animation: `sliBlock ${b.dur.toFixed(2)}s cubic-bezier(.35,0,.25,1) ${b.delay.toFixed(2)}s infinite alternate`,
        }} />
      ))}
      {pinguine.map((p, i) => (
        <div key={'p' + i} className="pp-area-dyn pp-quer" style={ppQuer(p.y, p.dur, p.delay, p.rtl)}>
          <div className="sli-rutscher" style={{ transform: p.rtl ? 'scaleX(-1)' : undefined, animationDuration: p.bob.toFixed(2) + 's' }}>
            <i className="sli-spur" /><i className="sli-pinguin" />
          </div>
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .sli-rutscher { display: flex; align-items: flex-start; animation: sliRuckeln 1.4s steps(2) infinite; }
        @keyframes sliRuckeln { 0% { translate: 0 0; } 50% { translate: 0 calc(-1 * var(--px)); } }
        .sli-spur { display: block; width: calc(26 * var(--px)); height: calc(8 * var(--px)); background: url(${SLI}trail.png) 0 0 / 100% 100% no-repeat; margin-right: calc(-2 * var(--px)); }
        .sli-pinguin { display: block; width: calc(22 * var(--px)); height: calc(8 * var(--px)); background: url(${SLI}penguin.png) 0 0 / 300% 100% no-repeat; animation: ppSprite3 .45s steps(1) infinite; }
        .sli-block {
          position: absolute; width: calc(34 * var(--px)); height: calc(30 * var(--px));
          background: url(${SLI}spikeblock.png) 0 0 / 100% 100% no-repeat;
        }
        @keyframes sliBlock {
          0% { transform: translateX(var(--von)); } 8% { transform: translateX(var(--von)) translateY(calc(-1 * var(--px))); }
          12% { transform: translateX(var(--von)); } 100% { transform: translateX(var(--bis)); }
        }
        .sli-scholle { position: absolute; width: calc(9 * var(--px)); height: calc(4 * var(--px)); background: url(${SLI}floe.png) 0 0 / 100% 100% no-repeat; }
        @keyframes sliTreiben {
          0% { transform: translate(0, 0); } 25% { transform: translate(calc(2 * var(--px)), var(--px)); }
          50% { transform: translate(calc(4 * var(--px)), 0); } 75% { transform: translate(calc(6 * var(--px)), var(--px)); }
          100% { transform: translate(calc(8 * var(--px)), 0); }
        }
      `}</style>
    </PixelScene>
  );
});

// ── SMUGGLER'S PIER ──────────────────────────────────────────────────
//  Karte: tiefblaues Wasser, Holzsteg mit Pfosten, Kiste, Tauring,
//  Pfuetze, Moewen. v1435 (Al 25.9.): Proportionen wie auf der Karte —
//  grosse Moewen (fliegend 27 breit, mit Schatten aufs Wasser). Das
//  Beiboot ist wieder raus (v1436, Al: perspektivisch unstimmig). Meer mit wandernden Wellenstrichen und aufblitzenden
//  Kaemmen, Pfuetze mit wanderndem Reflex und Kraeuselring. Kiste mit
//  Deckel, Eckleisten, Strebe, Rahmen und Schlagschatten — klar vom Steg
//  abgesetzt. Mehr Detail: Planken mit Maserung, Naegeln und Stoessen,
//  Stirnbalken, Pfaehle mit Schaum und Algen, Tauwicklung an den Pfosten,
//  Fass, Fischernetz. Licht IMMER oben rechts.
const SMP = '/areas/smugglers-pier/';
const SMP_W = 210;                  // Stegstueck; Stueck-x 105 = Brettmitte
const smpX = (x) => x - SMP_W / 2;  // Stueck-x → x neben der Mitte
const SmugglersPierOverlay = React.memo(function SmugglersPierOverlay() {
  const moewen = useMemo(() => ppZufall(ppFxN(3), (i) => ({
    // eigene Hoehe je Moewe (13 hoch, 12er-Abstand) — sie fliegen nie uebereinander
    y: [1, 13, 25][i] + Math.random() * 2, dur: 14 + Math.random() * 10, delay: -Math.random() * 25, rtl: i % 2 === 1,
    schlag: .55 + Math.random() * .25,
  })), []);
  return (
    <PixelScene artH={100} bg="#1646ca" className="smugglers-pier-overlay">
      <PixelBand src={SMP + 'tile.png'} style={{ backgroundSize: 'auto 300%', animation: 'ppBand3 1.8s steps(1) infinite' }} />
      <PixelPiece src={SMP + 'pier.png'} w={SMP_W} />
      <i className="smp-pfuetze" style={{ left: ppArtX(smpX(86), 0), top: ppArt(52) }} />
      <i className="smp-kiste" style={{ left: ppArtX(smpX(12), 0), top: ppArt(40) }} />
      <i className="smp-moewe-sitzt" style={{ left: ppArtX(smpX(20), 0), top: ppArt(31) }} />
      <i className="smp-moewe-sitzt b" style={{ left: ppArtX(smpX(112), 0), top: ppArt(76) }} />
      {moewen.map((m, i) => (
        <div key={'m' + i} className="pp-area-dyn pp-quer" style={ppQuer(m.y, m.dur, m.delay, m.rtl)}>
          <div style={{ transform: m.rtl ? 'scaleX(-1)' : undefined, position: 'relative' }}>
            <i className="smp-moewe-schatten" />
            <i className="smp-moewe" style={{ animationDuration: `${m.schlag.toFixed(2)}s, 1.7s` }} />
          </div>
        </div>
      ))}
      <div className="pp-rand-dim" />
      <style>{`
        .smp-pfuetze { position: absolute; width: calc(26 * var(--px)); height: calc(16 * var(--px)); background: url(${SMP}puddle.png) 0 0 / 300% 100% no-repeat; animation: ppSprite3 1.3s steps(1) infinite; }
        .smp-kiste { position: absolute; width: calc(32 * var(--px)); height: calc(34 * var(--px)); background: url(${SMP}crate.png) 0 0 / 100% 100% no-repeat; }
        .smp-moewe-sitzt { position: absolute; width: calc(15 * var(--px)); height: calc(13 * var(--px)); background: url(${SMP}gull-sit.png) 0 0 / 300% 100% no-repeat; animation: smpSitzen 5.5s steps(1) infinite; }
        .smp-moewe-sitzt.b { transform: scaleX(-1); animation-duration: 7.3s; animation-delay: -2.1s; }
        @keyframes smpSitzen { 0%, 60% { background-position: 0 0; } 64%, 76% { background-position: 50% 0; } 80% { background-position: 0 0; } 88% { background-position: 100% 0; } 92%, 100% { background-position: 0 0; } }
        .smp-moewe {
          display: block; width: calc(27 * var(--px)); height: calc(13 * var(--px));
          background: url(${SMP}gull-fly.png) 0 0 / 400% 100% no-repeat;
          animation: smpFluegel .6s steps(4) infinite, ppBob 1.7s ease-in-out infinite alternate; --bob: calc(3 * var(--px));
        }
        @keyframes smpFluegel { from { background-position: 0 0; } to { background-position: calc(-108 * var(--px)) 0; } }
        .smp-moewe-schatten {
          position: absolute; left: calc(8 * var(--px)); top: calc(34 * var(--px)); width: calc(14 * var(--px)); height: calc(4 * var(--px));
          background: url(${SMP}gull-shadow.png) 0 0 / 100% 100% no-repeat;
        }
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
