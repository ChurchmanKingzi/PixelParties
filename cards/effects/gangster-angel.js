// ═══════════════════════════════════════════
//  CARD EFFECT: "Gangster Angel"
//  Creature (Summoning Magic Lv0, Normal) — 50 HP, kein ATK.
//
//  EFFECT (per cards.json):
//   "When you summon this Creature, you may immediately summon an
//    \"Angler Angel\" from your hand as an additional Action and
//    immediately end your turn afterwards. You may once per turn deal
//    10 damage to all targets your opponent controls."
//
//  ── ① Beim Beschwoeren: der Angler-Zug ────────────────────────────
//  Freiwillig, und ein Paket: Angler Angel aus der HAND aufs Feld —
//  ohne Aktionskosten — und danach ist der Zug sofort vorbei. Wer
//  ablehnt, behaelt seinen Zug.
//
//  Die Beschwoerung laeuft ueber `summonCreatureWithHooks`, also mit
//  vollem Ablauf (`beforeSummon`, `onPlay`, `onCardEnterZone`) —
//  dieselbe Bauform wie bei Mischief Militia SnowItAll: Slot waehlen,
//  aus der Hand nehmen, beschwoeren, bei Fehlschlag die Handkarte
//  zurueckgeben.
//
//  „as an additional Action" heisst hier schlicht: es kostet keinen
//  Aktionsplatz. Ein Grant wie bei Psychic Scout waere falsch — der
//  Angler kommt SOFORT, nicht irgendwann spaeter im Zug.
//
//  Das Zugende laeuft ueber `gs._terrorForceEndTurn` — derselbe Weg,
//  den Doom Prophecy benutzt. Der Server wartet in `sendGameState`,
//  bis Abfragen, Effekte und Ketten durch sind, und faehrt dann die
//  End Phase. Damit greifen auch die vorhandenen Gegenmittel: ein
//  Tuscan Prisoner auf der eigenen Seite (`immuneToAllTurnEnd`) haelt
//  den Zug offen. Blackstache blockt NICHT — er wehrt nur fremde
//  Zugenden ab, und das hier ist die eigene Karte.
//
//  ── ② Aktiv-Effekt: 10 Schaden auf alles Gegnerische ──────────────
//  Einmal je Zug (weiche HOPT pro Instanz), Main Phase, kein
//  Aktionsplatz. Helden einzeln, Kreaturen als Stapel — die
//  kanonische Bauform von Exploding Skull.
//
//  ★ WICHTIG fuer das Zusammenspiel mit [[Angler Angel]]: ALLE
//  Treffer teilen sich EIN Quellobjekt (`const quelle = {...}`).
//  Genau daran erkennt Anglers Aura „das faellt gleichzeitig" und
//  erhoeht den ganzen Schlag statt nur des ersten Treffers. Wer diese
//  Karte spaeter umbaut: das gemeinsame Objekt NICHT je Ziel neu
//  bauen, sonst zerfaellt der Flaechenschlag in Einzelinstanzen und
//  nur der erste bekommt die +50.
// ═══════════════════════════════════════════

const CARD_NAME = 'Gangster Angel';
const PARTNER = 'Angler Angel';
const DAMAGE = 10;

