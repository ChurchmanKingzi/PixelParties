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
/** Umrechnung `kreaturWert`-Skala → Brettskala (Standard-Kreatur Level 0/60 HP: 26 → 30). */
const BRETT_FAKTOR = BRETT_BASIS / BRETT_REFERENZ;
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

/**
 * ★ W83a (Al 27.10.2026: "Faktor 0,7 für Geschädigte ist gut, das kann bei allen AoE-Sources angewandt werden"): eine Kreatur, die den Schaden ÜBERLEBT, zählt mit
 * 0,7 × (anteiliger Schaden an der Rest-HP) × Wert. EINE Konstante für alle CPU-Bewerter von Flächen-/Mehrziel-Effekten (`wirkungAuf`, `aoeWert`, `flaechenEntscheidung`, `pickEnemyTargets`).
 */
const UEBERLEBER_FAKTOR = 0.7;
/**
 * ★ W83a (Al 27.10.2026: die gegnerische Monia ist KEIN sicherer Schutz — die CPU weiss vorab nicht, ob der Gegner zahlt): eine nur WEICH geschützte Kreatur (bereite Reaktion des Gegners
 * des Wirkers, `cpuSchuetzt`: Cool Rescuer Monia, Winged Skeleton, Elusive Hind, Warrior of Teocuilatl) zählt anteilig — weder als sicher geschützt noch als sicher getroffen. 0,5 =
 * Münzwurf: Monia schützt BEIDE Seiten auf einmal, Gewinn UND eigener Verlust werden gleich gewichtet (Erwartungswert bei Zahlungswahrscheinlichkeit 1/2).
 */
const WEICH_FAKTOR = 0.5;

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
    return { richtung: 'schaden', staerke: tot ? 1 : Math.min(1, dmg / Math.max(1, hp)) * UEBERLEBER_FAKTOR };
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
    // Nicht negierbar: Monia schuetzt/verschont hier nichts (Monia-Sicht). Die Wirker-Sicht (`aoeWert`, `opts.ohneNegierung`) zaehlt die Wirkung trotzdem.
    if (e.canBeNegated === false && !opts.ohneNegierung) continue;
    // W82b/W83a (`opts.schutz`): wer die Wirkung ohnehin nicht nimmt (SICHERER Schutz: Immunitaet, Erstrunden-Schutz, Zielschutz …), gewinnt/verliert nichts — er faellt heraus;
    // WEICH Geschuetzte (bereite Reaktion des Gegners des Wirkers) zaehlen anteilig (`WEICH_FAKTOR`). Standard AUS (Monias Rechnung gibt `schutz` selbst mit; `aoeWert` schaltet es ein).
    let schutzFaktor = 1;
    if (opts.schutz) {
      const sch = opts.schutz === true ? {} : opts.schutz;
      const sp = kreaturGeschuetztVor(engine, sch.quelle ?? e.source ?? e.sourceOwner, inst, e.art, {
        amount: e.amount, damageType: e.type ?? sch.damageType, sourceOwner: e.sourceOwner, gerichtet: sch.gerichtet, statusName: e.statusName,
        canBeNegated: e.canBeNegated, ohne: sch.ohne,
      });
      if (sp.geschuetzt) { if (!sp.weich) continue; schutzFaktor = WEICH_FAKTOR; }
    }
    const w = wirkungAuf(engine, inst, e);
    if (!w.richtung || !(w.staerke > 0)) continue;
    const eigen = seiteVon(engine, inst) === opfer;
    const sicher = Math.max(0, Math.min(1, e.sicher == null ? 1 : e.sicher));
    const wert = kreaturWert(engine, inst) * w.staerke * sicher * schutzFaktor;
    const nuetztUns = (w.richtung === 'schaden') === eigen;   // Negieren hilft uns: Schaden an Eigenen / Nutzen an Gegnerischen verhindert
    posten.push({ name: inst.name, eigen, richtung: w.richtung, wert: Math.round(wert * 10) / 10, sicher, ...(schutzFaktor < 1 ? { weich: true } : {}), gewinn: nuetztUns ? wert : -wert });
    if (nuetztUns) geschuetzt += wert; else verloren += wert;
    if (eigen && w.richtung === 'schaden' && sicher >= 0.5) eigeneBedroht++;
  }
  return { bilanz: geschuetzt - verloren, geschuetzt, verloren, eigeneBedroht, posten };
}

