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
//  · `brettWert`          (W80a) Wert einer Kreatur fuer die BRETTBEWERTUNG der CPU (`evaluateState`): Level, HP, Rest-HP, Buffs — 30 fuer die Standard-Kreatur
//                         (Level 0, 60 HP), proportional mehr fuer staerkere (Grenzen BRETT_MIN/BRETT_MAX). Ohne Skriptwissen (das rechnet `evaluateState` selbst).
//  · `mitMehrfachtreffer` / `zweitwurfEintrag` (W80a) erwartete weitere Treffer desselben Effekts: Mehrfachtreffer-Spells (`cpuMeta.erwarteteSchlaege`: Kirin Firebreath,
//                         Future Tech Barrage) und der Zweitwurf der Zusatzziel-Helden (Bartas, Grisgar, Andras; `zusatzziel` am Heldenskript).
//  · `kreaturenAnHelden`  (W80a) Kreaturen in den Support Zones eines Helden (Whirlwind Strike).
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, BUFF_EFFECTS, hasCardType } = require('./_hooks');

/** Zahl oder Rueckfall. */
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

function seiteVon(engine, inst) {
  return inst.controller ?? inst.owner;
}

const NEGATIVE_STATUS = Object.keys(STATUS_EFFECTS).filter(k => STATUS_EFFECTS[k].negative);   // einmal berechnet (Brettbewertung ruft oft)

function negativeStatusAn(inst) {
  return NEGATIVE_STATUS.some(k => inst.counters?.[k]);
}

/**
 * Relativer Wert einer Kreatur (Skala der Monia-CPU: Level-0 ~60, Level-3/300 HP ~95).
 * Basis: 20 + 15 × Level + min(40, HP/10) — dazu Rest-HP-Anteil, Buffs/Zaehler, Faehigkeiten, Stapel, Todes-Nutzen.
 */
