#!/usr/bin/env python3
"""Quali frasi di content/texts.json compaiono davvero sul sito (per l'app: le altre si nascondono)."""
import json, re, glob, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
T = json.load(open('content/texts.json', encoding='utf-8')); keys = set(T['it'])
used = set()
for f in glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('tools/templates/**/*.html', recursive=True):
    if f.startswith(('app/', 'admin/')): continue
    used |= set(re.findall(r'data-i="([a-z0-9_]+)"', open(f, encoding='utf-8').read()))
js = open('assets/site.js', encoding='utf-8').read() + open('tools/build_site.py', encoding='utf-8').read()
used |= set(re.findall(r'"([a-z0-9_]+)"', js)) & keys
for p in set(re.findall(r't\("([a-z0-9_]+_)"\s*\+', js)):
    used |= {k for k in keys if k.startswith(p)}
json.dump(sorted(used & keys), open('assets/texts-used.json', 'w', encoding='utf-8'))
print('frasi usate:', len(used & keys), 'di', len(keys))
