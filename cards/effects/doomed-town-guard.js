// ═══════════════════════════════════════════
//  CARD EFFECT: "Doomed Town Guard"
//  Creature (Summoning Magic Lv0, 20 HP, subtype Reaction)
//
//  „Immediately summon this Creature when one or more targets you
//   control are defeated by an opponent's card or effect. Your opponent
//   can't choose other Creatures you control. At the end of your turn,
//   this Creature is defeated."
//
//  DREI TEILE
//
//   • AUSLOESER (Hand): jedes ZIEL zaehlt — Held ODER Creature. Deshalb
//     haengt die Karte an BEIDEN Tod-Fenstern: `onCreatureDeath` und
//     `onHeroKO`. Bedingung ist in beiden Faellen dieselbe: das Opfer
//     gehoert MIR, die Quelle dem Gegner. Eigene Opferungen, Recoil und
//     Statusschaden ohne Verursacher loesen also nicht aus.
//     Gebaut wie „Chaorc Rider Warg" (das einzige andere Reaction-
//     Creature-Muster im Bestand): Bestaetigung, dann Zonenwahl, dann
//     `summonCreatureWithHooks`. BEWUSST KEIN `isReaction: true` — das
//     meldet eine Karte im generischen Kettenfenster bei JEDEM
//     Kartenspiel als spielbar (Lehre aus Pawn Chain, v830); der
//     Auslaeser hier ist der eigene Hook.
//     „one or more" heisst: auch bei einem Mehrfachtod feuert die Karte
//     EINMAL. Der Riegel `_dtgSummonedForDeath` klammert das ganze
//     Sterbe-Ereignis.
//
//   • SCHUTZSCHIRM (Support): setzt den generischen Taunt der Engine mit
//     dem v849-Zusatz `forcesTargeting_creaturesOnly` — der Gegner kann
//     meine ANDEREN Creatures nicht mehr waehlen, meine Helden dagegen
//     sehr wohl. Kein eigenes Filterwerk: die eine Auslegungsstelle ist
//     `_applyForcesTargetingFilter` in `_engine.js`.
//     `forcesTargeting_pi` bleibt bewusst LEER — der Schirm gilt gegen
//     jeden Gegner, nicht nur gegen den, der gerade getoetet hat; und
//     `_untilTurn` bleibt leer, weil die Karte ohnehin am Zugende stirbt.
//
//   • ABLAUF (Support): `onTurnEnd` auf der EIGENEN Seite — die Karte
//     wird regulaer besiegt (`actionDestroyCard`), nicht still entfernt.
//     Damit fliegt sie sichtbar in die Ablage und alle Tod-Effekte
//     (eigene wie fremde) feuern wie bei jedem anderen Tod.
// ═══════════════════════════════════════════

const CARD_NAME = 'Doomed Town Guard';

/**
 * Support-Zonen, in die dieser Spieler den Wachposten JETZT beschwoeren
 * duerfte. Wie bei Chaorc Rider Warg ist das eine echte Beschwoerung aus
 * der Hand, also gilt das volle Gatter aus `_canHeroActivateSurprise`:
 * lebender, nicht eingefrorener/betaeubter/negierter Held, der die Karte
 * ueberhaupt einsetzen darf (Level 0 → jeder Held), plus freie Zone.
 */
function summonableZones(engine, pi) {
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

/**
 * Gemeinsamer Weg fuer beide Tod-Fenster: fragen, Zone waehlen,
 * beschwoeren. `opferName` dient nur der Prompt-Zeile.
 */
async function reagiereAufTod(ctx, opferName) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardController ?? ctx.cardOwner;
  const ps = gs.players[pi];
  if (!ps || !(ps.hand || []).includes(CARD_NAME)) return;

  // „one or more targets": ein Mehrfachtod (Flaechenschaden) darf die
  // Karte nur EINMAL bringen. Die Klammer haengt am Spielerzustand und
  // wird beim naechsten Zugbeginn geloest.
  if (ps._dtgSummonedForDeath === gs.turn) return;

  let zones = summonableZones(engine, pi);
  if (zones.length === 0) return;

  const confirmed = await engine.promptGeneric(pi, {
    type: 'confirm',
    title: CARD_NAME,
    message: `${opferName} was defeated! Summon ${CARD_NAME} from your hand? Your opponent can't choose your other Creatures while it stands.`,
    showCard: CARD_NAME,
    confirmLabel: '🛡️ Summon!',
    cancelLabel: 'No',
    cancellable: true,
  });
  if (!confirmed) return;

  // Nach dem Prompt neu pruefen — waehrend der Spieler ueberlegt, kann
  // sich das Brett geaendert haben (Kettenreaktionen).
  if (!(ps.hand || []).includes(CARD_NAME)) return;
  if (ps._dtgSummonedForDeath === gs.turn) return;
  zones = summonableZones(engine, pi);
  if (zones.length === 0) return;

  let dest = zones[0];
  if (zones.length > 1) {
    const pick = await engine.promptGeneric(pi, {
      type: 'zonePick',
      title: CARD_NAME,
      description: `Summon ${CARD_NAME} into which Support Zone?`,
      zones,
      cancellable: true,
    });
    if (!pick || pick.cancelled) return;
    dest = { heroIdx: pick.heroIdx, slotIdx: pick.slotIdx };
  }

  // ★ Grundregel (CARD_API): ein Effekt, der sich aus einem Hook heraus
  // aktiviert, streamt seine Karte an BEIDE Spieler — erst NACH dem Ja,
  // damit ein abgelehnter Trigger nichts zeigt.
  await engine.showTriggeredEffect(CARD_NAME, {
    playerIdx: pi,
    source: `dtg:${gs.turn}:${opferName}`,
  });

  const handIdx = ps.hand.indexOf(CARD_NAME);
  ps.hand.splice(handIdx, 1);
  const res = await engine.summonCreatureWithHooks(
    CARD_NAME, pi, dest.heroIdx, dest.slotIdx, { source: CARD_NAME },
  );
  if (!res?.inst) { ps.hand.push(CARD_NAME); return; }

  ps._dtgSummonedForDeath = gs.turn;
  setzeSchutzschirm(engine, res.inst);
  engine.log('doomed_town_guard_summon', { player: ps.username, defeated: opferName });
  engine.sync();
}

