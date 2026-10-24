'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Exorcism"
//  Spell (Decay Magic + Support Magic Lv1, Normal)
//
//  „Choose a target and remove any number of Spells attached to it and send them to the discard pile. If the user has at least Decay Magic 2, this Spell's effect cannot be prevented or
//   negated and counts as an additional Action. If the user has at least Support Magic 1, you may also remove any number of negative status effects from the target."
//
//  ── ZIELE (hängen vom Support-Level des Wirkers ab) ─────────────────────
//  • OHNE Support Magic 1: NUR Helden (beide Seiten) mit mindestens einem Anhängsel — einem angehängten Spell (Subtyp Attachment), der sich wegschicken lässt (nicht `immovable`, kein Cardinal).
//  • MIT Support Magic 1 (`effectiveSchoolLevelForCaster`, „as if"-Effekte zählen): zusätzlich JEDES Ziel mit mindestens einem entfernbaren negativen Statuseffekt — Helden UND Kreaturen
//    (Kreaturen tragen nie Anhängsel, sie sind nur wegen ihrer Status wählbar).
//  Alles andere steht AUSGEGRAUT in der Liste (`ausgegrauteRestkarten`). Die Wahl ist abbrechbar (dann bleibt die Karte auf der Hand). Ohne wählbares Ziel ist die Karte grau
//  (`spellPlayCondition` / je Held `canPlayWithHero`).
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  1. Zielwahl (`promptEffectTarget`; Zielschutz und die Fenster der Zielwahl macht der Zielwähler).
//  2. Anhängsel: hat der Held welche, wählt man BELIEBIG VIELE davon (auch keins — „any number"), abbrechbar. Sie gehen in die Ablage ihres BESITZERS (`sendBoardCardToDiscard`: Leave-Hooks;
//     ein statusgebundenes Anhängsel — Berserk, Polymorph … — nimmt seinen Status mit).
//  3. Status (nur mit Support Magic 1): was nach Schritt 2 noch am Ziel klebt, kommt in die Statuswahl (wie Beer: beliebig viele, auch keiner — „you MAY also"). Wurde bisher NICHTS
//     beschlossen (das Ziel war nur wegen seiner Status wählbar), bricht ein Abbruch der Statuswahl den ganzen Zauber ab (Karte zurück auf die Hand); sonst heißt Abbruch „keiner".
//     Entfernt wird über den heilenden Pfad der Engine (`cleanseHeroStatuses` / `cleanseCreatureStatuses`): Sperren wie „status effects cannot be removed" gelten weiter,
//     ein geheilter Anhängsel-Status wirft sein Anhängsel ab (Berserk, Orders, Decisive Defeat …).
//
//  ── DECAY MAGIC 2: UNVERHINDERBAR, UNNEGIERBAR, ZUSATZAKTION ────────────
//  • Unnegierbar: die Zielwahl trägt `cannotBeNegated` — negierende Surprises und Brett-Wächter schweigen (Midnight-Assault-Muster).
//  • Unverhinderbar: Resistance („the first effect that would affect this Hero …") und Zauber-Immunität („unaffected by all Spells") greifen nicht; die Prüfung entfällt. Nicht davon erfasst
//    sind Sperren, die das WÄHLEN verhindern (Zielschutz) und unentfernbare Status.
//  • Zusatzaktion: `inherentAction` als Funktion je Held (`effectiveSchoolLevelForCaster('Decay Magic') >= 2`). Das Support-Level hat damit nichts zu tun; die Karte bleibt auch ohne Decay 2
//    spielbar und kostet dann die Aktion.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `exorcism_light` (Pixelart, ANIM_REGISTRY): eine Lichtsäule fällt auf das Ziel, dunkle Schwaden steigen auf und lösen sich auf. Klänge in ZONE_ANIM_SFX; Log `exorcism`.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');
const { ausgegrauteRestkarten } = require('./_target-dim-shared');

const CARD_NAME = 'Exorcism';
const DECAY = 'Decay Magic';
const SUPPORT = 'Support Magic';
const LICHT_MS = 1200;        // Länge der Animation (deckt sich mit `exorcism_light` im Client)
const LICHT_VOR_MS = 560;     // bis die Säule steht und die Schwaden sich lösen (+100 ms Einbau-Versatz des Clients)
const NACH_MS = 360;

function stufe(engine, schule, pi, heroIdx, seite) {
  return engine.effectiveSchoolLevelForCaster(schule, pi, heroIdx, seite);
}
function seiteDesWirkers(engine, pi, heroIdx) {
  return engine.heldSeiteFuer ? engine.heldSeiteFuer(pi, heroIdx) : pi;
}
function unaufhaltsam(engine, pi, heroIdx) {
  return stufe(engine, DECAY, pi, heroIdx, seiteDesWirkers(engine, pi, heroIdx)) >= 2;
}
function mitStatus(engine, pi, heroIdx) {
  return stufe(engine, SUPPORT, pi, heroIdx, seiteDesWirkers(engine, pi, heroIdx)) >= 1;
}

