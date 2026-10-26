// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Fists"
//  Artifact (Equipment, Cost 20)
//
//  "Equip this card to a Hero you control. You may once per turn choose
//   as many targets on the board as there are \"Future Tech Fists\" cards
//   in your discard pile and deal damage equal to the equipped Hero's
//   Base Attack stat to them. You can only activate the effect of
//   \"Future Tech Fists\" once per turn."
//
//  ── EXAKT N Ziele (Al, QA-Welle 1 Nr. 19) ──
//  „choose as many targets on the board as there are …" = GENAU N (N = Fists
//  in der eigenen Ablage), nicht „bis zu N". Gibt es weniger WAEHLBARE Ziele
//  als N (Zielschutz, Erstzug-Schutz, leeres Brett …), ist der Effekt nicht
//  aktivierbar (`canActivateEquipEffect` → grau). Die Waehlbarkeit liest der
//  Trockenlauf der Zielwahl (`ctx.promptMultiTarget` → `promptEffectTarget`,
//  `_waehlbarProbe`) — exakt dieselbe Pruefung wie in der echten Wahl.
//  „This counts as an Attack." (Al, QA-Welle 1 Nr. 20): der Schlag ist ein
//  Attack-Schaden (Typ 'attack') des ausgeruesteten HELDEN (Quelle = Held).
//
//  ── Als Ruling (Al 26.10., R-12 „Ja, unbedingt. Das gilt allgemein für *alle* ‚treated as an Attack'-Effekte"): zählt in JEDER Hinsicht als Attack ──
//  Derselbe Weg wie Javelin Throw / Crusader's / Broghan & Co.:
//   • Deklaration `treatedAsAttack: { ability: 'Fighting' }` — Quellstufe = Fighting-Level des Trägers (Glass Wall „level 1 or lower", Test Flight, Escape Device,
//     Stealth, Jetpack, Taunt …), `engine._zaehltAlsArt`/`sourceEffectKind` lesen sie (Challenge, Martyry, Anti-Magnet, Alleria, Bluff, Crimson Web …).
//   • Sperren und Zähler: `heroKannAngreifen` (Frozen/Stunned/Berserk-Limit/Knife Throw/Rioting Village/Mirjam/Idej Sword - Muras …) im Gate; ein Schlag zählt EINMAL
//     als gespielte Attack (`alsAttackKette` → `zaehleAlsArt`: `attacksPlayedThisTurn`, `heroesAttackedThisTurn`, `hero._attacksThisTurn`, `onEffectCountedAsArt`).
//   • Zielwahl über `ctx.promptMultiTarget` mit dem TRÄGER als Quelle (`attackerSourceOverride`): Zielschutz (Butterfly Cloud, Stealth …, Toras: nie mehr als 1 Ziel),
//     Umleitungs-, Surprise- und Hand-Reaktionsfenster (Glass Wall, Frost Rune, Invisibility Cloak, Challenge …) sehen den Helden als Angreifer.
//   • Der Schlag liegt in einer virtuellen Attack-Kette (`alsAttackKette`): Pfeile/Magic Topaz/Bow of the Hunt Goddess reagieren; `_fireAttackDeclare` wird EINMAL für den
//     ganzen Schlag gemeldet (bei genau 1 Ziel mit dem Ziel, sonst mit der Zielliste → „exactly 1 target"-Leser wie Warhorse/Elixir of Strength greifen nur bei 1 Ziel);
//     der danach feststehende Betrag gilt für JEDES Ziel. `afterSpellResolved` (Attack, `_alsEffekt`) feuert danach; Idej Sword - Kunagi kann den Schlag wiederholen (`wiederhole`).
//   • Wird der Schlag im Zielfenster NEGIERT (Surprise, Hand-Reaktion, Schutz-/Redirect-Fenster), ist er verbraucht (Einmal-Stempel bleibt) und zählt als gespielte Attack —
//     wie bei Broghan & Co. (W36a); ein Abbruch durch den Spieler bleibt ein Abbruch.
//
//  ── Der Streuschlag, jetzt aktiv ──
//  [Als Neufassung 21.8.: die erste Version hing an „trifft genau ein
//   Ziel mit einer Attacke" und war dadurch zu schwach — sie brauchte
//   erst einen Angriff, um überhaupt zu wirken.] Jetzt ein eigener
//   aktivierbarer Effekt: einmal pro Zug, so viele Ziele wie Kopien in
//   der Ablage, je der BASIS-Angriff des ausgerüsteten Helden.
//
//  ── Der Vertrag ──
//  `equipEffect` / `canActivateEquipEffect(ctx)` / `onEquipEffect(ctx)`
//  — die Schnittstelle für Ausrüstung mit aktivem Effekt (Beleg
//  `_crusader-shared.js`; `heroEffect` ist die für HELDENkarten und
//  würde nie angeboten). Rückgabe `false` gibt das Einmal-pro-Zug frei.
//
//  ── „Base Attack" ist NICHT `hero.atk` ──
//  `hero.baseAtk` — der gedruckte Wert, unbeeinflusst von Vampiric
//  Sword, Fighting oder sonstigen Buffs. Konvention von Bamboo Staff.
//
//  ── Die Faust ──
//  `punch_impact` mit `metal: true` (Als Vorgabe 21.8.): dieselbe
//  Animation wie bei Aggressive Town Guard, nur silbrig-metallisch
//  eingefärbt. Sie läuft je Ziel und VOR dem Schaden — erst der Schlag,
//  dann die Wirkung.
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Fists';
const HARD_KEY = 'future-tech-fists-hard';   // W13 (Rueckfrage 8)
/** Flugzeit der Faust, bevor der Schaden faellt. */
const FAUST_MS = 400;

