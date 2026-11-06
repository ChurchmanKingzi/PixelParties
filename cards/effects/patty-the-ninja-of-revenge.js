// ═══════════════════════════════════════════
//  CARD EFFECT: "Patty, the Ninja of Revenge"
//  Hero (Infiltration + Stealth)
//
//  „You may once per turn choose any number of Abilities that are attached to a Hero you permanently control and send them to the discard pile. Then, choose a target and deal
//   damage equal to 50 times the number of chosen Abilities to it. This damage cannot exceed 300 and is treated as an Attack."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────────
//  • „A Hero you permanently control": alle Helden von `pi` ausser den TEMPORAER gesteuerten — also die eigenen (auch gefallene, ihre Karte liegt weiter auf dem Brett) und die
//    dauerhaft uebernommenen (`permaControlBy`, Paraseed Control; ihre Abilities liegen in der Spalte des Vorbesitzers). Ein Held, den der Gegner per Charme gerade leiht,
//    ist nicht mehr „permanent controlled" (seine Abilities sind ohnehin geschuetzt, `abilityZoneGeschuetzt`); ein per Charme geliehener fremder Held zaehlt nicht
//    (`engine.heroesControlledBy(pi, { permanentOnly: true })` + `istTemporaerGesteuert`). Gesammelt in `_ability-cost-shared.permanentHeroes`.
//  • „Any number": mindestens EINE Ability — der Spieler klickt sie nacheinander an (ein Klick schickt die oberste Kopie des Stapels; Support-Zonen-Stapel von Xal/Xalibur
//    zaehlen mit), „Done" beendet das Sammeln.
//  • EIN Held je Aktivierung (Als Vorgabe 25.10.): die ERSTE geschickte Ability legt den Helden fest; danach sind nur noch dessen Abilities wahlbar (die der uebrigen
//    kontrollierten Helden verschwinden aus der Wahl). Die naechste Aktivierung (auch die Wiederholung durch Idej Sword – Kunagi) darf einen anderen Helden waehlen. Vor der ersten Ability ist die Wahl abbrechbar (Aktivierung zurueck, nichts verbraucht); danach ist die Zielwahl nicht mehr
//    abbrechbar (die Abilities sind weg).
//  • Leafagami Snake: das Ablegen wird verhindert (die Ability bleibt liegen, der Kontrolleur zieht eine Karte), die Ability zaehlt aber als gewaehlt — der Schaden
//    entsteht trotzdem (wie bei Weapon Storm: der Preis gilt als bezahlt).
//  • Schaden = min(300, 50 × Anzahl der gewaehlten Abilities); die Obergrenze ist Teil der Formel (kein Abzug im Sinne von „cannot be reduced").
//  • „Treated as an Attack" (`treatedAsAttack: { ability: 'Fighting' }`, Muster Broghan): Attack-Zaehler und -Sperren (`heroKannAngreifen`), Attack-Reaktionen ueber die
//    virtuelle Attack-Kette (`alsAttackKette`), Quellstufe = Fighting-Level Pattys. Wird der Treffer im Zielfenster NEGIERT, bleibt der Effekt verbraucht (die Abilities sind
//    bezahlt) und zaehlt als gespielte Attack.
//  • Idej Sword – Kunagi („perform that Attack again"): die Wiederholung verlangt erneut Abilities (Kosten fallen wieder an; ohne sendbare Ability findet sie nicht statt).
//
//  ── Bild und Klang ────────────────────────────────────────────────────
//  `play_zone_animation` `patty_shuriken` (Pixelart, ANIM_REGISTRY): ein schwarzer Wurfstern je Ability fliegt in sehr schneller Folge von Patty zum Ziel (`runde` = Anzahl);
//  jeder Einschlag blitzt weiss auf. Klaenge in ZONE_ANIM_SFX (ein Zischen je Stern); Log `patty`.
//
//  ── CPU ─────────────────────────────────────────────────────────────
//  Das Gate (MCTS) entscheidet ueber die Aktivierung; die Abilitywahl folgt `cpuSendFallback` (Lernkanal zuerst, sonst die billigsten zuerst, hoechstens drei) — der
//  Zielwahl-Teil laeuft ueber die allgemeine Schadensziel-Wahl der CPU.
// ═══════════════════════════════════════════

const { targetsFor, sendCardsLoop, cpuSendFallback, permanentHeroes } = require('./_ability-cost-shared');

