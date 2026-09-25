// ═══════════════════════════════════════════
//  CARD EFFECT: „Skullmael's Greatsword"
//  Artifact / EQUIPMENT (Kosten 10, PP MSAZ)
//
//  „Once per turn, when the equipped Hero defeats a target with an
//   Attack, you may immediately summon a Creature from your discard
//   pile with it as an additional Action."
//
//  BAUART
//  ──────
//  • ★ „SUMMON", NICHT „PLACE" (Als Vorgabe 12.9.). Das Level wird
//    NICHT ignoriert, und der ausgeruestete Held muss die Kreatur auch
//    wirklich beschwoeren KOENNEN. Geprueft wird deshalb genau das,
//    was der normale Beschwoerungsweg prueft:
//      – `heroMeetsLevelReq(..., { pileSide: 'discard',
//        noPlacementBypass: true })` — echtes Schul-Level. Das
//        `noPlacementBypass` ist Pflicht: es haelt den
//        Deepsea-Platzierungs-Bypass heraus, der hier nichts zu suchen
//        hat (Als Ruling im Necromancy-Fall).
//      – `isCreatureSummonable` — die kartenseitigen `canSummon`-Tore
//        (Einmal-je-Zug-Grenzen, Einzigartigkeit, Tribute). OHNE
//        `_bypassBeforeSummon`, denn `summonFromPile` laeuft ueber
//        `summonCreatureWithHooks` und fuehrt `beforeSummon` wirklich
//        aus — Kosten werden also bezahlt.
//      – freie Support Zone AM AUSGERUESTETEN HELDEN, `summonLocked`,
//        und der Held muss handlungsfaehig sein (lebt, nicht Frozen /
//        Stunned / Webbed / Negated).
//    Strikt `cardType === 'Creature'`: Artifact-Creatures zaehlen bei
//    Beschwoerungen aus der Ablage nicht (Design-Regel, siehe
//    Necromancy und Geschwister).
//
//  • Die Beschwoerung selbst laeuft ueber `summonFromPile(pi,
//    'discard', …)` — die Stapel-Schicht nimmt die Karte regelkonform
//    aus der Ablage, sendet den Flug und faehrt den vollen
//    Lebenszyklus (`beforeSummon`, `onPlay`, `onCardEnterZone`).
//
//  • „as an additional Action": die Beschwoerung laeuft ueber den HOOK,
//    nicht ueber den Aktionsweg — sie verbraucht die Zug-Aktion also
//    ohnehin nicht. Kein `inherentAction`-Flag noetig (das gilt dem
//    regulaeren Ausspielen aus der Hand).
//
//  • „Once per turn" ohne Zusatz = WEICH, je Instanz (v249). Umgesetzt
//    wie bei Sacrificial Dagger: HOPT-Schluessel mit der Karten-ID,
//    und beansprucht wird er ERST beim Zugriff — ein abgelehntes
//    „you may" bleibt fuer einen spaeteren Treffer im selben Zug
//    nutzbar. Zwei Schwerter am selben Helden haben eigene Schluessel.
//
//  • ANIMATION `undead_revival` (v954): Runenkreis, nekrotische
//    Flammen, aufsteigende Knochen, dunkler Blitz. Eigener Typ, damit
//    sie ihren eigenen Klang tragen kann.
//
//  • ★ DIE FRISCH GEFALLENE KOPIE STEHT NICHT ZUR WAHL (Als Ruling
//    12.9.): stirbt eine EIGENE Kreatur an genau diesem Angriff, sind
//    ihr Tod und der Trigger des Schwerts gleichzeitig — auch wenn das
//    Schwert erst danach aufloest. Die Strichliste haengt an der
//    Quelleninstanz des Angriffs und zaehlt JE NAME; liegt noch eine
//    aeltere Kopie desselben Namens in der Ablage, bleibt die waehlbar
//    (die Ablage fuehrt nur Namen).
//
//  • Ein Angriff, der HELD und Kreaturen zugleich umlegt, fragt nur
//    EINMAL: die Marke `_skullmaelOffered_<id>` haengt an der
//    Quelleninstanz des Angriffs — dieselbe Identitaet, die die Engine
//    fuer ihre eigene Angriffs-Entprellung benutzt.
// ═══════════════════════════════════════════

const CARD_NAME = "Skullmael's Greatsword";

/** Kam dieser Schaden vom ausgeruesteten Helden, per Attack? */
function vomWirt(ctx, quelle, typ) {
  if (typ !== 'attack' || !quelle) return false;
  if (quelle.zone === 'support') return false;            // Kreatur im selben Slot ist nicht der Held
  if ((quelle.heroIdx ?? -1) !== ctx.cardHeroIdx) return false;
  const seite = quelle.heroOwner ?? quelle.owner ?? quelle.controller;
  return seite === (ctx.cardController ?? ctx.cardOwner);
}