/**
 * Konfiguration der Zielwahl (`ctx.promptMultiTarget`): EXAKT `grenze` Ziele (min = max = N), Helden UND Kreaturen beider Seiten, Schadensart 'attack' mit dem Träger als
 * Quelle (`attackerSourceOverride`): Zielschutz und alle Reaktionsfenster sehen einen Attack des Helden (R-12).
 */
function zielKonfig(grenze, atk, quelle) {
  return {
    types: ['hero', 'creature'],
    side: 'any',
    title: CARD_NAME,
    description: `Choose ${grenze} target${grenze !== 1 ? 's' : ''} — each takes ${atk} damage. This counts as an Attack.`,
    confirmLabel: '👊 Strike!',
    confirmClass: 'btn-danger',
    min: grenze,
    max: grenze,
    baseDamage: atk,
    damageType: 'attack',
    attackerSourceOverride: quelle,
    cancellable: true,
    noSpellCancel: true,   // Ausruestungs-Effekt, kein Spell
  };
}

/** Quellobjekt des Schlags: der TRAEGER (Held), nicht die Ausruestungs-Instanz (Muster Crusader's/Javelin Throw). `feld` = Brettseite des Helden, `pi` = Kontrolleur. */
function schlagQuelle(pi, feld, heroIdx) {
  return { name: CARD_NAME, owner: pi, controller: pi, heroOwner: feld, heroIdx };
}

/** Wie viele Ziele muss die Wahl liefern? N — hoechstens 1, wenn der Traeger nie mehr als 1 Ziel mit einer Attack treffen darf (Toras: `singleTargetAttack`). */
function waehlGrenze(engine, feld, heroIdx, n) {
  const f = engine.heroFlagsLive?.(feld, heroIdx);
  return (f?.singleTargetAttack || f?.forcesSingleTargetAny) ? Math.min(n, 1) : n;
}

/**
 * Wie viele Ziele sind gerade WAEHLBAR? Trockenlauf der echten Zielwahl (`_waehlbarProbe`, ohne Frage, synchron): Zielschutz, Taunt, Erstzug-Schutz usw. zaehlen genau wie dort.
 * Ohne Probe-Ergebnis (nichts uebrig): 0.
 */
function waehlbareZiele(ctx, grenze, atk, quelle) {
  const probe = { ids: null };
  const p = ctx.promptMultiTarget({ ...zielKonfig(grenze, atk, quelle), _waehlbarProbe: probe });
  if (p && typeof p.catch === 'function') p.catch(() => {});
  return Array.isArray(probe.ids) ? probe.ids.length : 0;
}

