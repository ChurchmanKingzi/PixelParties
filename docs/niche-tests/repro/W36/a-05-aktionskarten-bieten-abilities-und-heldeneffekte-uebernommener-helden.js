'use strict';
// W36a · Punkt 2 · Al, 22.10.2026 (Antwort auf W35a-Rückfrage 2): „Ja" — The Master's Plan („… they may immediately perform a different Action instead"), Lunar Eclipse („… perform a different Action
//  instead"), Off Duty („… perform a different Action afterwards"), Dream Dust („… perform an additional Action") und Shamanic Curse („… perform an additional Action afterwards") bieten dem OPFER der
//  Negierung (dem Spieler, dessen Karte negiert wurde) die Ersatz-/Zusatzaktion mit JEDEM Helden an, den er kontrolliert – auch mit Abilities und Heldeneffekten mit Aktionskosten eines
//  ÜBERNOMMENEN Helden (Flag `mitUebernommenenAktionen` am Aufruf von `performImmediateActionAnyHero`, wie bei Guardian Beast Hu seit W35a). Allgemeinregel (Al): „Sofern ein Klau-Effekt einen Hero nicht
//  ausdrücklich am Handeln hindert, darf er immer auch Reactions einsetzen" (und damit handeln). Die Karten, die nur Karten eines Typs/Namens anbieten (Spider Dance, Loving Puppet Pavi, Traveler from
//  the Future, The Third Circle of Hell), bleiben unverändert (Gegenprobe).
//  Aufbau: das Opfer V (Sitz v, am Zug) kontrolliert den Held 0 des Reaktionsspielers (temporär, Charme-Art, oder dauerhaft, Paraseed-Art): Adventurousness-Ability bzw. Champion-Heldeneffekt.
//  Prüfung: der heroAction-Prompt des Opfers enthält den Eintrag mit `charmedOwner` = Brettseite des übernommenen Helden (Ability UND Heldeneffekt).
// Aufruf: node docs/niche-tests/repro/W36/a-05-aktionskarten-bieten-abilities-und-heldeneffekte-uebernommener-helden.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const CH = 'Champion, the Stormbringer', ADV = 'Adventurousness';
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);

/** Opfer v (am Zug) kontrolliert Reaktionsspieler-Held `r:2` (Ability oder Heldeneffekt); die Reaktionskarte liegt in der Hand/Zone von `r` bei Held 0. */
async function szene(v, art, karte, wie) {
  const r = 1 - v;
  const hand = [[], []];
  const cfg = {
    master: { vHand: ['Fireball'], rHand: ["The Master's Plan"] },
    offduty: { vHand: [H.INERT.creature], rHand: ['Off Duty'] },
    shamanic: { vHand: ['Fireball'], rHand: ['Shamanic Curse'] },
    dust: { vHand: ['Fireball'], rHand: ['Dream Dust'] },
    lunar: { vHand: ['Fireball'], rHand: [] },
  }[karte];
  hand[v] = [...cfg.vHand, H.INERT.filler, H.INERT.filler]; hand[r] = [...cfg.rHand, H.INERT.filler, H.INERT.filler];   // Füllkarten: der Champion-Effekt wirft Handkarten ab
  const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: v });
  if (karte === 'shamanic') t.setAbilities(v, 0, [['Destruction Magic', 'Destruction Magic'], [], []]);   // Fireball Lv2 = exakt ausreichend → Shamanic Curse hebt auf 3 → negiert
  else if (karte === 'offduty') t.setAbilities(v, 0, [[], [], []]);
  else t.grantFor(v, 0, 'Fireball');
  if (karte !== 'lunar') t.grantFor(r, 0, cfg.rHand[0]);
  if (karte === 'lunar') {
    t.putSurprise(r, 0, 'Lunar Eclipse'); t.grantFor(r, 0, 'Lunar Eclipse');
    t.put(r, 0, 0, 'Lunatic Cycle - New Moon').counters.treatAsEquip = 1;
  }
  if (karte === 'dust') { const tr = t.put(r, 1, 0, H.INERT.creature); tr.counters.attachedHero = 'Tushu, the Knowledge Keeper'; }
  // der übernommene Held: r:2
  if (art === 'ability') t.setAbilities(r, 2, [[ADV, ADV], [], []]); else t.setHero(r, 2, CH, 800);
  if (wie === 'dauerhaft') await t.engine.actionTakeHeroPermanently(v, r, 2); else t.engine.actionStealHero(v, r, 2);
  await sleep(250);
  t.gs.activePlayer = v;
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'optionPicker' && !d._anzahlWahl && !d.options.some(o => o.id === 'skip'), answer: (d) => ({ optionId: d.options[0].id }) });
  t.targetFn = (valid) => {
    const dust = valid.find(x => x.type === 'equip' && x.owner === r && x.heroIdx === 1);
    if (karte === 'dust' && dust) return [dust.id];
    return [(posHero(valid, r, 0) || valid[0]).id];
  };
  const rec = [];
  t.script.push({ match: d => d && d.type === 'heroAction' && d.eligibleCards !== undefined && d.title !== 'zzz', answer: (d) => { rec.push(d); return { cancelled: true }; } });
  return { t, r, rec };
}
async function ausloesen(t, v, r, karte) {
  t.gs.activePlayer = v;
  const res = karte === 'offduty' ? await t.play(v, H.INERT.creature, { hero: 0, slot: 0 }) : await t.play(v, 'Fireball', { hero: 0, noGrant: true });
  await t.run(() => t.engine._runPostChainActions());   // wie die Play-Handler von server.js (`.finally`): die zurückgestellte Ersatz-/Zusatzaktion jetzt anbieten
  return res;
}
const eintrag = (d, liste, hi, seite) => ((d && d[liste]) || []).find(e => e.heroIdx === hi && (e.charmedOwner ?? null) === seite);

