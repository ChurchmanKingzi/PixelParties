'use strict';
// W61a (Al): Acid Rain vs. Diver Helmet.
//   Acid Rain: „The first time every turn the turn player plays a Spell from their hand, they must delete 2 cards from their hand OR place a Pollution Token into one of their Heroes' free Support Zones."
//   Diver Helmet: „The equipped Hero and all cards in its Support Zones are unaffected by Areas." Acid Rain ist eine Area.
//   Al: der Pollution Token darf NICHT in die Support Zones eines Helden mit Diver Helmet gelegt werden (Zonen / Held für die Area-Wirkung nicht wählbar).
//   Folge: freie Zonen von Helm-Helden zählen nicht und sind nicht wählbar; gibt es keine freie Zone eines Helden ohne Helm, entfällt die Token-Option → nur „2 Karten löschen"
//   (bei weniger als 2 Karten: Fizzle wie bisher bei „keine freie Zone"). Der Helm kann zwischen Optionswahl / Zonenwahl und Platzierung kommen oder gehen → Zone wird beim Platzieren erneut geprüft.
// (A) Gegenprobe ohne Helm  (B) Helm-Held: seine Zonen nicht wählbar  (C) zwei Helm-Helden  (D) alle Helden mit Helm → nur Löschen / Fizzle  (E) freie Zonen nur bei Helm-Held
//   (F) Helm kommt nach der Optionswahl  (G) Helm kommt während der Zonenwahl  (H) Helm geht (vor dem Zauber / nach der Optionswahl)  (I) Gegenproben (Helm am Gegner, toter Held, fremde Seite)
// beide Sitze. Exit 0 = korrekt.
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const AR = 'Acid Rain', HELM = 'Diver Helmet', DUMMY = 'ZZ Dummy', FILL = 'ZZ Filler', TOKEN = 'Pollution Token';

