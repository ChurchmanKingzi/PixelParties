// ═══════════════════════════════════════════
//  ASCENDED HERO: "Kohta, Master of Super-Killing"
//
//  Aufstieg von „Kohta, the Silent Observer", der
//  „Super-Killing Knife, the Tool of Liquidation"
//  UND „Summoning Instructions" traegt. Bedingung
//  steht in `_kohta-shared.js` (Riffel-Muster).
//
//  Effekt: einmal pro Zug die AKTION ausgeben, ein
//  beliebiges Ziel auf dem Brett waehlen und es
//  besiegen. Gilt als Angriff dieses Helden auf
//  dieses Ziel, der nie mehr als 1 Ziel treffen kann.
//
//  ── DIE HARTE EINMAL-PRO-ZUG-SPERRE (Al 12.9.) ────
//  Der Kartentext sagt es ausdruecklich zweimal
//  („once per turn" UND „You can only activate this
//  effect once per turn"). Die zweite Zeile ist die
//  HARTE Form: auch ein Weg, der den Effekt sonst
//  ein weiteres Mal ausloesen koennte, soll ins
//  Leere laufen.
//
//  Die Engine stempelt nach einem erfolgreichen
//  `onHeroEffect` ihren eigenen Schluessel
//  `hero-effect:<Name>:<pi>:<heroIdx>`. Der reicht
//  NICHT: „Sleeping Beauty" liest genau diesen
//  Stempel als Beweis, dass der Held seinen Effekt
//  schon benutzt hat, und ruft danach
//  `onHeroEffect` DIREKT auf — am Engine-Gate
//  vorbei. Deshalb fuehrt diese Karte einen EIGENEN
//  Schluessel, der weder an der Heldeninstanz noch
//  am Heldenplatz haengt, sondern nur am Spieler:
//  `kohta-super-kill:<pi>`. Jeder Weg, der in
//  `onHeroEffect` landet, laeuft durch ihn.
//
//  Beansprucht wird er erst NACH der Zielwahl —
//  sonst frisst ein Abbruch die Nutzung des Zuges.
// ═══════════════════════════════════════════

const { kohtaAscensionMet } = require('./_kohta-shared');
const { opponentOfGs } = require('./_opp');

const CARD_NAME = 'Kohta, Master of Super-Killing';
const HOPT_KEY  = 'kohta-super-kill';

/** Steht die harte Sperre fuer diesen Spieler in diesem Zug? */
function hartGesperrt(engine, pi) {
  return engine?.gs?.hoptUsed?.[`${HOPT_KEY}:${pi}`] === engine?.gs?.turn;
}

/** Der Held selbst, ueber seinen Platz. */
function eigenerHeld(engine, pi, heroIdx) {
  return engine?.gs?.players?.[pi]?.heroes?.[heroIdx] || null;
}