/** Angehängte Spells des Helden (Brettseite `owner`), die sich wegschicken lassen. */
function anhaengsel(engine, owner, heroIdx) {
  const db = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.owner !== owner || inst.heroIdx !== heroIdx) continue;
    if (inst.counters?.immovable || inst.counters?._cardinalImmune) continue;
    const cd = engine.getEffectiveCardData?.(inst) || db[inst.name];
    if (!cd || !hasCardType(cd, 'Spell') || String(cd.subtype || '').toLowerCase() !== 'attachment') continue;
    out.push(inst);
  }
  return out;
}

function anhaengselZiel(inst) {
  return {
    id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
    owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name,
    cardInstance: inst, _cardInstance: inst,
  };
}

/** Entfernbare negative Status eines Zieles: [{ key, label, icon }]. */
function statusEintraege(engine, t) {
  if (t.type === 'hero') return engine.cleansableHeroEntries(t.owner, t.heroIdx) || [];
  const inst = t.cardInstance;
  if (!inst) return [];
  return (engine.getCleansableCreatureStatusKeys(inst) || [])
    .map(k => ({ key: k, label: STATUS_EFFECTS[k]?.label || k, icon: STATUS_EFFECTS[k]?.icon || '' }));
}

/** Alle wählbaren Ziele für diesen Wirker (vor den Zielregeln der Engine). */
function ziele(engine, pi, heroIdx) {
  const out = [];
  const gs = engine.gs;
  const status = mitStatus(engine, pi, heroIdx);
  for (let seite = 0; seite < (gs.players || []).length; seite++) {
    const heroes = gs.players[seite]?.heroes || [];
    heroes.forEach((h, hi) => {
      if (!h?.name || h.hp <= 0) return;
      const t = { id: `hero-${seite}-${hi}`, type: 'hero', owner: seite, heroIdx: hi, cardName: h.name };
      if (anhaengsel(engine, seite, hi).length > 0 || (status && statusEintraege(engine, t).length > 0)) out.push(t);
    });
  }
  if (status) {
    // `getCreatureTargets(seat)` liefert die Kreaturen, die dieser Sitz KONTROLLIERT — beide Sitze durchgehen.
    for (let seat = 0; seat < (gs.players || []).length; seat++) {
      for (const t of (engine.getCreatureTargets(seat) || [])) {
        const inst = t.cardInstance;
        if (!inst || inst.faceDown || !engine._istKreaturenInstanz(inst)) continue;
        if (statusEintraege(engine, t).length > 0) out.push(t);
      }
    }
  }
  return out;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // CPU: auch ohne Decay 2 spielbar (dann als normale Aktion).
  cpuMeta: { optionalInherent: true },

  /** „If the user has at least Decay Magic 2, this counts as an additional Action." */
  inherentAction(gs, pi, heroIdx, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return false;
    return unaufhaltsam(eng, pi, heroIdx);
  },

  /** Grau, solange kein Held der Seite die Karte mit irgendeinem Ziel wirken kann. */
  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    return eng.heroesControlledBy(pi).some(({ hero, heroIdx }) => hero?.name && hero.hp > 0 && ziele(eng, pi, heroIdx).length > 0);
  },

  /** Für DIESEN Wirker: sein Support-Level entscheidet, ob Status-Ziele zählen. */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    return ziele(eng, pi, heroIdx).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const heroSeite = ctx.cardHeroOwner ?? pi;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || gs.players[heroSeite]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }

      const hart = unaufhaltsam(engine, pi, heroIdx);       // Decay Magic 2: unverhinderbar + unnegierbar
      const status = mitStatus(engine, pi, heroIdx);        // Support Magic 1: auch Status entfernen
      const quelle = { name: CARD_NAME, owner: pi, heroIdx, controller: pi, heroOwner: heroSeite };

      // ── 1. Zielwahl ──
      const liste = ziele(engine, pi, heroIdx);
      if (liste.length === 0) { gs._spellCancelled = true; return; }
      const mitAuge = engine._sourceIgnoresTargetingRestrictions?.(ctx.card);
      const gewaehlt = await engine.promptEffectTarget(pi, [...liste, ...ausgegrauteRestkarten(engine, liste)], {
        ...(mitAuge ? { ignoreUntargetable: true, _truthSeeingEye: true } : {}),
        chooserHeroIdx: heroIdx,
        title: CARD_NAME, source: CARD_NAME,
        description: status
          ? 'Choose a target. Remove any number of Spells attached to it and any number of its negative status effects.'
          : 'Choose a Hero with Spells attached to it. Remove any number of them.',
        confirmLabel: '✨ Exorcise!', confirmClass: 'btn-success', greenSelect: true,
        minRequired: 1, maxTotal: 1, exclusiveTypes: true, maxPerType: { hero: 1, equip: 1 },
        alwaysConfirmable: false,
        dealsDamage: false,
        ...(hart ? { cannotBeNegated: true } : {}),
        cancellable: true,
      });
      const id = Array.isArray(gewaehlt) ? gewaehlt[0] : gewaehlt;
      const ziel = id && ziele(engine, pi, heroIdx).find(z => z.id === id);
      if (!ziel) { gs._spellCancelled = true; return; }

      const tHero = ziel.type === 'hero' ? gs.players[ziel.owner]?.heroes?.[ziel.heroIdx] : null;
      const tInst = ziel.type === 'hero' ? null : ziel.cardInstance;
      if (ziel.type === 'hero' ? !(tHero?.name && tHero.hp > 0) : !(tInst && tInst.zone === 'support')) { gs._spellCancelled = true; return; }

      // ── Schutzfenster (Resistance, Zauber-Immunität) — fällt bei Decay Magic 2 weg ──
      if (!hart) {
        const blockiert = ziel.type === 'hero'
          ? await engine.heroNonDamageEffectBlocked(ziel.owner, ziel.heroIdx, 'unequip', { sourceOwner: pi, source: quelle })
          : !!engine.kreaturSpellImmun?.(tInst, quelle, { sourceOwner: pi });
        if (blockiert) {
          engine.log('exorcism_blocked', { player: ps.username, target: ziel.cardName });
          engine.sync();
          return;
        }
      }

      // ── 2. Anhängsel wählen ──
      let weg = [];
      let beschlossen = false;                                // wurde schon irgendetwas entschieden? (für den Abbruch der Statuswahl)
      const anh = ziel.type === 'hero' ? anhaengsel(engine, ziel.owner, ziel.heroIdx) : [];
      if (anh.length > 0) {
        const anhZiele = anh.map(anhaengselZiel);
        const w = await engine.promptEffectTarget(pi, [...anhZiele, ...ausgegrauteRestkarten(engine, anhZiele)], {
          chooserHeroIdx: heroIdx,
          title: `${CARD_NAME} — Spells attached to ${ziel.cardName}`, source: CARD_NAME,
          description: `Choose any number of Spells attached to ${ziel.cardName} (or none) and send them to the discard pile.`,
          confirmLabel: '✨ Remove!', confirmClass: 'btn-success', greenSelect: true,
          minRequired: 0, maxTotal: anhZiele.length, alwaysConfirmable: true,
          exclusiveTypes: true, maxPerType: { equip: anhZiele.length },
          dealsDamage: false, _skipRedirectCheck: true,        // das Ziel steht fest; die Wahl der Anhängsel ist keine neue Zielwahl
          cancellable: true,
        });
        if (w === null || (Array.isArray(w) && w.cancelled)) { gs._spellCancelled = true; return; }
        const ids = Array.isArray(w) ? w : (w ? [w] : []);
        // Nach der Abfrage neu einsammeln — das Brett kann sich bewegt haben.
        const frisch = anhaengsel(engine, ziel.owner, ziel.heroIdx).map(anhaengselZiel);
        weg = ids.map(i => frisch.find(z => z.id === i)).filter(z => z?.cardInstance);
        beschlossen = true;
      }

      // ── 3. Status wählen (Support Magic 1) ──
      let entfernen = [];
      if (status) {
        // Erst die Anhängsel gehen lassen — ihr Status verschwindet mit ihnen; die Statuswahl zeigt den Rest.
        // (Die Wahl findet aber VOR dem Abwurf statt, damit ein Abbruch alles zurücknimmt: wir rechnen die Status ohne die gewählten Anhängsel vor.)
        let eintraege = statusEintraege(engine, ziel);
        const statusDerGewaehlten = new Set();
        for (const z of weg) {
          const sk = loadCardEffect(z.cardName)?.attachmentStatus;
          if (sk) statusDerGewaehlten.add(sk);
        }
        if (statusDerGewaehlten.size > 0) eintraege = eintraege.filter(e => !statusDerGewaehlten.has(e.key));
        if (eintraege.length > 0) {
          const r = await engine.promptGeneric(pi, {
            type: 'statusSelect',
            targetName: ziel.cardName,
            statuses: eintraege,
            title: `${CARD_NAME} — ${ziel.cardName}`,
            description: `Choose any number of negative status effects to remove from ${ziel.cardName} (or none).`,
            confirmLabel: '✨ Cleanse!',
            cancellable: true,
            cpuDispatch: CARD_NAME,        // der Titel trägt den Zielnamen — die CPU-Weiche findet die Karte darüber
            _exorcismPi: pi,               // der gefragte Spieler (die Weiche gibt ihn nicht mit)
          });
          const abgebrochen = r === null || r === undefined || r?.cancelled;
          if (abgebrochen) {
            if (!beschlossen) { gs._spellCancelled = true; return; }        // nur wegen der Status wählbar → alles zurück
          } else {
            entfernen = (r.selectedStatuses || []).filter(k => eintraege.some(e => e.key === k));
          }
        }
      }

      // ── Bild: die Lichtsäule ──
      if (weg.length > 0 || entfernen.length > 0) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'exorcism_light', zoneType: 'board', owner: ziel.owner, heroIdx: -1, zoneSlot: -1, duration: LICHT_MS,
          targets: [{ owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx }],
          originOwner: heroSeite, originHeroIdx: heroIdx, originZoneSlot: -1,
        });
        await engine._delay(LICHT_VOR_MS);
      }

      // ── Ausführen: Anhängsel in die Ablage ──
      const abgeworfen = [];
      for (const z of weg) {
        const inst = z.cardInstance;
        if (inst.zone !== 'support') continue;
        const ok = await engine.sendBoardCardToDiscard(inst, { source: quelle, sourceName: CARD_NAME, sourceOwner: pi });
        if (ok || inst.zone !== 'support') abgeworfen.push(z.cardName);
      }

      // ── Ausführen: Status entfernen ──
      const geheilt = [];
      if (entfernen.length > 0) {
        if (ziel.type === 'hero') {
          const h = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
          if (h?.name && h.hp > 0) {
            for (const k of entfernen) {
              if (!h.statuses?.[k]) continue;                     // mit einem Anhängsel schon gegangen
              geheilt.push(...engine.cleanseHeroStatuses(h, ziel.owner, ziel.heroIdx, [k], CARD_NAME));
            }
          }
        } else if (tInst.zone === 'support') {
          geheilt.push(...engine.cleanseCreatureStatuses(tInst, entfernen, CARD_NAME));
        }
      }

      engine.log('exorcism', {
        player: ps.username, target: ziel.cardName, removed: abgeworfen, statuses: geheilt, unstoppable: hart,
      });
      engine.sync();
      await engine._delay(NACH_MS);
    },
  },

  /**
   * CPU. Zielwahl: der EIGENE Held/die eigene Kreatur mit den meisten negativen Status; sonst ein gegnerischer Held mit Anhängseln, die nicht von einem Fluch stammen (Schutz-/Segens-Anhängsel
   * wie Prophecy of Tempeste). Anhängselwahl: am eigenen Ziel die Fluch-Anhängsel (mit Status), am gegnerischen die übrigen. Statuswahl: am eigenen Ziel alle, am fremden keiner.
   */
  cpuResponse(engine, kind, promptData) {
    const { validTargets, config, playerIdx } = promptData || {};
    const fluch = (name) => {
      const k = loadCardEffect(name)?.attachmentStatus;
      return !!(k && STATUS_EFFECTS[k]?.negative);
    };
    const meins = (t) => (engine.zielSeite ? engine.zielSeite(t) : t.owner) === playerIdx;

    if (kind === 'generic' && promptData?.type === 'statusSelect' && String(promptData.title || '').startsWith(CARD_NAME)) {
      const alle = (promptData.statuses || []).map(s => s.key);
      const hero = promptData.targetName;
      const ich = promptData._exorcismPi ?? engine._cpuPlayerIdx;
      const eigener = engine.heroesControlledBy(ich).some(({ hero: h }) => h?.name === hero)
        || engine.cardInstances.some(c => c.zone === 'support' && c.name === hero && engine.kontrolleurVon(c) === ich);
      return { selectedStatuses: eigener ? alle : [] };
    }
    if (kind !== 'effectTarget' || !Array.isArray(validTargets)) return undefined;
    const frei = validTargets.filter(t => !t.ineligible);
    if (config?.title === CARD_NAME) {
      let best = null, bestV = 0;
      for (const t of frei) {
        let v = 0;
        if (meins(t)) v = statusEintraege(engine, t).length * 10;
        else if (t.type === 'hero') v = anhaengsel(engine, t.owner, t.heroIdx).filter(i => !fluch(i.name)).length;
        if (v > bestV) { bestV = v; best = t; }
      }
      return best ? [best.id] : [];
    }
    if (String(config?.title || '').startsWith(CARD_NAME + ' — Spells attached')) {
      const waehlbar = frei.filter(t => t.type === 'equip');
      return waehlbar.filter(t => (meins(t) ? fluch(t.cardName) : !fluch(t.cardName))).map(t => t.id);
    }
    return undefined;
  },
};
