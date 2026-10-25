'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  W71b — Wächter „Kreatur wurde betroffen, ohne dass Monia gefragt wurde"
//
//  Hängt sich in eine Test-Szene (lib/h.js) und meldet jeden SCHREIBZUGRIFF auf den Zustand einer Kreatur auf dem Brett (Zähler, Status, Buffs, Ort, Kontrolle, Zone, Anhänge),
//  während für DIESE Kreatur in der laufenden Auflösung noch kein Monia-Fenster geöffnet war (`beforeCreatureAffected` oder `beforeCreatureDamageBatch`; geöffnet heißt: der Hook lief —
//  ob Monia im Spiel ist, spielt keine Rolle). Das Fenster-Fach leert sich mit dem Ende der Auflösung (`endeEffektImmunitaeten`) — wie Monias eigene Buchführung.
//
//  Rauschen: Buchführungs-Schlüssel (`_…`, turnPlayed …) und Zugriffe der Kreatur auf sich selbst werden nicht gemeldet (Selbst-Effekte sind kein Fall für Monia, W13/H01-Ruling).
//  Jede Meldung trägt die Aufrufer-Zeile (erste Zeile in cards/effects/*.js außerhalb des Wächters) — damit lässt sich die Lücke sofort zuordnen.
//
//    const w = require('./monia-waechter.js').installiere(t);   // nach H.fresh / S.szene
//    …                                                          // Spielweg
//    w.meldungen   → [{ kreatur, art, schluessel, alt, neu, wo, quelle }]
//    w.fensterAnzahl → Zahl der geöffneten Fenster
// ═══════════════════════════════════════════════════════════════════════════
const RAUSCH = /^(_|turnPlayed$|hoptUsed|effectUsed|activated|lastActivated|summonedThisTurn|attacksThisTurn|appliedTurn|heroFlags)/;
const istObj = (x) => x !== null && typeof x === 'object';

