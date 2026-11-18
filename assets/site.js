/* =====================================================================
   ✏️  TUTAJ EDYTUJESZ TREŚCI  /  QUI MODIFICHI I CONTENUTI
   ---------------------------------------------------------------------
   • Zdjęcia: wrzuć pliki do folderu "media/" i wpisz nazwę w "img".
   • Filmy: wklej link z YouTube w "youtube" albo plik .mp4 w "video".
   • Każdy tekst ma wersję "pl" (polski) i "it" (włoski).
   ===================================================================== */
/* =====================================================================
   I contenuti sono nella cartella /content e si modificano dal pannello /admin
   ===================================================================== */
const LANGS = ["it","de","en","pl","es"];
const ROOT = window.SITE_ROOT || "";
let SITE = {}, T = {}, GUIDE_LANGS = "", SLUGS = {};
function fixPaths(o){
  if (typeof o === "string") return /^\/(?!\/)[\w.-]+(\/|$)/.test(o) ? ROOT + o.slice(1) : o;
  if (Array.isArray(o)) return o.map(fixPaths);
  if (o && typeof o === "object") { const r = {}; for (const k in o) r[k] = fixPaths(o[k]); return r; }
  return o;
}
/* I contenuti si modificano dall'app (wloskizdominika.com/app) e sono salvati su Supabase:
   il sito li legge subito da lì. Se Supabase non risponde usa i file in /content. */
