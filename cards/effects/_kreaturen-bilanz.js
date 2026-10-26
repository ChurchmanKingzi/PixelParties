// ═══════════════════════════════════════════
//  GEMEINSAME KREATUREN-BILANZ  (W78a, Al 26.10.2026)
//
//  EINE Wert-/Bilanzrechnung fuer "was geschieht mit den Kreaturen beider Seiten, wenn ein Effekt wirkt?" — gebaut fuer die Monia-CPU
//  (Annahme/Ablehnung von "Cool Rescue!"), aber bewusst allgemein, damit andere Flaechen-/Kontroll-Bewerter der CPU sie spaeter mitnutzen
//  koennen (heute rechnet jeder AoE-Weg seine eigene Naeherung, siehe CARD_API "Welle 78 / W78a").
//
//  Engine-Zugriff:  engine.kreaturWert(inst)
//                   engine.kreaturenBilanz(opfer, liste, opts)
//                   engine.absehbareKreaturen(kontext)
//
//  · `kreaturWert`        relativer Wert EINER Kreatur: Level, HP, Rest-HP-Anteil, Buffs/Zaehler, Faehigkeiten (cpuMeta), Stapel im Slot,
//                         Nutzen ihres Todes fuer den Besitzer. Skala: Level-0-Kreatur ~60, Level 3 mit 300 HP ~95.
//  · `wirkungAuf`         was der Effekt der Kreatur WIRKLICH antut: { richtung: 'schaden' | 'nutzen' | null, staerke 0..1 }.
//                         Schaden anteilig an der Rest-HP (toedlich = voll), Zerstoeren/Kontrollverlust voll, Bewegen 0,8, Status/Buff/Werte 0,6;
//                         Heilung/positive Buffs/Statusentfernung NUETZEN der Kreatur (Heilung nur soweit HP fehlen; Statusentfernung nur mit negativem Status).
//  · `kreaturenBilanz`    Bilanz aus Sicht von `opfer` fuer den Fall, dass die Wirkung auf ALLE Listeneintraege negiert wird:
//                         + Wert dessen, was einer EIGENEN Kreatur schaden wuerde bzw. einer gegnerischen nuetzen wuerde (wird verhindert),
//                         − Wert dessen, was einer GEGNERISCHEN Kreatur schaden wuerde bzw. einer eigenen nuetzen wuerde (ginge verloren).
//  · `absehbareKreaturen` Was die Engine VORAB ueber die weiteren Kreaturen-Ereignisse desselben Effekts weiss (erwartete Zielliste):
//                         (1) ausdruecklich angekuendigte Liste (`kreaturenVorab`), (2) schon gewaehlte Ziele des Effekts (`engine._gewaehlteZiele`),
//                         (3) Flaechen-Eigenschaft der Quelle (`hitsMultipleTargets` + Kartentext "all/every/each ... Creatures/targets ...").
//                         Jeder Eintrag traegt `sicher` (1 = bekannt, <1 = Vermutung aus dem Kartentext).
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, BUFF_EFFECTS } = require('./_hooks');

/** Zahl oder Rueckfall. */
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

function seiteVon(engine, inst) {
  return inst.controller ?? inst.owner;
}

function negativeStatusAn(inst) {
  return Object.keys(STATUS_EFFECTS).some(k => STATUS_EFFECTS[k].negative && inst.counters?.[k]);
}

/**
 * Relativer Wert einer Kreatur (Skala der Monia-CPU: Level-0 ~60, Level-3/300 HP ~95).
 * Basis: 20 + 15 × Level + min(40, HP/10) — dazu Rest-HP-Anteil, Buffs/Zaehler, Faehigkeiten, Stapel, Todes-Nutzen.
 */