function kreaturWert(engine, inst, opts = {}) {
  if (!inst) return 0;
  const roh = !!opts.roh;   // W80a: Brettwert — ohne Skriptwissen (cpuMeta) und ohne Stapel; die Brettbewertung rechnet `onDeathBenefit`, `cpuInstBonus` und Ketten selbst
  let cd = null;
  try { cd = engine.getEffectiveCardData?.(inst) || engine._getCardDB?.()[inst.name]; } catch { cd = null; }
  cd = cd || {};
  let lvl = num(cd.level);
  try { const l = engine.kreaturLevelJetzt?.(inst); if (Number.isFinite(l)) lvl = l; } catch { /* Basiswert */ }
  const maxHp = num(inst.counters?.maxHp ?? cd.hp);
  const hp = num(inst.counters?.currentHp ?? cd.hp);
  let w = 20 + 15 * lvl + Math.min(40, Math.round(hp / 10));
  // Rest-HP: eine angeschlagene Kreatur ist weniger wert als eine frische (Anteil, nie unter 70 %).
  const restFaktor = (maxHp > 0 && hp < maxHp) ? 0.7 + 0.3 * Math.max(0, Math.min(1, hp / maxHp)) : 1;
  if (!opts.ohneRestHp) w *= restFaktor;   // W80a: der Brettwert wendet den Rest-HP-Anteil NACH seiner Obergrenze an (sonst verschluckt sie Teilschaden an starken Kreaturen)

  // Buffs: positive Buffs erhoehen (max. +16), negative Status/Debuffs senken (max. -9). (Spiel-Zaehler einzelner Karten kennt nur ihr Skript: cpuMeta.cpuInstBonus.)
  let plus = 0, minus = 0;
  const buffs = inst.counters?.buffs;
  if (buffs) for (const b in buffs) {
    if (BUFF_EFFECTS[b]?.debuff) minus += 3; else plus += 4;
  }
  const zaehler = inst.counters;
  if (zaehler) for (const k of NEGATIVE_STATUS) {
    if (zaehler[k]) minus += 3;
  }
  w +=Math.min(16, plus) - Math.min(9, minus);

  // Faehigkeiten/Skriptwissen: Kettenquellen, Sonderwert (cpuMeta), Todesnutzen fuer den Besitzer (Futter ist weniger wert).
  if (!roh) try {
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
  if (!roh) try {
    const slot = engine.gs.players[engine.physicalSide(inst)]?.supportZones?.[inst.heroIdx]?.[inst.zoneSlot];
    if (Array.isArray(slot) && slot.length > 1) w += Math.min(18, 6 * (slot.length - 1));
  } catch { /* kein Stapel bekannt */ }

  if (opts.restOut) opts.restOut.faktor = restFaktor;
  return Math.max(10, Math.round(w));
}

// ── Brettwert (W80a, Al 26.10.2026: "evaluateState gewichtet Kreaturen nach Level und Rest-HP statt flach 30") ─────────────────────
/** Die Standard-Kreatur der Brettbewertung zaehlte bisher flach 30; Level 0 mit 60 HP ist die Referenz (roher Wert 26). */
const BRETT_BASIS = 30;
const BRETT_REFERENZ = 26;
const BRETT_MIN = 15;
const BRETT_MAX = 75;
/** 1 = proportional zum rohen Wert (Vorgabe Al); kleiner = flachere Kurve (nur fuer Messlaeufe: `PP_CPU_BRETT_STEIGUNG`). */
const BRETT_STEIGUNG = Number.isFinite(Number(process.env.PP_CPU_BRETT_STEIGUNG)) && process.env.PP_CPU_BRETT_STEIGUNG ? Number(process.env.PP_CPU_BRETT_STEIGUNG) : 1;

/**
 * Wert einer Kreatur fuer die Brettbewertung der CPU: BRETT_BASIS × roher Wert / Referenz, auf [BRETT_MIN, BRETT_MAX] begrenzt.
 * Roh = Level, HP, Rest-HP-Anteil, Buffs/Debuffs (`kreaturWert(.., { roh: true })`); Fertigkeiten, Todesnutzen und Ketten bleiben bei der Brettbewertung selbst.
 */
function brettWert(engine, inst) {
  const rest = { faktor: 1 };
  const w = kreaturWert(engine, inst, { roh: true, ohneRestHp: true, restOut: rest });
  const voll = Math.max(BRETT_MIN, Math.min(BRETT_MAX, BRETT_BASIS * (1 + BRETT_STEIGUNG * (w / BRETT_REFERENZ - 1))));
  return Math.round(voll * rest.faktor);   // Rest-HP-Anteil (0,7 … 1) NACH der Begrenzung: Teilschaden bleibt auch bei starken Kreaturen sichtbar
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
 * k: { erste (Instanz), art, detail?, statusName?, quelle (Name), quelleOwner, vorab?: [Instanzen], heroIdx?/heroOwner? (Wirker-Held, wenn bekannt) }
 * @returns {Array<{ inst, art, detail, statusName, sourceOwner, sicher, herkunft: 'erste'|'vorab'|'gewaehlt'|'flaeche'|'zweitwurf' }>}
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

  // (4) W80a: Zweitwurf (Bartas, Grisgar, Andras): trifft der Hauptwurf genau EIN Ziel und steht ein Zusatzziel-Held beim Wirker, folgt voraussichtlich ein zweites Ziel desselben Effekts.
  if (k.erste && out.length === 1 && out[0].herkunft === 'erste') {
    const z = zweitwurfEintrag(engine, { quelle: k.quelle, quelleOwner: k.quelleOwner, heroIdx: k.heroIdx, heroOwner: k.heroOwner }, basis, gesehen);
    if (z) out.push(z);
  }
  return out;
}

// ── Erwartete weitere Treffer desselben Effekts (W80a) ───────────────────────────────────────────────────

/**
 * Wie oft schlaegt der Spell voraussichtlich auf dasselbe Ziel zu (Mehrfachtreffer)? Das Skript sagt es ueber `cpuMeta.erwarteteSchlaege(engine, besitzer)`
 * (Kirin Firebreath: Rebelliokai-Namen in der Ablage, Future Tech Barrage: Exemplare in der Ablage); sonst 1. Im Zweitwurf der Zusatzziel-Helden schlaegt er nur EINMAL.
 */
function erwarteteSchlaege(engine, quelle, quelleOwner) {
  try {
    if (engine.gs?._zweitzielWurf) return 1;
    const { loadCardEffect } = require('./_loader');
    const f = loadCardEffect(quelle)?.cpuMeta?.erwarteteSchlaege;
    if (typeof f !== 'function') return 1;
    const n = Math.floor(Number(f(engine, quelleOwner)));
    return Number.isFinite(n) && n >= 1 ? Math.min(n, 12) : 1;
  } catch { return 1; }
}

/**
 * Wahrscheinlichkeit (0..1), dass der Wirker dieses Effekts ein ZWEITES Ziel treffen darf (Bartas/Grisgar/Andras): ein handlungsfaehiger Zusatzziel-Held (Skript-Merkmal
 * `zusatzziel` = { kind, zauberSchule?, faehigkeit }) steht auf der Seite des Wirkers, der Spell/die Attack ist NORMAL, passt zur Schule, hat Originalstufe < Faehigkeitsstufe
 * und darf ein Zweitziel haben (`spellErlaubtZweitziel`). Der Wirker-Held ist bekannt (`heroOwner`/`heroIdx`): 0,85 wenn er der Zusatzziel-Held ist, sonst 0; unbekannt: 0,5.
 */
function zweitwurfChance(engine, k) {
  try {
    const { loadCardEffect } = require('./_loader');
    const { spellErlaubtZweitziel } = require('./_second-target-shared');
    if (!k.quelle || typeof k.quelleOwner !== 'number' || engine.gs?._zweitzielWurf) return 0;
    const data = engine._getCardDB()[k.quelle];
    if (!data || String(data.subtype || '').toLowerCase() !== 'normal') return 0;
    const typ = hasCardType(data, 'Spell') ? 'Spell' : hasCardType(data, 'Attack') ? 'Attack' : null;
    if (!typ) return 0;
    if (!spellErlaubtZweitziel(loadCardEffect(k.quelle))) return 0;
    let best = 0;
    for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(k.quelleOwner)) {
      if (!hero?.name || hero.hp <= 0 || hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
      const z = loadCardEffect(hero.name)?.zusatzziel;
      if (!z || z.kind !== typ) continue;
      if (typ === 'Spell' && data.spellSchool1 !== z.zauberSchule && data.spellSchool2 !== z.zauberSchule) continue;
      const stufe = engine.countAbilitiesForSchool(z.faehigkeit, engine.gs.players[physOwner]?.abilityZones?.[heroIdx] || []);
      if ((data.level || 0) >= stufe) continue;
      const wirkerBekannt = Number.isInteger(k.heroIdx) && k.heroIdx >= 0 && typeof k.heroOwner === 'number';
      const w = wirkerBekannt ? ((physOwner === k.heroOwner && heroIdx === k.heroIdx) ? 0.85 : 0) : 0.5;
      best = Math.max(best, w);
    }
    return best;
  } catch { return 0; }
}

/** Anteil, mit dem das erwartete Zweitziel gewertet wird (der Wirker darf wollen/waehlen: nicht jede Chance wird genutzt, das Ziel ist seine Wahl). */
const ZWEITWURF_ANTEIL = 0.6;

/**
 * Das voraussichtliche ZWEITZIEL des Zweitwurfs als Listeneintrag: bei genau EINEM bekannten Ziel des Hauptwurfs und einem Zusatzziel-Helden beim Wirker die wertvollste noch nicht
 * erfasste Kreatur eines GEGNERS des Wirkers (der Wirker trifft nicht die eigene Seite). `basis` = Eintrag-Vorlage ({ art, amount, detail, statusName, sourceOwner }); `bekannte` =
 * Ids, die schon in der Liste stehen. @returns {object|null} Eintrag mit `sicher` < 1 und `herkunft: 'zweitwurf'`
 */
function zweitwurfEintrag(engine, k, basis, bekannte) {
  const chance = zweitwurfChance(engine, k);
  if (!(chance > 0)) return null;
  let best = null, bestW = -1;
  for (const inst of engine.cardInstances || []) {
    if (inst.zone !== 'support' || inst.faceDown || bekannte.has(inst.id)) continue;
    const ctrl = seiteVon(engine, inst);
    if (ctrl === k.quelleOwner) continue;
    let cd = null;
    try { cd = engine.getEffectiveCardData?.(inst) || engine._getCardDB()[inst.name]; } catch { cd = null; }
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    const w = wirkungAuf(engine, inst, basis);
    if (!w.richtung || !(w.staerke > 0)) continue;
    const wert = kreaturWert(engine, inst) * w.staerke;
    if (wert > bestW) { bestW = wert; best = inst; }
  }
  if (!best) return null;
  return { inst: best, ...basis, sicher: Math.round(chance * ZWEITWURF_ANTEIL * 100) / 100, herkunft: 'zweitwurf' };
}

/**
 * Schadensstapel eines Effekts → Liste fuer `kreaturenBilanz` MIT den erwarteten weiteren Treffern (W80a): Mehrfachtreffer (Schaden × erwartete Schlagzahl, solange der Spell
 * dasselbe Ziel trifft) und Zweitwurf (genau EIN bekanntes Ziel → voraussichtliches Zweitziel mit dem Schaden EINES Schlags).
 * eintraege: [{ inst, amount, sourceOwner?, canBeNegated?, source? }] · k: { quelle, quelleOwner, heroOwner?, heroIdx? }
 */
function mitMehrfachtreffer(engine, eintraege, k) {
  const liste = [];
  const ids = new Set();
  const n = (eintraege || []).some(e => e?.inst) ? erwarteteSchlaege(engine, k.quelle, k.quelleOwner) : 1;
  for (const e of eintraege || []) {
    if (!e?.inst) continue;
    ids.add(e.inst.id);
    liste.push({ ...e, art: 'damage', amount: num(e.amount) * (n > 1 && eintraege.length === 1 ? n : 1) });
  }
  if (ids.size === 1) {
    const e0 = eintraege.find(e => e?.inst);
    const z = zweitwurfEintrag(engine, k, { art: 'damage', amount: num(e0.amount), sourceOwner: k.quelleOwner }, ids);
    if (z) liste.push(z);
  }
  return liste;
}

/** Die Kreaturen in den Support Zones eines Helden (Whirlwind Strike: "… and all Creatures in their Support Zones"), offen, Kontrolle egal. */
function kreaturenAnHelden(engine, physOwner, heroIdx) {
  const out = [];
  for (const inst of engine.cardInstances || []) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.owner !== physOwner || inst.heroIdx !== heroIdx) continue;   // wie Whirlwind Strike selbst (Besitzer, nicht Kontrolle)
    let cd = null;
    try { cd = inst.counters?._cardDataOverride || engine.getEffectiveCardData?.(inst) || engine._getCardDB()[inst.name]; } catch { cd = null; }
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push(inst);
  }
  return out;
}