// ── Gemeinsame Bewertung fuer Flaechen-/Mehrziel-Effekte (W83a, Al 27.10.2026) ────────────────────────

/**
 * Anteil (0 … 1), mit dem eine Kreatur in die Wertung eines Flaechen-/Mehrziel-Effekts der CPU eingeht — EINE Regel fuer alle Bewerter (Al: "Geschuetzte, die bereits zum Zeitpunkt der
 * Evaluation geschuetzt sind, sollen ueberall nicht einbezogen werden"): 0 = SICHER geschuetzt (Immunitaet, Erstrunden-Schutz, Zielschutz …: weder Gewinn noch Verlust), `WEICH_FAKTOR` =
 * weich geschuetzt (bereite Reaktion des Gegners des Wirkers, z. B. Monia: anteilig), sonst 1.
 * quelle/art/opts wie `kreaturGeschuetztVor`. @returns {{ faktor:number, geschuetzt:boolean, weich:boolean, grund:string|null }}
 */
function schutzAnteil(engine, quelle, inst, art, opts = {}) {
  const sp = kreaturGeschuetztVor(engine, quelle, inst, art, opts);
  if (!sp.geschuetzt) return { faktor: 1, geschuetzt: false, weich: false, grund: null };
  return { faktor: sp.weich ? WEICH_FAKTOR : 0, geschuetzt: true, weich: !!sp.weich, grund: sp.grund };
}

/**
 * ★ W83a (Al): DIE gemeinsame Rechnung fuer die CPU-Bewerter von Flaechen-/Mehrziel-Effekten aus Sicht des WIRKERS.
 *   quelle: Name der Karte | { name, owner, heroIdx } (Besitzer = Wirker) · liste: [{ inst, art, amount?, detail?, statusName?, type? (Schadensart), sicher?, canBeNegated? }]
 *   opts:   { wirker (Standard: Besitzer der Quelle), gerichtet (die Wirkung WAEHLT ihre Ziele), damageType (Standard fuer Eintraege ohne `type`) }
 * Regeln (alle Bewerter einheitlich): (i) bereits SICHER geschuetzte Kreaturen zaehlen weder als Gewinn noch als Verlust, WEICH geschuetzte anteilig (`WEICH_FAKTOR`); (ii) Ueberlebende
 * eines Schadens zaehlen mit `UEBERLEBER_FAKTOR` (0,7) × Anteil an der Rest-HP × Wert, Toedliches voll (`wirkungAuf`). Skala: `kreaturWert` (nicht Brettskala — Umrechnung × `BRETT_FAKTOR`).
 * @returns {{ wirkung:number, gewinn:number, verlust:number, eigeneBetroffen:number, posten:object[] }}  gewinn = Wert dessen, was GEGNERISCHEN schadet (bzw. Eigenen nuetzt),
 *          verlust = Wert dessen, was EIGENEN schadet; wirkung = gewinn − verlust.
 */
