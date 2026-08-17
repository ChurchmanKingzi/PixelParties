// ═══════════════════════════════════════════════════════════════════
//  GETEILT: die „Crusader's"-Artefakte
//
//  Vier Equipment-Artefakte (Arm-Cannon, Cutlass, Flintlock, Hookshot)
//  mit IDENTISCHEM Skelett und je einer eigenen Klausel. Der gemeinsame
//  Text lautet bei allen vieren:
//
//    „You can only equip this card to \"Cecilia, the Harrowing
//     Crusader\".
//     A Hero can only be equipped with 1 \"Crusader's\" Artifact.
//     You may once per turn deal 80 damage to a target. That is
//     treated as an Attack.
//     [… eigene Klausel …]
//     At the end of your turn, send this equipped Artifact to your
//     discard pile and equip the equipped Hero with a different
//     \"Crusader's\" Artifact from your deck or hand without paying
//     its Cost."
//
//  Eine Auslegung, EINE Stelle: jede Karte ist zwei Zeilen und reicht
//  nur ihre Klausel herein (Bauart wie `makeIdejBlade` in
//  `_idej-shared.js`).
//
//  ── NAMENSBEZUG ──────────────────────────────────────────────────
//  „a \"Crusader's\" Artifact" ist nach der Projektkonvention ein
//  TEILSTRING-Treffer im GANZEN Kartennamen, Gross-/Kleinschreibung
//  zaehlt. `Cecilia, the Harrowing Crusader` enthaelt „Crusader", aber
//  NICHT „Crusader's" — sie faellt also korrekt nicht in die Familie.
//
//  ── DER AKTIVE EFFEKT LAEUFT UEBER `equipEffect`, NICHT `heroEffect` ─
//  Ein Equipment-ARTEFAKT mit aktivem Effekt benutzt die eigene
//  Schnittstelle `equipEffect` / `canActivateEquipEffect` /
//  `onEquipEffect`. Vorbild und Beleg: „Charm of Balance". Gesammelt
//  wird sie von `getActivatableEquips` (Oberflaeche) und
//  `doActivateEquipEffect` (Server); das Einmal-pro-Zug haengt an der
//  INSTANZ (`equip-effect:<instId>`), und ein Rueckgabewert `false`
//  gibt die Sperre wieder frei.
//
//  `heroEffect` ist die Schnittstelle fuer HELDENKARTEN in einer
//  Support Zone (Initiation Ritual) — ein Artefakt wird darueber nie
//  angeboten. In v447 und v449 hatte ich genau das versucht, erst mit
//  einer Instanz-Marke, dann mit einem geweiteten Engine-Praedikat.
//  Beides ging am Mechanismus vorbei; der Effekt blieb tot (Als Befund
//  17.8., zweimal gemeldet).
// ═══════════════════════════════════════════════════════════════════

'use strict';

const CRUSADER_HERO = 'Cecilia, the Harrowing Crusader';
const CRUSADER_MARKER = "Crusader's";
const ATTACK_DAMAGE = 80;

// Takt zwischen mehreren gleichartigen Abwuerfen. Gleiche Groessenordnung
// wie `DISCARD_PACE_MS` (500) im Kosmetiksystem: ohne Pause laufen alle
// Karten in EINEM Tick aus ihren Zonen, der Client bekommt einen einzigen
// Zustandsversand und alles verschwindet auf einmal — die Fluege spielen
// dann ins Leere (Als Befund 17.8.).
const TAKT_MS = 420;
// Abilities bekommen laut Al etwas mehr Luft dazwischen — aber nur etwas:
// 620 ms war im Playtest zu lang (Als Rueckmeldung 17.8.), 500 sitzt
// hoerbar ueber dem Normaltakt, ohne den Zug auszubremsen.
const ABILITY_TAKT_MS = 500;

/**
 * Einen Abwurf sichtbar machen und den naechsten abwarten: Zustand
 * raus, DANN pausieren. Die Reihenfolge ist der Punkt — der Versand
 * zeigt die Karte auf dem Weg zum Stapel, die Pause laesst ihn ankommen.
 */