(async () => {
  const R = H.runner();
  const KARTEN = { master: "The Master's Plan", offduty: 'Off Duty', shamanic: 'Shamanic Curse', dust: 'Dream Dust', lunar: 'Lunar Eclipse' };
  for (const v of [0, 1]) {
    for (const wie of ['temporaer', 'dauerhaft']) {
      for (const [k, name] of Object.entries(KARTEN)) {
        for (const art of ['ability', 'effect']) {
          R.section(`Opfer Sitz ${v} · ${name} · übernommener Held (${wie}) · ${art === 'ability' ? 'Ability Adventurousness' : 'Heldeneffekt Champion'}`);
          const { t, r, rec } = await szene(v, art, k, wie);
          const rrec = await ausloesen(t, v, r, k);
          const d = rec[0];
          R.check(`${name} hat die Karte negiert und dem Opfer die Ersatz-/Zusatzaktion angeboten (heroAction-Prompt an Sitz ${v})`, rec.length >= 1, { prompts: t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || '')) });
          const e = art === 'ability' ? eintrag(d, 'activatableAbilities', 2, r) : eintrag(d, 'activatableHeroEffects', 2, r);
          R.check(`der Prompt enthält ${art === 'ability' ? 'die Ability' : 'den Heldeneffekt'} des übernommenen Helden (charmedOwner ${r})`, !!e, d && { ab: d.activatableAbilities, ef: d.activatableHeroEffects });
          R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
        }
      }
    }
  }
  // Gegenprobe: ohne Übernahme (eigener Held mit der Ability) wird sie auch angeboten (Normalfall), und die Typ-/Namensfilter-Karten (Spider Dance & Co.) bieten nichts Fremdes an.
  R.section('Gegenprobe: die vier eingeschränkten Karten (Spider Dance, Loving Puppet Pavi, Traveler from the Future, The Third Circle of Hell) setzen das Flag NICHT');
  for (const n of ['spider-dance', 'loving-puppet-pavi', 'traveler-from-the-future', 'the-third-circle-of-hell']) {
    const src = require('fs').readFileSync(__dirname + '/../../../../cards/effects/' + n + '.js', 'utf8');
    R.check(`${n}: kein mitUebernommenenAktionen`, !/mitUebernommenenAktionen/.test(src), null);
  }
  for (const n of ['the-master-s-plan', 'lunar-eclipse', 'off-duty', 'dream-dust', 'shamanic-curse', 'guardian-beast-hu']) {
    const src = require('fs').readFileSync(__dirname + '/../../../../cards/effects/' + n + '.js', 'utf8');
    R.check(`${n}: setzt mitUebernommenenAktionen: true`, /mitUebernommenenAktionen: true/.test(src), null);
  }
  R.finish();
})();
