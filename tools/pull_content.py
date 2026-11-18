#!/usr/bin/env python3
"""Prima di creare le pagine, scarica da Supabase i contenuti salvati nell'app
(case, escursioni, testi, foto, blog…) e li scrive in content/.
Se Supabase non risponde, restano i file già presenti. Nessuna libreria esterna."""
import json, os, re, glob, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def cfg():
    s = open(os.path.join(ROOT, "config.js"), encoding="utf-8").read()
    url = re.search(r'SUPABASE_URL:\s*"([^"]+)"', s).group(1).rstrip("/")
    key = re.search(r'SUPABASE_ANON_KEY:\s*"([^"]+)"', s).group(1)
    return url, key

def get(url, key, path):
    req = urllib.request.Request(url + "/rest/v1/" + path, headers={"apikey": key, "Authorization": "Bearer " + key})
    with urllib.request.urlopen(req, timeout=20) as r: return json.load(r)

def main():
    try:
        url, key = cfg()
        rows = get(url, key, "site_content?select=key,data")
        posts = get(url, key, "site_posts?select=slug,data")
    except Exception as e:
        print("Contenuti dall'app non scaricati (uso i file del sito):", e); return
    n = 0
    for r in rows:
        if r.get("data") and re.fullmatch(r"[a-z]+", r.get("key", "")):
            json.dump(r["data"], open(os.path.join(ROOT, "content", r["key"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1); n += 1
    if posts:
        for f in glob.glob(os.path.join(ROOT, "content", "blog", "*.json")): os.remove(f)
        for p in posts:
            if re.fullmatch(r"[a-z0-9][a-z0-9-]*", p.get("slug", "")):
                json.dump(p.get("data") or {}, open(os.path.join(ROOT, "content", "blog", p["slug"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"Dall'app: {n} sezioni e {len(posts)} articoli.")

if __name__ == "__main__":
    main()