function aoeWert(engine, quelle, liste, opts = {}) {
  const q = normQuelle(quelle, opts);
  const wirker = typeof opts.wirker === 'number' ? opts.wirker : (typeof q.owner === 'number' ? q.owner : engine.gs.activePlayer);
  const mitOwner = typeof q.owner === 'number' ? quelle : { ...q.obj, owner: wirker, controller: wirker };
  const mitSender = (liste || []).map(e => (typeof e?.sourceOwner === 'number' ? e : { ...e, sourceOwner: wirker }));
  const r = kreaturenBilanz(engine, wirker, mitSender, {
    ohneNegierung: true,
    schutz: { quelle: mitOwner, gerichtet: opts.gerichtet, damageType: opts.damageType },
  });
  // kreaturenBilanz rechnet aus Sicht des Opfers von "Negation hilft": fuer den Wirker ist `verloren` (Schaden an Gegnerischen) der Gewinn, `geschuetzt` (Schaden an Eigenen) der Verlust.
  return { wirkung: r.verloren - r.geschuetzt, gewinn: r.verloren, verlust: r.geschuetzt, eigeneBetroffen: r.eigeneBedroht, posten: r.posten };
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

// ── Schutz einer Kreatur vor einer Wirkung (W82b) ────────────────────────────────────────────────────────

/** Quelle normalisieren: Name, Besitzer (Wirker) und ein Quellobjekt im Format der Schadenspfade. */
function normQuelle(quelle, opts = {}) {
  let name = '', owner;
  if (typeof quelle === 'string') name = quelle;
  else if (typeof quelle === 'number') owner = quelle;
  else if (quelle && typeof quelle === 'object') { name = quelle.cardName || quelle.name || ''; owner = quelle.heroOwner ?? quelle.controller ?? quelle.owner; }
  if (!name && opts.sourceName) name = opts.sourceName;
  if (typeof opts.sourceOwner === 'number') owner = opts.sourceOwner;
  const obj = { name, ...(typeof owner === 'number' ? { owner, controller: owner } : {}), heroIdx: Number.isInteger(opts.heroIdx) ? opts.heroIdx : (quelle && typeof quelle === 'object' && Number.isInteger(quelle.heroIdx) ? quelle.heroIdx : -1) };
  return { name, owner: typeof owner === 'number' ? owner : undefined, obj };
}

/** Ohne Log-Ausgabe rechnen (die Engine-Pruefungen protokollieren sonst jeden Fehlschlag). */
function leise(engine, f) {
  const eigen = Object.prototype.hasOwnProperty.call(engine, 'log');
  const orig = engine.log;
  engine.log = () => {};
  try { return f(); } finally { if (eigen) engine.log = orig; else delete engine.log; }
}

/** Sieht ein Traeger-Skript einen Schutz fuer `ziel` vor (Vertrag `cpuSchuetzt`)? Traeger: Brettkarte (Instanz) oder Held ({ hero, owner, heroIdx }). */
function reaktiverSchutz(engine, ziel, e, ohne) {
  const aus = new Set(Array.isArray(ohne) ? ohne : []);   // W83a: Traeger, die die aufrufende Rechnung selbst IST (Monias eigene Entscheidung) — nicht mitrechnen
  const frage = (script, traeger, aktiv) => {
    if (typeof script?.cpuSchuetzt !== 'function' || !aktiv) return null;
    try { return script.cpuSchuetzt(engine, traeger, ziel, e) ? script : null; } catch { return null; }
  };
  const { loadCardEffect } = require('./_loader');
  for (let p = 0; p < (engine.gs.players || []).length; p++) {
    const heroes = engine.gs.players[p]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      const hero = heroes[hi];
      if (!hero?.name || hero.hp <= 0 || aus.has(hero.name)) continue;
      let silenced = false;
      try { silenced = !!engine._isHeroEffectSilenced?.(p, hi); } catch { silenced = false; }
      const sc = frage(engine.heroScript?.(hero), { hero, owner: p, heroIdx: hi, heroName: hero.name }, !silenced);
      if (sc) return hero.name;
    }
  }
  for (const c of engine.cardInstances || []) {
    if (c.zone !== 'support' || c.faceDown || aus.has(c.name)) continue;
    let dormant = false;
    try { dormant = !!engine.isCardPassiveDormant?.(c); } catch { dormant = false; }
    if (frage(loadCardEffect(c.counters?._effectOverride || c.name), c, !dormant)) return c.name;
  }
  return null;
}

