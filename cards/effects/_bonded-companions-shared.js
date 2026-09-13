// ═══════════════════════════════════════════
//  GEMEINSAME REGELN DER „BONDED COMPANIONS" (v924)
//
//  Vier Kreaturen (Humby, Mellvy, Orphy, Thuly), Lv 0, HP 0,
//  Summoning Magic. Sechs der sieben Saetze auf jeder Karte sind
//  WORTGLEICH — die stehen hier, damit sie an EINER Stelle ausgelegt
//  werden. Jede Karte bringt nur ihren eigenen siebten Satz mit.
//
//  Die gemeinsamen Klauseln und wie sie umgesetzt sind:
//
//   1. „You can only have 1 copy of this card in your deck."
//      → `maxCopies: 1` in cards.json (der Deckbauer liest das Feld).
//
//   2. „A Hero can only have 1 'Bonded Companion' Creature in its
//      Support Zones."
//      → `supportZonesLocked` auf der KARTE. Die Engine fragt seit v924
//        auch die Karten IN der Spalte (nicht mehr nur den Helden), und
//        die Sperrfunktion sieht `opts.cardName` — sie blockt deshalb
//        gezielt nur weitere Bonded Companions, statt die ganze Spalte
//        dichtzumachen.
//
//   3. „This Creature cannot be moved into a different Support Zone in
//      any way after being summoned."
//      → `cannotChangeSupportZone: true` (Puppets-Vertrag v704):
//        `actionMoveCard` blockt Support→Support, Zerstoerung und
//        Ablage bleiben moeglich. Genau das ist gemeint — die Karte
//        SOLL das Brett verlassen koennen (siehe Klausel 6).
//        NICHT `immovable`, das wuerde auch die Zerstoerung blocken.
//
//   4. „This Creature and the corresponding Hero share 1 HP pool."
//      → `sharesHpWithHero: true` (Puppets-Vertrag v704): Schaden an
//        der Kreatur wird auf den Helden derselben Spalte umgebucht,
//        Heilung ebenso. Deshalb stehen HP 0 in der Kartendatenbank —
//        die Kreatur hat gar keinen eigenen Vorrat.
//
//   5. „This Creature is unaffected by cards and effects that can't
//      affect Heroes."
//      → `unaffectedByCreatureOnly: true` (NEU in v924). Die
//        Zielsammler nehmen die Instanz nur dann auf, wenn die Abfrage
//        ueberhaupt Helden treffen koennte (`types` enthaelt `hero`).
//
//   6. „When this Creature leaves the board, defeat the corresponding
//      Hero."
//      → `onCardLeaveZone` unten. Gilt fuer JEDEN Abgang: Zerstoerung,
//        Ablage, Loeschung, Rueckgabe auf die Hand.
//
//  ── WARUM DER ABGANG AM TOKEN HAENGT UND NICHT AM HELDEN ──────────
//  Der Puppets-Archetyp faehrt fuer dieselbe Frage ZWEI Netze
//  (Helden-Hook liest `ctx.leavingCard`, Token-Hook meldet den eigenen
//  Abgang). Hier genuegt das Token-Netz: die Bonded Companions haengen
//  an einem beliebigen Helden, es gibt also keinen festen Partner, der
//  einen eigenen Hook mitbringen koennte.
// ═══════════════════════════════════════════

const PRAEFIX = 'Bonded Companion';

/** Ist dieser Kartenname ein Bonded Companion? */
function istCompanion(name) {
  return typeof name === 'string' && name.startsWith(PRAEFIX);
}

/**
 * Klausel 2 — die Sperre. Wird von der Engine fuer JEDE Karte gefragt,
 * die in diese Spalte will; `opts.cardName` sagt, wer anklopft.
 * Geblockt wird ausschliesslich ein weiterer Bonded Companion.
 */
function companionZonenSperre(engine, pi, heroIdx, opts = {}) {
  if (!istCompanion(opts?.cardName)) return false;
  // Die eigene Instanz darf sich nicht selbst aussperren (Umzug an Ort
  // und Stelle, Wiedereintritt nach einem Tausch).
  const selbst = opts.lockingInstance;
  if (selbst && opts.instId && selbst.id === opts.instId) return false;
  return true;
}

/**
 * Klausel 6 — Abgang vom Brett besiegt den zugehoerigen Helden.
 * `onCardLeaveZone` feuert fuer die Instanz selbst; `ctx.fromZone`
 * sagt, woher sie kam.
 */
