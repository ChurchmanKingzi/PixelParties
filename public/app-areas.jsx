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
  'Temple of Sacrifice':          { tier: 'opaque',      C: () => <TempleOfSacrificeOverlay /> },
  'The Cosmic Depths':            { tier: 'opaque',      C: () => <CosmicDepthsOverlay /> },
  'Pangaia, the Dino Domain':     { tier: 'opaque',      C: () => <PangaiaOverlay /> },   // v1439: Kartenstil
  'Graveyard of Limited Power':   { tier: 'opaque',      C: () => <GraveyardOfLimitedPowerOverlay /> },   // v1415: Kartenstil, ganze Szene
  'Paraseed Greenhouse':          { tier: 'opaque',      C: () => <ParaseedGreenhouseOverlay /> },   // v1415: Kartenstil, ganze Szene
  'The First Circle of Hell':     { tier: 'translucent', C: () => <FirstCircleOfHellOverlay /> },
  "Tarleinn's Floating Island":   { tier: 'translucent', C: () => <FloatingIslandOverlay /> },
  'Deepsea Castle':               { tier: 'opaque',      C: () => <DeepseaCastleOverlay /> },   // v1415: Kartenstil, ganze Szene
  'War Council Gathering Place':  { tier: 'translucent', C: () => <WarCouncilOverlay /> },
  "Cottage at the Forest's Edge": { tier: 'opaque',      C: () => <CottageOverlay /> },   // v1415: Kartenstil, ganze Szene
  "Smuggler's Pier":              { tier: 'opaque',      C: () => <SmugglersPierOverlay /> },   // v1415: Kartenstil, ganze Szene
  'Acid Rain':                    { tier: 'opaque',      C: () => <AcidRainOverlay /> },   // v1412: ganzer Burghof
  'The Bonegrinder':              { tier: 'partial',     C: () => <BonegrinderOverlay /> },
  'Crystal Well':                 { tier: 'opaque',      C: () => <CrystalWellOverlay /> },   // v1415: Kartenstil, ganze Szene
  'Spider Hive':                  { tier: 'partial',     C: () => <SpiderHiveOverlay /> },
  'Wowhalla, the Hall of the Cool': { tier: 'partial',   C: () => <WowhallaGearsOverlay /> },
  'Stinky Stables':               { tier: 'partial',     C: () => <StinkyStablesOverlay /> },
  'Rioting Village':              { tier: 'opaque',      C: () => <RiotingVillageOverlay /> },   // v1415: Kartenstil, ganze Szene
  'The Great Clock Tower "Big Gwen"': { tier: 'partial',  C: () => <BigGwenOverlay /> },
  'Shared Blood Tanks':           { tier: 'opaque',      C: () => <SharedBloodTanksOverlay /> },   // v1411: ganzer Raum
  // ★ v1050: BEWUSST 'partial'. Spatial Crevice ist die Karte, die
  // zwei WEITERE Areas ueberhaupt erst erlaubt — ein deckender
  // Hintergrund wuerde genau die Hintergruende verdraengen, fuer die
  // sie Platz schafft.
  'Spatial Crevice':              { tier: 'partial',     C: () => <SpatialCreviceOverlay /> },
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


