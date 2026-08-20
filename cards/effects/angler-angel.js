// ═══════════════════════════════════════════
//  CARD EFFECT: "Angler Angel"
//  Creature (Summoning Magic Lv0, Normal) — 50 HP, kein ATK.
//
//  EFFECT (per cards.json):
//   "All damage your other Creatures inflict with their effects is
//    increased by 50."
//
//  ── ALS RULING 20.8. — NUR DIE ERSTE SCHADENSINSTANZ ──────────────
//  „Angler erhoeht nur die erste Schadens-Instanz jeder Creature.
//   Das heisst, dass z.B. ein Elven Leader oder 3-Headed Giant nur
//   mit dem ersten Schlag extra Schaden zufuegt. Gangsters Schaden
//   wird aber alles auf einmal zugefuegt, waere also komplett
//   erhoeht."
//
//  Daraus folgen zwei Aussagen, die zusammen die ganze Karte sind:
//
//   ① EIN Bonus je Kreatur JE ZUG. 3-Headed Giant darf dreimal pro
//     Zug feuern — nur der erste Schuss traegt die +50. Der Merker
//     ist die normale Rundensperre der Engine
//     (`claimHOPT('angler-boost:<instId>', pi)`), die sich mit dem
//     Zugwechsel von selbst wieder oeffnet.
//
//   ② Was GLEICHZEITIG faellt, ist EINE Instanz — und damit
//     vollstaendig erhoeht. Woran erkennt man „gleichzeitig"?
//     An der QUELLE:
//
//       · Ein Flaechenschlag baut EIN Quellobjekt und reicht es an
//         jeden Treffer weiter (`const source = {...}` und dann die
//         Schleife) — so machen es Exploding Skull, Carpet Bomblebee,
//         The Spawn Mother und auch Gangster Angel. Alle Treffer
//         teilen also dieselbe Objekt-IDENTITAET.
//       · Sequenzielle Treffer bauen je Schlag ein FRISCHES Objekt
//         (Elven Leader, 3-Headed Giant) oder schicken die
//         CardInstance selbst (`ctx.dealDamage` reicht `cardInstance`
//         durch) — dann greift die Gruppierung bewusst NICHT.
//
//     Dieselbe Annahme benutzt die Engine bereits selbst: die
//     `onAttackDeclare`-Nachzuendung im Stapelpfad gruppiert Eintraege
//     ueber `e.source !== src`, also ueber genau diese Identitaet.
//
//     Der Stapelpfad (`beforeCreatureDamageBatch`) braucht die
//     Kennzeichnung gar nicht: ein Stapel IST per Definition
//     gleichzeitig. Dort werden Eintraege mit derselben Quelle
//     zusammengefasst, egal welcher Art das Quellobjekt ist.
//
//  ── Zwei Hooks, weil es zwei Schadenswege gibt ────────────────────
//  Helden laufen ueber `beforeDamage`, Kreaturen ueber
//  `beforeCreatureDamageBatch` — dasselbe Paar wie bei Minocrete War
//  Counselor, an dem sich dieses Modul orientiert.
//
//  ── Stapeln zweier Angler ─────────────────────────────────────────
//  Die Karte ist kein Singleton, zwei Exemplare geben also +100. Damit
//  das mit der Rundensperre zusammengeht, wird die ENTSCHEIDUNG
//  („darf diese Instanz erhoeht werden?") einmal getroffen und am
//  Hook-Kontext bzw. am Stapel-Eintrag vermerkt; jeder Angler liest
//  sie und legt seine eigenen +50 drauf. Ohne das haette der zweite
//  Angler die bereits verbrauchte Sperre gesehen und nichts getan.
//
//  ── Was NICHT erhoeht wird ────────────────────────────────────────
//  · Schaden des Anglers selbst („other Creatures").
//  · Schaden gegnerischer Kreaturen.
//  · Statusschaden (Brand-/Gift-Ticks) — das ist kein Schaden, den die
//    Kreatur „mit ihrem Effekt zufuegt", sondern ein wiederkehrender
//    Tick. Die Engine schreibt solche Ticks ohnehin `Burn`/`Poison` als
//    Quelle zu; der Ausschluss ist der Guertel dazu.
//  · Schaden, der AUSDRUECKLICH als Angriff eines Helden faellt
//    (`type: 'attack'`, Infected Greatmaw) — dort ist der Held die
//    Quelle, nicht die Kreatur.
//  · Ein Treffer mit 0 Schaden verbraucht die Rundensperre nicht.
//
//  ── KORREKTUR v519 (Als Befund: Aggressive Town Guard) ────────────
//  Bis v518 filterte dieses Modul auf `type === 'creature'`. Das ist
//  zwar die haeufigste Kennung (44 Kreaturmodule), aber eben NICHT die
//  einzige: 12 Module schicken `other`, 4 schicken `normal` (darunter
//  Aggressive Town Guard) und 2 `destruction_spell`. Die Aura griff
//  also bei einem Fuenftel der Kreaturen nicht.
//
//  Der Schadenstyp ist damit als Erkennungsmerkmal untauglich. Die
//  tragende Pruefung ist ohnehin die QUELLE: steht im Kartenkatalog
//  eine Creature unter meiner Kontrolle? Statt einer Positivliste
//  steht jetzt eine kurze AUSSCHLUSSLISTE dagegen — so faellt eine
//  kuenftige Kreatur mit einem neuen Typ nicht wieder durchs Raster.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Angler Angel';
const BONUS = 50;
/**
 * Schadensarten, die NICHT „mit ihrem Effekt zugefuegt" sind.
 * Bewusst eine Ausschluss- statt einer Positivliste — siehe Kopf.
 */