async function takten(engine, ms) {
  engine.sync();
  await engine._delay(ms);
}

/** Gehoert dieser Kartenname zur „Crusader's"-Familie? */
function istCrusaderArtefakt(cardName) {
  return typeof cardName === 'string' && cardName.includes(CRUSADER_MARKER);
}

/** Traegt dieser Held schon ein „Crusader's"-Artefakt? */
function crusaderArtefaktAufHeld(engine, playerIdx, heroIdx, ausserInst) {
  for (const inst of (engine?.cardInstances || [])) {
    if (inst === ausserInst) continue;
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== playerIdx) continue;
    if (inst.heroIdx !== heroIdx) continue;
    if (istCrusaderArtefakt(inst.name)) return true;
  }
  return false;
}

/** Erste freie Basis-Support-Zone (0-2) des Helden, sonst -1. */
function freierPlatz(ps, heroIdx) {
  const zonen = ps?.supportZones?.[heroIdx] || [];
  for (let z = 0; z < 3; z++) if ((zonen[z] || []).length === 0) return z;
  return -1;
}

/**
 * Gemeinsame Ausruest-Regel beider Saetze des Kartentexts.
 * Signatur wie ueberall im Projekt: `(gs, pi, heroIdx, engine)`.
 */
function darfAufHeld(gs, pi, heroIdx, engine, selbstName) {
  const hero = gs?.players?.[pi]?.heroes?.[heroIdx];
  if (!hero?.name) return false;
  // Satz 1: nur an Cecilia.
  if (hero.name !== CRUSADER_HERO) return false;
  // Satz 2: hoechstens EIN „Crusader's"-Artefakt je Held.
  if (engine && crusaderArtefaktAufHeld(engine, pi, heroIdx)) return false;
  return true;
}

/**
 * Eine Support-Zonen-Karte sauber in den Ablagestapel schicken.
 * Bauform uebernommen von `discardAttachedIdejCard` in
 * `_idej-shared.js` — inklusive `onCardLeaveZone`: mein erster Wurf
 * hatte den Hook vergessen, damit haetten Karten, die auf das
 * Verlassen der Zone hoeren, stillschweigend nicht ausgeloest.
 * Routet ueber `originalOwner`, damit eine uebernommene Karte in den
 * richtigen Stapel faellt.
 */
async function artefaktInDieAblage(engine, inst) {
  if (!inst || inst.zone !== 'support') return false;
  const gs = engine.gs;
  const ownerPs = gs.players[inst.owner];
  const heroIdx = inst.heroIdx;
  const slot = inst.zoneSlot;
  const name = inst.name;

  const zone = ((ownerPs?.supportZones || [])[heroIdx] || [])[slot] || [];
  const zi = zone.indexOf(name);
  if (zi >= 0) zone.splice(zi, 1);

  engine._broadcastEvent('play_pile_transfer', {
    owner: inst.owner, cardName: name,
    from: 'support', to: 'discard',
    fromHeroIdx: heroIdx, fromSlotIdx: slot,
  });
  await engine.runHooks('onCardLeaveZone', {
    _onlyCard: inst, card: inst, leavingCard: inst,
    fromZone: 'support', fromHeroIdx: heroIdx, fromZoneSlot: slot,
    fromOwner: inst.owner, toZone: 'discard',
  });
  engine.cardInstances = engine.cardInstances.filter(c => c.id !== inst.id);
  const ziel = gs.players[inst.originalOwner ?? inst.owner];
  if (ziel) {
    if (!ziel.discardPile) ziel.discardPile = [];
    ziel.discardPile.push(name);
  }
  return true;
}