// The Cosmic Depths — a black starfield pinned under the zones and
// cards (same z-index convention as Slippery Ice). The dark cosmos
// backdrop is its own layer; the stars render in a SEPARATE layer
// above it with no blend mode so the whites stay bright. (The earlier
// version stacked them in a single `mixBlendMode: multiply` div, which
// multiplied every white star against the background and made the
// twinkle lattice vanish entirely.)
function CosmicDepthsOverlay() {
  const stars = useMemo(() => Array.from({ length: ppFxN(140) }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    // Mostly tiny specks; a few bigger to add depth.
    size: 1.2 + Math.pow(Math.random(), 3) * 3.2,
    delay: -Math.random() * 4.2,
    dur: 2.2 + Math.random() * 3.6,
    // A fraction become 4-pointed "sparkle" glints; the rest are round.
    sparkle: Math.random() < 0.35,
  })), []);
  return (
    <div className="cosmic-depths-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* Layer 1: deep cosmos gradient. Solid-opaque so the stars read
          on true black; no blend mode (an earlier multiply blend
          zeroed out white stars on top). */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'radial-gradient(ellipse at 50% 50%, rgba(22,14,50,0.96) 0%, rgba(8,5,22,0.98) 55%, rgba(0,0,0,1) 100%)',
      }} />
      {/* Layer 2: star field on its own. `mixBlendMode: screen` keeps
          the whites bright even if a future theme tints the layer
          beneath (screen of white + anything = white). */}
      <div style={{
        position: 'absolute', inset: 0,
        mixBlendMode: 'screen',
      }}>
        {stars.map((s, i) => (
          <span key={'star' + i} style={{
            position: 'absolute',
            left: s.x + '%', top: s.y + '%',
            width: s.size + 'px', height: s.size + 'px',
            transform: 'translate(-50%, -50%)',
            background: s.sparkle
              ? 'transparent'
              : 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(230,235,255,0.95) 45%, rgba(200,210,255,0) 100%)',
            borderRadius: '50%',
            boxShadow: s.sparkle
              ? ''
              : '0 0 ' + (s.size * 2.5) + 'px rgba(255,255,255,0.95), 0 0 ' + (s.size * 6) + 'px rgba(180,200,255,0.45)',
            animation: 'cosmicDepthsTwinkle ' + s.dur + 's ease-in-out ' + s.delay + 's infinite',
          }}>
            {s.sparkle && (
              <span style={{
                position: 'absolute', inset: 0,
                background:
                  'linear-gradient(0deg, transparent 44%, rgba(255,255,255,1) 49%, rgba(255,255,255,1) 51%, transparent 56%),'
                  + 'linear-gradient(90deg, transparent 44%, rgba(255,255,255,1) 49%, rgba(255,255,255,1) 51%, transparent 56%)',
                filter: 'blur(0.4px)',
                boxShadow: '0 0 ' + (s.size * 3) + 'px rgba(255,255,255,0.95)',
              }} />
            )}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes cosmicDepthsTwinkle {
          0%, 100% { opacity: 0.2; transform: translate(-50%, -50%) scale(0.7); }
          50%      { opacity: 1;   transform: translate(-50%, -50%) scale(1.2); }
        }
      `}</style>
    </div>
  );
}


// The First Circle of Hell — gray wasteland: ash-gray sky fading to
// a dark, lifeless ground with scattered rubble silhouettes and
// drifting ash particles. Deliberately low-saturation and static —
// the card's identity is "everything here is dust" rather than
// anything dramatic.
function FirstCircleOfHellOverlay() {
  const rubble = useMemo(() => Array.from({ length: ppFxN(22) }, () => ({
    x: Math.random() * 100,
    y: 56 + Math.random() * 38,
    scale: 0.6 + Math.random() * 1.2,
    tilt: -28 + Math.random() * 56,
    // Three rough silhouette shapes — picked at random per piece so
    // the wasteland reads as varied rubble rather than identical
    // tombstones.
    shape: Math.floor(Math.random() * 3),
    shade: 16 + Math.floor(Math.random() * 18),
  })), []);
  const ashes = useMemo(() => Array.from({ length: ppFxN(18) }, () => ({
    x: Math.random() * 100,
    delay: -Math.random() * 14,
    dur: 10 + Math.random() * 14,
    drift: -16 + Math.random() * 32,
    size: 2 + Math.random() * 3,
    opacity: 0.18 + Math.random() * 0.32,
  })), []);
  return (
    <div className="first-circle-of-hell-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
    }}>
      {/* Layer 1: ash-gray sky. Deliberately desaturated so the
          wasteland reads cold and joyless. */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'linear-gradient(180deg, rgba(56,56,62,0.78) 0%, rgba(40,40,46,0.86) 45%, rgba(22,22,26,0.92) 100%)',
      }} />
      {/* Layer 2: lighter ashen haze across the middle band. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '36%', height: '28%',
        background:
          'linear-gradient(180deg, rgba(80,78,82,0.0) 0%, rgba(110,108,112,0.22) 50%, rgba(80,78,82,0.0) 100%)',
        mixBlendMode: 'screen',
      }} />
      {/* Layer 3: cracked-earth ground silhouette. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%',
        background:
          'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(20,20,24,0.55) 40%, rgba(8,8,10,0.92) 100%)',
      }} />
      {/* Layer 4: scattered rubble silhouettes — three jagged shapes.
          Solid dark blocks with uneven clip-paths to suggest broken
          stones. No glow; this is dead earth. */}
      {rubble.map((r, i) => {
        const w = 18 * r.scale;
        const h = 14 * r.scale;
        const clip = r.shape === 0
          ? 'polygon(20% 100%, 0% 35%, 28% 0%, 70% 12%, 100% 60%, 80% 100%)'
          : r.shape === 1
            ? 'polygon(0% 100%, 15% 20%, 50% 0%, 90% 28%, 100% 100%)'
            : 'polygon(10% 100%, 0% 50%, 35% 8%, 80% 22%, 100% 80%, 60% 100%)';
        const tone = `rgb(${r.shade}, ${r.shade}, ${r.shade + 4})`;
        return (
          <div key={'rb' + i} style={{
            position: 'absolute',
            left: r.x + '%', top: r.y + '%',
            width: w + 'px', height: h + 'px',
            transform: 'translate(-50%, -50%) rotate(' + r.tilt + 'deg)',
            background: tone,
            clipPath: clip,
            boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.6)',
          }} />
        );
      })}
      {/* Layer 5: slow drifting ash particles. Use simple round
          divs that float gently upward; the slow loop makes the
          air feel "stale" rather than energetic. */}
      {ashes.map((a, i) => (
        <div key={'ash' + i} style={{
          position: 'absolute',
          left: a.x + '%', top: '102%',
          width: a.size + 'px', height: a.size + 'px',
          borderRadius: '50%',
          background: 'rgba(180,180,184,1)',
          opacity: a.opacity,
          ['--drift']: a.drift + 'px',
          animation: 'firstCircleAshFloat ' + a.dur + 's linear ' + a.delay + 's infinite',
        }} />
      ))}
      <style>{`
        @keyframes firstCircleAshFloat {
          0%   { transform: translate(0, 0); opacity: 0; }
          15%  { opacity: var(--ashOpacity, 1); }
          90%  { opacity: var(--ashOpacity, 1); }
          100% { transform: translate(var(--drift, 0), -120vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

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


// ═══════════════════════════════════════════════════════════════════
//  „The Great Clock Tower ‚Big Gwen'" — Area-Hintergrund (partial)
//
//  Ein Big-Ben-Verschnitt am RECHTEN Rand: gotischer Turmschaft,
//  Uhrenstube mit beleuchtetem Zifferblatt, Glockenstube, Spitzhelm
//  mit Fialen. Die Zeiger laufen wirklich (Minutenzeiger 60 s,
//  Stundenzeiger 12 min je Umlauf). Dazu Nachtdunst am Boden und ein
//  paar Dohlen um die Spitze. Deckt nur Teile → partial, liegt obenauf.
//
//  NICHT zu verwechseln mit der Aktivierungs-Animation
//  `big_gwen_clock_activation` (die große Uhr in der Brettmitte) —
//  die ist ein Ereignis, DIES hier ist der liegende Hintergrund.
// ═══════════════════════════════════════════════════════════════════
const BigGwenOverlay = React.memo(function BigGwenOverlay() {
  const daws = useMemo(() => Array.from({ length: 5 }, () => ({
    rx: 34 + Math.random() * 46,
    ry: 12 + Math.random() * 16,
    top: 6 + Math.random() * 12,
    size: 7 + Math.random() * 6,
    dur: 13 + Math.random() * 11,
    delay: -Math.random() * 18,
  })), []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`
        @keyframes bgwHaze  { 0%, 100% { opacity: .42; transform: translateX(0); } 50% { opacity: .68; transform: translateX(-22px); } }
        @keyframes bgwGlow  { 0%, 100% { opacity: .55; } 50% { opacity: .85; } }
        @keyframes bgwMin   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bgwHour  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bgwDaw   { from { transform: rotate(0deg) translateX(var(--rx)) rotate(0deg); } to { transform: rotate(360deg) translateX(var(--rx)) rotate(-360deg); } }
      `}</style>

      {/* Nachtdunst am unteren Bildrand — der einzige Teil, der über
          die Brettmitte läuft, und deshalb sehr zurückhaltend. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '26%',
        background: 'linear-gradient(0deg, rgba(28,36,52,.42) 0%, rgba(28,36,52,0) 100%)',
        filter: 'blur(3px)',
        animation: 'bgwHaze 16s ease-in-out infinite',
      }} />

      {/* Lichtschein des Zifferblatts in den Dunst */}
      <div style={{
        position: 'absolute', right: '2%', top: '26%',
        width: '22%', height: '30%',
        background: 'radial-gradient(ellipse at 60% 50%, rgba(255,214,132,.22) 0%, rgba(255,214,132,0) 70%)',
        animation: 'bgwGlow 6.5s ease-in-out infinite',
      }} />

      {/* Der Turm. Rechter Rand, volle Höhe, Seitenverhältnis erhalten. */}
      <svg viewBox="0 0 200 620" preserveAspectRatio="xMaxYMax meet"
        style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '26%' }}>
        <defs>
          <linearGradient id="bgwStone" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4a4438" />
            <stop offset="45%" stopColor="#6b6250" />
            <stop offset="100%" stopColor="#332f27" />
          </linearGradient>
          <radialGradient id="bgwFace" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#fff1c9" />
            <stop offset="72%" stopColor="#f2cf85" />
            <stop offset="100%" stopColor="#c39b4c" />
          </radialGradient>
        </defs>

        {/* Schaft mit Lisenen */}
        <path d="M56,620 L56,250 L144,250 L144,620 Z" fill="url(#bgwStone)" />
        {[68, 86, 104, 122].map((x, i) => (
          <rect key={'bgl' + i} x={x} y="250" width="4" height="370" fill="#241f19" opacity=".35" />
        ))}
        {[300, 360, 420, 480, 540].map((y, i) => (
          <rect key={'bgb' + i} x="56" y={y} width="88" height="4" fill="#241f19" opacity=".3" />
        ))}

        {/* Uhrenstube */}
        <path d="M48,250 L48,132 L152,132 L152,250 Z" fill="url(#bgwStone)" />
        <rect x="44" y="126" width="112" height="10" rx="3" fill="#3b352c" />
        <rect x="44" y="244" width="112" height="10" rx="3" fill="#3b352c" />

        {/* Zifferblatt */}
        <circle cx="100" cy="190" r="40" fill="url(#bgwFace)" />
        <circle cx="100" cy="190" r="40" fill="none" stroke="#2e2a22" strokeWidth="6" />
        <circle cx="100" cy="190" r="33" fill="none" stroke="#8d7132" strokeWidth="1.5" opacity=".8" />
        {Array.from({ length: ppFxN(12) }, (_, i) => (
          <rect key={'bgt' + i} x="99" y="156" width="2" height={i % 3 === 0 ? 9 : 5}
            fill="#3a3327" transform={`rotate(${i * 30} 100 190)`} />
        ))}
        {/* Zeiger — echte Umläufe, reine Rotation */}
        <g style={{ transformOrigin: '100px 190px', transformBox: 'view-box', animation: 'bgwHour 720s linear infinite' }}>
          <rect x="98" y="168" width="4" height="24" rx="2" fill="#2a251d" />
        </g>
        <g style={{ transformOrigin: '100px 190px', transformBox: 'view-box', animation: 'bgwMin 60s linear infinite' }}>
          <rect x="99" y="158" width="2.5" height="34" rx="1.2" fill="#2a251d" />
        </g>
        <circle cx="100" cy="190" r="3.5" fill="#241f18" />

        {/* Glockenstube mit Lamellen */}
        <path d="M52,132 L52,72 L148,72 L148,132 Z" fill="#3c372d" />
        {[62, 80, 98, 116, 134].map((x, i) => (
          <rect key={'bgv' + i} x={x} y="80" width="9" height="46" rx="2" fill="#221e18" opacity=".8" />
        ))}

        {/* Spitzhelm mit Fialen und Turmknauf */}
        <path d="M100,4 L150,72 L50,72 Z" fill="#4d4636" />
        <path d="M100,4 L150,72 L100,72 Z" fill="#332e24" opacity=".75" />
        {[[54, 72], [146, 72]].map(([x, y], i) => (
          <path key={'bgf' + i} d={`M${x - 7},${y} L${x},${y - 30} L${x + 7},${y} Z`} fill="#443e30" />
        ))}
        <circle cx="100" cy="6" r="5" fill="#b99a4e" opacity=".85"
          style={{ animation: 'bgwGlow 6.5s ease-in-out infinite' }} />
      </svg>

      {/* Dohlen, die um die Turmspitze kreisen */}
      <div style={{ position: 'absolute', right: '9%', top: '9%', width: 0, height: 0 }}>
        {daws.map((d, i) => (
          <div key={'bgd' + i} style={{
            position: 'absolute',
            width: d.size + 'px', height: (d.size * 0.42) + 'px',
            '--rx': d.rx + 'px',
            borderTop: '2px solid rgba(14,16,22,.72)',
            borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
            animation: `bgwDaw ${d.dur}s linear ${d.delay}s infinite`,
          }} />
        ))}
      </div>
    </div>
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

// Spider Hive — a dusty cobwebbed corner of the battlefield. Pale
// silken arcs spider out from each corner (SVG concentric radials),
// a few long strands drape diagonally across the middle, and a
// handful of tiny pixel-spiders crawl along independent looped paths.
// The whole layer sits under the cards (no zIndex set — defaults to
// auto, lower than the zone-has-card layer's z:10).
function SpiderHiveOverlay() {
  // Stable per-mount randomization for the spiders so they don't
  // re-randomize every render.
  const spiders = useMemo(() => Array.from({ length: ppFxN(6) }, (_, i) => {
    // Each spider gets a unique path along an ellipse-ish curve so
    // they wander independently rather than marching in lockstep.
    const dur = 9 + Math.random() * 7; // seconds for a full loop
    const delay = -Math.random() * dur;
    const size = 12 + Math.random() * 6; // SVG-side radius; rendered size is size*2 px wide
    // Loop centre — kept away from the corners (the corner webs
    // already live there) and inset from the edges so the wander
    // arcs don't sail off the playmat.
    const cx = 18 + Math.random() * 64;
    const cy = 18 + Math.random() * 64;
    // Wander radii are generous so the motion reads from across the
    // board, not a tight twitch. % of parent — see the `left`/`top`
    // animation comment for why that matters.
    const rx = 14 + Math.random() * 18;
    const ry = 10 + Math.random() * 14;
    return { id: i, dur, delay, size, cx, cy, rx, ry,
      reverse: Math.random() < 0.5,
      bob: 1.6 + Math.random() * 1.4 };
  }), []);

  // Long diagonal strands drifting across the middle.
  const strands = useMemo(() => Array.from({ length: 5 }, () => ({
    x1: Math.random() * 100, y1: Math.random() * 100,
    x2: Math.random() * 100, y2: Math.random() * 100,
    opacity: 0.10 + Math.random() * 0.12,
  })), []);

  // Each corner web: concentric arcs (silken filaments) + radial spokes.
  const renderCornerWeb = (anchor) => {
    // anchor: 'tl' | 'tr' | 'bl' | 'br' → controls the SVG flip /
    // position of the radial origin.
    const isRight = anchor === 'tr' || anchor === 'br';
    const isBottom = anchor === 'bl' || anchor === 'br';
    // Radial spokes from (0,0) to a fan of endpoints.
    const ARC_COUNT = 7;     // concentric webs
    const SPOKE_COUNT = 9;   // radial threads
    const MAX_R = 220;       // pixel radius of the largest arc
    const spokes = [];
    for (let i = 0; i < SPOKE_COUNT; i++) {
      const angle = (Math.PI / 2) * (i / (SPOKE_COUNT - 1));
      const ex = Math.cos(angle) * MAX_R;
      const ey = Math.sin(angle) * MAX_R;
      spokes.push({ x: ex, y: ey });
    }
    const arcs = [];
    for (let i = 1; i <= ARC_COUNT; i++) {
      const r = (MAX_R / ARC_COUNT) * i;
      arcs.push(r);
    }
    return (
      <svg
        viewBox={`0 0 ${MAX_R} ${MAX_R}`}
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          [isRight ? 'right' : 'left']: 0,
          [isBottom ? 'bottom' : 'top']: 0,
          width: '32%', height: '40%',
          opacity: 0.55,
          transform:
            (isRight ? 'scaleX(-1) ' : '')
            + (isBottom ? 'scaleY(-1) ' : ''),
          filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.18))',
          pointerEvents: 'none',
        }}>
        {arcs.map((r, i) => (
          <path key={'arc' + i}
            d={`M ${r} 0 A ${r} ${r} 0 0 1 0 ${r}`}
            fill="none"
            stroke="rgba(220,225,235,0.55)"
            strokeWidth={0.7}
          />
        ))}
        {spokes.map((s, i) => (
          <line key={'spoke' + i}
            x1={0} y1={0} x2={s.x} y2={s.y}
            stroke="rgba(220,225,235,0.45)"
            strokeWidth={0.6}
          />
        ))}
      </svg>
    );
  };

  return (
    <div className="spider-hive-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'hidden',
      // Dusty, faintly bruised tint over the playmat — gives the web
      // structure a contrasting backdrop.
      background:
        'radial-gradient(ellipse at 50% 55%, rgba(40,30,45,0.18) 0%, rgba(20,15,25,0.12) 60%, rgba(0,0,0,0.06) 100%),'
        + 'linear-gradient(180deg, rgba(50,40,55,0.10) 0%, rgba(20,15,25,0.06) 100%)',
      mixBlendMode: 'multiply',
    }}>
      {/* Four corner webs */}
      {renderCornerWeb('tl')}
      {renderCornerWeb('tr')}
      {renderCornerWeb('bl')}
      {renderCornerWeb('br')}

      {/* Long diagonal strands drifting across the middle. Pure SVG
          lines with faint glow — they read as drape silk between the
          corner webs. */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        opacity: 0.9, pointerEvents: 'none',
      }}>
        {strands.map((s, i) => (
          <line key={'strand' + i}
            x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke={`rgba(220,225,235,${s.opacity})`}
            strokeWidth={0.18}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* Crawling spiders. Each runs its own elliptical loop, sized
          and timed independently so the swarm reads as wandering
          rather than choreographed.

          IMPORTANT: positional animation uses `left`/`top` rather than
          `transform: translate(%)`. Percentage values on `transform`
          translate are relative to the ELEMENT'S OWN size (≈20px for
          the spider SVG) — that would clamp every spider to a tiny
          arc near top-left. `left`/`top` percentages ARE relative to
          the parent overlay, so the elliptical wander loop spans the
          actual playmat. */}
      {spiders.map(s => (
        <div key={'sp' + s.id}
          style={{
            position: 'absolute',
            // CSS custom props pipe the per-spider params into the
            // shared keyframes definition.
            '--cx': s.cx + '%',
            '--cy': s.cy + '%',
            '--rx': s.rx + '%',
            '--ry': s.ry + '%',
            '--dur': s.dur + 's',
            '--delay': s.delay + 's',
            // Initial position (also where the first keyframe lands so
            // there's no jump when the animation starts).
            left: `calc(${s.cx}% + ${s.rx}%)`,
            top: `${s.cy}%`,
            width: 0, height: 0,
            animation: `spiderHiveWander var(--dur) ease-in-out var(--delay) infinite ${s.reverse ? 'reverse' : 'normal'}`,
          }}>
          {/* The spider itself — body + 8 legs. The wrapper's left/top
              points at the wander-loop position; the SVG's
              `translate(-50%, -50%)` then centers the spider on that
              point. The bob rotation composes on top of the centering
              translate. */}
          <svg
            viewBox="-20 -20 40 40"
            width={s.size * 2} height={s.size * 2}
            style={{
              position: 'absolute',
              left: 0, top: 0,
              transform: 'translate(-50%, -50%)',
              animation: 'spiderHiveBob 0.45s ease-in-out infinite alternate',
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.55))',
            }}>
            {/* Legs (4 pairs, slight curves) */}
            {[-50, -25, 25, 50].map((angle, li) => {
              const a = (angle * Math.PI) / 180;
              const x1 = Math.cos(a) * 4, y1 = Math.sin(a) * 4;
              const x2 = Math.cos(a) * 14, y2 = Math.sin(a) * 14;
              // Bend each leg slightly upward at the knee.
              const kneeAngle = a - 0.35;
              const kx = Math.cos(kneeAngle) * 9, ky = Math.sin(kneeAngle) * 9;
              return (
                <g key={'leg' + li}>
                  <polyline
                    points={`${-x1},${y1} ${-kx},${ky} ${-x2},${y2}`}
                    fill="none" stroke="rgba(20,15,25,0.95)"
                    strokeWidth={1.4} strokeLinecap="round"
                  />
                  <polyline
                    points={`${x1},${y1} ${kx},${ky} ${x2},${y2}`}
                    fill="none" stroke="rgba(20,15,25,0.95)"
                    strokeWidth={1.4} strokeLinecap="round"
                  />
                </g>
              );
            })}
            {/* Body */}
            <ellipse cx={0} cy={0} rx={5.5} ry={4}
              fill="rgba(20,15,25,1)" stroke="rgba(45,30,50,1)" strokeWidth={0.6} />
            {/* Tiny eye dots */}
            <circle cx={-1.6} cy={-1.2} r={0.7} fill="rgba(220,60,60,0.95)" />
            <circle cx={1.6} cy={-1.2} r={0.7} fill="rgba(220,60,60,0.95)" />
          </svg>
        </div>
      ))}

      <style>{`
        @keyframes spiderHiveWander {
          0%   { left: calc(var(--cx) + var(--rx)); top: var(--cy); }
          25%  { left: var(--cx); top: calc(var(--cy) + var(--ry)); }
          50%  { left: calc(var(--cx) - var(--rx)); top: var(--cy); }
          75%  { left: var(--cx); top: calc(var(--cy) - var(--ry)); }
          100% { left: calc(var(--cx) + var(--rx)); top: var(--cy); }
        }
        @keyframes spiderHiveBob {
          0%   { transform: translate(-50%, -50%) rotate(-6deg); }
          100% { transform: translate(-50%, -50%) rotate(6deg); }
        }
      `}</style>
    </div>
  );
}