let REMOTE = null;
function remoteContent(){
  if (REMOTE) return REMOTE;
  const c = window.WZD_CONFIG || {};
  if (!c.SUPABASE_URL || /INSERISCI/.test(c.SUPABASE_URL)) return (REMOTE = Promise.resolve({}));
  REMOTE = fetch(c.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/site_content?select=key,data", { headers: { apikey: c.SUPABASE_ANON_KEY } })
    .then(r => r.ok ? r.json() : []).then(rows => { const o = {}; (rows || []).forEach(x => { if (x && x.data && Object.keys(x.data).length) o[x.key] = x.data; }); return o; })
    .catch(() => ({}));
  return REMOTE;
}
async function loadContent(){
  const rc = await remoteContent();
  const get = n => rc[n.replace(".json", "")] ? Promise.resolve(rc[n.replace(".json", "")]) : fetch(ROOT + "content/" + n + "?v=" + Date.now()).then(r => r.json());
  const [st, ex, le, ho, ga, tx, sv, sl, hb] = await Promise.all(["settings.json","excursions.json","lessons.json","houses.json","gallery.json","texts.json","services.json","slugs.json","hotels.json"].map(n => get(n).catch(() => ({}))));
  SLUGS = sl || {};
  SITE = { contact: st.contact, socials: st.socials || [], excursions: ex.items || [], lessonsIT: le.italian, lessonsPL: le.polish, houses: (ho.items || []).concat((hb.items || []).map(h => Object.assign({ type: "hotel" }, h))), gallery: ga.items || [], services: sv.items || [], hotelsPage: !!hb.page_visible };
  GUIDE_LANGS = st.guide_langs || ""; T = tx;
  SITE = fixPaths(SITE);
  if (st.vat) document.getElementById("vat").textContent = "P.IVA " + st.vat;
}

/* Aspetto: colori, foto principali, sezioni e menu (pannello → 🎨 Aspetto del sito) */
let LOOK = {};
async function loadLook(){
  try { const rc = await remoteContent(); LOOK = fixPaths(rc.look || await fetch(ROOT + "content/look.json?v=" + Date.now()).then(r => r.json())); } catch(e) { LOOK = {}; return; }
  const c = LOOK.colors || {}, root = document.documentElement.style;
  const map = { primary:"--red", secondary:"--green", background:"--cream", accent:"--orange", text:"--ink" };
  for (const k in map) if (c[k]) root.setProperty(map[k], c[k]);
  if (c.primary) root.setProperty("--red-dark", c.primary);
  if (c.secondary) root.setProperty("--green-dark", c.secondary);
  const setSlot = (sel, src) => { const el = document.querySelector(sel); if (el && src) { el.dataset.src = src; el.querySelectorAll("img").forEach(i => i.remove()); } };
  setSlot(".hero-art .media-slot", LOOK.hero_img);
  setSlot(".about-photo .media-slot", LOOK.about_img);
  if (LOOK.icon) document.querySelectorAll(".brand img").forEach(i => i.src = LOOK.icon);
  if (LOOK.badge) document.querySelectorAll(".about-photo > img").forEach(i => i.src = LOOK.badge);
  const tl = LOOK.tiles || {};
  for (const k in tl) if (tl[k]) setSlot('[data-tile="' + k + '"] .media-slot', tl[k]);
  const hs = LOOK.home_sections || {};
  if (PAGE === "home") for (const id in hs) if (hs[id] === false) { const el = document.getElementById(id); if (el) el.style.display = "none"; }
  const mn = LOOK.menu || {};
  let hb = (await remoteContent()).hotels;
  if (!hb) { try { hb = await fetch(ROOT + "content/hotels.json?v=" + Date.now()).then(r => r.json()); } catch(e) { hb = {}; } }
  const off = k => mn[k] === false || (k === "nav_hotel" && !hb.page_visible);
  document.querySelectorAll(".menu a[data-i], .f-links a[data-i], .nav-right a[data-i]").forEach(a => { (a.closest("li") || a).style.display = off(a.dataset.i) ? "none" : ""; });
  const TILE_NAV = { houses:"nav_house", hotels:"nav_hotel", exc:"nav_exc", exp:"nav_exp", transfer:"nav_tr", rental:"nav_rent", boat:"nav_boat", media:"nav_media" };
  for (const k in TILE_NAV) document.querySelectorAll('[data-tile="' + k + '"]').forEach(el => el.style.display = off(TILE_NAV[k]) ? "none" : "");
  const hc = LOOK.home_counts || {};
  if (hc.exc) HOME_MAX.exc = +hc.exc; if (hc.house) HOME_MAX.house = +hc.house; if (hc.serv) HOME_MAX.serv = +hc.serv;
}

/* ===================== Logika strony / Logica ===================== */
const PAGE = document.body.dataset.page || "home";
const HOME_MAX = { exc: 6, house: 6, serv: 3, gal: 8 };
const HOTEL_TYPES = ["hotel","bnb"];
/* quali elementi mostra ogni pagina */
const isHotel = h => HOTEL_TYPES.includes(h.type);
const isVis = x => x && x.visible !== false;
function housesForPage(){ const all=(SITE.houses||[]).filter(isVis); return (PAGE==="hotels"||PAGE==="hotel") ? all.filter(isHotel) : all.filter(h=>!isHotel(h)); }
function excForPage(){ const all=(SITE.excursions||[]).filter(isVis); return (PAGE==="exp"||PAGE==="expd") ? all.filter(x=>x.kind==="exp") : all.filter(x=>x.kind!=="exp"); }
/* indirizzo della pagina di una casa / escursione: pagina fissa se esiste, altrimenti la pagina «vedi» */
const itemUrl = (dir, list, x) => !x || !x.id ? "" : (list || []).includes(x.id) ? ROOT + dir + "/" + x.id + ".html" : ROOT + dir + "/vedi.html?id=" + encodeURIComponent(x.id);
const houseUrl = i => itemUrl("casa", SLUGS.houses, (SITE.houses || [])[i]);
const excUrl = i => itemUrl("escursione", SLUGS.excursions, (SITE.excursions || [])[i]);
let lang = "it";
try { const b=(navigator.language||"it").slice(0,2); lang = localStorage.getItem("wzd-lang") || (LANGS.includes(b)?b:"it"); } catch(e){}
if (!LANGS.includes(lang)) lang = "it";
const t = k => (T[lang]||{})[k] || (T.it||{})[k] || "";
const L = o => (o && typeof o === "object" && !Array.isArray(o)) ? (o[lang] || o.it || o.en || "") : o;
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function slot(src, label, extra="", cls=""){
  return `<div class="media-slot ${cls}" ${extra} data-label="${esc(label||t("photo_ph"))}">${src?`<img src="${esc(src)}" alt="${esc(label||"")}" loading="lazy" onload="this.classList.add('ok')" onerror="this.remove()">`:""}</div>`;
}
function gallery(list, label){
  const ph=[...new Set((list||[]).filter(Boolean))];
  if(ph.length<2) return slot(ph[0], label, "", "mg-main");
  return `<div class="mg">${slot(ph[0], label, "", "mg-main")}<div class="mg-thumbs">${ph.map((p,i)=>`<button data-mg="${esc(p)}" class="${i?"":"on"}"><img src="${esc(p)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>`).join("")}</div></div>`;
}
function hydrateStaticSlots(){
  document.querySelectorAll(".media-slot[data-src]").forEach(el=>{
    if(el.querySelector("img")) return;
    const img=new Image(); img.src=el.dataset.src; img.alt=el.dataset.label||""; img.onload=()=>img.classList.add("ok"); img.onerror=()=>img.remove(); el.appendChild(img);
  });
}

let eFilter="all";
const durTxt = x => L(x.dur_text) || (x.dur ? t("dur_"+x.dur) : "");
function renderExcursions(){
  if(!document.getElementById("excList")) return;
  const list=excForPage();
  const areas=[...new Set(list.map(x=>x.area).filter(Boolean))];
  document.getElementById("excFilters").innerHTML = areas.length>1
    ? [`<button class="${eFilter==="all"?"on":""}" data-ef="all">${t("ex_all")}</button>`].concat(areas.map(a=>`<button class="${eFilter===a?"on":""}" data-ef="${esc(a)}">${esc(t("ex_"+a)||a)}</button>`)).join("") : "";
  if(!document.getElementById("excList")) return;
  let shown=0;
  document.getElementById("excList").innerHTML = list.map(x=>{ const i=SITE.excursions.indexOf(x); return ((eFilter!=="all"&&x.area!==eFilter) || (PAGE==="home" && ++shown>HOME_MAX.exc)) ? "" : `
    <article class="card">
      ${excUrl(i)?`<a href="${excUrl(i)}" tabindex="-1">${slot(x.img, L(x.title))}</a>`:slot(x.img, L(x.title))}
      <div class="card-body">
        <div class="meta">${x.area?`<span class="chip">${x.area==="sea"?"⛵":x.area==="land"?"🚐":""} ${esc(t("ex_"+x.area))}</span>`:""}${L(x.tag)?`<span class="chip">${esc(L(x.tag))}</span>`:""}${durTxt(x)?`<span class="chip">⏱ ${esc(durTxt(x))}</span>`:""}${x.guide&&GUIDE_LANGS?`<span class="chip">${GUIDE_LANGS}</span>`:""}</div>
        <h3>${esc(L(x.title))}</h3>
        <p class="clamp">${esc(L(x.desc))}</p>
        <div class="card-foot"><span class="price">${x.price?esc(t("price_from")+" "+x.price):""}</span><div class="btns" style="align-items:center">${x.pay?`<a class="btn btn-red btn-pay" href="${esc(x.pay)}" target="_blank" rel="noopener">💳 ${t("pay_book")}</a>`:""}${excUrl(i)?`<a class="link" href="${excUrl(i)}">${t("details")}</a>`:`<button class="link" data-exc="${i}">${t("details")}</button>`}</div></div>
      </div>
    </article>`; }).join("");
}

function renderLessons(){
  if(!document.getElementById("itList")) return;
  document.getElementById("itList").innerHTML = L(SITE.lessonsIT).map(s=>`<li>${esc(s)}</li>`).join("");
  document.getElementById("plList").innerHTML = L(SITE.lessonsPL).map(s=>`<li>${esc(s)}</li>`).join("");
}

let gFilter="all";
let hFilter="all";
function renderHouses(){
  if(!document.getElementById("houseList")) return;
  const all=housesForPage();
  const sec=document.getElementById("houses");
  if(PAGE==="hotels" && !all.length){
    document.getElementById("houseFilters").innerHTML="";
    document.getElementById("houseList").innerHTML=`<div class="empty-box"><p>${esc(t("hotel_empty"))}</p><a class="btn btn-red" href="#contact" data-pick="house">${t("s_info")}</a></div>`;
    return;
  }
  const types=[...new Set(all.map(h=>h.type).filter(Boolean))];
  document.getElementById("houseFilters").innerHTML = types.length>1
    ? [`<button class="${hFilter==="all"?"on":""}" data-hf="all">${t("h_all")}</button>`].concat(types.map(ty=>`<button class="${hFilter===ty?"on":""}" data-hf="${esc(ty)}">${esc(t("ty_"+ty)||ty)}</button>`)).join("")
    : "";
  document.getElementById("houseList").innerHTML = all.filter(h=>hFilter==="all"||h.type===hFilter).slice(0, PAGE==="home"?HOME_MAX.house:999).map(h=>`
    <article class="card">
      ${houseUrl(SITE.houses.indexOf(h))?`<a href="${houseUrl(SITE.houses.indexOf(h))}" tabindex="-1">${slot(h.img, L(h.title))}</a>`:slot(h.img, L(h.title))}
      <div class="card-body">
        <div class="meta">${h.type?`<span class="chip">${esc(t("ty_"+h.type)||h.type)}</span>`:""}${h.place?`<span class="chip">📍 ${esc(h.place)}</span>`:""}</div>
        <h3>${esc(L(h.title))}</h3>
        ${L(h.info)?`<p>${esc(L(h.info))}</p>`:""}
        ${L(h.desc)?`<p class="clamp">${esc(L(h.desc))}</p>`:""}
        ${h.cin||h.cir?`<div class="codes">${h.cin?"CIN "+esc(h.cin):""}${h.cin&&h.cir?" · ":""}${h.cir?"CIR "+esc(h.cir):""}</div>`:""}
        <div class="card-foot"><span class="price">${h.price?esc(t("price_from")+" "+h.price):""}</span><div class="btns">${houseUrl(SITE.houses.indexOf(h))?`<a class="link" href="${houseUrl(SITE.houses.indexOf(h))}">${t("details")}</a>`:`<button class="link" data-house="${SITE.houses.indexOf(h)}">${t("details")}</button>`}${h.pay?`<a class="btn btn-red btn-pay" href="${esc(h.pay)}" target="_blank" rel="noopener">💳 ${t("pay_book")}</a>`:""}${h.url?`<a class="btn btn-line" style="padding:10px 20px" href="${esc(h.url)}" target="_blank" rel="noopener">${t("h_btn")} ↗</a>`:`<a class="btn btn-line" style="padding:10px 20px" href="#contact" data-pick="house" data-title="${esc(L(h.title))}">${t("s_info")}</a>`}</div></div>
      </div>
    </article>`).join("");
}

function servicesForPage(){
  const all=(SITE.services||[]).filter(isVis);
  if(PAGE==="transfer") return all.filter(x=>x.kind==="transfer");
  if(PAGE==="rental") return all.filter(x=>x.kind==="rental");
  if(PAGE==="boat") return all.filter(x=>x.kind==="boat");
  return all;
}
function renderServices(){
  const sec=document.getElementById("services"); if(!sec) return;
  const list=servicesForPage().slice(0, PAGE==="home"?HOME_MAX.serv:999);
  sec.style.display = list.length ? "" : "none";
  if(PAGE==="transfer"||PAGE==="rental"||PAGE==="boat"){
    const box=document.getElementById("serviceList"); box.classList.add("wides");
    box.innerHTML = list.map(x=>`<article class="wide"><div>${gallery([x.img].concat(x.photos||[]), L(x.title))}</div><div class="w-body">
      ${L(x.cat)?`<div class="meta"><span class="chip">${esc(L(x.cat))}</span></div>`:""}
      <h2>${esc(L(x.title))}</h2>
      <p class="pre" style="color:var(--muted)">${esc(L(x.desc)||"")}</p>
      ${L(x.price_note)?`<p>💶 ${esc(L(x.price_note))}</p>`:""}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:auto"><span class="price">${x.price?esc(t("price_from")+" "+x.price):""}</span>
      <div class="btns">${x.pay?`<a class="btn btn-red" href="${esc(x.pay)}" target="_blank" rel="noopener">💳 ${t("pay_book")}</a>`:""}${x.url?`<a class="btn btn-line" href="${esc(x.url)}" target="_blank" rel="noopener">${t("s_more")} ↗</a>`:""}<a class="btn ${x.pay?"btn-line":"btn-red"}" href="#contact" data-pick="other" data-title="${esc(L(x.title))}">${t("s_info")}</a></div></div></div></article>`).join("");
    return;
  }
  document.getElementById("serviceList").innerHTML = list.map((x)=>{ const si=SITE.services.indexOf(x); return `
    <article class="card">
      ${slot(x.img, L(x.title))}
      <div class="card-body">
        ${L(x.cat)?`<div class="meta"><span class="chip">${esc(L(x.cat))}</span></div>`:""}
        <h3>${esc(L(x.title))}</h3>
        <p class="clamp">${esc(L(x.desc)||"")}</p>
        ${L(x.price_note)?`<p style="font-size:.85rem">💶 ${esc(L(x.price_note))}</p>`:""}
        <div class="card-foot"><span class="price">${x.price?esc(t("price_from")+" "+x.price):""}</span><div class="btns"><button class="link" data-serv="${si}">${t("details")}</button>${x.pay?`<a class="btn btn-red btn-pay" href="${esc(x.pay)}" target="_blank" rel="noopener">💳 ${t("pay_book")}</a>`:""}${x.url?`<a class="btn btn-line" style="padding:10px 20px" href="${esc(x.url)}" target="_blank" rel="noopener">${t("s_more")} ↗</a>`:`<a class="btn btn-line" style="padding:10px 20px" href="#contact" data-pick="other" data-title="${esc(L(x.title))}">${t("s_info")}</a>`}</div></div>
      </div>
    </article>`; }).join("");
}

function renderGallery(){
  if(!document.getElementById("galleryList")) return;
  let gs=0;
  document.getElementById("galleryList").innerHTML = SITE.gallery.map((g,i)=> ((gFilter==="all"||g.type===gFilter) && !(PAGE==="home" && ++gs>HOME_MAX.gal)) ? `
    <figure class="g-item" data-g="${i}" style="--ar:${esc(g.ar||"4/3")}">
      ${slot(g.img, L(g.cap))}
      ${g.type==="video"?'<span class="play"></span>':""}
      <figcaption>${esc(L(g.cap))}</figcaption>
    </figure>` : "").join("");
}


/* Icone dei social (disegnate in modo semplice, colore del testo) */
const _svg = b => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
const SOCIAL_ICONS = {
  facebook: _svg('<path d="M14.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H9v3h2.6V21"/>'),
  instagram: _svg('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none"/>'),
  tiktok: _svg('<path d="M14 3.5v11.2a3.6 3.6 0 1 1-3.6-3.6"/><path d="M14 3.5c.4 2.6 2.2 4.3 4.8 4.5"/>'),
  youtube: _svg('<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10.2 9.2v5.6l4.8-2.8z" fill="currentColor"/>'),
  whatsapp: _svg('<path d="M4 20l1.2-3.6A8.2 8.2 0 1 1 8 19z"/><path d="M9.2 8.6c.3 2.9 3.2 5.8 6.2 6.2l1-1.4-1.9-1-.9.8c-1-.5-2-1.5-2.5-2.5l.8-.9-1-1.9z" fill="currentColor" stroke="none"/>'),
  linkedin: _svg('<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M8 10.5V16M8 7.8v.1M11.5 16v-5.5M11.5 13c0-1.6 1-2.6 2.3-2.6s2.2.9 2.2 2.6V16"/>'),
  telegram: _svg('<path d="M20.5 4.5L3.5 11l5.5 2 2 6 3-4 4.5 3.5z"/><path d="M9 13l8-6"/>'),
  pinterest: _svg('<circle cx="12" cy="12" r="8.5"/><path d="M10.5 20l1.8-7.2M11 15c3.8.9 5.7-1.5 5.7-4.1a4.6 4.6 0 0 0-9.2.1c0 1 .3 1.8.9 2.3"/>'),
  x: _svg('<path d="M4.5 4.5l15 15M19.5 4.5l-15 15"/>'),
  tripadvisor: _svg('<circle cx="7.5" cy="13" r="3.5"/><circle cx="16.5" cy="13" r="3.5"/><path d="M4 9.5c4.5-3 11.5-3 16 0"/><circle cx="7.5" cy="13" r=".8" fill="currentColor"/><circle cx="16.5" cy="13" r=".8" fill="currentColor"/>')
};
function socialKey(l){ const s=String(l||"").toLowerCase();
  if(s==="fb"||s.includes("facebook")) return "facebook"; if(s==="ig"||s.includes("insta")) return "instagram";
  if(s==="tt"||s.includes("tiktok")) return "tiktok"; if(s==="yt"||s.includes("youtube")) return "youtube";
  if(s==="wa"||s.includes("whatsapp")) return "whatsapp"; if(s.includes("linkedin")) return "linkedin";
  if(s.includes("telegram")) return "telegram"; if(s.includes("pinterest")) return "pinterest";
  if(s.startsWith("x")||s.includes("twitter")) return "x"; if(s.includes("tripadvisor")) return "tripadvisor"; return ""; }

function renderContact(){
  const c=SITE.contact;
  document.getElementById("contactList").innerHTML = `
    ${c.email?`<li><b>✉️</b><div><small>${t("c_mail")}</small><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div></li>`:""}
    ${c.phone||c.whatsapp?`<li><b>📱</b><div><small>${t("c_phone")}</small><a href="https://wa.me/${esc(String(c.whatsapp||c.phone).replace(/\D/g,""))}" target="_blank" rel="noopener">${esc(c.phone||"+"+c.whatsapp)}</a></div></li>`:""}
    <li><b>📍</b><div><small>${t("c_place")}</small>${esc(L(c.place))}</div></li>`;
  const html = SITE.socials.filter(s=>s.url).map(s=>{ const k=socialKey(s.label); return `<a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(s.label)}" title="${esc(s.label)}">${SOCIAL_ICONS[k]||esc(String(s.label||"").slice(0,2))}</a>`; }).join("");
  ["socials","socialsC"].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=html; });
}


