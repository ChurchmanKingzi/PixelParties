// ═══════════════════════════════════════════
//  CREATURE / REACTION: "Explosive Drone"
//
//  „You may immediately summon this Creature as an additional Action
//   when a target you control is defeated by an opponent's card or
//   effect. When this Creature is defeated by an opponent's card or
//   effect, choose a target and deal 150 damage to it."
//
//  ZWEI TEILE
//
//   • AUSLOESER (Hand): jedes ZIEL zaehlt — Held ODER Creature. Deshalb
//     haengt die Karte an BEIDEN Tod-Fenstern (`onCreatureDeath` und
//     `onHeroKO`) mit derselben Bedingung: das Opfer gehoert MIR, die
//     Quelle dem Gegner. Eigene Opferungen, Rueckstoss und Statusschaden
//     ohne Verursacher loesen also nicht aus.
//     Bauart wie „Doomed Town Guard" und „Chaorc Rider Warg":
//     Bestaetigung → Zonenwahl → `summonCreatureWithHooks`.
//     BEWUSST KEIN `isReaction: true` — das meldet eine Karte im
//     generischen Kettenfenster bei JEDEM Kartenspiel als spielbar
//     (Lehre aus Pawn Chain, v830); der Ausloeser hier ist der eigene
//     Hook.
//
//     UNTERSCHIED zu Doomed Town Guard: dort steht „one or more
//     targets", also EIN Prompt fuer ein ganzes Sterbe-Ereignis — mit
//     Klammer ueber den Spielerzustand. Hier steht „a target", jeder Tod
//     ist sein eigener Ausloeser. Eine Klammer gibt es deshalb nicht;
//     gegen doppelte Beschwoerung genuegt die Handpruefung, denn nach
//     der ersten liegt die Karte nicht mehr auf der Hand.
//
//     „as an additional Action": die Beschwoerung laeuft ueber den Hook,
//     nicht ueber den Aktionsweg — sie verbraucht die Zug-Aktion also
//     ohnehin nicht. Kein `inherentAction`-Flag noetig (das gilt dem
//     regulaeren Ausspielen aus der Hand).
//
//   • TOD (Support): stirbt die Drohne durch den GEGNER, waehlt ihr
//     Besitzer ein beliebiges Ziel und schiesst 150 hinterher. Stirbt
//     sie anders (eigene Opferung, Zugende-Effekte, Rueckstoss), bleibt
//     sie still — dieselbe Quellenpruefung wie beim Ausloeser.
// ═══════════════════════════════════════════

const CARD_NAME = 'Explosive Drone';
const SCHADEN   = 150;

/** Freie Support Zones, in die dieser Spieler jetzt beschwoeren darf. */
function beschwoerbareZonen(engine, pi) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    if (!engine._canHeroActivateSurprise(pi, hi, CARD_NAME)) continue;
    for (let zi = 0; zi < 3; zi++) {
      if (((ps.supportZones?.[hi] || [])[zi] || []).length === 0) out.push({ heroIdx: hi, slotIdx: zi });
    }
  }
  return out;
}

/** Kam der Tod von der Gegenseite? */
function vomGegner(ctx, pi) {
  const srcOwner = ctx.source?.owner ?? ctx.source?.controller;
  return srcOwner != null && srcOwner !== pi;
}