module.exports = {
  // W26a (Al, Welle 26): als Attack geltender Heldeneffekt ohne Karte — Stufen-Bedingungen ("level X or lower": Glass Wall, Test Flight, Future Tech Escape Device …) lesen die Quellstufe.
  // W32a (Al, 22.10.2026): „Zählt als Attack/Spell eines Helden = Ability-Level dieses Helden": die Quellstufe ist das FIGHTING-LEVEL Kohtas (nicht mehr fix 0) — Engine: `_heldenEffektStufe`.
  treatedAsAttack: { ability: 'Fighting' },
  activeIn: ['hero'],
  heroEffect: true,

  // „spend your Action" — der Text verlangt die Aktion ausdruecklich,
  // also das Opt-in (★-Regel 7.9.: ohne diesen Zusatz waere der Effekt
  // aktionsfrei).
  heroEffectActionCost: true,

  // Als Vorgabe 29.9.: `heroOwner` = Brettseite eines geliehenen Helden.
  ascensionCondition(gs, pi, heroIdx, engine, heroOwner) {
    return kohtaAscensionMet(engine, heroOwner ?? pi, heroIdx, null);
  },

  /**
   * Ascension-Bonus: „Fighting" bis Level 3 darf sofort aus Hand, Deck
   * oder Ablage angelegt werden (Regelwerk: nennt der Bonus Abilities,
   * duerfen sie direkt angelegt werden, auch weniger Kopien). Gleiche
   * Bauform wie bei Riffel — der Helfer der Engine macht die Arbeit.
   */
  async onAscensionBonus(engine, pi, heroIdx, heroOwner) {
    await engine.performAscensionBonus(pi, heroIdx, ['Fighting'], heroOwner);
  },

  /**
   * Der Knopf ist tot, sobald die harte Sperre steht. Ohne diese
   * Abfrage bliebe er anklickbar und der Effekt liefe nur ins Leere —
   * der Spieler haette seine Aktion verplant.
   */
  canActivateHeroEffect(ctx) {
    // ★ W34a (Al, 22.10.2026): ein Effekt, der als Attack zählt, unterliegt den Attack-Zählern und -Sperren (Berserk-Limit, Knife Throw, Rioting Village, Mirjam, Muras …) — `heroKannAngreifen`.
    if (!ctx._engine.heroKannAngreifen(ctx.cardHeroOwner ?? ctx.cardOwner, ctx.cardHeroIdx, ctx.cardOwner, { name: 'Kohta, Master of Super-Killing' })) return false;
    return !hartGesperrt(ctx._engine, ctx.cardOwner);
  },

  cpuShouldUseHeroEffect(engine, pi) {
    if (hartGesperrt(engine, pi)) return false;
    // Lohnt sich immer, solange der Gegner ueberhaupt etwas auf dem
    // Brett hat — ein garantierter Kill ohne Schadensrechnung.
    const gegner = opponentOfGs(engine?.gs, pi);
    const ps = engine?.gs?.players?.[gegner];
    if (!ps) return false;
    if ((ps.heroes || []).some(h => h?.name && h.hp > 0)) return true;
    return engine.findCards({ controller: gegner, zone: 'support' }).length > 0;
  },

  cpuMeta: {
    // Verbraucht die Aktion des Zuges — die Aktionsplanung soll das sehen.
    usesAction: true,
  },

  /**
   * Zielwahl der CPU: der teuerste Kopf auf der Gegenseite. Helden
   * zuerst (ein Held weniger ist ein Drittel des Spiels), sonst die
   * staerkste Kreatur.
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const quelle = payload?.config?.source || payload?.config?.title;
    if (quelle !== CARD_NAME) return undefined;
    const ziele = (payload?.validTargets || []).filter(t => t && t.owner !== payload.playerIdx);
    if (ziele.length === 0) return undefined;
    let bestes = ziele[0];
    let bestwert = -Infinity;
    for (const t of ziele) {
      let wert = 0;
      if (t.type === 'hero') {
        const h = engine?.gs?.players?.[t.owner]?.heroes?.[t.heroIdx];
        wert = 1000 + (h?.hp || 0) + (h?.atk || 0);
      } else {
        const inst = t.cardInstance;
        wert = engine.creatureCurrentHp(inst) + (inst?.counters?.maxHp || 0) / 2;   // Z5: unversehrt = gedruckte HP
      }
      if (wert > bestwert) { bestwert = wert; bestes = t; }
    }
    return [bestes.id];
  },

  // W40a (Al, 22.10.2026): `wdh` = Wiederholung durch Idej Sword - Kunagi ("perform that Attack again"): derselbe Schlag, neues Ziel; weder die harte Sperre noch die Aktion werden erneut verbraucht oder geprüft.
  // ★ W42a (Al, 22.10.2026, Punkt 1: „Nein, verbraucht es nicht, ebenso wenig, wie normale Attacks mit Karten Zusatzaktionen mit Kunagi kosten. Die Aktion des ersten Schlags reicht."): die Wiederholung kostet KEINE weitere
  // (Zusatz-)Aktion (W41a zurückgenommen) — die Aktion bzw. das Ausspielen wird bei der Wiederholung nie erneut bezahlt.
  async onHeroEffect(ctx, wdh) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;

    // Erst PRUEFEN, nicht beanspruchen. Wer hier ankommt, ohne dass der
    // Engine-Weg gelaufen ist (Sleeping Beauty & Co.), faellt hier raus.
    if (!wdh && hartGesperrt(engine, pi)) return false;

    // ★ W36a (Al, 22.10.2026): „Negierter Treffer: ja, definitiv" — wird der Treffer im Zielfenster NEGIERT (Invisibility Cloak, Schutzkarten …), ist der Effekt für die Runde verbraucht (Einmal-Stempel bleibt, Rückgabe `true`) und zählt als gespielte Attack (Muster Alice); ein Abbruch des Spielers bleibt ein Abbruch.
    const { target: ziel, negiert } = await engine.heldenEffektZielwahl(ctx, {
      side: 'any',                       // „any target on the board" — auch eigene
      types: ['hero', 'creature'],
      damageType: 'attack',              // gilt als Angriff dieses Helden
      // Kein Schaden, sondern eine Niederlage: damit laufen die reinen
      // Schadensminderungs-Reaktionen (Spectral Armor, Bamboo Shield)
      // nicht ins Leere, die eine Niederlage ohnehin nicht halbieren.
      dealsDamage: false,
      title: CARD_NAME,
      source: CARD_NAME,                 // Dispatch-Schluessel fuer `cpuResponse`
      description: 'Choose any target on the board and defeat it. This counts as this Hero hitting it with an Attack.',
      confirmLabel: '🔪 Super-Kill!',
      confirmClass: 'btn-danger',
      cancellable: true,
      // „an Attack that can never hit more than 1 target": die Zielwahl
      // ist hart auf eines begrenzt, und der Effekt geht ueber KEINEN
      // Flaechenweg (`actionAoeHit`), an dem sich etwas anhaengen
      // koennte.
      maxTotal: 1,
      minRequired: 1,
    });
    if (negiert) {
      // Negiert: der Effekt ist verbraucht (harte Sperre gesetzt) und zählt als Attack dieses Helden.
      if (!wdh && !engine.claimHOPT(HOPT_KEY, pi)) return false;
      await engine.zaehleAlsArt('attack', { pi, heroIdx, heroOwner: ctx.cardHeroOwner ?? pi, name: CARD_NAME });
      engine.sync();
      return true;
    }
    if (!ziel) return false;

    // ── Punkt ohne Rueckkehr: jetzt die harte Sperre beanspruchen ────
    if (!wdh && !engine.claimHOPT(HOPT_KEY, pi)) return false;

    // Styx 28.9.: „this Hero" steht auf der Brettseite `feld` — Quelle
    // traegt sie als `heroOwner`, der Held kommt als Objekt.
    const feld = ctx.cardHeroOwner ?? pi;
    const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx, ...(feld !== pi ? { heroOwner: feld } : {}) };
    const held = ctx.attachedHero ?? eigenerHeld(engine, feld, heroIdx);

    // „This is treated as this Hero hitting the target with an Attack":
    // das Angriffsfenster gehoert erklaert, damit „when this Hero
    // attacks"-Zuhoerer feuern. Der Rueckgabewert traegt die Projektion
    // aller Modifikatoren — faellt sie auf 0, hat ein Zuhoerer den
    // Angriff negiert (Future Tech Doomsday Bomb macht genau das ueber
    // `setAmount(0)`). Dann IST der Angriff erklaert worden, er verpufft
    // nur: kein Kill, aber Aktion und Sperre bleiben verbraucht.
    const basis = Math.max(1, held?.atk || 1);
    // W32a (Al, 22.10.2026): der Treffer zählt als Attack — Attack-Reaktionen (Magic Topaz, Arrows …) über die virtuelle Attack-Kette um Angriffsfenster und Kill.
    await engine.alsAttackKette({ name: CARD_NAME, pi, heroIdx, heroOwner: feld, ziele: [ziel], wiederhole: () => module.exports.onHeroEffect(ctx, true), resolve: async () => {
    const nachFenster = await engine._fireAttackDeclare(quelle, ziel, basis);
    if (!(nachFenster > 0)) {
      engine.log('kohta_super_kill_negated', {
        player: gs.players[pi]?.username, target: ziel.cardName,
      });
      engine.sync();
      return true;
    }

    engine._broadcastEvent('play_zone_animation', {
      type: 'super_kill_cut', owner: ziel.owner,
      heroIdx: ziel.heroIdx, zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
    });
    await engine._delay(320);

    if (ziel.type === 'hero') {
      const opfer = engine?.gs?.players?.[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (!opfer?.name || opfer.hp <= 0) { engine.sync(); return true; }
      // W39a: „besiegt mit einer Attack" (Death-Leser: Future Tech Bazooka) und Treffer ohne Schaden an die Schadens-Leser (Explosivo's Sword, Don Quisto, Wavilion, Skullmael's Greatsword,
      // Heart of Ice …) — `meldeTreffer` feuert ihn NACH hp = 0, VOR den KO-Hooks (wie der Schadenspfad).
      await engine.actionDefeatHero(quelle, opfer, { sourceName: CARD_NAME, type: 'attack', meldeTreffer: true });
    } else {
      const opfer = ziel.cardInstance
        || engine.findCards({ controller: ziel.owner, zone: 'support', heroIdx: ziel.heroIdx })
             .find(c => c.zoneSlot === ziel.slotIdx);
      if (!opfer) { engine.sync(); return true; }
      await engine.actionDestroyCard(quelle, opfer, { sourceName: CARD_NAME, heldQuelle: quelle });   // W39a: der Held besiegt das Ziel mit einer Attack (Death-Leser: Skullmael's Greatsword, Wanted Poster, Future Tech Bazooka, Xiong)
      await engine.meldeAttackTrefferOhneSchaden(quelle, opfer, pi);
    }

    engine.log('kohta_super_kill', {
      player: gs.players[pi]?.username,
      target: ziel.cardName,
      targetType: ziel.type,
    });
    engine.sync();
    return true;
    } });
    return true;
  },
};
