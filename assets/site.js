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
async function loadContent(){
  const get = n => fetch(ROOT + "content/" + n + "?v=" + Date.now()).then(r => r.json());
  const [st, ex, le, ho, ga, tx, sv, sl] = await Promise.all(["settings.json","excursions.json","lessons.json","houses.json","gallery.json","texts.json","services.json","slugs.json"].map(n => get(n).catch(() => ({}))));
  SLUGS = sl || {};
  SITE = { contact: st.contact, socials: st.socials || [], excursions: ex.items || [], lessonsIT: le.italian, lessonsPL: le.polish, houses: ho.items || [], gallery: ga.items || [], services: sv.items || [] };
  GUIDE_LANGS = st.guide_langs || ""; T = tx;
  SITE = fixPaths(SITE);
  if (st.vat) document.getElementById("vat").textContent = "P.IVA " + st.vat;
}

/* Aspetto: colori, foto principali, sezioni e menu (pannello → 🎨 Aspetto del sito) */
let LOOK = {};
async function loadLook(){
  try { LOOK = fixPaths(await fetch(ROOT + "content/look.json?v=" + Date.now()).then(r => r.json())); } catch(e) { LOOK = {}; return; }
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
  document.querySelectorAll(".menu a[data-i], .f-links a[data-i], .nav-right a[data-i]").forEach(a => { if (mn[a.dataset.i] === false) (a.closest("li") || a).style.display = "none"; });
  const TILE_NAV = { houses:"nav_house", hotels:"nav_hotel", exc:"nav_exc", exp:"nav_exp", transfer:"nav_tr", rental:"nav_rent", boat:"nav_boat", media:"nav_media" };
  for (const k in TILE_NAV) if (mn[TILE_NAV[k]] === false) document.querySelectorAll('[data-tile="' + k + '"]').forEach(el => el.style.display = "none");
  const hc = LOOK.home_counts || {};
  if (hc.exc) HOME_MAX.exc = +hc.exc; if (hc.house) HOME_MAX.house = +hc.house; if (hc.serv) HOME_MAX.serv = +hc.serv;
}

/* ===================== Logika strony / Logica ===================== */
const PAGE = document.body.dataset.page || "home";
const HOME_MAX = { exc: 6, house: 6, serv: 3, gal: 8 };
const HOTEL_TYPES = ["hotel","bnb"];
/* quali elementi mostra ogni pagina */
const isHotel = h => HOTEL_TYPES.includes(h.type);
function housesForPage(){ const all=SITE.houses||[]; return (PAGE==="hotels"||PAGE==="hotel") ? all.filter(isHotel) : all.filter(h=>!isHotel(h)); }
function excForPage(){ const all=SITE.excursions||[]; return (PAGE==="exp"||PAGE==="expd") ? all.filter(x=>x.kind==="exp") : all.filter(x=>x.kind!=="exp"); }
const houseUrl = i => (SLUGS.houses||[])[i] ? ROOT + "casa/" + SLUGS.houses[i] + ".html" : "";
const excUrl = i => (SLUGS.excursions||[])[i] ? ROOT + "escursione/" + SLUGS.excursions[i] + ".html" : "";
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
  const all=SITE.services||[];
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
  const i=+box.dataset.idx, more=document.getElementById("moreList");
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
  renderExcursions(); renderLessons(); renderHouses(); renderServices(); renderGallery(); renderContact(); renderBlog(); renderDetail();
}

/* Blog: ultimi articoli in Home + filtri nella pagina Blog */
let BLOG = null;
async function renderBlog(){
  const box = document.getElementById("blogList"); if (!box) return;
  if (!BLOG) { try { BLOG = (await fetch(ROOT + "content/blog-index.json?v=" + Date.now()).then(r => r.json())).items || []; } catch(e) { BLOG = []; } }
  const sec = document.getElementById("blog"); if (sec) sec.style.display = BLOG.length ? "" : "none";
  const mine = BLOG.filter(p => p.lang === lang), rest = BLOG.filter(p => p.lang !== lang);
  box.innerHTML = (mine.length ? mine : rest).slice(0, 3).map(p => `<article class="card"><a href="${ROOT}blog/${esc(p.slug)}.html" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;height:100%">
    ${slot(p.cover ? ROOT + p.cover : "", p.cover_alt || p.title)}
    <div class="card-body"><div class="meta"><span class="chip">${esc(p.category || "Blog")}</span><span class="chip">${esc(p.date_txt || p.date)}</span></div>
    <h3>${esc(p.title)}</h3><p class="clamp">${esc(p.description)}</p><div class="card-foot"><span class="link">${t("read_more")}</span></div></div></a></article>`).join("");
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

/* Formularz → otwiera e-mail / il modulo apre l'e-mail */
document.getElementById("form").addEventListener("submit", e=>{
  e.preventDefault();
  const fd=new FormData(e.target), n=document.getElementById("notice");
  const name=(fd.get("name")||"").trim(), mail=(fd.get("email")||"").trim();
  if(!name || !/^\S+@\S+\.\S+$/.test(mail)){ n.textContent=t("fm_err"); n.classList.add("show"); return; }
  const topicTxt=e.target.topic.selectedOptions[0].textContent;
  const body=`${name} <${mail}>\n\n${fd.get("msg")||""}`;
  const c=SITE.contact||{}, wa=String(c.whatsapp||c.phone||"").replace(/\D/g,"");
  if(!c.email && wa){
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(topicTxt+" – "+body)}`,"_blank","noopener");
    n.textContent="WhatsApp ✓"; n.classList.add("show"); return;
  }
  const href=`mailto:${c.email}?subject=${encodeURIComponent(topicTxt+" – "+name)}&body=${encodeURIComponent(body)}`;
  n.textContent=t("fm_ok")+c.email; n.classList.add("show");
  try{ window.location.href=href; }catch(_){}
});

document.getElementById("yr").textContent=new Date().getFullYear();
loadLook().finally(hydrateStaticSlots);
loadContent().then(applyLang).catch(e=>console.error("Contenuti non caricati",e));