// ── Flaechen-/Mehrziel-Bewertung fuer den WIRKER (W80a) ──────────────────────────────────────────────────

/** Ab dieser Wirkbilanz (Brettwert-Skala, Standard-Kreatur = 30) gilt ein Flaechenschlag als klar positiv. */
const FLAECHEN_SCHWELLE = 20;
/** Umrechnung `kreaturWert`-Skala → Brettskala (Standard-Kreatur Level 0/60 HP: 26 → 30). */
const BRETT_FAKTOR = BRETT_BASIS / BRETT_REFERENZ;

/**
 * Wirkbilanz eines Flaechenschlags aus Sicht des WIRKERS `pi` auf KREATUREN (Brettskala): Wert der getroffenen GEGNERISCHEN Kreaturen MINUS Wert der getroffenen EIGENEN,
 * jeweils nach der echten Wirkung je Kreatur (`kreaturenBilanz`: Schaden anteilig an der Rest-HP, toedlich = voll; Status 0,6 …). Kreaturen des durch die Erste-Runden-Immunitaet
 * geschuetzten Spielers zaehlen nicht.
 * k: { art ('damage' | 'status' …), amount?, statusName?, nurSitze?: [Spielerindizes] (Standard: alle), filter?(inst) → boolean }
 * @returns {{ wirk:number, gegner:number, eigen:number, posten:object[] }} wirk = gegner − eigen (Brettskala)
 */