// Temple of Sacrifice — a wall of gilded golden bricks. A brick-offset
// grid of gold blocks (seeded jitter so the masonry reads as hand-laid,
// not tiled) over dark mortar, with a warm ambient glow that slowly
// shimmers. Static masonry keeps it cheap; only the glow pulses.
function TempleOfSacrificeOverlay() {
  const COLS = 11;
  const ROWS = 8;
  const bricks = useMemo(() => {
    const out = [];
    for (let r = 0; r < ROWS; r++) {
      const offset = (r % 2) * (50 / COLS); // half-cell shift on odd rows
      for (let c = 0; c < COLS; c++) {
        const lum = 150 + Math.floor(Math.random() * 70); // gold luminance range
        out.push({
          x: (c * (100 / COLS)) + offset + (Math.random() * 2 - 1),
          y: (r * (100 / ROWS)) + (Math.random() * 2 - 1),
          w: (100 / COLS) * (0.88 + Math.random() * 0.12),
          h: (100 / ROWS) * (0.84 + Math.random() * 0.16),
          tilt: -3 + Math.random() * 6,
          // Warm gilded tone — strong red+green, low blue = gold.
          tone: `rgb(${lum + 30}, ${Math.round(lum * 0.78)}, ${Math.round(lum * 0.18)})`,
          radius: 10 + Math.random() * 12,
        });
      }
    }
    return out;
  }, []);
  return (
    <div className="temple-of-sacrifice-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
    }}>
      <style>{`@keyframes templeGoldGlow { 0%,100% { opacity: 0.6 } 50% { opacity: 1 } }`}</style>
      {/* Layer 1: dark mortar base showing through the seams. */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'linear-gradient(180deg, rgba(60,42,10,0.97) 0%, rgba(42,28,6,0.98) 55%, rgba(26,16,2,0.99) 100%)',
      }} />
      {/* Layer 2: the golden bricks. */}
      {bricks.map((b, i) => (
        <div key={'gbrick' + i} style={{
          position: 'absolute',
          left: b.x + '%', top: b.y + '%',
          width: b.w + '%', height: b.h + '%',
          transform: 'rotate(' + b.tilt + 'deg)',
          background: 'linear-gradient(150deg, ' + b.tone + ' 0%, rgba(120,80,12,0.96) 100%)',
          borderRadius: b.radius + '%',
          boxShadow:
            'inset 0 2px 4px rgba(255,245,200,0.45), '
            + 'inset 0 -4px 6px rgba(70,44,4,0.7), '
            + '0 2px 4px rgba(0,0,0,0.5)',
        }} />
      ))}
      {/* Layer 3: warmer gilded glow + slow shimmer.
          ★★ v1167 (Tester-Bericht 17.9.: „hat das Spiel zum Laggen
          gebracht"): KEIN `mix-blend-mode: screen` mehr. Der Blendmodus
          zwang den Browser, bei JEDEM Schritt der Dauer-Animation die
          ganze Ebene darunter neu zusammenzurechnen — 88 gedrehte,
          schattierte Ziegel eingeschlossen. Ein gewoehnlicher Verlauf mit
          `will-change: opacity` bekommt seine eigene Ebene; die Ziegel
          werden einmal gerastert und bleiben liegen. Die Farbe ist dafuer
          etwas kraeftiger, damit das Gold weiter warm leuchtet. */}
      <div style={{
        position: 'absolute', inset: 0, willChange: 'opacity',
        background:
          'radial-gradient(ellipse at 50% 38%, rgba(255,214,104,0.34) 0%, '
          + 'rgba(206,156,36,0.16) 45%, rgba(0,0,0,0) 78%)',
        animation: 'templeGoldGlow 4.5s ease-in-out infinite',
      }} />
    </div>
  );
}