function installiere(t, opt = {}) {
  const { engine } = t;
  const w = { meldungen: [], fensterAnzahl: 0, aus: false, offen: new Map(), ids: opt.ids || null };   // offen: instId → Set(Art)
  const jetztQuelle = () => { try { return engine._effectSourceName() || null; } catch { return null; } };
  const wo = () => {
    const st = String(new Error().stack || '').split('\n').slice(2);
    const fr = st.filter(l => /cards\/effects\//.test(l) && !/monia-waechter/.test(l));
    const sk = fr.find(l => !/_engine\.js/.test(l)) || fr[0] || '';
    const eng = fr.find(l => /_engine\.js/.test(l)) || '';
    const fmt = (l) => (l.match(/effects\/([^:)]+:\d+)/) || [])[1] || '';
    return fmt(sk) + (eng && fmt(eng) !== fmt(sk) ? ' ← ' + fmt(eng) : '');
  };
  const abgedeckt = (inst) => w.offen.has(inst.id);
  const melde = (inst, art, schluessel, alt, neu) => {
    if (w.aus || !inst || inst.zone !== 'support' || inst.faceDown) return;
    if (w.ids && !w.ids.has(inst.id)) return;   // nur Kreaturen der Ausgangsszene (neu beschworene sind kein Fall)
    if (RAUSCH.test(String(schluessel))) return;
    if (abgedeckt(inst)) return;
    // natürliches Auslaufen (Status-/Buff-Dauer, Rückgabe gestohlener Kreaturen am Zugende) ist kein „Effekt auf die Kreatur"
    if (/processStatusExpiry|_processBuffExpiry|_revertStolenCreatures|_expireTemporary/.test(new Error().stack || '')) return;
    // Selbstzugriff: die laufende Effekt-Quelle ist die Kreatur selbst
    const q = jetztQuelle();
    if (q && q === inst.name && opt.selbstAus !== false) return;
    const s = JSON.stringify(alt), n = JSON.stringify(neu);
    if (s === n) return;
    if ((schluessel === 'currentHp' || schluessel === 'maxHp') && alt === undefined && neu === (engine._getCardDB()[inst.name] || {}).hp) return;   // Anlegen des Zählers (Grundwert), kein Effekt
    w.meldungen.push({ kreatur: `${inst.name}@${inst.owner}/${inst.heroIdx}/${inst.zoneSlot}`, art, schluessel, alt: String(s).slice(0, 50), neu: String(n).slice(0, 50), wo: wo(), quelle: q });
  };

  // ── Fenster zählen: runHooks ──
  const rh = engine.runHooks.bind(engine);
  w.stumm = [];   // Fenster, die aufgingen, während Monia (vorhanden) nicht handlungsfähig war (tot / eingefroren / betäubt / negiert)
  const moniaInaktiv = () => {
    for (const ps of engine.gs.players) for (const h of (ps.heroes || [])) {
      if (h && h.name === 'Cool Rescuer Monia') { const st = h.statuses || {}; if (!(h.hp > 0) || st.frozen || st.stunned || st.negated) return !engine.heldTodAufgeschoben?.(h) || st.frozen || st.stunned || st.negated; }
    }
    return false;
  };
  engine.runHooks = async (name, ctx = {}, ...r) => {
    if ((name === 'beforeCreatureAffected' && ctx && ctx.creature) || (name === 'beforeCreatureDamageBatch' && ctx && Array.isArray(ctx.entries) && ctx.entries.length)) {
      if (moniaInaktiv()) {
        const q = (ctx.source && (ctx.source.name || ctx.source.cardName)) || engine._effectSourceName() || '';
        w.stumm.push({ art: ctx.effectType || 'damage', quelle: q, kreatur: ctx.creature ? ctx.creature.name : (ctx.entries[0].inst && ctx.entries[0].inst.name) });
      }
    }
    if (name === 'beforeCreatureAffected' && ctx && ctx.creature) { w.fensterAnzahl++; w.offen.set(ctx.creature.id, (w.offen.get(ctx.creature.id) || new Set()).add(ctx.effectType || '?')); }
    else if (name === 'beforeCreatureDamageBatch' && ctx && Array.isArray(ctx.entries)) { w.fensterAnzahl++; for (const e of ctx.entries) if (e && e.inst) w.offen.set(e.inst.id, (w.offen.get(e.inst.id) || new Set()).add('damage')); }
    return rh(name, ctx, ...r);
  };
  const ende = engine.endeEffektImmunitaeten.bind(engine);
  engine.endeEffektImmunitaeten = (...a) => { w.offen.clear(); return ende(...a); };

  // ── Schreibzugriffe: Zähler/Status/Buffs als Proxy, Ort/Kontrolle als Zugriffsfunktionen ──
  const tief = (inst, wurzel, pfad, zielObj) => new Proxy(zielObj, {
    get(o, k, rc) { const v = Reflect.get(o, k, rc); return (istObj(v) && typeof k === 'string' && !(v instanceof Date)) ? tief(inst, wurzel, pfad + '.' + k, v) : v; },
    set(o, k, v, rc) { const alt = o[k]; const ok = Reflect.set(o, k, v, rc); if (typeof k === 'string') melde(inst, wurzel, pfad === wurzel ? k : pfad.slice(wurzel.length + 1) + '.' + k, alt, v); return ok; },
    deleteProperty(o, k) { const alt = o[k]; const ok = Reflect.deleteProperty(o, k); if (typeof k === 'string') melde(inst, wurzel, pfad === wurzel ? k : pfad.slice(wurzel.length + 1) + '.' + k, alt, undefined); return ok; },
  });
  const verdrahte = (inst) => {
    if (!inst || inst.__monW) return inst;
    Object.defineProperty(inst, '__monW', { value: true, enumerable: false });
    for (const wurzel of ['counters', 'statuses', 'buffs']) {
      if (!istObj(inst[wurzel])) continue;
      let roh = inst[wurzel], px = tief(inst, wurzel, wurzel, roh);
      Object.defineProperty(inst, wurzel, { configurable: true, enumerable: true, get() { return px; }, set(v) { melde(inst, wurzel, '<ersetzt>', roh, v); roh = v; px = istObj(v) ? tief(inst, wurzel, wurzel, v) : v; } });
    }
    for (const f of ['owner', 'controller', 'heroIdx', 'zoneSlot', 'zone', 'faceDown']) {
      let wert = inst[f];
      Object.defineProperty(inst, f, { configurable: true, enumerable: true, get() { return wert; }, set(v) {
        const alt = wert;
        // Zonenwechsel/Platzwechsel einer Kreatur: erst melden, solange sie noch als Kreatur im Brett gilt
        if (alt !== v && !(f === 'zone' && alt !== 'support')) melde(inst, f === 'zone' ? 'ort' : f, f, alt, v);
        wert = v;
      } });
    }
    return inst;
  };
  const tc = engine._trackCard.bind(engine);
  engine._trackCard = (...a) => verdrahte(tc(...a));
  // Entfernen aus der Verfolgung (Bounce auf die Hand, Löschen …): die Kreatur verlässt das Brett, ohne dass ein Feld geschrieben wird
  const uc = engine._untrackCard.bind(engine);
  engine._untrackCard = (id, ...r) => { const inst = engine.cardInstances.find(c => c.id === id); if (inst) melde(inst, 'ort', 'untrack', inst.zone, null); return uc(id, ...r); };
  for (const c of engine.cardInstances) verdrahte(c);
  w.stop = () => { w.aus = true; };
  return w;
}

module.exports = { installiere };
