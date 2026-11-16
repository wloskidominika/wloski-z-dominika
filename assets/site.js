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
let SITE = {}, T = {}, GUIDE_LANGS = "";
function fixPaths(o){
  if (typeof o === "string") return /^\/(?!\/)[\w.-]+(\/|$)/.test(o) ? ROOT + o.slice(1) : o;
  if (Array.isArray(o)) return o.map(fixPaths);
  if (o && typeof o === "object") { const r = {}; for (const k in o) r[k] = fixPaths(o[k]); return r; }
  return o;
}
async function loadContent(){
  const get = n => fetch(ROOT + "content/" + n + "?v=" + Date.now()).then(r => r.json());
  const [st, ex, le, ho, ga, tx, sv] = await Promise.all(["settings.json","excursions.json","lessons.json","houses.json","gallery.json","texts.json","services.json"].map(n => get(n).catch(() => ({}))));
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
  const hs = LOOK.home_sections || {};
  if (PAGE === "home") for (const id in hs) if (hs[id] === false) { const el = document.getElementById(id); if (el) el.style.display = "none"; }
  const mn = LOOK.menu || {};
  document.querySelectorAll(".menu a[data-i], .f-links a[data-i]").forEach(a => { if (mn[a.dataset.i] === false) (a.closest("li") || a).style.display = "none"; });
  const hc = LOOK.home_counts || {};
  if (hc.exc) HOME_MAX.exc = +hc.exc; if (hc.house) HOME_MAX.house = +hc.house; if (hc.serv) HOME_MAX.serv = +hc.serv;
}

/* ===================== Logika strony / Logica ===================== */
const PAGE = document.body.dataset.page || "home";
const HOME_MAX = { exc: 6, house: 6, serv: 3 };
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
  const areas=[...new Set(SITE.excursions.map(x=>x.area).filter(Boolean))];
  document.getElementById("excFilters").innerHTML = areas.length>1
    ? [`<button class="${eFilter==="all"?"on":""}" data-ef="all">${t("ex_all")}</button>`].concat(areas.map(a=>`<button class="${eFilter===a?"on":""}" data-ef="${esc(a)}">${esc(t("ex_"+a)||a)}</button>`)).join("") : "";
  if(!document.getElementById("excList")) return;
  let shown=0;
  document.getElementById("excList").innerHTML = SITE.excursions.map((x,i)=> ((eFilter!=="all"&&x.area!==eFilter) || (PAGE==="home" && ++shown>HOME_MAX.exc)) ? "" : `
    <article class="card">
      ${slot(x.img, L(x.title))}
      <div class="card-body">
        <div class="meta">${x.area?`<span class="chip">${x.area==="sea"?"⛵":x.area==="land"?"🚐":""} ${esc(t("ex_"+x.area))}</span>`:""}${L(x.tag)?`<span class="chip">${esc(L(x.tag))}</span>`:""}${durTxt(x)?`<span class="chip">⏱ ${esc(durTxt(x))}</span>`:""}${x.guide&&GUIDE_LANGS?`<span class="chip">${GUIDE_LANGS}</span>`:""}</div>
        <h3>${esc(L(x.title))}</h3>
        <p class="clamp">${esc(L(x.desc))}</p>
        <div class="card-foot"><span class="price">${x.price?esc(t("price_from")+" "+x.price):""}</span><div class="btns" style="align-items:center">${x.pay?`<a class="btn btn-red btn-pay" href="${esc(x.pay)}" target="_blank" rel="noopener">💳 ${t("pay_book")}</a>`:""}<button class="link" data-exc="${i}">${t("details")}</button></div></div>
      </div>
    </article>`).join("");
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
  const all=SITE.houses||[];
  const types=[...new Set(all.map(h=>h.type).filter(Boolean))];
  document.getElementById("houseFilters").innerHTML = types.length>1
    ? [`<button class="${hFilter==="all"?"on":""}" data-hf="all">${t("h_all")}</button>`].concat(types.map(ty=>`<button class="${hFilter===ty?"on":""}" data-hf="${esc(ty)}">${esc(t("ty_"+ty)||ty)}</button>`)).join("")
    : "";
  document.getElementById("houseList").innerHTML = all.filter(h=>hFilter==="all"||h.type===hFilter).slice(0, PAGE==="home"?HOME_MAX.house:999).map(h=>`
    <article class="card">
      ${slot(h.img, L(h.title))}
      <div class="card-body">
        <div class="meta">${h.type?`<span class="chip">${esc(t("ty_"+h.type)||h.type)}</span>`:""}${h.place?`<span class="chip">📍 ${esc(h.place)}</span>`:""}</div>
        <h3>${esc(L(h.title))}</h3>
        ${L(h.info)?`<p>${esc(L(h.info))}</p>`:""}
        ${L(h.desc)?`<p class="clamp">${esc(L(h.desc))}</p>`:""}
        ${h.cin||h.cir?`<div class="codes">${h.cin?"CIN "+esc(h.cin):""}${h.cin&&h.cir?" · ":""}${h.cir?"CIR "+esc(h.cir):""}</div>`:""}
        <div class="card-foot"><span class="price">${h.price?esc(t("price_from")+" "+h.price):""}</span><div class="btns"><button class="link" data-house="${SITE.houses.indexOf(h)}">${t("details")}</button>${h.pay?`<a class="btn btn-red btn-pay" href="${esc(h.pay)}" target="_blank" rel="noopener">💳 ${t("pay_book")}</a>`:""}${h.url?`<a class="btn btn-line" style="padding:10px 20px" href="${esc(h.url)}" target="_blank" rel="noopener">${t("h_btn")} ↗</a>`:`<a class="btn btn-line" style="padding:10px 20px" href="#contact" data-pick="house" data-title="${esc(L(h.title))}">${t("s_info")}</a>`}</div></div>
      </div>
    </article>`).join("");
}

