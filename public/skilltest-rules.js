// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — REGELN DER VORBEREITUNGSPHASE (rein, ohne I/O)
//
//  Dieses Modul läuft IDENTISCH im Browser (window.SkillTestRules) und
//  auf dem Server (require('../public/skilltest-rules.js') — dasselbe
//  Muster wie public/profanity.js). Der Server ist maßgeblich; der
//  Client nutzt `canDrop` nur, um gültige Ablageziele zu beleuchten.
//
//  Zustand eines Spielers ("Basis", `ps`) — nur JSON, nichts Zyklisches:
//    hand            string[]                    Handkarten (Reihenfolge zählt)
//    heroes          (string|null)[3]            Hero-Zonen
//    abilityZones    [3][3] of null | { n, s, c }
//                      n = Name, s = Anzahl START-Einträge (Level; im Skill Test immer START_ABILITY_LEVEL = 3), c = Handkarte darauf
//                      Stapelhöhe (Level) = c ? 3 : s      (Hand-Ability levelt auf 3)
//    supportZones    [3][3] of string[]          je Zone ein Stapel (meist 1 Karte)
//    surpriseZones   (string|null)[3]
//    areaZone        string[]                    Area-Karten (Limit: areaLimitOf)
//    spawned         [3][3] of boolean           Support-Zone enthält eine „aus dem Nichts“ erschienene Karte
//                                                (Idej Lords, siehe IDEJ_PACKAGES): nicht aufnehmbar, nicht
//                                                recycelbar — nur löschen oder überbauen; verschwindet mit dem Hero
//    recycled        number                      Karten im Recycler
//    ready           boolean
//
//  `env` (vom Aufrufer): { cards: { [name]: kartendaten }, areaLimitOf(name) -> number|undefined,
//                          random?: () => number }   (random: Auswahl der Idej Blades; Standard Math.random)
//
//  ERWEITERN: neue Platzierungsregeln gehören in `zoneAccepts` (Typen)
//  oder in die Konstanten ganz oben — nirgends sonst.
// ═══════════════════════════════════════════════════════════════════
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkillTestRules = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ZHIGAO = 'Zhigao, the Heavenly Emperor';
  // Heroes, die NIE als Brett-Hero aufgestellt werden dürfen: Quetzahuitl bleibt auf der Hand und greift erst ein, wenn dein
  // letzter Hero außerhalb deines Zuges fällt. Er zählt deshalb nicht zu den Heroes, die das Brett füllen können
  // (→ mindestens 4 Heroes insgesamt; pool.dealHand sorgt dafür, dass er nur in Händen mit ≥ 4 Heroes landet).
  const HAND_ONLY_HEROES = ['Quetzahuitl, Receiver of Sacrifices'];
  // Helden, deren Support Zones Abilities aufnehmen (spiegelt engine.heroAcceptsAbilitiesInSupport).
  const ABILITY_SUPPORT_CARDS = ['Xal, the Animated Armor', 'Xalibur'];
  // Potions werden im Modus NICHT als Biomancy-Token auf die Basis gelegt.
  const POTIONS_ON_BOARD = false;
  const MAX_ABILITY_LEVEL = 3;
  // Start-Abilities der Heroes beginnen im Skill Test auf der HÖCHSTEN Stufe (im Normalspiel Stufe 1, bei doppelter Start-Ability 2):
  // ohne Deck und mit nur 18 Karten bliebe sonst ein Großteil der Zauber/Angriffe auf der Hand unbrauchbar.
  const START_ABILITY_LEVEL = 3;
  // Idej Lords: beim Aufstellen erscheinen ihre „zugehörigen Karten“ aus dem Nichts in den Support Zones des Heroes
  // (im echten Spiel sucht der Lord sie zu Spielbeginn aus dem Deck — der Skill Test hat kein Deck). `proj` = Idej Projection,
  // `blade` = Idej Blade (zufällig, je Lord verschieden). Verlässt der Lord das Brett, verschwinden sie.
  const IDEJ_PROJECTION = 'Idej Projection';
  const IDEJ_BLADES = ['Idej Blade - Gensui', 'Idej Blade - Hakai', 'Idej Blade - Manabi', 'Idej Blade - Naosu'];
  const IDEJ_PACKAGES = {
    'Idej Lord Daiyo':     { proj: 3, blade: 0 },
    'Idej Lord Nobunakin': { proj: 2, blade: 1 },
    'Idej Lord Shoguwana': { proj: 1, blade: 2 },
    'Idej Lord Todugawin': { proj: 0, blade: 3 },
  };
  const SPAWNED_ONLY_DELETE = 'Diese Karte ist aus dem Nichts erschienen — sie lässt sich nur löschen (Rechtsklick) oder überbauen, nicht aufnehmen oder recyceln.';

  const sameCopyFamily = (n, base) => !!n && (n === base || n.startsWith(base + ' ('));

  function emptyPlayer() {
    return {
      hand: [],
      heroes: [null, null, null],
      abilityZones: [[null, null, null], [null, null, null], [null, null, null]],
      supportZones: [[[], [], []], [[], [], []], [[], [], []]],
      surpriseZones: [null, null, null],
      areaZone: [],
      spawned: [[false, false, false], [false, false, false], [false, false, false]],
      recycled: 0,
      ready: false,
    };
  }

  /** Ältere Zustände ohne `spawned` auffüllen (auf einer Kopie aufrufen). */
  function ensureSpawned(ps) {
    if (!Array.isArray(ps.spawned)) ps.spawned = [[false, false, false], [false, false, false], [false, false, false]];
    return ps;
  }
  const isSpawned = (ps, hi, slot) => !!(ps.spawned && ps.spawned[hi] && ps.spawned[hi][slot]);

  /** Alle aus dem Nichts erschienenen Karten dieser Spalte entfernen (sie gehen NICHT auf die Hand). */
  function despawn(ps, hi) {
    ensureSpawned(ps);
    for (let z = 0; z < 3; z++) {
      if (!ps.spawned[hi][z]) continue;
      ps.supportZones[hi][z] = [];
      ps.spawned[hi][z] = false;
    }
  }

  /** Das Paket eines Idej Lords in die Support Zones der Spalte legen (freie Zonen zuerst, sonst weicht eine Handkarte zurück auf die Hand). */
  function spawnFor(env, ps, hi, heroName) {
    const pack = IDEJ_PACKAGES[heroName];
    if (!pack) return;
    ensureSpawned(ps);
    const rnd = (env && env.random) || Math.random;
    const blades = IDEJ_BLADES.map(n => ({ n, k: rnd() })).sort((a, b) => a.k - b.k).slice(0, pack.blade).map(x => x.n);
    const names = [...Array(pack.proj).fill(IDEJ_PROJECTION), ...blades];
    // Reihenfolge der Zonen: erst die leeren, dann besetzte (deren Karte kehrt auf die Hand zurück).
    const order = [0, 1, 2].sort((a, b) => ((ps.supportZones[hi][a].length ? 1 : 0) - (ps.supportZones[hi][b].length ? 1 : 0)) || (a - b));
    const slots = order.slice(0, names.length).sort((a, b) => a - b);
    slots.forEach((slot, i) => {
      const st = ps.supportZones[hi][slot];
      if (st.length) ps.hand.push(st[0]);
      ps.supportZones[hi][slot] = [names[i]];
      ps.spawned[hi][slot] = true;
    });
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ── Abgeleitete Größen ────────────────────────────────────────────
  const heroNames = (ps) => ps.heroes.filter(Boolean);
  const hasZhigao = (ps) => heroNames(ps).some(n => sameCopyFamily(n, ZHIGAO));
  /** Wie viele Helden verlangt die Aufstellung? (Zhigao: genau 2) */
  const requiredHeroes = (ps) => (hasZhigao(ps) ? 2 : 3);
  const heroCount = (ps) => heroNames(ps).length;
  const boardFull = (ps) => heroCount(ps) === requiredHeroes(ps);

  function abilityLevel(z) { return !z ? 0 : (z.c ? MAX_ABILITY_LEVEL : (z.s || 0)); }

  function isCreatureLike(c) {
    return c.cardType === 'Creature' || c.cardType === 'Token' || c.cardType === 'Creature/Token'
      || (c.subtype || '').split('/').some(t => t.trim() === 'Creature');
  }

  function heroAcceptsSupportAbilities(ps, hi) {
    const h = ps.heroes[hi];
    if (!h) return false;
    if (ABILITY_SUPPORT_CARDS.includes(h)) return true;
    return (ps.supportZones[hi] || []).some(slot => (slot || []).some(n => ABILITY_SUPPORT_CARDS.includes(n)));
  }

  function areaLimit(env, ps) {
    let lim = 1;
    for (const n of ps.areaZone) { const l = env.areaLimitOf && env.areaLimitOf(n); if (l && l > lim) lim = l; }
    return lim;
  }
  function canPlaceAnotherArea(env, ps, name) {
    return !ps.areaZone.includes(name) && ps.areaZone.length < areaLimit(env, ps);
  }

  /**
   * Nimmt diese Zone diese Karte grundsätzlich auf (Typregel, ohne Besetzung)?
   * `target`: { kind:'hero'|'ability'|'support'|'surprise'|'area', hi, slot }
   */
  function zoneAccepts(env, ps, card, target) {
    const c = env.cards[card]; if (!c) return false;
    const { kind, hi } = target;
    if (kind === 'hero') return c.cardType === 'Hero' && !HAND_ONLY_HEROES.includes(card);
    if (kind === 'ability') return c.cardType === 'Ability' && !!ps.heroes[hi];
    if (kind === 'support') {
      if (!ps.heroes[hi]) return false;
      if (c.cardType === 'Potion') return POTIONS_ON_BOARD;
      if (c.cardType === 'Ability') return heroAcceptsSupportAbilities(ps, hi);
      return isCreatureLike(c) || c.subtype === 'Equipment' || c.subtype === 'Attachment';
    }
    if (kind === 'surprise') return !!ps.heroes[hi] && c.subtype === 'Surprise';
    if (kind === 'area') return c.subtype === 'Area';
    return false;
  }

  // ── Zustandsänderungen (auf einer KOPIE; Rückgabe { ok, ps, reason }) ──

  const fail = (reason) => ({ ok: false, reason });

  /** Karte aus einer Quelle herausnehmen. Liefert { name } oder { error }. */
  function takeOut(ps, src) {
    switch (src.kind) {
      case 'hand': {
        const name = ps.hand[src.idx];
        if (name == null) return { error: 'Karte nicht (mehr) auf der Hand.' };
        ps.hand.splice(src.idx, 1);
        return { name };
      }
      case 'hero': {
        const name = ps.heroes[src.hi];
        if (!name) return { error: 'Hier steht kein Hero.' };
        // Die ganze Spalte verlässt das Feld: Hand-Abilities, Support- und Surprise-Karten kehren zurück
        // (aus dem Nichts erschienene Karten verschwinden dagegen).
        despawn(ps, src.hi);
        for (let z = 0; z < 3; z++) {
          const az = ps.abilityZones[src.hi][z];
          if (az && az.c) ps.hand.push(az.n);
          ps.abilityZones[src.hi][z] = null;
          for (const s of ps.supportZones[src.hi][z]) ps.hand.push(s);
          ps.supportZones[src.hi][z] = [];
        }
        if (ps.surpriseZones[src.hi]) ps.hand.push(ps.surpriseZones[src.hi]);
        ps.surpriseZones[src.hi] = null;
        ps.heroes[src.hi] = null;
        return { name, columnReturned: true };
      }
      case 'ability': {
        const az = ps.abilityZones[src.hi][src.slot];
        if (!az || !az.c) return { error: 'Start-Abilities sind fest — nur löschen ist möglich.' };
        az.c = false;
        if (!az.s) ps.abilityZones[src.hi][src.slot] = null;
        return { name: az.n };
      }
      case 'support': {
        const st = ps.supportZones[src.hi][src.slot];
        if (!st.length) return { error: 'Zone ist leer.' };
        if (isSpawned(ps, src.hi, src.slot)) return { error: SPAWNED_ONLY_DELETE };
        // Ein Ability-Stapel (Xal) ist EINE Karte auf Level 3 — es kehrt nur ein Exemplar zurück.
        ps.supportZones[src.hi][src.slot] = [];
        return { name: st[0] };
      }
      case 'surprise': {
        const n = ps.surpriseZones[src.hi];
        if (!n) return { error: 'Zone ist leer.' };
        ps.surpriseZones[src.hi] = null;
        return { name: n };
      }
      case 'area': {
        const n = ps.areaZone[src.idx != null ? src.idx : ps.areaZone.length - 1];
        if (n == null) return { error: 'Zone ist leer.' };
        ps.areaZone.splice(src.idx != null ? src.idx : ps.areaZone.length - 1, 1);
        return { name: n };
      }
      default: return { error: 'Unbekannte Quelle.' };
    }
  }

  /** Startfähigkeiten eines Heroes in seine Ability-Zonen legen (wie das echte Spiel). */
  function installStartAbilities(env, ps, hi, heroName) {
    const c = env.cards[heroName];
    const a1 = c && c.startingAbility1 || '';
    const a2 = c && c.startingAbility2 || '';
    const Z = ps.abilityZones[hi];
    const S = START_ABILITY_LEVEL;
    if (a1 && a2 && a1 === a2) Z[1] = { n: a1, s: S, c: false };
    else if (a1 && !a2) Z[1] = { n: a1, s: S, c: false };
    else if (!a1 && a2) Z[1] = { n: a2, s: S, c: false };
    else { if (a1) Z[0] = { n: a1, s: S, c: false }; if (a2) Z[1] = { n: a2, s: S, c: false }; }
  }

  /** Karte an ein Ziel legen. Verdrängte Karten gehen auf die Hand. */
  function putIn(env, ps, name, dst) {
    const c = env.cards[name];
    if (!c) return fail('Unbekannte Karte.');
    if (!zoneAccepts(env, ps, name, dst)) return fail('Diese Zone nimmt die Karte nicht auf.');
    const { kind, hi, slot } = dst;
    switch (kind) {
      case 'hero': {
        const old = ps.heroes[hi];
        if (old) {
          // Tausch: Hand-Abilities des alten Heroes kehren zurück, seine Start-Abilities verfallen,
          // aus dem Nichts erschienene Karten (alter Idej Lord) verschwinden.
          despawn(ps, hi);
          for (let z = 0; z < 3; z++) {
            const az = ps.abilityZones[hi][z];
            if (az && az.c) ps.hand.push(az.n);
            ps.abilityZones[hi][z] = null;
          }
          ps.hand.push(old);
        }
        ps.heroes[hi] = name;
        installStartAbilities(env, ps, hi, name);
        spawnFor(env, ps, hi, name);
        return { ok: true, ps };
      }
      case 'ability': {
        // Jede Ability liegt je Hero nur einmal; die Stufen stapeln sich in EINER Zone (auch auf einer Start-Ability, die schon Stufe 3 hat).
        if (ps.abilityZones[hi].some((q, i) => i !== slot && q && q.n === name)) return fail('Dieser Hero hat die Ability schon — lege sie auf ihre Zone, um die Stufe zu erhöhen.');
        const z = ps.abilityZones[hi][slot];
        if (z) {
          if (z.n === name) {
            if (abilityLevel(z) >= MAX_ABILITY_LEVEL) return fail('Maximales Level erreicht.');
            z.c = true;
          } else if (z.s > 0) {
            return fail('Start-Abilities sind fest.');
          } else {
            ps.hand.push(z.n);
            ps.abilityZones[hi][slot] = { n: name, s: 0, c: true };
          }
        } else {
          ps.abilityZones[hi][slot] = { n: name, s: 0, c: true };
        }
        return { ok: true, ps };
      }
      case 'support': {
        const st = ps.supportZones[hi][slot];
        if (c.cardType === 'Ability' && st.length && st[0] === name) {
          if (st.length >= MAX_ABILITY_LEVEL) return fail('Maximales Level erreicht.');
          st.push(name);
          return { ok: true, ps };
        }
        if (st.length && !isSpawned(ps, hi, slot)) ps.hand.push(st[0]);   // eine erschienene Karte wird überbaut und ist weg
        ensureSpawned(ps).spawned[hi][slot] = false;
        ps.supportZones[hi][slot] = c.cardType === 'Ability' ? Array(MAX_ABILITY_LEVEL).fill(name) : [name];
        return { ok: true, ps };
      }
      case 'surprise': {
        if (ps.surpriseZones[hi]) ps.hand.push(ps.surpriseZones[hi]);
        ps.surpriseZones[hi] = name;
        return { ok: true, ps };
      }
      case 'area': {
        if (ps.areaZone.includes(name)) return fail('Diese Area liegt bereits.');
        if (ps.areaZone.length >= areaLimit(env, ps)) {
          if (areaLimit(env, ps) !== 1) return fail('Area-Limit erreicht.');
          ps.hand.push(ps.areaZone.pop()); // Limit 1: Tausch
        }
        ps.areaZone.push(name);
        return { ok: true, ps };
      }
      case 'hand': ps.hand.push(name); return { ok: true, ps };
      default: return fail('Unbekanntes Ziel.');
    }
  }

  /** Kein Spieler darf in einen Zustand geraten, aus dem die Heldenzahl unerreichbar ist. */
  function heroInvariant(ps) {
    if (heroCount(ps) > requiredHeroes(ps)) return 'Mit Zhigao sind höchstens 2 Heroes erlaubt.';
    return null;
  }

  function totalHeroes(env, ps) {
    let n = heroCount(ps);
    for (const h of ps.hand) if (env.cards[h] && env.cards[h].cardType === 'Hero' && !HAND_ONLY_HEROES.includes(h)) n++;
    return n;
  }

  /**
   * Eine Aktion anwenden. `move`:
   *   { type:'place',   from:{kind:'hand',idx}|{kind:'hero'|'ability'|'support'|'surprise'|'area',…}, to:{kind,hi,slot} }
   *   { type:'unplace', from:{board…} }                      — Karte zurück auf die Hand
   *   { type:'recycle', from:{kind:'hand',idx}|{board…} }    — Recycler (Zähler/Auswurf macht der Server)
   *   { type:'removeStart', hi, slot }                       — Start-Ability löschen
   * Ergebnis: { ok, ps, reason, recycledCard? }.
   */
  function applyMove(env, psIn, move) {
    const ps = ensureSpawned(clone(psIn));
    if (ps.ready) return fail('Du bist bereit — nimm das Ready zurück, um etwas zu ändern.');
    switch (move && move.type) {
      case 'deleteSpawned': {
        // Rechtsklick auf eine aus dem Nichts erschienene Karte: löschen (nicht auf die Hand, nicht in den Recycler).
        if (!ps.supportZones[move.hi] || !isSpawned(ps, move.hi, move.slot)) return fail('Hier liegt keine aus dem Nichts erschienene Karte.');
        ps.supportZones[move.hi][move.slot] = [];
        ps.spawned[move.hi][move.slot] = false;
        return { ok: true, ps };
      }
      case 'removeStart': {
        const z = ps.abilityZones[move.hi] && ps.abilityZones[move.hi][move.slot];
        if (!z || !z.s) return fail('Hier gibt es keine Start-Ability.');
        z.s = 0;
        if (!z.c) ps.abilityZones[move.hi][move.slot] = null;
        return { ok: true, ps };
      }
      case 'unplace': {
        if (!move.from || move.from.kind === 'hand') return fail('Ungültig.');
        const out = takeOut(ps, move.from);
        if (out.error) return fail(out.error);
        ps.hand.push(out.name);
        const inv = heroInvariant(ps); if (inv) return fail(inv);
        if (totalHeroes(env, ps) < requiredHeroes(ps)) return fail('Dann hättest du nicht mehr genug Heroes.');
        return { ok: true, ps };
      }
      case 'recycle': {
        const from = move.from || {};
        const out = takeOut(ps, from);
        if (out.error) return fail(out.error);
        const c = env.cards[out.name];
        if (c && c.cardType === 'Hero') {
          // Heroes: NUR von der Hand und nur bei vollem Board (3, mit Zhigao 2).
          if (from.kind !== 'hand') return fail('Heroes auf dem Feld können nicht recycelt werden.');
          if (!boardFull(psIn)) return fail('Heroes lassen sich nur recyceln, solange dein Board voll besetzt ist.');
        }
        // Ein Ability-/Support-Stapel zählt als EINE Karte.
        ps.recycled += 1;
        const inv = heroInvariant(ps); if (inv) return fail(inv);
        if (totalHeroes(env, ps) < requiredHeroes(ps)) return fail('Dann hättest du nicht mehr genug Heroes.');
        return { ok: true, ps, recycledCard: out.name };
      }
      case 'place': {
        const from = move.from || {}, to = move.to || {};
        // Hero auf eine andere Hero-Zone ziehen: die ganze Spalte (Hero, Abilities,
        // Support, Surprise) tauscht den Platz — nichts geht auf die Hand.
        if (from.kind === 'hero' && to.kind === 'hero') {
          if (from.hi === to.hi || !ps.heroes[from.hi]) return fail('Ungültig.');
          const a = from.hi, b = to.hi;
          for (const key of ['heroes', 'abilityZones', 'supportZones', 'surpriseZones', 'spawned']) {
            const t = ps[key][a]; ps[key][a] = ps[key][b]; ps[key][b] = t;
          }
          return { ok: true, ps };
        }
        const out = takeOut(ps, from);
        if (out.error) return fail(out.error);
        // Ability-Stapel aus einer Support Zone (Xal) behalten ihre Höhe nicht: eine Karte.
        const res = putIn(env, ps, out.name, to);
        if (!res.ok) return res;
        // Ein Hero-Tausch darf Zhigao-Regel und Heldenzahl nicht verletzen.
        const inv = heroInvariant(ps); if (inv) return fail(inv);
        if (totalHeroes(env, ps) < requiredHeroes(ps)) return fail('Dann hättest du nicht mehr genug Heroes.');
        return { ok: true, ps };
      }
      default: return fail('Unbekannte Aktion.');
    }
  }

  /** Für die UI: darf diese Karte (Name, Quelle) auf dieses Ziel? (ohne Zustandsänderung) */
  function canDrop(env, ps, cardName, target) {
    if (ps.ready) return false;
    if (!zoneAccepts(env, ps, cardName, target)) return false;
    const { kind, hi, slot } = target;
    if (kind === 'ability') {
      if (ps.abilityZones[hi].some((q, i) => i !== slot && q && q.n === cardName)) return false;
      const z = ps.abilityZones[hi][slot];
      if (z && z.n !== cardName && z.s > 0) return false;
      if (z && z.n === cardName && abilityLevel(z) >= MAX_ABILITY_LEVEL) return false;
    }
    if (kind === 'area') {
      if (ps.areaZone.includes(cardName)) return false;
      if (ps.areaZone.length >= areaLimit(env, ps) && areaLimit(env, ps) !== 1) return false;
    }
    if (kind === 'hero') {
      // Zhigao darf nur rein, wenn danach höchstens 2 Heroes stehen (Tausch zählt nicht doppelt).
      const after = clone(ps);
      after.heroes[hi] = cardName;
      if (heroCount(after) > requiredHeroes(after)) return false;
    }
    return true;
  }

  /** Bereit-Prüfung. */
  function readyProblem(ps) {
    if (!boardFull(ps)) return `Du brauchst ${requiredHeroes(ps)} Heroes auf dem Feld.`;
    return null;
  }

  /** Ability-Zonen (Namen-Stapel) für die Engine: [hi][slot] → string[] */
  function abilityStacks(ps) {
    return ps.abilityZones.map(row => row.map(z => (z ? Array(abilityLevel(z)).fill(z.n) : [])));
  }

  return {
    ZHIGAO, HAND_ONLY_HEROES, MAX_ABILITY_LEVEL, START_ABILITY_LEVEL, POTIONS_ON_BOARD,
    emptyPlayer, clone,
    heroCount, requiredHeroes, boardFull, hasZhigao, totalHeroes, abilityLevel,
    zoneAccepts, canDrop, applyMove, readyProblem, abilityStacks, areaLimit, canPlaceAnotherArea,
    installStartAbilities, isSpawned, IDEJ_PACKAGES, IDEJ_PROJECTION, IDEJ_BLADES,
  };
}));