/** Gemeinsamer Weg beider Tod-Fenster: fragen, Zone waehlen, beschwoeren. */
async function reagiereAufTod(ctx, opferName) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardController ?? ctx.cardOwner;
  const ps = gs.players[pi];
  if (!ps || !(ps.hand || []).includes(CARD_NAME)) return;

  let zonen = beschwoerbareZonen(engine, pi);
  if (zonen.length === 0) return;

  const ja = await engine.promptGeneric(pi, {
    type: 'confirm',
    title: CARD_NAME,
    message: `${opferName} was defeated! Summon ${CARD_NAME} from your hand as an additional Action?`,
    showCard: CARD_NAME,
    confirmLabel: '🛩️ Summon!',
    cancelLabel: 'No',
    cancellable: true,
  });
  if (!ja) return;

  // Nach dem Prompt neu pruefen — waehrend der Spieler ueberlegt, kann
  // sich das Brett geaendert haben (Kettenreaktionen).
  if (!(ps.hand || []).includes(CARD_NAME)) return;
  zonen = beschwoerbareZonen(engine, pi);
  if (zonen.length === 0) return;

  let ziel = zonen[0];
  if (zonen.length > 1) {
    const wahl = await engine.promptGeneric(pi, {
      type: 'zonePick',
      title: CARD_NAME,
      description: `Summon ${CARD_NAME} into which Support Zone?`,
      zones: zonen,
      cancellable: true,
    });
    if (!wahl || wahl.cancelled) return;
    ziel = { heroIdx: wahl.heroIdx, slotIdx: wahl.slotIdx };
  }

  // ★ Grundregel (CARD_API): ein Effekt, der sich aus einem Hook heraus
  // aktiviert, streamt seine Karte an BEIDE Spieler — erst NACH dem Ja.
  await engine.showTriggeredEffect(CARD_NAME, {
    playerIdx: pi,
    source: `drone:${gs.turn}:${opferName}`,
  });

  const handIdx = ps.hand.indexOf(CARD_NAME);
  engine.takeFromPileSync(ps, 'hand', handIdx);
  const res = await engine.summonCreatureWithHooks(
    CARD_NAME, pi, ziel.heroIdx, ziel.slotIdx,
    // `fromHandIdx` laesst die Karte sichtbar von der Hand in die Zone
    // fliegen — ohne das erscheint sie dort einfach (v933).
    { source: CARD_NAME, fromHandIdx: handIdx },
  );
  if (!res?.inst) { engine.handZugangSync(ps, CARD_NAME, { von: 'rueckgabe', ohneInstanz: true }); return; }   // v1395

  engine.log('explosive_drone_summon', { player: ps.username, defeated: opferName });
  engine.sync();
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'explosion' }, impactMs: 260,
  },

  activeIn: ['hand', 'support'],

  // CPU: beide Prompts sind fuer sie gut — die Drohne kostet keine
  // Aktion und droht dem Gegner mit 150. Ohne diesen Eintrag lehnt der
  // generische Responder abbrechbare Prompts pauschal ab
  // (Barker-Bugklasse).
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic') {
      if (promptData?.type === 'confirm') return { confirmed: true };
      if (promptData?.type === 'zonePick') {
        const z = (promptData.zones || [])[0];
        return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx } : undefined;
      }
      return undefined;
    }
    if (kind === 'effectTarget') {
      const quelle = promptData?.config?.source || promptData?.config?.title;
      if (quelle !== CARD_NAME) return undefined;
      const ziele = (promptData?.validTargets || [])
        .filter(t => t && t.owner !== promptData.playerIdx);
      if (ziele.length === 0) return undefined;
      // Der Schuss soll moeglichst toeten, sonst den teuersten Kopf treffen.
      let bestes = ziele[0], bestwert = -Infinity;
      for (const t of ziele) {
        let hp = Infinity, wert = 0;
        if (t.type === 'hero') {
          const h = engine?.gs?.players?.[t.owner]?.heroes?.[t.heroIdx];
          hp = h?.hp ?? Infinity; wert = 500 + (h?.atk || 0);
        } else {
          const inst = t.cardInstance;
          hp = inst?.counters?.currentHp ?? Infinity; wert = inst?.counters?.maxHp || 0;
        }
        if (hp <= SCHADEN) wert += 10000 - hp;
        if (wert > bestwert) { bestwert = wert; bestes = t; }
      }
      return [bestes.id];
    }
    return undefined;
  },

  cpuMeta: {
    // Die Beschwoerung laeuft ueber den Hook und kostet die Zug-Aktion
    // nicht — die Aktionsplanung soll das nicht als Aktion zaehlen.
    usesAction: false,
  },

  hooks: {
    // ── Ausloeser A: eigene Creature stirbt durch den Gegner ─────────
    onCreatureDeath: async (ctx) => {
      // Auf der HAND ist die Karte der Ausloeser, in der SUPPORT ZONE
      // der eigene Tod — zwei voellig verschiedene Zweige im selben Hook.
      if (ctx.cardZone === 'support') {
        await eigenerTod(ctx);
        return;
      }
      if (ctx.cardZone !== 'hand') return;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const tot = ctx.creature;
      if (!tot) return;
      if ((tot.controller ?? tot.owner) !== pi) return;
      if (!vomGegner(ctx, pi)) return;
      await reagiereAufTod(ctx, tot.name);
    },

    // ── Ausloeser B: eigener Held stirbt durch den Gegner ────────────
    // „a target you control" schliesst Helden ein.
    onHeroKO: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      const engine = ctx._engine;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const held = ctx.hero;
      if (!held?.name) return;
      const helden = engine.gs.players?.[pi]?.heroes || [];
      if (helden.indexOf(held) < 0) return;          // nur eigene Helden
      if (!vomGegner(ctx, pi)) return;
      await reagiereAufTod(ctx, held.name);
    },
  },
};

