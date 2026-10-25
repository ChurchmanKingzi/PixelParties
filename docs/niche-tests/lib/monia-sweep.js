'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  W71b — Cool Rescuer Monia: Fenster-Sweep (Al, 25.10.2026: „Sie sollte auf JEDEN Effekt reagieren können, der eine oder mehrere Creatures betreffen würde")
//
//  Methode: Für jede Karte / Aktivierung wird in einer Standard-Szene (Monia aktiv auf Sitz m mit Handkarten, Kreaturen auf BEIDEN Seiten) der echte Spielweg gefahren
//  (lib/h.js, echte server.js-Handler). Gemessen wird der ZUSTAND der Kreaturen (Schnappschuss vorher/nachher), nicht der Weg:
//    · `betroffen`  — mindestens eine vorhandene Kreatur hat sich geändert (HP, Zähler, Status, Buffs, Ort, Kontrolle, Zone, weg …),
//    · `fenster`    — Monias Angebot („Cool Rescue!") wurde mindestens einmal geöffnet,
//    · `wirkt`      — nach ANNAHME (für die geschützte Seite) ist keine Kreatur dieser Seite verändert.
//  Läufe je Szene: A „ablehnen" (Monia fragt, Antwort nein — der Effekt läuft wie ohne Monia), B „annehmen" (erste Option je Angebot, Seite s).
//  Lücke = betroffen && !fenster (Kreatur wurde betroffen, ohne dass Monia gefragt wurde) bzw. fenster && !wirkt (Negation unvollständig).
// ═══════════════════════════════════════════════════════════════════════════
const H = require('./h.js');
const { DB, INERT, BLANK_HEROES, BLANK_HEROES_B } = H;
const MO = 'Cool Rescuer Monia';
const isMo = (d) => d && d.type === 'optionPicker' && /Cool Rescue/.test(d.title || '');
const istKreatur = (cd) => !!cd && /creature/i.test(String(cd.cardType || ''));

/** Rauschen: Buchführung, die sich ohne Effekt auf die Kreatur ändert. */
const RAUSCHEN = /^(_|turnPlayed$|hoptUsed|effectUsed|activated|lastActivated|summonedThisTurn|attacksThisTurn|appliedTurn)/;
function filt(o) {
  const r = {};
  for (const k of Object.keys(o || {}).sort()) { if (RAUSCHEN.test(k)) continue; r[k] = o[k]; }
  return r;
}
function ser(v) { try { return JSON.stringify(v, (k, x) => (k === 'source' || k === 'sourceInst' || k === 'inst') ? (x && x.name) : x); } catch { return '?'; } }

/** Schnappschuss aller Kreaturen auf dem Brett (nach Instanz-Id). */
function schnappschuss(t) {
  const out = {};
  for (const c of t.engine.cardInstances) {
    if (c.zone !== 'support') continue;
    const cd = (t.engine.getEffectiveCardData && t.engine.getEffectiveCardData(c)) || DB[c.name];
    if (!istKreatur(cd)) continue;
    const basis = cd && cd.hp;
    const cnt = filt(c.counters);
    if (cnt.currentHp === basis) delete cnt.currentHp;   // unberührte Kreaturen haben noch keinen Zähler
    if (cnt.maxHp === basis) delete cnt.maxHp;
    out[c.id] = {
      name: c.name, owner: c.owner, ctl: c.controller, hi: c.heroIdx, zs: c.zoneSlot, fd: !!c.faceDown,
      counters: ser(cnt), statuses: ser(filt(c.statuses)), buffs: ser(c.buffs || null),
      anh: ser((c.attachments || []).length || null), lvl: c.level ?? null,
    };
  }
  return out;
}
/** `ids`: nur diese Kreaturen vergleichen (Standard: alle aus `a`). Neu beschworene Kreaturen zählen nicht (Selbst-Effekte sind kein Fall für Monia). */
function unterschied(a, b, ids) {
  const d = [];
  for (const id of (ids || Object.keys(a))) {
    if (!a[id]) continue;
    const x = a[id], y = b[id];
    if (!y) { d.push(`${x.name}@${x.owner}/${x.hi}/${x.zs}: weg (Brett)`); continue; }
    for (const k of Object.keys(x)) if (x[k] !== y[k]) d.push(`${x.name}@${x.owner}/${x.hi}/${x.zs}: ${k} ${String(x[k]).slice(0, 60)} → ${String(y[k]).slice(0, 60)}`);
  }
  return d;
}

/**
 * Szene. o: { m: Sitz von Monia (0|1), monia: true|false, nHand, kreatur: Name, extraBrett(t, m, o, put) }
 * Monia = Held 0 von Sitz m. Kreaturen: m: Held 1/2, o: Held 0/1/2.
 */
