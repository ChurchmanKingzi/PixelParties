'use strict';
// W63c/W64c · Hilfen für die Besitzer-Repros (docs/niche-tests/repro/W63/c-*.js): „Karten gehören immer ihrem BESITZER".
// Eine Karte, die ein anderer Spieler hält oder kontrolliert (Charme Lv 2, Diebstahl, Geschenk …), landet beim Abwerfen/Löschen/Mischen/
// Auflösen/Zerstören in Ablage, Löschstapel oder Deck des BESITZERS — nie beim Dieb.
const H = require('./h.js');

const FILLER = 'ZZ Filler';
const PILES = ['hand', 'mainDeck', 'discardPile', 'deletedPile', 'potionDeck'];

/** Freie Ability benutzen (Charme): Sitz `seat`, Held `hi`, Zone `zi`. */
function frei(t, seat, hi, zi) {
  t.gs.activePlayer = seat; t.phase(2);
  return t.run(() => t.host.doActivateFreeAbility(t.room, seat, { heroIdx: hi, zoneIdx: zi }));
}

/**
 * Charme Lv 2: Sitz `dieb` klaut `karte` aus der Hand von Sitz `besitzer`. Danach liegt die Karte in der Hand des Diebs.
 * o: { diebHand:[…], besitzerHand:[…] (Karte wird vorn ergänzt), extra:{…H.fresh-Optionen} }
 */
