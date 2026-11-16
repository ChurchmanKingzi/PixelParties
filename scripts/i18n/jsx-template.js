// Gemeinsame Regel fuer "zusammengesetzten" JSX-Text: <p>Hello <b>big</b> {n} world</p> -> Vorlage "Hello {0} {1} world".
// Genutzt vom Build (Babel-Plugin in scripts/build.js -> ppTrans) UND vom Extraktor (scripts/i18n/extract.js), damit die Schluessel
// der Uebersetzungsdatei exakt den Vorlagen entsprechen, die zur Laufzeit nachgeschlagen werden.
// Nur Host-Elemente (div, span, p, button …) und Fragmente: eigene Komponenten bekommen ihre `children` unveraendert.
'use strict';
const SKIP = new Set(['script', 'style', 'textarea', 'pre', 'code']);
function jsxTemplate(t, node) {
  if (node._ppT) return null;
  if (node.type === 'JSXElement') {
    const n = node.openingElement.name;
    if (n.type !== 'JSXIdentifier' || !/^[a-z]/.test(n.name) || SKIP.has(n.name)) return null;
  } else if (node.type !== 'JSXFragment') return null;
  if (node.children.some(c => c.type === 'JSXSpreadChild')) return null;
  const kids = t.react.buildChildren(node);
  let tpl = '', hasText = false, hasVal = false; const values = [];
  for (const c of kids) {
    if (c.type === 'StringLiteral') { tpl += c.value; if (/[A-Za-z]{2}/.test(c.value)) hasText = true; }
    else { tpl += '{' + values.length + '}'; values.push(c); hasVal = true; }
  }
  if (!hasText || !hasVal) return null;
  return { tpl, values };
}
function plugin(Babel) {
  const t = Babel.packages.types;
  return () => ({ visitor: { 'JSXElement|JSXFragment'(p) {
    const r = jsxTemplate(t, p.node);
    if (!r) return;
    p.node._ppT = true;
    p.node.children = [t.jsxExpressionContainer(t.callExpression(t.identifier('ppTrans'), [t.stringLiteral(r.tpl), t.arrayExpression(r.values)]))];
  } } });
}
module.exports = { jsxTemplate, plugin };