// Tarleinn's Floating Island — a wide sky background with a single
// large grass-topped island floating in the middle, cut by a blue
// river that snakes across the grass plateau.
//
// The island silhouette and river path are FIXED (hardcoded points),
// so the artwork never reshuffles — only the cloud layer is animated.
// (Earlier versions seeded a per-play randomised layout, but that
// added complexity for no real benefit; a static, hand-tuned shape
// reads cleaner and lets us focus the eye on the gameplay.)
function FloatingIslandOverlay() {
  // Hardcoded island geometry. Coordinate space is the SVG viewBox
  // 0..100 in both axes; preserveAspectRatio="none" lets it stretch
  // to fill the board-center container.
  const island = {
    cx: 50, cy: 52, rxBase: 34, ryBase: 14,
    // 18 radial samples — top arc tighter (grass plateau), bottom arc
    // jaggier (rocky underside). Picked once and frozen for the
    // life of the game.
    points: [
      { x: 84.0, y: 53.5 }, { x: 80.6, y: 58.4 }, { x: 75.0, y: 63.8 },
      { x: 67.0, y: 67.1 }, { x: 58.5, y: 69.2 }, { x: 50.0, y: 70.0 },
      { x: 41.5, y: 69.5 }, { x: 33.0, y: 67.6 }, { x: 25.0, y: 64.0 },
      { x: 19.4, y: 58.7 }, { x: 16.0, y: 53.6 }, { x: 16.4, y: 49.2 },
      { x: 19.5, y: 45.8 }, { x: 25.5, y: 43.4 }, { x: 34.0, y: 41.9 },
      { x: 50.0, y: 41.0 }, { x: 66.0, y: 41.9 }, { x: 78.0, y: 44.7 },
    ],
  };

  // Fixed river S-curve across the grass surface.
  const river = {
    d: 'M 31 43.0 C 38 41.5, 46 45.5, 50 43.4 C 54 41.3, 62 45.5, 69 43.0',
    width: 2.6,
  };

  // Clouds — 7 of them, evenly distributed across the sky. Each has
  // its own scale / opacity / speed / starting offset, all hardcoded
  // so the layout doesn't reshuffle on re-render. Negative delays
  // stagger them mid-traversal at frame 0.
  const clouds = [
    { y: 10, scale: 1.05, delay:  -6, dur:  90, opacity: 0.78 },
    { y: 18, scale: 0.85, delay: -32, dur: 110, opacity: 0.65 },
    { y: 28, scale: 1.20, delay: -58, dur:  95, opacity: 0.72 },
    { y: 14, scale: 0.70, delay: -82, dur: 120, opacity: 0.55 },
    { y: 24, scale: 0.95, delay: -22, dur: 100, opacity: 0.68 },
    { y: 36, scale: 0.80, delay: -68, dur: 115, opacity: 0.60 },
    { y:  6, scale: 1.10, delay: -45, dur:  85, opacity: 0.74 },
  ];

  // Build the island polygon path — a closed Catmull-Rom-ish smooth via
  // simple Bezier between samples works fine; we use a quadratic-ish
  // smooth by routing through midpoints, which keeps the look soft
  // without introducing self-intersections from sharp jitters.
  const polyPath = useMemo(() => {
    const pts = island.points;
    if (pts.length === 0) return '';
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    let d = '';
    const first = mid(pts[pts.length - 1], pts[0]);
    d += `M ${first.x} ${first.y} `;
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const nxt = pts[(i + 1) % pts.length];
      const m = mid(cur, nxt);
      d += `Q ${cur.x} ${cur.y}, ${m.x} ${m.y} `;
    }
    d += 'Z';
    return d;
  }, [island]);

  return (
    <div className="floating-island-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* Layer 1: sky gradient (deep blue at top, lighter near horizon). */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'linear-gradient(180deg, rgba(95,165,225,0.55) 0%, rgba(155,205,235,0.45) 55%, rgba(195,225,240,0.40) 100%)',
      }} />
      {/* Layer 2: drifting clouds. Each cloud is a couple of stacked
          ellipses + soft white blur. They animate horizontally on a
          long loop so the sky reads as alive without distracting. */}
      <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen' }}>
        {clouds.map((c, i) => (
          <div key={'fic' + i} style={{
            position: 'absolute',
            // `left` is driven entirely by the keyframe animation — it
            // sweeps from -25% (off-screen left) to 125% (off-screen
            // right) of the parent. Each cloud's `delay` is negative
            // so they start mid-traversal at varied points, giving the
            // sky a continuous-flow feel from frame 0.
            top: c.y + '%',
            opacity: c.opacity,
            '--ficScale': c.scale,
            animation: `floatingIslandCloud ${c.dur}s linear ${c.delay}s infinite`,
          }}>
            <div style={{
              position: 'absolute', left: -50, top: -16,
              width: 100, height: 32, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(245,250,255,0.6) 60%, transparent 90%)',
              filter: 'blur(2px)',
            }} />
            <div style={{
              position: 'absolute', left: -25, top: -28,
              width: 60, height: 32, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(245,250,255,0.5) 60%, transparent 90%)',
              filter: 'blur(2px)',
            }} />
            <div style={{
              position: 'absolute', left: 5, top: -22,
              width: 50, height: 26, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(245,250,255,0.55) 60%, transparent 90%)',
              filter: 'blur(2px)',
            }} />
          </div>
        ))}
      </div>
      {/* Layer 3: the island itself, plus the river that runs through
          its grass-top surface. Drawn in one SVG so we can clip the
          river to the island silhouette via a clipPath — no matter how
          the random control points fall, the river never spills off
          the rocky underside. */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          filter: 'drop-shadow(0 6px 14px rgba(20,40,80,0.35))',
        }}
      >
        <defs>
          {/* Grass-to-rock vertical gradient: lush green up top, brown
              dirt mid, deep stone at the underside. */}
          <linearGradient id="floatingIslandBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#5cb85c" />
            <stop offset="22%" stopColor="#3d9a4a" />
            <stop offset="35%" stopColor="#7c5a36" />
            <stop offset="60%" stopColor="#553a22" />
            <stop offset="100%" stopColor="#2c1f12" />
          </linearGradient>
          {/* River gradient: brighter cyan-blue down the middle, deeper
              at the edges, so it reads as flowing water. */}
          <linearGradient id="floatingIslandRiver" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#5fc1ee" />
            <stop offset="50%" stopColor="#2c8dd6" />
            <stop offset="100%" stopColor="#1f6db0" />
          </linearGradient>
          {/* Clip the river to the island so it can't overshoot the
              silhouette regardless of where the random control points
              landed. */}
          <clipPath id="floatingIslandClip">
            <path d={polyPath} />
          </clipPath>
        </defs>
        {/* Island body */}
        <path d={polyPath} fill="url(#floatingIslandBody)" opacity="0.92" />
        {/* Subtle highlight along the grass surface — a thin lighter
            band hugging the top arc of the island. Cheap shading hack:
            a second copy of the path, scaled vertically, with a green
            tint and additive blend. */}
        <path
          d={polyPath}
          fill="rgba(140,210,140,0.45)"
          transform={`translate(0 -${island.ryBase * 0.35}) scale(1 0.32)`}
          style={{ transformOrigin: `${island.cx}% ${island.cy}%` }}
          clipPath="url(#floatingIslandClip)"
          opacity="0.7"
        />
        {/* River — drawn with two stacked strokes for the highlight */}
        <g clipPath="url(#floatingIslandClip)">
          <path d={river.d} stroke="url(#floatingIslandRiver)"
                strokeWidth={river.width} fill="none" strokeLinecap="round" />
          <path d={river.d} stroke="rgba(220,240,255,0.6)"
                strokeWidth={Math.max(0.35, river.width * 0.35)}
                fill="none" strokeLinecap="round"
                style={{ mixBlendMode: 'screen' }} />
        </g>
        {/* A few dangling roots / rocks under the bottom of the island,
            to sell the "floating" silhouette. Hardcoded positions so
            the underside doesn't shift between re-renders. */}
        {[
          { ox: -19.0, len:  6.5, drift:  1.2, w: 0.7 },
          { ox:  -9.5, len:  9.2, drift: -0.8, w: 0.65 },
          { ox:   0.5, len: 11.0, drift:  0.6, w: 0.8 },
          { ox:   9.0, len:  8.0, drift: -1.4, w: 0.6 },
          { ox:  18.0, len:  6.0, drift:  0.9, w: 0.55 },
        ].map((t, i) => (
          <path
            key={'fitend' + i}
            d={`M ${island.cx + t.ox} ${island.cy + island.ryBase * 0.65} q ${t.drift} ${t.len * 0.5}, 0 ${t.len}`}
            stroke="#3a2a18" strokeWidth={t.w}
            fill="none" strokeLinecap="round" opacity="0.85"
          />
        ))}
      </svg>
      <style>{`
        @keyframes floatingIslandCloud {
          0%   { left: -25%; transform: translateY(-50%) scale(var(--ficScale, 1)); }
          100% { left: 125%; transform: translateY(-50%) scale(var(--ficScale, 1)); }
        }
      `}</style>
    </div>
  );
}

