// ═══════════════════════════════════════════
//  CARD EFFECT: "Teleport"
//  Spell (Normal, Magic Arts Lv1) — vorher Reaction, seit 24.10.2026 Normal
//
//  „Choose two Heroes you control and swap their positions as well as
//   the positions of their Abilities. Any cards in their Support Zones
//   remain where they were. If this is the second Spell you use this
//   turn, this counts as an additional Action."
//
//  ── BAUFORM ───────────────────────────────────────────────────────
//  ① WAS WANDERT: der Held (die Heldenkarte samt allem, was an ihr
//    hängt: HP, Status, Buffs, Zähler) und seine ABILITIES wechseln den
//    Platz. WAS BLEIBT: alles in den Support Zones (Kreaturen,
//    Ausrüstung, Anhängsel, Tokens, Inseln) und die Surprise Zones
//    (Ruling-Vorschlag: Zonen der SPALTE, nicht des Helden — der Text
//    nennt nur die Support Zones; Surprises bleiben liegen und gehören
//    nach dem Tausch zum neuen Helden der Spalte). Ausrüstung und
//    Anhängsel gehören damit nach dem Tausch zum ANDEREN Helden.
//  ② ★ BONI ZIEHEN MIT (Al): Boni von Ausrüstung/Anhängseln stehen am
//    HELDEN (Max-HP, ATK, Status des Anhängsels, Aufstiegsbereitschaft).
//    Vor dem Tausch geht deshalb jede Ausrüstung/jedes Anhängsel in
//    beiden Spalten über denselben Abgangsweg wie beim Umhängen (Slippery
//    Fridge/Inheritance Ceremony, `actionTransferAttachment`): das eigene
//    `onCardLeaveZone` der Karte (Bonus zurück), `onEquipLost`
//    (Zustandslauscher, `reason: 'moved'`); nach dem Tausch der Eintritt am
//    NEUEN Wirt: `onCardEnterZone` (nur an die Karte, `_isMove`), `onPlay`
//    (`_isMove`: Boni neu anlegen), `attachmentMovedToHost` (Status-
//    Anhängsel), `onEquipGained` (`isMove`, OHNE Anleger — es ist kein
//    „equip", also weder Lunatic-Hawk-Karte noch Afflicted-Pests-/
//    Cybug-Fenster). Kreaturen und Tokens haben keinen Wirtsbonus und
//    sehen nichts. Abilities wandern MIT dem Helden (Toughness/Fighting-
//    Bonus bleibt beim Helden).
//  ③ INDEX-GEBUNDENER ZUSTAND tauscht mit: `gs.heroFlags` (Ida & Co.),
//    `ps.abilityGivenThisTurn`, `ps._bonusAbilityAttachments`,
//    `heroesAttackedThisTurn`, `comboLockHeroIdx`, Lizbeth-Rundenstempel
//    sowie die Heldeninstanzen und Ability-Instanzen (`heroIdx`).
//    `heroesActedThisTurn` tauscht NACH dem Spielweg (`afterSpellResolved`):
//    der Server trägt den Wirker erst nach der Auflösung mit seinem
//    ALTEN Platz ein.
//  ④ „two Heroes you control": zwei lebende Helden, die der Spieler
//    kontrolliert UND die in derselben Brettseite stehen (ein übernommener
//    Gegnerheld kann nicht in die eigene Reihe wandern); Zielwahl abbrechbar.
//  ④b ★ PUPPETS (Al, 24.10.2026): Tri Fecta/Tri Ad sind die EINZIGE Ausnahme von
//    „Support Zones bleiben" — ihre Puppet-Tokens wandern mit dem Helden in die
//    Spalte, in die er zieht (Token behalten Instanz, Counter [Luck/Preserve];
//    die Aktivsperre der Spalte tauscht mit). Ist dort nicht genug Platz
//    (freie Support Zones der Zielspalte, abzüglich ihrer eigenen Tokens, die ja
//    selbst wandern), ist das Paar NICHT erlaubt: der Held ist dann kein Ziel
//    für diesen Partner (Zielwahl: ausgegraut ohne gültigen Partner, bei einem
//    ungültigen Paar neue Wahl).
//  ④c ★ SUPPORT-ZONEN-ABILITIES (Al, 24.10.2026): Abilities in den Support Zones (Xal, Xalibur) sind Abilities und wandern MIT dem Helden — in die Support
//    Zones der Spalte, in die er zieht. Dieselbe Platzregel wie bei den Puppets: das Paar ist nur erlaubt, wenn die Zielspalte sie TRÄGT (genug freie Support Zones,
//    abzüglich der Plätze, die die eigenen wandernden Karten räumen). Verliert ein Held dadurch seine Erlaubnis (Xalibur bleibt in der alten Spalte liegen), schickt
//    der Teleport alle diese Abilities NACH dem Tausch auf den Ablagestapel (`_support-ability-move-shared.js`; die Leafagami Snake schützt wie sonst).
//  ⑤ „If this is the second Spell you use this turn …":
//    `inherentAction` als Funktion über `ps.spellsPlayedThisTurn` (der
//    Server zählt VOR dem Effekt; der zweite Zauber sieht 1).
//  ⑥ Animation: `portal_warp` an beiden Helden, der Tausch geschieht
//    in der Mitte.
// ═══════════════════════════════════════════