function flaechenWirkung(engine, pi, k = {}) {
  const n = typeof engine.playerCount === 'function' ? engine.playerCount() : 2;
  const sitze = k.nurSitze || Array.from({ length: n }, (_, i) => i);
  let ziele = [];
  try { ziele = engine.collectAoeCreatureTargets(sitze, {}, ['creature']); } catch { ziele = []; }
  const prot = engine.gs?.firstTurnProtectedPlayer;
  const liste = [];
  for (const { inst } of ziele) {
    if (k.filter && !k.filter(inst)) continue;
    const seite = seiteVon(engine, inst);
    if (prot != null && seite === prot && pi !== prot) continue;
    if (inst.counters?._cardinalImmune) continue;
    liste.push({ inst, art: k.art || 'damage', amount: k.amount, statusName: k.statusName, detail: k.detail, sourceOwner: pi });
  }
  const r = kreaturenBilanz(engine, pi, liste);
  // `kreaturenBilanz(opfer = pi)`: `verloren` = Wert dessen, was GEGNERISCHEN Kreaturen widerfaehrt, `geschuetzt` = was EIGENEN widerfaehrt (Schaden) — fuer den Wirker umgekehrt gelesen.
  return { wirk: (r.verloren - r.geschuetzt) * BRETT_FAKTOR, gegner: r.verloren * BRETT_FAKTOR, eigen: r.geschuetzt * BRETT_FAKTOR, posten: r.posten };
}

