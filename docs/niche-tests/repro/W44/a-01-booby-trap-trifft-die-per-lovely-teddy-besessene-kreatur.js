'use strict';
// W44a · Punkt 3 · Al, 22.10.2026: „Ja, da gelten jeweils die Creatures, die ihre Effekte ‚aktiviert bekommen' als die Verursacher; das heißt, man könnte z. B. per Booby Trap eine eigene, per Lovely Teddy
//  besessene Creature treffen."
// Sitz `op` besitzt Skeleton Archer (X) und hält Booby Trap („Activate this Surprise when the user would be hit by an Attack, Spell or Creature effect. Deal 100 damage to the attacker.").
// Sitz `me` borgt X per Lovely Teddy und lässt X seinen aktiven Effekt („choose a target and deal 50 damage") auf den Booby-Trap-Helden wirken.
// Erwartung: X ist der Verursacher dieses Creature effects → Booby Trap trifft X (100 Schaden, X = 50 HP → besiegt), obwohl X dem Booby-Trap-Besitzer gehört; der Effekt wird negiert (Held unversehrt).
// Gegenprobe: eigene (nicht geborgte) Kreatur von `me` auf denselben Helden → Booby Trap trifft sie ebenso. Dazu Spirit of the Forbidden Grimoire (Quelle = der Geist), Singing (Quelle = die gewählte Kreatur).
// Beide Sitze. Aufruf: node docs/niche-tests/repro/W44/a-01-booby-trap-trifft-die-per-lovely-teddy-besessene-kreatur.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' (Teddy-Nutzer)');
    // ── A: Lovely Teddy borgt Skeleton Archer des Gegners; der Archer schießt auf den Booby-Trap-Helden ──
    {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: me, gold: 200 });
      const teddy = t.put(me, 0, 0, 'Lovely Teddy'); teddy.turnPlayed = 1;
      const X = t.put(op, 1, 0, 'Skeleton Archer'); X.turnPlayed = 1;
      t.putSurprise(op, 0, 'Booby Trap'); t.grantFor(op, 0, 'Booby Trap');
      t.targetFn = (valid, cfg) => {
        const borgen = valid.find(v => v.cardName === 'Skeleton Archer' && v.owner === op);
        if (borgen && !X.stolenBy && X.controller !== me) return [borgen.id];
        const held = valid.find(v => v.type === 'hero' && v.owner === op && v.heroIdx === 0);
        return held ? [held.id] : [valid[0].id];
      };
      t.gs.activePlayer = me; t.phase(2);
      const r1 = await t.run(() => t.host.doActivateCreatureEffect(t.room, me, { heroIdx: 0, zoneSlot: 0 }));
      R.check('A Teddy: Archer geborgt (Kontrolle beim Teddy-Nutzer)', X.controller === me, { r1, controller: X.controller });
      const hp0 = t.hp(op, 0);
      t.reset();
      const r2 = await t.run(() => t.host.doActivateCreatureEffect(t.room, me, { heroIdx: 1, zoneSlot: 0, charmedOwner: op }));
      const fallen = t.pile(op, 'discardPile').includes('Skeleton Archer') && !(t.gs.players[op].supportZones[1][0] || []).length;   // besiegt: Platz leer, Karte in der Ablage ihres BESITZERS
      R.note('A Aktivierung des geborgten Archers', { r2, zone: X.zone, hp: X.counters && X.counters.currentHp, heldHp: t.hp(op, 0), logs: t.logs.map(l => l.type) });
      R.check('A Booby Trap hat ausgelöst (Surprise liegt nicht mehr verdeckt)', !t.find('Booby Trap', 'surprise'), t.logs.map(l => l.type));
      R.check('A der geborgte Archer (Quelle des Creature effects) wird von Booby Trap getroffen und besiegt', fallen, { zone: X.zone, hp: X.counters && X.counters.currentHp });
      R.check('A Booby Trap hat den Effekt negiert: der Held des Gegners ist unversehrt', t.hp(op, 0) === hp0, { vorher: hp0, nachher: t.hp(op, 0) });
      R.check('A keine Engine-Fehler, Zustand sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    // ── B: Gegenprobe — eigene Kreatur desselben Sitzes ohne Teddy ──
    {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: me, gold: 200 });
      const Y = t.put(me, 0, 0, 'Skeleton Archer'); Y.turnPlayed = 1;
      t.putSurprise(op, 0, 'Booby Trap'); t.grantFor(op, 0, 'Booby Trap');
      t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === op && v.heroIdx === 0); return [(h || valid[0]).id]; };
      t.gs.activePlayer = me; t.phase(2);
      await t.run(() => t.host.doActivateCreatureEffect(t.room, me, { heroIdx: 0, zoneSlot: 0 }));
      R.check('B Gegenprobe: eigene Kreatur wird ebenfalls getroffen und besiegt', t.pile(me, 'discardPile').includes('Skeleton Archer') && !(t.gs.players[me].supportZones[0][0] || []).length, { zone: Y.zone, hp: Y.counters && Y.counters.currentHp });
      R.check('B sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    // ── C: Singing („use its active effect as if you controlled it"): die gewählte Kreatur ist der Verursacher ──
    {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: me, gold: 200 });
      t.setAbilities(me, 0, [['Singing'], [], []]);
      const X = t.put(op, 1, 0, 'Skeleton Archer'); X.turnPlayed = 1;
      t.putSurprise(op, 0, 'Booby Trap'); t.grantFor(op, 0, 'Booby Trap');
      t.targetFn = (valid, cfg) => {   // 1. Wahl (Titel „… — Singing Lv1"): den Archer borgen; 2. Wahl (Archer): den Booby-Trap-Helden
        if (/Singing/.test(String(cfg && cfg.title))) return [valid.find(v => v.cardName === 'Skeleton Archer' && v.owner === op).id];
        const held = valid.find(v => v.type === 'hero' && v.owner === op && v.heroIdx === 0);
        return [(held || valid[0]).id];
      };
      t.gs.activePlayer = me; t.phase(2);
      const hp0 = t.hp(op, 0);
      await t.run(() => t.host.doActivateFreeAbility(t.room, me, { heroIdx: 0, zoneIdx: 0 }));
      R.note('C Singing', { logs: t.logs.map(l => l.type), ablage: t.pile(op, 'discardPile'), prompts: t.targets.map(x => x.config && x.config.title) });
      R.check('C Singing: Booby Trap hat ausgelöst', !t.find('Booby Trap', 'surprise'), t.logs.map(l => l.type));
      R.check('C Singing: die gewählte Kreatur (Verursacher) wird getroffen und besiegt', t.pile(op, 'discardPile').includes('Skeleton Archer'), t.pile(op, 'discardPile'));
      R.check('C Singing: Effekt negiert, Held unversehrt', t.hp(op, 0) === hp0, { vorher: hp0, nachher: t.hp(op, 0) });
      R.check('C Singing: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    // ── D: Spirit of the Forbidden Grimoire („use the active effects of up to 2 Creatures on the board"): die genutzte Kreatur ist der Verursacher ──
    {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: me, gold: 200 });
      const geist = t.put(me, 0, 0, 'Spirit of the Forbidden Grimoire'); geist.turnPlayed = 1;
      const X = t.put(op, 1, 0, 'Skeleton Archer'); X.turnPlayed = 1;
      t.putSurprise(op, 0, 'Booby Trap'); t.grantFor(op, 0, 'Booby Trap');
      t.targetFn = (valid, cfg) => {   // 1. Wahl (Titel „Spirit of the Forbidden Grimoire"): den fremden Archer; danach: der Booby-Trap-Held
        if (cfg && cfg.title === 'Spirit of the Forbidden Grimoire') return [valid.find(v => v.cardName === 'Skeleton Archer' && v.owner === op).id];
        const held = valid.find(v => v.type === 'hero' && v.owner === op && v.heroIdx === 0);
        return [(held || valid[0]).id];
      };
      t.gs.activePlayer = me; t.phase(2);
      const hp0 = t.hp(op, 0);
      const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, me, { heroIdx: 0, zoneSlot: 0 }));
      R.note('D Spirit', { r, logs: t.logs.map(l => l.type), ablage: t.pile(op, 'discardPile'), prompts: t.targets.map(x => x.config && x.config.title) });
      R.check('D Spirit: Booby Trap hat ausgelöst', !t.find('Booby Trap', 'surprise'), t.logs.map(l => l.type));
      R.check('D Spirit: die genutzte Kreatur (Verursacher) wird getroffen und besiegt', t.pile(op, 'discardPile').includes('Skeleton Archer'), t.pile(op, 'discardPile'));
      R.check('D Spirit: Geist selbst bleibt unversehrt (nicht er ist der Verursacher)', (t.gs.players[me].supportZones[0][0] || []).length === 1, t.pile(me, 'discardPile'));
      R.check('D Spirit: Effekt negiert, Held unversehrt', t.hp(op, 0) === hp0, { vorher: hp0, nachher: t.hp(op, 0) });
      R.check('D Spirit: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
