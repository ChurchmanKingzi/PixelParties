// ═══════════════════════════════════════════
//  CARD EFFECT: "Hunting"
//  Ability — 3 Stufen (Stapelhoehe in der Ability-Zone des Helden).
//
//  1) Once per turn, when this Hero defeats an opponent's Creature,
//     you may add it to your hand instead of sending it to the
//     discard pile.
//  2) … you may fully heal its HP and take permanent control of it by
//     placing it into this Hero's free Support Zone. Negate its
//     effect for the rest of the turn.
//  3) wie 2), ohne die Negation.
//
//  ── ALS RULINGS (31.8.), BINDEND ──────────────────────────────────
//  ① „Fully heal its HP" meint die CREATURE, nicht den Helden.
//  ② Die Creature STIRBT dabei wirklich: on-death UND on-kill feuern
//     regulaer. Danach wird sie mit vollen HP an ihren neuen Platz
//     BEWEGT — es ist KEINE Beschwoerung (Als Praezisierung 31.8.):
//     keine on-summon-Effekte, KEINE Summoning Sickness. Der `turnPlayed`
//     der alten Instanz wandert deshalb mit; die Creature bleibt fuer
//     Frische-Filter (Alice, Hive's Crown, Singing) so alt wie zuvor.
//  ②a Gefragt wird im ANSPRUCHSFENSTER `onCreatureDeathClaim` — VOR
//     der Ablage und vor jedem Flug dorthin. Die Karte macht deshalb
//     keinen Zwischenstopp im Ablagestapel, weder sichtbar noch im
//     Zustand: sie geht direkt von ihrer alten Support Zone in die
//     neue (bzw. in die Hand).
//  ③ Nur solange der HUNTING-HELD selbst eine freie Support Zone hat.
//     Das ist enger als Dark Gear, das jede freie Zone der eigenen
//     Seite nimmt — hier steht ausdruecklich „this Hero's free
//     Support Zone".
//  ④ KEINE Summoning Magic noetig — die Wiederbelebung ist kein
//     Beschwoeren aus der Hand. `skipHooks` haelt on-summon-Reiter
//     fern (die Creature ist dieselbe, die eben starb).
//  ⑤ KEINE Zonenauswahl: automatisch die erste freie Zone des
//     Hunting-Helden.
//  ⑥ Boris & Co. blocken JEDE Stufe, auch Stufe 1 (Als Korrektur
//     31.8.: „Boris soll AUCH Level 1 blocken"). Das Gate sitzt
//     deshalb VOR der Stufenaufteilung — wer die Uebernahme
//     verhindert, verhindert auch das Einsacken in die Hand.
//
//  ── ABGRENZUNG: WAS HEISST „DEFEATS"? ─────────────────────────────
//  „Wenn der Hero eine Creature toetet, egal wie, zaehlt das" (Al
//  1.9.). Also SCHADEN UND ZERSTOERUNG: das Anspruchsfenster feuert
//  im Schadens-Batch UND in `actionDestroyCard` (Insta-Kills wie
//  Ralzish). Der Held muss die Quelle sein: `source.heroIdx` ist
//  seiner und `source.owner` seine Seite — so bauen Heldeneffekte
//  ihre Quelle (`{ name, owner, heroIdx }`; 60 von 63 Schadens- und
//  14 von 50 Zerstoerungs-Aufrufern). Ohne heroIdx sind es
//  Kreaturen- oder Gegenstandseffekte (Afflicted Vermin, Spinnen,
//  Blood-Soaked Coin) — die zaehlen bewusst nicht als „dieser Held
//  besiegt".
//
//  Kontrolluebernahme-Semantik wie Dark Gear: `originalOwner` bleibt
//  eingefroren, die Karte kehrt spaeter in die Ablage ihres
//  URSPRUENGLICHEN Besitzers zurueck.
// ═══════════════════════════════════════════

const CARD_NAME = 'Hunting';

/** Erste freie Support Zone GENAU dieses Helden, sonst -1. */
function ersteFreieZone(ps, heroIdx) {
  const slots = ps?.supportZones?.[heroIdx] || [];
  for (let si = 0; si < slots.length; si++) {
    if (!slots[si] || slots[si].length === 0) return si;
  }
  return -1;
}

/** Blockt ein gegnerischer Boris die Kontrolluebernahme gerade? */
function uebernahmeGesperrt(engine, pi) {
  // Dieselbe Wahrheit, die `borisBlockIdx` fuer Handkarten mit
  // `takesControlOfTargets` liest — nur direkt gefragt, weil eine
  // Ability nie durch die Handkarten-Sperre laeuft.
  return !!engine.borisHidesOpponentSide?.(pi);
}