/** Freie eigene Support-Plaetze bei lebenden Helden. */
function freieSlots(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const slots = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const zones = ps.supportZones?.[hi] || [];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) {
        slots.push({ heroIdx: hi, slotIdx: zi, label: `${hero.name} — Slot ${zi + 1}` });
      }
    }
  }
  return slots;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: false,
  // ^ Der Aktiv-Effekt trifft ALLES Gegnerische, es gibt keine Zielwahl —
  //   also auch kein Blinded-Gate (siehe `_hooks.js`).

  /**
   * Kein Ziel zu treffen? Dann die Rundennutzung nicht verbrennen.
   */
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const oi = ctx.cardOwner === 0 ? 1 : 0;
    return (engine.getHeroTargets(oi).length + engine.getCreatureTargets(oi).length) > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oi = pi === 0 ? 1 : 0;

    const ziele = [...engine.getHeroTargets(oi), ...engine.getCreatureTargets(oi)];
    if (ziele.length === 0) return false;

    for (const t of ziele) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'gunshot_barrage',
        owner: t.owner, heroIdx: t.heroIdx,
        zoneSlot: t.type === 'equip' ? t.slotIdx : -1,
      });
    }
    await engine._delay(420);

    // ── EIN Quellobjekt fuer den ganzen Schlag ──
    // Siehe Kopfkommentar: das ist die Kennzeichnung, an der Angler
    // Angel „gleichzeitig" erkennt.
    const quelle = {
      name: CARD_NAME, owner: pi, heroIdx: ctx.card?.heroIdx ?? -1,
      controller: pi, cardInstance: ctx.card,
    };

    const stapel = [];
    for (const t of ziele) {
      if (t.type === 'hero') {
        const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
        if (hero && hero.hp > 0) {
          await engine.actionDealDamage(quelle, hero, DAMAGE, 'creature');
        }
      } else if (t.cardInstance) {
        stapel.push({
          inst: t.cardInstance,
          amount: DAMAGE,
          type: 'creature',
          source: quelle,
          sourceOwner: pi,
          canBeNegated: true,
          isStatusDamage: false,
          animType: null,
        });
      }
    }
    if (stapel.length > 0) await engine.processCreatureDamageBatch(stapel);

    engine.log('gangster_barrage', {
      player: gs.players[pi]?.username, damage: DAMAGE, targets: ziele.length,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /**
     * Beim eigenen Beschwoeren: Angler Angel aus der Hand nachziehen
     * und den Zug beenden — beides freiwillig, beides zusammen.
     */
    onPlay: async (ctx) => {
      // Nur die EIGENE Beschwoerung (die Engine feuert onPlay an jeden
      // Zuhoerer). Kanonisches Muster, siehe acid-rain.js / berserk.js.
      if (ctx.playedCard?.id !== ctx.card?.id) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Angebot nur, wenn es auch ausfuehrbar ist: Angler in der Hand
      // UND ein freier Platz. Sonst waere die Abfrage eine Falle —
      // „ja" haette den Zug beendet, ohne den Angler zu bringen.
      if (!(ps.hand || []).includes(PARTNER)) return;
      const slots = freieSlots(engine, pi);
      if (slots.length === 0) return;

      const antwort = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Summon ${PARTNER} from your hand as an additional Action? Your turn ends immediately afterwards.`,
        showCard: PARTNER,
        confirmLabel: '🕴️ Summon and end turn',
        cancelLabel: 'No, keep my turn',
        cancellable: true,
      });
      if (!antwort || antwort.cancelled) return;

      // Platz waehlen (bei genau einem freien Platz ohne Rueckfrage).
      let ziel = slots[0];
      if (slots.length > 1) {
        const pick = await ctx.promptZonePick(slots, {
          title: CARD_NAME,
          description: `Place ${PARTNER} into a free Support Zone.`,
          cancellable: false,
        });
        ziel = slots.find(z => z.heroIdx === pick?.heroIdx && z.slotIdx === pick?.slotIdx) || slots[0];
      }

      const handIdx = (ps.hand || []).indexOf(PARTNER);
      if (handIdx < 0) return;                       // Rennen: Karte ist weg
      ps.hand.splice(handIdx, 1);

      const ergebnis = await engine.summonCreatureWithHooks(
        PARTNER, pi, ziel.heroIdx, ziel.slotIdx, { source: CARD_NAME },
      );
      if (!ergebnis?.inst) {
        // Abgebrochen (z.B. durch eine Kosten-Abfrage der Zielkarte):
        // Handkarte zurueck, und der Zug bleibt offen.
        ps.hand.splice(handIdx, 0, PARTNER);
        engine.log('gangster_partner_failed', {
          player: ps.username, partner: PARTNER,
        });
        engine.sync();
        return;
      }

      // Zugende anmelden — der Server fuehrt es aus, sobald nichts mehr
      // in der Schwebe ist.
      gs._terrorForceEndTurn = pi;
      gs._terrorForceEndSource = { name: CARD_NAME, owner: pi };

      engine.log('gangster_partner_summon', {
        player: ps.username, partner: PARTNER,
        heroIdx: ziel.heroIdx, slotIdx: ziel.slotIdx,
      });
      engine.sync();
    },
  },
};