/** Freie Support Zones des ausgeruesteten Helden. */
function freieZonen(engine, pi, heroIdx) {
  const zonen = engine.gs.players[pi]?.supportZones?.[heroIdx] || [];
  const out = [];
  for (let z = 0; z < 3; z++) if ((zonen[z] || []).length === 0) out.push({ heroIdx, slotIdx: z });
  return out;
}

/** Ist der Held ueberhaupt handlungsfaehig? */
function heldKannBeschwoeren(engine, pi, heroIdx) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  const s = hero.statuses || {};
  if (s.frozen || s.stunned || s.webbed || s.negated) return false;
  return true;
}

/**
 * Kreaturen der eigenen Ablage, die DIESER Held jetzt beschwoeren
 * koennte.
 *
 * ★ OHNE DIE, DIE AN DIESEM ANGRIFF GEFALLEN SIND (Als Ruling 12.9.):
 * ihr Sterben und der Trigger des Schwerts sind gleichzeitig, auch
 * wenn der Trigger erst spaeter aufloest — die frisch gefallene Kopie
 * steht nicht zur Wahl. Gerechnet wird ueber die ANZAHL, nicht ueber
 * den Namen: liegt noch eine AELTERE Kopie desselben Namens in der
 * Ablage, bleibt sie waehlbar (die Ablage fuehrt nur Namen, keine
 * Instanzen).
 */
function beschwoerbareAusAblage(engine, pi, heroIdx, frisch) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const gesehen = new Set();
  const out = [];
  // Wie oft liegt jeder Name in der Ablage?
  const inAblage = new Map();
  for (const name of (ps.discardPile || [])) inAblage.set(name, (inAblage.get(name) || 0) + 1);

  for (const name of (ps.discardPile || [])) {
    if (!engine.darfAusAblageAufsFeld(name)) continue;   // v1389: Gigantisaur, Ifrit
    if (gesehen.has(name)) continue;
    const cd = cardDB[name];
    if (!cd || cd.cardType !== 'Creature') continue;      // strikt: keine Artifact-Creatures
    // Alle vorhandenen Kopien sind gerade erst an diesem Angriff gefallen?
    const eben = frisch?.get(name) || 0;
    if (eben > 0 && (inAblage.get(name) || 0) <= eben) { gesehen.add(name); continue; }
    if (!engine.heroMeetsLevelReq(pi, heroIdx, cd, { pileSide: 'discard', noPlacementBypass: true })) continue;
    if (!engine.isCreatureSummonable(name, pi, heroIdx)) continue;
    gesehen.add(name);
    out.push({ name, source: 'discard', level: cd.level || 0 });
  }
  return out;
}

