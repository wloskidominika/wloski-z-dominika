#!/usr/bin/env python3
"""Crea tutte le pagine del sito (eseguito da Netlify a ogni pubblicazione, prima di build_blog.py).

  index.html, case-vacanze.html, hotel-bb.html, escursioni.html, esperienze.html,
  transfer.html, noleggio.html, noleggio-nautico.html, foto-e-video.html, servizi.html
  casa/<nome>.html          una pagina per ogni casa, hotel o B&B
  escursione/<nome>.html    una pagina per ogni escursione o esperienza
  content/slugs.json        indirizzi delle pagine (usati da assets/site.js)
  tools/templates/blog-list.html, post.html   modelli per build_blog.py

I testi si cambiano dal pannello /admin (content/*.json): qui c'è solo la struttura.
Non servono librerie esterne."""
import html, json, os, re, glob, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOMAIN = "https://wloskizdominika.com"
SEC = os.path.join(ROOT, "tools", "templates", "sections")
NAME = "Włoski z Dominiką"
FULL = "Włoski z Dominiką i Podróże do Kalabrii"


def esc(s): return html.escape(str(s or ""), quote=True)
def sec(name): return open(os.path.join(SEC, name + ".html"), encoding="utf-8").read()
def load(name):
    try: return json.load(open(os.path.join(ROOT, "content", name), encoding="utf-8"))
    except Exception: return {}
def L(o, lang="it"):
    if isinstance(o, dict): return o.get(lang) or o.get("it") or next((v for v in o.values() if v), "")
    return o or ""
def media(u): return re.sub(r"^/", "", str(u or ""))

def slugify(s, used):
    s = str(s).split("·")[0]
    s = unicodedata.normalize("NFKD", s.replace("ł", "l").replace("Ł", "L")).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:70].strip("-") or "pagina"
    base, n = s, 2
    while s in used: s, n = f"{base}-{n}", n + 1
    used.add(s)
    return s

# ---------------- menu ----------------
MENU = [  # (indirizzo, testo, pagina)
    ("case-vacanze.html", "nav_house", "houses"),
    ("hotel-bb.html", "nav_hotel", "hotels"),
    ("escursioni.html", "nav_exc", "exc"),
    ("esperienze.html", "nav_exp", "exp"),
    ("transfer.html", "nav_tr", "transfer"),
    ("noleggio.html", "nav_rent", "rental"),
    ("noleggio-nautico.html", "nav_boat", "boat"),
    ("foto-e-video.html", "nav_media", "media"),
    ("blog.html", "nav_blog", "blog"),
    ("#contact", "nav_con", "contact"),
]
PARENT = {"house": "houses", "hotel": "hotels", "excd": "exc", "expd": "exp", "post": "blog"}

def header(page, P):
    cur = PARENT.get(page, page)
    items = "\n".join(f'      <li><a href="{h if h.startswith("#") else P + h}" data-i="{k}"{" class=\"cur\"" if p == cur else ""}></a></li>' for h, k, p in MENU)
    return f'''
<header>
  <div class="wrap nav">
    <a class="brand" href="{P}index.html"><img src="{P}sun.jpg" alt="{NAME}"><span>{NAME}</span></a>
    <div class="nav-right">
      <a href="{P}index.html#lessons" class="les-btn" data-i="nav_les"></a>
      <a href="{P}area.html" class="area-btn">👤 <span data-i="nav_area"></span></a>
      <div class="lang" id="langBtns"></div>
      <button class="burger" aria-label="Menu" onclick="document.getElementById('menu').classList.toggle('open')"><i></i><i></i><i></i></button>
    </div>
  </div>
  <nav class="mainnav">
    <ul class="menu" id="menu">
      <li class="m-only"><a href="{P}index.html#lessons" data-i="nav_les"></a></li>
{items}
    </ul>
  </nav>
</header>
'''

def footer(P):
    links = "".join(f'<a href="{P + h}" data-i="{k}"></a>' for h, k, p in MENU if p != "contact")
    links = f'<a href="{P}index.html#lessons" data-i="nav_les"></a>' + links + f'<a href="{P}area.html" data-i="nav_area"></a>'
    return f'''<footer>
  <div class="wrap">
    <div class="f-grid">
      <div><div class="script">{FULL}</div><div data-i="foot_tag" style="opacity:.85"></div></div>
      <div class="socials" id="socials"></div>
    </div>
    <div class="f-links">{links}</div>
    <div class="copy"><span>© <span id="yr"></span> {FULL} · <span id="vat">P.IVA 03800250791</span> · <a href="{P}privacy.html" data-i="privacy" style="color:#fff"></a></span><span>Calabria <span class="tricolor"><i style="background:#1C8A4E"></i><i style="background:#fff"></i><i style="background:#CE3A2B"></i></span></span></div>
  </div>
</footer>'''