/**
 * Ist diese Kreatur vor der Wirkung `art` der Quelle GESCHUETZT — nimmt sie die Wirkung nachweislich nicht?
 * ★ W82b (Al, 27.10.2026): gemeinsame Vorabpruefung fuer die CPU-Bewerter (Flaechenkarten, `kreaturenBilanz`).
 *   quelle: Name der Karte | { name, owner|controller, heroIdx } | Besitzer-Index · inst: Kreatur auf dem Brett
 *   art:    damage | destroy | status | control | move | buff | counter | stats …  (wie `engine.kreaturBetroffen`)
 *   opts:   { amount, damageType, sourceOwner, canBeNegated (false = durchbricht Negation), statusName, gerichtet (Wirkung WAEHLT ihr Ziel), nurSicher (keine Reaktionen), heroIdx,
 *           ohne (W83a: Kartennamen, deren Reaktion NICHT mitzaehlt — Monias eigene Entscheidung rechnet nicht mit Monia) }
 * Zwei Stufen:
 *   1) SICHER (`weich: false`) — Zustand des Brettes, den die Engine selbst liest: Erstrunden-Schutz, Unaffected-/Immun-Marken (Cardinal Beasts, Golden Wings, Spell-Immunitaet,
 *      Time Bomblebee …), `_markCreatureDamageImmunity` (DIESELBE Wahrheit wie der Schadensstapel: Guardian, Ifrit, Damus, Egg of God, Sparkfly, Of-Kings-Waechter …), Schadens-Buffs mit
 *      Faktor 0 (Damage Immune), Anti-Magic, Dark Ocean, Statusschutz (`canApplyCreatureStatus`); bei gerichteten Wirkungen zusaetzlich Zielschutz (Thicket, Censpartan, Board of Kings).
 *   2) MOEGLICH (`weich: true`) — Reaktionen, die der Gegner des Wirkers nachweislich BEREIT hat: Skripte mit dem Vertrag `cpuSchuetzt(engine, traeger, ziel, e) → boolean` (Cool Rescuer
 *      Monia mit zwei Handkarten, Winged Skeleton, Elusive Hind, Warrior of Teocuilatl). ★ W83a: das ist ein WEICHER Schutz — die CPU weiss vorab nicht, ob der Gegner zahlt; die Bewerter
 *      rechnen solche Kreaturen mit `WEICH_FAKTOR` (0,5) anteilig, nicht als sicher geschuetzt und nicht als sicher getroffen). Nicht negierbare Wirkung (`canBeNegated: false`) und `nurSicher` lassen diese Stufe aus.
 *      Verdeckte Gegnerhand (Reaktionskarten) wird NICHT eingesehen.
 * @returns {{ geschuetzt:boolean, grund:string|null, weich:boolean }}
 */