// Wowhalla gears — battlefield-wide ambient background painted while
// "Wowhalla, the Hall of the Cool" is in either player's Area zone.
// Large brass-colored gears slowly rotate behind the cards and zones
// (z-index 1 — above the board skin, beneath every card / hero / zone
// frame). Counter-rotating directions and varied sizes keep the
// composition lively without distracting from gameplay.
function WowhallaGearsOverlay() {
  const gears = useMemo(() => {
    // Hand-tuned + filler positions so gears densely populate the
    // battlefield without all clumping. `cw` is now derived at mount
    // (see effect below) by 2-colouring the touch-graph so that any
    // two gears whose outer circles overlap spin in opposite
    // directions, like meshing teeth on real machinery.
    return [
      // Anchors
      { left: -6,   top: 6,    size: 260, dur: 46, delay: 0 },
      { left: 78,   top: -8,   size: 320, dur: 58, delay: -10 },
      { left: 92,   top: 58,   size: 220, dur: 32, delay: -3 },
      { left: 14,   top: 76,   size: 280, dur: 48, delay: -18 },
      { left: 40,   top: 22,   size: 180, dur: 28, delay: -7 },
      { left: 55,   top: 84,   size: 200, dur: 36, delay: -22 },
      { left: -10,  top: 44,   size: 170, dur: 30, delay: -2 },
      // Mid-band fillers
      { left: 22,   top: 38,   size: 130, dur: 24, delay: -12 },
      { left: 62,   top: 30,   size: 150, dur: 26, delay: -16 },
      { left: 36,   top: 56,   size: 140, dur: 22, delay: -4 },
      { left: 72,   top: 50,   size: 130, dur: 20, delay: -9 },
      { left: 8,    top: 26,   size: 110, dur: 18, delay: -1 },
      { left: 50,   top: 12,   size: 120, dur: 22, delay: -14 },
      { left: 84,   top: 36,   size: 140, dur: 24, delay: -8 },
      { left: 4,    top: 60,   size: 130, dur: 26, delay: -19 },
      { left: 32,   top: 8,    size: 100, dur: 16, delay: -5 },
      { left: 66,   top: 70,   size: 160, dur: 30, delay: -11 },
      { left: 46,   top: 70,   size: 110, dur: 18, delay: -15 },
      { left: 26,   top: 92,   size: 150, dur: 28, delay: -23 },
      { left: 76,   top: 92,   size: 130, dur: 22, delay: -6 },
      { left: 96,   top: 80,   size: 110, dur: 20, delay: -13 },
      { left: -2,   top: 88,   size: 120, dur: 22, delay: -20 },
    ];
  }, []);

  // Touch-graph 2-colouring — touching gears must spin oppositely.
  // The container's pixel size is needed to convert `left/top` (%) to
  // actual centres, so we compute the colouring after layout and
  // re-run on resize. Falls back to all-clockwise pre-measurement.
  const containerRef = useRef(null);
  const [spinDirs, setSpinDirs] = useState(() => gears.map(() => true));
  useLayoutEffect(() => {
    const recompute = () => {
      const el = containerRef.current;
      if (!el) return;
      const w = el.offsetWidth || el.clientWidth;
      const h = el.offsetHeight || el.clientHeight;
      if (!w || !h) return;
      // Project each gear's centre into pixel space. `marginLeft/Top`
      // is `-size/2`, so the rendered centre is at exactly
      // `(left% * w, top% * h)`.
      const cx = gears.map(g => (g.left / 100) * w);
      const cy = gears.map(g => (g.top  / 100) * h);
      const r  = gears.map(g => g.size / 2);
      // Build adjacency: any two gears whose outer circles overlap
      // (centre distance < sum of radii) are "touching" and need
      // opposite directions.
      const adj = gears.map(() => []);
      for (let i = 0; i < gears.length; i++) {
        for (let j = i + 1; j < gears.length; j++) {
          const dx = cx[i] - cx[j];
          const dy = cy[i] - cy[j];
          if (Math.hypot(dx, dy) < r[i] + r[j]) {
            adj[i].push(j); adj[j].push(i);
          }
        }
      }
      // BFS 2-colouring per connected component. If the graph isn't
      // bipartite (an odd cycle of touching gears) at least one
      // adjacent pair will end up same-coloured — that's mechanically
      // unavoidable, so accept it rather than thrashing.
      const colour = new Array(gears.length).fill(null);
      for (let s = 0; s < gears.length; s++) {
        if (colour[s] !== null) continue;
        colour[s] = true;
        const queue = [s];
        while (queue.length) {
          const u = queue.shift();
          for (const v of adj[u]) {
            if (colour[v] === null) {
              colour[v] = !colour[u];
              queue.push(v);
            }
          }
        }
      }
      setSpinDirs(colour.map(c => c !== null ? c : true));
    };
    recompute();
    let ro;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(recompute);
      ro.observe(containerRef.current);
    } else {
      window.addEventListener('resize', recompute);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', recompute);
    };
  }, [gears]);
  // SVG gear, drawn once and re-used per instance via a CSS rotation.
  // Brass palette: outer #b78b3a, inner #d6a64a, highlight #f1cc6e.
  const gearSvg = `
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='-100 -100 200 200'>
      <defs>
        <radialGradient id='gg' cx='0' cy='0' r='100' gradientUnits='userSpaceOnUse'>
          <stop offset='0%' stop-color='#f1cc6e'/>
          <stop offset='55%' stop-color='#c89844'/>
          <stop offset='100%' stop-color='#7a5a23'/>
        </radialGradient>
        <radialGradient id='gh' cx='0' cy='0' r='30' gradientUnits='userSpaceOnUse'>
          <stop offset='0%' stop-color='#3a2a10'/>
          <stop offset='100%' stop-color='#0f0a04'/>
        </radialGradient>
      </defs>
      <g>
        ${Array.from({ length: ppFxN(12) }).map((_, i) => {
          const a = (i * 360 / 12);
          return `<rect x='-9' y='-95' width='18' height='22' rx='3' fill='url(#gg)' transform='rotate(${a})'/>`;
        }).join('')}
        <circle cx='0' cy='0' r='78' fill='url(#gg)' stroke='#5b4118' stroke-width='4'/>
        <circle cx='0' cy='0' r='52' fill='none' stroke='#5b4118' stroke-width='3'/>
        ${Array.from({ length: ppFxN(8) }).map((_, i) => {
          const a = (i * 360 / 8) * Math.PI / 180;
          const x = Math.cos(a) * 65, y = Math.sin(a) * 65;
          return `<circle cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' r='7' fill='#5b4118'/>`;
        }).join('')}
        <circle cx='0' cy='0' r='22' fill='url(#gh)' stroke='#3a2a10' stroke-width='3'/>
      </g>
    </svg>
  `;
  const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(gearSvg);
  return (
    <div ref={containerRef} className="wowhalla-gears-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      // No explicit z-index — DOM order keeps the gears beneath every
      // sibling card / hero / zone frame painted after this overlay.
      // Setting z-index would otherwise promote the gears above any
      // sibling that doesn't declare a higher z-index of its own.
      overflow: 'hidden',
      // Slight warm tint — barely visible but ties the gears to a brass-lit hall.
      background: 'radial-gradient(ellipse at 50% 50%, rgba(140,90,40,0.06) 0%, transparent 70%)',
    }}>
      {gears.map((g, i) => (
        <div key={'wg' + i} style={{
          position: 'absolute',
          left: g.left + '%', top: g.top + '%',
          width: g.size + 'px', height: g.size + 'px',
          marginLeft: -g.size / 2, marginTop: -g.size / 2,
          backgroundImage: `url("${dataUrl}")`,
          backgroundSize: 'contain', backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          opacity: 0.42,
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.55))',
          animation: 'wowhallaGearSpin ' + g.dur + 's linear ' + g.delay + 's infinite ' + (spinDirs[i] ? 'normal' : 'reverse'),
        }} />
      ))}
      <style>{`
        @keyframes wowhallaGearSpin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}


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