const CARD_NAME = 'Patty, the Ninja of Revenge';
const PRO_ABILITY = 50;
const MAX_SCHADEN = 300;
const MAX_ABILITIES = MAX_SCHADEN / PRO_ABILITY;          // 6 — mehr Abilities schaden nicht zusaetzlich
const CPU_MAX_SENDEN = 3;                                  // die CPU opfert hoechstens so viele Abilities
const STERN_ABSTAND_MS = 70;                               // Abstand der Wuerfe (sehr schnelle Folge)
const STERN_FLUG_MS = 280;                                 // Flugzeit eines Sterns
const STERN_START_MS = 80;                                 // Anlauf bis zum ersten Wurf
const MAX_STERNE = 12;                                     // mehr Sterne zeigt die Animation nicht (einer je Ability)
const ANIM_MS = 1700;                                      // Laenge von `patty_shuriken` im Client (ENDE; deckt 12 Sterne samt Nachspiel)

function schadenFuer(anzahl) {
  return Math.min(MAX_SCHADEN, PRO_ABILITY * Math.max(0, anzahl));
}

/**
 * Die Helden, deren Abilities Patty schicken darf (Brettspalte + Heldenindex). `festgelegt.held` = der Held der ersten geschickten Ability (`{ physOwner, heroIdx }`):
 * ab dann zaehlt nur noch er — die Abilities der anderen Helden sind in dieser Aktivierung nicht mehr waehlbar.
 */
function quellHelden(engine, pi, festgelegt) {
  return () => permanentHeroes(engine, pi)
    .map(h => ({ physOwner: h.physOwner, heroIdx: h.heroIdx }))
    .filter(h => !festgelegt?.held || (h.physOwner === festgelegt.held.physOwner && h.heroIdx === festgelegt.held.heroIdx));
}

/** Gibt es mindestens eine Ability, die Patty schicken koennte? */
function hatSendbareAbility(engine, pi) {
  return targetsFor(engine, pi, 0, ['ability'], quellHelden(engine, pi)).length > 0;
}