module.exports = {

  // ★ R-12 (Al 26.10.): „This counts as an Attack." — Leser der Quellstufe und der Art (Glass Wall, Test Flight, Escape Device, Stealth, Jetpack, Taunt, Challenge …) fragen
  // `_heldenEffektStufe`/`_zaehltAlsArt`: die Quellstufe ist das FIGHTING-LEVEL des Trägers (allgemeine Regel „Zählt als Attack eines Helden = Ability-Level dieses Helden", W32a).
  treatedAsAttack: { ability: 'Fighting' },

  /**
   * „Equip this card to a Hero you control." — Seitenbindung, siehe
   * `equipOwnSideOnly` in CARD_API.md. Ohne die Fahne gilt die
   * Hausvorgabe „Ausruestung darf an beide Seiten" (Al, 5.9.: der
   * Kartentext ist bindend).
   */
  equipOwnSideOnly: true,
  activeIn: ['support'],
  equipEffect: true,

  canActivateEquipEffect(ctx) {
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const engine = ctx._engine;
    const gs = engine.gs;
    // Styx 28.9.: Ablage = Kontrolleur (`cardOwner`), Held = Brettseite.
    const pi = ctx.cardOwner ?? (inst.controller ?? inst.owner);
    const grenze0 = zaehleInAblage(gs, pi, CARD_NAME);
    if (grenze0 <= 0) return false;
    // W13 (Al, Rueckfrage 8): „You can only activate the effect of "Future Tech Fists" once per turn" = hard once per turn, ein Stempel je Spieler fuer alle Kopien.
    if (gs.hoptUsed?.[`${HARD_KEY}:${pi}`] === gs.turn) return false;
    const feld = ctx.cardHeroOwner ?? (inst.controller ?? inst.owner);   // Brettseite des Helden
    const hero = gs.players[feld]?.heroes?.[inst.heroIdx];
    if (!(!!hero?.name && hero.hp > 0 && (hero.baseAtk || 0) > 0)) return false;
    // R-12 (Al 26.10.): „This counts as an Attack" — unterliegt den Attack-Sperren und -Zaehlern des Traegers (Frozen/Stunned/Webbed, Berserk-Limit, Knife Throw, Rioting Village, Mirjam, Muras …).
    if (!engine.heroKannAngreifen(feld, inst.heroIdx, pi, { name: CARD_NAME })) return false;
    // Al, QA-Welle 1 Nr. 19: EXAKT N Ziele — weniger waehlbare Ziele als N → nicht aktivierbar (grau).
    const grenze = waehlGrenze(engine, feld, inst.heroIdx, grenze0);
    return waehlbareZiele(ctx, grenze, hero.baseAtk || 0, schlagQuelle(pi, feld, inst.heroIdx)) >= grenze;
  },

  // `wdh` = Wiederholung durch Idej Sword - Kunagi („perform that Attack again against a different target your opponent controls"): derselbe Schlag, neue Zielwahl (nur Gegnerziele,
  // `gs._kunagiWdh`), Einmal-Stempel/Aktion unberuehrt. Fehlen die waehlbaren Ziele, findet die Wiederholung nicht statt.
  async onEquipEffect(ctx, wdh) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    // Styx 28.9.: „you" = Kontrolleur (`cardOwner`), Held = Brettseite (`feld`).
    const feld = ctx.cardHeroOwner ?? (inst.controller ?? inst.owner);
    const pi = ctx.cardOwner ?? (inst.controller ?? inst.owner);
    const heroIdx = inst.heroIdx;
    const hero = gs.players[feld]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const grenze0 = zaehleInAblage(gs, pi, CARD_NAME);
    if (grenze0 <= 0) return false;
    const atk = hero.baseAtk || 0;                 // BASIS-Angriff
    if (atk <= 0) return false;
    // R-12: der Traeger muss angreifen koennen (siehe `canActivateEquipEffect`; hier erneut: zwischen Gate und Wahl kann sich etwas geaendert haben).
    if (!engine.heroKannAngreifen(feld, heroIdx, pi, { name: CARD_NAME })) return false;

    const quelle = schlagQuelle(pi, feld, heroIdx);
    const grenze = waehlGrenze(engine, feld, heroIdx, grenze0);
    // Exakt N (Al, QA-Welle 1 Nr. 19): gibt es weniger waehlbare Ziele als N, wirkt der Effekt nicht (Sperre bleibt frei).
    if (waehlbareZiele(ctx, grenze, atk, quelle) < grenze) return false;

    // ★ R-12: Zielwahl als Attack des Traegers (`promptMultiTarget` mit `attackerSourceOverride`): Zielschutz, Umleitung, Surprises (Glass Wall …) und Hand-Reaktionen laufen hier.
    // Negierung im Zielfenster (`negiert`) ≠ Abbruch: der Effekt ist verbraucht und zaehlt als gespielte Attack (W36a, wie Broghan & Co.).
    const { target: ziele, negiert } = await engine.heldenEffektZielwahl(ctx, zielKonfig(grenze, atk, quelle), { mehrfach: true });
    if (negiert) {
      if (!wdh && !engine.claimHOPT(HARD_KEY, pi)) return false;
      await engine.zaehleAlsArt('attack', { pi, heroIdx, heroOwner: feld, name: CARD_NAME });
      engine.sync();
      return true;
    }
    if (!Array.isArray(ziele) || ziele.length === 0) return false;   // Abbruch gibt die Sperre frei
    if (!wdh && !engine.claimHOPT(HARD_KEY, pi)) return false;        // W13 (Rueckfrage 8): Hard-Stempel erst nach der Zusage

    // ★ R-12: der Schlag zaehlt als Attack des Traegers — virtuelle Attack-Kette (Pfeile, Magic Topaz, Bow of the Hunt Goddess, Attack-Reaktionen), Attack-Zaehler (`zaehleAlsArt`),
    // Schadensprotokoll (`ziele`: Leser „exactly 1 target") und `afterSpellResolved` (Attack) danach. EIN Quellobjekt fuer alle Treffer — Reaktionen und die
    // Effekt-Immunitaet sehen den Streuschlag als EINEN Vorgang.
    const kette = await engine.alsAttackKette({ name: CARD_NAME, pi, heroIdx, heroOwner: feld, ziele, wiederhole: () => module.exports.onEquipEffect(ctx, true), resolve: async () => {
      // „When a Hero performs/hits with an Attack"-Fenster (`onAttackDeclare`): EINMAL fuer den ganzen Schlag, VOR den Animationen. Bei genau einem Ziel mit dem Ziel selbst,
      // sonst mit der Zielliste (Mehrfach-Attack, wie Whirlwind Strike). Der Betrag danach (Boni der Lauscher) gilt fuer jedes Ziel.
      const schaden = await engine._fireAttackDeclare(quelle, ziele.length === 1 ? ziele[0] : ziele, atk);

      // ★ v1061 („Interference", Als Rulings 14.9.): EIN Einsatz, mehrere
      // Ziele — das ist ein Flaechenschlag. Die Klammer nimmt die ECHTE
      // gewaehlte Zielmenge; bei einem einzigen Ziel bleibt es ein
      // Einzeltreffer und der Schutz greift korrekt nicht.
      // ★★ v1185: Klammer meldet zusaetzlich die Kreaturen des Streuschlags
      // an das Anti-AoE-Fenster (Deepsea Idol).
      await engine.beginAoeStrike(ziele.length, {
        creatures: ziele.filter(z => z && z.type !== 'hero').map(z => z.cardInstance).filter(Boolean),
        source: quelle, amount: schaden, type: 'attack', sourceOwner: pi,
      });
      try {
        for (const ziel of ziele) {
          if (!ziel) continue;

          // Silbrige Faust — erst der Schlag, dann die Wirkung.
          engine._broadcastEvent('punch_impact', {
            owner: ziel.owner, heroIdx: ziel.heroIdx,
            zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
            metal: true,
          });
          await engine._delay(FAUST_MS);

          if (ziel.type === 'hero') {
            const th = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
            if (th?.name && th.hp > 0) {
              await engine.actionDealDamage(quelle, th, schaden, 'attack');
            }
          } else if (ziel.cardInstance) {
            await engine.actionDealCreatureDamage(
              quelle, ziel.cardInstance, schaden, 'attack',
              { sourceOwner: pi, canBeNegated: true },
            );
          }
        }
      } finally { await engine.endMultiHit(); }
      return true;
    } });

    // Negiert/verpufft die Kette den Schlag (Reaktion auf die Attack), ist er verbraucht und gezaehlt, hat aber nichts getroffen.
    engine.log('ft_fists', {
      player: gs.players[pi]?.username, hits: (kette?.negated || kette?.fizzled) ? 0 : ziele.length,
      damage: atk, max: grenze,
    });
    engine.sync();
    return true;
  },
};