/**
 * „Spatial Crevice" — Risse im Raum (v1050).
 *
 * Tier 'partial': nur ein paar leuchtende Spruenge ueber dem Brett, kein
 * flaechiger Wash. Die Karte existiert, damit ZWEI weitere Areas liegen
 * koennen; ihr eigener Hintergrund muss sich deshalb zurueckhalten.
 *
 * Die Risse werden einmal gewuerfelt (`useMemo` ohne Abhaengigkeiten),
 * damit sie bei jedem Re-Render an derselben Stelle bleiben — dieselbe
 * Bauform wie Crystal Well und Bonegrinder.
 */
const SpatialCreviceOverlay = React.memo(function SpatialCreviceOverlay() {
  const risse = useMemo(() => Array.from({ length: ppFxN(7) }, (_, i) => {
    // Grob diagonal verteilt, damit sich die Risse nicht haeufen.
    const x = 8 + (i * 13) + Math.random() * 8;
    const y = 12 + Math.random() * 70;
    return {
      left: x,
      top: y,
      laenge: 12 + Math.random() * 26,       // in Prozent der Hoehe
      breite: 0.5 + Math.random() * 1.4,     // in Prozent der Breite
      rot: -35 + Math.random() * 70,
      opacity: 0.35 + Math.random() * 0.45,
      dauer: 4 + Math.random() * 5,
      verzug: Math.random() * 4,
    };
  }), []);

  return (
    <div className="spatial-crevice-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      zIndex: -1, overflow: 'hidden',
    }}>
      {risse.map((r, i) => (
        <span key={'sc' + i} style={{
          position: 'absolute',
          left: r.left + '%', top: r.top + '%',
          width: r.breite + '%', height: r.laenge + '%',
          // ★ Die Drehung MUSS als Variable an die Keyframes gehen: eine
          // laufende Animation ersetzt `transform` komplett, ein hier
          // gesetztes `rotate(...)` waere ab dem ersten Frame weg und
          // alle Risse staenden senkrecht.
          '--sc-rot': r.rot + 'deg',
          transform: `rotate(${r.rot}deg)`,
          transformOrigin: 'center',
          opacity: r.opacity,
          borderRadius: '50%',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(10,0,25,0.95) 20%, rgba(150,80,255,0.9) 50%, rgba(10,0,25,0.95) 80%, rgba(0,0,0,0) 100%)',
          boxShadow: '0 0 10px 2px rgba(160,90,255,0.55), 0 0 22px 6px rgba(90,40,180,0.30)',
          animation: `spatial-crevice-pulse ${r.dauer}s ease-in-out ${r.verzug}s infinite`,
        }} />
      ))}
    </div>
  );
});

// The Bonegrinder — a thinned litter of bones and skulls covering the
// battlefield while the Spell occupies an Area Zone. Rendered as a
// single large overlay with ~40 randomly-placed bones plus ~14
// skulls. Pinned via `inset: 0` so it covers the whole game-board
// container; pointer-events disabled so it never blocks clicks on
// cards / zones below.
//
// Performance notes:
//   • Counts dialed back from 120/40 → 40/14 after the user reported
//     the dense version still dragged on perf. Slightly larger size
//     range compensates for the lower count visually so the field
//     still reads as a boneyard rather than a sparse scatter.
//   • Static positioning ONLY — no per-element animation. Simultaneous
//     CSS animation timelines added a measurable compositor cost
//     during the initial paint; the random rotations + opacities sell
//     "chaotic bone field" without them.
//   • Wrapped in React.memo so the overlay tree only mounts once.
//     Without this, every gameState sync forced a re-walk of all the
//     children even though their props never change.
//   • Random scatter is pre-computed via `useMemo([])` so the same
//     positions persist across the component's lifetime — picking
//     up Bonegrinder mid-game and replaying doesn't reshuffle.
const BonegrinderOverlay = React.memo(function BonegrinderOverlay() {
  // Bone scatter — fully random rotations + wide size range so the
  // pile reads as chaotic. Position is independent x/y random so
  // bones land in zone gaps as well as empty corners.
  const bones = useMemo(() => Array.from({ length: ppFxN(40) }, () => ({
    left: Math.random() * 100,
    top:  Math.random() * 100,
    size: 22 + Math.random() * 32,
    rot:  (Math.random() * 360) | 0,
    opacity: 0.55 + Math.random() * 0.4,
  })), []);
  // Skulls are slightly bigger on average — rarer and more
  // attention-grabbing — and stay close to upright (±25°).
  const skulls = useMemo(() => Array.from({ length: ppFxN(14) }, () => ({
    left: Math.random() * 100,
    top:  Math.random() * 100,
    size: 26 + Math.random() * 24,
    rot:  (Math.random() * 50 - 25) | 0,
    opacity: 0.7 + Math.random() * 0.3,
  })), []);
  return (
    <div className="bonegrinder-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      // zIndex -1 paints this layer BENEATH the board's in-flow
      // content (player sides, area / support / hero / ability /
      // surprise zones, cards). The parent `.board-center` sets
      // `isolation: isolate` so this negative z-index stays confined
      // to the board container — bones don't leak behind the page
      // background. Net result: the litter coats the battlefield
      // floor under everything, never on top of cards or buttons.
      zIndex: -1,
      overflow: 'hidden',
      // Faint warm-bone wash behind the litter — sells "boneyard"
      // without darkening the underlying board.
      background: 'radial-gradient(ellipse at center, rgba(60,40,20,0.10) 0%, rgba(30,20,10,0.18) 100%)',
    }}>
      {bones.map((b, i) => (
        <span key={'b'+i} style={{
          position: 'absolute',
          left: b.left + '%', top: b.top + '%',
          fontSize: b.size + 'px',
          opacity: b.opacity,
          transform: `translate(-50%, -50%) rotate(${b.rot}deg)`,
          textShadow: '0 1px 2px rgba(0,0,0,0.7)',
        }}>🦴</span>
      ))}
      {skulls.map((s, i) => (
        <span key={'s'+i} style={{
          position: 'absolute',
          left: s.left + '%', top: s.top + '%',
          fontSize: s.size + 'px',
          opacity: s.opacity,
          transform: `translate(-50%, -50%) rotate(${s.rot}deg)`,
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}>💀</span>
      ))}
    </div>
  );
});