const CARD_NAME = 'Teleport';
const ANIM_MS = 1100;

/** Lebende Helden, die `pi` kontrolliert: [{ seite (Brettseite), heroIdx, hero }]. */
function kontrollierte(engine, pi) {
  const out = [];
  for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(pi)) {
    if (!hero?.name || hero.hp <= 0) continue;
    out.push({ seite: physOwner, heroIdx, hero });
  }
  return out;
}

const { isPuppetToken, isPuppetHero } = require('./_puppets-shared');

/** Puppet-Tokens, die in den Support Zones von Spalte `col` (Brettseite `seite`) des Puppet-Helden stehen. */
function puppetTokensDerSpalte(engine, seite, col) {
  const hero = engine.gs.players[seite]?.heroes?.[col];
  if (!hero?.name || !isPuppetHero(hero.name)) return [];
  return engine.cardInstances.filter(c => c.zone === 'support' && engine.physicalSide(c) === seite
    && c.heroIdx === col && isPuppetToken(c.name)).sort((x, y) => x.zoneSlot - y.zoneSlot);
}

const SM = require('./_support-ability-move-shared');

/** Die Mitwanderer einer Spalte: Puppet-Tokens (Tri Fecta / Tri Ad) und Ability-Stapel in den Support Zones (Xal, Xalibur). */
function mitwandererDerSpalte(engine, seite, col) {
  const puppets = puppetTokensDerSpalte(engine, seite, col)
    .map(inst => ({ art: 'puppet', seite, col, slot: inst.zoneSlot, namen: [inst.name], insts: [inst] }));
  return [...puppets, ...SM.supportAbilityStapel(engine, seite, col)];
}

/**
 * Wohin wandern die Puppets UND die Support-Zonen-Abilities beim Tausch von Spalte `a` und `b`? { ok, moves: [{ mover, nach }] }.
 * Plätze der Zielspalte: leer, oder von einer Karte belegt, die selbst auszieht. Alle anderen Karten bleiben liegen und blockieren.
 * Gleicher Slot-Index, wenn frei, sonst der niedrigste freie.
 */
function puppetPlan(engine, seite, a, b) {
  return SM.planeVerlagerung(engine,
    { seite, col: a, movers: mitwandererDerSpalte(engine, seite, a) },
    { seite, col: b, movers: mitwandererDerSpalte(engine, seite, b) });
}

/** Darf dieses Paar tauschen? (zwei lebende Helden derselben Brettseite, Puppets finden Platz) */
function paarGueltig(engine, x, y) {
  if (x.seite !== y.seite || (x.heroIdx === y.heroIdx)) return false;
  return puppetPlan(engine, x.seite, x.heroIdx, y.heroIdx).ok;
}

/** Gibt es zwei kontrollierte, lebende Helden, die tauschen dürfen? */
function hatPaar(engine, pi) {
  const l = kontrollierte(engine, pi);
  return l.some((x, i) => l.some((y, j) => j > i && paarGueltig(engine, x, y)));
}

/** Zählt diese Support-Karte als Wirtsbonus-Träger (Ausrüstung/Anhängsel)? Kreaturen, Tokens, Abilities nicht. */
function traegtWirtsbonus(engine, inst) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  if (inst.counters?._gainedEffectOnly) return false;
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  if (!cd) return false;
  const { hasCardType } = require('./_hooks');
  if (hasCardType(cd, 'Creature') || hasCardType(cd, 'Token') || hasCardType(cd, 'Ability')) return false;
  if (engine.isTokenCard?.(inst)) return false;
  return true;
}

