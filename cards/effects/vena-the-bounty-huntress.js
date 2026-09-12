// ═══════════════════════════════════════════
//  HERO EFFECT: "Vena, the Bounty Huntress"
//
//  Vor dem Ziehen der Starthaende markiert Vena
//  einen gegnerischen Helden als KOPFGELD. Danach
//  einmal pro Zug fuer 5 Gold eine von drei
//  Wirkungen gegen genau diesen Helden:
//    • 150 Schaden (v904 von 100 gebufft, Al 12.9.)
//    • eine Karte aus seinen Support Zones auf die Ablage
//    • Stun fuer 1 Zug
//  Toetet der SCHADEN das Ziel, wird ein neuer
//  Held markiert.
//
//  ZUSTAND — eine einzige Quelle der Wahrheit:
//  die Marke liegt auf dem MARKIERTEN Helden als
//  `hero._bountyBy = <pi der Jaegerin>`, nicht als
//  Index auf Vena. Das haelt drei Dinge von selbst
//  richtig, die eine gespeicherte Koordinate alle
//  einzeln braeuchte:
//    • stirbt das Ziel, verschwindet die Marke mit
//      ihm — kein Zeiger ins Leere,
//    • Heldenwechsel/Ascension tragen sie mit,
//    • beide Spieler koennen je eine Vena haben,
//      ohne sich zu stoeren (jede markiert nur
//      GEGNERISCHE Helden, eine Marke je Seite).
//
//  SCHADENSTYP: 'hero' (v905). Eigener Typ fuer
//  Schaden aus einem HELDEN-Effekt: weder Angriff
//  noch Zauber noch Kreatureffekt noch Artefakt,
//  und im Gegensatz zum frueher benutzten 'other'
//  umgeht er weder Surprises noch den Zielschutz.
//  Siehe CARD_API, Abschnitt Schadenstypen.
//
//  AKTIONSFREI: der Text nennt keine Action, also
//  KEIN `heroEffectActionCost` (★-Regel 7.9.).
// ═══════════════════════════════════════════

const CARD_NAME = 'Vena, the Bounty Huntress';
const GOLD_COST = 5;
const BOUNTY_DAMAGE = 150;

// ── Zustand ──────────────────────────────────────────────────────

/** Der von `pi`s Vena markierte Held, oder null. */
function bountyFinden(engine, pi) {
  const gegner = pi === 0 ? 1 : 0;
  const helden = engine?.gs?.players?.[gegner]?.heroes || [];
  for (let hi = 0; hi < helden.length; hi++) {
    const h = helden[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h._bountyBy !== pi) continue;
    return { owner: gegner, heroIdx: hi, hero: h };
  }
  return null;
}

/** Marke setzen — vorher jede alte Marke DIESER Jaegerin loeschen. */
function bountyMarkieren(engine, pi, owner, heroIdx) {
  for (const h of engine?.gs?.players?.[owner]?.heroes || []) {
    if (h && h._bountyBy === pi) delete h._bountyBy;
  }
  const ziel = engine?.gs?.players?.[owner]?.heroes?.[heroIdx];
  if (!ziel?.name) return false;
  ziel._bountyBy = pi;
  return true;
}

/** Lebende gegnerische Helden als Zielobjekte. */
function zieleSammeln(engine, pi) {
  const gegner = pi === 0 ? 1 : 0;
  const helden = engine?.gs?.players?.[gegner]?.heroes || [];
  const out = [];
  for (let hi = 0; hi < helden.length; hi++) {
    const h = helden[hi];
    if (!h?.name || h.hp <= 0) continue;
    out.push({ id: `hero-${gegner}-${hi}`, type: 'hero', owner: gegner, heroIdx: hi, cardName: h.name });
  }
  return out;
}

/**
 * Karten in den Support Zones des markierten Helden — als INSTANZEN.
 *
 * Wichtig: `gs.players[pi].supportZones[hi][slot]` ist ein Array von
 * KARTENNAMEN (ein Stapel — Monster Nest legt Karten uebereinander),
 * nicht die Instanz. Die lebt in `engine.cardInstances`; nur sie
 * traegt `id`, `counters` und die Zonenkoordinaten, die
 * `actionMoveCard` braucht. Deshalb hier ueber `findCards` statt
 * ueber die Zonenspiegel.
 */
function supportKarten(engine, bounty) {
  const treffer = engine.findCards({
    controller: bounty.owner,
    zone: 'support',
    heroIdx: bounty.heroIdx,
  });
  return treffer
    .filter(inst => inst?.name && inst.zoneSlot >= 0)
    .map(inst => ({ inst, slot: inst.zoneSlot }))
    .sort((a, b) => a.slot - b.slot);
}