function kreaturGeschuetztVor(engine, quelle, inst, art, opts = {}) {
  const nein = { geschuetzt: false, grund: null, weich: false };
  if (!inst) return nein;
  const ja = (grund, weich = false) => ({ geschuetzt: true, grund, weich });
  try {
    const gs = engine.gs;
    const q = normQuelle(quelle, opts);
    const seite = inst.controller ?? inst.owner;
    const verursacher = typeof q.owner === 'number' ? q.owner : gs.activePlayer;
    const piercing = opts.canBeNegated === false;
    const schaden = art === 'damage';
    const zerstoeren = art === 'destroy';
    if (inst.zone !== 'support') return nein;
    if (inst.faceDown) return ja('verdeckt');

    // 1) SICHER ───────────────────────────────────────────────────────────────────────────
    const prot = gs.firstTurnProtectedPlayer;
    if (prot != null && seite === prot && verursacher !== prot) return ja('Erstrunden-Schutz');
    if (engine.isOmniImmune?.(inst, q.obj, { sourceOwner: q.owner, damageType: opts.damageType, piercing })) return ja('unaffected');
    if ((schaden || zerstoeren) && !engine.isCardPassiveDormant?.(inst) && inst.counters?._damageDestroyImmune) return ja('Schaden-/Zerstoeren-Immunitaet');
    if ((schaden || zerstoeren) && inst.counters?._stealImmortal) return ja('gestohlen (unverwundbar)');
    if (zerstoeren && inst.counters?.immovable) return ja('unzerstoerbar');
    if (typeof q.owner === 'number' && q.owner !== seite && art !== 'damage' && engine.isOppEffectImmuneFrom?.(inst, q.obj)) return ja('immun gegen gegnerische Effekte');
    if (schaden) {
      const ee = { inst, amount: opts.amount ?? 1, type: opts.damageType || 'other', source: q.obj, sourceOwner: q.owner ?? -1, canBeNegated: !piercing };
      leise(engine, () => engine._markCreatureDamageImmunity([ee]));
      if (ee._immuneCreature) return ja('Schadensimmunitaet');
      if (schadensFaktor(inst) === 0) return ja('Schaden wirkungslos (Buff)');
      const dt = String(opts.damageType || '');
      const istZauber = /spell/.test(dt) || dt === 'spell';
      const am = inst.counters?.buffs?.magic_immune;
      if (am && istZauber && !piercing) {
        let lvl = null, bypass = false;
        try { lvl = engine._getCardDB()?.[q.name]?.level ?? null; bypass = !!require('./_loader').loadCardEffect(q.name)?.bypassesMagicImmune; } catch { /* unbekannt */ }
        if (!bypass && (lvl == null || (am.level ?? 99) >= lvl)) return ja('Anti Magic');
      }
      if (engine.isDarkOceanActive?.() && !piercing) {
        const durch = dt === 'attack' || dt === 'spell' || dt.endsWith('_spell');
        let helm = false;
        try { helm = !!engine._isDiverHelmetProtectedTarget?.(inst); } catch { helm = false; }
        if (!durch && !helm) return ja('Dark Ocean');
      }
    }
    if (art === 'status' && opts.statusName) {
      let ok = true;
      try { ok = engine.canApplyCreatureStatus(inst, opts.statusName, q.obj, { sourceOwner: q.owner, gwSourceOwner: q.owner }); } catch { ok = true; }
      if (!ok) return ja('Statusschutz');
    }
    if (opts.gerichtet) {
      if (inst.counters?.untargetable_all) return ja('unwaehlbar');
      if (inst.counters?.untargetable_by_opponent && inst.counters.untargetable_by_opponent_pi === q.owner) return ja('unwaehlbar fuer den Gegner');
      if (engine.isCreatureImmune?.(inst, 'targeting_immune')) return ja('Zielschutz');
      if (typeof q.owner === 'number' && engine._boardGuardsCreatureChoice?.(inst, q.owner)) return ja('Board of Kings');
    }

    // 2) MOEGLICH — Reaktionen des Gegners ──────────────────────────────────────────────────
    if (!opts.nurSicher && !piercing) {
      const von = reaktiverSchutz(engine, inst, { art, quelleName: q.name, quelleOwner: q.owner, gerichtet: !!opts.gerichtet, canBeNegated: !piercing, damageType: opts.damageType, amount: opts.amount }, opts.ohne);
      if (von) return ja(`Reaktion: ${von}`, true);
    }
    return nein;
  } catch {
    return nein;   // die Heuristik darf nie stoeren
  }
}

// ── Kriterium der Flaechenkarten (W82b, Al 27.10.2026) ──────────────────────────────────────────────────