// ── War Council Gathering Place ──────────────────────────────────────
//  Ein altgriechischer Tempel als Spielfeldhintergrund. Sechs Schichten,
//  bewusst flankenlastig, damit die Brettmitte lesbar bleibt (dasselbe
//  Prinzip wie beim Cottage-Overlay):
//    1. Grundton     — Mittelmeerhimmel oben, warmer Marmorboden unten
//    2. Sonne        — warmer Schein von oben links
//    3. Ferne        — Huegelband und ein schmaler Meerstreifen
//    4. Gebaelk      — Architrav und Giebeldreieck ueber der Szene
//    5. Saeulen      — je drei dorische Saeulen an den Flanken, kanneliert
//    6. Staub        — langsam treibende Partikel im Sonnenlicht
const WarCouncilOverlay = React.memo(function WarCouncilOverlay() {
  // Saeulen: aussen groesser und undurchsichtiger, nach innen kleiner —
  // ergibt Tiefe, ohne die Mitte zuzustellen.
  const columns = useMemo(() => {
    const out = [];
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 3; i++) {
        const depth = i / 2;                       // 0 = aussen, 1 = innen
        const off = 1.5 + i * 7.5;                 // Abstand vom Bildrand
        out.push({
          left: side === 0 ? off : 100 - off - (9 - depth * 3),
          width: 9 - depth * 3,
          top: 12 + depth * 7,
          height: 78 - depth * 16,
          opacity: 0.30 - depth * 0.13,
        });
      }
    }
    return out;
  }, []);

  const motes = useMemo(() => Array.from({ length: ppFxN(30) }, () => ({
    left: 4 + Math.random() * 92,
    top: 12 + Math.random() * 80,
    size: 2 + Math.random() * 3.5,
    dur: 9 + Math.random() * 9,
    delay: Math.random() * 10,
    drift: (Math.random() * 30 - 15).toFixed(1),
  })), []);

  return (
    <div className="warcouncil-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      zIndex: -1, overflow: 'hidden',
      background:
        'linear-gradient(180deg, rgba(120,168,206,0.26) 0%, rgba(176,200,214,0.20) 30%,'
        + ' rgba(214,200,168,0.18) 62%, rgba(196,174,140,0.26) 100%)',
    }}>
      {/* Sonnenlicht von oben links */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 55% at 22% 8%,'
          + ' rgba(255,238,190,0.24) 0%, rgba(255,222,150,0.10) 45%, rgba(0,0,0,0) 78%)',
      }} />

      {/* Ferne Huegel und ein Streifen Meer */}
      <div style={{
        position: 'absolute', left: '-4%', right: '-4%', top: '26%', height: '13%',
        background: 'linear-gradient(180deg, rgba(96,132,150,0.22) 0%, rgba(70,110,132,0.16) 100%)',
        borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '38%', height: '3%',
        background: 'linear-gradient(180deg, rgba(74,132,158,0.26) 0%, rgba(58,110,140,0.14) 100%)',
      }} />

      {/* Gebaelk: Architrav ... */}
      <div style={{
        position: 'absolute', left: '-2%', right: '-2%', top: '9%', height: '4.5%',
        background: 'linear-gradient(180deg, rgba(240,232,212,0.34) 0%, rgba(206,194,170,0.30) 55%,'
          + ' rgba(160,148,126,0.26) 100%)',
        boxShadow: '0 3px 10px rgba(60,50,36,0.22)',
      }} />
      {/* ... und Giebeldreieck darueber */}
      <div style={{
        position: 'absolute', left: '50%', top: '0%',
        width: '54%', height: '10%', transform: 'translateX(-50%)',
        background: 'linear-gradient(180deg, rgba(246,240,224,0.32) 0%, rgba(210,198,172,0.26) 100%)',
        clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
      }} />

      {/* Dorische Saeulen an beiden Flanken */}
      {columns.map((c, i) => (
        <div key={'wc' + i} style={{
          position: 'absolute',
          left: c.left + '%', top: c.top + '%',
          width: c.width + '%', height: c.height + '%',
          opacity: c.opacity,
        }}>
          {/* Kapitell */}
          <div style={{
            position: 'absolute', left: '-14%', top: 0, width: '128%', height: '5%',
            background: 'linear-gradient(180deg, rgba(248,244,232,1) 0%, rgba(198,186,162,1) 100%)',
            borderRadius: '2px',
          }} />
          {/* Schaft mit Kannelierung */}
          <div style={{
            position: 'absolute', left: 0, top: '5%', width: '100%', height: '91%',
            background: 'repeating-linear-gradient(90deg,'
              + ' rgba(250,246,236,1) 0px, rgba(250,246,236,1) 3px,'
              + ' rgba(196,184,160,1) 5px, rgba(232,226,210,1) 8px)',
            boxShadow: 'inset -6px 0 10px rgba(90,78,58,0.35)',
          }} />
          {/* Basis */}
          <div style={{
            position: 'absolute', left: '-10%', bottom: 0, width: '120%', height: '4%',
            background: 'linear-gradient(180deg, rgba(228,220,200,1) 0%, rgba(176,164,140,1) 100%)',
            borderRadius: '2px',
          }} />
        </div>
      ))}

      {/* Staub im Sonnenlicht */}
      {motes.map((m, i) => (
        <span key={'wcm' + i} style={{
          position: 'absolute', left: m.left + '%', top: m.top + '%',
          width: m.size, height: m.size, borderRadius: '50%',
          background: 'rgba(255,244,206,0.85)',
          boxShadow: '0 0 6px rgba(255,232,170,0.7)',
          animation: `wcMote ${m.dur}s ease-in-out ${m.delay}s infinite`,
          '--wcDrift': m.drift + 'px',
        }} />
      ))}

      <style>{`
        @keyframes wcMote {
          0%, 100% { transform: translate(0, 0); opacity: 0; }
          20%      { opacity: .55; }
          50%      { transform: translate(var(--wcDrift), -22px); opacity: .8; }
          80%      { opacity: .4; }
        }
      `}</style>
    </div>
  );
});