/**
 * Kopfgeld waehlen. Gemeinsamer Weg fuer den Spielbeginn und die
 * Neuwahl nach einem toedlichen Treffer. Bei nur einem lebenden Helden
 * entfaellt die Abfrage — eine Wahl ohne Alternative ist keine.
 */
async function bountyWaehlen(engine, pi, beschreibung) {
  const ziele = zieleSammeln(engine, pi);
  if (ziele.length === 0) return false;

  if (ziele.length === 1) {
    const ok = bountyMarkieren(engine, pi, ziele[0].owner, ziele[0].heroIdx);
    if (ok) {
      engine.log('vena_bounty_marked', {
        hunter: engine.gs.players[pi]?.username,
        target: ziele[0].cardName,
        auto: true,
      });
      engine.sync();
    }
    return ok;
  }

  // Der Text sagt „choose", nicht „you may choose" — nicht abbrechbar.
  const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
    title: CARD_NAME,
    source: CARD_NAME,          // Dispatch-Schluessel fuer `cpuResponse`
    description: beschreibung,
    confirmLabel: '🎯 Mark!',
    confirmClass: 'btn-danger',
    cancellable: false,

    // ── Einfachauswahl (Als Befund 12.9.) ────────────────────────────
    // Ohne `maxTotal` faellt der Picker still auf „unbegrenzt" zurueck:
    // man kann mehrere Helden anklicken, alle bleiben markiert, und der
    // Effekt nimmt am Ende das ZUERST geklickte. Mit `maxTotal: 1`
    // greift die Client-Regel „ein Klick TAUSCHT die Auswahl aus"
    // (togglePotionTarget) — dieselbe Klasse Fehler, die schon an Scrap
    // Plow und Cheeky Monkee auffiel.
    maxTotal: 1,
    minRequired: 1,

    // ── Das MARKIEREN ist kein Effekt AUF den Helden (Als Ruling 12.9.)
    // Es aendert nichts an ihm, es notiert nur auf Venas Seite, wer das
    // Kopfgeld ist. Darum darf die Gegenseite darauf nicht reagieren:
    // ohne diese beiden Riegel oeffnete die Zielwahl das
    // Post-Target-Fenster (Castling negierte die Markierung) und das
    // Umleitungsfenster. Die DREI Einzeleffekte sind davon unberuehrt —
    // Schaden, Konfiszieren und Stun laufen ueber die normalen
    // Aktionswege und bleiben voll reaktionsfaehig.
    _skipPostTargetReactions: true,
    _skipRedirectCheck: true,
  });
  if (!gewaehlt || gewaehlt.length === 0) return false;
  const ziel = ziele.find(t => t.id === gewaehlt[0]);
  if (!ziel) return false;

  const ok = bountyMarkieren(engine, pi, ziel.owner, ziel.heroIdx);
  if (!ok) return false;
  engine._broadcastEvent('play_zone_animation', {
    type: 'anger_mark', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: -1,
  });
  engine.log('vena_bounty_marked', {
    hunter: engine.gs.players[pi]?.username,
    target: ziel.cardName,
  });
  engine.sync();
  return true;
}

// ── CPU ──────────────────────────────────────────────────────────

