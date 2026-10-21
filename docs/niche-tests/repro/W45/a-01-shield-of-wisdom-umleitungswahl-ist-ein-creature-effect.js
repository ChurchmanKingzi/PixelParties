'use strict';
// W45a · Punkt 1 · Al, 22.10.2026: „Doch, das soll binden, denn das, was eigentlich zielt, ist ja ein Creature-Effekt. Stelle sicher, dass der von Shield of Wisdom umgeleitete Effekt weiterhin den Typ Creature hat."
// Shield of Wisdom (cardType Artifact, Subtyp Surprise): „Activate this Surprise when the user or a Creature in its Support Zones is chosen by an opponent's Creature effect. Redirect that effect to any target your
// opponent controls, except the attacking Creature itself."
// Regel: Die Umleitungs-Zielwahl ist ein CREATURE effect (Quelle = die umgeleitete Kreatur, nicht die Karte Shield of Wisdom) und bindet deshalb den Taunt (Hardy Slime, Deepsea Horror Clown: nur wenn der Spötter
// selbst ein mögliches Ziel dieser Wahl ist). Der umgeleitete Effekt behält seinen Typ Creature (Leser wie Challenge sehen `sourceEffectKind` = 'creature' auch am neuen Ziel).
// Aufbau: Sitz `ang` besitzt Elven Archer („You may once per turn choose a target and deal 50 damage to it", ctx.promptDamageTarget) und den Spötter; Sitz `vert` hält Shield of Wisdom im Surprise Zone von Held 0
// und ist das Ziel. Beide Sitze. Exit 1 auf der Basis e1489df1 (Taunt bindet die Umleitungswahl nicht), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W45/a-01-shield-of-wisdom-umleitungswahl-ist-ein-creature-effect.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

function stempel(t, spoetter, gegen) {
  spoetter.turnPlayed = 1;
  spoetter.counters.forcesTargeting = true; spoetter.counters.forcesTargeting_pi = gegen; spoetter.counters.forcesTargeting_untilTurn = (t.gs.turn || 0) + 1;
  spoetter.counters.buffs = { ...(spoetter.counters.buffs || {}), forcesTargeting: true };
  return spoetter;
}

/** Szene: `ang` aktiviert den Elven Archer auf den Shield-Helden von `vert`; Rückgabe: die Angebote der Umleitungswahl. */
async function lauf(ang, vert, o = {}) {
  const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: ang, gold: 200 });
  const archer = t.put(ang, 1, 0, 'Elven Archer'); archer.turnPlayed = 1;
  const dummy = t.put(ang, 1, 1, H.INERT.creature); dummy.turnPlayed = 1;
  let spoetter = null;
  if (o.spoetter) { spoetter = t.put(ang, 2, 2, o.spoetter); if (o.taunt !== false) stempel(t, spoetter, vert); else spoetter.turnPlayed = 1; if (o.unwaehlbar) spoetter.counters.untargetable_all = true; }
  t.putSurprise(vert, 0, 'Shield of Wisdom'); t.grantFor(vert, 0, 'Shield of Wisdom');
  if (o.hand) { t.setHand(ang, o.hand); for (let hi = 0; hi < 3; hi++) t.grantFor(ang, hi, 'Challenge'); }
  const kinds = [];
  const orig = t.engine.sourceEffectKind.bind(t.engine);
  t.engine.sourceEffectKind = (s) => { const r = orig(s); if (s && s.name === 'Elven Archer') kinds.push(r); return r; };
  t.targetFn = (v, c) => {
    if (c && c.title === 'Shield of Wisdom') return [o.waehle ? o.waehle(v) : v.filter(x => !x.ineligible)[0].id];
    const h = v.find(x => x.type === 'hero' && x.owner === vert && x.heroIdx === 0);
    return [(h || v[0]).id];
  };
  t.gs.activePlayer = ang; t.phase(2);
  await t.run(() => t.host.doActivateCreatureEffect(t.room, ang, { heroIdx: 1, zoneSlot: 0 }));
  const shield = t.targets.filter(x => x.config && x.config.title === 'Shield of Wisdom');
  return { t, archer, dummy, spoetter, kinds, shield, angebot: shield.map(x => x.valid.filter(v => !v.ineligible).map(v => v.id).sort().join(',')) };
}

