'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  W71b — Sweeps „keine Kreaturen-Primitive ohne Monia-Fenster" (Al, 25.10.2026)
//
//  Jede Karte / Aktivierung / Reaktion / jedes Passive läuft in einer Szene mit Kreaturen auf BEIDEN Seiten (Monia aktiv auf Sitz m, Handkarten) über die echten Spielwege (lib/h.js).
//  Der Wächter (lib/monia-waechter.js) meldet jeden Schreibzugriff auf eine bestehende Kreatur, für den in der laufenden Auflösung KEIN Monia-Fenster (`beforeCreatureAffected` /
//  `beforeCreatureDamageBatch`) für diese Kreatur offen war. Erwartung: keine Meldung außer den dokumentierten Ausnahmen (`AUSNAHMEN`, jede mit Begründung).
//  Monia lehnt immer ab (der Effekt läuft wie ohne Monia) — gemessen wird die Reihenfolge „Fenster vor Schreiben", nicht der Ausgang.
//  Einsatz: `await Z.handkarten(R, { m, mod, rest })` → { karten, laeufe, funde, fehler }; die Aufrufer prüfen `funde` (Liste der Verstöße).
// ═══════════════════════════════════════════════════════════════════════════
const S = require('./monia-sweep.js');
const WA = require('./monia-waechter.js');
const Zs = require('./zustands-sweep.js');
const { H, DB } = S;

/** Dokumentierte Ausnahmen: wer hier steht, ist KEIN „Effekt auf eine Kreatur" im Sinne von Monia (Muster gegen `Fundstelle | Art:Schlüssel | Quelle | Kreatur`). */
const AUSNAHMEN = [
  [/tearing-mountain\.js/, 'Tearing Mountain: „any effects that would prevent targets from being Burned are negated" (Ruling 23.10.) — das Brennen ignoriert jeden Schutz, Monia eingeschlossen'],
  [/the-sun-sword\.js/, 'The Sun Sword: dauerhafte Aura („targets you control cannot be Frozen") — ein Zustand, kein Effekt bei der Auflösung'],
  [/war-counselor\.js/, 'War Counselor: dauerhafte Aura („cannot be chosen by your opponent\'s cards")'],
  [/deepsea-siren\.js/, 'Deepsea Siren: die Verknüpfung ist Zielwahl/Markierung; Schaden und „also defeat" des Ziels laufen später über die Fenster'],
  [/_teocuilatl-shared\.js|suspicious-monster\.js|occultism\.js|_deepsea-shared\.js:9\d\d/, 'Opfer/Tribut/Ersatz-Beschwörung = Kosten des Kontrolleurs (Ruling 1.8.: „Monia darf Opfer nicht beschützen")'],
  [/_slippery-shared\.js:1[56]\d/, 'Slippery-Kreaturen gleiten am Zugbeginn durch ihren EIGENEN Text (Selbst-Effekt)'],
  [/aligning-goals\.js|_spy-shared/, 'Aligning Goals / Spy: Erlaubnis, den aktiven Effekt zu nutzen — kein Effekt auf die Kreatur selbst'],
  [/time-bomblebee\.js/, 'Burning Fuse: die Bomblebee zählt auf sich selbst (Selbst-Effekt der eigenen Karte)'],
  [/Call of the Deepsea/, 'Call of the Deepsea: löscht eine bereits BESIEGTE Kreatur'],
  [/\| (Hot Skull Potato|Slippery Pengu)( |$)/, 'Hot Skull Potato / Slippery Pengu bewegen sich selbst'],
];
const ausnahme = (zeile) => AUSNAHMEN.find(([re]) => re.test(zeile));

/** Meldungen eines Laufs in „Fundstelle | Art:Schlüssel | Quelle | Kreatur"-Zeilen. */
const zeilen = (wa) => [...new Set(wa.meldungen.filter(x => !(x.quelle && x.kreatur.startsWith(x.quelle + '@'))).map(x => `${x.wo} | ${x.art}:${x.schluessel} | ${x.quelle || ''} | ${x.kreatur.split('@')[0]}`))];

const kreaturenListe = () => Object.values(DB).filter(c => /creature/i.test(c.cardType) && c.cardType !== 'Hero' && c.name && !/^ZZ /.test(c.name) && !/Token/.test(c.cardType));