/**
 * Der eigene Tod: nur wenn ihn der GEGNER verursacht hat. Stirbt die
 * Drohne durch eine eigene Opferung, Rueckstoss oder einen
 * Zugende-Effekt, passiert nichts — dieselbe Quellenpruefung wie beim
 * Ausloeser.
 */
async function eigenerTod(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const ich = ctx.card;
  const tot = ctx.creature;
  // ★ DIE TODESMELDUNG IST KEINE INSTANZ (Als Befund 12.9.) ─────────
  // `onCreatureDeath` uebergibt ein `deathInfo`-Objekt — einen
  // Schnappschuss mit `name`, `owner`, `heroIdx`, `zoneSlot` und der
  // Kennung unter **`instId`**, NICHT unter `id`. Der Vergleich
  // `tot.id !== ich.id` war deshalb immer wahr (undefined), und die
  // Detonation feuerte nie. Vorbild: Exploding Skull
  // (`death.instId !== ctx.card.id`).
  if (!ich || !tot) return;
  if ((tot.instId ?? tot.id) !== ich.id) return;     // nur der EIGENE Tod
  const pi = ich.controller ?? ich.owner;
  if (!vomGegner(ctx, pi)) return;

  const ziel = await ctx.promptDamageTarget({
    side: 'any',
    types: ['hero', 'creature'],
    damageType: 'creature',
    baseDamage: SCHADEN,
    title: CARD_NAME,
    source: CARD_NAME,
    description: `${CARD_NAME} was destroyed — choose any target to take ${SCHADEN} damage.`,
    confirmLabel: `💥 Detonate! (${SCHADEN})`,
    confirmClass: 'btn-danger',
    cancellable: true,
    maxTotal: 1,
  });
  if (!ziel) return;

  await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

  const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: ich.heroIdx };
  const slot = ziel.type === 'hero' ? -1 : ziel.slotIdx;
  engine._broadcastEvent('play_zone_animation', {
    type: 'explosion', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: slot,
  });
  await engine._delay(200);

  if (ziel.type === 'hero') {
    const opfer = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
    if (opfer?.name && opfer.hp > 0) await engine.actionDealDamage(quelle, opfer, SCHADEN, 'creature');
  } else {
    const opfer = ziel.cardInstance
      || engine.findCards({ controller: ziel.owner, zone: 'support', heroIdx: ziel.heroIdx })
           .find(c => c.zoneSlot === ziel.slotIdx);
    if (opfer) await engine.actionDealCreatureDamage(quelle, opfer, SCHADEN, 'creature', { sourceOwner: pi });
  }
  engine.log('explosive_drone_detonate', {
    player: gs.players[pi]?.username, target: ziel.cardName, damage: SCHADEN,
  });
  engine.sync();
}
