// PPS — Pixel Parties Script. Kompiliert lesbare Kampagnentexte (campaign/src/**/*.pps)
// in das Schrittformat der Kampagnen-Engine (public/app-campaign.jsx).
//
// ZEILENARTEN (Einrückung = 2 Leerzeichen, Blöcke durch Einrückung, keine End-Marken)
//   # Kommentar                          Zeile wird ignoriert
//   Fließtext                            Erzähler
//   [nathan] "Rede."                     Figur spricht   ([nathan?] = noch unbekannt: Alias aus aliases.json,
//                                        [nathan=grin] = Stimmung, [?Loudspeaker] = einmalige Stimme)
//   ~ Gedanke                            Gedanke des Spielers (Rowan)
//   {H} {H:he} {H:him} {H:his} {H:He} {H:His} {H:himself} {H:full} {H:mate}
//                                        Platzhalter für den Host; nur in Szenen mit Kopfwort `host`
//
//   @scene id [once] [host] [bg=x] [music=x] [time=n] [when <Bedingung>]     (Spalte 0)
//   @place id / @event id ...                                                 (Spalte 0, siehe unten)
//   @bg x  @music x  @sfx x  @fx shake|flash|fadeout|fadein [ms]  @wait ms  @clear
//   @enter id [x= y= h= flip]  @exit id  @move id x= [ms=]  @face id [flip]  @dim id
//   @flag a b  @unflag a  @set k=v  @add k +n  @aff id +n | Begründung  @meet id
//   @item "Name" [n]  @coins n  @card "Name" [n]  @learn place  @lock place  @unlock place
//   @time n  @clock HH:MM  @wake HH:MM (nächster Tag)  @goto place [Minuten]  @scene id  @end  @gameover "Text"
//   @label x  @jump x  @pickhost
//   @if <Bed.> / @elif <Bed.> / @else   (Block durch Einrückung)
//   @choice [Frage]                      darunter  `> Text [@if Bed.] [@hint Wort]`  + eingerückter Block
//   @duel id deck=slug name="Name" [ante] [mustwin]   darunter @win / @lose / @reward coins=n cards=a,b flags=x,y
//
// BEDINGUNGEN (and / or / not / Klammern):
//   flag · met:id · host=id · host · aff:id>=10 · day>=5 · time>=17:00 · slot=Morning · weekday=Monday ·
//   weekend · schoolday · at:ort · done:szene · won:duell · lost:duell · visited:ort · var:name=wert · coins>=n
//
// WELT-DEKLARATIONEN (Spalte 0), alle zu EINER Welt-Datei zusammengelegt:
//   @place ort            darunter eingerückt: travel n · onArrive szene [repeat] · lockedText "…" · closedText "…" ·
//                         when <Bed.> · object id sprite= x= y= h= label= scene= [when <Bed.>] ·
//                         action id "Beschriftung" scene=… | text="…" [when <Bed.>]
//   @event id scene=… at=ort day=n from=hh:mm to=hh:mm [repeat] [when <Bed.>]
'use strict';

const SLOT_EXPR = '((m)=>m>=420&&m<660?"Morning":m>=660&&m<840?"Midday":m>=840&&m<1080?"Afternoon":m>=1080&&m<1320?"Evening":"Night")(s.minutes)';
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

class Raw { constructor(src) { this.src = src; } }
const raw = (s) => new Raw(s);