/** Zerstören + Schaden + Beschwören + Fireball + Attack als Auslöser für Passive (beide Sitze), dazu zwei Zugwechsel davor und danach. */
async function ausloeser(t, m) {
  const step = async (fn) => { try { await t.run(fn); } catch (e) { /* weiter */ } };
  const dummy = (s) => t.engine.cardInstances.find(x => x.zone === 'support' && x.name === 'ZZ Dummy Big' && (x.controller ?? x.owner) === s);
  await step(() => t.endTurn()); await step(() => t.endTurn());
  for (const s of [0, 1]) {
    await step(() => { const v = dummy(s); return v ? t.engine.actionDestroyCard({ name: 'Test', owner: 1 - s, heroIdx: 0 }, v, {}) : null; });
    await step(() => { const v = dummy(s); return v ? t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1 - s, heroIdx: 0 }, v, 50, 'fire', { sourceOwner: 1 - s }) : null; });
  }
  for (const s of [0, 1]) await step(() => t.play(s, 'ZZ Dummy', { hero: s === m ? 2 : 1, slot: 2 }));
  for (const s of [0, 1]) await step(() => t.play(s, 'Fireball', { hero: s === m ? 1 : 0 }));
  for (const s of [0, 1]) await step(() => t.play(s, 'Attack', { hero: s === m ? 1 : 0 }));
  await step(() => t.endTurn()); await step(() => t.endTurn());
}

function neuerBericht() { return { laeufe: 0, funde: [], fehler: [], karten: 0, fenster: 0, motive: new Set() }; }
function melde(b, name, wo, zlist) {
  for (const z of zlist) { const a = ausnahme(`${name} :: ${z}`); if (!a) b.funde.push(`${name} @ ${wo}: ${z}`); else b.motive.add(a[1]); }
}

/** Handkarten (Spell, Attack, Creature, Artifact, Potion, Ability) × Wirker (Gegner | Monias Besitzer) × Zielseite, mit Zugumlauf; optional zusätzlich mit echten Kreaturen auf dem Brett. */
async function handkarten(R, o) {
  const m = o.m ?? 0, mod = o.mod ?? 1, rest = o.rest ?? 0;
  const kinds = new Set(['Spell', 'Attack', 'Creature', 'Artifact', 'Potion', 'Ability']);
  const karten = Object.values(DB).filter(c => kinds.has(c.cardType) && c.name && !/^ZZ /.test(c.name)).filter((c, i) => i % mod === rest);
  const b = neuerBericht(); b.karten = karten.length;
  const KRE = kreaturenListe();
  const hash = (s) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  for (const card of karten) {
    const boards = [{ id: 'dummy', namen: [] }];
    if (o.echteBretter) {
      let x = hash(card.name) || 1; const rnd = () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296;
      boards.push({ id: 'echt', namen: Array.from({ length: 8 }, () => KRE[Math.floor(rnd() * KRE.length)].name) });
    }
    for (const brett of boards) for (const wirker of ['gegner', 'eigen']) {
      try {
        const sc = await S.szene({ m, extraBrett: (t, m_, o_, put) => {
          const freiM = [[0, 1], [0, 2], [1, 1], [1, 2], [2, 1], [2, 2]], freiO = [[0, 1], [0, 2], [1, 1], [1, 2], [2, 0], [2, 2]];
          brett.namen.forEach((n, i) => { const [s, f] = i % 2 === 0 ? [m_, freiM] : [o_, freiO]; const k = Math.floor(i / 2); if (k < f.length) { try { put(s, f[k][0], f[k][1], n); } catch (e) { /* weiter */ } } });
        } });
        const { t, o: oo } = sc;
        const caster = wirker === 'gegner' ? oo : m, hero = wirker === 'gegner' ? 0 : 1;
        S.skript(t, 'nein');
        S.zielwahl(t, wirker === 'gegner' ? m : oo);
        const vor = S.schnappschuss(t);
        const wa = WA.installiere(t, { ids: new Set(Object.keys(vor)) });
        try { await t.play(caster, card.name, { hero, slot: 2 }); } catch (e) { /* weiter */ }
        await S.ende(t, caster);
        await t.run(() => t.endTurn()); await t.run(() => t.endTurn());
        b.laeufe++; b.fenster += wa.fensterAnzahl;
        melde(b, card.name, `${brett.id}/${wirker}`, zeilen(wa));
        if (t.errors.length) b.fehler.push(`${card.name} (${brett.id}/${wirker}): ${t.errors[0].slice(0, 100)}`);
      } catch (e) { b.fehler.push(`${card.name} (${brett.id}/${wirker}): ${String(e.message).slice(0, 100)}`); }
    }
  }
  return b;
}