def head(title, desc, canon, page, P, img="media/hero.jpg", extra="", body_attrs="", lang="it", og_type="website"):
    return f'''<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canon}">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="{FULL}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{img if img.startswith("http") or img.startswith("{{") else DOMAIN + "/" + img}">
<meta property="og:url" content="{canon}">
<link rel="icon" href="{P}sun.jpg">
<link rel="stylesheet" href="{P}fonts/fonts.css">
<link rel="stylesheet" href="{P}assets/site.css">
{extra}</head>
<body data-page="{page}"{body_attrs}>
'''

def tail(P):
    root = f'<script>window.SITE_ROOT="{P}";</script>\n' if P else ""
    return f'''
<div class="lb" id="lb"><button class="lb-close" aria-label="Chiudi">×</button><div class="lb-inner" id="lbInner"></div></div>
{root}<script src="{P}assets/site.js"></script>
</body>
</html>
'''

def prefix(h, P):
    """i link relativi delle sezioni diventano ../ nelle sottocartelle"""
    if not P: return h
    return re.sub(r'(href|src|data-src)="(?!https?:|#|mailto:|tel:|data:|/|\{\{|\.\./)', lambda m: f'{m.group(1)}="{P}', h)

def crumbs(P, *parts):
    out = [f'<a href="{P}index.html" data-i="crumb_home"></a>']
    for href, key, text in parts:
        inner = f' data-i="{key}">' if key else f'>{esc(text)}'
        out.append(f'<a href="{P}{href}"{inner}</a>' if href else f'<span{inner}</span>')
    return '<div class="wrap crumbs">' + " › ".join(out) + "</div>\n"

def page(fname, pg, title, desc, body, P="", img="media/hero.jpg", extra="", body_attrs=""):
    canon = DOMAIN + "/" + ("" if fname == "index.html" else fname)
    out = head(esc(title), esc(desc), canon, pg, P, img, extra, body_attrs)
    out += header(pg, P) + "\n<main" + (' class="page-top"' if pg != "home" else "") + ">\n" + prefix(body, P) + "\n" + prefix(sec("contact"), P) + "\n</main>\n\n" + footer(P) + tail(P)
    path = os.path.join(ROOT, fname)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w", encoding="utf-8").write(out)

def see_all(s, href, key):
    return s.replace("\n  </div>\n</section>", f'\n    <div class="see-all"><a class="btn btn-line" href="{href}" data-i="{key}"></a></div>\n  </div>\n</section>', 1)
def as_h1(s): return re.sub(r'<h2 data-i="([a-z_]+)"></h2>', r'<h1 data-i="\1"></h1>', s, count=1)
def heads(s, pre, old):
    for k in ("eyebrow", "title", "sub"): s = s.replace(f'data-i="{old}_{k}"', f'data-i="{pre}_{k}"')
    return s

# ---------------- Home ----------------
HERO = '''<section class="hero" id="home">
  <div class="wrap hero-grid">
    <div>
      <div class="eyebrow" data-i="hero_eyebrow"></div>
      <h1><span data-i="hero_t1"></span><span class="script" data-i="hero_t2"></span></h1>
      <p class="lead" data-i="hero_lead"></p>
      <div class="doors">
        <a class="door" href="#lessons"><b>🗣️</b><div><strong data-i="door1_t"></strong><span data-i="door1_d"></span></div></a>
        <a class="door" href="#vacanze"><b>☀️</b><div><strong data-i="door2_t"></strong><span data-i="door2_d"></span></div></a>
      </div>
    </div>
    <div class="hero-art"><div class="media-slot" data-src="media/hero.jpg" data-label="Calabria"></div></div>
  </div>
</section>'''
TILES = [("case-vacanze.html", "nav_house", "vt_house", "houses", "media/villa-mimosa-capo-vaticano-1.jpg"),
         ("hotel-bb.html", "nav_hotel", "vt_hotel", "hotels", "media/ortensia-1.jpg"),
         ("escursioni.html", "nav_exc", "vt_exc", "exc", "media/mini-crociere-isole-eolie-1.jpg"),
         ("esperienze.html", "nav_exp", "vt_exp", "exp", "media/cucina-contadina-cena-al-tramonto-1.jpg"),
         ("transfer.html", "nav_tr", "vt_tr", "transfer", "media/transfert-aeroportuali-1.jpg"),
         ("noleggio.html", "nav_rent", "vt_rent", "rental", "media/chi-siamo-2.jpg"),
         ("noleggio-nautico.html", "nav_boat", "vt_boat", "boat", "media/noleggio-nautico-2.jpg"),
         ("foto-e-video.html", "nav_media", "vt_media", "media", "media/tour-gommone-tropea-capo-vaticano-1.jpg")]
