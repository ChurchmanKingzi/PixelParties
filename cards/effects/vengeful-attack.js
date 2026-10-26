// ═══════════════════════════════════════════
//  CARD EFFECT: "Vengeful Attack"
//  Attack (Normal, Fighting Lv1)
//
//  „Choose a target that has defeated a target you control with an Attack, Spell or effect during your opponent's last turn. Deal damage equal to the attacker's Attack stat to that
//   target. This counts as an additional Action. You can only play 1 "Vengeful Attack" per turn."
//
//  ── „HAS DEFEATED A TARGET YOU CONTROL" ────────────────────────────────
//  Die Engine führt ein Tötungsprotokoll (`gs._toetungen`, `engine._toetungsProtokoll`): bei jedem Kreaturentod und jedem ENDGÜLTIGEN Heldentod wird vermerkt, wer das Opfer kontrollierte, in
//  wessen Zug es geschah und welches Ziel es verursacht hat — der handelnde Held (Attack, Spell, Heldeneffekt, Gegenstandseffekt eines Helden) oder die Kreatur, deren Effekt es war. Quellen ohne
//  Täter-Ziel (Gift, Brand, Blutung, Gegenstandseffekte ohne Held) zählen nicht; ein Tod, den die Schadensquelle gar nicht verursachen konnte (Selbstopfer ohne Quelle), auch nicht.
//  `engine.rachezieleFuer(pi)` liefert die Täter, die noch auf dem Brett stehen (Held am Leben, Kreatur aufgedeckt in einer Support Zone).
//  „During your opponent's last turn": der JÜNGSTE Zug (`ps._rhAktuellerZug`) des Gegners, der beim Besiegen am Zug war — der Gegnerzug direkt vor meinem laufenden Zug. Opfer meiner Seite, die
//  ich selbst in MEINEM Zug verloren habe, zählen nicht.
//  „Attacker's Attack stat" = der Angriffswert des Nutzers dieser Karte (wie bei der Attack selbst: `hero.atk`, mit allen Boni).
//
//  ── ABLAUF ───────────────────────────────────────────────────────────
//  `ctx.executeAttack` (Zielwahl nur unter den Tätern, Schutz-/Umlenkfenster, `onAttackDeclare`, Schaden vom Typ `attack`); Abbruch in der Zielwahl: der Zauber wird nicht verbraucht.
//  Ohne wählbaren Täter ist die Karte nicht spielbar. „Counts as an additional Action": `inherentAction: true`. „Only 1 per turn": HOPT je Spieler (`claimHOPT`), gestempelt, sobald der Angriff
//  läuft (oder fizzelt); ein negierter Zauber stempelt nicht.
//
//  ── Bild und Klang ────────────────────────────────────────────────────
//  `play_zone_animation` `vengeful_slash` (Pixelart, ANIM_REGISTRY, Punktbild auf dem Ziel): ein dunkler, gezackter Doppelschnitt (schwarzer Kern, blutrote Ränder, kurz weißglühende Mitte) fährt über
//  die Karte, danach steigt schwarzer Rauch auf. Klänge in ZONE_ANIM_SFX; Log `vengeful_attack`.
//
//  ── CPU ─────────────────────────────────────────────────────────────
//  Die allgemeine Schadensziel-Wahl der CPU (nur Täter stehen zur Wahl); Kill vor Wert.
// ═══════════════════════════════════════════

const CARD_NAME = 'Vengeful Attack';
const HOPT_KEY = 'vengeful-attack';
const SCHNITT_MS = 560;           // Wartezeit, bis der Schaden fällt (deckt sich mit `vengeful_slash` im Client: Schnitt + Einschlag)

/** Ist dieser Zielwahl-Eintrag einer der Täter? */
function istRacheziel(engine, pi, t) {
  for (const z of engine.rachezieleFuer(pi)) {
    if (z.art === 'hero') {
      if (t.type === 'hero' && t.owner === z.seite && t.heroIdx === z.heroIdx) return true;
    } else {
      const inst = t.cardInstance || t._cardInstance;
      if (t.type !== 'hero' && inst && inst.id === z.instId) return true;
    }
  }
  return false;
}

module.exports = {
  // ★ Als Ruling (Al 26.10., Flame Avalanche: „Wenn du andere Schadenskarten unspielbar machst, müssen das Vial und Rockfall auch sein!"): die Karte richtet NUR Schaden an Zielen an —
  // unter der Schadenssperre (`ps.damageLocked`) unspielbar (Karte bleibt auf der Hand, keine Aktion/Kosten; Sperr-Stutzen `engine._cardBlockedBySearchLock`).
  blockedByDamageLock: true,
  // „This counts as an additional Action." — immer.
  inherentAction: true,
  // Wie jede Attack, die einen Gegner trifft: gegen den durch die Erstrunden-Immunität geschützten Spieler gibt es nichts zu rächen (und nichts, was getroffen werden könnte).
  // Gefizzelt (Wirker beim Auflösen handlungsunfähig) → trotzdem gestempelt.
  onFizzledPlay: ({ engine, gs, pi }) => { engine.claimHOPT(HOPT_KEY, pi); },

  requiresTarget: true,
  cpuMeta: { scalesWithSchool: 'Fighting' },

  /** Grau, solange die Karte diesen Zug schon gespielt wurde oder es keinen Täter zu bestrafen gibt. */
  spellPlayCondition(gs, pi, engine) {
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;
    if (!engine) return true;
    return engine.rachezieleFuer(pi).length > 0;
  },

  /** Je Nutzer: lebend, und es gibt einen Täter (der Nutzer selbst nicht — ein Angriff auf sich selbst ist ausgeschlossen). */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;      // „only 1 per turn": auch die Spielbarkeitsliste der Helden sperrt die zweite Kopie
    const hs = engine.heldSeiteFuer(pi, heroIdx);
    return engine.rachezieleFuer(pi).some(z => !(z.art === 'hero' && z.seite === hs && z.heroIdx === heroIdx));
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || ctx.players[pi]?.heroes?.[heroIdx];       // geliehener Held: physische Seite
      if (!ps || !hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }
      if (engine.rachezieleFuer(pi).length === 0) { gs._spellCancelled = true; return; }

      const atk = hero.atk || 0;
      const res = await ctx.executeAttack({
        title: CARD_NAME,
        description: `Choose a target that defeated one of your targets during your opponent's last turn. Deal ${atk} damage to it.`,
        confirmLabel: `🗡️ Vengeance! (${atk})`,
        animationType: 'vengeful_slash',
        animDuration: SCHNITT_MS,
        side: 'any',
        types: ['hero', 'creature'],
        excludeSelf: true,
        cancellable: true,
        dimUnmetCondition: true,
        condition: (t) => istRacheziel(engine, pi, t),
      });
      if (!res) {
        // Im Zielfenster NEGIERT (Schutzkarten, Umlenk-Negation): der Zauber ist gespielt und der Stempel gesetzt; ein Abbruch des Spielers verbraucht nichts.
        if (gs._spellNegatedByEffect || gs._zielNegiertDurchSchutz) { engine.claimHOPT(HOPT_KEY, pi); return; }
        gs._spellCancelled = true; return;
      }
      engine.claimHOPT(HOPT_KEY, pi);
      engine.log('vengeful_attack', { player: ps.username, hero: hero.name, target: res.target?.cardName || null, damage: res.damage ?? atk });
      engine.sync();
    },
  },

  _test: { istRacheziel, SCHNITT_MS },
};