/** Aktivierungen (Held, Area, Kreatur, Ausrüstung, freie/aktive Ability, Permanent, Ablage-Effekt) × Wirker. */
async function aktivierungen(R, o) {
  const m = o.m ?? 0, mod = o.mod ?? 1, rest = o.rest ?? 0;
  const liste = Zs.aktivierungsListe().filter((x, i) => i % mod === rest);
  const b = neuerBericht(); b.karten = liste.length;
  for (const [g, name] of liste) for (const wirker of ['gegner', 'eigen']) {
    try {
      const { t, o: oo } = await S.szene({ m });
      const seat = wirker === 'gegner' ? oo : m, hi = wirker === 'gegner' ? 0 : 1;
      S.skript(t, 'nein'); S.zielwahl(t, wirker === 'gegner' ? m : oo);
      const vor = S.schnappschuss(t);
      const wa = WA.installiere(t, { ids: new Set(Object.keys(vor)) });
      let call; const slot = 2;
      if (g === 'held') { t.setHero(seat, hi, name, 800); call = () => t.activateHero(seat, hi); }
      else if (g === 'area') { t.putArea(seat, name); call = () => { t.gs.activePlayer = seat; t.phase(2); return t.engine.activateAreaEffect(seat, seat, name); }; }
      else if (g === 'kreatur') { t.put(seat, hi, slot, name).turnPlayed = 1; call = () => { t.gs.activePlayer = seat; t.phase(2); return t.activateCreature(seat, hi, slot); }; }
      else if (g === 'ausruestung') { t.put(seat, hi, slot, name).turnPlayed = 1; call = () => t.activateEquip(seat, hi, slot); }
      else if (g === 'frei') { t.setAbilities(seat, hi, [[name], [], []]); call = () => { t.gs.activePlayer = seat; t.phase(2); return t.host.doActivateFreeAbility(t.room, seat, { heroIdx: hi, zoneIdx: 0 }); }; }
      else if (g === 'permanent') { t.gs.players[seat].permanents.push({ id: 'perm-w71', name, counters: {} }); call = () => { t.gs.activePlayer = seat; t.phase(2); return t.host.doActivatePermanent(t.room, seat, { permId: 'perm-w71', ownerIdx: seat }); }; }
      else if (g === 'ablage') { t.gs.players[seat].discardPile.push(name); const inst = t.engine._trackCard(name, seat, 'discard'); call = () => { t.gs.activePlayer = seat; t.phase(2); return t.host.doActivateDiscardEffect(t.room, seat, { instId: inst.id }); }; }
      else { t.setAbilities(seat, hi, [[name], [], []]); call = () => { t.gs.activePlayer = seat; t.phase(3); return t.host.doActivateAbility(t.room, seat, { heroIdx: hi, zoneIdx: 0 }); }; }
      await t.run(call);
      if (t.gs.potionTargeting && t.gs.potionTargeting.ownerIdx === seat) await t.resolveTargeting(seat);
      await S.ende(t, seat);
      b.laeufe++; b.fenster += wa.fensterAnzahl;
      melde(b, `${g}:${name}`, wirker, zeilen(wa));
      if (t.errors.length) b.fehler.push(`${g}:${name} (${wirker}): ${t.errors[0].slice(0, 100)}`);
    } catch (e) { b.fehler.push(`${g}:${name} (${wirker}): ${String(e.message).slice(0, 100)}`); }
  }
  return b;
}