/**
 * Der Schutzschirm. `counters.forcesTargeting` ist der funktionale
 * Schalter, den `_applyForcesTargetingFilter` liest; die Spiegelung nach
 * `counters.buffs` ist reine Anzeige (BuffColumn zeichnet das Abzeichen).
 */
function setzeSchutzschirm(engine, inst) {
  if (!inst) return;
  const c = inst.counters || (inst.counters = {});
  c.forcesTargeting = true;
  c.forcesTargeting_creaturesOnly = true;
  c.buffs = c.buffs || {};
  c.buffs.forcesTargeting_creaturesOnly = true;
}

module.exports = {
  activeIn: ['hand', 'support'],

  // CPU: beide Prompts sind fuer sie immer gut — der Wachposten kostet
  // keine Aktion, schirmt ihre Creatures ab und ist ohnehin nur diesen
  // einen Zug da. Ohne diesen Eintrag lehnt der generische Responder
  // abbrechbare Prompts pauschal ab (Barker-Bugklasse).
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: true };
    if (promptData?.type === 'zonePick') {
      const z = (promptData.zones || [])[0];
      return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx } : undefined;
    }
    return undefined;
  },

  hooks: {
    // ── Ausloeser A: eigene Creature stirbt durch den Gegner ─────────
    onCreatureDeath: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const death = ctx.creature;
      if (!death) return;
      if ((death.controller ?? death.owner) !== pi) return;
      const srcOwner = ctx.source?.owner ?? ctx.source?.controller;
      if (srcOwner == null || srcOwner === pi) return;
      await reagiereAufTod(ctx, death.name);
    },

    // ── Ausloeser B: eigener Held stirbt durch den Gegner ────────────
    // „targets you control" schliesst Helden ein — deshalb dasselbe
    // Fenster ein zweites Mal, nur mit der Heldenpruefung davor.
    onHeroKO: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      const engine = ctx._engine;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const hero = ctx.hero;
      if (!hero?.name) return;
      const heroes = engine.gs.players?.[pi]?.heroes || [];
      if (heroes.indexOf(hero) < 0) return;          // nur eigene Helden
      const srcOwner = ctx.source?.owner ?? ctx.source?.controller;
      if (srcOwner == null || srcOwner === pi) return;
      await reagiereAufTod(ctx, hero.name);
    },

    // ── Schutzschirm nach Wiederbelebung / Umzug neu setzen ──────────
    // Kommt der Wachposten ueber einen fremden Effekt aufs Brett
    // (Elixir of Immortality, Zombified Assault), traegt die frische
    // Instanz die Zaehler nicht. Der Schirm gehoert zur Karte, nicht zur
    // Beschwoerungsart — also hier nachziehen.
    onCardEnterZone: async (ctx) => {
      if (ctx.enteringCard?.id !== ctx.card.id) return;
      if (ctx.toZone !== 'support') return;
      setzeSchutzschirm(ctx._engine, ctx.card);
    },

    // ── Ablauf: am Ende des EIGENEN Zuges besiegt ────────────────────
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const owner = inst.controller ?? inst.owner;
      if (engine.gs.activePlayer !== owner) return;
      engine.log('doomed_town_guard_expires', {
        player: engine.gs.players[owner]?.username,
      });
      await engine.actionDestroyCard({ name: CARD_NAME, owner, controller: owner }, inst);
      engine.sync();
    },

    // Klammer je Sterbe-Ereignis loesen (siehe reagiereAufTod).
    onTurnStart: async (ctx) => {
      const ps = ctx._engine.gs.players[ctx.cardController ?? ctx.cardOwner];
      if (ps) delete ps._dtgSummonedForDeath;
    },
  },

  cpuMeta: {
    // Schirm fuer die eigenen Creatures — die CPU soll ihn nicht als
    // wertlosen 20-HP-Koerper abtun.
    protectsCreatures: true,
  },
};
