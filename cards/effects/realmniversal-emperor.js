// ═══════════════════════════════════════════
//  CARD EFFECT: „Realmniversal Emperor"
//  Creature (Summoning Magic Lv 3, 100 HP, PP CROSS)
//
//  „When this Creature is defeated, deal 150 damage to all Heroes your
//   opponent controls.
//   You can only use this effect of \"Realmniversal Emperor\" once per
//   turn."
//
//  BAUART
//  ──────
//  • `activeIn: ['support']` — die Engine feuert ON_CREATURE_DEATH
//    NACH dem Ausbuchen aus der Zone, aber VOR dem Umschalten von
//    `inst.zone` und dem Untracken. Das Skript liegt auf der STERBENDEN
//    Instanz und ist zu diesem Zeitpunkt noch in 'support' aktiv.
//    Gilt fuer beide Todeswege (Schadens-Batch und `actionMoveCard`).
//
//  • ★ DIE TODESMELDUNG IST KEINE INSTANZ (Befund 12.9., v933):
//    `ctx.creature` ist ein `deathInfo`-Schnappschuss, die Kennung
//    heisst dort **`instId`**, nicht `id`. Der Selbsttest vergleicht
//    deshalb `(tot.instId ?? tot.id) !== ich.id` — mit `tot.id` waere
//    er immer wahr und die Karte stiege still aus.
//    Der Selbsttest ist zugleich das, was den Hook bei JEDEM fremden
//    Kreaturentod (auch dem eines zweiten Emperors) sofort aussteigen
//    laesst — der Hook feuert fuer alle Zuhoerer, nicht nur fuer den
//    Toten.
//
//  • HARTES ONCE PER TURN (Als Vorgabe 12.9.): „You can only use this
//    effect … once per turn" ist der HARTE Wortlaut, also je SPIELER
//    einmal je Zug, nicht je Instanz. Sterben zwei Emperors derselben
//    Seite in einer Runde, feuert der zweite schlicht nicht mehr —
//    still, ohne Prompt. Umgesetzt mit `engine.claimHOPT(KEY, pi)`
//    (Schluessel `<key>:<pi>`, setzt sich am Zugwechsel selbst zurueck).
//    Die beiden SEITEN haben eigene Zaehler: stirbt je ein Emperor bei
//    beiden Spielern im selben Zug, feuern beide — das ist dieselbe
//    Auslegung wie bei Exploding Skull und Icy Slime.
//    Eine Unterdrueckungs-Marke auf den Geschwistern (wie bei Exploding
//    Skull) braucht es hier NICHT: beide Todeswege laufen die Hooks je
//    Sterbefall sequenziell mit `await` durch, der HOPT-Anspruch des
//    ersten liegt also, bevor der zweite seinen Hook betritt. Und der
//    eigene Schaden trifft nur HELDEN, kann also gar keinen zweiten
//    Emperor in denselben Sterbe-Batch ziehen.
//
//  • Der Anspruch wird ERST NACH der Zielpruefung gestellt: kontrolliert
//    der Gegner keinen lebenden Helden mehr, bleibt das Once-per-turn
//    fuer den Rest des Zuges frei.
//
//  • Flaechenschaden ueber `engine.actionAoeHit` statt einer eigenen
//    Schleife. Der Trichter kann genau das, was der Text verlangt:
//    `side: 'enemy'` entscheidet ueber `heroSideOf` an der SEITE, nicht
//    an der Spalte — ein per Charme oder dauerhafter Uebernahme vom
//    Gegner kontrollierter Held meiner eigenen Spalte gehoert zu „Heroes
//    your opponent controls" und wird getroffen, ein von MIR
//    uebernommener Gegnerheld dagegen nicht (Als Ruling 4.9. zu Flame
//    Avalanche). Dazu Shielded-Filter, Surprise-Fenster, Animation und
//    Schadens-Hooks in einem Durchgang.
//
//  • Schadenstyp `'creature'` — Faustregel der Schadenstabelle: alles,
//    was eine Creature mit ihrem Effekt austeilt. Der Text erklaert den
//    Schlag weder zum Angriff noch zum Zauber.
//
//  • Kein „you may": der Effekt ist verpflichtend, es gibt keinen
//    Prompt und deshalb auch keine `cpuResponse`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Realmniversal Emperor';
const SCHADEN   = 150;
const HOPT_KEY  = 'realmniversal-emperor';

