'use strict';
// W28a · Frage von W25a zu N1-16 · Al, 21.10.2026: „Soll ein Berserk-Held (Text: ‚cannot summon Creatures') auch Kreatur-Surprises nicht aktivieren dürfen?" – „Korrekt, auch keine Creature-Surprises".
// Regel: Ein Held, der keine Kreaturen beschwören darf, aktiviert auch KEINE Kreatur-Surprise (Pure Advantage Camel, Cactus Creature, Afflicted Vermin, Jumper Spider, Man-Eater Birds, Banner Bearer …;
//   die Aktivierung ist eine Beschwörung/Platzierung, Ruling 3.10.). Gesperrt: Berserk (`berserked`) und die spielerweiten Beschwörungssperren des
//   Auslösers (`summonLocked`, Greatmaw-Remora-Teilsperre, Grinning Cat in der Hand). Reine Zauber-Sperren (`magic_silenced`, `nulled`, `frightened`) betreffen Kreatur-Surprises NICHT; Spell-Surprises
//   (Booby Trap) bleiben für Zauber-gesperrte Helden nicht aktivierbar (W25a, unverändert).
// Aufbau: `_canHeroActivateSurprise` (zentrales Tor aller Surprise-Fenster) je Karte/Zustand, beide Seiten (Sitz 0 und Sitz 1 halten die Surprise), Held normal / dauerhaft übernommen / gecharmt (dann
//   zählt der KONTROLLEUR: Berserk am Helden sperrt den Kontrolleur, die Sperren des Besitzers nicht). Dazu ein echter Spielweg (Pure Advantage Camel: Gegner zieht ausserhalb der Resource Phase).
// Aufruf: node docs/niche-tests/repro/W28/a-01-kreatur-surprise-nicht-ohne-beschwoerungsrecht.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const KREATUR_SURPRISES = ['Pure Advantage Camel', 'Cactus Creature', 'Afflicted Vermin', 'Jumper Spider', 'Man-Eater Birds', 'Mischief Militia - Banner Bearer'];
// UMGESTELLT in W31a (Al, 22.10.2026: „Creature Surprises kosten und gelten als KEINE Actions!"): `bound` („cannot perform an Action") sperrt Kreatur-Surprises NICHT mehr (war W28a: gesperrt).
const GESPERRT = ['berserked'];                       // Held darf nicht beschwören
const NUR_ZAUBER = ['magic_silenced', 'nulled', 'frightened', 'bound'];   // sperren nur Zauber bzw. Actions — Kreatur-Surprises bleiben aktivierbar

const bau = async () => H.fresh({ hand: [[], []], deckSize: 30 });
const kann = (t, seite, hi, name, opts) => !!t.engine._canHeroActivateSurprise(seite, hi, name, opts || {});

