#!/usr/bin/env python3
"""Crea assets/schema.json (i campi dei moduli dell'app) da admin/config.yml. Da rilanciare solo se cambiano i campi."""
import json, os, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = ("name", "label", "widget", "hint", "required", "default", "options", "multiple", "collapsed", "summary", "label_singular", "value_type", "min", "max", "pattern")
def clean(f):
    o = {k: f[k] for k in KEEP if k in f}
    if "fields" in f: o["fields"] = [clean(x) for x in f["fields"]]
    if "field" in f: o["field"] = clean(f["field"])
    return o
c = yaml.safe_load(open(os.path.join(ROOT, "admin", "config.yml"), encoding="utf-8"))
out = {"files": {}, "blog": None}
for col in c["collections"]:
    if col["name"] == "blog": out["blog"] = {"label": col.get("label"), "fields": [clean(x) for x in col["fields"]]}
    for f in col.get("files", []):
        out["files"][f["name"]] = {"label": f.get("label"), "description": f.get("description", ""), "fields": [clean(x) for x in f["fields"]]}
json.dump(out, open(os.path.join(ROOT, "assets", "schema.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("ok", list(out["files"]), len(json.dumps(out)))