const KEIN_EFFEKTSCHADEN = new Set(['attack', 'poison', 'fire', 'burn', 'status']);

/**
 * Ist das Quellobjekt eine langlebige CardInstance (so reicht
 * `ctx.dealDamage` die Karte selbst durch) statt eines pro Schlag
 * gebauten Literals? Nur Literale duerfen als „gleichzeitig"
 * gruppiert werden — eine CardInstance lebt das ganze Spiel und
 * wuerde jeden spaeteren Schlag derselben Kreatur mitziehen.
 */
function istInstanzObjekt(quelle) {
  return !!(quelle && typeof quelle.id === 'string' && typeof quelle.zone === 'string');
}

/** Die Kreatur hinter einer Schadensquelle finden (fuer den Zaehlschluessel). */
function quellKreatur(engine, quelle) {
  if (!quelle) return null;
  if (istInstanzObjekt(quelle)) return quelle;
  if (quelle.cardInstance?.id) return quelle.cardInstance;
  const besitzer = quelle.owner ?? quelle.controller;
  if (!Number.isInteger(besitzer)) return null;
  return (engine.cardInstances || []).find(c =>
    c.zone === 'support' && !c.faceDown && c.name === quelle.name
    && (c.controller ?? c.owner) === besitzer
    && (quelle.heroIdx == null || quelle.heroIdx < 0 || c.heroIdx === quelle.heroIdx)
  ) || null;
}

/**
 * Schluessel der Rundensperre. Bevorzugt die Instanz-Id, damit zwei
 * Exemplare derselben Kreatur getrennte Budgets haben; ist die Kreatur
 * nicht mehr auffindbar (Todes-Trigger wie Exploding Skull, der seinen
 * Schaden aus dem Jenseits austeilt), traegt der Name den Schluessel.
 */
function budgetSchluessel(engine, quelle) {
  const inst = quellKreatur(engine, quelle);
  if (inst?.id) return `angler-boost:${inst.id}`;
  const besitzer = quelle?.owner ?? quelle?.controller ?? -1;
  return `angler-boost:${besitzer}:${quelle?.heroIdx ?? -1}:${quelle?.name || '?'}`;
}

