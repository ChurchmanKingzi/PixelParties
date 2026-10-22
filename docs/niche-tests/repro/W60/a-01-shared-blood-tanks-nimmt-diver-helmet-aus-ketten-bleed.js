'use strict';
// W60a: Shared Blood Tanks vs. Diver Helmet.
//   Diver Helmet: „The equipped Hero and all cards in its Support Zones are unaffected by Areas." (CARD_API „Areas — respect Diver Helmet", Pflichtregel)
//   Shared Blood Tanks: „… Whenever a target takes Bleed damage, except from this effect, all other Bleeding targets its owner controls also take Bleed damage."
//   Auslegung (wie Rioting Village, W59a): die Area wirkt auf einen Helden mit Helm und auf alle Karten in dessen Support Zones NICHT —
//     (a) der Ketten-Bleed-Schaden trifft sie nicht, (b) sie lösen die Kette auch nicht aus (für diese Area sind sie nicht vorhanden).
//     Ihr EIGENER Bleed-Tick (Engine, nach der Handlung) bleibt unverändert: er ist keine Wirkung der Area.
//   Vor W60a: Held/Kreaturen mit Helm wurden von der Kette getroffen und lösten sie aus (auf dem alten Stand rot).
// (A) Gegenprobe ohne Helm  (B) Helm-Held als Opfer  (C) Helm-Held als Auslöser  (D) Kreaturen des Helm-Helden (Opfer / Auslöser / stirbt am Tick)
// (E) Helm am anderen Helden / am Gegner schützt nicht  (F) Helm kommt / geht MITTEN in der Kette  (G) Gegnerseite (Auslöser dort, Area bei mir / beim Gegner)
// (H) zwei Kopien der Area  (I) Zustand sauber
// beide Sitze. Exit 0 = korrekt.
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const DB = H.DB;
const SBT = 'Shared Blood Tanks', HELM = 'Diver Helmet', DUMMY = 'ZZ Dummy', FRAIL = 'ZZ Dummy Frail';
const TUSHU = 'Tushu, the Knowledge Keeper', RICK = 'Rick, the Trigger Happy Undertaker', ZWEI = 'Zwei, the Lucky Thief';
const HP = 800, TICK = 50;