function tauscheSchluessel(obj, k1, k2) {
  if (!obj) return;
  const h1 = Object.prototype.hasOwnProperty.call(obj, k1), h2 = Object.prototype.hasOwnProperty.call(obj, k2);
  const v1 = obj[k1], v2 = obj[k2];
  if (h2) obj[k1] = v2; else delete obj[k1];
  if (h1) obj[k2] = v1; else delete obj[k2];
}

function tauscheIndexInListe(liste, a, b) {
  if (!Array.isArray(liste)) return;
  const hatA = liste.includes(a), hatB = liste.includes(b);
  if (hatA === hatB) return;
  for (let i = 0; i < liste.length; i++) {
    if (liste[i] === a) liste[i] = b; else if (liste[i] === b) liste[i] = a;
  }
}

/**
 * ★ Der Tausch selbst (Spieler- und Skriptunabhängig, damit Tests ihn direkt rufen können).
 * `seite` = Brettseite beider Helden, `a`/`b` = Spaltenindizes, `wirker` = der ausführende Spieler (nur fürs Protokoll).
 */
async function tauscheHeldenplaetze(engine, seite, a, b, wirker) {
  const gs = engine.gs;
  const ps = gs.players[seite];
  const plan = puppetPlan(engine, seite, a, b);
  if (!plan.ok) return false;   // Puppets fänden keinen Platz: kein Tausch (die Zielwahl lässt so ein Paar gar nicht zu)
  const traeger = engine.cardInstances.filter(c => c.zone === 'support' && engine.physicalSide(c) === seite
    && (c.heroIdx === a || c.heroIdx === b) && traegtWirtsbonus(engine, c));

  // ── ① Abgang der Ausrüstung/Anhängsel vom ALTEN Wirt (Boni zurück) ──
  for (const inst of traeger) {
    await engine.runHooks('onCardLeaveZone', {
      _onlyCard: inst, card: inst, leavingCard: inst,
      fromZone: 'support', fromHeroIdx: inst.heroIdx, fromZoneSlot: inst.zoneSlot,
      fromOwner: inst.owner, toZone: 'support',
      _skipReactionCheck: true,
      _equipLostGemeldet: true,
      _teleportBewegung: true,   // 24.10.: nur ein Platzwechsel der Spalten — Xalibur räumt hier NICHT ab (die Erlaubnis wird NACH dem Tausch geprüft, siehe `raeumeNachTausch`)
    });
    if (inst.counters?._atkTraeger) engine.actionRevokeAtkAmTraeger(inst);
    await engine.fireEquipLost(inst, {
      fromOwner: seite, fromHeroIdx: inst.heroIdx, fromZoneSlot: inst.zoneSlot,
      toOwner: seite, toHeroIdx: inst.heroIdx, toZoneSlot: inst.zoneSlot,
      source: CARD_NAME, isMove: true, reason: 'moved',
    });
  }

  // ── ② Der Tausch: Held + Abilities (+ alles, was am Helden-PLATZ haengt) ──
  [ps.heroes[a], ps.heroes[b]] = [ps.heroes[b], ps.heroes[a]];
  if (!ps.abilityZones) ps.abilityZones = [];
  [ps.abilityZones[a], ps.abilityZones[b]] = [ps.abilityZones[b], ps.abilityZones[a]];
  if (Array.isArray(ps.abilityGivenThisTurn)) [ps.abilityGivenThisTurn[a], ps.abilityGivenThisTurn[b]] = [ps.abilityGivenThisTurn[b], ps.abilityGivenThisTurn[a]];
  if (ps._bonusAbilityAttachments && typeof ps._bonusAbilityAttachments === 'object') tauscheSchluessel(ps._bonusAbilityAttachments, a, b);
  tauscheIndexInListe(ps.heroesAttackedThisTurn, a, b);
  if (ps.comboLockHeroIdx === a) ps.comboLockHeroIdx = b; else if (ps.comboLockHeroIdx === b) ps.comboLockHeroIdx = a;
  tauscheSchluessel(gs.heroFlags, `${seite}-${a}`, `${seite}-${b}`);
  if (gs.hoptUsed) {
    for (const key of Object.keys(gs.hoptUsed)) {
      const m = /^(_lizbeth[A-Za-z]+):(\d+):(\d+)$/.exec(key);
      if (m && Number(m[2]) === seite && (Number(m[3]) === a || Number(m[3]) === b)) {
        const neu = `${m[1]}:${m[2]}:${Number(m[3]) === a ? b : a}`;
        const v = gs.hoptUsed[key]; delete gs.hoptUsed[key]; gs.hoptUsed[neu] = v;
      }
    }
  }
  for (const inst of engine.cardInstances) {
    if ((inst.zone !== 'hero' && inst.zone !== 'ability') || engine.physicalSide(inst) !== seite) continue;
    if (inst.heroIdx === a) inst.heroIdx = b; else if (inst.heroIdx === b) inst.heroIdx = a;
  }
  // Puppet-Tokens und Support-Zonen-Abilities ziehen in die Spalte ihres Helden (stiller Umzug wie beim Tri-Ad-Tausch: keine Abgangs-Hooks, keine
  // Niederlage-Prüfung dazwischen; die Boni der Abilities hängen am Helden und wandern mit ihm).
  const verlagert = SM.fuehreVerlagerungAus(engine, plan);
  if (plan.moves.some(m => m.mover.art === 'puppet')) tauscheSchluessel(gs._puppetActiveLock, `${seite}-${a}`, `${seite}-${b}`);   // „No other Token in the corresponding Hero's Support Zones …" hängt am Helden
  engine.sync();

  // ── ③ Eintritt der Ausrüstung/Anhängsel am NEUEN Wirt (Boni neu anlegen) ──
  for (const inst of traeger) {
    if (inst.zone !== 'support') continue;
    await engine.runHooks('onCardEnterZone', {
      _onlyCard: inst, enteringCard: inst, toZone: 'support', toHeroIdx: inst.heroIdx,
      _skipReactionCheck: true, _isMove: true, _fromOwner: seite, _fromHeroIdx: inst.heroIdx,
    });
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst, card: inst, cardName: inst.name, zone: 'support',
      heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      _skipReactionCheck: true, _isMove: true,
    });
    const sk = require('./_loader').loadCardEffect(inst.name);
    if (typeof sk?.attachmentMovedToHost === 'function') {
      try {
        await sk.attachmentMovedToHost(engine, inst, { fromOwner: seite, fromHeroIdx: inst.heroIdx, toOwner: seite, toHeroIdx: inst.heroIdx });
      } catch (err) { console.error(`[attachmentMovedToHost] ${inst.name} threw:`, err.message); }
    }
    // Zustandslauscher (Taio, Riffel, Fiona …): `onEquipGained` mit `isMove`, bewusst OHNE Anleger — kein „equip" im Sinne von Lunatic Hawk/Afflicted Pests.
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    const { hasCardType } = require('./_hooks');
    const kind = (hasCardType(cd, 'Spell') || hasCardType(cd, 'Attack') || inst.counters?._keinEquip) ? 'attachment' : 'equip';
    await engine.runHooks('onEquipGained', {
      equipCard: inst, equipName: inst.name, equipOwner: null, equipHeroIdx: inst.heroIdx,
      hostSide: seite, heroController: engine.surpriseKontrolleur(seite, inst.heroIdx),
      kind, isMove: true, fromOwner: seite, fromHeroIdx: inst.heroIdx, source: CARD_NAME,
      _skipReactionCheck: true,
    });
  }
  // Hat ein Held dadurch seine Erlaubnis für Abilities in Support Zones verloren (Xalibur blieb in der alten Spalte liegen), gehen diese Abilities
  // NACH dem Tausch (auch nach dem Wechsel der Ausrüstung) in die Ablage; die übrigen Spalten gleichen ihre Abilities ab.
  await SM.raeumeNachTausch(engine, verlagert, CARD_NAME);
  if (typeof engine._refreshAscensionReadiness === 'function') { try { engine._refreshAscensionReadiness(); } catch { /* Beiwerk */ } }
  engine.log('teleport', {
    player: gs.players[wirker]?.username,
    a: ps.heroes[b]?.name, b: ps.heroes[a]?.name,   // alter Platz → neuer Platz
    from: a, to: b, owner: seite,
  });
  engine.sync();
  return true;
}