/** Stammt der Schaden von einer ANDEREN Kreatur unter meiner Kontrolle? */
function vonAndererEigenerKreatur(engine, quelle, pi, selbstId) {
  if (!quelle?.name) return false;
  const besitzer = quelle.owner ?? quelle.controller ?? -1;
  if (besitzer !== pi) return false;
  const cd = engine._getCardDB()[quelle.name];
  if (!cd || !hasCardType(cd, 'Creature')) return false;
  const inst = quellKreatur(engine, quelle);
  if (inst?.id && selbstId && inst.id === selbstId) return false;   // „other"
  // Kein Instanzfund (Todes-Trigger): der Name genuegt, um sich
  // selbst auszuschliessen.
  if (!inst && quelle.name === CARD_NAME) return false;
  return true;
}

/**
 * Die eigentliche Regel. Wird pro Schadensvorgang GENAU EINMAL
 * entschieden und am Traeger (Hook-Kontext bzw. Stapel-Eintrag)
 * vermerkt, damit ein zweiter Angler dieselbe Entscheidung liest,
 * statt die Rundensperre erneut zu befragen.
 *
 * @param traeger  Hook-Kontext (Held) oder Stapel-Eintrag (Kreatur)
 */
function darfErhoehen(engine, traeger, quelle, pi) {
  if (traeger._anglerEntscheidung !== undefined) return traeger._anglerEntscheidung;

  const turn = engine.gs.turn;
  let erlaubt;
  if (!istInstanzObjekt(quelle) && quelle._anglerInstanz === turn) {
    // Weiterer Treffer DERSELBEN gleichzeitigen Instanz.
    erlaubt = true;
  } else if (engine.claimHOPT(budgetSchluessel(engine, quelle), pi)) {
    erlaubt = true;
    // Nur Literale markieren — siehe `istInstanzObjekt`.
    if (!istInstanzObjekt(quelle)) quelle._anglerInstanz = turn;
  } else {
    erlaubt = false;
  }

  traeger._anglerEntscheidung = erlaubt;
  return erlaubt;
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    /** Heldenschaden anderer eigener Kreaturen erhoehen. */
    beforeDamage: (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      if (KEIN_EFFEKTSCHADEN.has(ctx.type)) return;
      if (!(ctx.amount > 0)) return;                 // 0 verbraucht nichts
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      if (!vonAndererEigenerKreatur(engine, ctx.source, pi, inst.id)) return;
      if (!darfErhoehen(engine, ctx, ctx.source, pi)) return;

      const neu = ctx.amount + BONUS;
      ctx.setAmount(neu);
      engine.log('angler_boost', {
        player: engine.gs.players[pi]?.username,
        source: ctx.source?.name, target: ctx.target?.name,
        bonus: BONUS, newAmount: neu,
      });
    },

    /**
     * Kreaturenschaden (Stapelpfad). Ein Stapel ist per Definition
     * gleichzeitig: Eintraege mit derselben Quelle teilen sich hier
     * eine Entscheidung, unabhaengig von der Art des Quellobjekts.
     */
    beforeCreatureDamageBatch: (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const proQuelle = new Map();

      for (const e of (ctx.entries || [])) {
        if (e.cancelled) continue;
        if (e.isStatusDamage) continue;                // Brand-/Gift-Tick
        if (KEIN_EFFEKTSCHADEN.has(e.type)) continue;
        if (!(e.amount > 0)) continue;
        if (!vonAndererEigenerKreatur(engine, e.source, pi, inst.id)) continue;

        // Erster Eintrag dieser Quelle entscheidet fuer den ganzen Stapel.
        let erlaubt = proQuelle.get(e.source);
        if (erlaubt === undefined) {
          erlaubt = darfErhoehen(engine, e, e.source, pi);
          proQuelle.set(e.source, erlaubt);
        } else if (e._anglerEntscheidung === undefined) {
          e._anglerEntscheidung = erlaubt;
        }
        if (!erlaubt) continue;

        e.amount += BONUS;
        engine.log('angler_boost', {
          player: engine.gs.players[pi]?.username,
          source: e.source?.name, target: e.inst?.name,
          bonus: BONUS, newAmount: e.amount,
        });
      }
    },
  },
};