/** Lebende Helden, die der Gegner dieser Seite kontrolliert. */
function gegnerischeHelden(engine, pi) {
  const gs = engine.gs;
  const oi = pi === 0 ? 1 : 0;
  const out = [];
  for (let tpi = 0; tpi < (gs.players || []).length; tpi++) {
    const ps = gs.players[tpi];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      // Seite statt Spalte — dieselbe Entscheidung, die `actionAoeHit`
      // gleich noch einmal trifft. Hier nur, um zu wissen, OB es
      // ueberhaupt etwas zu treffen gibt.
      if (engine.heroSideOf(tpi, hero) !== oi) continue;
      out.push(hero);
    }
  }
  return out;
}

module.exports = {
  activeIn: ['support'],

  cpuMeta: {
    // Der Emperor WILL sterben — das ist sein ganzer Inhalt. `preferDead`
    // haelt die CPU davon ab, Heilung oder Schutz an ihn zu verschwenden
    // (dieselbe Anmeldung wie Exploding Skull und Cute Cat).
    preferDead: true,

    // Massstab (evaluateState): ein Support-Slot ist 30 wert, ab 25 ist
    // das Toeten praktisch wertlos. Exploding Skull steht flach bei 60
    // fuer 80 Schaden auf ALLE Ziele.
    //
    // Hier haengt der Wert am Zustand, deshalb die Funktionsform
    // (Vorbild Bunny Bombs): 150 auf jeden Gegnerhelden sind frueh viel
    // und spaet alles — aber NUR, solange das harte Once-per-turn in
    // diesem Zug noch frei ist. Ist es verbraucht, ist der naechste
    // Emperor als Sterbender exakt nichts wert, und die CPU soll ihn
    // dann auch nicht verheizen.
    onDeathBenefit: (engine, inst) => {
      const pi = inst?.controller ?? inst?.owner;
      if (engine == null || pi == null) return 0;
      if (engine.gs?.hoptUsed?.[`${HOPT_KEY}:${pi}`] === engine.gs.turn) return 0;
      const helden = gegnerischeHelden(engine, pi);
      if (helden.length === 0) return 0;
      const toedlich = helden.filter(h => h.hp <= SCHADEN).length;
      return Math.min(140, 25 * helden.length + 35 * toedlich);
    },
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const engine = ctx._engine;
      const ich = ctx.card;
      const tot = ctx.creature;
      if (!engine || !ich || !tot) return;

      // Nur der EIGENE Tod. `instId`, nicht `id` — siehe Kopf.
      if ((tot.instId ?? tot.id) !== ich.id) return;

      const pi = ich.controller ?? ich.owner;
      if (pi == null) return;

      // Erst pruefen, dann beanspruchen: ohne Ziel bleibt das
      // Once-per-turn fuer diesen Zug frei.
      const ziele = gegnerischeHelden(engine, pi);
      if (ziele.length === 0) return;

      // ★ HARTES ONCE PER TURN je Spieler.
      if (!engine.claimHOPT(HOPT_KEY, pi)) return;

      // ★ Grundregel (CARD_API): ein Effekt, der aus einem HOOK heraus
      // feuert, streamt seine Karte an BEIDE Spieler. Hier gibt es
      // keinen Abbruchpunkt davor — der Effekt ist verpflichtend.
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      const res = await engine.actionAoeHit(ich, {
        damage: SCHADEN,
        damageType: 'creature',
        side: 'enemy',
        types: ['hero'],
        // Eigene Animation (v941, Als Vorgabe): Spiralgalaxie ueber der
        // Heldenkarte, die die Karte selbst verzerrt. Registry-Eintrag
        // `cosmic_distortion` in app-board.jsx, Klang in ZONE_ANIM_SFX,
        // Verzerrung der Karte ueber die Klasse `cosmic-warped`.
        animationType: 'cosmic_distortion',
        // Standard sind 300 ms zwischen Animation und Schaden. Die
        // Verzerrung hat ihren Hoehepunkt erst bei ~480 ms — der Schaden
        // soll fallen, waehrend die Karte verzogen ist, nicht davor.
        animDelay: 520,
        sourceName: CARD_NAME,
      });

      engine.log('realmniversal_blast', {
        player: engine.gs.players[pi]?.username,
        damage: SCHADEN,
        targets: (res?.heroes || []).length || ziele.length,
      });

      engine.sync();
    },
  },
};