/**
 * Der Zug-Ende-Kreislauf, wortgetreu: erst dieses Artefakt in den
 * Ablagestapel, dann ein ANDERES „Crusader's"-Artefakt aus Deck ODER
 * Hand kostenlos an denselben Helden.
 *
 * Reihenfolge ist wichtig und steht so im Text: das alte geht ZUERST
 * weg. Sonst waere der Platz belegt und die „nur 1 Crusader's je
 * Held"-Regel wuerde den Nachfolger blockieren.
 */
async function zugEndeKreislauf(ctx, selbstName) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support') return;
  const pi = inst.controller ?? inst.owner;
  const ps = gs.players[pi];
  if (!ps) return;
  const heroIdx = inst.heroIdx;

  // „At the end of YOUR turn" — nur im eigenen Zug.
  if (gs.activePlayer !== pi) return;

  // ── 1) Dieses Artefakt in den Ablagestapel ────────────────────────
  await artefaktInDieAblage(engine, inst);
  engine.sync();

  // ── 2) Nachfolger suchen: ein ANDERES Crusader's aus Deck oder Hand ─
  // Ein toter Held bekommt nichts (Als Ruling 11.8.) — und wenn der
  // Platz fehlt, bleibt es beim Abwurf.
  const hero = ps.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return;

  const ausDeck = [...new Set((ps.mainDeck || []).filter(
    n => istCrusaderArtefakt(n) && n !== selbstName))];
  const ausHand = [...new Set((ps.hand || []).filter(
    n => istCrusaderArtefakt(n) && n !== selbstName))];
  if (ausDeck.length === 0 && ausHand.length === 0) return;

  const galerie = [
    ...ausDeck.map(n => ({ name: n, source: 'deck' })),
    ...ausHand.map(n => ({ name: n, source: 'hand' })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  // Ein einziger Kandidat: kein Auswahlfenster, direkt anlegen.
  let gewaehlt = galerie.length === 1 ? galerie[0] : null;
  if (!gewaehlt) {
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galerie,
      title: selbstName,
      description: "Equip a different \"Crusader's\" Artifact to this Hero without paying its Cost.",
      cancellable: false,
    });
    if (!wahl?.cardName) return;
    gewaehlt = galerie.find(g => g.name === wahl.cardName) || null;
  }
  if (!gewaehlt) return;

  const platz = freierPlatz(ps, heroIdx);
  if (platz < 0) return;

  // Aus der Quellzone nehmen — und nur dann weitermachen, wenn das
  // wirklich geklappt hat (der Zustand kann sich waehrend der Abfrage
  // verschoben haben).
  if (gewaehlt.source === 'deck') {
    const di = (ps.mainDeck || []).indexOf(gewaehlt.name);
    if (di < 0) return;
    ps.mainDeck.splice(di, 1);
    engine.shuffleDeck(pi);
  } else {
    const hi = (ps.hand || []).indexOf(gewaehlt.name);
    if (hi < 0) return;
    ps.hand.splice(hi, 1);
  }

  engine._broadcastEvent('card_reveal', { cardName: gewaehlt.name });
  await engine._delay(250);

  const neu = engine.safePlaceInSupport(gewaehlt.name, pi, heroIdx, platz);
  if (!neu?.inst) {
    ps.discardPile.push(gewaehlt.name);
    return;
  }
  await engine.runHooks('onPlay', {
    _onlyCard: neu.inst, playedCard: neu.inst, cardName: gewaehlt.name,
    zone: 'support', heroIdx, zoneSlot: neu.actualSlot,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: neu.inst, toZone: 'support', toHeroIdx: heroIdx,
  });

  engine.log('crusader_cycle', {
    player: ps.username, discarded: selbstName,
    equipped: gewaehlt.name, from: gewaehlt.source, hero: hero.name,
  });
  engine.sync();
}

