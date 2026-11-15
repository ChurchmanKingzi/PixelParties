// Sprachumschaltung (en = Standard, de). Wahl liegt in localStorage 'pp-lang'.
// Kartentexte: data/i18n/<lang>-cards.json  { "<EN-Name>": { name, effect }, "_names": { "<EN>": "<DE>" } }
// Der Kartenschluessel (c.name) bleibt IMMER englisch (Spiellogik, Decks, Bilder) – nur die Anzeige wechselt.
(function () {
  let lang = 'en';
  try { const v = localStorage.getItem('pp-lang'); if (v === 'de' || v === 'en') lang = v; } catch (e) {}
  const P = { lang, cards: {}, names: {} };
  P.get = () => lang;
  P.set = (l) => { try { localStorage.setItem('pp-lang', l); } catch (e) {} location.reload(); };
  P.toggle = () => P.set(lang === 'en' ? 'de' : 'en');
  // Anzeigename einer Karte (Fallback: englischer Name)
  P.ui = {}; P.miss = new Set();   // Texte ohne Uebersetzung (zur Kontrolle: window.PP_I18N.miss)
  // UI-Begriff uebersetzen (Kartentyp, Untertyp, Schule, Archetyp, Startfaehigkeit, ...); ohne Eintrag oder auf Englisch: Original
  P.archetypes = {};
  P.cardName = (n) => (P.cards[n] && P.cards[n].name) || n;
  P.cardEffect = (c) => (P.cards[c.name] && P.cards[c.name].effect) || c.effect;
  // Laedt die Uebersetzungen; Kartenobjekte bekommen `effectEn`/`nameEn` und die deutsche `effect`.
  let loading = null;
  P.load = () => loading || (loading = (async () => {
    if (lang === 'en') return;
    try {
      try { P.ui = await (await fetch('/data/i18n/' + lang + '-ui.json')).json(); } catch (e) { P.ui = {}; }
      const j = await (await fetch('/data/i18n/' + lang + '-cards.json')).json();
      P.names = Object.assign({}, j._names || {}); P.archetypes = j._archetypes || {}; delete j._names; delete j._archetypes; P.cards = j; for (const k in j) P.names[k] = j[k].name;
    } catch (e) { /* ohne Datei: englisch */ }
  })());
  // Faehigkeits-Bonus ("Leadership 3", "Fighting") -> Namensliste; sonst Freitext aus der Uebersetzung der Karte
  const saDe = (v, t, k) => {
    if (!v) return v;
    if (t && t[k]) return t[k];
    if (P.names[v]) return P.names[v];
    const m = /^(.+) (\d+)$/.exec(v);
    return m && P.names[m[1]] ? P.names[m[1]] + ' ' + m[2] : v;
  };
  P.apply = (cards) => {
    for (const c of cards) {
      const t = P.cards[c.name];
      if (c.startingAbility1 || c.startingAbility2) { c.sa1De = saDe(c.startingAbility1, t, 'startingAbility1'); c.sa2De = saDe(c.startingAbility2, t, 'startingAbility2'); }   // Anzeige; die Originalfelder bleiben (Logik)
      if (t) { c.nameEn = c.name; c.effectEn = c.effect; c.effect = t.effect; c.displayName = t.name; }
    }
  };

  // ═══ Oberflaeche: Laufzeit-Uebersetzer ═══
  // Quelle: data/i18n/<lang>-ui.json { "English": "Deutsch", "Text mit {0}": "Text mit {0}" } (scripts/i18n/extract.js liefert die Texte).
  // Textknoten und title/placeholder/alt/aria-label werden beim Einfuegen und bei Aenderungen ersetzt (MutationObserver);
  // Texte mit Platzhaltern {0} {1} laufen ueber Muster. Bereiche mit data-i18n-skip (Chat, Spielernamen) bleiben unberuehrt.
  let tplByHead = null, cache = new Map();
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const buildTemplates = () => {
    tplByHead = {};
    for (const k in P.ui) {
      if (!/\{\d+\}/.test(k)) continue;
      const parts = k.split(/\{\d+\}/);
      const re = new RegExp('^' + parts.map(esc).join('([\\s\\S]*?)') + '$');
      const head = (parts[0] || '*').charAt(0);
      (tplByHead[head] = tplByHead[head] || []).push({ re, to: P.ui[k] });
    }
  };
  const lookup = (t) => {
    if (cache.has(t)) return cache.get(t);
    let r = P.ui[t];
    if (r == null && P.names[t]) r = P.names[t];
    if (r == null) {
      if (!tplByHead) buildTemplates();
      const cand = (tplByHead[t.charAt(0)] || []).concat(tplByHead['*'] || []);
      for (const c of cand) {
        const m = c.re.exec(t);
        if (m) { r = c.to.replace(/\{(\d+)\}/g, (_, i) => { const g = m[+i + 1]; return P.ui[g] || P.names[g] || g; }); break; }
      }
    }
    if (cache.size > 5000) cache.clear();
    cache.set(t, r == null ? t : r);
    return r == null ? t : r;
  };
  P.t = (s) => (lang === 'en' || s == null) ? s : lookup(String(s));
  const SKIP_TAG = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CANVAS: 1, NOSCRIPT: 1 };
  const skipped = (n) => { for (let e = n.nodeType === 1 ? n : n.parentNode; e && e.nodeType === 1; e = e.parentNode) { if (SKIP_TAG[e.tagName] || (e.hasAttribute && e.hasAttribute('data-i18n-skip'))) return true; } return false; };
  const textNode = (n) => {
    const raw = n.nodeValue;
    if (!raw || raw.length > 400 || !/[A-Za-z]{2}/.test(raw)) return;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
    const t = m[2].replace(/\s+/g, ' ');
    const r = lookup(t);
    if (r !== t) { if (!skipped(n)) n.nodeValue = m[1] + r + m[3]; }
    else if (/[A-Za-z]{2}/.test(t) && !skipped(n)) P.miss.add(t);
  };
  const ATTRS = ['title', 'placeholder', 'alt', 'aria-label'];
  const attrs = (e) => { for (const a of ATTRS) { const v = e.getAttribute && e.getAttribute(a); if (v && /[A-Za-z]{2}/.test(v)) { const r = lookup(v.replace(/\s+/g, ' ').trim()); if (r !== v && !skipped(e)) e.setAttribute(a, r); } } };
  const walk = (root) => {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1 || SKIP_TAG[root.tagName]) return;
    attrs(root);
    const tw = document.createTreeWalker(root, 5 /* TEXT | ELEMENT */);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (n.nodeType === 3) textNode(n); else if (!SKIP_TAG[n.tagName]) attrs(n); }
  };
  P.startDom = () => {
    if (lang === 'en') return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', P.startDom, { once: true }); return; }
    walk(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach(walk);
        else if (m.type === 'characterData') textNode(m.target);
        else if (m.type === 'attributes') attrs(m.target);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  window.PP_I18N = P;
  window.ppT = P.t;
  document.documentElement.lang = lang;
  if (lang !== 'en') {
    const go = () => P.load().then(() => P.startDom());
    P.ready = go();
  }
})();
