#!/usr/bin/env python3
"""Genera le pagine del blog (eseguito da Netlify a ogni pubblicazione).
Legge  content/blog/*.json  e crea:
  blog.html                 elenco degli articoli
  blog/<articolo>.html      una pagina per articolo
  content/blog-index.json   elenco per la sezione «Dal blog» della Home
  sitemap.xml               mappa del sito per Google
Non servono librerie esterne."""
import html, json, os, re, glob, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOMAIN = "https://wloskizdominika.com"
TPL = os.path.join(ROOT, "tools", "templates")
LANG_NAMES = {"it": "Italiano", "de": "Deutsch", "en": "English", "pl": "Polski", "es": "Español"}
FLAGS = {"it": "🇮🇹", "de": "🇩🇪", "en": "🇬🇧", "pl": "🇵🇱", "es": "🇪🇸"}
MONTHS = {"it": "gen feb mar apr mag giu lug ago set ott nov dic", "de": "Jan Feb Mär Apr Mai Jun Jul Aug Sep Okt Nov Dez",
          "en": "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec", "pl": "sty lut mar kwi maj cze lip sie wrz paź lis gru",
          "es": "ene feb mar abr may jun jul ago sep oct nov dic"}
STATIC_PAGES = ["", "case-vacanze.html", "hotel-bb.html", "escursioni.html", "esperienze.html", "transfer.html", "noleggio.html",
                "noleggio-nautico.html", "foto-e-video.html", "servizi.html", "blog.html", "privacy.html"]

def esc(s): return html.escape(str(s or ""), quote=True)
def src(prefix, c): return c if re.match(r"^https?:", c or "") else prefix + (c or "")

def fix_url(u, prefix):
    """/pagina.html -> ../pagina.html dentro /blog/ ; i link esterni restano uguali."""
    u = u.strip()
    if re.match(r"^(https?:|mailto:|tel:|#|data:)", u): return u
    if u.startswith("//"): return u
    if u.startswith("/"): return prefix + u[1:]
    return u

# ---------- Markdown semplice -> HTML ----------
def inline(t, prefix):
    t = esc(t)
    t = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)", lambda m: f'<img src="{esc(fix_url(html.unescape(m.group(2)), prefix))}" alt="{m.group(1)}" loading="lazy">', t)
    def link(m):
        href = fix_url(html.unescape(m.group(2)), prefix)
        ext = href.startswith("http") and "wloskizdominika.com" not in href
        return f'<a href="{esc(href)}"' + (' target="_blank" rel="noopener"' if ext else "") + f">{m.group(1)}</a>"
    t = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", link, t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)", r"<em>\1</em>", t)
    return t

def markdown(md, prefix=""):
    out, para, lst = [], [], None
    def flush():
        nonlocal para, lst
        if para: out.append("<p>" + inline(" ".join(para), prefix) + "</p>"); para = []
        if lst: out.append(f"<{lst[0]}>" + "".join(f"<li>{inline(i, prefix)}</li>" for i in lst[1]) + f"</{lst[0]}>"); lst = None
    for raw in str(md or "").replace("\r", "").split("\n"):
        line = raw.rstrip()
        h = re.match(r"^(#{1,4})\s+(.*)$", line)
        ul = re.match(r"^\s*[-*+]\s+(.*)$", line)
        ol = re.match(r"^\s*\d+[.)]\s+(.*)$", line)
        if not line.strip(): flush(); continue
        if h:
            flush(); lvl = max(2, len(h.group(1)))  # l'unico h1 è il titolo
            out.append(f"<h{lvl}>{inline(h.group(2), prefix)}</h{lvl}>"); continue
        if ul or ol:
            kind = "ul" if ul else "ol"
            if para: out.append("<p>" + inline(" ".join(para), prefix) + "</p>"); para = []
            if lst and lst[0] != kind: flush()
            if not lst: lst = (kind, [])
            lst[1].append((ul or ol).group(1)); continue
        if line.startswith(">"):
            flush(); out.append("<blockquote>" + inline(line.lstrip("> "), prefix) + "</blockquote>"); continue
        if lst: flush()
        para.append(line.strip())
    flush()
    return "\n".join(out)

def words(md): return len(re.findall(r"[\w'’]+", re.sub(r"\(.*?\)", "", str(md or ""))))

def nice_date(d, lang):
    try:
        y, m, dd = [int(x) for x in str(d)[:10].split("-")]
        return f"{dd} {MONTHS.get(lang, MONTHS['it']).split()[m-1]} {y}"
    except Exception: return str(d or "")