function ser(v, ind = 0) {
  const pad = '  '.repeat(ind + 1), end = '  '.repeat(ind);
  if (v instanceof Raw) return v.src;
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return '[\n' + v.map(x => pad + ser(x, ind + 1)).join(',\n') + '\n' + end + ']';
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).filter(k => v[k] !== undefined);
    if (!keys.length) return '{}';
    const flat = keys.every(k => !(v[k] && typeof v[k] === 'object' && !(v[k] instanceof Raw)));
    const body = keys.map(k => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${ser(v[k], ind + 1)}`);
    if (flat && body.join(', ').length < 110) return '{ ' + body.join(', ') + ' }';
    return '{\n' + body.map(b => pad + b).join(',\n') + '\n' + end + '}';
  }
  return JSON.stringify(v);
}

// ───────────────────────── Bedingungen ─────────────────────────
function tokenizeCond(str) {
  const out = []; let i = 0;
  while (i < str.length) {
    const c = str[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')') { out.push(c); i++; continue; }
    let j = i; while (j < str.length && !/[\s()]/.test(str[j])) j++;
    out.push(str.slice(i, j)); i = j;
  }
  return out;
}
const cmpOp = (op) => (op === '=' ? '===' : op);
function atomToJs(a, ctx) {
  let m;
  if (a === 'weekend') return '(((s.day-1)%7)>=5)';
  if (a === 'schoolday') return '(((s.day-1)%7)<5)';
  if (a === 'host') return '!!s.vars.host';
  if ((m = a.match(/^met:(\w+)$/))) { ctx.reads.add('met_' + m[1]); ctx.cast.add(m[1]); return `!!s.flags[${JSON.stringify('met_' + m[1])}]`; }
  if ((m = a.match(/^host=(\w+)$/))) { ctx.hostCond = true; return `s.vars.host===${JSON.stringify(m[1])}`; }
  if ((m = a.match(/^aff:(\w+)(>=|<=|>|<|=)(-?\d+)$/))) { ctx.cast.add(m[1]); return `((s.vars[${JSON.stringify('aff_' + m[1])}]||0)${cmpOp(m[2])}${m[3]})`; }
  if ((m = a.match(/^day(>=|<=|>|<|=)(\d+)$/))) return `(s.day${cmpOp(m[1])}${m[2]})`;
  if ((m = a.match(/^time(>=|<=|>|<)(\d{1,2}):(\d\d)$/))) return `(s.minutes${m[1]}${+m[2] * 60 + +m[3]})`;
  if ((m = a.match(/^slot=(Morning|Midday|Afternoon|Evening|Night)$/))) return `(${SLOT_EXPR}===${JSON.stringify(m[1])})`;
  if ((m = a.match(/^weekday=(\w+)$/))) { const k = WEEKDAYS.indexOf(m[1]); if (k < 0) throw new Error('weekday?: ' + a); return `(((s.day-1)%7)===${k})`; }
  if ((m = a.match(/^at:(\w+)$/))) { ctx.places.add(m[1]); return `s.location===${JSON.stringify(m[1])}`; }
  if ((m = a.match(/^done:(\w+)$/))) { ctx.sceneRefs.add(m[1]); return `!!s.scenesDone[${JSON.stringify(m[1])}]`; }
  if ((m = a.match(/^won:(\w+)$/))) return `(s.duels[${JSON.stringify(m[1])}]==="won")`;
  if ((m = a.match(/^lost:(\w+)$/))) return `(s.duels[${JSON.stringify(m[1])}]==="lost")`;
  if ((m = a.match(/^visited:(\w+)$/))) { ctx.places.add(m[1]); return `!!s.visited[${JSON.stringify(m[1])}]`; }
  if ((m = a.match(/^coins>=(\d+)$/))) return `((s.coins||0)>=${m[1]})`;
  if ((m = a.match(/^var:(\w+)(>=|<=|>|<|=)(.+)$/))) { const v = /^-?\d+(\.\d+)?$/.test(m[3]) ? m[3] : JSON.stringify(m[3]); return `(s.vars[${JSON.stringify(m[1])}]${cmpOp(m[2])}${v})`; }
  if (/^[A-Za-z_]\w*$/.test(a)) { ctx.reads.add(a); return `!!s.flags[${JSON.stringify(a)}]`; }
  throw new Error('Bedingung nicht lesbar: "' + a + '"');
}
function condToJs(str, ctx) {
  const t = tokenizeCond(str); let p = 0;
  const peek = () => t[p], next = () => t[p++];
  function or() { let l = and(); while (peek() === 'or') { next(); l = `(${l}||${and()})`; } return l; }
  function and() { let l = not(); while (peek() === 'and') { next(); l = `(${l}&&${not()})`; } return l; }
  function not() { if (peek() === 'not') { next(); return `!${not()}`; } return prim(); }
  function prim() {
    const x = next();
    if (x === undefined) throw new Error('Bedingung endet zu früh: "' + str + '"');
    if (x === '(') { const e = or(); if (next() !== ')') throw new Error('")" fehlt in: ' + str); return e; }
    return atomToJs(x, ctx);
  }
  const js = or();
  if (p < t.length) throw new Error('Überzählig in Bedingung "' + str + '": ' + t.slice(p).join(' '));
  return raw(`(s)=>${js}`);
}

// ───────────────────────── Zeilen → Baum ─────────────────────────
function parseKV(str) {
  const kv = {}, flags = new Set(); const re = /(\w+)=("([^"]*)"|\S+)|"([^"]*)"|(\S+)/g; let m;
  const pos = [];
  while ((m = re.exec(str))) {
    if (m[1]) kv[m[1]] = m[3] !== undefined ? m[3] : m[2];
    else if (m[4] !== undefined) pos.push(m[4]);
    else { pos.push(m[5]); flags.add(m[5]); }
  }
  return { kv, pos, flags };
}
function splitWhen(rest) { const i = rest.search(/(^|\s)when\s/); return i < 0 ? [rest.trim(), null] : [rest.slice(0, i).trim(), rest.slice(i).replace(/^\s*when\s+/, '').trim()]; }

function readLines(src, file) {
  const out = [];
  src.split(/\r?\n/).forEach((ln, i) => {
    if (!ln.trim() || /^\s*#/.test(ln)) return;
    const m = ln.match(/^( *)(.*?)\s*$/);
    if (m[1].length % 2) throw new Error(`${file}:${i + 1}: Einrückung muss ein Vielfaches von 2 sein`);
    out.push({ ind: m[1].length / 2, text: m[2], line: i + 1, file });
  });
  return out;
}
function parseBlock(L, i, ind) {
  const nodes = [];
  while (i < L.length && L[i].ind >= ind) {
    if (L[i].ind > ind) throw new Error(`${L[i].file}:${L[i].line}: unerwartet eingerückt`);
    const l = L[i]; i++;
    const node = { text: l.text, line: l.line, file: l.file };
    if (/^@(if|elif|else|choice|duel|win|lose|host)\b/.test(l.text) || /^>\s/.test(l.text)) {
      const [body, j] = parseBlock(L, i, ind + 1); node.body = body; i = j;
    }
    nodes.push(node);
  }
  return [nodes, i];
}

// ───────────────────────── Kompilieren ─────────────────────────
function hostTokens(s) { return /\{H(:\w+)?\}/.test(s); }
function expandHost(text, pool, pron) {
  return pool.map(id => ({ id, text: text.replace(/\{H(?::(\w+))?\}/g, (_, k) => { const v = pron[id][k || 'H']; if (v === undefined) throw new Error('Unbekannter Host-Platzhalter {H:' + k + '}'); return v; }) }));
}
const stripQ = (t) => { t = t.trim(); const m = t.match(/^"(.*)"$/s); return m && !m[1].includes('"') ? m[1] : t; };

function compileScene(head, nodes, env) {
  const ctx = env.ctxFor(head.id);
  let labelN = 0; const uid = (p) => `${p}_${++labelN}`;
  const steps = [];
  const err = (n, msg) => { throw new Error(`${n.file}:${n.line}: ${msg}`); };

  function emitSay(n, node) {
    let text = node.text, speaker = null, name = null, mood = null, think = false;
    let m;
    if ((m = text.match(/^\[([?]?)([A-Za-z0-9_ .'-]+?)(\?|=(\w+))?\]\s*(.*)$/s))) {
      const rawId = m[2]; text = m[5];
      if (m[1]) name = rawId; else { speaker = rawId; ctx.cast.add(rawId); }
      if (m[3] === '?') name = env.alias(rawId);
      if (m[4]) mood = m[4];
    } else if (text.startsWith('~ ')) { think = true; text = text.slice(2); }
    text = stripQ(text);
    if (text.length > 480) env.warn(`${node.file}:${node.line}: Zeile hat ${text.length} Zeichen (lang für eine Dialogbox)`);
    const base = {};
    if (speaker && !name) base.say = speaker; else if (name) { base.say = speaker || undefined; base.name = name; }
    if (think) base.think = text; else base.text = text;
    if (mood) base.mood = mood;
    env.words += text.split(/\s+/).length;
    if (hostTokens(text)) {
      if (!head.host) err(node, 'Platzhalter {H} nur in Szenen mit Kopfwort `host`');
      if (think) base.think = undefined;
      for (const v of expandHost(text, env.pool, env.pron)) {
        const st = Object.assign({}, base, { when: { var: { host: v.id } } });
        if (think) st.think = v.text; else st.text = v.text;
        steps.push(st);
      }
    } else steps.push(base);
  }

  function cmd(n, node) {
    const sp = node.text.indexOf(' ');
    const name = (sp < 0 ? node.text : node.text.slice(0, sp)).slice(1), rest = sp < 0 ? '' : node.text.slice(sp + 1).trim();
    const P = () => parseKV(rest);
    const num = (v) => (v === undefined ? undefined : Number(v));
    switch (name) {
      case 'bg': ctx.bgs.add(rest); steps.push({ bg: rest }); break;
      case 'music': steps.push({ music: rest }); break;
      case 'sfx': steps.push({ sfx: rest }); break;
      case 'fx': { const p = P(); steps.push({ fx: p.pos[0], ms: num(p.pos[1]) }); break; }
      case 'wait': steps.push({ wait: Number(rest) }); break;
      case 'clear': steps.push({ clear: true }); break;
      case 'enter': { const p = P(); ctx.cast.add(p.pos[0]); steps.push({ enter: p.pos[0], x: num(p.kv.x), y: num(p.kv.y), h: num(p.kv.h), flip: p.flags.has('flip') ? true : undefined }); break; }
      case 'exit': ctx.cast.add(rest); steps.push({ exit: rest }); break;
      case 'move': { const p = P(); steps.push({ move: p.pos[0], x: num(p.kv.x), y: num(p.kv.y), ms: num(p.kv.ms) }); break; }
      case 'face': { const p = P(); steps.push({ face: p.pos[0], flip: p.flags.has('flip') }); break; }
      case 'dim': steps.push({ dim: rest }); break;
      case 'flag': for (const f of rest.split(/\s+/)) { ctx.sets.add(f); steps.push({ flag: f }); } break;
      case 'unflag': for (const f of rest.split(/\s+/)) steps.push({ unflag: f }); break;
      case 'set': for (const kvp of rest.split(/\s+/)) { const [k, v] = kvp.split('='); steps.push({ set: { [k]: /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v === 'true' ? true : v === 'false' ? false : v } }); } break;
      case 'add': { const [k, v] = rest.split(/\s+/); steps.push({ add: { [k]: Number(v) } }); break; }
      case 'aff': { const [spec, why] = rest.split('|'); const [id, v] = spec.trim().split(/\s+/); ctx.cast.add(id); steps.push({ add: { ['aff_' + id]: Number(v) }, why: why ? why.trim() : undefined }); break; }
      case 'meet': for (const id of rest.split(/\s+/)) { ctx.cast.add(id); ctx.sets.add('met_' + id); steps.push({ flag: 'met_' + id }); } break;
      case 'item': { const p = P(); steps.push({ item: p.pos[0], n: num(p.pos[1]) }); break; }
      case 'coins': steps.push({ coins: Number(rest) }); break;
      case 'card': { const p = P(); steps.push({ card: p.pos[0], n: num(p.pos[1]) }); break; }
      case 'learn': ctx.places.add(rest); steps.push({ learn: rest }); break;
      case 'lock': ctx.places.add(rest); steps.push({ lock: rest }); break;
      case 'unlock': ctx.places.add(rest); steps.push({ unlock: rest }); break;
      case 'time': steps.push({ time: Number(rest) }); break;
      case 'clock': { const m = rest.match(/^(\d{1,2}):(\d\d)$/); if (!m) err(n, '@clock HH:MM'); const T = +m[1] * 60 + +m[2]; steps.push({ run: raw(`(s)=>{ if (s.minutes < ${T}) s.minutes = ${T}; }`) }); break; }
      case 'wake': { const m = rest.match(/^(\d{1,2}):(\d\d)$/); if (!m) err(n, '@wake HH:MM'); const T = +m[1] * 60 + +m[2]; steps.push({ run: raw(`(s)=>{ s.day += 1; s.minutes = ${T}; }`) }); break; }
      case 'goto': { const p = P(); ctx.places.add(p.pos[0]); steps.push({ goto: p.pos[0], travel: p.pos[1] !== undefined ? Number(p.pos[1]) : 0 }); break; }
      case 'scene': ctx.sceneRefs.add(rest); steps.push({ scene: rest }); break;
      case 'end': steps.push({ end: true }); break;
      case 'gameover': steps.push({ gameOver: stripQ(rest) }); break;
      case 'label': steps.push({ label: rest }); break;
      case 'jump': steps.push({ jump: rest }); break;
      case 'pickhost': ctx.pickhost = true; ctx.sets.add('host_decided'); steps.push({ run: raw(env.pickHostSrc()) }); steps.push({ flag: 'host_decided' }); break;
      default: err(n, 'unbekannter Befehl @' + name);
    }
  }

  function block(nodes) {
    for (let k = 0; k < nodes.length; k++) {
      const n = nodes[k]; const t = n.text;
      try {
        if (t.startsWith('@if ') || t === '@if') {
          const end = uid('end'); let ifs = [n];
          while (k + 1 < nodes.length && /^@(elif|else)\b/.test(nodes[k + 1].text)) ifs.push(nodes[++k]);
          ifs.forEach((b, bi) => {
            const isElse = b.text.startsWith('@else');
            const next = uid('next');
            if (!isElse) {
              const cond = b.text.replace(/^@(if|elif)\s+/, '');
              const c = condToJs(cond, ctx);
              steps.push({ when: raw(`(s)=>!(${c.src.replace(/^\(s\)=>/, '')})`), jump: next });
            }
            block(b.body || []);
            if (bi < ifs.length - 1) steps.push({ jump: end });
            if (!isElse) steps.push({ label: next });
          });
          steps.push({ label: end });
        } else if (t.startsWith('@host ')) {
          const ids = t.slice(6).split(/[\s,]+/).filter(Boolean); ctx.hostCond = true; if (!head.host) err(n, '@host nur in Szenen mit Kopfwort `host`');
          const next = uid('next');
          steps.push({ when: raw(`(s)=>!(${ids.map(i => `s.vars.host===${JSON.stringify(i)}`).join('||')})`), jump: next });
          block(n.body || []); steps.push({ label: next });
        } else if (t.startsWith('@choice')) {
          const prompt = stripQ(t.slice(7).trim()) || undefined; const end = uid('choiceend');
          const opts = (n.body || []).map(o => {
            if (!/^>\s/.test(o.text)) err(o, 'unter @choice nur Zeilen mit "> "');
            let tx = o.text.slice(2).trim(), when = null, hint = null, m;
            if ((m = tx.match(/\s@hint\s+(.+)$/))) { hint = m[1].trim(); tx = tx.slice(0, m.index); }
            if ((m = tx.match(/\s@if\s+(.+)$/))) { when = m[1].trim(); tx = tx.slice(0, m.index); }
            // Format der Antwortoptionen: entweder ausschließlich wörtliche Rede ("…") oder eine beschreibende Anweisung ohne Anführungszeichen.
            const quoted = /^".*"$/s.test(tx.trim()) && !tx.trim().slice(1, -1).includes('"');
            if (!quoted && tx.includes('"')) err(o, 'Antwortoption mischt Rede und Beschreibung: entweder komplett "in Anführungszeichen" oder ohne Anführungszeichen formulieren: ' + tx.slice(0, 60));
            if (quoted && /\s@hint|\s@if/.test(stripQ(tx))) err(o, 'Antwortoption: Marker gehören hinter das schließende Anführungszeichen');
            return { o, text: stripQ(tx), when, hint, quoted, label: uid('opt') };
          });
          if (!opts.length) err(n, '@choice ohne Optionen');
          steps.push({ prompt, choice: opts.map(o => ({ text: o.text, goto: o.label, when: o.when ? condToJs(o.when, ctx) : undefined, hint: o.hint || undefined })) });
          steps.push({ jump: end });
          for (const o of opts) {
            steps.push({ label: o.label }); env.words += o.text.split(/\s+/).length;
            if (o.quoted) { // gesprochene Option: Rowan sagt sie auch laut (Echo), danach geht der Block weiter
              if (hostTokens(o.text)) err(o.o, '{H} nicht in Antwortoptionen');
              steps.push({ say: 'rowan', text: o.text });
            }
            block(o.o.body || []); steps.push({ jump: end });
          }
          steps.push({ label: end });
        } else if (t.startsWith('@duel ')) {
          const p = parseKV(t.slice(6)); const id = p.pos[0]; ctx.duels.add(id);
          const win = (n.body || []).find(b => b.text === '@win'), lose = (n.body || []).find(b => b.text === '@lose'), rew = (n.body || []).find(b => b.text.startsWith('@reward'));
          const sub = (b) => { const saved = steps.splice(0, steps.length); block(b ? b.body || [] : []); return steps.splice(0, steps.length, ...saved); };
          const d = { duel: id, opponent: p.kv.deck, opponentName: p.kv.name, ante: p.flags.has('ante') || undefined, mustWin: p.flags.has('mustwin') ? true : false };
          if (!p.kv.deck) err(n, '@duel braucht deck=');
          env.decks.add(p.kv.deck);
          if (rew) { const r = parseKV(rew.text.slice(7)); d.rewardWin = { coins: r.kv.coins ? Number(r.kv.coins) : undefined, cards: r.kv.cards ? Object.fromEntries(r.kv.cards.split(',').map(c => [c, 1])) : undefined, flags: r.kv.flags ? r.kv.flags.split(',') : undefined }; }
          d.onWin = sub(win); d.onLose = sub(lose);
          steps.push(d);
        } else if (t.startsWith('@')) cmd(n, n);
        else emitSay(n, n);
      } catch (e) { if (/^\S+:\d+:/.test(e.message)) throw e; throw new Error(`${n.file}:${n.line}: ${e.message}`); }
    }
  }
  block(nodes);
  // Sprungmarken prüfen (flach pro Liste)
  const checkLabels = (list, where) => {
    const have = new Set(list.filter(s => s.label).map(s => s.label));
    for (const s of list) {
      if (s.jump && !have.has(s.jump)) throw new Error(`Szene ${head.id}: Sprung auf unbekannte Marke "${s.jump}" ${where}`);
      for (const o of s.choice || []) if (o.goto && !have.has(o.goto)) throw new Error(`Szene ${head.id}: Wahl springt auf unbekannte Marke "${o.goto}"`);
      if (s.onWin) checkLabels(s.onWin, '(@win)'); if (s.onLose) checkLabels(s.onLose, '(@lose)');
    }
  };
  checkLabels(steps, '');
  return steps;
}

function parseSceneHead(text) {
  const [headPart, whenStr] = splitWhen(text.replace(/^@scene\s+/, ''));
  const p = parseKV(headPart); const id = p.pos[0];
  if (!/^[a-z0-9_]+$/.test(id)) throw new Error('Szenen-Id nur a-z 0-9 _ : ' + id);
  return { id, once: p.flags.has('once'), host: p.flags.has('host'), bg: p.kv.bg, music: p.kv.music, time: p.kv.time ? Number(p.kv.time) : undefined, when: whenStr };
}

module.exports = { raw, ser, Raw, condToJs, readLines, parseBlock, compileScene, parseSceneHead, parseKV, splitWhen, WEEKDAYS };
