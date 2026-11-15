// Extrahiert menschenlesbare Texte aus Node-Quellen (server.js, cards/effects/*.js): Spielprotokoll, Abfragen, Fehlermeldungen.
// Aufruf: node scripts/i18n/extract-node.js <datei>...   -> JSON auf stdout. Templates: ${..} -> {0}, {1} ...
const fs = require('fs');
const Babel = require('../vendor/babel.min.js');
const out = new Map();
const seen = new WeakSet();
function ok(s) {
  const t = s.trim();
  if (t.length < 4 || !/[A-Za-z]{3}/.test(t) || !/\s/.test(t) && !/^[A-Z][a-z]+[.!?]?$/.test(t)) return false;
  if (/^(https?:|\/|\.|#|\{(?!\d+\})|SELECT |INSERT |UPDATE |DELETE |CREATE |ALTER |DROP |PRAGMA |function |const |return |\$\{)/i.test(t)) return false;
  if (/[{};=<>]/.test(t) && /\b(px|rgb|var|function|=>)\b/.test(t)) return false;
  if (/\.(js|json|png|jpg|webp|css|mp3|ogg)\b/.test(t)) return false;
  return true;
}
const tpl = n => { let s = '', i = 0; n.quasis.forEach((q, k) => { s += q.value.cooked; if (k < n.expressions.length) s += '{' + (i++) + '}'; }); return s; };
for (const file of process.argv.slice(2)) {
  let ast;
  try { Babel.transform(fs.readFileSync(file, 'utf8'), { plugins: [() => ({ visitor: {
    BinaryExpression(p) {   // "A " + x + " B" -> "A {0} B"
      if (p.node.operator !== '+' || (p.parent.type === 'BinaryExpression' && p.parent.operator === '+')) return;
      const parts = []; (function flat(n) { if (n.type === 'BinaryExpression' && n.operator === '+') { flat(n.left); flat(n.right); } else parts.push(n); })(p.node);
      if (!parts.some(n => n.type === 'StringLiteral' || n.type === 'TemplateLiteral') || parts.every(n => n.type === 'StringLiteral' || n.type === 'TemplateLiteral' || n.type === 'NumericLiteral')) return;
      let i = 0, t = '';
      for (const n of parts) { if (n.type === 'StringLiteral') { t += n.value; seen.add(n); } else if (n.type === 'TemplateLiteral') { t += tpl(n).replace(/\{(\d+)\}/g, () => '{' + (i++) + '}'); seen.add(n); } else t += '{' + (i++) + '}'; }
      add(p, t, true);
    },
    StringLiteral(p) { if (!seen.has(p.node)) add(p, p.node.value); },
    TemplateLiteral(p) { if (!seen.has(p.node)) add(p, tpl(p.node)); },
  } })], compact: false, retainLines: true, configFile: false, babelrc: false }); } catch (e) { process.stderr.write(file + ': ' + e.message.slice(0, 80) + '\n'); }
  function add(p, s, chain) {
    const parent = p.parent;
    if (parent.type === 'CallExpression' && parent.callee.name === 'require') return;
    if (parent.type === 'ImportDeclaration' || parent.type === 'MemberExpression' && parent.computed) return;
    if (parent.type === 'ObjectProperty' && parent.key === p.node) return;
    if (parent.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(parent.operator)) return;   // Vergleiche
    if (parent.type === 'BinaryExpression' && parent.operator === '+' && !chain) return;   // Teil einer Kette (Kette selbst wird erfasst)
    if (parent.type === 'SwitchCase') return;
    if (!ok(s)) return;
    const t = s.replace(/\s+/g, ' ').trim();
    if (!out.has(t)) out.set(t, { text: t, files: new Set() });
    out.get(t).files.add(file.split('/').pop());
  }
}
const list = [...out.values()].map(x => ({ text: x.text, files: [...x.files].slice(0, 3) }));
process.stdout.write(JSON.stringify(list));
process.stderr.write(list.length + ' Texte\n');