// Stinky Stables — enormous face-less dung piles pinned to the LEFT/RIGHT
// margins of the battlefield (zones live in the central ~80%). Unicode has
// no face-less poop emoji (💩 always has eyes/mouth), so each pile is drawn
// as stacked SVG swirls with brown radial gradients. Rendered as the first
// sibling inside .board-center with NO explicit z-index — later flex
// siblings (player sides, area zones, cards) therefore paint on top at
// equal-auto stacking. Stink lines drift up from each pile, flies orbit
// them in little elliptical loops, and a few free-fliers cross the air.
function StinkyStablesOverlay() {
  // 4 piles per side, vertically spread. Horizontal jitter stays inside
  // the safe outer-margin strip (≈3–7% on each side) so piles never drift
  // into the zone-filled middle.
  const piles = useMemo(() => {
    const makeSide = (xBase, flip) => Array.from({ length: 4 }, (_, i) => ({
      left: xBase + (Math.random() * 3 - 1.5),
      top: 6 + i * 23 + (Math.random() * 6 - 3),
      size: 80 + Math.random() * 55,
      skew: -8 + Math.random() * 16,
      flipX: flip,
      tint: Math.floor(Math.random() * 3),
    }));
    return [...makeSide(4, 1), ...makeSide(96, -1)];
  }, []);
  // Flies orbiting each pile — per-fly elliptical radii + phase so the
  // swarm doesn't read as marching in lockstep.
  const orbitFlies = useMemo(() => piles.flatMap((p, pi) =>
    Array.from({ length: 3 + Math.floor(Math.random() * 2) }, () => ({
      pileIdx: pi,
      anchorLeft: p.left,
      anchorTop: p.top,
      rx: 18 + Math.random() * 20,
      ry: 10 + Math.random() * 14,
      phase: Math.random(),
      dur: 2.6 + Math.random() * 2.2,
      size: 2.3 + Math.random() * 1.8,
    }))
  ), [piles]);
  // A handful of free flies meander across the battlefield air.
  const freeFlies = useMemo(() => Array.from({ length: ppFxN(8) }, () => ({
    left: 3 + Math.random() * 94,
    top: 8 + Math.random() * 80,
    delay: -Math.random() * 3.5,
    dur: 3.5 + Math.random() * 2.5,
    size: 2 + Math.random() * 1.4,
  })), []);
  // Two or three wavy smoke trails rising above each pile.
  const stinkLines = useMemo(() => piles.flatMap((p) =>
    Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => ({
      left: p.left + (Math.random() * 5 - 2.5),
      top: p.top - 3 + (Math.random() * 3 - 1.5),
      delay: -Math.random() * 3,
      dur: 2.8 + Math.random() * 1.6,
      sway: -6 + Math.random() * 12,
    }))
  ), [piles]);
  const tints = [
    { light: '#8a5a2a', mid: '#5a3616', dark: '#321e0a' },
    { light: '#7a4a20', mid: '#4a2a10', dark: '#2a1808' },
    { light: '#94643a', mid: '#624020', dark: '#3a220e' },
  ];
  // Per-fly orbital keyframes — each fly needs its own ellipse. Build the
  // <style> body once via useMemo so it doesn't churn every render.
  const orbitKeyframes = useMemo(() => orbitFlies.map((f, i) =>
    `@keyframes stinkyOrbit${i} {
       0%   { transform: translate(${f.rx.toFixed(1)}px, 0); }
       25%  { transform: translate(0, ${(-f.ry).toFixed(1)}px); }
       50%  { transform: translate(${(-f.rx).toFixed(1)}px, 0); }
       75%  { transform: translate(0, ${f.ry.toFixed(1)}px); }
       100% { transform: translate(${f.rx.toFixed(1)}px, 0); }
     }`
  ).join('\n'), [orbitFlies]);
  return (
    <div className="stinky-stables-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'hidden',
      // Mild miasma — kept light so it doesn't fight card readability.
      background: 'radial-gradient(ellipse at center, rgba(70,58,24,0.10) 0%, rgba(40,35,15,0.20) 100%)',
    }}>
      {piles.map((p, i) => {
        const c = tints[p.tint];
        const gid = `stinkyPoo${i}`;
        return (
          <div key={'p' + i} style={{
            position: 'absolute',
            left: p.left + '%', top: p.top + '%',
            width: p.size + 'px', height: p.size + 'px',
            transform: `translate(-50%, -50%) scaleX(${p.flipX}) skewX(${p.skew}deg)`,
            filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.55))',
          }}>
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <defs>
                <radialGradient id={gid} cx="40%" cy="30%" r="80%">
                  <stop offset="0%" stopColor={c.light} />
                  <stop offset="55%" stopColor={c.mid} />
                  <stop offset="100%" stopColor={c.dark} />
                </radialGradient>
              </defs>
              <ellipse cx="50" cy="94" rx="44" ry="5" fill="rgba(0,0,0,0.45)" />
              <path d="M 8,80 Q 8,60 26,56 Q 50,40 74,56 Q 92,60 92,80 Q 92,93 50,93 Q 8,93 8,80 Z"
                    fill={`url(#${gid})`} />
              <path d="M 22,62 Q 22,44 36,40 Q 50,28 64,40 Q 78,44 78,62 Q 78,73 50,73 Q 22,73 22,62 Z"
                    fill={`url(#${gid})`} />
              <path d="M 36,44 Q 36,28 44,26 Q 50,18 56,26 Q 64,28 64,44 Q 64,54 50,54 Q 36,54 36,44 Z"
                    fill={`url(#${gid})`} />
              <ellipse cx="50" cy="17" rx="3" ry="4.5" fill={c.dark} />
              <ellipse cx="32" cy="66" rx="8" ry="3" fill="rgba(210,170,110,0.32)" />
              <ellipse cx="42" cy="46" rx="6" ry="2.5" fill="rgba(210,170,110,0.32)" />
              <ellipse cx="47" cy="28" rx="3" ry="1.5" fill="rgba(210,170,110,0.38)" />
            </svg>
          </div>
        );
      })}
      {/* Stink lines — wavy green-brown smoke rising above each pile */}
      {stinkLines.map((s, i) => (
        <div key={'s' + i} style={{
          position: 'absolute',
          left: s.left + '%', top: s.top + '%',
          width: 24, height: 70,
          transform: 'translate(-50%, -100%)',
          animation: `stinkyStink ${s.dur}s ease-in-out ${s.delay}s infinite`,
          opacity: 0,
          '--stinkSway': s.sway + 'px',
        }}>
          <svg viewBox="0 0 24 70" width="100%" height="100%" preserveAspectRatio="none">
            <path d="M 12,70 C 18,56 4,44 18,30 C 30,16 6,8 14,0"
                  stroke="rgba(120,150,80,0.75)" strokeWidth="2.2" fill="none"
                  strokeLinecap="round" />
            <path d="M 12,70 C 8,58 20,46 10,34 C 0,22 18,14 12,2"
                  stroke="rgba(100,130,60,0.55)" strokeWidth="1.6" fill="none"
                  strokeLinecap="round" />
          </svg>
        </div>
      ))}
      {/* Orbital flies — anchor wrap + inner transform keeps orbit keyframes
          transform-only while the pile position stays in percent units. */}
      {orbitFlies.map((f, i) => (
        <div key={'of' + i} style={{
          position: 'absolute',
          left: f.anchorLeft + '%', top: f.anchorTop + '%',
          width: 0, height: 0,
        }}>
          <span style={{
            position: 'absolute',
            left: -f.size / 2, top: -f.size / 2,
            width: f.size + 'px', height: f.size + 'px',
            background: '#0a0a0a', borderRadius: '50%',
            boxShadow: '0 0 2px rgba(0,0,0,0.9)',
            animation: `stinkyOrbit${i} ${f.dur}s linear infinite`,
            animationDelay: `-${(f.phase * f.dur).toFixed(2)}s`,
            willChange: 'transform',
          }} />
        </div>
      ))}
      {/* Free-flying flies meandering across the battlefield */}
      {freeFlies.map((f, i) => (
        <span key={'ff' + i} style={{
          position: 'absolute',
          left: f.left + '%', top: f.top + '%',
          width: f.size + 'px', height: f.size + 'px',
          background: '#0a0a0a', borderRadius: '50%',
          boxShadow: '0 0 2px rgba(0,0,0,0.9)',
          animation: `stinkyFlyFree ${f.dur}s ease-in-out ${f.delay}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes stinkyStink {
          0%   { opacity: 0; transform: translate(-50%, -100%) scale(0.5); }
          25%  { opacity: 0.85; }
          70%  { opacity: 0.45; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--stinkSway, 0px)), -160%) scale(1.1); }
        }
        @keyframes stinkyFlyFree {
          0%   { transform: translate(0, 0); }
          15%  { transform: translate(14px, -8px); }
          30%  { transform: translate(-8px, -18px); }
          50%  { transform: translate(22px, -10px); }
          70%  { transform: translate(6px, -22px); }
          85%  { transform: translate(-14px, -12px); }
          100% { transform: translate(0, 0); }
        }
        ${orbitKeyframes}
      `}</style>
    </div>
  );
}

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

// ── DARK OCEAN ───────────────────────────────────────────────────────
//  Karte: dunkelgraue, farblose Meeresoberflaeche. Als Vorgabe (5.8.):
//  dunkelgrau, entsaettigt, bedrohlich, mit Seegang — die Karten duerfen
//  nicht verschleiert werden. Zwei Wellenebenen ziehen gegeneinander,
//  darunter gleitet ab und zu ein grosser Schatten vorbei.
const DOC = '/areas/dark-ocean/';
const DarkOceanOverlay = React.memo(function DarkOceanOverlay() {
  return (
    <PixelScene artH={100} bg="#323335" className="dark-ocean-overlay">
      <PixelBand src={DOC + 'tile.png'} />
      <i className="pp-area-dyn doc-schatten" />
      <div className="pp-pixel-layer doc-welle a" />
      <div className="pp-pixel-layer doc-welle b" />
      <div className="doc-dim" />
      <style>{`
        .doc-welle { position: absolute; inset: 0; background-size: auto 100%; background-repeat: repeat-x; }
        .doc-welle.a { background-image: url(${DOC}waves-a.png); animation: docZugL 9s steps(64) infinite, docHebung 3.1s ease-in-out infinite alternate; }
        .doc-welle.b { background-image: url(${DOC}waves-b.png); animation: docZugR 13s steps(64) infinite, docHebung 4.3s ease-in-out -1.2s infinite alternate; }
        @keyframes docZugL { from { background-position: 0 0; } to { background-position: calc(-64 * var(--px)) 0; } }
        @keyframes docZugR { from { background-position: 0 0; } to { background-position: calc(64 * var(--px)) 0; } }
        @keyframes docHebung { from { transform: translateY(0); } to { transform: translateY(calc(2 * var(--px))); } }
        .doc-schatten {
          position: absolute; top: 0; left: 0; width: calc(90 * var(--px)); height: calc(30 * var(--px));
          background: url(${DOC}shadow.png) 0 0 / 100% 100% no-repeat;
          animation: docSchatten 46s linear infinite;
        }
        @keyframes docSchatten {
          0% { transform: translate(calc(-100 * var(--px)), calc(48 * var(--px))); }
          100% { transform: translate(calc(100cqw + 10 * var(--px)), calc(40 * var(--px))); }
        }
        .doc-dim { position: absolute; inset: 0; background: radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,.45) 100%); }
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

// ── GRAVEYARD OF LIMITED POWER ───────────────────────────────────────
//  Karte: Kiesboden, rosa Grabsteine mit rotem Schein, dunkler Baum mit
//  Laterne. Der rote Schein pulsiert, Seelen steigen aus den Graebern,
//  Bodennebel zieht, die Laterne flackert.
const GYD = '/areas/graveyard/';
const GYD_GRAEBER = [[14, 18], [46, 44], [16, 70], [48, 88]];     // Kachel-Koordinaten
const GraveyardOfLimitedPowerOverlay = React.memo(function GraveyardOfLimitedPowerOverlay() {
  const seelen = useMemo(() => ppZufall(ppFxN(8), () => {
    const [gx, gy] = GYD_GRAEBER[Math.floor(Math.random() * GYD_GRAEBER.length)];
    const k = Math.floor(Math.random() * 7) - 3;
    return { x: gx - 32 + k * 64, y: gy - 10, dur: 3.5 + Math.random() * 3, delay: -Math.random() * 7 };
  }), []);
  return (
    <PixelScene artH={100} bg="#484848" className="graveyard-overlay">
      <PixelBand src={GYD + 'tile.png'} />
      <PixelBand src={GYD + 'tile-glow.png'} className="gyd-schein" />
      <div className="pp-pixel-layer gyd-nebel" style={{ top: ppArt(36) }} />
      {/* Baum rechts, Stamm in der freien Spalte der Grabkachel (Kachel-x 30:
          x 62 neben der Mitte → (62 + 32) mod 64 = 30) — kein Grab darunter. */}
      <PixelPiece src={GYD + 'tree.png'} w={40} x={62} />
      <PixelPiece src={GYD + 'tree-glow.png'} w={40} x={62} className="gyd-laterne" />
      {seelen.map((s, i) => (
        <i key={i} className="pp-area-dyn gyd-seele" style={{ left: ppArtX(s.x - 2, 0), top: ppArt(s.y), animation: `ppSprite3 .5s steps(1) infinite, gydSteigen ${s.dur}s ease-out ${s.delay}s infinite` }} />
      ))}
      <div className="pp-pixel-layer gyd-nebel b" style={{ top: ppArt(76) }} />
      <div className="pp-rand-dim" />
      <style>{`
        .gyd-schein { animation: gydPuls 3.2s ease-in-out infinite alternate; }
        @keyframes gydPuls { from { opacity: .45; } to { opacity: 1; } }
        .gyd-laterne { animation: gydFlackern 2.3s steps(1) infinite; }
        @keyframes gydFlackern { 0% { opacity: 1; } 21% { opacity: .7; } 24% { opacity: 1; } 55% { opacity: .85; } 58% { opacity: .6; } 61% { opacity: 1; } }
        .gyd-nebel {
          position: absolute; left: 0; right: 0; height: calc(20 * var(--px));
          background: url(${GYD}fog.png) 0 0 / auto 100% repeat-x; opacity: .7; animation: gydNebel 55s linear infinite;
        }
        .gyd-nebel.b { animation-duration: 80s; animation-direction: reverse; opacity: .5; }
        @keyframes gydNebel { from { background-position: 0 0; } to { background-position: calc(64 * var(--px)) 0; } }
        .gyd-seele { position: absolute; width: calc(4 * var(--px)); height: calc(5 * var(--px)); background: url(${GYD}wisp.png) 0 0 / 300% 100% no-repeat; opacity: 0; }
        @keyframes gydSteigen { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: .9; } 100% { transform: translateY(calc(-14 * var(--px))); opacity: 0; } }
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

// ===== CROSS-FILE EXPORTS =====
// Kampfbrett und Puzzle-Creator zeichnen DIESELBE Schicht (v1202).
window.AreaBackgrounds = AreaBackgrounds;