module.exports = {
  // Entkoppelte Bilder: auch ein negierter Teleport zeigt sein Portal.
  spellVisual: { impact: { type: 'portal_warp' }, impactMs: 400 },

  activeIn: ['hand'],
  requiresTarget: true,
  tauscheHeldenplaetze, paarGueltig, puppetPlan,

  // „If this is the second Spell you use this turn, this counts as an additional Action."
  // (`spellsPlayedThisTurn` zählt der Server vor dem Effekt: der zweite Zauber sieht 1.)
  inherentAction(gs, pi) {
    return (gs.players[pi]?.spellsPlayedThisTurn || 0) === 1;
  },

  spellPlayCondition(gs, pi, engine) {
    return !!engine && hatPaar(engine, pi);
  },

  /** CPU: das erste gültige Paar (derselben Brettseite, Puppets finden Platz). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget' || promptData?.config?.title !== CARD_NAME) return undefined;
    const ok = (promptData.validTargets || []).filter(t => t && t.type === 'hero' && !t.ineligible);
    for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) {
      if (paarGueltig(engine, { seite: ok[i].owner, heroIdx: ok[i].heroIdx }, { seite: ok[j].owner, heroIdx: ok[j].heroIdx })) return [ok[i].id, ok[j].id];
    }
    return promptData.config.cancellable ? [] : undefined;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      const frei = kontrollierte(engine, pi);
      // Helden ohne gültigen Partner (z. B. Tri Fecta, deren Puppets nirgends Platz fänden) bleiben sichtbar, aber ausgegraut.
      const targets = frei.map(x => ({
        id: `hero-${x.seite}-${x.heroIdx}`, type: 'hero', owner: x.seite, heroIdx: x.heroIdx, cardName: x.hero.name,
        ...(frei.some(y => y !== x && paarGueltig(engine, x, y)) ? {} : { ineligible: true }),
      }));
      if (!hatPaar(engine, pi)) { gs._spellCancelled = true; return; }

      let a = null, b = null;
      for (let versuch = 0; versuch < 6 && !a; versuch++) {
        const picked = await engine.promptEffectTarget(pi, targets, {
          title: CARD_NAME,
          description: versuch === 0
            ? 'Choose two Heroes you control — they swap positions, with their Abilities. Cards in Support Zones stay where they are.'
            : 'Both Heroes must stand on the same side of the board, and Puppet Tokens need enough free Support Zones in the other Hero\'s column. Choose two Heroes you control.',
          confirmLabel: '🌀 Teleport!',
          confirmClass: 'btn-info',
          cancellable: true,                 // zielende Karten sind immer abbrechbar (Als Regel 23.9.)
          casterHeroIdx: ctx.cardHeroIdx,
          exclusiveTypes: false,
          minRequired: 2,
          maxTotal: 2,
        });
        if (!picked || picked.length < 2) { gs._spellCancelled = true; return; }
        const ta = targets.find(t => t.id === picked[0]), tb = targets.find(t => t.id === picked[1]);
        if (!ta || !tb || (ta.owner === tb.owner && ta.heroIdx === tb.heroIdx)) { gs._spellCancelled = true; return; }
        if (paarGueltig(engine, { seite: ta.owner, heroIdx: ta.heroIdx }, { seite: tb.owner, heroIdx: tb.heroIdx })) { a = ta; b = tb; }
      }
      if (!a || !b) { gs._spellCancelled = true; return; }

      const seite = a.owner;
      const ha = gs.players[seite].heroes[a.heroIdx];
      const hb = gs.players[seite].heroes[b.heroIdx];
      if (!ha?.name || !hb?.name || ha.hp <= 0 || hb.hp <= 0) { gs._spellCancelled = true; return; }

      // Portale auf beiden Plätzen; der Tausch geschieht in der Mitte der Animation.
      engine._broadcastEvent('play_zone_animation', { type: 'portal_warp', owner: seite, heroIdx: a.heroIdx, zoneSlot: -1 });
      engine._broadcastEvent('play_zone_animation', { type: 'portal_warp', owner: seite, heroIdx: b.heroIdx, zoneSlot: -1 });
      await engine._delay(ANIM_MS / 2);

      await tauscheHeldenplaetze(engine, seite, a.heroIdx, b.heroIdx, pi);
      // Der Server trägt den Wirker NACH der Auflösung mit seinem alten Platz in `heroesActedThisTurn` ein → danach tauschen (siehe `afterSpellResolved`).
      gs._teleportNachlauf = { pi, seite, a: a.heroIdx, b: b.heroIdx };
      await engine._delay(ANIM_MS / 2);
      engine.sync();
    },

    /** „heroesActedThisTurn" kennt Plätze: erst nach der Eintragung des Wirkers durch den Spielweg tauschen. */
    afterSpellResolved: (ctx) => {
      const gs = ctx._engine.gs;
      const n = gs._teleportNachlauf;
      if (!n || ctx.spellName !== CARD_NAME || ctx.casterIdx !== n.pi) return;
      delete gs._teleportNachlauf;
      if (n.seite === n.pi) tauscheIndexInListe(gs.players[n.pi]?.heroesActedThisTurn, n.a, n.b);
    },
  },
};