/**
 * ★ W82b (Al): „Wert aller zu tötenden Gegner-Creatures höher als Wert der verbrauchten Ressourcen inklusive eigener Creatures, aber NUR die zählen, die nicht geschützt sind."
 * Alle Posten in PUNKTEN DER BRETTBEWERTUNG (`evaluateState`: Held-HP 1:1, Standard-Kreatur Level 0/60 HP = 30, Handkarte 5–25, Gold 2 je gebrauchtem Gold):
 *   · Kreaturen: `kreaturWert × BRETT_FAKTOR` (Level 0/60 HP = 30, Level 3/300 HP ≈ 110) — nach dem ganzen Wert, nicht anteilig: nur wer WIRKLICH stirbt zaehlt.
 *   · Karte: `engine._cpuEstimateHandValue` (die gespielte Karte selbst = Opportunitaetskosten der Hand), Rueckfall 20.
 *   · Gold: `engine._cpuEstimateGoldValue` (Goldbewertung der Brettbewertung vor/nach der Ausgabe), Rueckfall 1,5 je Gold.
 *   · Aktion: `AKTION_WERT` = 15 (halbe Standard-Kreatur: die Hauptaktion haette sonst eine Karte ausgespielt), nur wenn die Karte die Hauptaktion kostet (nicht als Zusatzaktion).
 *   · Weitere Kosten (abgeworfene/geopferte Karten, Tokens …): `kosten.karten` (Namen → Handwert), `kosten.extra` (Punkte).
 */
const AKTION_WERT = 15;
const KARTE_RUECKFALL = 20;
const GOLD_RUECKFALL = 1.5;

/** Wert der verbrauchten Ressourcen. k: { kartenName, additional, kosten?: { gold, karten: [Namen], extra } } → { summe, karte, gold, aktion, extra, posten[] } */
function ressourcenWert(engine, pi, k = {}) {
  const posten = [];
  const buche = (was, wert) => { if (wert > 0) posten.push({ was, wert: Math.round(wert * 10) / 10 }); return Math.max(0, wert); };
  let karte = 0, gold = 0, aktion = 0, extra = 0;
  const name = k.kartenName;
  if (name) {
    let w = KARTE_RUECKFALL;
    try { const v = engine._cpuEstimateHandValue?.(pi, name); if (Number.isFinite(v)) w = v; } catch { /* Rueckfall */ }
    karte = buche(`Karte ${name}`, w);
  }
  // Gold: ausdruecklich angegeben, sonst der Preis eines Artefakts (nach Rabatten, guenstigste Kopie in der Hand).
  let preis = k.kosten?.gold;
  if (preis == null && name) {
    try {
      const cd = engine._getCardDB()[name];
      if (cd && cd.cardType === 'Artifact') {
        const hand = engine.gs.players[pi]?.hand || [];
        let best = null;
        for (let i = 0; i < hand.length; i++) { if (hand[i] !== name) continue; const c = engine.artifactPlayCost(pi, name, i).cost; if (best == null || c < best) best = c; }
        preis = best ?? cd.cost ?? 0;
      }
    } catch { preis = null; }
  }
  if (preis > 0) {
    let w = preis * GOLD_RUECKFALL;
    try { const v = engine._cpuEstimateGoldValue?.(pi, preis); if (Number.isFinite(v)) w = v; } catch { /* Rueckfall */ }
    gold = buche(`${preis} Gold`, w);
  }
  if (!k.additional) aktion = buche('Hauptaktion', AKTION_WERT);
  for (const kn of k.kosten?.karten || []) {
    let w = KARTE_RUECKFALL;
    try { const v = engine._cpuEstimateHandValue?.(pi, kn); if (Number.isFinite(v)) w = v; } catch { /* Rueckfall */ }
    extra += buche(`Kosten: ${kn}`, w);
  }
  if (k.kosten?.extra > 0) extra += buche('weitere Kosten', k.kosten.extra);
  return { summe: karte + gold + aktion + extra, karte, gold, aktion, extra, posten };
}