/* Pagina di una casa / escursione (casa/*.html, escursione/*.html) */
const paras = s => String(s||"").split(/\n+/).filter(p=>p.trim()).map(p=>`<p>${esc(p)}</p>`).join("");
function miniCard(href, img, title, chips){
  return `<article class="card"><a href="${href}" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;height:100%">${slot(img, title)}
    <div class="card-body"><div class="meta">${chips}</div><h3>${esc(title)}</h3><div class="card-foot"><span class="link">${t("details")}</span></div></div></a></article>`;
}
function renderDetail(){
  const box=document.getElementById("detail"); if(!box) return;
  const qid=new URLSearchParams(location.search).get("id")||box.dataset.id||"";
  const findI=list=>{ const j=(list||[]).findIndex(x=>x&&x.id===qid); return qid ? j : +box.dataset.idx; };
  const i=findI(box.dataset.kind==="house"?SITE.houses:SITE.excursions), more=document.getElementById("moreList");
  if(i<0){ box.innerHTML=`<p style="padding:40px 0">${esc(t("not_found")||"Pagina non trovata.")}</p>`; return; }
  if(box.dataset.kind==="house"){
    const h=(SITE.houses||[])[i]; if(!h) return;
    const am=L(h.amenities)||[], di=L(h.distances)||[];
    const mapUrl=h.map?(/^https?:/.test(h.map)?h.map:"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(h.map)):"";
    document.title = L(h.title) + " · Włoski z Dominiką";
    box.innerHTML = `<div class="detail-top"><div>${gallery([h.img].concat(h.photos||[]), L(h.title))}</div>
      <div class="detail-info">
        <div class="meta">${h.type?`<span class="chip">${esc(t("ty_"+h.type)||h.type)}</span>`:""}${h.place?`<span class="chip">📍 ${esc(h.place)}</span>`:""}${h.guests?`<span class="chip">👥 ${esc(h.guests)} ${t("guests")}</span>`:""}</div>
        <h1>${esc(L(h.title))}</h1>
        ${L(h.info)?`<p class="muted">${esc(L(h.info))}</p>`:""}
        ${h.price?`<div class="price">${esc(t("price_from")+" "+h.price)}</div>`:""}
        ${h.cin||h.cir?`<div class="codes">${h.cin?"CIN "+esc(h.cin):""}${h.cin&&h.cir?" · ":""}${h.cir?"CIR "+esc(h.cir):""}</div>`:""}
        <div class="btns">${h.pay?`<a class="btn btn-red" href="${esc(h.pay)}" target="_blank" rel="noopener">💳 ${t("pay_book")}</a>`:""}${h.url?`<a class="btn ${h.pay?"btn-line":"btn-red"}" href="${esc(h.url)}" target="_blank" rel="noopener">${t("h_btn")} ↗</a>`:""}<a class="btn btn-line" href="#contact" data-pick="house" data-title="${esc(L(h.title))}">${t("s_info")}</a></div>
        ${mapUrl?`<p><a class="link" href="${esc(mapUrl)}" target="_blank" rel="noopener">🗺️ ${t("see_map")}</a></p>`:""}
      </div></div>
      <div class="detail-cols"><div class="detail-text">${paras(L(h.desc))}</div>
      ${am.length||di.length?`<aside class="detail-aside">${am.length?`<h3>${t("amenities")}</h3><ul class="amen">${am.map(s=>`<li>${esc(s)}</li>`).join("")}</ul>`:""}${di.length?`<h3>${t("distances")}</h3><ul>${di.map(s=>`<li>${esc(s)}</li>`).join("")}</ul>`:""}</aside>`:""}</div>`;
    if(more){ const others=housesForPage().filter(x=>x!==h).slice(0,3);
      more.closest("section").style.display = others.length ? "" : "none";
      more.innerHTML = others.map(x=>{ const j=SITE.houses.indexOf(x); return miniCard(houseUrl(j), x.img, L(x.title), x.place?`<span class="chip">📍 ${esc(x.place)}</span>`:""); }).join(""); }
  } else {
    const x=(SITE.excursions||[])[i]; if(!x) return;
    const inc=L(x.incl)||[];
    document.title = L(x.title) + " · Włoski z Dominiką";
    box.innerHTML = `<div class="detail-top"><div>${gallery([x.img].concat(x.photos||[]), L(x.title))}</div>
      <div class="detail-info">
        <div class="meta">${x.area?`<span class="chip">${x.area==="sea"?"⛵":x.area==="land"?"🚐":""} ${esc(t("ex_"+x.area))}</span>`:""}${L(x.tag)?`<span class="chip">${esc(L(x.tag))}</span>`:""}${durTxt(x)?`<span class="chip">⏱ ${esc(durTxt(x))}</span>`:""}${x.guide&&GUIDE_LANGS?`<span class="chip">${GUIDE_LANGS}</span>`:""}</div>
        <h1>${esc(L(x.title))}</h1>
        ${x.price?`<div class="price">${esc(t("price_from")+" "+x.price)}</div>`:""}${L(x.price_note)?`<p class="muted" style="font-size:.9rem">${esc(L(x.price_note))}</p>`:""}
        <div class="btns">${x.pay?`<a class="btn btn-red" href="${esc(x.pay)}" target="_blank" rel="noopener">💳 ${t("pay_book")}</a>`:""}<a class="btn ${x.pay?"btn-line":"btn-red"}" href="#contact" data-pick="exc" data-title="${esc(L(x.title))}">${t("book")}</a></div>
      </div></div>
      <div class="detail-cols"><div class="detail-text">${paras(L(x.desc))}</div>
      ${inc.length?`<aside class="detail-aside"><h3>${t("included")}</h3><ul>${inc.map(s=>`<li>${esc(s)}</li>`).join("")}</ul></aside>`:""}</div>`;
    if(more){ const others=excForPage().filter(y=>y!==x).slice(0,3);
      more.closest("section").style.display = others.length ? "" : "none";
      more.innerHTML = others.map(y=>{ const j=SITE.excursions.indexOf(y); return miniCard(excUrl(j), y.img, L(y.title), durTxt(y)?`<span class="chip">⏱ ${esc(durTxt(y))}</span>`:""); }).join(""); }
  }
}

/* Articoli del blog tradotti: ogni lingua ha la sua pagina */
const POST_LANG = document.body.dataset.postLang || "";
const POST_OTHER = {it:"🇮🇹 Questo articolo è disponibile anche in italiano →", de:"🇩🇪 Diesen Artikel gibt es auch auf Deutsch →",
  en:"🇬🇧 This article is also available in English →", pl:"🇵🇱 Ten artykuł jest dostępny także po polsku →", es:"🇪🇸 Este artículo también está en español →"};
function postAlt(l){ const a = window.POST_ALTS || {}; return (PAGE==="post" && l!==POST_LANG && a[l]) ? a[l] + ".html" : ""; }
function blogLangFilter(){
  if(PAGE!=="blog") return;
  const has = document.querySelector('[data-bl="'+lang+'"]');
  const b = document.querySelector('[data-blf="'+(has?lang:"all")+'"]'); if(b) b.click();
}

function applyLang(){
  document.documentElement.lang = POST_LANG || lang;
  const po = document.getElementById("postOther");
  if(po){ const a = postAlt(lang); po.style.display = a ? "" : "none"; po.innerHTML = a ? `<a href="${esc(a)}">${POST_OTHER[lang]}</a>` : ""; }
  blogLangFilter();
  if(PAGE!=="home" && t("pt_"+PAGE)) document.title = t("pt_"+PAGE) + " · Włoski z Dominiką";
  document.querySelectorAll("[data-i]").forEach(el=>{ el.textContent = t(el.dataset.i); });
  document.getElementById("langBtns").innerHTML = LANGS.map(l=>`<button data-lang="${l}">${l.toUpperCase()}</button>`).join("");
  document.querySelectorAll(".lang button").forEach(b=>b.classList.toggle("on", b.dataset.lang===lang));
  renderExcursions(); renderLessons(); renderHouses(); renderServices(); renderGallery(); renderContact(); renderBlog(); renderDetail(); loadReviews();
}

/* Blog: ultimi articoli in Home + filtri nella pagina Blog */
let BLOG = null, BLOG_STATIC = null;
const BL_MONTHS = {it:"gen feb mar apr mag giu lug ago set ott nov dic",de:"Jan Feb Mär Apr Mai Jun Jul Aug Sep Okt Nov Dez",en:"Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec",pl:"sty lut mar kwi maj cze lip sie wrz paź lis gru",es:"ene feb mar abr may jun jul ago sep oct nov dic"};
const BL_FLAGS = {it:"🇮🇹",de:"🇩🇪",en:"🇬🇧",pl:"🇵🇱",es:"🇪🇸"};
const niceDate = (d, l) => { const m = String(d||"").slice(0,10).split("-").map(Number); return m.length===3&&m[1] ? m[2]+" "+(BL_MONTHS[l]||BL_MONTHS.it).split(" ")[m[1]-1]+" "+m[0] : String(d||""); };
const isDraft = d => d === true || d === "true" || d === "True";
const coverSrc = c => !c ? "" : /^https?:/.test(c) ? c : ROOT + String(c).replace(/^\//, "");
/* articoli scritti nell'app (Supabase); se non ci sono uso l'elenco fisso del sito */
async function loadBlog(){
  if (BLOG) return BLOG;
  try { BLOG_STATIC = (await fetch(ROOT + "content/blog-index.json?v=" + Date.now()).then(r => r.json())).items || []; } catch(e) { BLOG_STATIC = []; }
  let live = [];
  const c = window.WZD_CONFIG || {};
  if (c.SUPABASE_URL && !/INSERISCI/.test(c.SUPABASE_URL)) {
    try { const r = await fetch(c.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/site_posts?select=slug,data", { headers: { apikey: c.SUPABASE_ANON_KEY } }); if (r.ok) live = await r.json(); } catch(e) {}
  }
  live = (live || []).filter(r => r && r.data && !isDraft(r.data.draft)).map(r => { const d = r.data, l = d.lang || "it", dt = String(d.date || "").slice(0,10);
    return { slug: r.slug, title: d.title || "", description: d.description || "", lang: l, date: dt, date_txt: niceDate(dt, l), cover: d.cover || "", cover_alt: d.cover_alt || "", category: d.category || "", body: d.body || "", group: d.group || "", seo_title: d.seo_title || "" }; })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  BLOG = live.length ? live : BLOG_STATIC;
  return BLOG;
}
const postUrl = p => (BLOG_STATIC || []).some(x => x.slug === p.slug) ? ROOT + "blog/" + p.slug + ".html" : ROOT + "blog/leggi.html?p=" + encodeURIComponent(p.slug);
const blogCard = p => `<article class="card" data-bl="${esc(p.lang)}"><a href="${postUrl(p)}" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;height:100%">
    ${slot(coverSrc(p.cover), p.cover_alt || p.title)}
    <div class="card-body"><div class="meta"><span class="chip">${BL_FLAGS[p.lang]||""} ${esc(p.category || "Blog")}</span><span class="chip">${esc(p.date_txt || p.date)}</span></div>
    <h3>${esc(p.title)}</h3><p class="clamp">${esc(p.description)}</p><div class="card-foot"><span class="link">${t("read_more")}</span></div></div></a></article>`;
async function renderBlog(){
  if (PAGE === "blog") return renderBlogPage();
  if (PAGE === "post") return renderPostLive();
  const box = document.getElementById("blogList"); if (!box) return;
  await loadBlog();
  const sec = document.getElementById("blog"); if (sec) sec.style.display = BLOG.length ? "" : "none";
  const mine = BLOG.filter(p => p.lang === lang), rest = BLOG.filter(p => p.lang !== lang);
  box.innerHTML = (mine.length ? mine : rest).slice(0, 3).map(blogCard).join("");
}
let BLOG_PAGE_DONE = false;
async function renderBlogPage(){
  const grid = document.querySelector("#bloglist .grid-3"); if (!grid || BLOG_PAGE_DONE) return;
  await loadBlog(); if (BLOG === BLOG_STATIC) return;   // nessun articolo dall'app: resta la pagina fissa
  BLOG_PAGE_DONE = true;
  grid.innerHTML = BLOG.map(blogCard).join("") || `<p class="muted">${esc(t("blog_empty"))}</p>`;
  const langs = [...new Set(BLOG.map(p => p.lang))], names = {it:"Italiano",de:"Deutsch",en:"English",pl:"Polski",es:"Español"};
  const f = document.getElementById("blogFilters");
  if (f) f.innerHTML = langs.length > 1 ? `<button class="on" data-blf="all">${esc(t("blog_all"))}</button>` + langs.map(l => `<button data-blf="${l}">${BL_FLAGS[l]||""} ${names[l]||l}</button>`).join("") : "";
  blogLangFilter();
}
/* testo dell'articolo (Markdown semplice, come nel sito) */
function mdInline(s){
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => `<img src="${esc(coverSrc(u.replace(/&amp;/g,"&")))}" alt="${a}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, u) => { u = u.replace(/&amp;/g,"&"); const href = /^(https?:|mailto:|tel:|#)/.test(u) ? u : u.startsWith("/") ? ROOT + u.slice(1) : u;
    const ext = /^https?:/.test(href) && !/wloskizdominika\.com/.test(href); return `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${a}</a>`; });
  return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, "$1<em>$2</em>");
}
function mdToHtml(md){
  const out = []; let para = [], lst = null;
  const flush = () => { if (para.length) { out.push("<p>" + mdInline(para.join(" ")) + "</p>"); para = []; } if (lst) { out.push(`<${lst[0]}>` + lst[1].map(i => `<li>${mdInline(i)}</li>`).join("") + `</${lst[0]}>`); lst = null; } };
  String(md || "").replace(/\r/g, "").split("\n").forEach(raw => {
    const line = raw.replace(/\s+$/, ""), h = line.match(/^(#{1,4})\s+(.*)$/), ul = line.match(/^\s*[-*+]\s+(.*)$/), ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (!line.trim()) return flush();
    if (h) { flush(); const n = Math.max(2, h[1].length); out.push(`<h${n}>${mdInline(h[2])}</h${n}>`); return; }
    if (ul || ol) { const k = ul ? "ul" : "ol"; if (para.length) { out.push("<p>" + mdInline(para.join(" ")) + "</p>"); para = []; } if (lst && lst[0] !== k) flush(); if (!lst) lst = [k, []]; lst[1].push((ul || ol)[1]); return; }
    if (line.startsWith(">")) { flush(); out.push("<blockquote>" + mdInline(line.replace(/^>\s*/, "")) + "</blockquote>"); return; }
    if (lst) flush();
    para.push(line.trim());
  });
  flush(); return out.join("\n");
}
/* pagina di un articolo: mostra sempre l'ultima versione salvata nell'app */
let POST_DONE = false;
async function renderPostLive(){
  if (POST_DONE) return;
  const slug = new URLSearchParams(location.search).get("p") || (location.pathname.match(/\/blog\/([^/]+)\.html$/) || [])[1] || "";
  const h1 = document.getElementById("postH1"), body = document.getElementById("postBody"); if (!slug || !h1 || !body) return;
  await loadBlog(); POST_DONE = true;
  const p = BLOG.find(x => x.slug === slug);
  if (!p) { if (document.body.dataset.dyn) h1.textContent = t("not_found") || "Articolo non trovato."; return; }
  if (BLOG === BLOG_STATIC) return;   // la pagina fissa è già giusta
  document.title = (p.seo_title || p.title) + " · Włoski z Dominiką";
  h1.textContent = p.title;
  body.innerHTML = mdToHtml(p.body);
  const cv = document.getElementById("postCover"); if (cv) cv.innerHTML = p.cover ? `<img class="post-cover" src="${esc(coverSrc(p.cover))}" alt="${esc(p.cover_alt || p.title)}">` : "";
  const mt = document.getElementById("postMeta"), words = (String(p.body).match(/[\wÀ-ž'’]+/g) || []).length;
  if (mt) mt.innerHTML = `<span class="chip">${BL_FLAGS[p.lang]||""} ${esc(p.category || "Blog")}</span><span class="chip"><time datetime="${esc(p.date)}">${esc(p.date_txt)}</time></span><span class="chip">⏱ ${Math.max(1, Math.round(words / 200))} min</span>`;
  if (document.body.dataset.dyn) document.documentElement.lang = p.lang;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-blf]"); if (!b) return;
  document.querySelectorAll("[data-blf]").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll("[data-bl]").forEach(c => c.style.display = (b.dataset.blf === "all" || c.dataset.bl === b.dataset.blf) ? "" : "none");
});

/* Lightbox */
const lb=document.getElementById("lb"), lbInner=document.getElementById("lbInner");
function openLB(html){ lbInner.innerHTML=html; lb.classList.add("open"); document.body.style.overflow="hidden"; }
function closeLB(){ lb.classList.remove("open"); lbInner.innerHTML=""; document.body.style.overflow=""; }
lb.addEventListener("click", e=>{ if(e.target===lb || e.target.classList.contains("lb-close")) closeLB(); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeLB(); });

function ytId(url){ const m=String(url||"").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m?m[1]:null; }

document.addEventListener("click", e=>{
  const lb_ = e.target.closest("[data-lang]"); if(lb_){ lang=lb_.dataset.lang; try{localStorage.setItem("wzd-lang",lang)}catch(_){};
    const alt = postAlt(lang); if(alt){ location.href = alt; return; }
    applyLang(); return; }
  const hf = e.target.closest("[data-hf]"); if(hf){ hFilter=hf.dataset.hf; renderHouses(); return; }
  const ef = e.target.closest("[data-ef]"); if(ef){ eFilter=ef.dataset.ef; renderExcursions(); return; }
  const th = e.target.closest("[data-mg]");
  if(th){ const box=th.closest(".mg"); box.querySelector(".mg-main").outerHTML = slot(th.dataset.mg, "", "", "mg-main"); box.querySelectorAll("[data-mg]").forEach(b=>b.classList.toggle("on",b===th)); box.querySelectorAll(".mg-main img").forEach(i=>i.loading="eager"); return; }
  const sv = e.target.closest("[data-serv]");
  if(sv){
    const x=SITE.services[+sv.dataset.serv];
    openLB(`<div class="modal-card">${gallery([x.img].concat(x.photos||[]), L(x.title))}<div class="body">
      ${L(x.cat)?`<div class="meta" style="margin-bottom:12px"><span class="chip">${esc(L(x.cat))}</span></div>`:""}
      <h3>${esc(L(x.title))}</h3>
      <p class="pre" style="color:var(--muted)">${esc(L(x.desc)||"")}</p>
      ${L(x.price_note)?`<p style="margin-top:12px">💶 ${esc(L(x.price_note))}</p>`:""}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px"><span class="price">${x.price?esc(t("price_from")+" "+x.price):""}</span>
      <div class="btns">${x.pay?`<a class="btn btn-red" href="${esc(x.pay)}" target="_blank" rel="noopener">💳 ${t("pay_book")}</a>`:""}${x.url?`<a class="btn btn-line" href="${esc(x.url)}" target="_blank" rel="noopener">${t("s_more")} ↗</a>`:`<a class="btn ${x.pay?"btn-line":"btn-red"}" href="#contact" data-pick="other" data-title="${esc(L(x.title))}">${t("s_info")}</a>`}</div></div></div></div>`);
    return;
  }
  const hs = e.target.closest("[data-house]");
  if(hs){
    const h=SITE.houses[+hs.dataset.house];
    const am=L(h.amenities)||[], di=L(h.distances)||[];
    const mapUrl=h.map?(/^https?:/.test(h.map)?h.map:"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(h.map)):"";
    openLB(`<div class="modal-card">${gallery([h.img].concat(h.photos||[]), L(h.title))}<div class="body">
      <div class="meta" style="margin-bottom:12px">${h.type?`<span class="chip">${esc(t("ty_"+h.type)||h.type)}</span>`:""}${h.place?`<span class="chip">📍 ${esc(h.place)}</span>`:""}${h.guests?`<span class="chip">👥 ${esc(h.guests)} ${t("guests")}</span>`:""}</div>
      <h3>${esc(L(h.title))}</h3>
      ${L(h.info)?`<p style="color:var(--muted)">${esc(L(h.info))}</p>`:""}
      ${L(h.desc)?`<p class="pre" style="margin-top:10px">${esc(L(h.desc))}</p>`:""}
      ${am.length?`<b style="display:block;margin-top:18px">${t("amenities")}</b><ul class="amen">${am.map(s=>`<li>${esc(s)}</li>`).join("")}</ul>`:""}
      ${di.length?`<b style="display:block">${t("distances")}</b><ul>${di.map(s=>`<li>${esc(s)}</li>`).join("")}</ul>`:""}
      ${mapUrl?`<p><a href="${esc(mapUrl)}" target="_blank" rel="noopener">🗺️ ${t("see_map")}</a></p>`:""}
      ${h.cin||h.cir?`<div class="codes" style="margin:10px 0 16px">${h.cin?"CIN "+esc(h.cin):""}${h.cin&&h.cir?" · ":""}${h.cir?"CIR "+esc(h.cir):""}</div>`:""}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span class="price">${h.price?esc(t("price_from")+" "+h.price):""}</span>
      <div class="btns">${h.pay?`<a class="btn btn-red" href="${esc(h.pay)}" target="_blank" rel="noopener">💳 ${t("pay_book")}</a>`:""}${h.url?`<a class="btn btn-line" href="${esc(h.url)}" target="_blank" rel="noopener">${t("h_btn")} ↗</a>`:`<a class="btn btn-red" href="#contact" data-pick="house" data-title="${esc(L(h.title))}">${t("s_info")}</a>`}</div></div></div></div>`);
    return;
  }
  const f = e.target.closest("[data-f]"); if(f){ gFilter=f.dataset.f; document.querySelectorAll("#filters button").forEach(b=>b.classList.toggle("on",b===f)); renderGallery(); return; }
  const g = e.target.closest("[data-g]");
  if(g){
    const it=SITE.gallery[+g.dataset.g], cap=esc(L(it.cap));
    if(it.type==="video"){
      const id=ytId(it.youtube);
      if(id) openLB(`<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe></div><div class="lb-cap">${cap} · <a href="${esc(it.youtube)}" target="_blank" rel="noopener">${t("watch_yt")}</a></div>`);
      else openLB(`<video src="${esc(it.video||"")}" controls autoplay playsinline poster="${esc(it.img||"")}"></video><div class="lb-cap">${cap}</div>`);
    } else {
      openLB(`${slot(it.img, L(it.cap))}<div class="lb-cap">${cap}</div>`);
    }
    return;
  }
  const x = e.target.closest("[data-exc]");
  if(x){
    const ex=SITE.excursions[+x.dataset.exc];
    openLB(`<div class="modal-card">${gallery([ex.img].concat(ex.photos||[]), L(ex.title))}<div class="body">
      <div class="meta" style="margin-bottom:12px">${ex.area?`<span class="chip">${esc(t("ex_"+ex.area))}</span>`:""}${L(ex.tag)?`<span class="chip">${esc(L(ex.tag))}</span>`:""}${durTxt(ex)?`<span class="chip">⏱ ${esc(durTxt(ex))}</span>`:""}${ex.guide&&GUIDE_LANGS?`<span class="chip">${GUIDE_LANGS}</span>`:""}</div>
      <h3>${esc(L(ex.title))}</h3><p class="pre" style="color:var(--muted)">${esc(L(ex.desc))}</p>
      ${(L(ex.incl)||[]).length?`<b style="display:block;margin-top:16px">${t("included")}</b><ul>${(L(ex.incl)||[]).map(s=>`<li>${esc(s)}</li>`).join("")}</ul>`:""}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px"><span class="price">${ex.price?esc(t("price_from")+" "+ex.price):""}${L(ex.price_note)?`<small style="display:block;font:400 .82rem Lato,sans-serif;color:var(--muted)">${esc(L(ex.price_note))}</small>`:""}</span>
      <div class="btns">${ex.pay?`<a class="btn btn-red" href="${esc(ex.pay)}" target="_blank" rel="noopener">💳 ${t("pay_book")}</a>`:""}<a class="btn ${ex.pay?"btn-line":"btn-red"}" href="#contact" data-pick="exc" data-title="${esc(L(ex.title))}">${t("book")}</a></div></div></div></div>`);
    return;
  }
  const pick = e.target.closest("[data-pick],[data-course]");
  if(pick){
    document.getElementById("topic").value = pick.dataset.pick || pick.dataset.course;
    if(pick.dataset.title){ document.querySelector("textarea[name=msg]").value = pick.dataset.title + " – "; }
    closeLB();
  }
  if(e.target.closest(".menu a")) document.getElementById("menu").classList.remove("open");
});

/* Modulo «Scrivimi»: la richiesta arriva nel pannello (gestione.html → 📩 Richieste)
   e nell'elenco «Forms» di Netlify. Se nessuno dei due risponde, si apre WhatsApp o l'e-mail. */
document.getElementById("form").addEventListener("submit", async e=>{
  e.preventDefault();
  const f=e.target, fd=new FormData(f), n=document.getElementById("notice"), btn=f.querySelector('button[type=submit]');
  if((fd.get("bot-field")||"").trim()) return;
  const name=(fd.get("name")||"").trim(), mail=(fd.get("email")||"").trim(), phone=(fd.get("phone")||"").trim();
  const okMail=/^\S+@\S+\.\S+$/.test(mail), okPhone=phone.replace(/\D/g,"").length>=6;
  if(!name || (!okMail && !okPhone) || (mail && !okMail)){ n.textContent=t("fm_err"); n.classList.add("show"); return; }
  const topicTxt=f.topic.selectedOptions[0].textContent, msg=(fd.get("msg")||"").trim();
  btn.disabled=true; n.textContent=t("fm_sending"); n.classList.add("show");
  let saved=false;
  const cfg=window.WZD_CONFIG||{};
  if(cfg.SUPABASE_URL && !/INSERISCI/.test(cfg.SUPABASE_URL)){
    try{
      const r=await fetch(cfg.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/requests",{method:"POST",
        headers:{"apikey":cfg.SUPABASE_ANON_KEY,"Content-Type":"application/json","Prefer":"return=minimal"},
        body:JSON.stringify({name,email:mail||null,phone:phone||null,topic:topicTxt,message:msg||null,lang,page:location.pathname})});
      saved = saved || r.ok;
    }catch(_){}
  }
  try{
    const body=new URLSearchParams({"form-name":"contatto",name,email:mail,phone,topic:topicTxt,msg,lang,page:location.pathname});
    const r=await fetch("/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString()});
    saved = saved || r.ok;
  }catch(_){}
  btn.disabled=false;
  if(saved){ f.reset(); n.textContent=t("fm_sent"); n.classList.add("show"); return; }
  // piano B: WhatsApp o e-mail
  const text=`${topicTxt} – ${name}${mail?" <"+mail+">":""}${phone?" ☎ "+phone:""}\n\n${msg}`;
  const c=SITE.contact||{}, wa=String(c.whatsapp||c.phone||"").replace(/\D/g,"");
  if(wa){ window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`,"_blank","noopener"); n.textContent="WhatsApp ✓"; return; }
  if(c.email){ n.textContent=t("fm_ok")+c.email; try{ location.href=`mailto:${c.email}?subject=${encodeURIComponent(topicTxt+" – "+name)}&body=${encodeURIComponent(text)}`; }catch(_){} }
});

document.getElementById("yr").textContent=new Date().getFullYear();
loadLook().finally(hydrateStaticSlots);

/* Statistiche anonime delle visite (📊 Visite nella gestione).
   Niente cookie, niente indirizzo IP, niente dati personali: solo pagina, lingua,
   Paese stimato dal fuso orario del dispositivo, tipo di dispositivo e provenienza. */
const TZ_COUNTRY = {"Europe/Rome":"IT","Europe/Vatican":"IT","Europe/San_Marino":"IT","Europe/Warsaw":"PL","Europe/Berlin":"DE","Europe/Busingen":"DE",
 "Europe/Vienna":"AT","Europe/Zurich":"CH","Europe/London":"GB","Europe/Dublin":"IE","Europe/Paris":"FR","Europe/Madrid":"ES","Atlantic/Canary":"ES",
 "Europe/Lisbon":"PT","Europe/Amsterdam":"NL","Europe/Brussels":"BE","Europe/Luxembourg":"LU","Europe/Prague":"CZ","Europe/Bratislava":"SK",
 "Europe/Budapest":"HU","Europe/Ljubljana":"SI","Europe/Zagreb":"HR","Europe/Belgrade":"RS","Europe/Bucharest":"RO","Europe/Sofia":"BG","Europe/Athens":"GR",
 "Europe/Stockholm":"SE","Europe/Oslo":"NO","Europe/Copenhagen":"DK","Europe/Helsinki":"FI","Europe/Tallinn":"EE","Europe/Riga":"LV","Europe/Vilnius":"LT",
 "Europe/Kyiv":"UA","Europe/Kiev":"UA","Europe/Minsk":"BY","Europe/Moscow":"RU","Europe/Istanbul":"TR","Europe/Malta":"MT","Asia/Nicosia":"CY",
 "America/New_York":"US","America/Chicago":"US","America/Denver":"US","America/Los_Angeles":"US","America/Phoenix":"US","America/Anchorage":"US",
 "America/Detroit":"US","America/Indiana/Indianapolis":"US","Pacific/Honolulu":"US","America/Toronto":"CA","America/Vancouver":"CA","America/Edmonton":"CA",
 "America/Winnipeg":"CA","America/Halifax":"CA","America/Mexico_City":"MX","America/Sao_Paulo":"BR","America/Argentina/Buenos_Aires":"AR",
 "Australia/Sydney":"AU","Australia/Melbourne":"AU","Australia/Brisbane":"AU","Australia/Perth":"AU","Pacific/Auckland":"NZ","Asia/Tokyo":"JP",
 "Asia/Shanghai":"CN","Asia/Kolkata":"IN","Asia/Dubai":"AE","Asia/Jerusalem":"IL","Africa/Johannesburg":"ZA"};
function trackVisit(){
  try{
    const cfg=window.WZD_CONFIG||{};
    if(!cfg.SUPABASE_URL || /INSERISCI/.test(cfg.SUPABASE_URL)) return;
    if(navigator.webdriver || /^(localhost|127\.)/.test(location.hostname)) return;
    try{ if(localStorage.getItem("wzd-notrack")) return; }catch(_){}
    const ua=navigator.userAgent||"", tz=(Intl.DateTimeFormat().resolvedOptions().timeZone||"").slice(0,60);
    const bl=(navigator.language||"").slice(0,20), region=(bl.split("-")[1]||"").toUpperCase();
    const tablet=/iPad|Tablet|PlayBook|Silk/i.test(ua)||(/Android/i.test(ua)&&!/Mobile/i.test(ua))||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
    const device=tablet?"tablet":/Mobi|iPhone|iPod|Android/i.test(ua)?"mobile":"desktop";
    const os=/Windows/.test(ua)?"Windows":/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1)?"iOS":/Mac OS X/.test(ua)?"macOS":/Android/.test(ua)?"Android":/Linux/.test(ua)?"Linux":"altro";
    const browser=/Edg\//.test(ua)?"Edge":/OPR\/|Opera/.test(ua)?"Opera":/SamsungBrowser/.test(ua)?"Samsung":/Firefox|FxiOS/.test(ua)?"Firefox":/Chrome|CriOS/.test(ua)?"Chrome":/Safari/.test(ua)?"Safari":"altro";
    let source="", entry=true;
    try{ const r=document.referrer?new URL(document.referrer):null;
      if(r && r.hostname===location.hostname) entry=false; else if(r) source=r.hostname.replace(/^www\./,"").slice(0,100); }catch(_){}
    const q=new URLSearchParams(location.search); if(q.get("utm_source")) source=q.get("utm_source").slice(0,100);
    const row={page:location.pathname.slice(0,200),site_lang:lang,browser_lang:bl,country:TZ_COUNTRY[tz]||(/^[A-Z]{2}$/.test(region)?region:null),
      tz,device,os,browser,source:source||null,entry};
    fetch(cfg.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/visits",{method:"POST",keepalive:true,
      headers:{"apikey":cfg.SUPABASE_ANON_KEY,"Content-Type":"application/json","Prefer":"return=minimal"},
      body:JSON.stringify(row)}).catch(()=>{});
  }catch(_){}
}