(async () => {
  const R = H.runner();
  for (const [ang, vert] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + vert + ' hält Shield of Wisdom (Angreifer: Sitz ' + ang + ')');
    const slimeId = `equip-${ang}-2-2`;
    const alle = [`hero-${ang}-0`, `hero-${ang}-1`, `hero-${ang}-2`, `equip-${ang}-1-1`, slimeId].sort().join(',');

    for (const spoetter of ['Hardy Slime', 'Deepsea Horror Clown']) {
      // ── Taunt: die Umleitungswahl ist ein Creature effect → nur der Spötter wählbar (er liegt im Pool; der Angreifer ist ausgenommen) ──
      {
        const r = await lauf(ang, vert, { spoetter });
        R.check(`${spoetter}: Shield hat ausgelöst (Umleitungswahl wurde angeboten oder der Pool hatte genau ein Ziel)`, r.shield.length >= 1 || r.t.logs.some(l => l.type === 'shield_of_wisdom'), r.t.logs.map(l => l.type));
        R.check(`${spoetter}: Taunt JA — Umleitungswahl bietet nur den Spötter an`, r.shield.length === 1 && r.angebot[0] === slimeId, r.angebot);
        const sl = r.t.logs.find(l => l.type === 'shield_of_wisdom');
        R.check(`${spoetter}: der Effekt landet auf dem Spötter (50 Schaden des Archers)`, !!sl && sl.data.newTarget === spoetter && sl.data.attacker === 'Elven Archer' && (r.spoetter.counters.currentHp ?? 0) < (r.t.engine.getEffectiveCardData(r.spoetter)?.hp ?? 1e9), { sl: sl && sl.data, hp: r.spoetter.counters.currentHp });
        R.check(`${spoetter}: sauber`, sauber(r.t), { errors: r.t.errors, audit: r.t.audit() });
      }
      // ── Gegenprobe: ohne Taunt freie Wahl ──
      {
        const r = await lauf(ang, vert, { spoetter, taunt: false });
        R.check(`${spoetter} ohne Taunt: freie Wahl (alle Ziele des Angreifers außer dem Archer)`, r.shield.length === 1 && r.angebot[0] === alle, r.angebot);
        R.check(`${spoetter} ohne Taunt: sauber`, sauber(r.t), { errors: r.t.errors, audit: r.t.audit() });
      }
    }
    // ── Gegenprobe: der Spötter ist selbst nicht wählbar ("if possible"): kein Taunt ──
    {
      const r = await lauf(ang, vert, { spoetter: 'Hardy Slime', unwaehlbar: true });
      const ohne = [`hero-${ang}-0`, `hero-${ang}-1`, `hero-${ang}-2`, `equip-${ang}-1-1`].sort().join(',');
      R.check('Hardy Slime nicht wählbar (untargetable_all): kein Taunt, übrige Ziele frei', r.shield.length === 1 && r.angebot[0] === ohne, r.angebot);
    }
    // ── Der umgeleitete Effekt behält den Typ Creature: Challenge des Angreifer-Sitzes (liest „Attack, Spell or Creature effect") reagiert auf das NEUE Ziel ──
    {
      const r = await lauf(ang, vert, { hand: ['Challenge'], waehle: (v) => `hero-${ang}-0` });
      const ch = r.t.prompts.filter(p => p.d && p.d.title === 'Challenge');
      R.check('Typ bleibt Creature: Challenge des neuen Ziel-Besitzers wird für den umgeleiteten Effekt angeboten', ch.length >= 1 && ch[0].pi === ang && /targeted by Elven Archer/.test(ch[0].d.message), r.t.prompts.map(p => p.d.title + '|' + p.d.message));
      R.check('Typ bleibt Creature: jeder Leser sah für den Elven Archer \'creature\' (auch am neuen Ziel)', r.kinds.length >= 2 && r.kinds.every(k => k === 'creature'), r.kinds);
      R.check('Typ bleibt Creature: sauber', sauber(r.t), { errors: r.t.errors, audit: r.t.audit() });
    }
    // ── Klassifikation direkt ──
    {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: ang, gold: 200 });
      const e = t.engine;
      const archer = t.put(ang, 1, 0, 'Elven Archer');
      R.check('sourceEffectKind(umgeleiteter Elven Archer) = creature', e.sourceEffectKind(archer) === 'creature');
      R.check('Quelle der Umleitungswahl (_tauntQuelleFuer mit _tauntQuelle) ist die Kreatur', e._tauntQuelleFuer(vert, { _tauntQuelle: archer }) === archer);
      R.check('Die Karte Shield of Wisdom selbst bleibt Artifact (\'surprise\'), wird nicht als Quelle der Wahl geführt', e.sourceEffectKind({ name: 'Shield of Wisdom', zone: 'surprise', owner: vert }) === 'surprise' && e.tauntGiltFuerQuelle({ name: 'Shield of Wisdom', zone: 'surprise', owner: vert }) === false);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