/** Wert eines Helden aus CPU-Sicht: was steht auf dem Spiel. */
function zielWert(engine, owner, heroIdx, hero) {
  const zonen = engine?.gs?.players?.[owner]?.supportZones?.[heroIdx] || [];
  const belegt = zonen.filter(z => z?.name).length;
  return (hero.atk || 0) + (hero.hp || 0) / 4 + belegt * 40;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  // KEIN `heroEffectActionCost` — siehe Kopfkommentar.

  /**
   * Der Knopf ist nur scharf, wenn der Effekt auch etwas tun kann:
   * Gold da, Kopfgeld lebt. Ohne Marke (das Ziel ist anderweitig
   * gefallen) hat Vena nach Kartentext KEINEN Weg zu einer neuen —
   * die Neuwahl haengt ausdruecklich an ihrem eigenen toedlichen
   * Schaden. Das ist bewusst so gebaut und keine Luecke.
   */
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if ((engine?.gs?.players?.[pi]?.gold || 0) < GOLD_COST) return false;
    return !!bountyFinden(engine, pi);
  },

  cpuShouldUseHeroEffect(engine, pi) {
    if ((engine?.gs?.players?.[pi]?.gold || 0) < GOLD_COST) return false;
    return !!bountyFinden(engine, pi);
  },

  cpuMeta: {
    // Der Effekt gibt Gold aus — die Gold-Kanaele sollen das sehen.
    activationSpendsGold: GOLD_COST,
  },

  /**
   * Zwei Abfragen gehoeren Vena: die Kopfgeldwahl (`effectTarget`) und
   * die Dreifachwahl (`generic`). Beide tragen `source: CARD_NAME`,
   * sonst liefe der Dispatch ins Leere und die CPU wuerde ihren
   * eigenen Prompt ablehnen (CARD_API, cpuResponse-Regel 2).
   */
  cpuResponse(engine, kind, payload) {
    if (kind === 'effectTarget') {
      const quelle = payload?.config?.source || payload?.config?.title;
      if (quelle !== CARD_NAME) return undefined;
      const ziele = payload?.validTargets || [];
      if (ziele.length === 0) return undefined;
      // Wertvollster gegnerischer Held — ATK, HP und wie viel in seinen
      // Support Zones haengt (dort greift die Konfiszier-Option).
      let bestes = ziele[0];
      let bestwert = -Infinity;
      for (const t of ziele) {
        const h = engine?.gs?.players?.[t.owner]?.heroes?.[t.heroIdx];
        if (!h?.name) continue;
        const w = zielWert(engine, t.owner, t.heroIdx, h);
        if (w > bestwert) { bestwert = w; bestes = t; }
      }
      return [bestes.id];
    }

    if (kind === 'generic') {
      const quelle = payload?.source || payload?.title;
      if (quelle !== CARD_NAME) return undefined;
      if (payload?.type !== 'optionPicker') return undefined;
      const erlaubt = new Set((payload.options || []).map(o => o.id));
      const pi = typeof payload._ownerIdx === 'number' ? payload._ownerIdx : engine._cpuPlayerIdx;
      const bounty = bountyFinden(engine, pi);
      // 1. Toetet der Schuss, wird geschossen.
      if (bounty && erlaubt.has('damage') && (bounty.hero.hp || 0) <= BOUNTY_DAMAGE) {
        return { optionId: 'damage' };
      }
      // 2. Haengt etwas in den Zonen, ist Konfiszieren der groessere
      //    Hebel als ein Teilschaden.
      if (bounty && erlaubt.has('discard') && supportKarten(engine, bounty).length > 0) {
        return { optionId: 'discard' };
      }
      // 3. Sonst Schaden, ersatzweise Stun.
      if (erlaubt.has('damage')) return { optionId: 'damage' };
      if (erlaubt.has('stun')) return { optionId: 'stun' };
      return undefined;
    }

    return undefined;
  },

  hooks: {
    /**
     * Spielbeginn, vor den Starthaenden — derselbe Weg wie Sid und
     * Bill. Der Hook feuert auch im Puzzle-Start (server.js spiegelt
     * ihn dort ausdruecklich), damit Vena in jedem Puzzle-Versuch ihr
     * Kopfgeld bekommt.
     */
    onBeforeHandDraw: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const gs = engine.gs;
      if (!gs?.players?.[pi]) return;
      // Schon markiert (Puzzle-Vorgabe aus dem Editor)? Nicht anfassen.
      if (bountyFinden(engine, pi)) return;

      // Auf das Ausklingen der GO-FIRST-Einblendung warten, sonst geht
      // die Abfrage unter dem Banner auf (Muster von Bill und Sid).
      engine.sync();
      if (!engine.isPuzzle) await engine._delay(3800);

      gs.heroEffectPending = { ownerIdx: pi, heroName: CARD_NAME };
      engine.sync();
      try {
        // Aus einem HOOK heraus: `showTriggeredEffect`, nicht
        // `announceActiveEffect` (★-Regel 21.8.).
        await engine.showTriggeredEffect(CARD_NAME);
        await bountyWaehlen(engine, pi,
          'Choose a Hero your opponent controls. Vena\'s effects will target that Hero.');
      } finally {
        gs.heroEffectPending = null;
        engine.sync();
      }
    },
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    if ((ps.gold || 0) < GOLD_COST) return false;

    const bounty = bountyFinden(engine, pi);
    if (!bounty) return false;

    // Nur anbieten, was gerade wirklich geht — eine Option, die nichts
    // tut, hat im Picker nichts verloren.
    const zonenKarten = supportKarten(engine, bounty);
    const optionen = [
      {
        id: 'damage',
        label: `🔫 Collect the Bounty (${BOUNTY_DAMAGE})`,
        description: `Deal ${BOUNTY_DAMAGE} damage to ${bounty.hero.name}. If this defeats it, mark a new Hero.`,
      },
    ];
    if (zonenKarten.length > 0) {
      optionen.push({
        id: 'discard',
        label: '🗑 Confiscate',
        description: `Send a card in ${bounty.hero.name}'s Support Zones to the discard pile.`,
      });
    }
    if (!bounty.hero.statuses?.stunned) {
      optionen.push({
        id: 'stun',
        label: '💫 Restrain',
        description: `Stun ${bounty.hero.name} for 1 turn.`,
      });
    }

    const wahl = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: CARD_NAME,
      source: CARD_NAME,
      description: `Spend ${GOLD_COST} Gold to use one of Vena's effects on ${bounty.hero.name}:`,
      options: optionen,
      cancellable: true,
      _ownerIdx: pi,
    });
    // Abbruch: `false`, damit weder Gold noch das Einmal-pro-Zug faellt.
    if (!wahl || wahl.cancelled || !wahl.optionId) return false;
    const modus = wahl.optionId;

    // Zwischen Anzeige und Antwort kann sich alles geaendert haben.
    const nochDa = bountyFinden(engine, pi);
    if (!nochDa || nochDa.heroIdx !== bounty.heroIdx) return false;
    if ((ps.gold || 0) < GOLD_COST) return false;

    // Ueber `actionSpendGold`, nicht ueber `gold -=`: nur so feuern die
    // Ausgabe-Hooks (Debt-O-Tron, Wealth) und das Log.
    await engine.actionSpendGold(pi, GOLD_COST);
    engine._broadcastEvent('play_zone_animation', {
      type: 'gold_sparkle', owner: pi, heroIdx: ctx.cardHeroIdx, zoneSlot: -1,
    });

    const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: ctx.cardHeroIdx };

    if (modus === 'damage') {
      engine._broadcastEvent('play_zone_animation', {
        type: 'gunshot_barrage', owner: nochDa.owner, heroIdx: nochDa.heroIdx, zoneSlot: -1,
      });
      await engine._delay(320);
      await engine.actionDealDamage(quelle, nochDa.hero, BOUNTY_DAMAGE, 'hero');
      engine.log('vena_bounty_damage', {
        hunter: ps.username, target: nochDa.hero.name, amount: BOUNTY_DAMAGE,
      });
      // „If this damage defeats the target, choose a new Hero" — nur
      // hier, nicht bei Konfiszieren oder Stun.
      if ((nochDa.hero.hp || 0) <= 0) {
        delete nochDa.hero._bountyBy;
        await bountyWaehlen(engine, pi,
          'The bounty has been collected. Choose a new Hero for Vena\'s effects.');
      }
      engine.sync();
      return true;
    }

    if (modus === 'discard') {
      const karten = supportKarten(engine, nochDa);
      if (karten.length === 0) return true;   // Gold ist bezahlt, der Griff ging ins Leere
      let gewaehlt = karten[0];
      if (karten.length > 1) {
        const ziele = karten.map(k => ({
          id: `equip-${nochDa.owner}-${nochDa.heroIdx}-${k.slot}`,
          type: 'equip', owner: nochDa.owner, heroIdx: nochDa.heroIdx,
          slotIdx: k.slot, cardName: k.inst.name, cardInstance: k.inst,
        }));
        const pick = await engine.promptEffectTarget(pi, ziele, {
          title: CARD_NAME,
          source: CARD_NAME,
          description: `Choose a card in ${nochDa.hero.name}'s Support Zones to send to the discard pile.`,
          confirmLabel: '🗑 Confiscate!',
          confirmClass: 'btn-danger',
          cancellable: false,
          // Gleiche Einfachauswahl wie bei der Kopfgeldwahl. Hier aber
          // OHNE Reaktionsriegel: eine Karte auf die Ablage zu schicken
          // IST ein Effekt gegen die Gegenseite und bleibt reaktionsfaehig.
          maxTotal: 1,
          minRequired: 1,
        });
        const treffer = pick && pick.length ? ziele.find(t => t.id === pick[0]) : null;
        if (treffer) gewaehlt = karten.find(k => k.slot === treffer.slotIdx) || gewaehlt;
      }
      await engine.actionMoveCard(gewaehlt.inst, 'discard', -1, -1, {
        source: CARD_NAME, sourceOwner: pi,
      });
      engine.log('vena_bounty_confiscate', {
        hunter: ps.username, target: nochDa.hero.name, card: gewaehlt.inst.name,
      });
      engine.sync();
      return true;
    }

    if (modus === 'stun') {
      await engine.addHeroStatus(nochDa.owner, nochDa.heroIdx, 'stunned', {
        duration: 1, appliedBy: pi, source: CARD_NAME,
      });
      engine.log('vena_bounty_stun', { hunter: ps.username, target: nochDa.hero.name });
      engine.sync();
      return true;
    }

    return false;
  },
};
