'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  W66b — ZUSTANDS-DIFFERENZ-SWEEPS (Al, 23.10.2026: „Kosten UND Limits erst NACH dem Commit")
//
//  Methode (wie W64b/W63d, aber mit dem KOMPLETTEN serialisierbaren Spielzustand, lib/zustand.js): jede Karte / jede Aktivierung wird in der reichen Standard-Szene über den echten Spielweg gespielt
//  (MENSCH-Modus der Leitungs-Harness). Je Karte ein Durchlauf und ein Abbruch an JEDER abbrechbaren Stelle (ab dort durchgehend abbrechen). Geprüft wird
//    1. NACH dem Abbruch: Zustandsdifferenz = 0 — Gold, Hand/Ablage/Deck/Löschstapel/Potion Deck (Reihenfolge!), Brett, Marken/Stempel (`hoptUsed`, `_spellLockTurn`, Zähler …), Aktionen, Helden-/Kreaturzustände, Hook-Zustände;
//    2. nicht gespielte Karten (Karte bleibt auf der Hand, kein Abbruch): ebenfalls Differenz = 0 (ein Fehlversuch hinterlässt nichts);
//    3. BIS ZUR letzten echten Abbruchstelle ist noch nichts BEZAHLT: der Zustand beim Öffnen jeder dieser Fragen zeigt keine bezahlten Kosten (`BEZAHLT`: Gold, Ablage/Löschstapel, Helden-HP/-Status, Brett [Opfer,
//       Pollution Tokens …]). RESERVIERUNGEN sind erlaubt, solange Punkt 1 gilt (exakte Rückgabe) und der Gegner nichts sieht: Einmal-Stempel als Schutz gegen Verschachtelung (HOPT-Schlüssel der Aktivierungswege),
//       Aktionszähler, Absichts-Marken, und die Karte, die gerade gespielt/beschworen wird, aus Hand/Deck genommen (damit sie nicht ihr eigenes Opfer wird). Sie erscheinen als `reserviert` (nur Information).
//  „Echte Abbruchstelle" = ein Abbruch gibt die Karte zurück (Handkarten) bzw. der Gegner hat nichts gesehen (Aktivierungen; der Auftritt kommt erst beim Commit).
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const W = require('./wire.js');

const { istBezahlt, BUCHFUEHRUNG } = require('./zustand.js');
const pfadVon = (zeile) => String(zeile).split(': ')[0];
const ohneBuchfuehrung = (diff) => (diff || []).filter(z => !BUCHFUEHRUNG.test(pfadVon(z)));
const antwortStandard = (e) => (e.kind === 'generic' && e.d.type === 'cardNamePicker') ? { cardName: W.REICH.CRE[1] } : undefined;

/**
 * Handkarten-Sweep: alle spielbaren Handkarten (Spell, Attack, Creature, Artifact, Potion, Ability), Teilmenge `index % mod === rest`.
 * o: { seat, mod, rest, ausnahmenPrompt: Set<Kartenname> }
 */
