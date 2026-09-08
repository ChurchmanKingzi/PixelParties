// ═══════════════════════════════════════════
//  CARD EFFECT: "True Fairy Crestina, the Primordial Goddess"
//  Ascended Hero — 500 HP / 60 ATK
//
//  "You must play this Hero from your hand on top of a 'Fairy Queen
//   Crestina, the Creation Fairy' you control that has 'Divine
//   Awakening' attached to it.
//   During your Resource Phase, you may skip drawing your card for turn
//   and instead search any card from your deck and place it next to you
//   face-up.
//   While you control this Hero, you may play cards placed by this
//   effect as if they were part of your hand.
//   Once per turn, when an Ascended Hero you control would take damage,
//   you may delete a card placed by this effect to negate that damage."
//
//  ── DER VORRAT ("Creation Zone") ──────────────────────────────────
//  Satz 3 ist KEIN Karteneffekt, sondern ein Kernmechanismus: eine
//  zweite, offen liegende Kartenquelle, aus der nach allen normalen
//  Regeln gespielt wird. Er sitzt deshalb nicht hier, sondern in der
//  Engine (`ZONES.CREATION`, `isCreationZoneUsable`, `handSourceList`)
//  und in den Spielwegen. Diese Datei liefert nur die drei Saetze, die
//  wirklich der KARTE gehoeren.
//
//  ── ALS RULINGS (28.8.), BINDEND ──────────────────────────────────
//  ① Die Karten sind spielbar wie Handkarten, gelten aber NICHT als
//     solche: kein Handlimit, kein Ziel fuer Loot the Leftovers & Co.
//  ② Verlaesst Crestina das Feld oder wird sie behindert (Frozen,
//     Stunned, negiert …), bleiben die Karten LIEGEN und werden nur
//     unbenutzbar. Kommt sie zurueck, sind sie es wieder.
//  Beides steckt in `isCreationZoneUsable` — der einen Wahrheit, die
//  Anzeige und Server-Pruefung gemeinsam lesen.
// ═══════════════════════════════════════════

const { eligibleCreationIndices } = require('./_hand-resolve');

const CARD_NAME = 'True Fairy Crestina, the Primordial Goddess';
const BASIS_FORM = 'Fairy Queen Crestina, the Creation Fairy';
const AWAKENING = 'Divine Awakening';

/** Traegt dieser Held ein „Divine Awakening" in einer Support Zone? */
function hatAwakening(engine, pi, heroIdx) {
  return engine.cardInstances.some(c =>
    c.owner === pi && c.zone === 'support' && c.heroIdx === heroIdx
    && c.name === AWAKENING);
}