/** Gemeinsamer Weg beider Tod-Fenster. */
async function bieteBeschwoerungAn(ctx, quelle) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const ich = ctx.card;
  const pi = ctx.cardController ?? ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;

  // Ein Angriff = ein Angebot, auch wenn er mehrere Ziele umlegt.
  const marke = `_skullmaelOffered_${ich.id}`;
  if (quelle[marke]) return;
  quelle[marke] = true;

  const ps = gs.players[pi];
  if (!ps || ps.summonLocked) return;
  if (!heldKannBeschwoeren(engine, pi, heroIdx)) return;

  // Weiches Once per turn — erst NACHSEHEN, beansprucht wird beim Zugriff.
  const hoptKey = `skullmael-greatsword:${ich.id}`;
  if (gs.hoptUsed?.[`${hoptKey}:${pi}`] === gs.turn) return;

  if (freieZonen(engine, pi, heroIdx).length === 0) return;
  const frisch = quelle._skullmaelFresh;
  const kandidaten = beschwoerbareAusAblage(engine, pi, heroIdx, frisch);
  if (kandidaten.length === 0) return;

  // ★ ZURUECK STATT ABBRUCH (Als Vorgabe 12.9.): „Back" in der
  // Zonenwahl fuehrt zur Kreaturwahl zurueck, nicht aus dem Effekt
  // heraus — man kann es sich ja anders ueberlegt haben. Nur ein
  // Abbruch IN DER GALERIE beendet das Angebot.
  let gewaehlt = null;
  let ziel = null;
  while (!ziel) {
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: kandidaten.map(k => ({ name: k.name, source: 'discard', level: k.level })),
      title: CARD_NAME,
      description: `${gs.players[pi]?.heroes?.[heroIdx]?.name} may summon a Creature from your discard pile as an additional Action.`,
      confirmLabel: '💀 Summon!',
      confirmClass: 'btn-info',
      cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName) return;   // „you may" — abgelehnt, HOPT bleibt frei
    if (!kandidaten.some(k => k.name === wahl.cardName)) return;
    gewaehlt = wahl.cardName;

    // Zwischen Galerie und Zonenwahl kann sich das Brett aendern.
    const zonen = freieZonen(engine, pi, heroIdx);
    if (zonen.length === 0) return;
    if (zonen.length === 1) { ziel = zonen[0]; break; }

    const zw = await engine.promptGeneric(pi, {
      type: 'zonePick',
      title: CARD_NAME,
      description: `Summon ${gewaehlt} into which Support Zone? (Back returns to the Creature choice.)`,
      zones: zonen,
      cancellable: true,
      cancelLabel: '↩ BACK',
    });
    if (!zw || zw.cancelled) continue;                       // zurueck zur Galerie
    ziel = zonen.find(z => z.slotIdx === zw.slotIdx) || zonen[0];
  }
  const wahl = { cardName: gewaehlt };

  // ── Ab hier ist es verbindlich: Anspruch und Auftritt ─────────────
  if (!engine.claimHOPT(hoptKey, pi)) return;
  await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

  // Animation (v954, Als Vorgabe): schwarze Magie und Nekromantie auf
  // der Zielzone — Runenkreis, nekrotische Flammen, aufsteigende
  // Knochen, dann der dunkle Blitz, mit dem die Kreatur steht. Eigener
  // Typ `undead_revival` (nicht `necromancy_summon` der Ability: der
  // Klang haengt am Typ). Der Vorlauf laesst das Ritual laufen, bevor
  // die Karte aus der Ablage einfliegt.
  engine._broadcastEvent('play_zone_animation', {
    type: 'undead_revival', owner: pi,
    heroIdx: ziel.heroIdx, zoneSlot: ziel.slotIdx,
    duration: 1400,
  });
  await engine._delay(760);

  const inst = await engine.summonFromPile(pi, 'discard', wahl.cardName, ziel.heroIdx, ziel.slotIdx, {
    source: CARD_NAME,
  });
  if (!inst) return;

  engine.log('skullmael_greatsword_summon', {
    player: ps.username, creature: wahl.cardName,
    hero: gs.players[pi]?.heroes?.[heroIdx]?.name,
  });
  engine.sync();
}

module.exports = {
  isEquip: true,
  activeIn: ['support'],

  // Abbrechbare Prompts bricht die Engine fuer die CPU grundsaetzlich
  // ab, wenn das Skript nicht antwortet (Befund v828). Gewaehlt wird die
  // Kreatur mit dem hoechsten Level — aus der Ablage zurueckzuholen
  // lohnt sich dort am meisten.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'cardGallery') {
      const karten = promptData.cards || [];
      if (karten.length === 0) return undefined;
      let beste = karten[0];
      for (const k of karten) if ((k.level || 0) > (beste.level || 0)) beste = k;
      return { cardName: beste.name, source: 'discard' };
    }
    if (promptData.type === 'zonePick') {
      const z = (promptData.zones || [])[0];
      return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx } : undefined;
    }
    return undefined;
  },

  hooks: {
    // ── Der Wirt besiegt einen HELDEN mit einem Angriff ──────────────
    afterDamage: async (ctx) => {
      if (!ctx.card) return;
      if (!vomWirt(ctx, ctx.source, ctx.type)) return;
      const ziel = ctx.target;
      if (!ziel || ziel.hp === undefined || !ziel.statuses) return;   // Kreaturen im Batch-Hook
      if (ziel.hp > 0) return;
      await bieteBeschwoerungAn(ctx, ctx.source);
    },

    // ── Der Wirt besiegt eine CREATURE mit einem Angriff ─────────────
    afterCreatureDamageBatch: async (ctx) => {
      if (!ctx.card || !ctx.entries) return;
      const pi = ctx.cardController ?? ctx.cardOwner;
      let quelle = null;
      for (const e of ctx.entries) {
        if (!vomWirt(ctx, e.source, e.type)) continue;
        const inst = e.inst;
        if (!inst || (inst.counters?.currentHp ?? 1) > 0) continue;
        quelle = quelle || e.source;
        // ★ Strichliste der an DIESEM Angriff gefallenen EIGENEN
        // Kreaturen — sie landen gleich in meiner Ablage, stehen aber
        // nicht zur Wahl (Als Ruling 12.9.). Gezaehlt wird je Name,
        // damit eine aeltere Kopie desselben Namens waehlbar bleibt.
        const besitzer = inst.originalOwner ?? inst.owner;
        if (besitzer !== pi) continue;
        if (!e.source._skullmaelFresh) e.source._skullmaelFresh = new Map();
        const m = e.source._skullmaelFresh;
        m.set(inst.name, (m.get(inst.name) || 0) + 1);
      }
      if (quelle) await bieteBeschwoerungAn(ctx, quelle);
    },
  },
};