/**
 * Baut ein „Crusader's"-Artefakt.
 *
 * @param {object} spec
 * @param {string}   spec.cardName    exakter Kartenname
 * @param {string}   spec.attackLabel Beschriftung des Bestaetigungsknopfs
 * @param {string}   spec.riderText   was die eigene Klausel dem Spieler ansagt
 * @param {function} [spec.attackAnim] async (ctx, info) — die eigene
 *        Angriffs-Animation. Laeuft NACH der Zielwahl und VOR dem
 *        Schaden und darf awaiten: wer bis zum Einschlag wartet, laesst
 *        den Schaden genau dort passieren (Flintlock, Arm-Cannon).
 * @param {function} spec.rider       async (ctx, info) — die eigene Klausel.
 *        `info`: { engine, pi, heroIdx, target, hero, hpVorher, hatSchaden,
 *                  besiegt, oppIdx }
 */
function makeCrusaderArtifact(spec) {
  const { cardName, attackLabel, riderText, rider, attackAnim } = spec;

  return {
    activeIn: ['support'],

    canEquipToHero(gs, pi, heroIdx, engine) {
      return darfAufHeld(gs, pi, heroIdx, engine, cardName);
    },

    equipEffect: true,

    canActivateEquipEffect(ctx) {
      const inst = ctx.card;
      return !!inst && inst.zone === 'support';
    },

    // Die Engine wertet den Rueckgabewert aus: `false` heisst
    // „abgebrochen" und gibt das reservierte Einmal-pro-Zug wieder frei
    // (server.js `doActivateEquipEffect`, `releaseHopt`).
    async onEquipEffect(ctx) {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return false;
      const pi = inst.controller ?? inst.owner;
      const heroIdx = inst.heroIdx;
      const oppIdx = pi === 0 ? 1 : 0;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: ATTACK_DAMAGE,
        title: cardName,
        description: `Deal ${ATTACK_DAMAGE} damage to a target. That is treated as an Attack. ${riderText}`,
        confirmLabel: attackLabel,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return false;   // Abbruch — Zug bleibt unverbraucht

      // Zustand VOR dem Schaden festhalten, damit die eigene Klausel
      // „hat Schaden genommen" und „wurde besiegt" unterscheiden kann.
      const hero = target.type === 'hero'
        ? gs.players[target.owner]?.heroes?.[target.heroIdx] : null;
      const hpVorher = hero ? hero.hp : null;

      // Zielanker, die jede Animation braucht. `impactSlot: -1` ist die
      // Heldenzone, alles >= 0 eine Support-Zone.
      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;

      if (attackAnim) {
        await attackAnim(ctx, {
          engine, pi, heroIdx, target,
          tgtOwner, tgtHeroIdx, impactSlot, tgtZoneSlot,
        });
      }

      if (target.type === 'hero') {
        if (hero && hero.hp > 0) {
          await ctx.dealDamage(hero, ATTACK_DAMAGE, 'attack');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: cardName, owner: pi, heroIdx },
          target.cardInstance, ATTACK_DAMAGE, 'attack',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      const hatSchaden = hero ? (hero.hp < hpVorher) : false;
      const besiegt = hero ? (hpVorher > 0 && hero.hp <= 0) : false;

      await rider(ctx, {
        engine, pi, heroIdx, oppIdx, target, hero,
        hpVorher, hatSchaden, besiegt,
      });

      engine.log('crusader_attack', {
        player: gs.players[pi]?.username, card: cardName,
        target: target.cardName, damage: ATTACK_DAMAGE,
      });
      engine.sync();
      return true;
    },

    // CPU: der Angriff ist reiner Gewinn (kostet nichts, keine Aktion).
    cpuMeta: { dealsDamage: true },

    hooks: {
      onTurnEnd: async (ctx) => { await zugEndeKreislauf(ctx, cardName); },
    },
  };
}

module.exports = {
  ATTACK_DAMAGE_ALIAS: ATTACK_DAMAGE,
  TAKT_MS,
  ABILITY_TAKT_MS,
  takten,
  artefaktInDieAblage,
  CRUSADER_HERO,
  CRUSADER_MARKER,
  ATTACK_DAMAGE,
  istCrusaderArtefakt,
  crusaderArtefaktAufHeld,
  darfAufHeld,
  makeCrusaderArtifact,
};