module.exports = {
  activeIn: ['ability'],
  // Fuer Boris & Co. als Kontrolluebernahme kenntlich (ab Stufe 2).
  takesControlOfTargets: true,

  hooks: {
    // Anspruchsfenster: laeuft VOR der Ablage (siehe Ruling ②a).
    onCreatureDeathClaim: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const tot = ctx.creature;
      if (!tot) return;

      const pi = ctx.cardOwner;
      const hi = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const held = ps?.heroes?.[hi];
      if (!held?.name || held.hp <= 0) return;

      // ── Hat DIESER Held die Creature besiegt? ────────────────────
      const quelle = ctx.source;
      if (!quelle || quelle.owner !== pi || quelle.heroIdx !== hi) return;

      // ── War es eine GEGNERISCHE Creature? ────────────────────────
      // Ueber den Controller, damit eine per Cross-Side-Platzierung
      // auf die Gegenseite gelegte Creature korrekt zaehlt.
      const gegnerSeite = tot.controller ?? tot.owner;
      if (gegnerSeite === pi) return;

      // ── Stapelhoehe = Stufe, Dedup ueber die kleinste Instanz-ID ──
      const stapel = engine.cardInstances.filter(c =>
        (c.controller ?? c.owner) === pi
        && c.heroIdx === hi
        && c.zone === 'ability'
        && c.name === CARD_NAME
        && !c.faceDown);
      if (stapel.length === 0) return;
      const ids = stapel.map(c => c.id).sort();
      if (ctx.card.id !== ids[0]) return;
      const stufe = Math.min(stapel.length, 3);

      // ── HOPT, VOR der Wirkung geklaut ────────────────────────────
      const hoptKey = `hunting:${pi}-${hi}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

      // ── Kontrolluebernahme-Blocker (Boris & Co.) ─────────────────
      // Gilt fuer ALLE Stufen (Als Korrektur 31.8.).
      if (uebernahmeGesperrt(engine, pi)) {
        engine.log('hunting_blocked', {
          player: ps.username, hero: held.name,
          creature: tot.name, level: stufe, reason: 'takeover_blocked',
        });
        return;
      }

      // ── Die Instanz, die gerade stirbt ───────────────────────────
      const inst = engine.cardInstances.find(c => c.id === tot.instId);
      if (!inst) return;

      // ── Stufe 1: in die Hand statt in die Ablage ─────────────────
      if (stufe === 1) {
        const ja = await engine.promptGeneric(pi, {
          type: 'confirm', title: CARD_NAME,
          message: `Add ${tot.name} to your hand instead of sending it to the discard pile?`,
          confirmLabel: '🪤 Take it', cancelLabel: 'No', cancellable: true,
        });
        if (!ja) return;
        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[hoptKey] = gs.turn;
        await engine.showTriggeredEffect(CARD_NAME);   // Regel: aktivierter Effekt zeigt seine Karte
        // Anspruch: die Engine legt den Kadaver gar nicht erst ab und
        // laesst ihn nach allen Todeslistenern von seiner Sterbezone
        // in meine Hand fliegen.
        inst._deathClaim = {
          to: 'hand', name: tot.name, owner: pi, by: CARD_NAME,
        };
        engine.log('hunting_to_hand', {
          player: ps.username, hero: held.name, creature: tot.name,
        });
        return;
      }

      // ── Stufe 2/3: Uebernahme in die eigene Support Zone ─────────
      const zone = ersteFreieZone(ps, hi);
      if (zone < 0) return;                       // Als Ruling ③

      const negiert = stufe === 2;
      const ja = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME,
        message: `Fully heal ${tot.name} and take permanent control of it`
          + `, placing it into ${held.name}'s Support Zone?`
          + (negiert ? ' Its effect is negated for the rest of the turn.' : ''),
        confirmLabel: '🕸️ Capture', cancelLabel: 'No', cancellable: true,
      });
      if (!ja) return;
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;
      await engine.showTriggeredEffect(CARD_NAME);   // Regel: aktivierter Effekt zeigt seine Karte

      // Anspruch auf die Support Zone: reine BEWEGUNG nach allen
      // Todeslistenern — kein Ablage-Zwischenstopp, kein Summon,
      // keine Summoning Sickness, volle HP (Als Rulings ① ② ②a ④).
      // `keepOriginalOwner` friert den Eigentuemer ein wie Dark Gear.
      inst._deathClaim = {
        to: 'support',
        name: tot.name,
        owner: pi,
        heroIdx: hi,
        zoneSlot: zone,
        keepOriginalOwner: tot.originalOwner ?? gegnerSeite,
        negate: negiert,            // Stufe 2: Effekt bis Zugende aus
        by: CARD_NAME,
        // Das Netz laeuft GEMEINSAM mit dem Kartenflug, nicht hier:
        // zwischen Anspruchsfenster und Einloesung liegt der ganze
        // Todeszweig. Die Engine sendet es beim Einloesen.
        redeemEvent: {
          type: 'hunting_net',
          data: {
            fromOwner: gegnerSeite, fromHeroIdx: tot.heroIdx, fromSlot: tot.zoneSlot,
            toOwner: pi, toHeroIdx: hi, toSlot: zone, cardName: tot.name,
          },
        },
      };

      engine.log('hunting_capture', {
        player: ps.username, hero: held.name, creature: tot.name,
        level: stufe, negated: negiert,
      });
    },
  },
};