(async () => {
  const R = H.runner();
  for (const halter of [0, 1]) {
    for (const name of KREATUR_SURPRISES) {
      R.section(`${name} · Halter Sitz ${halter}`);
      { const t = await bau(halter); t.grantFor(halter, 0, name);
        R.check(`${name}: Gegenprobe ohne Status aktivierbar`, kann(t, halter, 0, name), null); }
      for (const st of GESPERRT) {
        const t = await bau(halter); t.grantFor(halter, 0, name); t.heroStatus(halter, 0, st);
        R.check(`${name} / ${st}: NICHT aktivierbar`, !kann(t, halter, 0, name), null);
      }
      for (const st of NUR_ZAUBER) {
        const t = await bau(halter); t.grantFor(halter, 0, name); t.heroStatus(halter, 0, st);
        R.check(`${name} / ${st}: bleibt aktivierbar (nur Zauber gesperrt)`, kann(t, halter, 0, name), null);
      }
      { const t = await bau(halter); t.grantFor(halter, 0, name); t.gs.players[halter].summonLocked = true;
        R.check(`${name} / summonLocked des Auslösers: NICHT aktivierbar`, !kann(t, halter, 0, name), null);
        t.gs.players[halter].summonLocked = false;
        R.check(`${name} / Sperre aufgehoben: wieder aktivierbar`, kann(t, halter, 0, name), null); }
      { const t = await bau(halter); t.grantFor(halter, 0, name); t.gs.players[halter].summonLockExceptGreatmaw = true;
        R.check(`${name} / Greatmaw-Remora-Teilsperre: NICHT aktivierbar (keine Greatmaw-Kreatur)`, !kann(t, halter, 0, name), null); }
      { const t = await bau(halter); t.grantFor(halter, 0, name); t.gs.players[1 - halter].summonLocked = true;
        R.check(`${name} / summonLocked des GEGNERS (nicht des Auslösers): aktivierbar`, kann(t, halter, 0, name), null); }
    }
    R.section(`Spell-Surprise Booby Trap · Halter Sitz ${halter} (W25a unverändert)`);
    for (const st of ['berserked', 'magic_silenced', 'nulled', 'frightened']) {
      const t = await bau(halter); t.grantFor(halter, 0, 'Booby Trap'); t.heroStatus(halter, 0, st);
      R.check(`Booby Trap / ${st}: NICHT aktivierbar`, !kann(t, halter, 0, 'Booby Trap'), null);
    }
    { const t = await bau(halter); t.grantFor(halter, 0, 'Booby Trap'); t.gs.players[halter].summonLocked = true;
      R.check('Booby Trap / summonLocked: weiter aktivierbar (Beschwörungssperre betrifft nur Kreaturen)', kann(t, halter, 0, 'Booby Trap'), null); }
  }

  R.section('Kontrolle: übernommener Held — es zählt der Kontrolleur');
  for (const art of ['dauerhaft', 'gecharmt']) {
    // Held 1:0 trägt die Surprise Pure Advantage Camel; Sitz 0 übernimmt ihn. Berserk am Helden sperrt den Kontrolleur (Sitz 0), Beschwörungssperre des Kontrolleurs ebenfalls.
    const mach = async () => {
      const t = await bau(1); t.grantFor(1, 0, 'Pure Advantage Camel');
      if (art === 'dauerhaft') { await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0)); await sleep(250); }
      else t.gs.players[1].heroes[0].charmedBy = 0;
      return t;
    };
    { const t = await mach();
      R.check(`${art}: Gegenprobe — der Kontrolleur (Sitz 0) kann aktivieren`, kann(t, 1, 0, 'Pure Advantage Camel', { reaktor: 0 }), null);
      R.check(`${art}: der Besitzer (Sitz 1) kann nicht (er kontrolliert den Helden nicht)`, !kann(t, 1, 0, 'Pure Advantage Camel', { reaktor: 1 }), null); }
    { const t = await mach(); t.heroStatus(1, 0, 'berserked');
      R.check(`${art} / berserked: auch der Kontrolleur kann keine Kreatur-Surprise aktivieren`, !kann(t, 1, 0, 'Pure Advantage Camel', { reaktor: 0 }), null); }
    { const t = await mach(); t.gs.players[0].summonLocked = true;
      R.check(`${art} / summonLocked des Kontrolleurs: NICHT aktivierbar`, !kann(t, 1, 0, 'Pure Advantage Camel', { reaktor: 0 }), null); }
    { const t = await mach(); t.gs.players[1].summonLocked = true;
      R.check(`${art} / summonLocked des Besitzers (nicht des Kontrolleurs): aktivierbar`, kann(t, 1, 0, 'Pure Advantage Camel', { reaktor: 0 }), null); }
  }

  R.section('Echter Spielweg: Pure Advantage Camel (Gegner zieht ausserhalb der Resource Phase)');
  for (const [status, erwartet] of [[null, true], ['berserked', false], ['bound', true], ['magic_silenced', true]]) {
    const t = await H.fresh({ hand: [[], []], deckSize: 30, active: 0, phase: 3 });
    t.putSurprise(1, 0, 'Pure Advantage Camel'); t.grantFor(1, 0, 'Pure Advantage Camel');
    if (status) t.heroStatus(1, 0, status);
    await t.run(async () => { await t.engine.actionDrawCards(0, 1); await t.engine._flushSurpriseDrawChecks(); });   // das Fenster öffnet erst im Sammelpunkt nach der Effektauflösung
    const fenster = t.prompts.some(p => p.pi === 1 && p.d.title === 'Pure Advantage Camel');
    const liegt = t.gs.players[1].surpriseZones[0].includes('Pure Advantage Camel');
    const steht = t.inst(i => i.name === 'Pure Advantage Camel' && i.zone === 'support').length;
    R.check(`Camel / Halter-Held ${status || 'normal'}: ${erwartet ? 'Surprise löst aus, Camel steht auf dem Brett' : 'kein Fenster, Camel liegt verdeckt weiter'}`,
      erwartet ? (fenster || steht === 1) && !liegt : !fenster && liegt && steht === 0, { fenster, liegt, steht, prompts: t.prompts.map(p => p.pi + ':' + p.d.title) });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