def vacanze():
    tiles = "\n".join(f'''      <a class="tile" href="{h}" data-tile="{key}"><div class="media-slot" data-src="{img}"></div><div class="tile-body"><h3 data-i="{t}"></h3><p data-i="{d}"></p></div></a>''' for h, t, d, key, img in TILES)
    return f'''<section id="vacanze" style="background:var(--paper)">
  <div class="wrap">
    <div class="section-head center">
      <div class="eyebrow" data-i="vac_eyebrow"></div>
      <h2 data-i="vac_title"></h2>
      <p data-i="vac_sub"></p>
    </div>
    <div class="tiles">
{tiles}
    </div>
  </div>
</section>'''
BLOG_HOME = '''<section id="blog" style="background:var(--paper)">
  <div class="wrap">
    <div class="section-head">
      <div class="eyebrow" data-i="blog_eyebrow"></div>
      <h2 data-i="blog_latest"></h2>
      <p data-i="blog_sub"></p>
    </div>
    <div class="grid-3" id="blogList"></div>
    <div class="see-all"><a class="btn btn-line" href="blog.html" data-i="see_blog"></a></div>
  </div>
</section>'''
LD_HOME = json.dumps({"@context": "https://schema.org", "@type": "TravelAgency", "name": FULL,
  "url": DOMAIN + "/", "logo": DOMAIN + "/logo.jpg", "image": DOMAIN + "/media/hero.jpg",
  "description": "Lezioni di italiano e polacco e vacanze in Calabria: case vacanze, hotel e B&B, escursioni, esperienze locali, transfer e noleggi a Tropea e Capo Vaticano.",
  "areaServed": ["Tropea", "Capo Vaticano", "Calabria"], "availableLanguage": ["it", "pl", "en", "de", "es"], "vatID": "IT03800250791",
  "sameAs": ["https://www.facebook.com/profile.php?id=61556969993687"]}, ensure_ascii=False)

# ---------------- pagine di dettaglio ----------------
HOTEL_TYPES = ("hotel", "bnb")

def detail_body(kind, i, item, P, list_href, list_key, back_key):
    title = L(item.get("title"))
    img = media(item.get("img"))
    desc = L(item.get("desc"))
    paras = "".join(f"<p>{esc(p)}</p>" for p in desc.split("\n") if p.strip())
    fallback = f'''<div class="detail-top"><div>{f'<img class="detail-cover" src="{esc(P + img)}" alt="{esc(title)}">' if img else ""}</div>
      <div class="detail-info"><h1>{esc(title)}</h1>{f"<p>📍 {esc(item.get('place'))}</p>" if item.get("place") else ""}</div></div>
      <div class="detail-text">{paras}</div>'''
    return crumbs(P, (list_href, list_key, ""), ("", "", title)) + f'''<section class="detail">
  <div class="wrap" id="detail" data-kind="{kind}" data-idx="{i}">
    {fallback}
  </div>
  <div class="wrap" style="margin-top:26px"><a class="link" href="{P}{list_href}" data-i="{back_key}"></a></div>
</section>
<section id="more" style="background:var(--paper)">
  <div class="wrap">
    <h2 data-i="also_like" style="font-size:1.8rem;margin-bottom:24px"></h2>
    <div class="grid-3" id="moreList"></div>
  </div>
</section>'''

def short(s, n=155):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s if len(s) <= n else s[:n - 1].rsplit(" ", 1)[0] + "…"