async function companionAbgang(ctx) {
  const engine = ctx._engine;

  // ★ NUR DER EIGENE ABGANG (Als Befund 12.9.) ──────────────────────
  // `onCardLeaveZone` feuert fuer JEDE Karte, die irgendwo eine Zone
  // verlaesst — `ctx.card` ist der ZUHOERER, `ctx.leavingCard` die
  // Karte, die wirklich geht. Ohne diesen Vergleich riss der Companion
  // seinen Helden mit, sobald irgendwo auf dem Brett eine Karte eine
  // Support Zone verliess; aufgefallen an Castling auf der GEGNERSEITE.
  // Dieselbe Wache fuehren die Puppet-Tokens (`PUPPET_TOKEN_HOOKS`).
  const ich = ctx.card;
  const geht = ctx.leavingCard || ich;
  if (!ich || geht?.id !== ich.id) return;

  if (ctx.fromZone && ctx.fromZone !== 'support') return;
  // Ein Umzug innerhalb der Support Zones kann nach Klausel 3 gar nicht
  // vorkommen, aber die Wache kostet nichts.
  if (ctx.toZone === 'support') return;

  const pi = ctx.fromOwner ?? ctx.cardOwner;
  const heroIdx = ctx.fromHeroIdx ?? ctx.cardHeroIdx;
  const held = engine?.gs?.players?.[pi]?.heroes?.[heroIdx];
  if (!held?.name || held.hp <= 0) return;

  engine._broadcastEvent('play_zone_animation', {
    type: 'bloody_cut', owner: pi, heroIdx, zoneSlot: -1,
  });
  await engine.actionDefeatHero(
    { name: ctx.cardName, owner: pi, controller: pi, heroIdx },
    held,
    { sourceName: ctx.cardName },
  );
  engine.log('bonded_companion_bond_broken', {
    player: engine.gs.players[pi]?.username,
    companion: ctx.cardName,
    hero: held.name,
  });
  engine.sync();
}

/**
 * Selbst-Highlight beim Ausloesen (Als Befund 12.9.). Creativity blinkt
 * ihre Ability-Zone auf (`ability_activated`); das Gegenstueck fuer eine
 * Karte in der Support Zone ist `effect_source_glow` mit
 * `origin: 'board'` — derselbe Weg, den `puppetGlow` nimmt. Ohne das
 * zieht Orphy drei Karten, und niemand sieht, woher sie kommen.
 */
function companionGlow(engine, inst, sfx = 'ability_activate') {
  if (!engine || !inst) return;
  engine._broadcastEvent('effect_source_glow', {
    playerIdx: inst.controller ?? inst.owner,
    cardName: inst.name, origin: 'board', sfx,
    zone: inst.zone, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
  });
}

/**
 * Baut das gemeinsame Geruest eines Bonded Companion. Jede Karte ruft
 * das auf und legt ihren eigenen siebten Satz als `eigeneHooks` und
 * weitere Felder dazu.
 */
/**
 * Die andere Haelfte des geteilten HP-Pools: stirbt der zugehoerige
 * Held, geht der Companion mit. `sharesHpWithHero` bucht zwar allen
 * Schaden auf den Helden um — aber wenn der auf einem ANDEREN Weg
 * faellt (Insta-Kill, Opferung, Deckout-unabhaengige Effekte), bliebe
 * die Kreatur sonst allein auf dem Brett stehen.
 *
 * Kein Kreislauf: `companionAbgang` steigt aus, sobald der Held schon
 * besiegt ist — und das ist hier per Definition der Fall.
 */
async function companionHeldGefallen(ctx) {
  const engine = ctx._engine;
  const ich = ctx.card;
  if (!ich || ich.zone !== 'support') return;
  const pi = ich.controller ?? ich.owner;
  const gefallen = ctx.hero;
  if (!gefallen?.name) return;
  if (engine?.gs?.players?.[pi]?.heroes?.[ich.heroIdx] !== gefallen) return;

  await engine.actionMoveCard(ich, 'discard', -1, -1, {
    source: ich.name, sourceOwner: pi,
  });
  engine.log('bonded_companion_follows_hero', {
    player: engine.gs.players[pi]?.username,
    companion: ich.name, hero: gefallen.name,
  });
  engine.sync();
}

function companion({ name, eigeneHooks = {}, extras = {} }) {
  return {
    activeIn: ['support'],

    // Klausel 3 und 4 — beides vorhandene Engine-Vertraege.
    cannotChangeSupportZone: true,
    sharesHpWithHero: true,

    // Klausel 5 — neu in v924.
    unaffectedByCreatureOnly: true,

    // Klausel 2.
    supportZonesLocked: companionZonenSperre,

    ...extras,

    hooks: {
      // Klausel 6. Bringt die Karte einen eigenen `onCardLeaveZone`
      // mit, laufen beide — erst die gemeinsame Bindung, dann der
      // eigene Satz.
      onCardLeaveZone: async (ctx) => {
        await companionAbgang(ctx);
        if (typeof eigeneHooks.onCardLeaveZone === 'function') {
          await eigeneHooks.onCardLeaveZone(ctx);
        }
      },
      // Klausel 4, andere Richtung: der Held faellt → der Companion geht mit.
      onHeroKO: async (ctx) => {
        await companionHeldGefallen(ctx);
        if (typeof eigeneHooks.onHeroKO === 'function') await eigeneHooks.onHeroKO(ctx);
      },
      ...Object.fromEntries(
        Object.entries(eigeneHooks).filter(([k]) => k !== 'onCardLeaveZone' && k !== 'onHeroKO'),
      ),
    },
  };
}

module.exports = {
  PRAEFIX,
  istCompanion,
  companionZonenSperre,
  companionAbgang,
  companionHeldGefallen,
  companionGlow,
  companion,
};
