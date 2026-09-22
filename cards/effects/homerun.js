// ═══════════════════════════════════════════
//  CARD EFFECT: "Homerun!"
//  Artifact (Reaction, Cost 4)
//
//  "Play this card immediately when a Hero you control would take
//   damage equal to or greater than their max HP. Negate that damage
//   and any effects associated with it on that Hero."
//
//  ★ v1278 (Als Befund 22.9.: „Homerun wird mir KONSTANT als einsetzbare
//  Reaktion angeboten, obwohl sie NUR einsetzbar sein sollte, wenn ein
//  Hero Schaden >= seiner max HP nehmen wuerde").
//
//  Bis v1277 hatte die Karte ZWEI Einstiege. Der erste
//  (`isPostTargetReaction`) sass im Nach-Zielwahl-Fenster — dort ist der
//  Schadensbetrag noch unbekannt, also war er bewusst LOCKER: angeboten,
//  sobald irgendein eigener Held Ziel eines Schadenseffekts war; die
//  Schwelle kam erst beim Eintreffen des Treffers. Genau das war das
//  „konstant angeboten". Er ist entfernt (samt der Marken, die er fuer
//  den spaeteren Treffer setzte).
//
//  Es bleibt EIN Einstieg: das Vor-Schaden-Fenster
//  (`isPreDamageReaction`, `_actionDealDamageImpl`). Es laeuft bei JEDEM
//  Heldenschaden ueber 0, NACH allen Modifikatoren — der Betrag ist der
//  endgueltige. Angeboten wird nur, wenn er ≥ max HP des Helden ist.
//  `{ negated: true }` hebt den Treffer vollstaendig auf, samt aller
//  On-Hit-Effekte — das ist „negate that damage and any effects
//  associated with it on that Hero". Gefragt wird die Hand des Spielers,
//  dem der getroffene Held gehoert („a Hero you control").
//
//  Durchschlagender Schaden (`cannotBeNegated`, Ida & Co.) wird nicht
//  angeboten — die Engine wuerde die Aufhebung ohnehin verwerfen.
// ═══════════════════════════════════════════

const CARD_NAME = 'Homerun!';

module.exports = {
  canActivate: () => false,
  neverPlayable: true,

  isPreDamageReaction: true,

  preDamageCondition(gs, pi, _engine, target, _heroIdx, _source, amount, _type, opts = {}) {
    if (opts?.cannotBeNegated) return false;
    if (!target || target.hp === undefined || target.hp <= 0) return false;
    const maxHp = target.maxHp || 0;
    if (maxHp <= 0) return false;
    return amount >= maxHp;
  },

  async preDamageResolve(engine, pi, target, heroIdx /*, source, amount, type */) {
    engine._broadcastEvent('play_zone_animation', {
      type: 'holy_revival', owner: pi, heroIdx, zoneSlot: -1,
    });
    await engine._delay(700);
    engine.log('homerun_save', {
      player: engine.gs.players[pi]?.username, hero: target.name,
    });
    engine.sync();
    return { negated: true };
  },

  /**
   * CPU: der Vor-Schaden-Confirm traegt den Betrag (`_preDamageContext`).
   * Die Bedingung garantiert ≥ max HP — die Aktivierung rettet dann
   * deterministisch einen Helden vor dem sicheren KO (Betrag ≥ max HP ≥ HP).
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    if ((promptData?._gerryOriginalTitle || promptData?.title) !== CARD_NAME) return undefined;
    const pre = promptData._preDamageContext;
    if (!pre) return null;
    const ziel = engine.gs?.players?.[pre.targetOwner]?.heroes?.[pre.targetHeroIdx];
    const maxHp = ziel?.maxHp || 0;
    return (maxHp > 0 && pre.amount >= maxHp) ? { confirmed: true } : null;
  },
};