def main():
    houses = load("houses.json").get("items", [])
    excs = load("excursions.json").get("items", [])
    used = set()
    slugs = {"houses": [slugify(L(h.get("title")), used) for h in houses],
             "excursions": [slugify(L(x.get("title")), used) for x in excs]}
    json.dump(slugs, open(os.path.join(ROOT, "content", "slugs.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    S = {n: sec(n) for n in ("about", "excursions", "lessons", "houses", "services", "gallery")}
    page("index.html", "home", f"{FULL} – lezioni di italiano e polacco e vacanze in Calabria",
         "Lezioni di italiano e polacco e vacanze in Calabria: case vacanze, hotel e B&B, escursioni, esperienze locali, transfer e noleggi a Tropea e Capo Vaticano.",
         "\n".join([HERO, S["lessons"], vacanze(), S["about"], BLOG_HOME]),
         extra=f'<script type="application/ld+json">{LD_HOME}</script>\n')

    page("case-vacanze.html", "houses", f"Case vacanze a Tropea e Capo Vaticano · {NAME}",
         "Appartamenti, case e ville a Tropea, Capo Vaticano e Ricadi, con foto, dotazioni e codici CIN.",
         crumbs("", ("", "nav_house", "")) + as_h1(S["houses"]))
    page("hotel-bb.html", "hotels", f"Hotel e B&B a Tropea · {NAME}",
         "Hotel e bed & breakfast selezionati a Tropea e dintorni, per la tua vacanza in Calabria.",
         crumbs("", ("", "nav_hotel", "")) + as_h1(heads(S["houses"], "hotel", "h")).replace('id="houses"', 'id="houses" data-hotels="1"'))
    page("escursioni.html", "exc", f"Escursioni da Tropea via mare e via terra · {NAME}",
         "Isole Eolie, tour in barca e gommone, pesca turistica, Costa Viola, Reggio Calabria e parapendio da Tropea.",
         crumbs("", ("", "nav_exc", "")) + as_h1(S["excursions"]))
    page("esperienze.html", "exp", f"Guida turistica ed esperienze locali a Tropea · {NAME}",
         "Visite guidate in italiano, polacco e inglese ed esperienze autentiche in Calabria: cucina contadina, vino, asinelli, musica popolare.",
         crumbs("", ("", "nav_exp", "")) + as_h1(heads(S["excursions"], "exp", "exc")))
    page("transfer.html", "transfer", f"Transfer aeroporto Lamezia Terme – Tropea · {NAME}",
         "Transfer privato dall'aeroporto di Lamezia Terme a Tropea e alla Costa degli Dei, anche di notte.",
         crumbs("", ("", "nav_tr", "")) + as_h1(heads(S["services"], "tr", "s")))
    page("noleggio.html", "rental", f"Noleggio auto, scooter e bici a Tropea · {NAME}",
         "Noleggio di auto, scooter e bici a Tropea e Capo Vaticano, con consegna in aeroporto o in hotel.",
         crumbs("", ("", "nav_rent", "")) + as_h1(heads(S["services"], "rent", "s")))
    page("noleggio-nautico.html", "boat", f"Noleggio barche e gommoni a Tropea · {NAME}",
         "Noleggio di barche e gommoni a Tropea anche senza patente, per scoprire le calette fino a Capo Vaticano.",
         crumbs("", ("", "nav_boat", "")) + as_h1(heads(S["services"], "boat", "s")))
    page("foto-e-video.html", "media", f"Foto e video · {NAME}",
         "Foto e video di escursioni, case vacanze ed esperienze tra Tropea e Capo Vaticano, in Calabria.",
         crumbs("", ("", "nav_media", "")) + as_h1(S["gallery"]))
    page("servizi.html", "services", f"Servizi per la tua vacanza in Calabria · {NAME}",
         "Transfer, noleggi e servizi per vivere la Costa degli Dei senza pensieri.",
         crumbs("", ("", "nav_serv", "")) + as_h1(S["services"]))

    # dettagli: una pagina per ogni casa / escursione
    for d in ("casa", "escursione"):
        for old in glob.glob(os.path.join(ROOT, d, "*.html")): os.remove(old)
    for i, h in enumerate(houses):
        hotel = h.get("type") in HOTEL_TYPES
        lst, key, back, pg = ("hotel-bb.html", "nav_hotel", "back_hotels", "hotel") if hotel else ("case-vacanze.html", "nav_house", "back_houses", "house")
        t = L(h.get("title")); place = h.get("place") or ""
        page(f"casa/{slugs['houses'][i]}.html", pg, f"{t}{' · ' + place if place and place not in t else ''} · {NAME}",
             short(L(h.get("desc")) or L(h.get("info")) or t), detail_body("house", i, h, "../", lst, key, back),
             P="../", img=media(h.get("img")) or "media/hero.jpg", body_attrs=f' data-idx="{i}"')
    for i, x in enumerate(excs):
        exp = x.get("kind") == "exp"
        lst, key, back, pg = ("esperienze.html", "nav_exp", "back_exp", "expd") if exp else ("escursioni.html", "nav_exc", "back_exc", "excd")
        t = L(x.get("title"))
        page(f"escursione/{slugs['excursions'][i]}.html", pg, f"{t} · {NAME}", short(L(x.get("desc")) or t),
             detail_body("exc", i, x, "../", lst, key, back), P="../", img=media(x.get("img")) or "media/hero.jpg", body_attrs=f' data-idx="{i}"')

    # ---------------- modelli del blog (riempiti da tools/build_blog.py) ----------------
    T = os.path.join(ROOT, "tools", "templates")
    blog_list = crumbs("", ("", "nav_blog", "")) + '''<section id="bloglist">
  <div class="wrap">
    <div class="section-head">
      <div class="eyebrow" data-i="blog_eyebrow"></div>
      <h1 data-i="blog_title"></h1>
      <p data-i="blog_sub"></p>
    </div>
    <div id="blogFilters"><!--BLOG_FILTERS--></div>
    <div class="grid-3"><!--BLOG_POSTS--></div>
  </div>
</section>'''
    html_list = head(f"Blog: guide e consigli sulla Calabria · {NAME}", "Guide pratiche su Tropea, Capo Vaticano, le Isole Eolie e la Calabria: cosa vedere, spiagge, come arrivare e sapori tipici.",
                     DOMAIN + "/blog.html", "blog", "") + header("blog", "") + '\n<main class="page-top">\n' + blog_list + "\n" + sec("contact") + "\n</main>\n\n" + footer("") + tail("")
    open(os.path.join(T, "blog-list.html"), "w", encoding="utf-8").write(html_list)

    P = "../"
    post_body = crumbs(P, ("blog.html", "nav_blog", "")) + '''<article class="post">
  <div class="meta"><span class="chip">{{FLAG}} {{CATEGORY}}</span><span class="chip"><time datetime="{{DATE_ISO}}">{{DATE}}</time></span><span class="chip">⏱ {{READ}} min</span></div>
  <div id="postOther" class="post-other" style="display:none"></div>
  <h1>{{H1}}</h1>
  {{COVER}}
  <div class="post-body">
{{BODY}}
  </div>
  <div class="post-cta">
    <h2 data-i="post_cta_title"></h2>
    <p data-i="post_cta_text"></p>
    <div class="btns"><a class="btn btn-red" href="escursioni.html" data-i="nav_exc"></a><a class="btn btn-line" href="case-vacanze.html" data-i="nav_house"></a><a class="btn btn-line" href="transfer.html" data-i="nav_tr"></a></div>
  </div>
</article>
<section id="related" style="{{RELATED_STYLE}};padding-top:40px">
  <div class="wrap">
    <h2 data-i="post_related" style="font-size:1.8rem;margin-bottom:24px"></h2>
    <div class="grid-3">{{RELATED}}</div>
  </div>
</section>'''
    html_post = head("{{TITLE}} · " + NAME, "{{DESC}}", "{{URL}}", "post", P, img="{{OG_IMAGE}}", og_type="article", lang="{{LANG}}",
                     extra='{{HREFLANG}}\n<script type="application/ld+json">{{JSONLD}}</script>\n', body_attrs=' data-post-lang="{{LANG}}"')
    html_post = html_post.replace('<body data-page="post" data-post-lang="{{LANG}}">', '<body data-page="post" data-post-lang="{{LANG}}">\n<script>window.POST_ALTS={{ALTS}};</script>')
    html_post += header("post", P) + '\n<main class="page-top">\n' + prefix(post_body, P) + "\n" + prefix(sec("contact"), P) + "\n</main>\n\n" + footer(P) + tail(P)
    open(os.path.join(T, "post.html"), "w", encoding="utf-8").write(html_post)
    print(f"Sito: pagine create, {len(houses)} alloggi e {len(excs)} escursioni con la loro pagina.")

if __name__ == "__main__":
    main()