module.exports = {
  activeIn: ['hero'],

  /**
   * ① „You must play this Hero from your hand on top of a 'Fairy Queen
   * Crestina, the Creation Fairy' you control that has 'Divine
   * Awakening' attached to it."
   *
   * Die Bedingung gehoert auf die ASCENDED Karte, weil der Satz hier
   * gedruckt steht (Hausregel, siehe `performAscension`).
   *
   * Die Namensbindung prueft die Engine nicht selbst — sie steht nur
   * im Text —, also steht sie mit hier drin.
   */
  ascensionCondition(gs, pi, heroIdx, engine) {
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if (hero.name !== BASIS_FORM) return false;
    return hatAwakening(engine, pi, heroIdx);
  },

  hooks: {
    /**
     * ② „During your Resource Phase, you may skip drawing your card for
     * turn and instead search any card from your deck and place it next
     * to you face-up."
     *
     * Bauform von der BASIS-Crestina uebernommen: derselbe
     * `onPhaseStart`-Hook, dieselben Riegel (`_skipResourceDraw`,
     * `_resourcePhaseLocked`), damit sich die beiden Formen im Ablauf
     * gleich anfuehlen.
     *
     * Unterschied zur Basis: kein Dreier-Angebot und keine gegnerische
     * Wahl — es ist eine schlichte Decksuche, und die gefundene Karte
     * geht NICHT auf die Hand, sondern offen in den Vorrat.
     */
    onPhaseStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) return;

      // Nur in der EIGENEN Resource Phase.
      if (gs.activePlayer !== pi) return;
      if (gs.currentPhase !== 1) return;
      if (gs._skipResourceDraw || gs._resourcePhaseLocked) return;

      // Der Held muss handlungsfaehig sein — dieselbe Huerde wie fuer
      // die Benutzbarkeit des Vorrats, damit sich beides gleich
      // verhaelt (Ruling ②).
      const hero = ps.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      const st = hero.statuses || {};
      if (st.frozen || st.stunned || st.webbed || st.negated || st.bound) return;

      const cardDB = engine._getCardDB();
      // „search any card from your deck" — jeder Name einmal, damit die
      // Galerie bei vielen Kopien nicht zuwaechst.
      const gesehen = new Set();
      const kandidaten = [];
      for (const name of (ps.mainDeck || [])) {
        if (gesehen.has(name) || !cardDB[name]) continue;
        gesehen.add(name);
        kandidaten.push(name);
      }
      if (kandidaten.length === 0) return;

      const bestaetigt = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: 'Skip your draw to search any card from your deck and place it face-up next to you?',
        showCard: CARD_NAME,
        confirmLabel: '✨ Search!',
        cancelLabel: 'Draw normally',
        cancellable: true,
      });
      if (!bestaetigt) return;

      // Zug bezahlt: der Zug fuer diese Runde entfaellt, und die
      // Resource Phase ist danach zu. Beides VOR der Auswahl setzen,
      // damit ein Abbruch im Waehler den Zug nicht zurueckgibt.
      gs._skipResourceDraw = true;
      gs._resourcePhaseLocked = true;
      engine.sync();

      kandidaten.sort((a, b) => a.localeCompare(b));
      const gewaehlt = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        menuSource: CARD_NAME,
        cards: kandidaten.map(name => ({ name, source: 'deck' })),
        title: CARD_NAME,
        description: 'Choose any card from your deck. It is placed face-up next to you and can be played as if it were in your hand.',
        confirmLabel: '✨ Place!',
        cancellable: false,
        searchable: true,
        searchPlaceholder: 'Filter by name…',
      });
      const name = gewaehlt?.cardName || gewaehlt?.name;
      if (!name) return;

      const _taken_di = await engine.takeFromPile(ps, 'deck', name, { source: CARD_NAME });   // v820: Stapel-Schicht
      if (!_taken_di) return;
      if (!Array.isArray(ps.creationZone)) ps.creationZone = [];
      ps.creationZone.push(name);
      // Als Instanz verfolgen, wie jede andere Zone auch — sonst
      // sehen `activeIn`-Listener die Karte dort nie.
      engine._trackCard(name, pi, 'creationZone', -1, ps.creationZone.length - 1);
      if (typeof engine.shuffleDeck === 'function') engine.shuffleDeck(pi);

      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: name, from: 'deck', to: 'creation',
        toCreationIdx: ps.creationZone.length - 1,
      });
      engine._broadcastEvent('play_zone_animation', {
        type: 'holy_revival', owner: pi, heroIdx,
      });
      engine.log('crestina_creation_search', { player: ps.username, card: name });
      engine.sync();
    },

    /**
     * ③ „Once per turn, when an Ascended Hero you control would take
     * damage, you may delete a card placed by this effect to negate
     * that damage."
     *
     * Bauform von „Idej Projection": im `beforeDamage`-Fenster
     * abbrechen ist der Hebel der Engine fuer „Schaden UND die daran
     * haengenden Wirkungen" negieren.
     *
     * Gilt fuer JEDEN eigenen Ascended Hero, nicht nur fuer Crestina
     * selbst — der Text sagt „an Ascended Hero you control".
     */
    beforeDamage: async (ctx) => {
      if (ctx.cancelled) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      if (!(ctx.amount > 0)) return;

      // Einmal pro Zug.
      const hero = ps.heroes?.[ctx.cardHeroIdx];
      if (!hero) return;
      if (hero._crestinaNegateTurn === gs.turn) return;

      // Crestina selbst muss handlungsfaehig sein — und der Vorrat
      // benutzbar. Dieselbe eine Wahrheit wie ueberall.
      if (!engine.isCreationZoneUsable(pi)) return;

      // Ziel muss ein EIGENER Ascended Hero sein.
      const cardDB = engine._getCardDB();
      const ziel = ctx.target;
      if (!ziel?.name) return;
      if (cardDB[ziel.name]?.cardType !== 'Ascended Hero') return;
      if (!(ps.heroes || []).includes(ziel)) return;

      // Durchschlagender Schaden laesst sich nicht negieren — bail
      // VOR der Abfrage, sonst zahlt der Spieler eine Karte umsonst
      // (Lehre aus Idej Projection).
      if (ctx.cannotBeNegated || ctx.cannotBeReduced) return;
      if (engine._wouldHeroDamageBeVoided?.(ctx.target, ctx.source)) return;

      const vorrat = ps.creationZone || [];
      if (vorrat.length === 0) return;

      const bestaetigt = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Delete a card from your Creation Zone to negate the damage to ${ziel.name}?`,
        showCard: ctx.source?.name || CARD_NAME,
        confirmLabel: '✨ Negate!',
        cancelLabel: 'Take the damage',
        cancellable: true,
      });
      if (!bestaetigt) return;

      // ★ 28.8., Als Befund: „das Submenue ist clunky, und ich darf die
      // gerade benutzte Karte abwerfen, die mechanisch schon gar nicht
      // mehr da ist."
      //
      // Beides haengt zusammen. Die aufgeschobene Entnahme laesst die
      // gespielte Karte bis zum Ende der Aufloesung im Vorrat liegen —
      // `eligibleCreationIndices` blendet sie aus, wie es
      // `eligibleIndicesWithoutResolving` seit jeher fuer die Hand tut.
      // Und die Auswahl laeuft jetzt DIREKT IN DER ZONE, nach dem
      // Muster des Abwurf-Prompts, statt durch eine zweite Galerie.
      const waehlbar = eligibleCreationIndices(ps);
      if (waehlbar.length === 0) return;

      let idx;
      if (waehlbar.length === 1) {
        idx = waehlbar[0];
      } else {
        const antwort = await engine.promptGeneric(pi, {
          type: 'creationDiscard',
          count: 1,
          title: CARD_NAME,
          description: 'Choose a placed card to delete.',
          eligibleIndices: waehlbar,
          deleteMode: true,
          cancellable: false,
        });
        idx = antwort?.creationIndex;
        if (!Number.isInteger(idx)) return;
        // Gegenprobe: der Client darf keine gesperrte Karte melden.
        if (!waehlbar.includes(idx)) return;
      }
      const name = vorrat[idx];
      if (!name) return;

      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: name, from: 'creation', to: 'deleted',
        fromHandIdx: idx,
      });
      vorrat.splice(idx, 1);
      ps.deletedPile.push(name);
      const weg = engine.cardInstances.find(c =>
        c.owner === pi && c.zone === 'creationZone' && c.name === name);
      if (weg) engine._untrackCard(weg.id);

      hero._crestinaNegateTurn = gs.turn;
      ctx.cancelled = true;
      engine._broadcastEvent('play_zone_animation', {
        type: 'guardian_shield', owner: pi, heroIdx: (ps.heroes || []).indexOf(ziel),
      });
      engine.log('crestina_negate', {
        player: ps.username, deleted: name, protected: ziel.name,
      });
      engine.sync();
    },
  },
};
