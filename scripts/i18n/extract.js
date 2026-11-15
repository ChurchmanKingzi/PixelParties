// Extrahiert sichtbare UI-Texte aus JSX-Quellen (Zielliste fuer die Uebersetzung data/i18n/de-ui.json).
// Aufruf: node scripts/i18n/extract.js <datei.jsx> [vonZeile bisZeile]   -> JSON auf stdout
// Erfasst: JSX-Text, String/Template-Literale in JSX-Ausdruecken, in title/placeholder/alt/aria-label/label/text/...-Eigenschaften,
// und Argumente von notify()/setError()/setInfo()/alert()/confirm(). Templates: ${..} -> {0}, {1} ...
const fs = require('fs');
const Babel = require('../vendor/babel.min.js');
const { jsxTemplate } = require('./jsx-template');
const types = Babel.packages.types;
const seen = new WeakSet();   // schon als Ganzsatz-Vorlage erfasste Knoten
const file = process.argv[2];
const from = +process.argv[3] || 0, to = +process.argv[4] || 1e9;
const src = fs.readFileSync(file, 'utf8');
const out = new Map();
const SKIP_ATTR = new Set(['className', 'style', 'key', 'id', 'src', 'href', 'type', 'name', 'value', 'ref', 'data-pp-px', 'viewBox', 'd', 'fill', 'stroke', 'width', 'height', 'rel', 'target', 'autoComplete', 'inputMode', 'accept', 'role', 'htmlFor', 'shapeRendering', 'xmlns', 'points', 'transform']);
const TXT_KEYS = new Set(['title', 'placeholder', 'alt', 'aria-label', 'label', 'text', 'message', 'msg', 'desc', 'description', 'hint', 'tooltip', 'error', 'heading', 'caption', 'subtitle', 'header', 'name']);
const CALLS = new Set(['notify', 'setError', 'setInfo', 'alert', 'confirm', 'toast', 'showMsg']);
function textLike(s) {
  s = s.trim();
  if (s.length < 2 || !/[A-Za-z]{2}/.test(s)) return false;
  if (/^[a-z0-9_.:\/#-]+$/.test(s) && !/\s/.test(s)) return false;       // Bezeichner, Klassen, Pfade
  if (/^(https?:|\/|#|\.|\{|rgba?\(|var\()/.test(s)) return false;
  if (/[<>{};]/.test(s) && /\b(px|em|rgb|calc|var)\b/.test(s)) return false;
  return true;
}
function add(s, node, kind) {
  const line = node.loc && node.loc.start.line;
  if (line < from || line > to) return;
  const t = s.replace(/\s+/g, ' ').trim();
  if (!textLike(t)) return;
  if (!out.has(t)) out.set(t, { text: t, kind, lines: [] });
  out.get(t).lines.push(line);
}
function tpl(n) {   // TemplateLiteral -> Muster mit {0}..
  let s = '', i = 0;
  n.quasis.forEach((q, k) => { s += q.value.cooked; if (k < n.expressions.length) s += '{' + (i++) + '}'; });
  return s;
}
function strs(n, kind, cb) {   // alle String-Zweige eines Ausdrucks (Bedingungen, ||, &&, Templates)
  if (!n) return;
  switch (n.type) {
    case 'StringLiteral': cb(n.value, n); break;
    case 'TemplateLiteral': cb(tpl(n), n); break;
    case 'ConditionalExpression': strs(n.consequent, kind, cb); strs(n.alternate, kind, cb); break;
    case 'LogicalExpression': strs(n.left, kind, cb); strs(n.right, kind, cb); break;
    case 'BinaryExpression': if (n.operator === '+') { strs(n.left, kind, cb); strs(n.right, kind, cb); } break;
    case 'ParenthesizedExpression': strs(n.expression, kind, cb); break;
  }
}
Babel.transform(src, { presets: ['react'], plugins: [() => ({ visitor: {
  'JSXElement|JSXFragment'(p) {
    const r = jsxTemplate(types, p.node); if (!r) return;
    add(r.tpl, p.node, 'jsx-sentence');
    p.node.children.forEach(c => { if (c.type === 'JSXText') seen.add(c); if (c.type === 'JSXExpressionContainer') { seen.add(c); const e = c.expression; if (e && (e.type === 'StringLiteral' || e.type === 'TemplateLiteral')) seen.add(e); } });
  },
  JSXText(p) { if (!seen.has(p.node)) add(p.node.value, p.node, 'jsx'); },
  JSXExpressionContainer(p) {
    if (seen.has(p.node)) return;
    if (p.parent.type === 'JSXAttribute' && SKIP_ATTR.has(p.parent.name.name)) return;
    strs(p.node.expression, 'jsx-expr', (s, n) => add(s, n, 'jsx-expr'));
  },
  JSXAttribute(p) {
    const nm = p.node.name.name; if (SKIP_ATTR.has(nm) || !p.node.value) return;
    if (p.node.value.type === 'StringLiteral' && (TXT_KEYS.has(nm) || /\s/.test(p.node.value.value))) add(p.node.value.value, p.node.value, 'attr:' + nm);
  },
  CallExpression(p) {
    const c = p.node.callee, nm = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && c.property.name);
    if (CALLS.has(nm)) p.node.arguments.forEach(a => strs(a, 'call', (s, n) => add(s, n, 'call:' + nm)));
  },
  ObjectProperty(p) {
    const k = p.node.key.name || p.node.key.value;
    if (TXT_KEYS.has(k)) strs(p.node.value, 'prop', (s, n) => add(s, n, 'prop:' + k));
  },
} }) ] });
const list = [...out.values()];
process.stdout.write(JSON.stringify(list, null, 1));
process.stderr.write(list.length + ' Texte aus ' + file + '\n');
