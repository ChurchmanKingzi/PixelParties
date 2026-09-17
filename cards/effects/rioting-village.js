// ═══════════════════════════════════════════
//  CARD EFFECT: „Rioting Village"
//  Spell (Area, Destruction Magic Lv1)
//
//  "While this Area Spell remains on the board, all Heroes have their
//   Attack stats doubled, but no player can use more than 1 Attack per
//   turn and when a Hero deals damage with an Attack, it takes half the
//   damage dealt as recoil (rounded up). This recoil damage cannot be
//   reduced or negated."
//
//  ── DREI WIRKUNGEN, ALLE FUER BEIDE SEITEN ────────────────────────
//  „all Heroes" / „no player" — die Karte kennt keine Seiten. Wer sie
//  legt, legt sie auch gegen sich selbst.
//
//  ── ① VERDOPPLUNG: WARUM DAS NICHT DIE UEBLICHE AURA IST ──────────
//  ATK ist im Motor ein MUTIERTER Wert, keine Rechnung. Jede vorhandene
//  Aura gibt einmal beim Eintritt und nimmt einmal beim Abgang (Bauform
//  „Blade of the Frostbringer"). Fuer eine VERDOPPLUNG reicht das
//  nicht: gewinnt ein Held spaeter ATK dazu, muss die Verdopplung
//  mitwachsen, sonst friert sie auf dem Wert vom Platzierungszeitpunkt
//  ein.
//
//  Deshalb meldet der kanonische Trichter `_applyHeroAtkDelta` seit
//  v1086 jede Aenderung als `afterHeroAtkChange`. Diese Karte legt dann
//  denselben Betrag noch einmal nach — die Verdopplung folgt damit
//  jeder spaeteren Aenderung. Ein Tiefenschloss in der Engine
//  verhindert, dass die Nachlage sich selbst ausloest.
//
//  ★ Gemerkt wird je Held, was DIESE Karte gegeben hat
//  (`counters._rvGranted`), damit der Abgang exakt zurueckgibt und
//  nicht die halbe aktuelle ATK raet.
//
//  ── ② „NO MORE THAN 1 ATTACK PER TURN" ───────────────────────────
//  `ps.attacksPlayedThisTurn` fuehrt der Server ohnehin. Die Sperre
//  haengt an `blocksCardPlay` — dem Area-Gegenstueck zu `canPlayCard`
//  (v1086 neu, siehe CARD_API).
//
//  ── ③ RECOIL ─────────────────────────────────────────────────────
//  „half the damage DEALT" — es zaehlt der WIRKLICH angekommene
//  Schaden, nicht der angekuendigte; `afterDamage` liefert genau den.
//  Aufgerundet.
//
//  „cannot be reduced or negated" → `actionDealTrueDamage`. Der Weg
//  laeuft an Schadensminderung, `damage_proof` und Versteinerung
//  vorbei — genau das ist hier gefordert.
//
//  ★ KEIN RECOIL-KREISEL: der Rueckstoss ist selbst kein Attack-Schaden
//  (`type: 'recoil'`), loest also keinen weiteren aus. Zusaetzlich ein
//  Tiefenschloss, falls ein Effekt den Rueckstoss doch in einen Angriff
//  umdeutet.
// ═══════════════════════════════════════════

const CARD_NAME = 'Rioting Village';

/** Liegt die Area gerade auf dem Brett? */
function liegt(engine) {
  for (let pi = 0; pi < 2; pi++) {
    if ((engine.gs.areaZones?.[pi] || []).includes(CARD_NAME)) return true;
  }
  return false;
}

/** Alle lebenden Helden beider Seiten. */
function alleHelden(engine) {
  const out = [];
  for (let pi = 0; pi < 2; pi++) {
    const ps = engine.gs.players[pi];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (hero?.name && hero.hp > 0) out.push({ hero, pi, hi });
    }
  }
  return out;
}

module.exports = {
  activeIn: ['hand', 'area'],

  /**
   * ① „all Heroes have their Attack stats doubled"
   * ★ v1165: deklarativ — die Engine rechnet GRUNDWERT × Produkt aller
   * Faktoren (`_syncHeroAtkAura`). Nur wirksam, solange die Karte in der
   * Area Zone liegt; zwei Doerfer vervierfachen (Al 17.9.).
   */
  heroAtkMultiplier(gs, pi, hi, engine, inst) {
    // ★ Massgeblich ist die AREA ZONE im Spielstand, nicht die Zone der
    // Instanz: `removeArea` streicht den Eintrag dort SCHON, feuert dann
    // `onCardLeaveZone` und setzt die Instanz erst danach auf 'discard'.
    // Waehrend des Austritts-Hooks wuerde die Instanz sonst noch zaehlen.
    if (!inst || inst.zone !== 'area') return 1;
    return (gs.areaZones?.[inst.owner] || []).includes(CARD_NAME) ? 2 : 1;
  },

  /**
   * ② „no player can use more than 1 Attack per turn"
   *
   * Area-Gegenstueck zu `canPlayCard`: gibt true zurueck, wenn die
   * Karte GESPERRT ist. Gilt fuer BEIDE Seiten — die Karte sagt „no
   * player", nicht „your opponent".
   */
  blocksCardPlay(gs, pi, cardData) {
    if (cardData?.cardType !== 'Attack') return false;
    return (gs.players[pi]?.attacksPlayedThisTurn || 0) >= 1;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      const engine = ctx._engine;
      await engine.placeArea(ctx.cardOwner, ctx.card);
    },

    // ① Verdopplung: nichts zu tun — die Engine gleicht jede
    // Multiplikator-Aura beim Platzieren, Entfernen, Verschieben und
    // beim Puzzle-Start selbst ab (v1166, `syncAlleAtkAuren`). Der
    // Faktor steht oben im Vertrag `heroAtkMultiplier`.

    /** ③ Rueckstoss: halber ANGEKOMMENER Schaden, aufgerundet. */
    afterDamage: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'area') return;
      if (ctx.type !== 'attack') return;
      if (engine._rvRecoilTiefe) return;                 // kein Kreisel
      const gefallen = (ctx.realDealt ?? ctx.amount) || 0;
      if (gefallen <= 0) return;

      // Der Angreifer muss ein HELD sein („when a HERO deals damage").
      const src = ctx.source;
      const pi = (src && typeof src === 'object') ? (src.controller ?? src.owner) : null;
      const hi = (src && typeof src === 'object') ? src.heroIdx : null;
      if (typeof pi !== 'number' || typeof hi !== 'number' || hi < 0) return;
      const angreifer = engine.gs.players[pi]?.heroes?.[hi];
      if (!angreifer?.name || angreifer.hp <= 0) return;

      const rueckstoss = Math.ceil(gefallen / 2);
      engine._rvRecoilTiefe = 1;
      try {
        // „cannot be reduced or negated" → True Damage.
        await engine.actionDealTrueDamage(
          { name: CARD_NAME, owner: inst.owner, controller: inst.controller ?? inst.owner },
          angreifer, rueckstoss, { type: 'recoil' },
        );
      } finally {
        engine._rvRecoilTiefe = 0;
      }
      engine.log('rioting_village_recoil', {
        hero: angreifer.name, dealt: gefallen, recoil: rueckstoss,
      });
      engine.sync();
    },
  },
};
