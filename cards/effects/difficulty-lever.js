// ═══════════════════════════════════════════
//  CARD EFFECT: „Difficulty Lever"
//  Artifact (Normal, Kosten 10, PP ART, Banned)
//
//  „Choose a Spell with an original level of 3 or lower and a Spell
//   School that none of your Heroes (including defeated ones) has from
//   your hand. Then, choose a Hero you control. That Hero immediately
//   performs that Spell regardless of its level as an additional
//   Action. This must be the only Action to perform this turn. You can
//   only play 1 \"Difficulty Lever\" per game."
//
//  BAUART
//  ──────
//  • ★ „a Spell School that NONE of your Heroes has": gesammelt werden
//    die Zauberschulen ALLER eigenen Helden — auch der besiegten, der
//    Text sagt es ausdruecklich. Die Liste der fuenf Schulen kommt aus
//    `_hooks.js` (`SPELL_SCHOOL_ABILITIES`), also aus derselben Stelle
//    wie bei Cosmic Skeleton und Sarcophagus. Ein Zauber taugt, wenn
//    MINDESTENS EINE seiner Schulen dort fehlt — „a Spell School" ist
//    Singular, bei Doppelschul-Zaubern reicht eine.
//    Performance zaehlt NICHT als Schule: sie deckt beim LEVEL als
//    Joker mit ab, ist aber selbst keine (siehe die ★-Regel zu den
//    fuenf Schulen).
//
//  • „original level of 3 or lower" ist der GEDRUCKTE Wert aus
//    cards.json, nicht das effektive Level — dieselbe Lesart wie bei
//    Bomb Berserker Bartas.
//
//  • „regardless of its level": `_castSpellImmediately` prueft keine
//    Levelanforderung — die Bruecke faehrt den vollen Spielweg
//    (Zielwahl, Reaktionsfenster, Kosten, Aufloesung), nur eben ohne
//    das Schul-/Levelgatter davor. Genau deshalb steht das Gatter
//    sonst BEIM AUFRUFER (Friedhelm filtert seine Galerie damit); hier
//    soll es ausdruecklich fehlen.
//
//  • ★ „This must be the only Action to perform this turn" ist eine
//    Klammer in BEIDE Richtungen:
//      – vorher: der Spieler darf in DIESEM ZUG noch keine Aktion
//        benutzt haben — `ps.heroesActedThisTurn` ist leer. Die PHASE
//        ist ausdruecklich KEIN Kriterium (Als Praezisierung 12.9.):
//        wer seine Action Phase einfach beendet, ohne zu handeln, darf
//        den Hebel in MAIN PHASE 2 noch ziehen. (Ein genereller
//        Aktions-Riegel — Kent, Chalice — sperrt weiterhin; das ist
//        nicht die Klausel der Karte, sondern eine fremde Sperre, die
//        jede Aktion trifft.)
//      – nachher: `ps._playerActionLockedTurn = gs.turn` — der
//        spielerweite Riegel, den `areActionsBlocked` liest (Kents
//        Vorbild). Er haelt auch dann, wenn der wirkende Held
//        anschliessend faellt.
//    Ein `_spellFreeAction`, das der Zauber selbst setzt, wird
//    abgeraeumt: eine Gratisaktion darf diese Klammer nicht aufbrechen.
//
//  • ★ ABBRECHBAR, MIT RUECKWEG (Als Vorgabe 12.9.): die Zauber-Galerie
//    laesst sich abbrechen (Knopf oder Escape) — dann passiert nichts.
//    In der Helden-Wahl fuehrt „Back" zurueck zur Galerie, nicht aus
//    dem Effekt heraus; dasselbe Muster wie bei Skullmael's Greatsword.
//    Die Einmal-je-Partie-Marke faellt deshalb ERST, wenn beide
//    Entscheidungen stehen.
//
//  • „1 per game": `oncePerGame` am Modul. Der Artefakt-Weg
//    `doUseArtifactEffect` wertet das Flag NICHT aus (anders als der
//    Aktions- und der Equip-Weg), deshalb prueft `canActivate` es
//    selbst und `resolve` setzt die Marke.
// ═══════════════════════════════════════════

const { SPELL_SCHOOL_ABILITIES, spellSchoolAbilitiesOn } = require('./_hooks');