/**
 * Entscheidung „spielen oder nicht" fuer eine Flaechenkarte, aus Sicht des Wirkers `pi`.
 *   Gewinn   (A) = Σ Wert der gegnerischen Kreaturen, die durch die Karte TATSAECHLICH sterben UND NICHT geschuetzt sind (+ `heldenGewinn`)
 *   Verbrauch (B) = Σ Wert der verbrauchten Ressourcen (Karte, Gold, Aktion, Kosten) + Σ Wert der EIGENEN Kreaturen, die sterben UND NICHT geschuetzt sind (+ `heldenVerlust`)
 *   spielen genau dann, wenn A > B (strikt). Teilschaden an Ueberlebenden und Status zaehlen NICHT (nur als Hinweis in `teilwirkung`).
 * k: { kartenName, quelle?, additional?, kosten?, ziele?: [{ inst, art, amount, statusName? }] (Standard: alle Kreaturen beider Seiten mit art/amount),
 *      art?, amount?, damageType?, canBeNegated?, nurSitze?, filter?(inst), heldenGewinn?, heldenVerlust?, gerichtet? }
 * @returns {{ spielen:boolean, gewinn:number, verbrauch:number, gewinnPosten:object[], verlustPosten:object[], kosten:object, geschuetzt:object[], teilwirkung:number }}
 */
function flaechenEntscheidung(engine, pi, k = {}) {
  const quelle = k.quelle || { name: k.kartenName, owner: pi, controller: pi, heroIdx: -1 };
  let liste = k.ziele;
  if (!liste) {
    const n = typeof engine.playerCount === 'function' ? engine.playerCount() : 2;
    const sitze = k.nurSitze || Array.from({ length: n }, (_, i) => i);
    let ziele = [];
    try { ziele = engine.collectAoeCreatureTargets(sitze, {}, ['creature']); } catch { ziele = []; }
    liste = ziele.filter(z => !k.filter || k.filter(z.inst)).map(z => ({ inst: z.inst, art: k.art || 'damage', amount: k.amount, statusName: k.statusName }));
  }
  const gewinnPosten = [], verlustPosten = [], geschuetzt = [];
  let gewinn = num(k.heldenGewinn), verlust = num(k.heldenVerlust), teilwirkung = 0;
  const gesehen = new Set();
  for (const z of liste) {
    const inst = z?.inst;
    if (!inst || inst.zone !== 'support' || inst.faceDown || gesehen.has(inst.id)) continue;
    gesehen.add(inst.id);
    const eigen = seiteVon(engine, inst) === pi;
    const art = z.art || 'damage';
    const sp = kreaturGeschuetztVor(engine, quelle, inst, art, { amount: z.amount, damageType: k.damageType, canBeNegated: k.canBeNegated, statusName: z.statusName, gerichtet: k.gerichtet, sourceOwner: pi });
    // ★ W83a: SICHER geschuetzt = gar nicht einbeziehen; WEICH geschuetzt (bereite Reaktion des Gegners, z. B. Monia) = anteilig (`WEICH_FAKTOR`).
    if (sp.geschuetzt) geschuetzt.push({ name: inst.name, eigen, grund: sp.grund, weich: sp.weich });
    if (sp.geschuetzt && !sp.weich) continue;
    const faktor = sp.geschuetzt ? WEICH_FAKTOR : 1;
    // Stirbt sie WIRKLICH? Schaden ≥ Rest-HP (nach Buff-Faktor), Zerstoeren immer; alles andere (Status, Teilschaden) ist keine Toetung.
    let stirbt = false;
    if (art === 'destroy') stirbt = true;
    else if (art === 'damage') {
      const hp = num(inst.counters?.currentHp ?? engine.getEffectiveCardData?.(inst)?.hp);
      stirbt = hp > 0 && Math.round(num(z.amount) * schadensFaktor(inst)) >= hp;
    }
    const brett = kreaturWert(engine, inst) * BRETT_FAKTOR;
    if (!stirbt) {
      // ★ W83a (Al: Teilschaden an Ueberlebenden als Nebenposten gutgeheissen): Schaden, der die Kreatur nicht toetet, zaehlt mit `UEBERLEBER_FAKTOR` (0,7) × Anteil an der Rest-HP × Wert
      // (`wirkungAuf`). Status/Brand ohne Schaden zaehlt weiter nicht (nur Zaehler).
      teilwirkung++;
      if (art !== 'damage') continue;
      const w = wirkungAuf(engine, inst, { art, amount: z.amount, sourceOwner: pi });
      if (w.richtung !== 'schaden' || !(w.staerke > 0)) continue;
      const teil = brett * w.staerke * faktor;
      const eintragT = { name: inst.name, wert: Math.round(teil * 10) / 10, teil: true, ...(faktor < 1 ? { weich: true } : {}) };
      if (eigen) { verlust += teil; verlustPosten.push(eintragT); } else { gewinn += teil; gewinnPosten.push(eintragT); }
      continue;
    }
    const wert = brett * faktor;
    const eintrag = { name: inst.name, wert: Math.round(wert * 10) / 10, ...(faktor < 1 ? { weich: true } : {}) };
    if (eigen) { verlust += wert; verlustPosten.push(eintrag); } else { gewinn += wert; gewinnPosten.push(eintrag); }
  }
  const kosten = ressourcenWert(engine, pi, { kartenName: k.kartenName, additional: k.additional, kosten: k.kosten });
  const verbrauch = kosten.summe + verlust;
  return { spielen: gewinn > verbrauch, gewinn, verbrauch, gewinnPosten, verlustPosten, kosten, geschuetzt, teilwirkung };
}