module.exports = {
  // Als Attack geltender Heldeneffekt ohne Karte (Muster Broghan): Stufen-Bedingungen lesen das Fighting-Level dieses Helden.
  treatedAsAttack: { ability: 'Fighting' },
  requiresTarget: true,
  activeIn: ['hero'],
  heroEffect: true,
  // Rein schaedlich: Schaden auf ein Ziel. Unter dem Spielstart-Schutz nicht nutzbar (Als Ruling 8.8.).
  heroEffectHarmfulOnly: true,

  // CPU-Schaetzung: Schaden je Zug, wenn zwei Abilities geopfert werden.
  supportYield() {
    return { damagePerTurn: schadenFuer(2) };
  },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    // Ein als Attack zaehlender Effekt unterliegt den Attack-Zaehlern und -Sperren (Berserk-Limit, Knife Throw, Rioting Village …).
    if (!engine.heroKannAngreifen(ctx.cardHeroOwner ?? pi, ctx.cardHeroIdx, pi, { name: CARD_NAME })) return false;
    return hatSendbareAbility(engine, pi);
  },

  // `wdh` = Wiederholung durch Idej Sword – Kunagi („perform that Attack again"): derselbe Schlag mit neuen Kosten, ohne Einmal-Stempel.
  async onHeroEffect(ctx, wdh) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const seite = ctx.cardHeroOwner ?? pi;
    const ps = gs.players[pi];
    if (!ps) return false;
    if (!hatSendbareAbility(engine, pi)) return false;

    // 1) Abilities waehlen und ablegen — mindestens eine, beliebig viele, alle von DEMSELBEN Helden; vor der ersten abbrechbar.
    const festgelegt = { held: null };
    const heldName = () => gs.players[festgelegt.held.physOwner]?.heroes?.[festgelegt.held.heroIdx]?.name || 'that Hero';
    const res = await sendCardsLoop(engine, pi, heroIdx, {
      cardName: CARD_NAME, kinds: ['ability'], min: 1, amount: 0, heroes: quellHelden(engine, pi, festgelegt),
      cancelAtZero: true,
      confirmLabel: '🥷 Send',
      onSent: (ziel) => { if (!festgelegt.held) festgelegt.held = { physOwner: ziel.owner, heroIdx: ziel.heroIdx }; },
      describe: (sent) => sent === 0
        ? `Click an Ability attached to a Hero you permanently control to send it to the discard pile — each Ability adds ${PRO_ABILITY} damage (max ${MAX_SCHADEN}). All Abilities must come from the same Hero.`
        : `Sent ${sent} — currently ${schadenFuer(sent)} damage${sent >= MAX_ABILITIES ? ' (maximum)' : ''}. Click the next Ability of ${heldName()}, or stop here.`,
    });
    if (res.aborted || res.sent === 0) return false;     // nichts abgelegt: der Effekt ist nicht verbraucht

    // 2) Schaden: 50 je gewaehlter Ability, hoechstens 300 — als Attack.
    const damage = schadenFuer(res.sent);
    const { target, negiert } = await engine.heldenEffektZielwahl(ctx, {
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'attack',
      baseDamage: damage,
      title: CARD_NAME,
      description: `Deal ${damage} damage as an Attack (${res.sent} Abilit${res.sent === 1 ? 'y' : 'ies'} × ${PRO_ABILITY}${res.sent > MAX_ABILITIES ? `, max ${MAX_SCHADEN}` : ''}).`,
      confirmLabel: `🥷 Strike! (${damage})`,
      confirmClass: 'btn-danger',
      cancellable: false,        // die Abilities sind schon weg
    });
    engine.log('patty', { player: ps.username, hero: CARD_NAME, sent: res.sent, damage, target: target?.cardName || null });

    // Negierter Treffer: der Effekt bleibt verbraucht und zaehlt als gespielte Attack (Muster Broghan).
    if (negiert) {
      await engine.zaehleAlsArt('attack', { pi, heroIdx, heroOwner: seite, name: CARD_NAME });
      engine.sync();
      return true;
    }
    // Kein Ziel mehr (nichts wahlbar): die Abilities sind bezahlt, der Effekt ist verbraucht.
    if (!target) { engine.sync(); return true; }

    // 3) Wuerfe: ein schwarzer Stern je Ability, in sehr schneller Folge von Patty zum Ziel.
    const sterne = Math.min(res.sent, MAX_STERNE);
    engine._broadcastEvent('play_zone_animation', {
      type: 'patty_shuriken', zoneType: 'board', owner: seite, heroIdx: -1, zoneSlot: -1, duration: ANIM_MS, runde: sterne,
      targets: [{ owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.type === 'hero' ? -1 : target.slotIdx }],
      originOwner: seite, originHeroIdx: heroIdx,
    });
    await engine._delay(STERN_START_MS + (sterne - 1) * STERN_ABSTAND_MS + STERN_FLUG_MS);

    const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi,
      ...(seite !== pi ? { heroOwner: seite } : {}) };      // Brettseite des Angreifers (Styx 28.9.)
    await engine.alsAttackKette({ name: CARD_NAME, pi, heroIdx, heroOwner: seite, ziele: [target],
      wiederhole: () => module.exports.onHeroEffect(ctx, true), resolve: async () => {
        if (target.type === 'hero') {
          const th = gs.players[target.owner]?.heroes?.[target.heroIdx];
          if (th && th.hp > 0) await engine.actionDealDamage(attackSource, th, damage, 'attack');
        } else {
          const inst = target.cardInstance || engine.cardInstances.find(c =>
            c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
          if (inst) await engine.actionDealCreatureDamage(attackSource, inst, damage, 'attack', { sourceOwner: pi, canBeNegated: true });
        }
        return true;
      } });

    engine.sync();
    await engine._delay(400);
    return true;
  },

  /**
   * CPU: Lernkanal zuerst (`_abilityCost` am Prompt); Rueckfall — hoechstens `CPU_MAX_SENDEN` Abilities, die billigsten (Fremdschul-Abilities)
   * zuerst, und nie mehr, als fuer den Deckel noetig sind.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    if (promptData?.config?._abilityCost?.cardName !== CARD_NAME) return undefined;
    // Erste Wahl legt den Helden fest: der mit den meisten Ability-Karten (Stapelhoehe zaehlt), damit sich das Opfer lohnt; bei Gleichstand der erste.
    let vt = promptData.validTargets;
    if (promptData.config._abilityCost.sent === 0 && Array.isArray(vt) && vt.length > 1) {
      const proHeld = new Map();
      for (const t of vt) {
        const k = `${t.owner}:${t.heroIdx}`;
        proHeld.set(k, (proHeld.get(k) || 0) + (t._send?.entry?.level || 1));
      }
      let bestK = null, bestN = -1;
      for (const [k, n] of proHeld) if (n > bestN) { bestK = k; bestN = n; }
      vt = vt.filter(t => `${t.owner}:${t.heroIdx}` === bestK);
    }
    return cpuSendFallback(engine, { ...promptData, validTargets: vt }, {
      wantMore: (st) => st.sent < CPU_MAX_SENDEN && st.sent < MAX_ABILITIES,
    });
  },

  _test: { schadenFuer, PRO_ABILITY, MAX_SCHADEN },
};
