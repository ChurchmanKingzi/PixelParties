'use strict';
// W47a · Punkt 7 · Al, 22.10.2026: „Ja, aber nur spezifisch die Creatures in den Support Zones des River-Heroes." — Mountain Tear River („Activate this Surprise when the user or a Creature in one of its
// Support Zones is chosen by an Attack, Spell or Creature effect. Burn the attacker.") löst jetzt auch aus, wenn eine KREATUR in den Support Zones des Helden mit der River gewählt wird — über JEDEN Wähler:
// `promptDamageTarget`/`promptMultiTarget` (meldeten Kreaturen schon seit v703) UND `promptEffectTarget`/`ctx.promptTarget` (Aligning Goals, Gold Trap, Lovely Teddy …; vorher nur Helden).
// Kreaturen anderer Helden desselben Spielers lösen NICHT aus; andere Surprises (Booby Trap, Frost Rune, Spike Trap, Firewall, Toxic Trap, Jumpscare, Glass Wall …) bleiben Helden-Fenster.
// Absicherung (Al 22.10.2026, Punkt 1): eine Creature-Surprise als Angreifer (liegt noch in der Surprise Zone) löst Mountain Tear River nicht aus. Exit 1 auf der Basis 70453312, Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W47/a-04-mountain-tear-river-kreatur-im-support-des-river-helden.js   (Exit 0 = korrekt)
const { H, loadCardEffect, szene, angeboten, surprise, waehleHeld } = require('./_w47.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const RIVER = 'Mountain Tear River';

/**
 * Szene: `op` hält die River in der Surprise Zone von Held 1; je eine Kreatur in den Support Zones von Held 1 (River-Held) und Held 2.
 * `me` wählt (am Zug). `ziel` = 'river' (Kreatur des River-Helden) | 'andere' (Kreatur von Held 2) | 'held' (der River-Held selbst).
 */
const QUELLEN = {
  'Aligning Goals': { art: 'Spell, nur title in der Zielwahl (promptEffectTarget)', nurKreatur: true },
  'Gold Trap': { art: 'Spell-Surprise (promptEffectTarget)', nurKreatur: true },
  'Lovely Teddy': { art: 'Creature effect (promptEffectTarget)', nurKreatur: true },
  'Pressure Projectile': { art: 'Spell (promptDamageTarget)', nurKreatur: false },
  Fireball: { art: 'Spell (promptDamageTarget)', nurKreatur: false },
};
async function lauf(me, op, quelle, ziel, o = {}) {
  const t = await szene(me, op, { active: me });
  const c1 = t.put(op, 1, 0, 'Cheeky Monkee'); c1.turnPlayed = 1;
  const c2 = t.put(op, 2, 0, 'Cheeky Monkee'); c2.turnPlayed = 1;
  t.putSurprise(op, 1, o.surprise || RIVER); for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, o.surprise || RIVER);
  if (o.setup) await o.setup(t);
  t.targetFn = (v) => {
    if (ziel === 'held') { const h = v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 1 && !x.ineligible); return h ? [h.id] : null; }
    const c = v.find(x => x.type === 'equip' && x.owner === op && x.heroIdx === (ziel === 'river' ? 1 : 2) && !x.ineligible);
    return c ? [c.id] : null;
  };
  if (quelle === 'Lovely Teddy') { const tt = t.put(me, 0, 0, 'Lovely Teddy'); tt.turnPlayed = 1; t.phase(2); await t.activateCreature(me, 0, 0); }
  else if (quelle === 'Gold Trap') { t.putSurprise(me, 0, 'Gold Trap'); t.grantFor(me, 0, 'Gold Trap'); await t.run(() => t.engine.actionGainGold(op, 30)); }
  else if (quelle === 'Afflicted Vermin') { t.putSurprise(me, 0, quelle); t.grantFor(me, 0, quelle); await t.run(() => t.engine._activateSurprise(me, 0, quelle, { cardName: 'x', owner: op, heroIdx: 0 }, loadCardEffect(quelle))); }
  else { t.addHand(me, quelle); t.grantFor(me, 0, quelle); await t.play(me, quelle, { hero: 0 }); }
  return t;
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const q of Object.keys(QUELLEN)) {
      R.section(`Sitz ${me} wählt mit ${q} (${QUELLEN[q].art}); Sitz ${op} hält ${RIVER} an Held 1`);
      {   // Kreatur im Support des River-Helden → löst aus, der Angreifer brennt
        const t = await lauf(me, op, q, 'river');
        const brennt = q === 'Lovely Teddy' ? !!(t.find('Lovely Teddy', 'support')?.counters?.burned) : !!t.hero(me, 0).statuses.burned;
        R.check(`${q}: Kreatur im Support des River-Helden gewählt → ${RIVER} aktiviert, der Angreifer ist verbrannt (${q === 'Lovely Teddy' ? 'die wirkende Kreatur' : 'der wirkende Held'})`, surprise(t, op, RIVER) && brennt, { s: surprise(t, op, RIVER), brennt });
        R.check(`${q}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
      }
      {   // Kreatur eines ANDEREN Helden desselben Spielers → löst nicht aus
        const t = await lauf(me, op, q, 'andere');
        R.check(`${q}: Kreatur eines anderen Helden (Held 2) gewählt → ${RIVER} bleibt zu, nichts verbrannt`, !surprise(t, op, RIVER) && !t.hero(me, 0).statuses.burned, { s: surprise(t, op, RIVER) });
      }
    }
    // Helden-Wahl bleibt wie bisher (promptDamageTarget)
    R.section(`Sitz ${me}: Held gewählt (wie bisher) und Kontrollen`);
    for (const q of ['Fireball', 'Pressure Projectile']) {
      const t = await lauf(me, op, q, 'held');
      R.check(`${q}: der River-Held selbst gewählt → ${RIVER} aktiviert (wie bisher)`, surprise(t, op, RIVER) && !!t.hero(me, 0).statuses.burned, { s: surprise(t, op, RIVER) });
    }
    {   // andere Surprises am River-Helden öffnen NICHT bei einer Kreaturenwahl (nur Helden-Fenster)
      for (const s of ['Booby Trap', 'Frost Rune', 'Spike Trap', 'Firewall', 'Toxic Trap', 'Jumpscare', 'Glass Wall', 'Flooding', 'Bluff', 'Crimson Web', 'Tharxian Horse', 'Spider Avalanche', 'Magic Mirror']) {
        const t = await lauf(me, op, 'Aligning Goals', 'river', { surprise: s });
        R.check(`${s} am River-Helden: bleibt bei einer gewählten Kreatur zu (unverändert, kein Helden-Treffer)`, !surprise(t, op, s), { s: surprise(t, op, s) });
      }
    }
    {   // keine River → kein Prompt, nichts
      const t = await szene(me, op, { active: me });
      const c1 = t.put(op, 1, 0, 'Cheeky Monkee'); c1.turnPlayed = 1;
      t.targetFn = (v) => { const c = v.find(x => x.type === 'equip' && x.owner === op && x.heroIdx === 1 && !x.ineligible); return c ? [c.id] : null; };
      t.addHand(me, 'Aligning Goals'); t.grantFor(me, 0, 'Aligning Goals'); await t.play(me, 'Aligning Goals', { hero: 0 });
      R.check('ohne Surprise am Gegner: Aligning Goals wirkt wie bisher (Kreatur geklaut), kein Surprise-Prompt', !t.prompts.some(p => p.pi === op) && sauber(t), t.prompts.map(p => p.pi + ':' + p.d.title));
    }
    {   // die Wirkung des gewählten Effekts bleibt: Mountain Tear River negiert nichts (Aligning Goals klaut die Kreatur trotzdem)
      const t = await lauf(me, op, 'Aligning Goals', 'river');
      const geklaut = t.engine.cardInstances.some(c => c.name === 'Cheeky Monkee' && c.zone === 'support' && (c.controller ?? c.owner) === me);
      R.check(`${RIVER} negiert den Effekt nicht: die Kreatur geht trotzdem an den Wähler`, geklaut, t.engine.cardInstances.filter(c => c.name === 'Cheeky Monkee').map(c => c.zone + ':' + c.controller + ':' + c.owner));
    }
    {   // Absicherung (Punkt 1): eine Creature-Surprise als Angreifer löst die River nicht aus (kein Angreifer auf dem Brett)
      const t = await lauf(me, op, 'Afflicted Vermin', 'river');
      R.check('Creature-Surprise (Afflicted Vermin) wählt die Kreatur des River-Helden: die River bleibt zu (Ist-Zustand W46a), der Träger-Held brennt nicht', !surprise(t, op, RIVER) && !t.hero(me, 0).statuses.burned, { s: surprise(t, op, RIVER) });
      R.check('… und die Wahl der Vermin wirkt wie bisher (die Kreatur ist besiegt), sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    {   // Per-Hero-Sperre / Rekursion: die River-Brandwunde trifft den Angreifer; er hat selbst eine River an Held 0 — kein Hänger, jede Surprise höchstens einmal
      const t = await lauf(me, op, 'Gold Trap', 'river', { setup: async (t) => { t.putSurprise(me, 0, RIVER); } });
      R.check('Gold Trap des Wählers + eigene River des Wählers: kein Hänger, sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