function kreaturWert(engine, inst) {
  if (!inst) return 0;
  let cd = null;
  try { cd = engine.getEffectiveCardData?.(inst) || engine._getCardDB?.()[inst.name]; } catch { cd = null; }
  cd = cd || {};
  let lvl = num(cd.level);
  try { const l = engine.kreaturLevelJetzt?.(inst); if (Number.isFinite(l)) lvl = l; } catch { /* Basiswert */ }
  const maxHp = num(inst.counters?.maxHp ?? cd.hp);
  const hp = num(inst.counters?.currentHp ?? cd.hp);
  let w = 20 + 15 * lvl + Math.min(40, Math.round(hp / 10));
  // Rest-HP: eine angeschlagene Kreatur ist weniger wert als eine frische (Anteil, nie unter 70 %).
  if (maxHp > 0 && hp < maxHp) w *= 0.7 + 0.3 * Math.max(0, Math.min(1, hp / maxHp));

  // Buffs: positive Buffs erhoehen (max. +16), negative Status/Debuffs senken (max. -9). (Spiel-Zaehler einzelner Karten kennt nur ihr Skript: cpuMeta.cpuInstBonus.)
  let plus = 0, minus = 0;
  for (const b of Object.keys(inst.counters?.buffs || {})) {
    if (BUFF_EFFECTS[b]?.debuff) minus += 3; else plus += 4;
  }
  for (const k of Object.keys(STATUS_EFFECTS)) {
    if (STATUS_EFFECTS[k].negative && inst.counters?.[k]) minus += 3;
  }
  w +=Math.min(16, plus) - Math.min(9, minus);

  // Faehigkeiten/Skriptwissen: Kettenquellen, Sonderwert (cpuMeta), Todesnutzen fuer den Besitzer (Futter ist weniger wert).
  try {
    const { loadCardEffect } = require('./_loader');
    const meta = loadCardEffect(inst.name)?.cpuMeta;
    if (meta) {
      if (meta.chainSource) w += 15;
      if (typeof meta.cpuInstBonus === 'function') {
        const b = num(meta.cpuInstBonus(engine, inst, seiteVon(engine, inst)));
        w += Math.max(-20, Math.min(40, b)) * 0.5;
      }
      const roh = meta.onDeathBenefit;
      const tod = num(typeof roh === 'function' ? roh(engine, inst) : roh);
      if (tod > 0) w -= Math.min(25, tod * 0.8);
    }
  } catch { /* Skriptwissen ist Zugabe */ }

  // Stapel: weitere Karten im Slot der Kreatur (Anhaengsel/Ausruestung) sind mit ihr verloren.
  try {
    const slot = engine.gs.players[engine.physicalSide(inst)]?.supportZones?.[inst.heroIdx]?.[inst.zoneSlot];
    if (Array.isArray(slot) && slot.length > 1) w += Math.min(18, 6 * (slot.length - 1));
  } catch { /* kein Stapel bekannt */ }

  return Math.max(10, Math.round(w));
}

const GEWICHT_SCHADEN = { destroy: 1, control: 1, move: 0.8 };   // sonst 0,6 (Status/Buff/Werte/Sonstiges)

/** Schadensfaktor der Buffs (Cloudy 0,5, Damage Immune 0, Disrupted 2 …). */
function schadensFaktor(inst) {
  let m = 1;
  for (const b of Object.keys(inst.counters?.buffs || {})) {
    const f = BUFF_EFFECTS[b]?.damageMultiplier;
    if (typeof f === 'number') m *= f;
  }
  return m;
}

/**
 * Was tut der Effekt `e` der Kreatur WIRKLICH?
 * e: { art, amount?, sourceOwner?, detail?, statusName? }  (art wie `engine.kreaturBetroffen`: damage | destroy | heal | status | move | control | buff | counter | stats)
 * @returns {{ richtung: 'schaden'|'nutzen'|null, staerke: number }}  null = greift nicht / neutral
 */
function wirkungAuf(engine, inst, e) {
  const art = e.art || 'stats';
  const seite = seiteVon(engine, inst);
  const fremd = typeof e.sourceOwner === 'number' ? seite !== e.sourceOwner : true;   // Wirkt ein FREMDER auf die Kreatur?
  const hp = num(inst.counters?.currentHp ?? engine.getEffectiveCardData?.(inst)?.hp);
  const maxHp = num(inst.counters?.maxHp ?? engine.getEffectiveCardData?.(inst)?.hp, hp);
  const detail = String(e.detail || '');

  if (art === 'damage') {
    const dmg = Math.round(num(e.amount) * schadensFaktor(inst));
    if (dmg <= 0) return { richtung: null, staerke: 0 };
    const tot = hp > 0 && dmg >= hp;
    return { richtung: 'schaden', staerke: tot ? 1 : Math.min(1, dmg / Math.max(1, hp)) * 0.7 };
  }
  if (art === 'destroy') return { richtung: 'schaden', staerke: 1 };
  if (art === 'heal') {
    const fehlt = Math.max(0, maxHp - hp);
    return fehlt > 0 ? { richtung: 'nutzen', staerke: Math.min(1, fehlt / Math.max(1, maxHp)) * 0.6 } : { richtung: null, staerke: 0 };
  }
  if (art === 'control') return fremd ? { richtung: 'schaden', staerke: GEWICHT_SCHADEN.control } : { richtung: null, staerke: 0 };
  if (art === 'move') return fremd ? { richtung: 'schaden', staerke: GEWICHT_SCHADEN.move } : { richtung: null, staerke: 0 };
  if (art === 'status') {
    if (detail === 'cleanse') return negativeStatusAn(inst) ? { richtung: 'nutzen', staerke: 0.5 } : { richtung: null, staerke: 0 };
    const def = e.statusName ? STATUS_EFFECTS[e.statusName] : null;
    if (def && def.negative === false) return { richtung: 'nutzen', staerke: 0.4 };
    return { richtung: 'schaden', staerke: 0.6 };
  }
  if (art === 'buff') {
    const entfernen = detail.startsWith('remove:');
    const name = entfernen ? detail.slice(7) : detail;
    const def = name ? BUFF_EFFECTS[name] : null;
    if (def) {
      const schlecht = !!def.debuff;
      // Buff setzen: Debuff schadet, sonst nuetzt; Buff entfernen: umgekehrt.
      return (schlecht !== entfernen) ? { richtung: 'schaden', staerke: 0.6 } : { richtung: 'nutzen', staerke: 0.4 };
    }
    // Buff ohne bekannte Art: ein Fremder schwaecht, der Eigner staerkt.
    return fremd ? { richtung: 'schaden', staerke: 0.6 } : { richtung: 'nutzen', staerke: 0.4 };
  }
  // counter | stats | Sonstiges: ein Fremder schadet, der Eigner nuetzt.
  return fremd ? { richtung: 'schaden', staerke: 0.6 } : { richtung: 'nutzen', staerke: 0.4 };
}

