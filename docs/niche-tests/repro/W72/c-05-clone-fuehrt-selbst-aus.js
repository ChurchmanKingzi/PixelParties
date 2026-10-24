'use strict';
// W72c-05 · Clone führt die Kopie SELBST aus (Al, 24.10.): Schadensquelle = Klon (Held-Effekte wie Shrink gelten nicht),
// Animationen starten am Platz des Klons, Surprises sehen den Klon als Angreifer.
const H = require('../../lib/h.js');
const CARD = 'Clone';
const isHero = (v, owner, hi) => v.type === 'hero' && v.owner === owner && (hi == null || v.heroIdx === hi);
const setAtk = (t, seat, hi, atk) => { t.gs.players[seat].heroes[hi].atk = atk; t.gs.players[seat].heroes[hi].baseAtk = atk; };
async function wirken(t, seat, hi, karte, ziele) {
  t.targetFn = (valid) => ziele.filter(id => valid.some(v => v.id === id));
  t.setHand(seat, [karte]);
  const r = await t.play(seat, karte, { hero: hi });
  t.targetFn = null;
  return r;
}
async function shrinkAuf(t, seat, hi) {
  t.targetFn = (valid) => { const v = valid.find(x => isHero(x, seat, hi)); return v ? [v.id] : undefined; };
  t.setHand(0, ['Shrink']);
  const r = await t.play(0, 'Shrink', { hero: 0 });
  t.targetFn = null; t.resetActions(0);
  return r;
}

(async () => {
  const R = H.runner();

  R.section('A · Shrink am Wirker: das Original macht 1, die Kopie des Klons vollen Schaden');
  {
    const t = await H.fresh({ hand: [['Shrink'], []] });
    t.put(0, 0, 0, CARD); setAtk(t, 0, 0, 100);
    t.grantFor(0, 0, 'Shrink');
    const ok = await shrinkAuf(t, 0, 0);
    R.check('Shrink liegt am eigenen Helden', ok === true && !!t.hero(0, 0).statuses.shrunk, ok);
    t.prompts.length = 0;
    const vorher = t.hp(1, 0);
    await wirken(t, 0, 0, 'Attack', ['hero-1-0']);
    R.check(`Original 1 + Kopie 100 = 101 (HP ${vorher} → ${t.hp(1, 0)})`, vorher - t.hp(1, 0) === 101, [vorher, t.hp(1, 0)]);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  {
    // Gegenprobe: der Klon eines Helden OHNE Shrink — beide Treffer voll
    const t = await H.fresh({ hand: [['Attack'], []] });
    t.put(0, 0, 0, CARD); setAtk(t, 0, 0, 100);
    const vorher = t.hp(1, 0);
    await wirken(t, 0, 0, 'Attack', ['hero-1-0']);
    R.check('ohne Shrink: 2 × 100', vorher - t.hp(1, 0) === 200, [vorher, t.hp(1, 0)]);
  }
  {
    // Der Shrink-Held bleibt als ZIEL betroffen: trifft der Klon eines Gegners ihn, wird verdoppelt (Schaden, den der Held erleidet)
    const t = await H.fresh({ hand: [['Shrink'], ['Attack']] });
    t.put(1, 0, 0, CARD); setAtk(t, 1, 0, 100);
    t.grantFor(0, 0, 'Shrink');
    await shrinkAuf(t, 0, 0);
    t.resetActions(1);
    const vorher = t.hp(0, 0);
    await wirken(t, 1, 0, 'Attack', ['hero-0-0']);
    R.check('Ziel mit Shrink: Original 200 + Kopie 200 = 400', vorher - t.hp(0, 0) === 400, [vorher, t.hp(0, 0)]);
  }

  {
    // Kreaturenziel: dieselbe Trennung im Kreaturen-Schadenspfad
    const t = await H.fresh({ hand: [['Shrink'], []] });
    t.put(0, 0, 0, CARD); setAtk(t, 0, 0, 100);
    t.grantFor(0, 0, 'Shrink');
    await shrinkAuf(t, 0, 0);
    const ziel = t.put(1, 0, 0, 'Chaorc Cannon Fodder');
    const hp0 = ziel.counters.currentHp ?? t.engine._getCardDB()['Chaorc Cannon Fodder'].hp;
    await wirken(t, 0, 0, 'Attack', [`equip-1-0-0`]);
    const hp1 = ziel.counters.currentHp ?? 0;
    R.check(`Kreatur: Original 1 + Kopie 100 = 101 (HP ${hp0} → ${hp1})`, hp0 - hp1 === 101, [hp0, hp1]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('B · Animation: der Dash der Kopie startet am Platz des Klons');
  {
    const t = await H.fresh({ hand: [['Quick Attack'], []] });
    const klon = t.put(0, 0, 1, CARD);
    t.events.length = 0;
    const rams = [];
    const bc = t.engine._broadcastEvent.bind(t.engine);
    t.engine._broadcastEvent = (ev, data, ...r) => { if (ev === 'play_ram_animation') rams.push({ ...data, _ovr: t.gs._spellCasterOverride ? { ...t.gs._spellCasterOverride } : null }); return bc(ev, data, ...r); };
    await wirken(t, 0, 0, 'Quick Attack', ['hero-1-0']);
    R.check('zwei Dashes (Original + Kopie)', rams.length === 2, rams.length);
    R.check('Original startet am Helden (kein Platz-Override)', rams[0] && rams[0]._ovr === null, rams[0]);
    R.check(`Kopie startet am Platz des Klons (Slot ${klon.zoneSlot}): Override verankert den Dash dort`, rams[1] && rams[1]._ovr && rams[1]._ovr.zoneSlot === klon.zoneSlot && rams[1]._ovr.heroIdx === rams[1].sourceHeroIdx, rams[1]);
    R.check('Zustand danach: kein Rest der Klon-Marken', t.gs._klonKopie === undefined && t.gs._spellCasterOverride === undefined && t.gs._spellCasterCreature === undefined,
      [t.gs._klonKopie, t.gs._spellCasterOverride]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('C · Surprise: der Klon ist der Angreifer der Kopie, der Held der des Originals');
  {
    const t = await H.fresh({ hand: [['Attack'], []] });
    const klon = t.put(0, 0, 0, CARD); setAtk(t, 0, 0, 100);
    t.putSurprise(1, 0, 'Booby Trap'); t.putSurprise(1, 0, 'Booby Trap'); for (let hi = 0; hi < 3; hi++) t.grantFor(1, hi, 'Booby Trap');
    const quellen = [];
    const rw = t.engine._rewriteSourceForCreatureCaster.bind(t.engine);
    t.engine._rewriteSourceForCreatureCaster = (src) => { const r = rw(src); if (src && src.name === 'Attack') quellen.push(r && r._creatureCasterForSource ? r._creatureCasterForSource.id : null); return r; };
    const vorher = t.hp(0, 0);
    await wirken(t, 0, 0, 'Attack', ['hero-1-0']);
    const akt = t.logs.filter(l => l.type === 'surprise_activated' && l.data.card === 'Booby Trap').length;
    R.check('Booby Trap löst im Fenster des Originals aus (Held als Angreifer: Rückstoß 100 auf den Helden)', akt >= 1 && vorher - t.hp(0, 0) >= 100, [akt, vorher, t.hp(0, 0)]);
    R.check('Surprise-Fenster des Originals: Angreifer = Held (keine Kreatur)', quellen.length > 0 && quellen[0] === null, quellen);
    R.check('Surprise-Fenster der Kopie: Angreifer = Klon', quellen.includes(klon.id), [quellen, klon.id]);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