async function charmeKlau(karte, dieb = 0, o = {}) {
  const besitzer = 1 - dieb;
  const hand = [[], []];
  hand[dieb] = o.diebHand || [FILLER];
  hand[besitzer] = [karte, ...(o.besitzerHand || [])];
  const abilities = { [dieb]: { 0: [['Charme', 'Charme'], [], []] } };
  const t = await H.fresh({ hand, deck: [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')], abilities, ...(o.extra || {}) });
  t.dieb = dieb; t.besitzer = besitzer; t.karte = karte;
  t.script.push({ match: d => d.type === 'forceDiscard' && /Charme/.test(d.title || ''), answer: () => ({ cardName: karte, handIndex: t.pile(besitzer, 'hand').indexOf(karte) }) });
  await frei(t, dieb, 0, 0);
  return t;
}

/** Wo liegt die Karte? { seatN: { pile: Anzahl } } + Instanz-Zonen. */
function ort(t, karte) {
  const out = {};
  for (let s = 0; s < t.n; s++) for (const k of PILES) { const n = t.pile(s, k).filter(x => x === karte).length; if (n) (out['s' + s] = out['s' + s] || {})[k] = n; }
  return out;
}
function anzahl(t, seat, pile, karte) { return t.pile(seat, pile).filter(x => x === karte).length; }
/** Geister-Instanzen: fremde Karte noch als Handinstanz getrackt, obwohl sie nicht mehr in der Hand liegt. */
function geisterHand(t, karte) {
  return t.engine.cardInstances.filter(c => c.name === karte && c.zone === 'hand' && !t.pile(c.owner, 'hand').includes(karte));
}

/**
 * Prüft: `karte` liegt genau einmal in `pile` von Sitz `seat` (BESITZER), nirgends sonst in Stapeln/Hand, keine Geister-Handinstanz, keine Engine-Fehler.
 */
function erwarteStapel(R, t, label, karte, seat, pile) {
  const o = ort(t, karte);
  const nur = Object.keys(o).length === 1 && (o['s' + seat] || {})[pile] === 1 && Object.keys(o['s' + seat]).length === 1;
  R.check(`${label}: ${karte} im ${pile} von Sitz ${seat} (Besitzer)`, nur, o);
  R.check(`${label}: keine fremde Geister-Handinstanz`, geisterHand(t, karte).length === 0, geisterHand(t, karte).map(c => ({ owner: c.owner, orig: c.originalOwner })));
  R.check(`${label}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
}

/** Zerstört die (einzige) Brettinstanz der Karte. */
async function zerstoere(t, karte) {
  const inst = t.engine.cardInstances.find(c => c.name === karte && ['support', 'ability', 'surprise', 'area'].includes(c.zone));
  if (!inst) return null;
  await t.run(() => t.engine.actionDestroyCard(null, inst, {}));
  return inst;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  W64c · GENERISCHER BESITZER-WÄCHTER  (Al: „Karten gehen IMMER in die Stapel ihres permanenten Besitzers. IMMER.")
//
//  Zuschalten:  PP_OWNER_GUARD=1 node <repro>.js      (Standard: aus; H.fresh installiert ihn dann selbst)
//               PP_OWNER_GUARD=strict                  → Exit-Code 1, sobald ein Verstoß gefunden wurde
//               PP_OWNER_GUARD_OUT=<datei>             → Verstöße zusätzlich als JSON-Zeilen anhängen (Sammellauf über die Suite)
//  Im Test selbst:  const w = B.waechter(t);  …  w.verstoesse()  /  w.pruefe()  (Liste der gefundenen Verstöße)
//
//  Wirkung: ALLE vier Stapel jedes Sitzes (discardPile, deletedPile, mainDeck, potionDeck) werden instrumentiert
//  (Zugriffs-Wächter am Spieler + Überlagerung von push/unshift/splice am Array; Neuzuweisung `ps.discardPile = […]` wird per
//  Multimengen-Vergleich geprüft). Jede Karte, die in einen Stapel kommt, wird mit der BESITZER-BUCHFÜHRUNG verglichen:
//
//    ledger[sitz][name]  = wie viele Exemplare dem Sitz GEHÖREN. Start: alles, was beim Aufbau (H.fresh) in den Zonen des Sitzes liegt;
//                          fortgeschrieben über die Aufbauhelfer der Harness (t.put/putSurprise/putArea/setHand/addHand/setDeck/
//                          setDiscard/setAbilities/setHero/grantFor: Zugang = gehört dem Sitz) und direkte Schreibzugriffe der
//                          TEST-Datei auf einen Stapel (Aufbau). Diebstahl, Geschenk, Kontrollwechsel ändern die Buchführung NICHT —
//                          genau das ist die Regel: Eigentum wandert nie.
//    Verstoß             = nach dem Ende der Aktion (t.run) / am Prozessende liegen im Stapel von Sitz P mehr Exemplare von N,
//                          als P besitzt, UND alle Exemplare von N im Spiel sind verbucht (sonst hat ein Effekt/der Test Karten
//                          aus dem Nichts erzeugt → „unbekannt", keine Aussage).
//  Die Prüfung ist bewusst NACH der Aktion (Endzustand), weil manche Wege erst in den Stapel schreiben und dann die Quelle räumen.
//  Jeder Verstoß trägt „wo": die Skript-/Engine-Funktionen auf dem Aufrufweg (Stack), die Karte, Stapel und Sitz, sowie die
//  Besitzer-Metadaten (`originalOwner` der Instanzen, `_handOriginals`, `_fremdAbgang`) als Beleg. Trägt eine Instanz des Namens
//  `originalOwner = <Sitz des Stapels>`, hat die Engine der Metadaten-Regel gefolgt und nur die Buchführung ist anderer Meinung:
//  Klasse „test-aufbau" (künstlich: t.put mit nachträglich gesetztem falschem `originalOwner`), sonst Klasse „echt".
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const STAPEL = ['discardPile', 'deletedPile', 'mainDeck', 'potionDeck'];
const ZAEHL_ARRAYS = ['hand', 'mainDeck', 'discardPile', 'deletedPile', 'potionDeck', 'creationZone', 'coolnessStack'];

function zaehleSitz(t, seat) {
  const m = new Map(); const add = (nm) => { if (typeof nm === 'string') m.set(nm, (m.get(nm) || 0) + 1); else if (nm && typeof nm.name === 'string') m.set(nm.name, (m.get(nm.name) || 0) + 1); };
  const ps = t.gs.players[seat];
  for (const k of ZAEHL_ARRAYS) (ps[k] || []).forEach(add);
  (ps.supportZones || []).forEach(h => (h || []).forEach(z => (z || []).forEach(add)));
  (ps.abilityZones || []).forEach(h => (h || []).forEach(z => (z || []).forEach(add)));
  (ps.surpriseZones || []).forEach(z => (z || []).forEach(add));
  (ps.heroes || []).forEach(h => h && h.name && add(h.name));
  (ps.permanents || []).forEach(p => p && p.name && add(p.name));
  ((t.gs.areaZones || [])[seat] || []).forEach(add);
  return m;
}

function waechter(t, opt = {}) {
  if (t._besitzerWaechter) return t._besitzerWaechter;
  const n = t.n;
  const ledger = Array.from({ length: n }, () => new Map());
  const stats = { geprueft: 0, unbekannt: 0, aufbau: 0 };
  const funde = []; const offen = [];
  const bump = (seat, name, d) => { const m = ledger[seat]; m.set(name, Math.max(0, (m.get(name) || 0) + d)); };
  const alle = () => Array.from({ length: n }, (_, s) => zaehleSitz(t, s));
  // ── Buchführung: Startbestand ──
  alle().forEach((m, s) => m.forEach((c, nm) => bump(s, nm, c)));
  // ── Buchführung: Aufbauhelfer der Harness (Zugang = gehört dem Sitz) ──
  for (const fn of ['put', 'putSurprise', 'putArea', 'setHand', 'addHand', 'setDeck', 'setDiscard', 'setAbilities', 'setHero', 'grantFor']) {
    const orig = t[fn]; if (typeof orig !== 'function') continue;
    t[fn] = function (...a) {
      const vor = alle(); const r = orig.apply(this, a); const nach = alle();
      for (let s = 0; s < n; s++) for (const nm of new Set([...vor[s].keys(), ...nach[s].keys()])) { const d = (nach[s].get(nm) || 0) - (vor[s].get(nm) || 0); if (d) bump(s, nm, d); }
      return r;
    };
  }
  const stapelAnzahl = (seat, nm) => { const ps = t.gs.players[seat]; let c = 0; for (const k of STAPEL) for (const x of (ps[k] || [])) if (x === nm) c++; return c; };
  const rahmen = () => {
    const lim = Error.stackTraceLimit; Error.stackTraceLimit = 40;
    const st = (new Error().stack || '').split('\n').slice(1); Error.stackTraceLimit = lim;
    return st.filter(l => !/besitzer\.js/.test(l));
  };
  const kurz = (l) => { const m = /at (?:async )?([^ (]+)? ?\(?(.*?)([^\/\\]+?):(\d+):\d+\)?$/.exec(l.trim()); return m ? `${m[1] && m[1] !== 'Object.<anonymous>' ? m[1] + ' ' : ''}${m[3]}:${m[4]}` : l.trim().slice(0, 80); };
  const meldeZugang = (seat, key, items) => {
    if (!items || !items.length) return;
    const st = rahmen();
    const ersterRahmen = st[0] || '';
    const ausTest = /docs[\/]niche-tests[\/](?!lib[\/]h\.js)/.test(ersterRahmen) && !/[\/]lib[\/]/.test(ersterRahmen);
    for (const nm of items) {
      if (typeof nm !== 'string') continue;
      if (ausTest) { bump(seat, nm, 1); stats.aufbau++; continue; }
      offen.push({ seat, key, nm, wo: st.filter(l => /(cards[\/]effects|server\.js|bot|skilltest)/.test(l)).slice(0, 5).map(kurz), belegeDamals: belege(seat, nm) });   // Beleg JETZT festhalten: die sterbende Instanz ist bei der Auswertung evtl. schon abgeräumt
    }
  };
  // ── Instrumentierung der Stapel ──
  const umhuelle = (arr, seat, key) => {
    if (!Array.isArray(arr)) return;
    for (const m of ['push', 'unshift', 'splice']) {
      const cur = arr[m];
      if (typeof cur === 'function' && cur.__besitzerWaechter) continue;
      const w = function (...a) {
        const r = cur.apply(this, a);
        meldeZugang(seat, key, m === 'splice' ? a.slice(2) : a);
        return r;
      };
      w.__besitzerWaechter = true;
      Object.defineProperty(arr, m, { value: w, enumerable: false, configurable: true, writable: true });
    }
  };
  for (let s = 0; s < n; s++) {
    const ps = t.gs.players[s];
    for (const key of STAPEL) {
      let arr = ps[key] || [];
      umhuelle(arr, s, key);
      Object.defineProperty(ps, key, {
        enumerable: true, configurable: true,
        get() { umhuelle(arr, s, key); return arr; },
        set(v) {
          const alt = arr; arr = v; umhuelle(arr, s, key);
          if (Array.isArray(v) && v !== alt) {   // Neuzuweisung: nur NEU hinzugekommene Namen (Multimenge) prüfen
            const rest = new Map(); (alt || []).forEach(x => rest.set(x, (rest.get(x) || 0) + 1));
            const neu = []; for (const x of v) { const c = rest.get(x) || 0; if (c > 0) rest.set(x, c - 1); else neu.push(x); }
            meldeZugang(s, key, neu);
          }
        },
      });
    }
  }
  // ── Auswertung: Endzustand der offenen Zugänge ──
  const belege = (seat, nm) => {
    const e = t.engine; const out = [];
    for (const c of e.cardInstances || []) if (c.name === nm && c.originalOwner != null) out.push({ zone: c.zone, owner: c.owner, originalOwner: c.originalOwner });
    for (let s = 0; s < n; s++) {
      const ps = t.gs.players[s];
      Object.entries(ps._handOriginals || {}).forEach(([i, o]) => { if (o && o.n === nm) out.push({ handOriginals: { halter: s, platz: Number(i), besitzer: o.o } }); });
      for (const f of ps._fremdAbgang || []) if (f && f.name === nm) out.push({ fremdAbgang: { halter: s, besitzer: f.owner } });
    }
    return out;
  };
  const pruefe = () => {
    const todo = offen.splice(0, offen.length); const gesehen = new Set();
    const census = alle();
    for (const z of todo) {
      const k = z.seat + '|' + z.key + '|' + z.nm + '|' + z.wo.join('>');
      if (gesehen.has(k)) continue; gesehen.add(k);
      stats.geprueft++;
      if (stapelAnzahl(z.seat, z.nm) <= (ledger[z.seat].get(z.nm) || 0)) continue;
      let tot = 0, led = 0; for (let s = 0; s < n; s++) { tot += census[s].get(z.nm) || 0; led += ledger[s].get(z.nm) || 0; }
      if (tot > led) { stats.unbekannt++; continue; }       // Exemplare aus dem Nichts (Effekt/Test): keine Aussage
      const eigner = []; for (let s = 0; s < n; s++) if (s !== z.seat && (ledger[s].get(z.nm) || 0) > 0) eigner.push(s);
      if (!eigner.length) { stats.unbekannt++; continue; }
      const b = [...(z.belegeDamals || []), ...belege(z.seat, z.nm)];
      const klasse = b.some(x => x.originalOwner === z.seat || (x.handOriginals && x.handOriginals.besitzer === z.seat) || (x.fremdAbgang && x.fremdAbgang.besitzer === z.seat)) ? 'test-aufbau' : 'echt';
      funde.push({ klasse, karte: z.nm, stapel: z.key, sitz: z.seat, besitzer: eigner, wo: z.wo, belege: b.slice(0, 4) });
    }
    return funde;
  };
  const origRun = t.run;
  t.run = async function (...a) { try { return await origRun.apply(this, a); } finally { pruefe(); } };
  const w = {
    ledger, stats, pruefe,
    verstoesse: () => { pruefe(); return funde.slice(); },
    echte: () => { pruefe(); return funde.filter(f => f.klasse === 'echt'); },
  };
  t._besitzerWaechter = w;
  // ── Prozessende: Bericht ──
  if (!waechter._exitHook) {
    waechter._exitHook = true;
    process.on('exit', () => {
      try {
        const alleFunde = waechter._alle || [];
        for (const g of alleFunde) { try { const w = g.ref.deref(); if (w) w.pruefe(); } catch { /* egal */ } }   // noch lebende Wächter ein letztes Mal auswerten
        const fl = alleFunde.flatMap(g => g.funde || []);
        const out = process.env.PP_OWNER_GUARD_OUT;
        if (out) for (const f of fl) { try { fs.appendFileSync(out, JSON.stringify(Object.assign({ datei: process.argv[1] ? process.argv[1].replace(/.*docs[\/]niche-tests[\/]repro[\/]/, '') : null }, f)) + '\n'); } catch { /* egal */ } }
        if (fl.length) {
          process.stderr.write(`\nOWNER-GUARD: ${fl.length} Verstoß/Verstöße (${fl.filter(f => f.klasse === 'echt').length} echt)\n`);
          for (const f of fl.slice(0, 20)) process.stderr.write(`  [${f.klasse}] ${f.karte} → ${f.stapel} von Sitz ${f.sitz} (Besitzer: Sitz ${f.besitzer.join('/')}) via ${f.wo.join(' < ')}\n`);
          if (/^strict$/i.test(process.env.PP_OWNER_GUARD || '') && fl.some(f => f.klasse === 'echt') && !process.exitCode) process.exitCode = 1;
        }
      } catch { /* Bericht darf nie stören */ }
    });
  }
  (waechter._alle = waechter._alle || []).push({ ref: new WeakRef(w), funde });   // schwach: Sweeps mit tausenden Szenen dürfen nichts festhalten
  return w;
}

module.exports = { H, FILLER, PILES, frei, charmeKlau, ort, anzahl, geisterHand, erwarteStapel, zerstoere, waechter };