async function handkarten(R, o) {
  const seat = o.seat ?? 0, mod = o.mod ?? 1, rest = o.rest ?? 0;
  const kinds = new Set(['Spell', 'Attack', 'Creature', 'Artifact', 'Potion', 'Ability']);
  const karten = Object.values(W.DB).filter(c => kinds.has(c.cardType) && c.name && !/^ZZ /.test(c.name)).filter((c, i) => i % mod === rest);
  const st = { karten: karten.length, gespielt: 0, ungespielt: 0, mitAbbruch: 0, abbrueche: 0, echteAbbrueche: 0 };
  const nachAbbruch = [], ungespieltRest = [], promptRest = [], reserviert = new Set(), fehler = [];
  for (const c of karten) {
    const name = c.name;
    try {
      const mk = async () => W.reicheSzene({ seat, karten: [name], scanState: false });
      const t = await mk();
      const clean = await W.spiele(t, seat, name, { hero: 0, timeoutMs: 6000, answer: antwortStandard });
      if (t.errors.length) fehler.push(`${name}: ${t.errors[0].slice(0, 100)}`);
      const gespielt = clean.handNachher < clean.handVorher;
      gespielt ? st.gespielt++ : st.ungespielt++;
      const nC = clean.tl.filter(e => e.k === 'answer-begin' && e.cancellable).length;
      if (!gespielt && nC === 0 && clean.appearances.length === 0 && (clean.zustandsDiff || []).length) ungespieltRest.push(`${name}: ${clean.zustandsDiff.slice(0, 3).join(' | ')}`);
      if (nC === 0) continue;
      st.mitAbbruch++;
      const echt = [];
      for (let k = 0; k < Math.min(nC, 5); k++) {
        const t2 = await mk();
        const r = await W.spiele(t2, seat, name, { hero: 0, timeoutMs: 6000, cancelAt: k, persist: true, answer: antwortStandard });
        st.abbrueche++;
        if (t2.errors.length) fehler.push(`${name}@${k}: ${t2.errors[0].slice(0, 100)}`);
        if (!r.undone) continue;                       // Karte war schon verbraucht: keine echte Abbruchstelle
        echt.push(k); st.echteAbbrueche++;
        if ((r.zustandsDiff || []).length) nachAbbruch.push(`${name} (Abbruch an Stelle ${k}): ${r.zustandsDiff.slice(0, 4).join(' | ')}`);
      }
      const kMax = echt.length ? Math.max(...echt) : -1;
      for (let k = 0; k <= kMax && k < clean.promptDiffs.length; k++) {
        const rest2 = ohneBuchfuehrung(clean.promptDiffs[k]);
        const bez = (clean.promptRoh[k] || []).filter(istBezahlt);
        if (bez.length && !(o.ausnahmenPrompt && o.ausnahmenPrompt.has(name))) promptRest.push(`${name} (vor Abbruchstelle ${k}): ${bez.slice(0, 4).map(d => d.pfad + ': ' + JSON.stringify(d.vorher).slice(0, 60) + ' → ' + JSON.stringify(d.nachher).slice(0, 60)).join(' | ')}`);
        else if (rest2.length) reserviert.add(name);
      }
    } catch (e) { fehler.push(`${name}: ${String(e.message).slice(0, 100)}`); }
  }
  return { st, nachAbbruch, ungespieltRest, promptRest, reserviert: [...reserviert], fehler };
}

/** Gruppen der Aktivierungen (Held, Area, Kreatur, Ausrüstung, freie Ability, Aktions-Ability) wie W64b — aus den Skripten abgeleitet. */
function aktivierungsListe() {
  const DIR = path.resolve(__dirname, '../../../cards/effects');
  const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const src = (n) => { try { return fs.readFileSync(path.join(DIR, slug(n) + '.js'), 'utf8'); } catch { return ''; } };
  const out = [];
  for (const c of Object.values(W.DB)) {
    if (!c.name || /^ZZ /.test(c.name)) continue;
    const s = src(c.name); if (!s) continue;
    if (c.cardType === 'Hero' && /heroEffect:\s*true/.test(s) && /onHeroEffect/.test(s)) out.push(['held', c.name]);
    if (/areaEffect:\s*true/.test(s) && /onAreaEffect/.test(s)) out.push(['area', c.name]);
    if (c.cardType === 'Creature' && /creatureEffect:\s*true/.test(s) && /onCreatureEffect/.test(s)) out.push(['kreatur', c.name]);
    if (c.cardType === 'Artifact' && /equipEffect|onEquipEffect/.test(s)) out.push(['ausruestung', c.name]);
    if (c.cardType === 'Ability' && /freeActivation|canFreeActivate|freeActivate/.test(s)) out.push(['frei', c.name]);
    else if (c.cardType === 'Ability' && /onActivate\b/.test(s)) out.push(['ability', c.name]);
    if (/onActivatePermanent/.test(s) && /canActivatePermanent/.test(s)) out.push(['permanent', c.name]);
    if (/onDiscardEffect/.test(s)) out.push(['ablage', c.name]);
  }
  return out;
}