/** Greift der Effekt auf diese Kreatur wirklich (Schaden > 0, HP fehlen, Status vorhanden …)? Fuer Animationen und Bilanz. */
function greift(engine, inst, e) {
  const w = wirkungAuf(engine, inst, e);
  return !!w.richtung && w.staerke > 0;
}

/** Bewahrt die Negation diese Kreatur vor einem SCHADEN (Schaden > 0, Zerstoeren, Kontrollverlust, Bounce, Debuff)? Nur dann "profitiert" sie von Monias Schutz (Animation). */
function schuetzt(engine, inst, e) {
  const w = wirkungAuf(engine, inst, e);
  return w.richtung === 'schaden' && w.staerke > 0 && e.canBeNegated !== false;
}

/**
 * Bilanz fuer `opfer`, wenn die Wirkung auf alle Listeneintraege NEGIERT wird.
 * liste: [{ inst, art, amount?, sourceOwner?, detail?, statusName?, sicher? }]  — `sicher` 0..1 (Standard 1)
 * @returns {{ bilanz:number, geschuetzt:number, verloren:number, eigeneBedroht:number, posten:object[] }}
 */
function kreaturenBilanz(engine, opfer, liste, opts = {}) {
  const posten = [];
  const gesehen = new Set();
  let geschuetzt = 0, verloren = 0, eigeneBedroht = 0;
  for (const e of liste || []) {
    const inst = e?.inst;
    if (!inst || inst.zone !== 'support' || inst.faceDown) continue;
    const dop = `${inst.id}|${e.art}`;
    if (gesehen.has(dop)) continue;
    gesehen.add(dop);
    if (e.canBeNegated === false) continue;   // nicht negierbar: Monia schuetzt/verschont hier nichts
    const w = wirkungAuf(engine, inst, e);
    if (!w.richtung || !(w.staerke > 0)) continue;
    const eigen = seiteVon(engine, inst) === opfer;
    const sicher = Math.max(0, Math.min(1, e.sicher == null ? 1 : e.sicher));
    const wert = kreaturWert(engine, inst) * w.staerke * sicher;
    const nuetztUns = (w.richtung === 'schaden') === eigen;   // Negieren hilft uns: Schaden an Eigenen / Nutzen an Gegnerischen verhindert
    posten.push({ name: inst.name, eigen, richtung: w.richtung, wert: Math.round(wert * 10) / 10, sicher, gewinn: nuetztUns ? wert : -wert });
    if (nuetztUns) geschuetzt += wert; else verloren += wert;
    if (eigen && w.richtung === 'schaden' && sicher >= 0.5) eigeneBedroht++;
  }
  return { bilanz: geschuetzt - verloren, geschuetzt, verloren, eigeneBedroht, posten };
}

// ── Vorab-Wissen ueber weitere Kreaturen-Ereignisse desselben Effekts ───────────────────────────────

const GRUPPE = /\b(?:all|every|each)\b(?: other)?[^.;]{0,50}?\b(?:Creatures?|targets?)\b[^.;]*/i;
const BEDINGUNG = /\b(?:with|that|which|whose|level|lvl|HP|named|except|other than|up to|at most|adjacent|random)\b/i;