async function szene(opts = {}) {
  const m = opts.m ?? 0, o = 1 - m;
  const kreatur = opts.kreatur || INERT.big;
  const nHand = opts.nHand ?? 5;
  const mitMonia = opts.monia !== false;
  const heroes = [0, 1].map(s => s === m ? [mitMonia ? MO : BLANK_HEROES[0], BLANK_HEROES[1], BLANK_HEROES[2]] : [BLANK_HEROES_B[0], BLANK_HEROES_B[1], BLANK_HEROES_B[2]]);
  const hand = [[], []]; hand[m] = [...(opts.handM || []), ...Array(nHand).fill(INERT.filler)]; hand[o] = [...(opts.handO || [])];
  const t = await H.fresh({ heroes, hand, hp: 800, active: o, gold: [300, 300], seed: opts.seed ?? 1234, deck: [Array(20).fill(INERT.creature), Array(20).fill(INERT.creature)] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  const kr = { m: [], o: [] };
  const put = (s, hi, slot, nm) => { const c = t.put(s, hi, slot, nm); c.turnPlayed = 1; (s === m ? kr.m : kr.o).push(c); return c; };
  put(m, 1, 0, kreatur); put(m, 2, 0, kreatur);
  put(o, 0, 0, kreatur); put(o, 1, 0, kreatur); put(o, 2, 1, kreatur);
  if (opts.extraBrett) await opts.extraBrett(t, m, o, put);
  t.gs.activePlayer = o; t.phase(3);
  t.errors.length = 0; t.reset();
  return { t, m, o, kr };
}

/** Skript für Monias Angebot. `antwort`: 'nein' | 'ja'; `seite`: bevorzugte Option `save-<seite>` (sonst die erste). Liefert das Protokoll der Angebote. */
function skript(t, antwort, seite, nurFuer) {
  const log = [];
  t.script.unshift({ match: isMo, answer: (d, pi) => {
    if (t.engine._inMctsSim) return null;   // Rollout der CPU: nicht mitzählen, nicht annehmen
    log.push({ pi, titel: d.title, trigger: d.triggerCardName || null, optionen: (d.options || []).map(x => x.id) });
    if (antwort === 'nein') return null;
    // `nurFuer` (RegExp): die Antwort gilt nur Angeboten, deren auslösende Karte/Beschreibung passt; alle anderen Angebote werden abgelehnt
    if (nurFuer && !nurFuer.test(`${d.triggerCardName || ''} ${d.description || ''}`)) return null;
    const opt = (d.options || []).find(x => seite != null && x.id === `save-${seite}`) || (d.options || [])[0];
    log[log.length - 1].gewaehlt = opt ? opt.id : null;
    return opt ? { optionId: opt.id } : null;
  } });
  return log;
}

/** Zielwahl: bevorzugt Kreaturen der Brettseite `seite`, dann beliebige Kreaturen, dann der Rest. */
function zielwahl(t, seite) {
  t.targetFn = (valid, config) => {
    const need = Math.max(1, (config && (config.minTargets || config.minRequired)) || 1);
    const kre = (v) => istKreatur(DB[v.cardName]) || v.type === 'creature';
    const rang = (v) => (kre(v) ? (seite == null || v.owner === seite ? 0 : 1) : 2);
    return valid.slice().sort((a, b) => rang(a) - rang(b)).slice(0, need).map(v => v.id);
  };
}

/**
 * Tabellen-Prüfung für b-02…b-07: je Definition × Monia auf Sitz 0/1 × Wirker (Gegner von Monia | Monias Besitzer) × Monia lehnt ab / nimmt an.
 *   def: { name, hand?:[…], abilities?:[…], karten (Karten des Wirkers, die die Hand verlassen), ziel: 'gegner' (Standard: Kreatur der Gegenseite des Wirkers) | 'eigen' (Kreatur des Wirkers),
 *          spiel(t, W, hero), vorbereitung?(t, W, V), nAngebote?: genau n (Standard 1), zurHand?, wirkt(diff, t, ctx)?: erwarteter Effekt bei Ablehnung (Standard: irgendeine Änderung der Kreaturen),
 *          nurWirker?: 'gegner'|'eigen', nurFuer?: RegExp (Antwort gilt nur Angeboten dieser Karte) }
 * Geprüft: Angebot(e) von der Karte ausgelöst · abgelehnt: Effekt wirkt, Monias Ablage wächst nur um die selbst gespielten Karten · angenommen: Kreaturen der geschützten Seite unverändert, Ablage +1.
 */
async function tabelle(R, defs, o = {}) {
  for (const def of defs) {
    for (const m of [0, 1]) {
      const oo = 1 - m;
      for (const wirker of ['gegner', 'eigen']) {
        if (def.nurWirker && def.nurWirker !== wirker) continue;
        const W = wirker === 'gegner' ? oo : m;
        const V = def.ziel === 'eigen' ? W : 1 - W;          // Seite der betroffenen Kreatur
        const hero = wirker === 'gegner' ? 0 : 1;
        for (const antwort of ['nein', 'ja']) {
          R.section(`${def.name} · Monia Sitz ${m} · Wirker Sitz ${W} (${wirker === 'gegner' ? 'Gegner' : 'Monias Besitzer'}) auf Kreatur von Sitz ${V} · Monia ${antwort === 'ja' ? 'nimmt an' : 'lehnt ab'}`);
          const sc = await szene({ m, handM: W === m ? (def.hand || []) : [], handO: W === oo ? (def.hand || []) : [] });
          const { t } = sc;
          if (def.abilities) t.setAbilities(W, hero, [def.abilities, [], []]);
          const log = skript(t, antwort, V, def.nurFuer);
          t.script.push({ match: d => d && d.type === 'zonePick', answer: () => { const sz = t.gs.players[W].supportZones; for (let hi = 0; hi < 3; hi++) for (let si = 0; si < 3; si++) if (((sz[hi] || [])[si] || []).length === 0) return { heroIdx: hi, slotIdx: si }; return null; } });
          t.targetFn = def.targetFn ? def.targetFn(V, W) : (valid, config) => {
            const need = Math.max(1, (config && (config.minTargets || config.minRequired)) || 1);
            const kre = valid.filter(v => v.type === 'equip' && v.owner === V);
            return (kre.length ? kre : valid.filter(v => v.type === 'equip')).slice(0, need).map(v => v.id);
          };
          for (const regel of (def.skript || [])) t.script.push(regel);
          if (def.vorbereitung) await def.vorbereitung(t, W, V, m);
          const vor = schnappschuss(t); const ids = Object.keys(vor);
          const abl0 = t.gs.players[m].discardPile.length;
          await def.spiel(t, W, hero, V);
          if (t.gs.potionTargeting && t.gs.potionTargeting.ownerIdx === W) await t.resolveTargeting(W);
          await ende(t, W);
          const diff = unterschied(vor, schnappschuss(t), ids);
          const ang = angebote(t);
          const eigene = W === m ? (def.ablage ?? def.karten ?? 1) : 0;
          const n = def.nAngebote ?? 1;
          // Flächeneffekt (`def.flaeche`): ein Angebot je Karte/Effekt UND Seite — angenommen genau eins, abgelehnt höchstens eins je Seite (2)
          const anzOk = def.flaeche ? (antwort === 'ja' ? ang.length === 1 : (ang.length >= 1 && ang.length <= 2)) : (n === 1 ? ang.length === 1 : ang.length >= 1);
          R.check(`${def.flaeche ? 'ein Angebot je Seite' : (n === 1 ? 'genau EIN' : 'mindestens ein')} Monia-Angebot, ausgelöst von „${def.name}"`, anzOk && ang.every(a => a.d.triggerCardName === def.name || (def.nurFuer && !def.nurFuer.test(a.d.triggerCardName || ''))) , ang.map(a => ({ trig: a.d.triggerCardName, opt: a.d.options.map(x => x.id) })));
          if (antwort === 'nein') {
            R.check('abgelehnt: der Effekt wirkt (Kreatur verändert)', def.wirkt ? !!def.wirkt(diff, t, { V, W, m }) : diff.length > 0, diff.slice(0, 4));
            R.check('abgelehnt: kein Abwurf durch Monia', t.gs.players[m].discardPile.length === abl0 + eigene, { abl: [abl0, t.gs.players[m].discardPile.length], eigene });
          } else {
            const geschuetzt = log.length && log[0].gewaehlt ? +log[0].gewaehlt.slice(5) : V;
            const betr = diff.filter(d => { const mm = d.match(/@(\d)\//); return mm && +mm[1] === geschuetzt && !(def.ignoriere && def.ignoriere.test(d)); });
            R.check('angenommen: keine Kreatur der geschützten Seite verändert', betr.length === 0, betr.slice(0, 4));
            R.check('angenommen: Monias Besitzer wirft genau 1 Handkarte ab', t.gs.players[m].discardPile.length === abl0 + eigene + 1, { abl: [abl0, t.gs.players[m].discardPile.length], eigene });
          }
          R.check('keine Engine-Fehler', t.errors.length === 0, t.errors.slice(0, 2));
        }
      }
    }
  }
}

const angebote = (t) => t.prompts.filter(p => isMo(p.d) && !p.sim);
const hp = (c) => c.counters.currentHp ?? DB[c.name].hp;   // unberührte Kreaturen haben noch keinen Zähler
const handAnz = (t, s) => t.gs.players[s].hand.length;
/** Beendet die Auflösung wie im Spielweg (Aktionsende). */
const ende = (t, seat) => t.run(() => t.engine.runHooks('onAnyActionResolved', { actionType: 'ability', playerIdx: seat, heroIdx: 0, isAdditional: false, isInherent: false, isFree: false, _skipReactionCheck: true }));

module.exports = {
  angebote, hp, handAnz, ende, tabelle, H, DB, MO, isMo, istKreatur, schnappschuss, unterschied, szene, skript, zielwahl, filt, ser };