/* ⭐ Recensioni: si leggono e si scrivono nel database (solo quelle approvate sono visibili) */
let REVIEWS=null, rvStar=5;
const rvFlag=c=>c&&/^[A-Z]{2}$/.test(c)?String.fromCodePoint(...[...c].map(x=>127397+x.charCodeAt(0))):"";
function rvApi(){ const c=window.WZD_CONFIG||{}; return (c.SUPABASE_URL&&!/INSERISCI/.test(c.SUPABASE_URL))?c:null; }
async function loadReviews(){
  const sec=document.getElementById("reviews"), c=rvApi(); if(!sec||!c) return;
  sec.style.display="";
  if(REVIEWS===null){
    try{
      const r=await fetch(c.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/reviews?select=id,created_at,name,country,rating,topic,body,lang,source&approved=eq.true&order=created_at.desc&limit=60",{headers:{apikey:c.SUPABASE_ANON_KEY}});
      REVIEWS=r.ok?await r.json():[];
    }catch(_){ REVIEWS=[]; }
  }
  renderReviewsSite();
}
function renderReviewsSite(){
  const sec=document.getElementById("reviews"), box=document.getElementById("rvList"); if(!sec||!box||REVIEWS===null) return;
  const topic=sec.dataset.topic||"";
  let list=topic?REVIEWS.filter(r=>r.topic===topic):REVIEWS;
  // prima quelle nella lingua del visitatore
  list=list.slice().sort((a,b)=>(b.lang===lang)-(a.lang===lang));
  const max=PAGE==="home"?6:4;
  box.innerHTML=list.length?list.slice(0,max).map(r=>`<figure class="rv-card">
      <div class="rv-st" aria-label="${r.rating}/5">${"★".repeat(r.rating)}<span>${"★".repeat(5-r.rating)}</span></div>
      <blockquote>${esc(r.body)}</blockquote>
      <figcaption><b>${esc(r.name)}</b> ${rvFlag(r.country)} <small>${r.topic?esc(t("rev_t_"+r.topic)):""}${r.source?" · "+esc(r.source):""}</small></figcaption>
    </figure>`).join(""):`<p class="rv-empty">${esc(t("rev_empty"))}</p>`;
}
document.addEventListener("click",e=>{
  if(e.target.closest("#rvOpen")){ const f=document.getElementById("rvForm"); f.hidden=!f.hidden; if(!f.hidden){ f.topic.value=(document.getElementById("reviews").dataset.topic||f.topic.value); f.name.focus(); } return; }
  const s=e.target.closest("[data-star]"); if(s){ rvStar=+s.dataset.star; document.querySelectorAll("#rvStars button").forEach(b=>b.classList.toggle("on",+b.dataset.star<=rvStar)); }
});
document.addEventListener("submit",async e=>{
  if(e.target.id!=="rvForm") return; e.preventDefault();
  const f=e.target, n=document.getElementById("rvNotice"), c=rvApi(), btn=f.querySelector("button.btn");
  const row={name:f.name.value.trim(),country:f.country.value||null,rating:rvStar,topic:f.topic.value,body:f.body.value.trim(),email:f.email.value.trim()||null,lang,source:null};
  if(!row.name||row.body.length<5||!c){ n.textContent=t("rev_err"); n.classList.add("show"); return; }
  btn.disabled=true;
  let ok=false;
  try{ const r=await fetch(c.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/reviews",{method:"POST",headers:{apikey:c.SUPABASE_ANON_KEY,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(row)}); ok=r.ok; }catch(_){}
  btn.disabled=false;
  n.textContent=ok?t("rev_thanks"):t("rev_err"); n.classList.add("show");
  if(ok){ f.reset(); rvStar=5; document.querySelectorAll("#rvStars button").forEach(b=>b.classList.add("on")); }
});
loadContent().then(applyLang).catch(e=>console.error("Contenuti non caricati",e)).finally(()=>setTimeout(trackVisit,300));
