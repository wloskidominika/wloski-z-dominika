/* =====================================================================
   Correttore SEO per gli articoli del blog – Włoski z Dominiką
   Mostra accanto all'editor: anteprima Google, punteggio e consigli.
   ===================================================================== */
(function (root) {
  var SITE_URL = "wloskizdominika.com";
  var PAGES = ["escursioni.html", "case-vacanze.html", "transfer.html", "noleggio.html", "servizi.html", "blog"];

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
  }
  function plain(md) {
    return String(md || "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[#>*_`~-]+/g, " ");
  }
  function words(t) { return (plain(t).match(/[\p{L}\p{N}'’]+/gu) || []); }
  function slugify(s) {
    return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function count(hay, needle) {
    if (!needle) return 0;
    var h = " " + norm(plain(hay)).replace(/[^a-z0-9]+/g, " ") + " ";
    var n = " " + norm(needle).replace(/[^a-z0-9]+/g, " ").trim() + " ";
    var c = 0, i = 0;
    while ((i = h.indexOf(n, i)) !== -1) { c++; i += n.length - 1; }
    return c;
  }
  function has(hay, needle) { return count(hay, needle) > 0; }

  function analyze(d, slug) {
    d = d || {};
    var kw = String(d.keyword || "").trim();
    var title = String(d.seo_title || d.title || "").trim();
    var desc = String(d.description || "").trim();
    var body = String(d.body || "");
    var url = slug || slugify(d.title || "");
    var W = words(body), n = W.length;
    var paras = body.split(/\n\s*\n/).map(function (p) { return p.trim(); })
      .filter(function (p) { return p && !/^#{1,6}\s/.test(p) && !/^!\[/.test(p); });
    var heads = (body.match(/^#{2,3}\s+.+$/gm) || []);
    var links = [], m, re = /(!?)\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;
    var imgs = [];
    while ((m = re.exec(body))) { (m[1] ? imgs : links).push({ text: m[2], href: m[3] }); }
    var internal = links.filter(function (l) { return !/^https?:/i.test(l.href) || l.href.indexOf(SITE_URL) > -1; });
    var external = links.filter(function (l) { return /^https?:/i.test(l.href) && l.href.indexOf(SITE_URL) === -1; });
    var sentences = plain(body).split(/[.!?]+\s/).map(function (s) { return s.trim(); }).filter(Boolean);
    var longS = sentences.filter(function (s) { return (s.match(/\S+/g) || []).length > 25; }).length;
    var C = [];
    function add(st, txt, tip) { C.push({ s: st, t: txt, tip: tip || "" }); }

    // 1. frase chiave
    if (!kw) add("bad", "Manca la frase chiave.", "Scrivi le 2–4 parole che i clienti cercano su Google, per esempio «cosa vedere a Tropea» o «Tropea co zobaczyć».");
    else add("good", "Frase chiave: «" + kw + "».");

    // 2. titolo SEO
    var tl = title.length;
    if (!title) add("bad", "Manca il titolo.");
    else if (tl >= 30 && tl <= 60) add("good", "Lunghezza del titolo perfetta (" + tl + " caratteri).");
    else if (tl > 60 && tl <= 70) add("ok", "Titolo un po' lungo (" + tl + " caratteri): Google potrebbe tagliarlo.", "Stai sotto i 60 caratteri.");
    else add("bad", "Titolo " + (tl < 30 ? "troppo corto" : "troppo lungo") + " (" + tl + " caratteri).", "L'ideale è tra 30 e 60 caratteri.");
    if (kw && title) {
      if (norm(title).indexOf(norm(kw)) === 0) add("good", "La frase chiave è all'inizio del titolo.");
      else if (has(title, kw)) add("good", "La frase chiave è nel titolo.", "Se riesci, mettila all'inizio.");
      else add("bad", "La frase chiave non è nel titolo.", "Inseriscila nel titolo, possibilmente all'inizio.");
    }

    // 3. meta description
    var dl = desc.length;
    if (!desc) add("bad", "Manca la descrizione per Google.", "Scrivi 1–2 frasi (120–155 caratteri) che invitino a cliccare.");
    else if (dl >= 120 && dl <= 158) add("good", "Lunghezza della descrizione perfetta (" + dl + " caratteri).");
    else if ((dl >= 70 && dl < 120) || (dl > 158 && dl <= 175)) add("ok", "Descrizione " + (dl < 120 ? "un po' corta" : "un po' lunga") + " (" + dl + " caratteri).", "L'ideale è tra 120 e 155 caratteri.");
    else add("bad", "Descrizione " + (dl < 70 ? "troppo corta" : "troppo lunga") + " (" + dl + " caratteri).", "L'ideale è tra 120 e 155 caratteri.");
    if (kw && desc) {
      if (has(desc, kw)) add("good", "La frase chiave è nella descrizione.");
      else add("ok", "La frase chiave non è nella descrizione.", "Aggiungila in modo naturale.");
    }

    // 4. indirizzo
    if (url) {
      var kwSlug = slugify(kw);
      if (url.length > 75) add("ok", "L'indirizzo della pagina è lungo.", "Indirizzi brevi funzionano meglio.");
      else if (kw && url.indexOf(kwSlug) === -1) add("ok", "L'indirizzo non contiene la frase chiave.", "L'indirizzo nasce dal titolo: se il titolo contiene la frase chiave, lo conterrà anche l'indirizzo.");
      else add("good", "Indirizzo della pagina chiaro.");
    }

    // 5. lunghezza testo
    if (n >= 600) add("good", "Testo ricco: " + n + " parole.");
    else if (n >= 300) add("ok", "Testo di " + n + " parole.", "Gli articoli di 600+ parole di solito si posizionano meglio.");
    else add("bad", "Testo troppo corto: " + n + " parole.", "Scrivi almeno 300 parole, meglio 600.");

    // 6. frase chiave nel primo paragrafo
    if (kw && paras.length) {
      if (has(paras[0], kw)) add("good", "La frase chiave è nel primo paragrafo.");
      else add("bad", "La frase chiave non è nel primo paragrafo.", "Citala nelle prime righe: Google le considera importanti.");
    }

    // 7. densità
    if (kw && n) {
      var k = count(body, kw);
      var dens = (k / n) * 100;
      var ds = dens.toFixed(1).replace(".", ",");
      if (k === 0) add("bad", "La frase chiave non compare nel testo.", "Usala 2–5 volte in un articolo di media lunghezza.");
      else if (dens > 3) add("bad", "Frase chiave ripetuta troppe volte (" + k + " volte, " + ds + "%).", "Google penalizza le ripetizioni forzate: usa anche sinonimi.");
      else if (dens < 0.4) add("ok", "Frase chiave usata poco (" + k + " volte, " + ds + "%).", "Puoi usarla ancora 1–2 volte.");
      else add("good", "Frase chiave usata " + k + " volte (" + ds + "%): giusto.");
    }

    // 8. sottotitoli
    if (/^\\#/m.test(body)) add("ok", "Alcuni «##» sono stati scritti come testo.", "Nell'editor visuale usa il pulsante «H» per i sottotitoli, oppure passa alla modalità Markdown.");
    if (heads.length >= 2) {
      add("good", heads.length + " sottotitoli: il testo è ben organizzato.");
      if (kw && !heads.some(function (h) { return has(h, kw) || norm(kw).split(/\s+/).filter(function (w) { return w.length > 3; }).some(function (w) { return norm(h).indexOf(w) > -1; }); }))
        add("ok", "Nessun sottotitolo richiama la frase chiave.", "Usala (o una sua parte) in almeno un sottotitolo.");
    } else add("bad", "Mancano i sottotitoli.", "Dividi il testo con 2–5 sottotitoli: seleziona la riga e premi il pulsante «H» → Titolo 2.");

    // 9. immagini
    if (!d.cover) add("bad", "Manca la foto di copertina.", "Gli articoli con una bella foto vengono cliccati di più.");
    else if (!String(d.cover_alt || "").trim()) add("ok", "Manca la descrizione della foto di copertina (testo alternativo).", "Descrivi la foto in poche parole, magari con la frase chiave.");
    else add("good", "Foto di copertina con descrizione.");
    var noAlt = imgs.filter(function (i) { return !i.text.trim(); }).length;
    if (noAlt) add("ok", noAlt + " foto nel testo senza descrizione.", "Clicca la foto e compila il campo «Alt».");

    // 10. link
    if (internal.length >= 2) add("good", internal.length + " link verso le pagine del tuo sito.");
    else if (internal.length === 1) add("ok", "Un solo link verso il tuo sito.", "Aggiungi un altro link, per esempio verso " + PAGES.slice(0, 3).join(", ") + ".");
    else add("bad", "Nessun link verso le pagine del tuo sito.", "Collega l'articolo a escursioni, case vacanze o transfer: aiuta Google e porta clienti.");
    if (external.length) add("good", "C'è almeno un link a un sito esterno utile.");
    else add("ok", "Nessun link esterno.", "Facoltativo: un link a una fonte utile (es. sito ufficiale di un museo) dà credibilità.");

    // 11. leggibilità
    var longP = paras.filter(function (p) { return (p.match(/\S+/g) || []).length > 150; }).length;
    if (longP) add("ok", longP + " paragrafi molto lunghi.", "Spezza i paragrafi oltre le 150 parole: sul telefono si leggono meglio.");
    if (sentences.length && longS / sentences.length > 0.25) add("ok", "Molte frasi lunghe (" + Math.round(100 * longS / sentences.length) + "%).", "Usa frasi più brevi, sotto le 25 parole.");
    else if (sentences.length) add("good", "Frasi di lunghezza scorrevole.");

    // 12. lingua
    if (!d.lang) add("bad", "Scegli la lingua dell'articolo.");

    var pts = C.reduce(function (a, c) { return a + (c.s === "good" ? 2 : c.s === "ok" ? 1 : 0); }, 0);
    var score = Math.round(100 * pts / (2 * C.length));
    return { score: score, checks: C, title: title, desc: desc, url: url, words: n };
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function render(d, slug) {
    var r = analyze(d, slug);
    var col = r.score >= 80 ? "#1E8449" : r.score >= 55 ? "#D68910" : "#C0392B";
    var lab = r.score >= 80 ? "Ottimo! Pronto per Google" : r.score >= 55 ? "Buono, ma si può migliorare" : "Da migliorare";
    var icon = { good: "✅", ok: "⚠️", bad: "❌" };
    var order = { bad: 0, ok: 1, good: 2 };
    var list = r.checks.slice().sort(function (a, b) { return order[a.s] - order[b.s]; }).map(function (c) {
      return '<li style="margin:0 0 10px;list-style:none;display:flex;gap:8px"><span>' + icon[c.s] + '</span><span><b style="font-weight:600">' + esc(c.t) + "</b>" +
        (c.tip && c.s !== "good" ? '<br><span style="color:#6B7B8C">' + esc(c.tip) + "</span>" : "") + "</span></li>";
    }).join("");
    var t = r.title || "Titolo dell'articolo", ds = r.desc || "Qui comparirà la descrizione che scrivi nel campo «Descrizione per Google».";
    if (t.length > 62) t = t.slice(0, 60) + "…";
    if (ds.length > 160) ds = ds.slice(0, 157) + "…";
    return '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1E2B27;padding:22px;max-width:720px;line-height:1.45">' +
      '<h2 style="margin:0 0 4px;font-size:20px">🔍 Correttore SEO</h2><p style="margin:0 0 18px;color:#6B7B8C;font-size:14px">Si aggiorna mentre scrivi. Sistema prima le ❌, poi le ⚠️.</p>' +
      '<div style="display:flex;align-items:center;gap:16px;margin-bottom:22px"><div style="width:76px;height:76px;border-radius:50%;display:grid;place-items:center;font-size:24px;font-weight:700;color:#fff;background:' + col + '">' + r.score + '</div>' +
      '<div><div style="font-size:18px;font-weight:700;color:' + col + '">' + lab + '</div><div style="color:#6B7B8C;font-size:14px">' + r.words + ' parole</div></div></div>' +
      '<div style="border:1px solid #E3E8EC;border-radius:12px;padding:14px 16px;margin-bottom:22px;background:#fff">' +
      '<div style="font-size:12px;color:#6B7B8C;margin-bottom:6px">Anteprima su Google</div>' +
      '<div style="font-size:13px;color:#202124">' + SITE_URL + ' › blog › ' + esc(r.url || "articolo") + '</div>' +
      '<div style="font-size:19px;color:#1a0dab;margin:2px 0">' + esc(t) + '</div>' +
      '<div style="font-size:14px;color:#4d5156">' + esc(ds) + "</div></div>" +
      '<ul style="padding:0;margin:0;font-size:14.5px">' + list + "</ul>" +
      '<details style="margin-top:20px;font-size:14px;background:#F6F8F7;border-radius:10px;padding:12px 14px"><summary style="cursor:pointer;font-weight:600">💡 Come scegliere la frase chiave</summary>' +
      '<p>Pensa a cosa scrive su Google un turista <b>nella sua lingua</b>. Un articolo = una frase chiave = una lingua.</p>' +
      '<ul><li>🇮🇹 cosa vedere a Tropea · spiagge Capo Vaticano · escursione Eolie da Tropea</li><li>🇵🇱 Tropea co zobaczyć · Kalabria wakacje · wycieczka na Wyspy Liparyjskie</li>' +
      '<li>🇩🇪 Tropea Sehenswürdigkeiten · Kalabrien Urlaub · Ausflug Liparische Inseln</li><li>🇬🇧 things to do in Tropea · best beaches Calabria · Aeolian Islands day trip</li>' +
      '<li>🇪🇸 qué ver en Tropea · playas de Calabria · excursión islas Eolias</li></ul></details></div>';
  }

  root.WZD_SEO = { analyze: analyze, render: render, slugify: slugify };
  if (typeof module !== "undefined") module.exports = root.WZD_SEO;

  // collegamento al pannello Decap CMS
  if (typeof window !== "undefined") {
    var tries = 0;
    (function hook() {
      if (window.CMS && window.createClass && window.h) {
        var SeoPreview = window.createClass({
          render: function () {
            var e = this.props.entry, data = e.get("data").toJS();
            return window.h("div", { dangerouslySetInnerHTML: { __html: render(data, e.get("slug")) } });
          }
        });
        window.CMS.registerPreviewTemplate("blog", SeoPreview);
      } else if (tries++ < 100) setTimeout(hook, 100);
    })();
  }
})(typeof window !== "undefined" ? window : globalThis);