const CARD_NAME = 'Difficulty Lever';
const MAX_LEVEL = 3;

/** Alle Zauberschulen, die IRGENDEIN eigener Held hat — Tote inklusive. */
function schulenDerPartei(engine, pi) {
  const ps = engine.gs.players[pi];
  const raus = new Set();
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    if (!ps.heroes[hi]?.name) continue;                 // leerer Platz, kein Held
    for (const s of spellSchoolAbilitiesOn(ps.abilityZones?.[hi], SPELL_SCHOOL_ABILITIES)) raus.add(s);
  }
  return raus;
}

/** Handkarten, die der Hebel spielen darf. */
function passendeZauber(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const vorhanden = schulenDerPartei(engine, pi);
  const gesehen = new Set();
  const out = [];
  for (let i = 0; i < (ps.hand || []).length; i++) {
    const name = ps.hand[i];
    if (gesehen.has(name)) continue;
    const cd = cardDB[name];
    if (!cd || cd.cardType !== 'Spell') continue;
    if ((cd.level || 0) > MAX_LEVEL) continue;          // GEDRUCKTES Level
    const schulen = [cd.spellSchool1, cd.spellSchool2].filter(Boolean);
    if (schulen.length === 0) continue;                 // ohne Schule kein Kandidat
    if (!schulen.some(s => !vorhanden.has(s))) continue;
    gesehen.add(name);
    out.push({ name, source: 'hand', level: cd.level || 0 });
  }
  return out;
}

/** Helden, die den Zauber ausfuehren koennen. */
function faehigeHelden(engine, pi) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const s = hero.statuses || {};
    if (s.frozen || s.stunned || s.webbed || s.negated) continue;
    if (hero._actionLockedTurn === engine.gs.turn) continue;
    out.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: hero.name });
  }
  return out;
}

/**
 * Ist die Aktions-Klammer noch offen?
 *
 * ★ Kriterium ist „hat dieser Zug schon eine Aktion gesehen?"
 * (`heroesActedThisTurn`), NICHT die Phase (Als Praezisierung 12.9.) —
 * wer die Action Phase ohne Handlung beendet, darf den Hebel in Main
 * Phase 2 noch ziehen.
 */
function aktionNochFrei(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  if ((ps.heroesActedThisTurn || []).length > 0) return false;
  return !engine.areActionsBlocked(pi);                 // fremde Sperren gelten weiter
}

