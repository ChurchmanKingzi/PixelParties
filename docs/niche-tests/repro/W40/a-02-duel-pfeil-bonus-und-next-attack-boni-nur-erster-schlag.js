'use strict';
// W40a · Punkt 2 · Al, 22.10.2026 (Antwort auf W39a-Rückfrage 2): „Jeder Schlag gilt als eigene Attack, ja. Aber Arrows boosten nur EINE Attack, also würde ein Pfeil-Bonus nur den ersten Schlag buffen und dann enden."
// Regel: Jeder Duel-Schlag zählt weiter als eigene Attack (Zähler, passive Attack-Boni wie Warhorse je Schlag). Ein aktiver Pfeil-Bonus (Arrows, Magic Topaz, Bow Sniper Darge: „that Attack") und jeder
// „next Attack"-Bonus (Elixir of Strength, Guardian Beast Niu, Glass Sword, Shattered Trident) gilt nur für die ERSTE Attack — bei Duel nur für den ersten Schlag, die Schläge 2 und 3 bekommen ihn nicht.
// Ursache auf der Basis: die Pfeile blieben bis zum Ende der Karte scharf (`hero._armedArrows`, geräumt erst nach `afterSpellResolved`) und wirkten auf alle drei Schläge; `duell()` räumt sie jetzt nach dem
// ersten Schlag ab (`clearArmedArrows`; Golden Arrow zahlt dort aus). Elixir of Strength/Niu/Glass Sword/Trident verbrauchten sich schon am ersten Treffer (Gegenprobe, schon korrekt).
// Zusätzlich: spielt Held 1 das Duel, duelliert aber Held 0, geht der Pfeil-Bonus an den Duellanten (Held 0), nicht an den spielenden Held 1 (der gar nicht schlägt).
// Exit 1 auf der Basis (Pfeile auf allen drei Schlägen), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W40/a-02-duel-pfeil-bonus-und-next-attack-boni-nur-erster-schlag.js   (Exit 0 = korrekt)
const L = require('../W39/_helfer.js');
const { H, setzeFrei } = L;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const buff = (t, s, hi, key, v) => { const h = t.hero(s, hi); h.buffs = h.buffs || {}; h.buffs[key] = v; };
const gleich = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const grant = (n) => async (t, k) => { t.grantFor(k.as, k.held, n); };
    const FAELLE = [
      { id: 'Basis (kein Bonus)', o: {}, schlaege: [100, 100, 100] },
      { id: 'Angelfeather Arrow (+60)', o: { attHand: ['Angelfeather Arrow'], vorbereiten: grant('Angelfeather Arrow') }, schlaege: [160, 100, 100] },
      { id: 'Magic Topaz (+60)', o: { attHand: ['Magic Topaz'], vorbereiten: grant('Magic Topaz') }, schlaege: [160, 100, 100] },
      { id: 'Bomb Arrow (+10)', o: { attHand: ['Bomb Arrow'], vorbereiten: grant('Bomb Arrow') }, schlaege: [110, 100, 100] },
      { id: "Rainbow's Arrow (+10, zieht 2 Karten EINMAL)", o: { attHand: ["Rainbow's Arrow"], vorbereiten: grant("Rainbow's Arrow") }, schlaege: [110, 100, 100], pruef: (t) => t.gs.players[me].hand.length === 2 },
      { id: 'Flame Arrow (+10, Burn)', o: { attHand: ['Flame Arrow'], vorbereiten: grant('Flame Arrow') }, schlaege: [110, 100, 100], pruef: (t) => !!t.hero(op, 0).statuses.burned },
      { id: 'Poisoned Arrow (+10, genau 1 Stack Gift)', o: { attHand: ['Poisoned Arrow'], vorbereiten: grant('Poisoned Arrow') }, schlaege: [110, 100, 100], pruef: (t) => (t.hero(op, 0).statuses.poisoned?.stacks || 0) === 1 },
      { id: 'Golden Arrow (+10 Gold, einmal)', o: { attHand: ['Golden Arrow'], vorbereiten: grant('Golden Arrow') }, schlaege: [100, 100, 100], pruef: (t) => t.gs.players[me].gold === 110 },
      { id: 'Hydra Blood Arrow (Schlag 1 auf 0, 3 Stacks aus 100)', o: { attHand: ['Hydra Blood Arrow'], vorbereiten: grant('Hydra Blood Arrow') }, schlaege: [0, 100, 100], pruef: (t) => (t.hero(op, 0).statuses.poisoned?.stacks || 0) === 3 },
      { id: 'Bow Sniper Darge + Angelfeather (+60 +50)', o: { attHand: ['Angelfeather Arrow'], vorbereiten: async (t, k) => { t.grantFor(k.as, k.held, 'Angelfeather Arrow'); t.setHero(k.as, 0, 'Bow Sniper Darge', 800); t.hero(k.as, 0).atk = 100; t.hero(k.as, 0).baseAtk = 100; } }, schlaege: [210, 100, 100] },
      { id: 'Elixir of Strength (+100, nur der erste Treffer)', o: { vorbereiten: async (t, k) => buff(t, k.as, 0, 'empowered_strike', {}) }, schlaege: [200, 100, 100] },
      { id: 'Guardian Beast Niu (+100, nur der erste Treffer)', o: { vorbereiten: async (t, k) => buff(t, k.as, 0, 'niu_enhanced', { totalDamage: 100, stacks: 2 }) }, schlaege: [200, 100, 100] },
      { id: 'Glass Sword (+50, nur der erste Treffer)', o: { vorbereiten: async (t, k) => { setzeFrei(t, k.as, 0, 'Glass Sword'); } }, schlaege: [150, 100, 100] },
      { id: 'Shattered Trident (+ATK, nur der erste Treffer)', o: { vorbereiten: async (t, k) => { setzeFrei(t, k.as, 0, 'Shattered Trident, Treasure of the Deepsea'); } }, schlaege: [200, 100, 100] },
      { id: 'Gegenprobe Warhorse (passiv, JEDER Schlag ist eine Attack: +50 je Schlag)', o: { vorbereiten: async (t, k) => { setzeFrei(t, k.as, 0, 'Warhorse'); } }, schlaege: [150, 150, 150] },
    ];
    for (const f of FAELLE) {
      let r;
      try { r = await L.szene('Duel', me, op, f.o); } catch (e) { R.check(f.id + ': Szene baubar', false, String(e && e.stack || e).slice(0, 300)); continue; }
      const t = r.t;
      const mine = t.treffer.filter(x => x.srcOwner === me && x.srcHero === 0).map(x => x.amount);
      R.check(f.id + ': Schläge des Duellanten', gleich(mine, f.schlaege), { erwartet: f.schlaege, ist: mine });
      if (f.pruef) R.check(f.id + ': Nebenwirkung genau einmal', f.pruef(t) === true, { gold: t.gs.players[me].gold, hand: t.gs.players[me].hand.length, st: JSON.stringify(t.hero(op, 0).statuses) });
      R.check(f.id + ': Gegner schlägt weiter 3 mal ohne Bonus', gleich(t.treffer.filter(x => x.srcOwner === op).map(x => x.amount), [100, 100, 100]), t.treffer.filter(x => x.srcOwner === op).map(x => x.amount));
      R.check(f.id + ': keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { errors: t.errors, audit: t.audit() });
    }

    // ── Held 1 spielt Duel, Held 0 duelliert: der Pfeil gehört dem Duellanten ──
    const r = await L.szene('Duel', me, op, { attHand: ['Angelfeather Arrow'], nicht: true, vorbereiten: async (t, k) => { t.grantFor(me, 0, 'Angelfeather Arrow'); t.grantFor(me, 1, 'Duel'); t.grantFor(me, 1, 'Angelfeather Arrow'); } });
    const t = r.t;
    t.gs._deferGameOverCheck = true;
    t.targetFn = (v) => [(posHero(v, v[0].owner, 0) || v[0]).id];
    const ok = await t.play(me, 'Duel', { hero: 1 });
    const mine = t.treffer.filter(x => x.srcOwner === me).map(x => x.amount);
    R.check('Held 1 spielt Duel, Held 0 duelliert: Pfeil-Bonus auf dem ersten Schlag des Duellanten, danach nicht', ok === true && gleich(mine, [160, 100, 100]), { ok, mine });
    R.check('  keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { errors: t.errors, audit: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