/** Passive und Auslöser: jede Kreatur / jeder Held / jede Ability / Ausrüstung / jeder Anhang / jede Area-Spell im Spiel, dann Zugwechsel + Zerstören/Schaden/Beschwören/Fireball/Attack. */
async function passive(R, o) {
  const m = o.m ?? 0, mod = o.mod ?? 1, rest = o.rest ?? 0;
  let items = [];
  for (const c of Object.values(DB)) {
    if (!c.name || /^ZZ /.test(c.name)) continue;
    if (/creature/i.test(c.cardType) && c.cardType !== 'Hero' && !/Token/.test(c.cardType)) items.push(['kreatur', c.name]);
    else if (c.cardType === 'Hero' || c.cardType === 'Ascended Hero') items.push(['held', c.name]);
    else if (c.cardType === 'Ability') items.push(['ability', c.name]);
    else if (c.cardType === 'Artifact' && /equipment/i.test(c.subtype || '')) items.push(['equip', c.name]);
    else if (c.cardType === 'Spell' && /attachment/i.test(c.subtype || '')) items.push(['anhang', c.name]);
    else if (c.cardType === 'Spell' && /area/i.test(c.subtype || '')) items.push(['area', c.name]);
  }
  items = items.filter((x, i) => i % mod === rest);
  const b = neuerBericht(); b.karten = items.length;
  for (const [g, name] of items) for (const wirker of ['gegner', 'eigen']) {
    try {
      const { t, o: oo } = await S.szene({ m });
      const seat = wirker === 'gegner' ? oo : m, hi = wirker === 'gegner' ? 0 : 1;
      S.skript(t, 'nein'); S.zielwahl(t, null);
      const vor = S.schnappschuss(t);
      const wa = WA.installiere(t, { ids: new Set(Object.keys(vor)) });
      const step = async (fn) => { try { await t.run(fn); } catch (e) { /* weiter */ } };
      if (g === 'kreatur') { t.put(seat, hi, 2, name).turnPlayed = 1; }
      else if (g === 'held') t.setHero(seat, hi, name, 800);
      else if (g === 'ability') t.setAbilities(seat, hi, [[name], [], []]);
      else { t.gs.players[seat].hand.unshift(name); t.engine._trackCard(name, seat, 'hand'); await step(() => t.play(seat, name, { hero: hi, slot: 1 })); }
      await ausloeser(t, m);
      b.laeufe++; b.fenster += wa.fensterAnzahl;
      melde(b, `${g}:${name}`, wirker, zeilen(wa));
      if (t.errors.length) b.fehler.push(`${g}:${name} (${wirker}): ${t.errors[0].slice(0, 100)}`);
    } catch (e) { b.fehler.push(`${g}:${name} (${wirker}): ${String(e.message).slice(0, 100)}`); }
  }
  return b;
}

const TRIGGER = ['Y-Attack-auf-Kreatur', 'Y-Attack-auf-Held', 'Y-Fireball-auf-Kreatur', 'X-Attack-auf-Kreatur', 'X-Attack-auf-Held', 'Y-beschwoert', 'X-Fireball-auf-Kreatur', 'Y-Fireball-auf-Held'];
/** Reaktionen und Surprises: Halter X (beide Sitze) × 8 Auslöser; die Karte liegt in der Hand bzw. verdeckt in der Surprise-Zone. */
async function reaktionen(R, o) {
  const m = o.m ?? 0, mod = o.mod ?? 1, rest = o.rest ?? 0;
  const istS = (c) => /surprise/i.test(c.subtype || ''), istR = (c) => /reaction/i.test(c.subtype || '');
  const karten = Object.values(DB).filter(c => c.name && !/^ZZ /.test(c.name) && c.cardType !== 'Hero' && (istS(c) || istR(c))).filter((c, i) => i % mod === rest);
  const b = neuerBericht(); b.karten = karten.length; b.ausgeloest = new Set();
  for (const card of karten) for (const X of [0, 1]) for (const trig of TRIGGER) {
    try {
      const { t } = await S.szene({ m });
      const Y = 1 - X;
      S.skript(t, 'nein'); t.policy.confirm = true;
      const hi = (s) => (s === m ? 1 : 0);
      const heldWahl = (seiteH) => { t.targetFn = (valid, config) => { const need = Math.max(1, (config && (config.minTargets || config.minRequired)) || 1); return valid.slice().sort((a, c) => (a.type === 'hero' && a.owner === seiteH ? 0 : 1) - (c.type === 'hero' && c.owner === seiteH ? 0 : 1)).slice(0, need).map(v => v.id); }; };
      if (istS(card)) t.putSurprise(X, hi(X), card.name); else { t.gs.players[X].hand.unshift(card.name); t.engine._trackCard(card.name, X, 'hand'); }
      const vor = S.schnappschuss(t);
      const wa = WA.installiere(t, { ids: new Set(Object.keys(vor)) });
      if (trig === 'Y-Attack-auf-Kreatur') { S.zielwahl(t, X); await t.play(Y, 'Attack', { hero: hi(Y) }); }
      else if (trig === 'Y-Attack-auf-Held') { heldWahl(X); await t.play(Y, 'Attack', { hero: hi(Y) }); }
      else if (trig === 'Y-Fireball-auf-Kreatur') { S.zielwahl(t, X); await t.play(Y, 'Fireball', { hero: hi(Y) }); }
      else if (trig === 'X-Attack-auf-Kreatur') { S.zielwahl(t, Y); await t.play(X, 'Attack', { hero: hi(X) }); }
      else if (trig === 'X-Attack-auf-Held') { heldWahl(Y); await t.play(X, 'Attack', { hero: hi(X) }); }
      else if (trig === 'Y-beschwoert') { await t.play(Y, 'ZZ Dummy', { hero: hi(Y) === 0 ? 2 : 1, slot: 2 }); }
      else if (trig === 'X-Fireball-auf-Kreatur') { S.zielwahl(t, Y); await t.play(X, 'Fireball', { hero: hi(X) }); }
      else if (trig === 'Y-Fireball-auf-Held') { heldWahl(X); await t.play(Y, 'Fireball', { hero: hi(Y) }); }
      await S.ende(t, Y);
      const verbraucht = istS(card) ? !(t.gs.players[X].surpriseZones.flat().includes(card.name)) : !t.gs.players[X].hand.includes(card.name);
      if (verbraucht) b.ausgeloest.add(card.name);
      b.laeufe++; b.fenster += wa.fensterAnzahl;
      melde(b, card.name, `${X}/${trig}`, zeilen(wa));
      if (t.errors.length) b.fehler.push(`${card.name} (${X}/${trig}): ${t.errors[0].slice(0, 100)}`);
    } catch (e) { b.fehler.push(`${card.name} (${X}/${trig}): ${String(e.message).slice(0, 100)}`); }
  }
  return b;
}