module.exports = {
  oncePerGame: true,

  canActivate(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if (ps._oncePerGameUsed?.has(CARD_NAME)) return false;
    // ★ Kein Phasen-Tor mehr — nur: in diesem Zug noch nicht gehandelt.
    if ((ps.heroesActedThisTurn || []).length > 0) return false;
    if (!engine) return true;                           // ohne Engine nur die harten Tore
    if (!aktionNochFrei(engine, pi)) return false;
    return passendeZauber(engine, pi).length > 0 && faehigeHelden(engine, pi).length > 0;
  },

  // Beide Prompts sind Pflichtwahlen ohne Abbruch; die CPU braucht
  // trotzdem eine Antwort, sonst bricht die Engine sie ab (Befund v828).
  // Genommen wird der teuerste Zauber — er ist der, den die Partei sonst
  // gar nicht spielen koennte.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'cardGallery') {
      const karten = promptData.cards || [];
      if (karten.length === 0) return undefined;
      let beste = karten[0];
      for (const k of karten) if ((k.level || 0) > (beste.level || 0)) beste = k;
      return { cardName: beste.name, source: 'hand' };
    }
    return undefined;
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };
    if (ps._oncePerGameUsed?.has(CARD_NAME)) return { cancelled: true };
    if (!aktionNochFrei(engine, pi)) return { cancelled: true };

    const kandidaten = passendeZauber(engine, pi);
    if (kandidaten.length === 0) return { cancelled: true };
    if (faehigeHelden(engine, pi).length === 0) return { cancelled: true };

    // ── Dreistufige Auswahl mit Rueckwegen ─────────────────────────
    //   Galerie  → Abbruch beendet ALLES (Karte bleibt ungespielt)
    //   Caster   → „Back" zurueck zur Galerie
    //   Zielwahl → „Back" zurueck zur Caster-Wahl
    // Gibt es nur EINEN faehigen Helden, entfaellt der Caster-Schritt;
    // ein Rueckweg von der Zielwahl landet dann direkt in der Galerie
    // (sonst liefe er gegen eine Wahl ohne Alternative).
    let zauber = null;
    let held = null;
    let heldenZahl = 0;
    let schritt = 'spell';
    let handIdx = -1;

    while (true) {
      if (schritt === 'spell') {
        const wahl = await engine.promptGeneric(pi, {
          type: 'cardGallery',
          cards: kandidaten.map(k => ({ name: k.name, source: 'hand', level: k.level })),
          title: CARD_NAME,
          description: 'Choose a Spell from your hand whose Spell School none of your Heroes has. '
            + 'It is cast regardless of its level.',
          confirmLabel: '🎚️ Pull the lever!',
          confirmClass: 'btn-info',
          cancellable: true,
        });
        // ★ ABBRUCH HEISST: DIE KARTE WIRD NICHT GESPIELT (Als Vorgabe
        // 12.9.). `{ cancelled: true }` ist das Signal, das der
        // Artefakt-Weg auswertet — er raeumt `_pendingCardReveal` und
        // `_pendingPlayLog` weg und kehrt VOR Bezahlung und
        // Hand-Entnahme um: kein Gold, kein Auftritt, der Hebel bleibt
        // auf der Hand. Ein blosses `false` taete das alles NICHT.
        if (!wahl || wahl.cancelled || !wahl.cardName) return { cancelled: true };
        if (!kandidaten.some(k => k.name === wahl.cardName)) return { cancelled: true };
        zauber = wahl.cardName;
        schritt = 'hero';
        continue;
      }

      if (schritt === 'hero') {
        const helden = faehigeHelden(engine, pi);      // das Brett kann sich aendern
        heldenZahl = helden.length;
        if (heldenZahl === 0) return { cancelled: true };
        if (heldenZahl === 1) {
          held = helden[0];
        } else {
          const pick = await engine.promptEffectTarget(pi, helden, {
            title: CARD_NAME,
            description: `Which Hero performs ${zauber}? (Back returns to the Spell choice.)`,
            confirmLabel: '✨ Cast!',
            confirmClass: 'btn-info',
            cancellable: true,
            cancelLabel: '↩ BACK',
            exclusiveTypes: true,
            maxPerType: { hero: 1 },
            maxTotal: 1,
          });
          if (!pick || pick.length === 0) { schritt = 'spell'; continue; }   // zurueck
          held = helden.find(h => h.id === pick[0]) || helden[0];
        }
        schritt = 'cast';
        continue;
      }

      // ── Der Zauber laeuft, ohne Levelgatter ───────────────────────
      handIdx = ps.hand.indexOf(zauber);
      if (handIdx < 0) return { cancelled: true };

      // ★ Bricht der Spieler die ZIELWAHL DES ZAUBERS ab, ist das ein
      // Rueckweg, kein Ende: wir landen wieder bei der Caster-Wahl (bzw.
      // bei nur einem Helden gleich in der Galerie). Damit der Knopf das
      // auch sagt, setzt `_promptCancelLabel` fuer die Dauer des fremden
      // Aufrufs „BACK" — die Zauberkarte selbst weiss davon nichts.
      engine._promptCancelLabel = '↩ BACK';
      let cast;
      try {
        cast = await engine._castSpellImmediately(pi, held.heroIdx, zauber, {
          fromZone: 'hand', pool: ps.hand, poolIndex: handIdx, by: CARD_NAME,
        });
      } finally {
        delete engine._promptCancelLabel;
      }
      if (cast?.cancelled) { schritt = heldenZahl > 1 ? 'hero' : 'spell'; continue; }
      break;
    }

    // Einmal je Partie — erst jetzt, wo der Zauber wirklich gelaufen ist.
    if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
    ps._oncePerGameUsed.add(CARD_NAME);

    engine.log('difficulty_lever', {
      player: ps.username, spell: zauber, hero: held.cardName,
    });
    engine.sync();

    // ── „This must be the only Action to perform this turn" ─────────
    // Eine vom Zauber selbst gewaehrte Gratisaktion darf die Klammer
    // nicht aufbrechen.
    delete gs._spellFreeAction;
    ps._playerActionLockedTurn = gs.turn;
    engine.sync();
    return true;
  },
};