(async () => {
  const R = H.runner();
  for (const me of [0, 1]) {
    const op = 1 - me;
    // Szene: `me` ist Zugspieler und hat Handkarten; Acid Rain liegt bei `areaSeite` (Standard: Gegner — die Area wirkt auf den Zugspieler, egal wem sie gehört).
    const mk = async (o = {}) => {
      const t = await H.fresh({ gold: 900, deckSize: 30, active: me, hand: [me === 0 ? [FILL, FILL, FILL, FILL] : [], me === 1 ? [FILL, FILL, FILL, FILL] : []].map((h, s) => s === me ? (o.hand ?? [FILL, FILL, FILL, FILL]) : []) });
      t.gs.turn = Math.max(t.gs.turn || 0, 3);
      t.putArea(o.areaSeite ?? op, AR);
      // volle Zonen: `voll` = Liste von Heldenindizes, deren drei Zonen mit Dummys belegt sind; `teil` = {hi: [belegte Slots]}
      for (const hi of (o.voll || [])) for (let sl = 0; sl < 3; sl++) t.put(me, hi, sl, DUMMY);
      for (const [hi, slots] of Object.entries(o.teil || {})) for (const sl of slots) t.put(me, +hi, sl, DUMMY);
      t.policy.confirm = true;
      t.errors.length = 0; return t;
    };
    const helm = (t, s, hi, slot = 2) => t.put(s, hi, slot, HELM);
    const tokens = (t, s = me) => t.inst(c => c.name === TOKEN && c.owner === s);
    const tokenHeroes = (t) => tokens(t).map(c => `${c.heroIdx}.${c.zoneSlot}`).sort();
    // Skript: Optionswahl + Zonenwahl protokollieren/steuern.
    const skript = (t, o = {}) => {
      const log = { picker: 0, zonePick: 0, zonen: null };
      t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === 'Acid Rain', answer: async () => { log.picker++; if (o.vorOption) await o.vorOption(); return { optionId: o.option ?? 'token' }; } });
      t.script.push({ match: d => d && d.type === 'zonePick', answer: async (d) => {
        log.zonePick++; log.zonen = d.zones.map(z => `${z.heroIdx}.${z.slotIdx}`);
        if (o.vorZone) await o.vorZone(d);
        const wunsch = o.zone && d.zones.find(z => z.heroIdx === o.zone[0] && z.slotIdx === o.zone[1]);
        const z = wunsch || (o.zone ? { heroIdx: o.zone[0], slotIdx: o.zone[1] } : d.zones[0]);   // bewusst auch eine NICHT angebotene Zone melden können
        return { heroIdx: z.heroIdx, slotIdx: z.slotIdx };
      } });
      return log;
    };
    const zaubern = async (t) => {
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
      await t.play(me, 'Fireball', { hero: 0 });
    };
    const geloescht = (t) => t.gs.players[me].deletedPile.length;
    const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
    const ohneHeld0 = (zonen) => zonen && !zonen.some(z => z.startsWith('0.'));

    // ═══ (A) Gegenprobe ohne Helm ═══
    R.section(`Sitz ${me} · (A) Gegenprobe ohne Helm: alle freien Zonen aller Helden wählbar`);
    {
      const t = await mk(); const log = skript(t, { zone: [0, 1] });
      await zaubern(t);
      const f = [];
      if (log.picker !== 1) f.push(`Optionswahl ${log.picker}x`);
      if (!log.zonen || log.zonen.length !== 9) f.push(`Zonenliste ${JSON.stringify(log.zonen)}`);
      if (tokenHeroes(t).join() !== '0.1') f.push(`Token ${tokenHeroes(t)}`);
      R.check('ohne Helm: 9 wählbare Zonen, Token landet in der gewählten Zone (Held 0, Slot 1)', f.length === 0 && sauber(t), f);
    }

    // ═══ (B) Helm-Held ═══
    R.section(`Sitz ${me} · (B) Held mit Helm: seine freien Zonen sind nicht wählbar`);
    {
      const t = await mk(); helm(t, me, 0); const log = skript(t);
      await zaubern(t);
      const f = [];
      if (log.picker !== 1) f.push(`Optionswahl ${log.picker}x`);
      if (!log.zonen || log.zonen.length !== 6 || !ohneHeld0(log.zonen)) f.push(`Zonenliste ${JSON.stringify(log.zonen)}`);
      if (tokens(t).length !== 1 || tokenHeroes(t).some(z => z.startsWith('0.'))) f.push(`Token ${tokenHeroes(t)}`);
      R.check('Helm an Held 0: Zonenliste = nur die 6 freien Zonen der Helden 1 und 2, Token nicht bei Held 0', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk(); helm(t, me, 0); const log = skript(t, { zone: [0, 0] });   // Spieler (Client) meldet trotzdem eine Helm-Zone
      await zaubern(t);
      const f = [];
      if (tokens(t).length !== 1 || tokenHeroes(t).some(z => z.startsWith('0.'))) f.push(`Token trotz Meldung einer Helm-Zone bei ${tokenHeroes(t)}`);
      R.check('gemeldete Helm-Zone (Held 0, Slot 0) wird nicht übernommen: Token liegt bei einem Helden ohne Helm', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk(); helm(t, me, 1); const log = skript(t, { zone: [2, 2] });
      await zaubern(t);
      const f = [];
      if (log.zonen && log.zonen.some(z => z.startsWith('1.'))) f.push(`Zonenliste enthält Held 1: ${JSON.stringify(log.zonen)}`);
      if (tokenHeroes(t).join() !== '2.2') f.push(`Token ${tokenHeroes(t)}`);
      R.check('Helm an Held 1: Held 1 nicht wählbar, Held 2 Slot 2 wird gewählt und belegt', f.length === 0 && sauber(t), f);
    }

    // ═══ (C) Zwei Helm-Helden ═══
    R.section(`Sitz ${me} · (C) Zwei Helden mit Helm`);
    {
      const t = await mk(); helm(t, me, 0); helm(t, me, 1); const log = skript(t);
      await zaubern(t);
      const f = [];
      if (!log.zonen || log.zonen.length !== 3 || !log.zonen.every(z => z.startsWith('2.'))) {
        // nur 3 Zonen von Held 2 → kein Zonen-Prompt nötig? (3 freie Zonen → Prompt) — sonst Auto
        f.push(`Zonenliste ${JSON.stringify(log.zonen)}`);
      }
      if (tokens(t).length !== 1 || !tokenHeroes(t)[0].startsWith('2.')) f.push(`Token ${tokenHeroes(t)}`);
      R.check('Helm an Held 0 und 1: nur die drei Zonen von Held 2 wählbar, Token bei Held 2', f.length === 0 && sauber(t), f);
    }

    // ═══ (D) Alle Helden mit Helm ═══
    R.section(`Sitz ${me} · (D) Alle Helden mit Helm: keine Token-Option, nur „2 Karten löschen“`);
    {
      const t = await mk(); [0, 1, 2].forEach(hi => helm(t, me, hi)); const log = skript(t);
      const del0 = geloescht(t);
      await zaubern(t);
      const f = [];
      if (log.picker !== 0) f.push(`Optionswahl erschien ${log.picker}x`);
      if (log.zonePick !== 0) f.push(`Zonenwahl erschien ${log.zonePick}x`);
      if (tokens(t).length !== 0) f.push(`Token ${tokenHeroes(t)}`);
      if (geloescht(t) !== del0 + 2) f.push(`gelöscht ${geloescht(t) - del0} != 2`);
      R.check('drei Helme: keine Optionswahl, kein Token, genau 2 Karten aus der Hand gelöscht', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk({ hand: [FILL] }); [0, 1, 2].forEach(hi => helm(t, me, hi)); const log = skript(t);
      const del0 = geloescht(t), hand0 = t.pile(me, 'hand').length;
      await zaubern(t);
      const f = [];
      if (log.picker !== 0 || log.zonePick !== 0) f.push('Prompt erschien');
      if (tokens(t).length !== 0) f.push(`Token ${tokenHeroes(t)}`);
      if (geloescht(t) !== del0) f.push(`gelöscht ${geloescht(t) - del0}`);
      if (!t.logs.some(l => l.type === 'acid_rain_fizzle')) f.push('kein acid_rain_fizzle');
      R.check('drei Helme und nur 1 weitere Handkarte: Acid Rain verpufft (Fizzle), nichts wird gelöscht, kein Token', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk(); [0, 1, 2].forEach(hi => helm(t, me, hi)); const log = skript(t);
      // Gegenprobe zum Ruling „keine freie Zone": ohne Helme, aber alle Zonen belegt → ebenfalls nur Löschen (bestehendes Verhalten)
      const t2 = await mk({ voll: [0, 1, 2] }); const log2 = skript(t2);
      const d2 = geloescht(t2);
      await zaubern(t2);
      const f = [];
      if (log2.picker !== 0 || tokens(t2).length !== 0 || geloescht(t2) !== d2 + 2) f.push(`bestehendes Verhalten (keine Zone): Prompt ${log2.picker}, Token ${tokens(t2).length}, gelöscht ${geloescht(t2) - d2}`);
      R.check('Gegenprobe: ohne Helm, aber alle Zonen belegt → wie bisher nur „2 Karten löschen“', f.length === 0 && sauber(t2), f);
    }

    // ═══ (E) Freie Zonen gibt es nur beim Helm-Helden ═══
    R.section(`Sitz ${me} · (E) Freie Zonen nur bei Helm-Helden`);
    {
      const t = await mk({ voll: [1, 2] }); helm(t, me, 0); const log = skript(t);   // Held 0: Helm + 2 freie Zonen; Helden 1, 2 voll
      const del0 = geloescht(t);
      await zaubern(t);
      const f = [];
      if (log.picker !== 0 || log.zonePick !== 0) f.push(`Prompt erschien (Option ${log.picker}, Zone ${log.zonePick})`);
      if (tokens(t).length !== 0) f.push(`Token ${tokenHeroes(t)}`);
      if (geloescht(t) !== del0 + 2) f.push(`gelöscht ${geloescht(t) - del0} != 2`);
      R.check('freie Zonen nur bei Held 0 (Helm): keine Token-Option, 2 Karten gelöscht', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk({ voll: [0, 1], teil: { 2: [0, 1] } }); const log = skript(t);   // genau eine freie Zone: Held 2 Slot 2, kein Helm → Wahl bleibt, Zone ohne Prompt
      await zaubern(t);
      const f = [];
      if (log.picker !== 1) f.push(`Optionswahl ${log.picker}x`);
      if (log.zonePick !== 0) f.push('Zonenwahl bei nur einer Zone');
      if (tokenHeroes(t).join() !== '2.2') f.push(`Token ${tokenHeroes(t)}`);
      R.check('genau eine freie Zone (Held 2, kein Helm): Option bleibt, Token liegt dort', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk({ voll: [1], teil: { 2: [0, 1] } }); helm(t, me, 0); const log = skript(t);   // Held 0 (Helm) hat freie Zonen, Held 2 genau eine
      await zaubern(t);
      const f = [];
      if (log.picker !== 1 || log.zonePick !== 0) f.push(`Prompts (Option ${log.picker}, Zone ${log.zonePick})`);
      if (tokenHeroes(t).join() !== '2.2') f.push(`Token ${tokenHeroes(t)}`);
      R.check('Helm-Held mit freien Zonen daneben, Held 2 mit genau einer: Token zwingend bei Held 2', f.length === 0 && sauber(t), f);
    }

    // ═══ (F) Helm kommt nach der Optionswahl ═══
    R.section(`Sitz ${me} · (F) Helm kommt zwischen Optionswahl und Platzierung`);
    {
      const t = await mk({ voll: [1, 2] }); const log = skript(t, { vorOption: () => helm(t, me, 0) });   // einzige freie Zonen: Held 0; Helm kommt nach der Wahl „Token“
      const del0 = geloescht(t);
      await zaubern(t);
      const f = [];
      if (log.picker !== 1) f.push(`Optionswahl ${log.picker}x`);
      if (tokens(t).length !== 0) f.push(`Token trotz Helm ${tokenHeroes(t)}`);
      if (geloescht(t) !== del0 + 2) f.push(`Rückfall auf Löschen: ${geloescht(t) - del0} != 2`);
      R.check('Helm kommt nach der Wahl „Token“ und nimmt die letzte Zone: kein Token, Rückfall auf „2 Karten löschen“', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk({ voll: [1, 2], hand: [FILL] }); const log = skript(t, { vorOption: () => helm(t, me, 0) });
      // hier wird die Option gar nicht angeboten (nur 1 weitere Karte → nur Token); Helm kommt trotzdem NICHT vor der Wahl → Token regulär bei Held 0
      const del0 = geloescht(t);
      await zaubern(t);
      const f = [];
      if (log.picker !== 0) f.push(`Optionswahl ${log.picker}x`);
      if (tokenHeroes(t).length !== 1) f.push(`Token ${tokenHeroes(t)}`);
      R.check('Hilfsprobe: nur Token möglich (1 Handkarte) → wird ohne Prompt bei Held 0 platziert', f.length === 0 && sauber(t), f);
    }

    // ═══ (G) Helm kommt während der Zonenwahl ═══
    R.section(`Sitz ${me} · (G) Helm kommt während der Zonenwahl`);
    {
      const t = await mk({ voll: [2] }); const log = skript(t, { zone: [1, 1], vorZone: () => helm(t, me, 1) });   // angeboten: Held 0 + Held 1; Helm kommt an Held 1, Spielerwahl Held 1 Slot 1
      await zaubern(t);
      const f = [];
      if (log.zonePick !== 1) f.push(`Zonenwahl ${log.zonePick}x`);
      if (tokens(t).length !== 1 || tokenHeroes(t).some(z => z.startsWith('1.'))) f.push(`Token ${tokenHeroes(t)} (Held 1 trägt inzwischen einen Helm)`);
      R.check('Helm kommt an Held 1, während dessen Zone gewählt wird: Token wandert in eine Zone ohne Helm (Held 0)', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk({ voll: [0, 2] }); const log = skript(t, { zone: [1, 0], vorZone: () => helm(t, me, 1) });
      const del0 = geloescht(t);
      await zaubern(t);
      const f = [];
      if (tokens(t).length !== 0) f.push(`Token ${tokenHeroes(t)}`);
      R.check('Helm kommt an den einzigen Held mit freien Zonen, während gewählt wird: kein Token', f.length === 0 && sauber(t), f);
    }

    // ═══ (H) Helm geht ═══
    R.section(`Sitz ${me} · (H) Helm geht`);
    {
      const t = await mk({ voll: [1, 2] }); const h0 = helm(t, me, 0);
      await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: op }, h0, {}));
      const log = skript(t, { zone: [0, 2] });
      await zaubern(t);
      const f = [];
      if (log.picker !== 1) f.push(`Optionswahl ${log.picker}x`);
      if (tokenHeroes(t).join() !== '0.2') f.push(`Token ${tokenHeroes(t)}`);
      R.check('Helm vor dem Zauber zerstört: Held 0 ist wieder wählbar (Token auch in dem vom Helm frei gewordenen Slot)', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk({ voll: [1, 2] }); const h0 = helm(t, me, 0);
      const log = skript(t, { option: 'delete', vorOption: () => {} });
      // Gegenprobe zur Option: nur Löschen ist angeboten (Helm liegt)
      const del0 = geloescht(t);
      await zaubern(t);
      const f = [];
      if (log.picker !== 0 || tokens(t).length !== 0 || geloescht(t) !== del0 + 2) f.push(`Prompt ${log.picker}, Token ${tokens(t).length}, gelöscht ${geloescht(t) - del0}`);
      R.check('Helm liegt, sonst keine Zone: keine Wahl, 2 Karten gelöscht', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk({ voll: [2] }); const h0 = helm(t, me, 0);   // Held 1 hat freie Zonen → Wahl; Helm an Held 0 geht während der Optionswahl
      const log = skript(t, { vorOption: () => t.engine.actionDestroyCard({ name: 'T', owner: op }, h0, {}) });
      await zaubern(t);
      const f = [];
      if (log.zonePick !== 1) f.push(`Zonenwahl ${log.zonePick}x`);
      if (!log.zonen || log.zonen.length !== 6 || !log.zonen.some(z => z.startsWith('0.'))) f.push(`Zonenliste nach Helm-Abgang ${JSON.stringify(log.zonen)} (Held 0 wieder dabei, 6 Zonen)`);
      if (tokens(t).length !== 1) f.push(`Token ${tokenHeroes(t)}`);
      R.check('Helm geht nach der Optionswahl: die Zonenliste wird frisch gebildet, Held 0 ist wieder dabei', f.length === 0 && sauber(t), f);
    }

    // ═══ (I) Gegenproben ═══
    R.section(`Sitz ${me} · (I) Gegenproben: Helm am Gegner / toter Held / Area auf eigener Seite`);
    {
      const t = await mk(); helm(t, op, 0); helm(t, op, 1); helm(t, op, 2); const log = skript(t);
      await zaubern(t);
      const f = [];
      if (log.picker !== 1 || !log.zonen || log.zonen.length !== 9) f.push(`Prompts/Zonen ${log.picker} ${JSON.stringify(log.zonen)}`);
      if (tokens(t).length !== 1) f.push('Token fehlt');
      R.check('Helme nur am Gegner: alle 9 eigenen Zonen wählbar', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk(); t.hero(me, 2).hp = 0; helm(t, me, 0); const log = skript(t);
      await zaubern(t);
      const f = [];
      if (!log.zonen || log.zonen.length !== 3 || !log.zonen.every(z => z.startsWith('1.'))) f.push(`Zonenliste ${JSON.stringify(log.zonen)} (Held 0 Helm, Held 2 tot → nur Held 1)`);
      R.check('Held 0 mit Helm, Held 2 besiegt (bestehendes Ruling: nur lebende Helden): nur Held 1 wählbar', f.length === 0 && sauber(t), f);
    }
    {
      const t = await mk({ areaSeite: me }); helm(t, me, 0); const log = skript(t);   // Acid Rain liegt auf MEINER Seite: gilt trotzdem für den Zugspieler (mich), Helm schützt trotzdem
      await zaubern(t);
      const f = [];
      if (!log.zonen || log.zonen.length !== 6 || !ohneHeld0(log.zonen)) f.push(`Zonenliste ${JSON.stringify(log.zonen)}`);
      R.check('Area auf der eigenen Seite: Helm-Held 0 ebenfalls nicht wählbar', f.length === 0 && sauber(t), f);
    }
    {
      // Zug des Gegners: Zugspieler = op, Helm am Gegner schützt dessen Zonen, nicht meine — und die Strafe trifft den Zugspieler
      const t = await H.fresh({ gold: 900, deckSize: 30, active: op, hand: [[], []].map((_, s) => s === op ? [FILL, FILL, FILL, FILL] : []) });
      t.gs.turn = Math.max(t.gs.turn || 0, 3);
      t.putArea(me, AR); t.put(op, 1, 2, HELM); t.put(me, 0, 2, HELM);
      t.policy.confirm = true; t.errors.length = 0;
      const log = { zonen: null };
      t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === 'Acid Rain', answer: () => ({ optionId: 'token' }) });
      t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => { log.zonen = d.zones.map(z => `${z.heroIdx}.${z.slotIdx}`); const z = d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx }; } });
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 1).id];
      await t.play(op, 'Fireball', { hero: 0 });
      const f = [];
      if (!log.zonen || log.zonen.some(z => z.startsWith('1.')) || log.zonen.length !== 6) f.push(`Zonenliste des Zugspielers ${JSON.stringify(log.zonen)}`);
      if (t.inst(c => c.name === TOKEN && c.owner === me).length !== 0) f.push('Token auf meiner Seite');
      if (t.inst(c => c.name === TOKEN && c.owner === op).length !== 1) f.push('Token beim Zugspieler fehlt');
      R.check('Zugspieler ist der Gegner: seine Helm-Zonen (Held 1) nicht wählbar, mein Helm ändert nichts', f.length === 0 && t.errors.length === 0, f);
    }
  }
  R.finish();
})();