/** Veto-Entscheidung zu einer Wirkbilanz: spielen nur bei klar positiver Bilanz (mindestens FLAECHEN_SCHWELLE UND ein Fuenftel der Gegnerseite). */
function flaechenVeto(r, extraGegner = 0) {
  return !(r.wirk >= FLAECHEN_SCHWELLE && r.wirk >= 0.2 * (r.gegner + Math.max(0, extraGegner)));
}

/**
 * Wirkung von Whirlwind Strike & Co. auf die KREATUREN in den Support Zones eines Helden (Brettskala, aus Sicht des Wirkers `pi`): getroffene gegnerische Kreaturen zaehlen
 * positiv, getroffene eigene negativ (die Wahl `side: 'enemy'` laesst keinen eigenen Helden zu, eine geliehene/uebernommene Kreatur in der Zone kann aber eigen sein).
 */
function heldKreaturenWirkung(engine, pi, physOwner, heroIdx, amount) {
  const liste = kreaturenAnHelden(engine, physOwner, heroIdx).map(inst => ({ inst, art: 'damage', amount, sourceOwner: pi }));
  if (!liste.length) return 0;
  const r = kreaturenBilanz(engine, pi, liste);
  return (r.verloren - r.geschuetzt) * BRETT_FAKTOR;
}

module.exports = { kreaturWert, brettWert, BRETT_BASIS, BRETT_MIN, BRETT_MAX, wirkungAuf, greift, schuetzt, kreaturenBilanz, absehbareKreaturen, flaechenBereichAusText, schadensFaktor,
  erwarteteSchlaege, zweitwurfChance, zweitwurfEintrag, mitMehrfachtreffer, kreaturenAnHelden,
  FLAECHEN_SCHWELLE, BRETT_FAKTOR, flaechenWirkung, flaechenVeto, heldKreaturenWirkung };
