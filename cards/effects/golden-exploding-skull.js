// ═══════════════════════════════════════════
//  CARD EFFECT: „Golden Exploding Skull"
//  Creature (Summoning Magic Lv 1, 1 HP, PP MSAZ)
//
//  „When this Creature is defeated, deal 50 damage to all targets you
//   control. You gain 5 Gold for each target hit by this effect."
//
//  BAUART
//  ──────
//  • Das Gegenstueck zum „Exploding Skull": derselbe Todes-Ausloeser,
//    aber der Schlag geht auf die EIGENE Seite — und zahlt dafuer Gold.
//    Kein Once per turn im Text, also feuert jede Instanz bei jedem
//    eigenen Tod.
//
//  • Ausloeser: `onCreatureDeath` mit Selbsttest ueber `instId` (die
//    Todesmeldung ist eine `deathInfo`, keine Instanz — v933).
//
//  • Flaechenschaden ueber `engine.actionAoeHit(ich, { side: 'own' })`.
//    Der Trichter entscheidet ueber `heroSideOf` an der SEITE, nicht an
//    der Spalte: ein per Charme uebernommener eigener Held zaehlt nicht
//    mehr zu „targets you control", ein uebernommener Gegnerheld schon.
//    Dazu Shielded-Filter, Surprise-Fenster und Schadens-Hooks.
//
//  • ★ DER STERBENDE SCHAEDEL IST KEIN ZIEL. Zum Hook-Zeitpunkt ist der
//    Zonenplatz schon geraeumt, `inst.zone` steht aber noch auf
//    'support' — ohne `creatureFilter` haette der Trichter ihn selbst
//    mitgenommen (und als Treffer gezaehlt).
//
//  • „for each target HIT by this effect": gezaehlt wird, bei wem der
//    Schaden auch ANKOMMT. Gemessen wird das am HP-Stand vor und nach
//    dem Schlag — ein Ziel, dessen Schaden auf 0 reduziert oder
//    abgewehrt wurde (Schild, Immunitaet, Negation), zaehlt nicht.
//    Das ist ehrlicher als die Zielliste des Trichters, die auch
//    geschuetzte Ziele enthaelt.
//
//  • Gold ist ein Gewinn DURCH EINEN EFFEKT (nicht das Rundeneinkommen)
//    — `ctx.gainGold` bucht es entsprechend, `afterResourceGain`-Karten
//    lesen mit.
//
//  • ANIMATION `golden_explosion` (v955, Als Vorgabe): eigene, goldene
//    Explosion mit Muenzregen — nicht die rot-orange `explosion`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Golden Exploding Skull';
const SCHADEN = 50;
const GOLD_JE_TREFFER = 5;

/**
 * Alle eigenen Ziele mit ihrem HP-Stand VOR dem Schlag — Helden und
 * Support-Instanzen, ohne den sterbenden Schaedel selbst.
 *
 * ★ Gemerkt werden die INSTANZEN, nicht nur ihre Kennungen: eine
 * Creature, die am Schlag stirbt, ist beim Nachzaehlen schon aus
 * `cardInstances` entfernt — ueber die Referenz ist ihr HP-Stand
 * trotzdem lesbar, und getroffen war sie ja (Befund im Repro: zwei
 * Schaedel nebeneinander, der zweite starb am ersten und fiel aus der
 * Zaehlung).
 */
function zieleAufnehmen(engine, pi, ausnahmeId) {
  const out = [];
  const heroes = engine.gs.players[pi]?.heroes || [];
  for (let hi = 0; hi < heroes.length; hi++) {
    const h = heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    out.push({ art: 'hero', heroIdx: hi, hp: h.hp });
  }
  for (const inst of engine.cardInstances) {
    if (inst.id === ausnahmeId) continue;
    if ((inst.controller ?? inst.owner) !== pi || inst.zone !== 'support' || inst.faceDown) continue;
    const hp = inst.counters?.currentHp;
    if (!Number.isFinite(hp)) continue;
    out.push({ art: 'creature', inst, hp });
  }
  return out;
}

/** Wie viele davon haben tatsaechlich Schaden genommen? */
function trefferZaehlen(engine, pi, ziele) {
  let treffer = 0;
  for (const z of ziele) {
    if (z.art === 'hero') {
      const h = engine.gs.players[pi]?.heroes?.[z.heroIdx];
      if ((h?.hp ?? z.hp) < z.hp) treffer++;
    } else {
      const jetzt = z.inst?.counters?.currentHp ?? z.hp;
      if (jetzt < z.hp) treffer++;
    }
  }
  return treffer;
}

module.exports = {
  activeIn: ['support'],

  cpuMeta: {
    // Der Schaedel WILL sterben — nur dann zahlt er. Anders als sein
    // roter Bruder trifft er allerdings die eigene Seite: der Gewinn
    // ist das Gold, der Preis sind 50 auf alles Eigene. Deshalb
    // deutlich vorsichtiger bewertet, und der Wert faellt, wenn die
    // eigenen Ziele den Schlag nicht vertragen.
    preferDead: true,
    onDeathBenefit: (engine, inst) => {
      const pi = inst?.controller ?? inst?.owner;
      if (engine == null || pi == null) return 0;
      const heroes = engine.gs?.players?.[pi]?.heroes || [];
      let ziele = 0, knapp = 0;
      for (const h of heroes) {
        if (!h?.name || h.hp <= 0) continue;
        ziele++;
        if (h.hp <= SCHADEN) knapp++;
      }
      for (const c of (engine.cardInstances || [])) {
        if ((c.controller ?? c.owner) !== pi || c.zone !== 'support' || c.id === inst.id) continue;
        ziele++;
        if ((c.counters?.currentHp ?? 999) <= SCHADEN) knapp++;
      }
      // 5 Gold je Treffer sind etwa ein halber Support-Slot wert (30);
      // jedes Ziel, das daran stirbt, frisst den Gewinn wieder auf.
      return Math.max(0, ziele * 12 - knapp * 30);
    },
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const engine = ctx._engine;
      const ich = ctx.card;
      const tot = ctx.creature;
      if (!engine || !ich || !tot) return;
      // ★ Die Todesmeldung ist eine `deathInfo` — Kennung heisst `instId`.
      if ((tot.instId ?? tot.id) !== ich.id) return;

      const pi = ich.controller ?? ich.owner;
      if (pi == null) return;

      // Ohne eigene Ziele passiert nichts — kein Schlag, kein Gold.
      const ziele = zieleAufnehmen(engine, pi, ich.id);
      if (ziele.length === 0) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      const res = await engine.actionAoeHit(ich, {
        damage: SCHADEN,
        damageType: 'creature',
        side: 'own',
        types: ['hero', 'creature'],
        animationType: 'golden_explosion',
        animDelay: 480,
        sourceName: CARD_NAME,
        // ★ Der sterbende Schaedel selbst ist kein Ziel: sein Zonenplatz
        // ist geraeumt, `inst.zone` steht aber noch auf 'support'.
        creatureFilter: (inst) => inst.id !== ich.id,
      });
      if (res?.cancelled) return;

      const treffer = trefferZaehlen(engine, pi, ziele);
      const gold = treffer * GOLD_JE_TREFFER;
      if (gold > 0) await ctx.gainGold(gold);

      engine.log('golden_skull_blast', {
        player: engine.gs.players[pi]?.username,
        damage: SCHADEN, targets: treffer, gold,
      });
      engine.sync();
    },
  },
};