def load_posts():
    posts = []
    for f in glob.glob(os.path.join(ROOT, "content", "blog", "*.json")):
        try: p = json.load(open(f, encoding="utf-8"))
        except Exception as e: print("ATTENZIONE: articolo non leggibile", f, e); continue
        if p.get("draft") in (True, "true", "True"): continue
        p["slug"] = os.path.splitext(os.path.basename(f))[0]
        p["lang"] = p.get("lang") or "it"
        p["date"] = str(p.get("date") or datetime.date.today().isoformat())[:10]
        p["cover"] = re.sub(r"^/", "", str(p.get("cover") or ""))
        posts.append(p)
    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts

def card(p, prefix=""):
    cover = f'<div class="media-slot"><img src="{esc(src(prefix, p["cover"]))}" alt="{esc(p.get("cover_alt") or p["title"])}" loading="lazy" class="ok"></div>' if p["cover"] else '<div class="media-slot"></div>'
    return f'''<article class="card" data-bl="{esc(p["lang"])}">
      <a href="{prefix}blog/{esc(p["slug"])}.html" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;height:100%">
      {cover}
      <div class="card-body">
        <div class="meta"><span class="chip">{FLAGS.get(p["lang"], "")} {esc(p.get("category") or "Blog")}</span><span class="chip">{esc(nice_date(p["date"], p["lang"]))}</span></div>
        <h3>{esc(p["title"])}</h3>
        <p class="clamp">{esc(p.get("description"))}</p>
        <div class="card-foot"><span class="link" data-i="read_more"></span></div>
      </div></a>
    </article>'''

