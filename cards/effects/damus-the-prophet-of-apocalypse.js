// ═══════════════════════════════════════════
//  CARD EFFECT: „Damus, the Prophet of Apocalypse"
//  Hero — Premonition / Summoning Magic, 400 HP / 30 ATK
//
//  NEUER TEXT (Al 14.9.) — cards.json ist mitgeaendert:
//  "You may once per turn place an «Ifrit» Creature FROM YOUR HAND into
//   a free Support Zone of any Hero you control. «Ifrit» Creatures you
//   control TAKE NO DAMAGE from your opponent's cards or effects. The
//   levels of «Armageddon» Spells in your hand are reduced by the
//   number of «Ifrit» Creatures you control. While you control at least
//   1 «Ifrit» Creature, this Hero is unaffected by «Armageddon»."
//
//  ── ZWEI AENDERUNGEN GEGENUEBER DEM BESTANDSTEXT ─────────────────
//  ① „place an Ifrit" → „place an Ifrit FROM YOUR HAND". Damit ist die
//     Herkunft festgeschrieben; vorher war offen, ob auch Deck oder
//     Ablage gemeint sind.
//  ② „unaffected by your opponent's cards and effects" → „TAKE NO
//     DAMAGE from your opponent's cards or effects".
//     ★ Das ist eine deutliche Verengung: Ifrits sind jetzt nur noch
//     schadensfest. Zerstoerung, Uebernahme, Rueckholen auf die Hand,
//     Status — alles greift wieder. Wer die alte Fassung baut, macht
//     die Karte um ein Vielfaches staerker.
//
//  ── ★ DIE PLATZIERUNG IST KEINE BESCHWOERUNG ─────────────────────
//  Ifrit traegt `summonOnlyFromHand` und ist damit von jedem
//  Beschwoerungsweg ausser der Hand ausgeschlossen. Damus LEGT sie
//  hin — `place`, nicht `summon` —, und er nimmt sie ohnehin von der
//  Hand. Beide Lesarten fuehren also zum selben Ergebnis; die
//  Platzierung laeuft trotzdem ueber `summonCreatureWithHooks` mit
//  `fromHandIdx`, damit On-Summon-Effekte normal feuern.
//
//  ── ZONE FREI WAEHLBAR (Als Vorgabe 14.9.) ───────────────────────
//  Bei mehreren freien Zonen fragt die Karte; bei genau einer nimmt sie
//  sie kommentarlos.
// ═══════════════════════════════════════════

const { IFRIT, ARMAGEDDON, ifritsOf, sourceSide } = require('./_apocalypse-shared');

const CARD_NAME = 'Damus, the Prophet of Apocalypse';

/** Freie Support-Zonen aller eigenen lebenden Helden. */
function freieZonen(engine, pi) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    for (let zi = 0; zi < 3; zi++) {
      if (((ps.supportZones?.[hi] || [])[zi] || []).length === 0) {
        out.push({ heroIdx: hi, slotIdx: zi, label: `${hero.name} — Support ${zi + 1}` });
      }
    }
  }
  return out;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  /**
   * ② „«Ifrit» Creatures you control take no damage from your
   * opponent's cards or effects."
   *
   * ★ Karten-Vertrag am HELDEN, gelesen im Kreaturen-Schadensweg
   * (v1100). Der Schutz haengt an Damus, nicht an Ifrit — faellt er,
   * faellt der Schutz.
   */
  protectsCreatureFromDamage(engine, inst, source, pi, heroIdx) {
    if (inst?.name !== IFRIT) return false;
    if ((inst.controller ?? inst.owner) !== pi) return false;   // „you control"
    const von = sourceSide(source);
    // „from your OPPONENT's cards or effects" — eigener Schaden trifft.
    return von >= 0 && von !== pi;
  },

  /**
   * ③ „The levels of «Armageddon» Spells in your hand are reduced by
   * the number of «Ifrit» Creatures you control."
   */
  reduceCardLevel(cardData, engine, ownerIdx, inst, heroIdx, evalOpts) {
    if (!cardData?.name || !cardData.name.includes(ARMAGEDDON)) return 0;
    if (evalOpts?.pileSide) return 0;                 // „in your hand"
    // ★★ v1146: der EIGENE Platz steht in der Helden-INSTANZ, nicht in
    // `heroIdx` — das ist der Wirker. „Armageddon in your hand" gilt fuer
    // jeden eigenen Wirker, nicht nur fuer Damus selbst.
    if (!inst || inst.zone !== 'hero') return 0;
    const seite = inst.owner, platz = inst.heroIdx;
    if (seite !== ownerIdx) return 0;
    const hero = engine.gs.players[seite]?.heroes?.[platz];
    if (hero?.name !== CARD_NAME || hero.hp <= 0) return 0;
    if (engine._isHeroEffectSilenced(seite, platz)) return 0;
    return ifritsOf(engine, ownerIdx).length;
  },

  /**
   * ④ „While you control at least 1 «Ifrit» Creature, this Hero is
   * unaffected by «Armageddon»."
   *
   * Bewusst weiter „unaffected", nicht bloss schadensfest — Al hat NUR
   * die Ifrit-Klausel verengt.
   */
  immuneToSourceNames: [ARMAGEDDON],
  immuneToSourceCondition(engine, pi, heroIdx) {
    return ifritsOf(engine, pi).length > 0;
  },

  // ── ① Die Platzierung ────────────────────────────────────────────
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!(ps?.hand || []).includes(IFRIT)) return false;
    return freieZonen(engine, pi).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    const handIdx = (ps?.hand || []).indexOf(IFRIT);
    if (handIdx < 0) return false;

    const zonen = freieZonen(engine, pi);
    if (zonen.length === 0) return false;

    // Zone frei waehlbar (Als Vorgabe) — bei genau einer nicht fragen.
    let ziel = zonen[0];
    if (zonen.length > 1) {
      const wahl = await engine.promptGeneric(pi, {
        type: 'zonePick',
        title: CARD_NAME,
        description: `Place ${IFRIT} into which Support Zone?`,
        zones: zonen,
        cancellable: true,
      });
      if (!wahl || wahl.cancelled) return false;
      ziel = { heroIdx: wahl.heroIdx, slotIdx: wahl.slotIdx };
    }

    // Nach der Abfrage neu pruefen.
    const idxJetzt = (ps.hand || []).indexOf(IFRIT);
    if (idxJetzt < 0) return false;
    if (((ps.supportZones?.[ziel.heroIdx] || [])[ziel.slotIdx] || []).length > 0) return false;

    engine.takeFromPileSync(ps, 'hand', idxJetzt);
    const res = await engine.summonCreatureWithHooks(
      IFRIT, pi, ziel.heroIdx, ziel.slotIdx,
      {
        source: CARD_NAME, fromHandIdx: idxJetzt, _fromHand: true,
        hookExtras: { _isNormalSummon: false },
      },
    );
    if (!res?.inst) { engine.handZugangSync(ps, IFRIT, { von: 'rueckgabe', ohneInstanz: true }); return false; }   // v1395

    engine._broadcastEvent('summon_effect', {
      owner: pi, heroIdx: ziel.heroIdx, zoneSlot: ziel.slotIdx,
    });
    engine.log('damus_place_ifrit', {
      player: ps.username, heroIdx: ziel.heroIdx, slot: ziel.slotIdx,
    });
    engine.sync();
    return true;
  },

  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type !== 'zonePick') return undefined;
    const z = (promptData.zones || [])[0];
    return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx } : undefined;
  },
};