function servicesForPage(){
  const all=SITE.services||[];
  if(PAGE==="transfer") return all.filter(x=>x.kind==="transfer");
  if(PAGE==="rental") return all.filter(x=>x.kind==="rental");
  return all;
}
function renderServices(){
  const sec=document.getElementById("services"); if(!sec) return;
  const list=servicesForPage().slice(0, PAGE==="home"?HOME_MAX.serv:999);
  sec.style.display = list.length ? "" : "none";
  if(PAGE==="transfer"||PAGE==="rental"){
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
  document.getElementById("galleryList").innerHTML = SITE.gallery.map((g,i)=> (gFilter==="all"||g.type===gFilter) ? `
    <figure class="g-item" data-g="${i}" style="--ar:${esc(g.ar||"4/3")}">
      ${slot(g.img, L(g.cap))}
      ${g.type==="video"?'<span class="play"></span>':""}
      <figcaption>${esc(L(g.cap))}</figcaption>
    </figure>` : "").join("");
}

function renderContact(){
  const c=SITE.contact;
  document.getElementById("contactList").innerHTML = `
    <li><b>✉️</b><div><small>${t("c_mail")}</small><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div></li>
    <li><b>📱</b><div><small>${t("c_phone")}</small><a href="https://wa.me/${esc(c.whatsapp)}" target="_blank" rel="noopener">${esc(c.phone)}</a></div></li>
    <li><b>📍</b><div><small>${t("c_place")}</small>${esc(L(c.place))}</div></li>`;
  document.getElementById("socials").innerHTML = SITE.socials.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(s.label)}">${esc(s.label)}</a>`).join("");
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
  renderExcursions(); renderLessons(); renderHouses(); renderServices(); renderGallery(); renderContact(); renderBlog();
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
  const href=`mailto:${SITE.contact.email}?subject=${encodeURIComponent(topicTxt+" – "+name)}&body=${encodeURIComponent(body)}`;
  n.textContent=t("fm_ok")+SITE.contact.email; n.classList.add("show");
  try{ window.location.href=href; }catch(_){}
});

document.getElementById("yr").textContent=new Date().getFullYear();
loadLook().finally(hydrateStaticSlots);
loadContent().then(applyLang).catch(e=>console.error("Contenuti non caricati",e));