def main():
    posts = load_posts()
    list_tpl = open(os.path.join(TPL, "blog-list.html"), encoding="utf-8").read()
    post_tpl = open(os.path.join(TPL, "post.html"), encoding="utf-8").read()

    # ---- elenco ----
    langs = sorted({p["lang"] for p in posts}, key=lambda l: list(LANG_NAMES).index(l) if l in LANG_NAMES else 9)
    filt = ""
    if len(langs) > 1:
        filt = '<button class="on" data-blf="all" data-i="blog_all"></button>' + "".join(f'<button data-blf="{l}">{FLAGS.get(l,"")} {LANG_NAMES.get(l,l)}</button>' for l in langs)
    cards = "\n".join(card(p) for p in posts) or '<p class="muted" data-i="blog_empty"></p>'
    open(os.path.join(ROOT, "blog.html"), "w", encoding="utf-8").write(list_tpl.replace("<!--BLOG_FILTERS-->", filt).replace("<!--BLOG_POSTS-->", cards))

    # ---- articoli ----
    os.makedirs(os.path.join(ROOT, "blog"), exist_ok=True)
    for old in glob.glob(os.path.join(ROOT, "blog", "*.html")): os.remove(old)
    groups = {}
    for p in posts: groups.setdefault(p.get("group") or p["slug"], {})[p["lang"]] = p["slug"]
    for p in posts:
        pre = "../"
        alts = groups.get(p.get("group") or p["slug"], {})
        others = [q for q in posts if q["slug"] != p["slug"] and q["lang"] == p["lang"]][:3]
        related = "\n".join(card(q, pre) for q in others)
        title = p.get("seo_title") or p["title"]
        url = f'{DOMAIN}/blog/{p["slug"]}.html'
        img = (p["cover"] if p["cover"].startswith("http") else f'{DOMAIN}/{p["cover"]}') if p["cover"] else f"{DOMAIN}/media/hero.jpg"
        ld = {"@context": "https://schema.org", "@type": "BlogPosting", "headline": p["title"], "description": p.get("description", ""),
              "image": img, "datePublished": p["date"], "dateModified": p["date"], "inLanguage": p["lang"], "mainEntityOfPage": url,
              "author": {"@type": "Person", "name": "Dominika"},
              "publisher": {"@type": "Organization", "name": "Włoski z Dominiką i Podróże do Kalabrii", "logo": {"@type": "ImageObject", "url": f"{DOMAIN}/logo.jpg"}}}
        n = words(p.get("body"))
        rep = {
            "{{TITLE}}": esc(title), "{{DESC}}": esc(p.get("description")), "{{URL}}": url, "{{OG_IMAGE}}": img,
            "{{LANG}}": esc(p["lang"]), "{{H1}}": esc(p["title"]), "{{CATEGORY}}": esc(p.get("category") or "Blog"),
            "{{FLAG}}": FLAGS.get(p["lang"], ""), "{{DATE}}": esc(nice_date(p["date"], p["lang"])), "{{DATE_ISO}}": p["date"],
            "{{READ}}": str(max(1, round(n / 200))),
            "{{COVER}}": (f'<img class="post-cover" src="{esc(src(pre, p["cover"]))}" alt="{esc(p.get("cover_alt") or p["title"])}">' if p["cover"] else ""),
            "{{BODY}}": markdown(p.get("body"), pre), "{{RELATED}}": related,
            "{{RELATED_STYLE}}": "" if related else "display:none",
            "{{HREFLANG}}": "\n".join(f'<link rel="alternate" hreflang="{l}" href="{DOMAIN}/blog/{sl}.html">' for l, sl in alts.items())
                            + (f'\n<link rel="alternate" hreflang="x-default" href="{DOMAIN}/blog/{alts["it"]}.html">' if "it" in alts else ""),
            "{{ALTS}}": json.dumps(alts, ensure_ascii=False),
            "{{JSONLD}}": json.dumps(ld, ensure_ascii=False).replace("</", "<\\/"),
        }
        page = post_tpl
        for k, v in rep.items(): page = page.replace(k, v)
        open(os.path.join(ROOT, "blog", p["slug"] + ".html"), "w", encoding="utf-8").write(page)

    # ---- pagina «leggi»: mostra subito gli articoli nuovi scritti dall'app (finché non hanno la loro pagina) ----
    dyn = {"{{TITLE}}": "Blog", "{{DESC}}": "", "{{URL}}": f"{DOMAIN}/blog.html", "{{OG_IMAGE}}": f"{DOMAIN}/media/hero.jpg", "{{LANG}}": "it",
           "{{H1}}": "", "{{CATEGORY}}": "", "{{FLAG}}": "", "{{DATE}}": "", "{{DATE_ISO}}": "", "{{READ}}": "1", "{{COVER}}": "", "{{BODY}}": "",
           "{{RELATED}}": "", "{{RELATED_STYLE}}": "display:none", "{{HREFLANG}}": '<meta name="robots" content="noindex">', "{{ALTS}}": "{}", "{{JSONLD}}": "{}"}
    page = post_tpl
    for k, v in dyn.items(): page = page.replace(k, v)
    open(os.path.join(ROOT, "blog", "leggi.html"), "w", encoding="utf-8").write(page.replace('data-page="post"', 'data-page="post" data-dyn="1"', 1))

    # ---- tutti gli articoli (anche le bozze): l'app li copia nel database la prima volta ----
    allp = []
    for f in sorted(glob.glob(os.path.join(ROOT, "content", "blog", "*.json"))):
        try: allp.append({"slug": os.path.splitext(os.path.basename(f))[0], "data": json.load(open(f, encoding="utf-8"))})
        except Exception: pass
    json.dump({"items": allp}, open(os.path.join(ROOT, "content", "blog-all.json"), "w", encoding="utf-8"), ensure_ascii=False)

    # ---- per la Home ----
    idx = [{"slug": p["slug"], "title": p["title"], "description": p.get("description", ""), "lang": p["lang"], "date": p["date"],
            "date_txt": nice_date(p["date"], p["lang"]), "cover": p["cover"], "cover_alt": p.get("cover_alt", ""), "category": p.get("category", "")} for p in posts]
    json.dump({"items": idx}, open(os.path.join(ROOT, "content", "blog-index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # ---- sitemap ----
    today = datetime.date.today().isoformat()
    try: hidden = {k for k, v in (json.load(open(os.path.join(ROOT, "content", "look.json"), encoding="utf-8")).get("menu") or {}).items() if v is False}
    except Exception: hidden = set()
    try:
        if not json.load(open(os.path.join(ROOT, "content", "hotels.json"), encoding="utf-8")).get("page_visible"): hidden.add("nav_hotel")
    except Exception: hidden.add("nav_hotel")
    PAGE_NAV = {"case-vacanze.html": "nav_house", "hotel-bb.html": "nav_hotel", "escursioni.html": "nav_exc", "esperienze.html": "nav_exp",
                "transfer.html": "nav_tr", "noleggio.html": "nav_rent", "noleggio-nautico.html": "nav_boat", "foto-e-video.html": "nav_media", "blog.html": "nav_blog"}
    urls = [f"  <url><loc>{DOMAIN}/{u}</loc><lastmod>{today}</lastmod></url>" for u in STATIC_PAGES if PAGE_NAV.get(u) not in hidden]
    try: sl = json.load(open(os.path.join(ROOT, "content", "slugs.json"), encoding="utf-8"))
    except Exception: sl = {}
    urls += [f"  <url><loc>{DOMAIN}/casa/{x}.html</loc><lastmod>{today}</lastmod></url>" for x in sl.get("houses", []) if x]
    urls += [f"  <url><loc>{DOMAIN}/escursione/{x}.html</loc><lastmod>{today}</lastmod></url>" for x in sl.get("excursions", []) if x]
    urls += [f"  <url><loc>{DOMAIN}/blog/{p['slug']}.html</loc><lastmod>{p['date']}</lastmod></url>" for p in posts]
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n")
    print(f"Blog: {len(posts)} articoli pubblicati.")

if __name__ == "__main__":
    main()