(async () => {
  const R = H.runner();
  for (const me of [0, 1]) {
    const op = 1 - me;
    // Szene: beide Seiten Tushu/Rick/Zwei (800 HP). Area bei `areaSeite` (Standard: ich). Alle Helden bluten (außer `o.frei`), keine Kreaturen.
    const mk = async (o = {}) => {
      const t = await H.fresh({ gold: 900, deckSize: 30, ...(me ? { active: 1 } : {}) });
      for (const s of [0, 1]) [TUSHU, RICK, ZWEI].forEach((n, hi) => t.setHero(s, hi, n, HP));
      t.gs.turn = Math.max(t.gs.turn || 0, 3);
      for (const s of (o.areaSeiten || [me])) t.putArea(s, SBT);
      for (const s of [0, 1]) for (let hi = 0; hi < 3; hi++) if (!(o.frei || []).some(([a, b]) => a === s && b === hi)) t.heroStatus(s, hi, 'bleeding');
      t.errors.length = 0; return t;
    };
    const hp = (t, s, hi) => t.hero(s, hi).hp;
    const helm = (t, s, hi, slot = 2) => t.put(s, hi, slot, HELM);
    const kreatur = (t, s, hi, slot, name = DUMMY, blutet = true) => t.put(s, hi, slot, name, blutet ? { counters: { bleeding: true } } : {});
    // Der echte Engine-Tick nach einer Handlung des Helden (löst afterBleedDamage aus).
    const heldenTick = (t, s, hi) => t.run(() => t.engine._processBleedAfterAction({ actionType: 'spell', playerIdx: s, heroIdx: hi }));
    const kh = (inst) => inst.counters.currentHp ?? DB[inst.name].hp;   // Kreaturen-HP
    const kreaturTick = (t, inst) => t.run(() => t.engine._processBleedAfterCreatureEffect(inst));
    const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
    const erwarte = (t, soll) => {   // soll: Liste [Seite, Held, HP]
      const bad = [];
      for (const [s, hi, v] of soll) if (hp(t, s, hi) !== v) bad.push(`S${s}H${hi} ${hp(t, s, hi)} != ${v}`);
      return bad;
    };
    const alleHeldenAusser = (t, ausnahmen, v, seiten = [0, 1]) => {   // alle übrigen Helden müssen v HP haben
      const bad = [];
      for (const s of seiten) for (let hi = 0; hi < 3; hi++) {
        if (ausnahmen.some(([a, b]) => a === s && b === hi)) continue;
        if (hp(t, s, hi) !== v) bad.push(`S${s}H${hi} ${hp(t, s, hi)} != ${v}`);
      }
      return bad;
    };

    // ═══ (A) Gegenprobe ohne Helm: die Kette läuft (Auslöser trägt seinen Tick, jeder andere blutende Held der Seite einen Kettenschlag) ═══
    R.section(`Sitz ${me} · (A) Gegenprobe ohne Helm`);
    {
      const t = await mk();
      const k = kreatur(t, me, 2, 0);
      await heldenTick(t, me, 0);
      const f = erwarte(t, [[me, 0, HP - TICK], [me, 1, HP - TICK], [me, 2, HP - TICK], [op, 0, HP], [op, 1, HP], [op, 2, HP]]);
      if (kh(k) !== undefined && kh(k) !== DB[DUMMY].hp - TICK && (k.currentHp ?? kh(k)) !== DB[DUMMY].hp - TICK) f.push(`Kreatur ${kh(k)}/${k.currentHp}`);
      R.check('ohne Helm: Auslöser Held 0 −50, Held 1, Held 2 −50 (Kette), Kreatur −50, Gegnerseite unberührt', f.length === 0 && sauber(t), f);
    }

    // ═══ (B) Helm-Held als Opfer ═══
    R.section(`Sitz ${me} · (B) Held mit Helm wird von der Kette NICHT getroffen`);
    {
      const t = await mk(); helm(t, me, 1);
      await heldenTick(t, me, 0);
      const f = erwarte(t, [[me, 0, HP - TICK], [me, 1, HP], [me, 2, HP - TICK]]);
      R.check('Helm an Held 1: Held 1 bleibt bei 800, Held 0 (Tick) und Held 2 (Kette) −50', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk(); helm(t, me, 1); helm(t, me, 2);
      await heldenTick(t, me, 0);
      const f = erwarte(t, [[me, 0, HP - TICK], [me, 1, HP], [me, 2, HP]]);
      R.check('Helm an Held 1 und 2: nur der Tick-Held verliert HP', f.length === 0 && sauber(t), f);
    }

    // ═══ (C) Helm-Held als Auslöser ═══
    R.section(`Sitz ${me} · (C) Held mit Helm löst die Kette nicht aus (sein eigener Tick bleibt)`);
    {
      const t = await mk(); helm(t, me, 1);
      await heldenTick(t, me, 1);
      const f = erwarte(t, [[me, 0, HP], [me, 1, HP - TICK], [me, 2, HP]]);
      R.check('Held 1 (Helm) tickt: er verliert seine 50, Held 0 und 2 bleiben bei 800 (keine Kette)', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk(); helm(t, me, 1);
      await heldenTick(t, me, 0);   // Gegenprobe: derselbe Aufbau, anderer Auslöser → Kette läuft an den anderen Helden
      const f = erwarte(t, [[me, 0, HP - TICK], [me, 2, HP - TICK]]);
      R.check('Gegenprobe: Held 0 (ohne Helm) tickt → Held 2 wird getroffen', f.length === 0 && sauber(t), f);
    }

    // ═══ (D) Kreaturen in den Support Zones ═══
    R.section(`Sitz ${me} · (D) Karten in den Support Zones eines Helm-Helden`);
    {
      const t = await mk(); helm(t, me, 1);
      const imHelm = kreatur(t, me, 1, 0), ohneHelm = kreatur(t, me, 2, 0), zwei = kreatur(t, me, 1, 1);
      const voll = DB[DUMMY].hp;
      await heldenTick(t, me, 0);
      const f = erwarte(t, [[me, 0, HP - TICK], [me, 1, HP], [me, 2, HP - TICK]]);
      if (kh(imHelm) !== voll || kh(zwei) !== voll) f.push(`Kreaturen am Helm-Helden getroffen: ${kh(imHelm)}/${kh(zwei)}`);
      if (kh(ohneHelm) !== voll - TICK) f.push(`Kreatur ohne Helm ${kh(ohneHelm)} != ${voll - TICK}`);
      R.check('Kreaturen an Held 1 (Helm) bleiben unverletzt, Kreatur an Held 2 −50', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk(); helm(t, me, 1);
      const imHelm = kreatur(t, me, 1, 0);
      await kreaturTick(t, imHelm);
      const f = erwarte(t, [[me, 0, HP], [me, 1, HP], [me, 2, HP]]);
      if (kh(imHelm) !== DB[DUMMY].hp - TICK) f.push(`eigener Tick der Kreatur ${kh(imHelm)}`);
      R.check('Kreatur eines Helm-Helden tickt: sie verliert ihre 50, aber keine Kette auf die Helden', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk(); helm(t, me, 1);
      const frei = kreatur(t, me, 2, 0), voll = DB[DUMMY].hp;
      await kreaturTick(t, frei);
      const f = erwarte(t, [[me, 0, HP - TICK], [me, 1, HP], [me, 2, HP - TICK]]);
      if (kh(frei) !== voll - TICK) f.push(`Auslöser-Kreatur ${kh(frei)}`);
      R.check('Kreatur ohne Helm tickt: Held 0 und 2 −50 (Kette), Helm-Held 1 verschont', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk(); helm(t, me, 1);
      const sterbend = kreatur(t, me, 1, 0, FRAIL);   // 10 HP: stirbt am eigenen Tick
      await kreaturTick(t, sterbend);
      const f = erwarte(t, [[me, 0, HP], [me, 1, HP], [me, 2, HP]]);
      if (sterbend.zone === 'support' && kh(sterbend) > 0) f.push('Kreatur lebt noch');
      R.check('Kreatur des Helm-Helden stirbt am eigenen Tick: trotzdem keine Kette', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk(); helm(t, me, 1);
      const nichtBlutend = kreatur(t, me, 2, 0, DUMMY, false);
      await heldenTick(t, me, 0);
      if (kh(nichtBlutend) !== DB[DUMMY].hp) { R.check('nicht blutende Kreatur bleibt unberührt', false, kh(nichtBlutend)); }
      else R.check('nicht blutende Kreatur bleibt unberührt (Gegenprobe zur Filterung)', sauber(t));
    }

    // ═══ (E) Der Helm schützt nur den Träger und dessen Zonen ═══
    R.section(`Sitz ${me} · (E) Helm am anderen Helden / am Gegner schützt nicht`);
    {
      const t = await mk(); helm(t, me, 1);
      const k0 = kreatur(t, me, 0, 0), k2 = kreatur(t, me, 2, 0), voll = DB[DUMMY].hp;
      await heldenTick(t, me, 0);
      const f = erwarte(t, [[me, 0, HP - TICK], [me, 1, HP], [me, 2, HP - TICK]]);
      if (kh(k0) !== voll - TICK || kh(k2) !== voll - TICK) f.push(`Kreaturen an Held 0 / 2 ${kh(k0)}/${kh(k2)} != ${voll - TICK}`);
      R.check('Helm an Held 1: Held 2 und Kreaturen an Held 0/2 werden getroffen', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk(); helm(t, op, 1);   // Helm am GEGNER-Helden: schützt meine Helden nicht
      await heldenTick(t, me, 0);
      const f = erwarte(t, [[me, 0, HP - TICK], [me, 1, HP - TICK], [me, 2, HP - TICK], [op, 0, HP], [op, 1, HP], [op, 2, HP]]);
      R.check('Helm am Gegnerhelden: meine Helden erleiden die Kette wie sonst, die Gegnerseite bleibt unberührt', f.length === 0 && sauber(t), f);
    }

    // ═══ (F) Helm kommt / geht mitten in der Kette ═══
    R.section(`Sitz ${me} · (F) Helm kommt / geht mitten in der Kette`);
    {
      const t = await mk();
      const k2 = kreatur(t, me, 2, 0), voll = DB[DUMMY].hp;
      let angelegt = false;
      const orig = t.engine.actionDealDamage.bind(t.engine);
      t.engine.actionDealDamage = async function (src, hero, ...rest) {
        const r = await orig(src, hero, ...rest);
        if (!angelegt && hero === t.hero(me, 1)) { angelegt = true; helm(t, me, 2); }   // Held 1 ist der erste Kettenschlag → danach kommt der Helm an Held 2
        return r;
      };
      await heldenTick(t, me, 0);
      const f = erwarte(t, [[me, 0, HP - TICK], [me, 1, HP - TICK], [me, 2, HP]]);
      if (!angelegt) f.push('Helm wurde nicht angelegt (Testaufbau)');
      if (kh(k2) !== voll) f.push(`Kreatur an Held 2 ${kh(k2)} != ${voll} (Helm kam vor ihrem Schlag)`);
      R.check('Helm kommt nach Schlag 1 an Held 2: Held 2 und seine Kreatur bleiben verschont', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk();
      const h2 = helm(t, me, 2), k2 = kreatur(t, me, 2, 0), voll = DB[DUMMY].hp;
      let weg = false;
      const orig = t.engine.actionDealDamage.bind(t.engine);
      t.engine.actionDealDamage = async function (src, hero, ...rest) {
        const r = await orig(src, hero, ...rest);
        if (!weg && hero === t.hero(me, 1)) { weg = true; await t.engine.actionDestroyCard({ name: 'T', owner: op }, h2, {}); }
        return r;
      };
      await heldenTick(t, me, 0);
      const f = erwarte(t, [[me, 0, HP - TICK], [me, 1, HP - TICK], [me, 2, HP - TICK]]);
      if (!weg) f.push('Helm wurde nicht zerstört (Testaufbau)');
      if (kh(k2) !== voll - TICK) f.push(`Kreatur an Held 2 ${kh(k2)} != ${voll - TICK}`);
      R.check('Helm geht nach Schlag 1 (zerstört): Held 2 und seine Kreatur werden noch getroffen', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk(); const h1 = helm(t, me, 1);
      await heldenTick(t, me, 0);                                          // Helm liegt: Held 1 verschont
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, h1, {}));
      await heldenTick(t, me, 0);                                          // Helm weg: Held 1 wird getroffen
      const f = erwarte(t, [[me, 0, HP - 2 * TICK], [me, 1, HP - TICK], [me, 2, HP - 2 * TICK]]);
      R.check('Helm zwischen zwei Ticks zerstört: erst verschont, dann getroffen', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk();
      await heldenTick(t, me, 0);
      helm(t, me, 1);
      await heldenTick(t, me, 0);
      const f = erwarte(t, [[me, 0, HP - 2 * TICK], [me, 1, HP - TICK], [me, 2, HP - 2 * TICK]]);
      R.check('Helm zwischen zwei Ticks angelegt: erst getroffen, dann verschont', f.length === 0 && sauber(t), f);
    }

    // ═══ (G) Gegnerseite ═══
    R.section(`Sitz ${me} · (G) Gegnerseite (Bezugspunkt der Kette ist der Besitzer des getroffenen Ziels)`);
    {
      const t = await mk(); helm(t, op, 1);
      const k = kreatur(t, op, 1, 0), k2 = kreatur(t, op, 2, 0), voll = DB[DUMMY].hp;
      await heldenTick(t, op, 0);   // Auslöser steht beim Gegner, die Area bei mir
      const f = erwarte(t, [[op, 0, HP - TICK], [op, 1, HP], [op, 2, HP - TICK], [me, 0, HP], [me, 1, HP], [me, 2, HP]]);
      if (kh(k) !== voll || kh(k2) !== voll - TICK) f.push(`Kreaturen beim Gegner ${kh(k)}/${kh(k2)}`);
      R.check('Auslöser beim Gegner, Helm am Gegnerhelden 1: Gegnerheld 1 + dessen Kreatur verschont, Gegnerheld 2 + Kreatur −50, meine Seite unberührt', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk({ areaSeiten: [op] }); helm(t, op, 1);   // Area liegt beim Gegner: wirkt trotzdem beidseitig
      await heldenTick(t, op, 1);
      const f = erwarte(t, [[op, 0, HP], [op, 1, HP - TICK], [op, 2, HP]]);
      R.check('Area beim Gegner, Gegnerheld 1 (Helm) tickt: keine Kette', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk({ areaSeiten: [op] }); helm(t, me, 1);
      await heldenTick(t, me, 0);
      const f = erwarte(t, [[me, 0, HP - TICK], [me, 1, HP], [me, 2, HP - TICK]]);
      R.check('Area beim Gegner, mein Helm-Held 1 bleibt verschont, Held 2 getroffen', f.length === 0 && sauber(t), f);
    }

    // ═══ (H) Zwei Kopien ═══
    R.section(`Sitz ${me} · (H) Zwei Kopien der Area (beide Seiten)`);
    {
      const t = await mk({ areaSeiten: [me, op] }); helm(t, me, 1);
      const k1 = kreatur(t, me, 1, 0);
      await heldenTick(t, me, 0);
      const f = erwarte(t, [[me, 0, HP - TICK], [me, 1, HP], [me, 2, HP - 2 * TICK]]);
      if (kh(k1) !== DB[DUMMY].hp) f.push(`Kreatur am Helm-Held ${kh(k1)}`);
      R.check('zwei Kopien: Helm-Held/-Kreatur bleiben verschont, Held 2 trägt zwei Kettenschläge', f.length === 0 && sauber(t), f);
    }

    // ═══ (I) Unbeteiligte Zustände ═══
    R.section(`Sitz ${me} · (I) Nicht blutende Helden / Helm-Held ohne Bleed`);
    {
      const t = await mk({ frei: [[me, 2]] }); helm(t, me, 1);
      await heldenTick(t, me, 0);
      const f = erwarte(t, [[me, 0, HP - TICK], [me, 1, HP], [me, 2, HP]]);
      R.check('nicht blutender Held 2 und Helm-Held 1: nur der Tick-Held verliert HP', f.length === 0 && sauber(t), f);
    }
  }
  R.finish();
})();
