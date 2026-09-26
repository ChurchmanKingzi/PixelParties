// ═══════════════════════════════════════════
//  CARD EFFECT: "Homerun!"
//  Artifact (Reaction, Cost 4)
//
//  "Play this card immediately when a Hero you control would take
//   damage equal to or greater than its max HP or be defeated by an
//   effect. Negate that damage or effect and any effects associated
//   with it to that Hero."
//
//  ★ INSTA-KILLS (Als Update 26.9.): Homerun! schuetzt jetzt auch gegen
//  Effekte, die einen Helden OHNE Schaden besiegen (Lunatic Golem
//  Stufe 5, Hand of Death, Kohta, Decapitating Strike …). Die laufen
//  alle durch `actionDefeatHero`, und dessen Vor-Niederlage-Fenster
//  ruft dasselbe Vor-Schaden-Fenster mit `type === 'defeat'` und
//  `instaKill: true` auf — dort werden nur Karten mit `firesOnDefeat`
//  angeboten (wie Escape). Im Niederlage-Fenster ist der Betrag die
//  aktuelle HP (nicht max HP); die Schwelle gilt dort deshalb nicht:
//  jede Niederlage durch einen Effekt reicht. Eraser Beam laeuft
//  weiter ueber 999999 Schaden und war schon vorher abgedeckt.
//  Ein freiwilliges Opfer (`isSacrifice`) und Unaufhaltsames (Midnight
//  Assault) oeffnen das Fenster gar nicht erst.
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
  // Auch im Vor-Niederlage-Fenster der Insta-Kills anbieten (s. Kopf).
  firesOnDefeat: true,

  preDamageCondition(gs, pi, _engine, target, _heroIdx, _source, amount, type, opts = {}) {
    if (opts?.cannotBeNegated) return false;
    if (!target || target.hp === undefined || target.hp <= 0) return false;
    // „or be defeated by an effect" — jede Effekt-Niederlage zaehlt.
    if (type === 'defeat') return true;
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
   * Ein Insta-Kill (`type === 'defeat'`) ist ebenso sicher toedlich.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    if ((promptData?._gerryOriginalTitle || promptData?.title) !== CARD_NAME) return undefined;
    const pre = promptData._preDamageContext;
    if (!pre) return null;
    if (pre.type === 'defeat') return { confirmed: true };
    const ziel = engine.gs?.players?.[pre.targetOwner]?.heroes?.[pre.targetHeroIdx];
    const maxHp = ziel?.maxHp || 0;
    return (maxHp > 0 && pre.amount >= maxHp) ? { confirmed: true } : null;
  },
};