/**
 * Welche Seiten meint der Kartentext einer Gruppe? → { seiten: 'gegner'|'eigen'|'beide', sicher } | null (keine Gruppenformulierung)
 */
function flaechenBereichAusText(text) {
  const m = GRUPPE.exec(String(text || ''));
  if (!m) return null;
  const klausel = m[0];
  let seiten;
  if (/both players|either player|each player|on the board|including the user|including you/i.test(klausel)) seiten = 'beide';
  else if (/\bopponent(?:'s)?\s+(?:currently\s+)?controls?\b|\bopponent's\s+(?:Creatures|Heroes|targets)\b|\bof your opponent\b(?!'s)|\btheir\b|\benemy\b/i.test(klausel)) seiten = 'gegner';
  else if (/\byou(?:r)?\s+(?:currently\s+)?control\b|\byour\s+(?:own\s+)?(?:Creatures|Heroes|targets)\b/i.test(klausel)) seiten = 'eigen';
  else seiten = 'beide';
  return { seiten, sicher: BEDINGUNG.test(klausel) ? 0.5 : 0.85 };
}

/**
 * Erwartete Gesamtliste der Kreaturen-Ereignisse EINES Effekts, beim ersten Ereignis.
 * k: { erste (Instanz), art, detail?, statusName?, quelle (Name), quelleOwner, vorab?: [Instanzen] }
 * @returns {Array<{ inst, art, detail, statusName, sourceOwner, sicher, herkunft: 'erste'|'vorab'|'gewaehlt'|'flaeche' }>}
 */
function absehbareKreaturen(engine, k) {
  const out = [];
  const gesehen = new Set();
  const basis = { art: k.art, detail: k.detail, statusName: k.statusName, sourceOwner: k.quelleOwner };
  const nimm = (inst, sicher, herkunft) => {
    if (!inst || inst.zone !== 'support' || inst.faceDown || gesehen.has(inst.id)) return;
    gesehen.add(inst.id);
    out.push({ inst, ...basis, sicher, herkunft });
  };
  if (k.erste) nimm(k.erste, 1, 'erste');

  // (1) ausdruecklich angekuendigte Liste (kreaturenVorab: Iceage, Medusa's Curse …)
  for (const inst of (k.vorab || [])) nimm(inst, 1, 'vorab');
  const angekuendigt = (k.vorab || []).length > 0;

  // (2) schon gewaehlte Ziele dieses Effekts
  let gewaehlt = 0;
  const gs = engine.gs;
  for (const z of (engine._gewaehlteZiele || [])) {
    if (z.turn !== gs.turn) continue;
    if (!k.quelle || !(z.quellen || []).includes(k.quelle)) continue;
    for (const id of z.ids || []) {
      const inst = engine.cardInstances.find(c => c.id === id);
      if (!inst) continue;
      if (!gesehen.has(inst.id)) gewaehlt++;
      nimm(inst, 1, 'gewaehlt');
    }
  }

  // (3) Flaechen-Eigenschaft der Quelle (Kartentext + hitsMultipleTargets) — nur wenn nichts Ausdrueckliches vorliegt oder der Text eine Gruppe nennt
  if (!angekuendigt && k.quelle && typeof k.quelleOwner === 'number') {
    let text = '', flag = false;
    try {
      text = engine._getCardDB()[k.quelle]?.effect || '';
      flag = !!require('./_loader').loadCardEffect(k.quelle)?.hitsMultipleTargets;
    } catch { /* kein Skript/Text */ }
    const ausText = flaechenBereichAusText(text);
    if (ausText || (flag && !gewaehlt)) {
      const bereich = ausText || { seiten: 'gegner', sicher: 0.5 };
      const n = typeof engine.playerCount === 'function' ? engine.playerCount() : 2;
      const sitze = [];
      for (let p = 0; p < n; p++) {
        if (bereich.seiten === 'beide' || (bereich.seiten === 'eigen' && p === k.quelleOwner) || (bereich.seiten === 'gegner' && p !== k.quelleOwner)) sitze.push(p);
      }
      let ziele = [];
      try { ziele = engine.collectAoeCreatureTargets(sitze, {}, ['creature']); } catch { ziele = []; }
      for (const { inst } of ziele) nimm(inst, bereich.sicher, 'flaeche');
    }
  }
  return out;
}

module.exports = { kreaturWert, wirkungAuf, greift, schuetzt, kreaturenBilanz, absehbareKreaturen, flaechenBereichAusText, schadensFaktor };