/** Ausgabe der Befunde über den Runner. */
function pruefe(R, label, b, o = {}) {
  R.check(`${label}: ${b.karten} Einträge, ${b.laeufe} Läufe, ${b.fenster} Monia-Fenster geöffnet`, b.karten > 0 && b.laeufe >= b.karten && b.fenster > (o.mindestFenster ?? 0), { karten: b.karten, laeufe: b.laeufe, fenster: b.fenster });
  R.check(`${label}: KEINE Kreaturen-Primitive ohne Monia-Fenster (Wächter ohne Meldung außer dokumentierten Ausnahmen)`, b.funde.length === 0, b.funde.slice(0, 12));
  R.check(`${label}: keine Engine-Fehler in den Läufen`, b.fehler.length === 0, b.fehler.slice(0, 8));
  for (const mot of b.motive) R.note(`dokumentierte Ausnahme genutzt: ${mot}`);
}

/** Der Wächter ist kein stummer Alarm: ein Schreibzugriff ohne Fenster wird gemeldet, derselbe nach `kreaturBetroffen` nicht; das Fenster einer ANDEREN Kreatur deckt nichts. */
async function selbsttest(R) {
  const { t } = await S.szene({ m: 0 });
  const k = t.engine.cardInstances.filter(c => c.zone === 'support' && c.name === 'ZZ Dummy Big');
  const wa = WA.installiere(t, { ids: new Set(k.map(c => c.id)) });
  k[0].counters.zz_probe = 1;                                                    // ohne Fenster
  R.check('Wächter-Selbsttest: Schreibzugriff ohne Fenster wird gemeldet', wa.meldungen.some(x => x.schluessel === 'zz_probe'), wa.meldungen.map(x => x.schluessel));
  const vorher = wa.meldungen.length;
  await t.engine.kreaturBetroffen(k[1], 'counter', 'Probe', { sourceOwner: 1 });  // Fenster für k[1]
  k[1].counters.zz_probe = 1;
  R.check('Wächter-Selbsttest: derselbe Zugriff nach dem Fenster der Kreatur wird NICHT gemeldet', wa.meldungen.length === vorher, wa.meldungen.slice(vorher));
  k[2].counters.zz_probe2 = 1;                                                   // Fenster von k[1] deckt k[2] nicht
  R.check('Wächter-Selbsttest: das Fenster einer anderen Kreatur deckt nichts', wa.meldungen.some(x => x.schluessel === 'zz_probe2'), wa.meldungen.map(x => x.schluessel));
  const t2 = (await S.szene({ m: 0 })).t;
  S.skript(t2, 'nein');
  const wa2 = WA.installiere(t2, { ids: new Set(t2.engine.cardInstances.filter(c => c.zone === 'support').map(c => c.id)) });
  const v = t2.engine.cardInstances.find(c => c.zone === 'support' && c.name === 'ZZ Dummy Big');
  await t2.run(() => require('../../../cards/effects/_deepsea-shared.js').returnSupportCreatureToHand(t2.engine, v, 'Probe', { sourceOwner: 1 }));
  R.check('Wächter-Selbsttest: Bounce über returnSupportCreatureToHand läuft hinter dem Fenster (keine Meldung, Fenster geöffnet)', wa2.meldungen.length === 0 && wa2.fensterAnzahl >= 1 && !t2.engine.cardInstances.includes(v), { mel: wa2.meldungen.length, fenster: wa2.fensterAnzahl, noch: t2.engine.cardInstances.includes(v) });
}

module.exports = { selbsttest, AUSNAHMEN, ausnahme, handkarten, aktivierungen, passive, reaktionen, pruefe, zeilen };