/** Aktivierungs-Sweep. o: { seat, mod, rest, ausnahmenPrompt } */
async function aktivierungen(R, o) {
  const seat = o.seat ?? 0, mod = o.mod ?? 1, rest = o.rest ?? 0;
  const liste = aktivierungsListe().filter((x, i) => i % mod === rest);
  const st = { aktivierungen: liste.length, aktiviert: 0, mitAbbruch: 0, abbrueche: 0, echteAbbrueche: 0 };
  const nachAbbruch = [], promptRest = [], reserviert = new Set(), fehler = [];
  for (const [g, name] of liste) {
    try {
      const bau = async () => {
        const t = await W.reicheSzene({ seat, scanState: false });
        let call;
        if (g === 'held') { t.setHero(seat, 0, name, 800); call = () => t.activateHero(seat, 0); }
        else if (g === 'area') { t.putArea(seat, name); call = () => { t.gs.activePlayer = seat; t.phase(2); return t.engine.activateAreaEffect(seat, seat, name); }; }
        else if (g === 'kreatur') { t.put(seat, 0, 0, name).turnPlayed = 1; call = () => { t.gs.activePlayer = seat; t.phase(2); return t.activateCreature(seat, 0, 0); }; }
        else if (g === 'ausruestung') { t.put(seat, 0, 0, name).turnPlayed = 1; call = () => t.activateEquip(seat, 0, 0); }
        else if (g === 'frei') { t.setAbilities(seat, 0, [[name], [], []]); call = () => { t.gs.activePlayer = seat; t.phase(2); return t.host.doActivateFreeAbility(t.room, seat, { heroIdx: 0, zoneIdx: 0 }); }; }
        else if (g === 'permanent') { t.gs.players[seat].permanents.push({ id: 'perm-w66', name, counters: {} }); call = () => { t.gs.activePlayer = seat; t.phase(2); return t.host.doActivatePermanent(t.room, seat, { permId: 'perm-w66', ownerIdx: seat }); }; }
        else if (g === 'ablage') { t.gs.players[seat].discardPile.push(name); const inst = t.engine._trackCard(name, seat, 'discard'); call = () => { t.gs.activePlayer = seat; t.phase(2); return t.host.doActivateDiscardEffect(t.room, seat, { instId: inst.id }); }; }
        else { t.setAbilities(seat, 0, [[name], [], []]); call = () => { t.gs.activePlayer = seat; t.phase(3); return t.host.doActivateAbility(t.room, seat, { heroIdx: 0, zoneIdx: 0 }); }; }
        return { t, call };
      };
      const { t, call } = await bau();
      const r = await W.spiele(t, seat, name, { hero: 0, timeoutMs: 6000, call, answer: antwortStandard });
      if (t.errors.length) fehler.push(`${name}: ${t.errors[0].slice(0, 100)}`);
      if (r.appearances.length) st.aktiviert++;
      const nC = r.tl.filter(e => e.k === 'answer-begin' && e.cancellable).length;
      if (nC === 0) continue;
      st.mitAbbruch++;
      const echt = [];
      for (let k = 0; k < Math.min(nC, 5); k++) {
        const b2 = await bau();
        const r2 = await W.spiele(b2.t, seat, name, { hero: 0, timeoutMs: 6000, call: b2.call, cancelAt: k, persist: true, answer: antwortStandard });
        st.abbrueche++;
        if (b2.t.errors.length) fehler.push(`${name}@${k}: ${b2.t.errors[0].slice(0, 100)}`);
        if (!r2.cancelled || r2.appearances.length > 0) continue;       // Auftritt schon draußen = committed (kein Abbruch der Aktivierung)
        echt.push(k); st.echteAbbrueche++;
        if ((r2.zustandsDiff || []).length) nachAbbruch.push(`${name} (Abbruch an Stelle ${k}): ${r2.zustandsDiff.slice(0, 4).join(' | ')}`);
      }
      const kMax = echt.length ? Math.max(...echt) : -1;
      for (let k = 0; k <= kMax && k < r.promptDiffs.length; k++) {
        const rest2 = ohneBuchfuehrung(r.promptDiffs[k]);
        const bez = (r.promptRoh[k] || []).filter(istBezahlt);
        if (bez.length && !(o.ausnahmenPrompt && o.ausnahmenPrompt.has(name))) promptRest.push(`${name} (vor Abbruchstelle ${k}): ${bez.slice(0, 4).map(d => d.pfad + ': ' + JSON.stringify(d.vorher).slice(0, 60) + ' → ' + JSON.stringify(d.nachher).slice(0, 60)).join(' | ')}`);
        else if (rest2.length) reserviert.add(name);
      }
    } catch (e) { fehler.push(`${name}: ${String(e.message).slice(0, 100)}`); }
  }
  return { st, nachAbbruch, promptRest, reserviert: [...reserviert], fehler };
}

module.exports = { handkarten, aktivierungen, aktivierungsListe, BUCHFUEHRUNG, ohneBuchfuehrung };