/** Hat die Karte gerade eine Zusatzaktion (Vertrag `inherentAction`, Funktion oder Wahrheitswert)? Dann kostet sie die Hauptaktion nicht. */
function alsZusatzaktion(engine, script, pi, heroIdx, opts) {
  if (opts && opts.additional) return true;
  try {
    const f = script?.inherentAction;
    if (typeof f === 'function') return !!f(engine.gs, pi, heroIdx, engine);
    return f === true;
  } catch { return false; }
}

/**
 * Wirkung von Whirlwind Strike & Co. auf die KREATUREN in den Support Zones eines Helden (Brettskala, aus Sicht des Wirkers `pi`): getroffene gegnerische Kreaturen zaehlen
 * positiv, getroffene eigene negativ (die Wahl `side: 'enemy'` laesst keinen eigenen Helden zu, eine geliehene/uebernommene Kreatur in der Zone kann aber eigen sein).
 */
function heldKreaturenWirkung(engine, pi, physOwner, heroIdx, amount, quelle) {
  const liste = kreaturenAnHelden(engine, physOwner, heroIdx).map(inst => ({ inst, art: 'damage', amount, sourceOwner: pi }));
  if (!liste.length) return 0;
  // ★ W83a: gemeinsame Rechnung (`aoeWert`): sicher Geschuetzte fallen heraus, weich Geschuetzte zaehlen anteilig, Ueberlebende mit Faktor 0,7.
  const r = aoeWert(engine, quelle || { name: '', owner: pi, controller: pi, heroIdx: -1 }, liste, { wirker: pi, gerichtet: false, damageType: 'attack' });   // die Kreaturen in der Zone werden NICHT gewaehlt (Zielschutz greift nicht)
  return r.wirkung * BRETT_FAKTOR;
}

module.exports = { UEBERLEBER_FAKTOR, WEICH_FAKTOR, schutzAnteil, aoeWert, kreaturWert, brettWert, BRETT_BASIS, BRETT_MIN, BRETT_MAX, wirkungAuf, greift, schuetzt, kreaturenBilanz, absehbareKreaturen, flaechenBereichAusText, schadensFaktor,
  erwarteteSchlaege, zweitwurfChance, zweitwurfEintrag, mitMehrfachtreffer, kreaturenAnHelden,
  BRETT_FAKTOR, heldKreaturenWirkung,
  kreaturGeschuetztVor, ressourcenWert, flaechenEntscheidung, alsZusatzaktion, AKTION_WERT };
