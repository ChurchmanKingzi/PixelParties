"""Glossar-Helfer: lädt daten/keywords.json und zerlegt Regeltext in fette und normale Abschnitte.

Regel der Nomenklatur: Jeder Glossarbegriff (bold = true) wird automatisch fett gesetzt. Von Hand fett (**...**)
sind nur Fähigkeitsnamen, und zwar am Satzanfang direkt vor einem Doppelpunkt.
"""
from __future__ import annotations

import json
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
KEYWORDS = json.load(open(os.path.join(ROOT, 'daten', 'keywords.json'), encoding='utf-8'))

NOUN_SUFFIX = r'(?:s|es)?'


def bold_terms():
    """Alle Schreibweisen, die automatisch fett gesetzt werden (längste zuerst)"""
    forms = set()
    for k in KEYWORDS:
        if not k['bold']:
            continue
        if 'forms' in k:
            forms.update(k['forms'])
        else:
            forms.add(k['en'])
    return sorted(forms, key=len, reverse=True)


def _bold_regex():
    alts = []
    for f in bold_terms():
        alts.append(re.escape(f) + (NOUN_SUFFIX if ' ' in f or f[-1] not in 'se' else ''))
    return re.compile(r'(?<![\w−-])(?:' + '|'.join(alts) + r')(?![\w])')


_BOLD_RE = None


def segments(text: str):
    """text -> Liste (Abschnitt, fett?). Explizit **fett** und Glossarbegriffe werden fett."""
    global _BOLD_RE
    if _BOLD_RE is None:
        _BOLD_RE = _bold_regex()
    out = []
    for i, part in enumerate(re.split(r'\*\*', text)):
        if i % 2 == 1:
            out.append((part, True))
            continue
        pos = 0
        for m in _BOLD_RE.finditer(part):
            if m.start() > pos:
                out.append((part[pos:m.start()], False))
            out.append((m.group(0), True))
            pos = m.end()
        if pos < len(part):
            out.append((part[pos:], False))
    return [s for s in out if s[0]]


def all_terms():
    """Alle erlaubten großgeschriebenen Begriffe (für den Linter)"""
    terms = set()
    for k in KEYWORDS:
        terms.add(k['en'])
        for f in k.get('forms', []):
            terms.add(f)
    return terms


def abbreviations():
    return {k['abbr']: k['en'] for k in KEYWORDS if 'abbr' in k}
