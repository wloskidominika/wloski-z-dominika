/* =====================================================================
   ✏️ Il sito dentro l'app: case, hotel, escursioni, servizi, foto,
   testi, contatti e blog. Si salva su Aruba e il sito lo legge subito.
   (usa sb, $, $$, esc, show di gestione.html)
   ===================================================================== */
const ED_LANGS = ["it", "de", "en", "pl", "es"];
const ED_FLAG = { it: "IT", de: "DE", en: "EN", pl: "PL", es: "ES" };
const ED_KEYS = ["look", "houses", "hotels", "excursions", "services", "gallery", "lessons", "settings", "texts"];
let SCHEMA = null, ED = { key: null, data: null, dirty: false, saving: false };
const edCache = {};

async function schema() {
  if (!SCHEMA) {
    SCHEMA = await fetch("/assets/schema.json?v=" + Date.now()).then(r => r.json());
    ["houses", "hotels"].forEach(k => { const it = (SCHEMA.files[k].fields || []).find(f => f.name === "items"); if (!it) return;
      it.fields.forEach(f => { if (f.name === "cin" || f.name === "cir") { f.must = true; f.hint = "Obbligatorio per legge: senza " + f.name.toUpperCase() + " la struttura non va online."; } }); });
    (SCHEMA.blog.fields || []).forEach(f => { if (f.widget === "markdown") f.hint = "Sottotitolo: inizia la riga con ## · Grassetto: **parola** · Elenco: righe che iniziano con - · Link: [testo](/escursioni.html) · Riga vuota = nuovo paragrafo."; });
  }
  return SCHEMA;
}
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const isLangObj = f => f && f.widget === "object" && Array.isArray(f.fields) && f.fields.length && f.fields.every(x => ED_LANGS.includes(x.name));
function slugify(s) {
  return String(s || "").split("·")[0].replace(/ł/g, "l").replace(/Ł/g, "L").normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/, "") || "pagina";
}
function markDirty() {
  if (String(curRoute).startsWith("blog/")) { BL.dirty = true; return; }
  ED.dirty = true; const m = $("#edMsg"); if (m && ED.key) { m.textContent = "Modifiche non salvate"; m.className = "msg show info"; }
}

/* ---------- dati: dal motore su Aruba, oppure i file del sito la prima volta ---------- */
async function loadKey(key) {
  if (edCache[key]) return edCache[key];
  const { data, error } = await sb.from("site_content").select("data").eq("key", key).maybeSingle();
  if (error) throw error;
  let d = data && data.data && Object.keys(data.data).length ? data.data : null;
  if (!d) d = await fetch("/content/" + key + ".json?v=" + Date.now()).then(r => r.json()).catch(() => ({}));
  return (edCache[key] = d);
}
async function saveKey(key, d) {
  const { error } = await sb.from("site_content").upsert({ key, data: d, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  edCache[key] = clone(d);
}
/* al primo accesso copio nel database tutto quello che c'è oggi sul sito */
let SEEDED = false;
window.seedSite = async function () {
  if (SEEDED) return; SEEDED = true;
  try {
    const { data: rows, error } = await sb.from("site_content").select("key");
    if (error) { console.warn("site_content:", error.message); return; }
    const have = new Set((rows || []).map(r => r.key));
    for (const k of ED_KEYS) if (!have.has(k)) {
      const d = await fetch("/content/" + k + ".json?v=" + Date.now()).then(r => r.json()).catch(() => null);
      if (d && Object.keys(d).length) await sb.from("site_content").upsert({ key: k, data: d }, { onConflict: "key", ignoreDuplicates: true });
    }
    /* CIN e CIR obbligatori: se nel database mancano, li prendo dai file del sito */
    for (const k of ["houses", "hotels"]) {
      const { data: row } = await sb.from("site_content").select("data").eq("key", k).maybeSingle();
      const base = await fetch("/content/" + k + ".json?v=" + Date.now()).then(r => r.json()).catch(() => null);
      if (!row || !row.data || !base) continue;
      let changed = false;
      (row.data.items || []).forEach(it => { const b = (base.items || []).find(x => x.id && x.id === it.id); if (!b) return;
        ["cin", "cir"].forEach(f => { if (!it[f] && b[f]) { it[f] = b[f]; changed = true; } }); });
      if (changed) await sb.from("site_content").update({ data: row.data, updated_at: new Date().toISOString() }).eq("key", k);
    }
    /* correzione: le scritte del Transfer erano state sostituite per errore da quelle delle Traduzioni */
    { const { data: row } = await sb.from("site_content").select("data").eq("key", "texts").maybeSingle();
      const base = await fetch("/content/texts.json?v=" + Date.now()).then(r => r.json()).catch(() => null);
      if (row && row.data && base) { let ch = false;
        for (const l in base) { const d = row.data[l]; if (!d) continue;
          if (d.tr_eyebrow && base[l].tl_eyebrow && d.tr_eyebrow === base[l].tl_eyebrow) {
            ["tr_eyebrow", "tr_title", "tr_sub"].forEach(k => { d[k] = base[l][k]; }); ch = true; } }
        if (ch) await sb.from("site_content").update({ data: row.data, updated_at: new Date().toISOString() }).eq("key", "texts"); } }
    /* novembre 2026: la pagina diventa «Hotel, B&B, Residence e Villaggi» ed è pubblicata */
    { const OLD = {"it": {"nav_hotel": "Hotel e B&B", "vt_hotel": "Hotel e bed & breakfast selezionati", "hotel_title": "Hotel e B&B", "hotel_sub": "Hotel e bed & breakfast selezionati a Tropea e dintorni.", "hotel_empty": "Stiamo selezionando hotel e B&B. Scrivici: ti consigliamo la soluzione giusta per le tue date.", "pt_hotels": "Hotel e B&B a Tropea", "back_hotels": "← Tutti gli hotel e B&B", "ty_residence": "Residence"}, "de": {"nav_hotel": "Hotels & B&B", "vt_hotel": "Ausgewählte Hotels und B&Bs", "hotel_title": "Hotels & B&Bs", "hotel_sub": "Ausgewählte Hotels und Bed & Breakfasts in Tropea und Umgebung.", "hotel_empty": "Wir wählen gerade Hotels und B&Bs aus. Schreiben Sie uns: Wir empfehlen Ihnen das Passende für Ihre Reisedaten.", "pt_hotels": "Hotels & B&Bs in Tropea", "back_hotels": "← Alle Hotels & B&Bs", "ty_residence": "Residence"}, "en": {"nav_hotel": "Hotels & B&Bs", "vt_hotel": "Selected hotels and B&Bs", "hotel_title": "Hotels & B&Bs", "hotel_sub": "Selected hotels and bed & breakfasts in and around Tropea.", "hotel_empty": "We are selecting hotels and B&Bs. Write to us and we will recommend the right place for your dates.", "pt_hotels": "Hotels & B&Bs in Tropea", "back_hotels": "← All hotels & B&Bs", "ty_residence": "Residence"}, "pl": {"nav_hotel": "Hotele i B&B", "vt_hotel": "Wybrane hotele i B&B", "hotel_title": "Hotele i B&B", "hotel_sub": "Wybrane hotele i pensjonaty B&B w Tropei i okolicy.", "hotel_empty": "Właśnie wybieramy hotele i B&B. Napisz do nas, a polecimy nocleg dopasowany do Twoich dat.", "pt_hotels": "Hotele i B&B w Tropei", "back_hotels": "← Wszystkie hotele i B&B", "ty_residence": "Rezydencja"}, "es": {"nav_hotel": "Hoteles y B&B", "vt_hotel": "Hoteles y B&B seleccionados", "hotel_title": "Hoteles y B&B", "hotel_sub": "Hoteles y bed & breakfast seleccionados en Tropea y alrededores.", "hotel_empty": "Estamos seleccionando hoteles y B&B. Escríbenos y te recomendamos la opción ideal para tus fechas.", "pt_hotels": "Hoteles y B&B en Tropea", "back_hotels": "← Todos los hoteles y B&B", "ty_residence": "Residence"}};
      const { data: row } = await sb.from("site_content").select("data").eq("key", "texts").maybeSingle();
      const base = await fetch("/content/texts.json?v=" + Date.now()).then(r => r.json()).catch(() => null);
      if (row && row.data && base) { let ch = false;
        for (const l in OLD) { const d = row.data[l]; if (!d || !base[l]) continue;
          for (const k in OLD[l]) if (d[k] && d[k] === OLD[l][k] && base[l][k] && base[l][k] !== d[k]) { d[k] = base[l][k]; ch = true; } }
        if (ch) await sb.from("site_content").update({ data: row.data, updated_at: new Date().toISOString() }).eq("key", "texts"); }
      const { data: hr } = await sb.from("site_content").select("data").eq("key", "hotels").maybeSingle();
      if (hr && hr.data && !hr.data.pub_2611) { hr.data.page_visible = true; hr.data.pub_2611 = true;
        await sb.from("site_content").update({ data: hr.data, updated_at: new Date().toISOString() }).eq("key", "hotels"); } }
    const { count } = await sb.from("site_posts").select("slug", { count: "exact", head: true });
    if (count === 0) {
      const all = await fetch("/content/blog-all.json?v=" + Date.now()).then(r => r.json()).catch(() => null);
      if (all && all.items && all.items.length) await sb.from("site_posts").upsert(all.items.map(p => ({ slug: p.slug, data: p.data })), { onConflict: "slug", ignoreDuplicates: true });
    }
  } catch (e) { console.warn("seed", e); }
};

/* ---------- foto: ridotte sul telefono e caricate su Aruba ---------- */
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || file.size < 400000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch (e) { return file; }
}
async function upload(file) {
  const f = await shrink(file);
  const ext = (f.name.match(/\.(\w+)$/) || [, "jpg"])[1].toLowerCase();
  const path = "foto/" + new Date().toISOString().slice(0, 10) + "-" + slugify(f.name.replace(/\.\w+$/, "")).slice(0, 40) + "-" + Math.random().toString(36).slice(2, 7) + "." + ext;
  const { error } = await sb.storage.from("site").upload(path, f, { contentType: f.type || undefined, upsert: false });
  if (error) throw error;
  return sb.storage.from("site").getPublicUrl(path).data.publicUrl;
}
const imgUrl = u => !u ? "" : /^https?:/.test(u) ? u : "/" + String(u).replace(/^\//, "");
function pickFiles(accept, multiple) {
  return new Promise(res => {
    const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.multiple = !!multiple;
    i.onchange = () => res([...i.files]); i.click();
  });
}
async function withUpload(btn, files, done) {
  const old = btn.innerHTML; btn.innerHTML = "⏳ Carico…"; btn.style.pointerEvents = "none";
  try { for (const f of files) done(await upload(f)); }
  catch (e) { alert("Caricamento non riuscito: " + (e.message || e)); }
  btn.innerHTML = old; btn.style.pointerEvents = "";
}

/* ---------- moduli ---------- */
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const k in attrs) { if (k === "class") el.className = attrs[k]; else if (k.startsWith("on")) el[k] = attrs[k]; else if (attrs[k] != null) el.setAttribute(k, attrs[k]); }
  kids.flat().forEach(c => c != null && el.append(c.nodeType ? c : document.createTextNode(c)));
  return el;
};
const A = (el, ...k) => { k.flat().forEach(c => c != null && el.append(c)); return el; };
const cleanLabel = l => String(l || "").replace(/\s*\(.*?\)\s*$/, "");
function hintEl(f) { return f.hint ? h("span", { class: "hint" }, f.hint) : null; }

/* campo semplice (stringa, testo, scelta, colore, data, numero, interruttore) */
function input(f, val, set) {
  const w = f.widget || "string";
  if (w === "boolean") {
    const c = h("input", { type: "checkbox" }); c.checked = val === undefined ? !!f.default : !!val;
    c.onchange = () => { set(c.checked); markDirty(); };
    return h("label", { class: "tog" }, c, h("span", {}, cleanLabel(f.label)));
  }
  if (w === "select") {
    const s = h("select");
    if (!f.required) s.append(h("option", { value: "" }, "—"));
    (f.options || []).forEach(o => { const v = typeof o === "object" ? o.value : o, l = typeof o === "object" ? o.label : o; s.append(h("option", { value: v }, l)); });
    s.value = val ?? f.default ?? ""; s.onchange = () => { set(s.value || undefined); markDirty(); };
    return s;
  }
  if (w === "color") {
    const c = h("input", { type: "color", style: "width:52px;height:40px;padding:2px" }), t = h("input", { style: "max-width:140px" });
    c.value = /^#[0-9a-f]{6}$/i.test(val || "") ? val : "#9b2318"; t.value = val || "";
    c.oninput = () => { t.value = c.value; set(c.value); markDirty(); };
    t.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(t.value)) c.value = t.value; set(t.value || undefined); markDirty(); };
    return h("div", { style: "display:flex;gap:8px;align-items:center" }, c, t);
  }
  if (w === "datetime") {
    const d = h("input", { type: "date", style: "max-width:200px" }); d.value = String(val || "").slice(0, 10);
    d.onchange = () => { set(d.value); markDirty(); };
    return d;
  }
  if (w === "number") {
    const n = h("input", { type: "number" }); n.value = val ?? ""; n.oninput = () => { set(n.value === "" ? undefined : +n.value); markDirty(); }; return n;
  }
  if (w === "text" || w === "markdown") {
    const t = h("textarea", { class: w === "markdown" ? "md" : "" }); t.value = val ?? "";
    t.oninput = () => { set(t.value); markDirty(); }; return t;
  }
  if (w === "list") { // elenco di frasi: una per riga
    const t = h("textarea", { placeholder: "Una per riga" }); t.value = (Array.isArray(val) ? val : []).join("\n");
    t.oninput = () => { set(t.value.split("\n").map(x => x.trim()).filter(Boolean)); markDirty(); }; return t;
  }
  const i = h("input"); i.value = val ?? ""; i.oninput = () => { set(i.value); markDirty(); }; return i;
}

/* una foto (o un video) */
function onePic(f, val, set) {
  const box = h("div", { class: "one-pic" });
  const isVid = f.widget === "file";
  const draw = v => {
    box.innerHTML = "";
    if (v) {
      const media = /\.(mp4|webm|mov)(\?|$)/i.test(v) ? h("video", { src: imgUrl(v), muted: "", playsinline: "" }) : h("img", { src: imgUrl(v), alt: "" });
      box.append(h("div", { class: "pic" }, media, h("div", { class: "pb" },
        h("button", { type: "button", title: "Cambia", onclick: async e => withUpload(e.currentTarget, await pickFiles(isVid ? "video/*" : "image/*"), u => { set(u); draw(u); markDirty(); }) }, "🔄"),
        h("button", { type: "button", title: "Togli", onclick: () => { set(undefined); draw(""); markDirty(); } }, "✕"))));
    } else {
      const a = h("div", { class: "addpic", onclick: async () => withUpload(a, await pickFiles(isVid ? "video/*" : "image/*"), u => { set(u); draw(u); markDirty(); }) }, isVid ? "🎬 Carica video" : "📷 Carica foto");
      box.append(a);
    }
  };
  draw(val);
  return box;
}
/* più foto, in ordine */
function manyPics(f, arr, set) {
  const box = h("div", { class: "pics" });
  const list = Array.isArray(arr) ? arr.slice() : [];
  const draw = () => {
    box.innerHTML = "";
    list.forEach((u, i) => box.append(h("div", { class: "pic" }, h("img", { src: imgUrl(u), alt: "", loading: "lazy" }), h("div", { class: "pb" },
      i ? h("button", { type: "button", title: "Sposta prima", onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; set(list.slice()); draw(); markDirty(); } }, "◀") : null,
      h("button", { type: "button", title: "Togli", onclick: () => { list.splice(i, 1); set(list.slice()); draw(); markDirty(); } }, "✕")))));
    const a = h("div", { class: "addpic", onclick: async () => withUpload(a, await pickFiles("image/*", true), u => { list.push(u); set(list.slice()); draw(); markDirty(); }) }, "＋ Aggiungi foto");
    box.append(a);
  };
  draw();
  return box;
}

/* testo in 5 lingue: l'italiano sempre visibile, le altre si aprono; 🌍 Traduci le scrive da sole */
let TR = [];   // i blocchi in 5 lingue del modulo aperto
const toText = (w, v) => w === "list" ? (Array.isArray(v) ? v.join("\n") : "") : String(v ?? "");
const fromText = (w, t) => w === "list" ? t.split("\n").map(x => x.trim()).filter(Boolean) : t;
function setField(el, w, v) { const i = el.querySelector("input,textarea") || el; i.value = w === "list" ? v.join("\n") : v; }
async function translateTexts(texts, to) {
  const j = await sb.call({ a: "translate", texts, to, from: "it" });
  if (j.error) throw new Error(j.error.message);
  return j.data || {};
}
function langBlock(f, obj, set) {
  obj = obj && typeof obj === "object" ? obj : {};
  const sub = Object.fromEntries(f.fields.map(x => [x.name, x]));
  const els = {};
  const row = l => { const w = (sub[l] || {}).widget || "string"; const el = input(sub[l] || { widget: "string" }, obj[l], v => { obj[l] = v; set(obj); upd(); });
    els[l] = el; return h("div", { class: "lrow" }, h("b", {}, ED_FLAG[l]), el); };
  const others = ED_LANGS.filter(l => l !== "it" && sub[l]);
  const sum = h("summary", {});
  const upd = () => { const n = others.filter(l => obj[l] && toText(sub[l].widget, obj[l]).trim()).length; sum.textContent = `🌍 Altre lingue (${n}/${others.length} scritte)`; };
  const block = { obj, sub, els, others, set, upd };
  TR.push(block);
  const btn = h("button", { type: "button", class: "trbtn", title: "Traduci dall'italiano in tutte le altre lingue" }, "🌍 Traduci");
  btn.onclick = async () => {
    const src = toText(sub.it.widget, obj.it).trim(); if (!src) return alert("Scrivi prima il testo in italiano.");
    const filled = others.filter(l => toText(sub[l].widget, obj[l]).trim());
    if (filled.length && !confirm("Le altre lingue hanno già un testo: vuoi sostituirlo con la traduzione nuova?")) return;
    btn.disabled = true; btn.textContent = "⏳ Traduco…";
    try { const r = await translateTexts([src], others); others.forEach(l => { if (r[l]) { obj[l] = fromText(sub[l].widget, r[l][0]); setField(els[l], sub[l].widget, obj[l]); } }); set(obj); upd(); markDirty(); det.open = true; }
    catch (e) { alert(e.message); }
    btn.disabled = false; btn.textContent = "🌍 Traduci";
  };
  upd();
  const det = others.length ? h("details", { class: "more" }, sum, others.map(row)) : null;
  return h("div", {}, h("div", { class: "lit" }, row("it"), others.length ? btn : null), det);
}
/* 🌍 traduce tutto quello che manca nel modulo aperto (solo le lingue vuote) */
async function translateMissing(btn) {
  const jobs = {};   // lingua → [{block, text}]
  TR.forEach(b => { const src = toText(b.sub.it.widget, b.obj.it).trim(); if (!src) return;
    b.others.forEach(l => { if (!toText(b.sub[l].widget, b.obj[l]).trim()) (jobs[l] = jobs[l] || []).push({ b, src }); }); });
  const langs = Object.keys(jobs); if (!langs.length) return alert("Non manca niente: tutte le lingue sono già scritte ✅");
  const n = langs.reduce((a, l) => a + jobs[l].length, 0);
  if (!confirm(`Traduco ${n} testi mancanti nelle altre lingue?`)) return;
  btn.disabled = true; const old = btn.textContent; btn.textContent = "⏳ Traduco…";
  try {
    for (const l of langs) {
      const r = await translateTexts(jobs[l].map(x => x.src), [l]);
      jobs[l].forEach((x, i) => { const w = x.b.sub[l].widget; x.b.obj[l] = fromText(w, r[l][i]); if (x.b.els[l]) setField(x.b.els[l], w, x.b.obj[l]); x.b.set(x.b.obj); x.b.upd(); });
    }
    markDirty(); show($("#edMsg"), "✅ Tradotto! Controlla e premi 💾 Salva.", "ok");
  } catch (e) { alert(e.message); }
  btn.disabled = false; btn.textContent = old;
}

/* qualsiasi campo dello schema */
function field(f, get, set, opts = {}) {
  const w = f.widget || "string", wrap = h("div", { class: opts.flat ? "" : "fx" });
  const label = () => h("label", { class: "fl" }, cleanLabel(f.label) + (f.hint && /una per riga/i.test(f.label) ? "" : ""));
  if (w === "boolean") { A(wrap, input(f, get(), set), hintEl(f)); return wrap; }
  if (w === "hidden") return h("span");
  if (isLangObj(f)) { A(wrap, label(), hintEl(f), langBlock(f, get(), set)); return wrap; }
  if (w === "image" || w === "file") { A(wrap, label(), hintEl(f), onePic(f, get(), set)); return wrap; }
  if (w === "object") {
    const o = get() && typeof get() === "object" ? get() : {}; set(o);
    const kids = f.fields.map(x => field(x, () => o[x.name], v => { if (v === undefined) delete o[x.name]; else o[x.name] = v; }, { flat: false }));
    const body = h("div", { class: "sub" }, kids);
    if (f.collapsed) A(wrap, h("details", { class: "more" }, h("summary", {}, cleanLabel(f.label)), hintEl(f), body));
    else A(wrap, label(), hintEl(f), body);
    return wrap;
  }
  if (w === "list" && f.field && (f.field.widget === "image")) { A(wrap, label(), hintEl(f), manyPics(f, get(), set)); return wrap; }
  if (w === "list" && (f.fields || f.field)) { A(wrap, label(), hintEl(f), itemList(f, get, set, opts)); return wrap; }
  if (f.must) {
    const warn = h("div", { class: "need" }, "⚠️ Manca il " + f.name.toUpperCase() + ": senza questo codice la struttura non va online.");
    const upd = v => { warn.style.display = String(v || "").trim() ? "none" : ""; wrap.classList.toggle("bad", !String(v || "").trim()); };
    A(wrap, label(), hintEl(f), input(f, get(), v => { set(v); upd(v); }), warn); upd(get());
    return wrap;
  }
  A(wrap, label(), hintEl(f), input(f, get(), set));
  return wrap;
}

/* elenco di schede (case, escursioni, servizi, social…) */
function itemTitle(it) {
  const t = it.title || it.cap || it.label || it.name;
  return (t && typeof t === "object" ? t.it || Object.values(t).find(Boolean) : t) || it.place || it.url || it.youtube || "(senza nome)";
}
function itemList(f, get, set, opts) {
  const single = !f.fields && f.field;
  let list = Array.isArray(get()) ? get() : []; set(list);
  const box = h("div");
  const draw = (openIdx = -1) => {
    box.innerHTML = "";
    if (!single && list.length > 3) { const top = h("button", { type: "button", class: "btn btn-red btn-sm", style: "margin-bottom:10px" }, "＋ Aggiungi " + (f.label_singular || "elemento").toLowerCase());
      top.onclick = () => { const nu = {}; f.fields.forEach(x => { if (x.default !== undefined) nu[x.name] = x.default; }); list.unshift(nu); markDirty(); draw(0); box.querySelector("details.item").scrollIntoView({ behavior: "smooth", block: "start" }); };
      box.append(top); }
    list.forEach((it, i) => {
      const del = h("button", { type: "button", class: "ibtn danger", title: "Elimina" }, "🗑");
      del.onclick = e => { e.preventDefault(); if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "Sicura?"; del.style.width = "auto"; setTimeout(() => { del.classList.remove("armed"); del.textContent = "🗑"; del.style.width = ""; }, 3000); return; }
        list.splice(i, 1); markDirty(); draw(); };
      const up = h("button", { type: "button", class: "ibtn", title: "Sposta su", onclick: e => { e.preventDefault(); if (i) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; markDirty(); draw(i - 1); } } }, "↑");
      const dn = h("button", { type: "button", class: "ibtn", title: "Sposta giù", onclick: e => { e.preventDefault(); if (i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; markDirty(); draw(i + 1); } } }, "↓");
      if (single) {
        box.append(h("div", { style: "display:flex;gap:6px;align-items:center;margin-bottom:6px" },
          h("div", { style: "flex:1" }, input(f.field, it, v => { list[i] = v; })), up, dn, del));
        return;
      }
      const img = it.img || (it.photos || [])[0];
      const sum = h("summary", {}, img ? h("img", { src: imgUrl(img), alt: "", loading: "lazy" }) : null, h("span", { class: "t" }, itemTitle(it)),
        it.visible === false ? h("span", { class: "off" }, "nascosto") : null, up, dn, del);
      const body = h("div", { class: "ib" });
      const d = h("details", { class: "item" }, sum, body);
      let built = false;
      d.ontoggle = () => { if (d.open && !built) { built = true; f.fields.forEach(x => body.append(field(x, () => it[x.name], v => { if (v === undefined) delete it[x.name]; else it[x.name] = v; sum.querySelector(".t").textContent = itemTitle(it); }))); } };
      if (i === openIdx) d.open = true;
      box.append(d);
    });
    const add = h("button", { type: "button", class: "btn btn-line btn-sm", style: "margin-top:4px" }, "＋ Aggiungi " + (f.label_singular || "elemento").toLowerCase());
    add.onclick = () => {
      let nu = single ? "" : {};
      if (!single) f.fields.forEach(x => { if (x.default !== undefined) nu[x.name] = x.default; });
      list.push(nu); markDirty(); draw(list.length - 1);
      const last = box.querySelectorAll("details.item"); if (last.length) last[last.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
    };
    box.append(add);
  };
  draw();
  return box;
}

/* Testi del sito: ogni frase con le sue 5 lingue, con ricerca */
function textsForm(f, data) {
  const byLang = Object.fromEntries(f.fields.map(x => [x.name, x]));
  const keys = byLang.it.fields;
  const search = h("input", { placeholder: "🔍 Cerca una frase (es. «escursioni», «prezzo»)…", style: "margin-bottom:14px" });
  const box = h("div");
  ED_LANGS.forEach(l => { data[l] = data[l] || {}; });
  const rows = keys.map(k => {
    const lab = String(k.label || k.name).replace(/^\S+\s+—\s+/, "");
    const w = (data.it[k.name] || "").length > 90 ? "text" : "string";
    const obj = {}; ED_LANGS.forEach(l => obj[l] = data[l][k.name]);
    const fake = { fields: ED_LANGS.map(l => ({ name: l, widget: w })) };
    const blk = langBlock(fake, obj, o => { ED_LANGS.forEach(l => { data[l][k.name] = o[l]; }); });
    const el = h("div", { class: "fx" }, h("label", { class: "fl" }, lab), blk);
    el.dataset.q = (lab + " " + ED_LANGS.map(l => data[l][k.name] || "").join(" ")).toLowerCase();
    return el;
  });
  search.oninput = () => { const q = search.value.trim().toLowerCase(); rows.forEach(r => r.style.display = !q || r.dataset.q.includes(q) ? "" : "none"); };
  // le frasi che non compaiono sul sito stanno in fondo, chiuse (così non si modifica la frase sbagliata)
  const used = new Set(TEXTS_USED || keys.map(k => k.name));
  const live = rows.filter((r, i) => used.has(keys[i].name)), dead = rows.filter((r, i) => !used.has(keys[i].name));
  box.append(search, ...live);
  if (dead.length) box.append(h("details", { class: "more", style: "margin-top:16px" }, h("summary", {}, `Frasi che oggi non compaiono sul sito (${dead.length})`), dead));
  return box;
}

/* ---------- apri / salva una sezione ---------- */
let TEXTS_USED = null;
window.openEditor = async function (key) {
  if (key === "texts" && !TEXTS_USED) TEXTS_USED = await fetch("/assets/texts-used.json?v=" + Date.now()).then(r => r.json()).catch(() => null);
  if (!ED_KEYS.includes(key)) { location.hash = "home"; return; }
  if (ED.key === key && $("#edForm").childElementCount) return;
  const s = await schema(), def = s.files[key];
  $("#paneTitle").textContent = cleanLabel(def.label) || "Il sito";
  $("#edDesc").innerHTML = (def.description ? esc(def.description) + "<br>" : "") + "Quando hai finito premi <b>💾 Salva</b>: le modifiche sono subito sul sito.";
  $("#edForm").innerHTML = '<p class="muted">⏳ Carico…</p>'; $("#edMsg").className = "msg";
  let d;
  try { d = clone(await loadKey(key)); }
  catch (e) { $("#edForm").innerHTML = ""; return show($("#edMsg"), "Errore: " + e.message, "err"); }
  ED = { key, data: d, dirty: false };
  const form = $("#edForm"); form.innerHTML = ""; TR = [];
  const trAll = h("button", { type: "button", class: "btn btn-line btn-sm", style: "margin-bottom:14px" }, "🌍 Traduci tutto quello che manca");
  trAll.onclick = () => translateMissing(trAll);
  form.append(trAll);
  if (key === "texts") form.append(textsForm(def.fields ? { fields: def.fields } : {}, d));
  else def.fields.forEach(f => form.append(field(f, () => d[f.name], v => { if (v === undefined) delete d[f.name]; else d[f.name] = v; })));
  $("#edSave").disabled = false;
};
/* case, hotel e B&B visibili devono avere CIN e CIR */
function checkCodes(key, d) {
  if (!["houses", "hotels"].includes(key)) return [];
  const out = [];
  (d.items || []).forEach((it, i) => {
    if (it.visible === false) return;
    const what = ["cin", "cir"].filter(f => !String(it[f] || "").trim()).map(f => f.toUpperCase());
    if (what.length) out.push({ i, name: itemTitle(it), what: what.join(" e ") });
  });
  return out;
}
function ensureIds(key, d) {
  if (!["houses", "hotels", "excursions"].includes(key) || !Array.isArray(d.items)) return;
  const used = new Set();
  ["houses", "hotels", "excursions"].filter(k => k !== key && edCache[k]).forEach(k => (edCache[k].items || []).forEach(x => x.id && used.add(x.id)));
  d.items.forEach(x => { if (x.id) { if (used.has(x.id)) x.id = ""; else used.add(x.id); } });
  d.items.forEach(x => {
    if (x.id) return;
    let base = slugify(x.title && (x.title.it || Object.values(x.title)[0]) || "nuovo"), s = base, n = 2;
    while (used.has(s)) s = base + "-" + n++;
    used.add(s); x.id = s;
  });
}
$("#edSave").onclick = async () => {
  if (!ED.key) return;
  const btn = $("#edSave"); btn.disabled = true; btn.textContent = "⏳ Salvo…";
  const missing = checkCodes(ED.key, ED.data);
  if (missing.length) {
    btn.disabled = false; btn.textContent = "💾 Salva";
    $("#edMsg").innerHTML = "⛔ <b>Non salvato.</b> " + missing.map(m => "Manca <b>" + m.what + "</b> in «" + esc(m.name) + "»").join("; ") + ". Inseriscili, oppure spegni «Visibile sul sito» finché non li hai.";
    $("#edMsg").className = "msg show err";
    const items = [...$("#edForm").querySelectorAll("details.item")];
    missing.forEach(m => { const d = items[m.i]; if (d) { d.open = true; d.classList.add("bad"); } });
    const first = items[missing[0].i]; if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  try {
    ensureIds(ED.key, ED.data);
    await saveKey(ED.key, ED.data);
    ED.dirty = false;
    show($("#edMsg"), "✅ Salvato! È già sul sito.", "ok");
  } catch (e) { show($("#edMsg"), "Non salvato: " + e.message, "err"); }
  btn.disabled = false; btn.textContent = "💾 Salva";
};
window.edLeave = function (to) {
  if (to === curRoute) return true;
  const fromEd = String(curRoute).startsWith("edit/"), fromBl = String(curRoute).startsWith("blog/");
  if (((fromEd && ED.dirty) || (fromBl && BL.dirty)) && !confirm("Hai modifiche non salvate. Vuoi uscire senza salvare?")) return false;
  if (fromEd) { ED.dirty = false; ED.key = null; $("#edForm").innerHTML = ""; }
  if (fromBl) BL.dirty = false;
  return true;
};
window.addEventListener("beforeunload", e => { if (ED.dirty || BL.dirty) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- 📝 Blog ---------- */
let BL = { posts: null, cur: null, isNew: false, dirty: false };
const LFLAG = { it: "🇮🇹", de: "🇩🇪", en: "🇬🇧", pl: "🇵🇱", es: "🇪🇸" };
const isDraft = d => d === true || d === "true" || d === "True";
async function loadPosts(force) {
  if (BL.posts && !force) return BL.posts;
  const { data, error } = await sb.from("site_posts").select("slug,data,updated_at");
  if (error) throw error;
  BL.posts = (data || []).sort((a, b) => String(b.data.date || "").localeCompare(String(a.data.date || "")));
  return BL.posts;
}
function renderPostList() {
  const l = $("#blLang").value, q = $("#blSearch").value.trim().toLowerCase();
  const items = (BL.posts || []).filter(p => (!l || p.data.lang === l) && (!q || (p.data.title + " " + (p.data.keyword || "")).toLowerCase().includes(q)));
  $("#blItems").innerHTML = items.length ? items.map(p => `<a class="hcard" href="#blog/${esc(p.slug)}" style="margin-bottom:8px">
    ${p.data.cover ? `<img src="${esc(imgUrl(p.data.cover))}" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:10px;flex:none">` : "<b>📝</b>"}
    <div style="min-width:0"><strong>${LFLAG[p.data.lang] || ""} ${esc(p.data.title || p.slug)}</strong><span>${esc(String(p.data.date || "").slice(0, 10))} · ${esc(p.data.category || "")}${isDraft(p.data.draft) ? " · <b style='color:var(--red)'>bozza</b>" : ""}</span></div><i>›</i></a>`).join("")
    : '<p class="muted">Nessun articolo.</p>';
}
$("#blLang").onchange = renderPostList; $("#blSearch").oninput = renderPostList;
$("#blNew").onclick = () => { location.hash = "blog/nuovo"; };
function counter(inp, min, max) {
  const c = h("span", { class: "cnt" });
  const upd = () => { const n = inp.value.length; c.textContent = n + " caratteri (ideale " + min + "–" + max + ")"; c.className = "cnt " + (n >= min && n <= max ? "ok" : n ? "bad" : ""); };
  inp.addEventListener("input", upd); upd(); return c;
}
window.openBlog = async function (slug) {
  $("#blList").classList.toggle("hidden", !!slug); $("#blEdit").classList.toggle("hidden", !slug);
  try { await loadPosts(); } catch (e) { $("#blItems").innerHTML = `<div class="msg show err">Errore: ${esc(e.message)}</div>`; return; }
  if (!slug) { renderPostList(); BL.cur = null; return; }
  $("#backBtn").setAttribute("href", "#blog");
  const s = await schema();
  const found = BL.posts.find(p => p.slug === slug);
  BL.isNew = !found;
  const d = found ? clone(found.data) : { lang: "it", date: new Date().toISOString().slice(0, 10), draft: false };
  BL.cur = { slug: found ? slug : "", data: d }; BL.dirty = false;
  $("#paneTitle").textContent = found ? "📝 Modifica articolo" : "📝 Nuovo articolo";
  const form = $("#blForm"); form.innerHTML = "";
  if (found) form.append(h("p", { class: "muted", style: "margin-bottom:12px" }, "Indirizzo: ", h("a", { href: "/blog/" + slug + ".html", target: "_blank" }, "wloskizdominika.com/blog/" + slug + ".html")));
  s.blog.fields.forEach(f => {
    const el = field(f, () => d[f.name], v => { if (v === undefined) delete d[f.name]; else d[f.name] = v; BL.dirty = true; });
    const inp = el.querySelector("input,textarea");
    if (f.name === "title" && inp) el.querySelector(".fl").append(counter(inp, 30, 60));
    if (f.name === "description" && inp) el.querySelector(".fl").append(counter(inp, 120, 155));
    if (f.name === "draft") { const t = el.querySelector(".tog span"); if (t) t.textContent = "Bozza (non si vede sul sito)"; }
    form.append(el);
  });
  $("#blDel").classList.toggle("hidden", BL.isNew); $("#blMsg").className = "msg";
};
$("#blSave").onclick = async () => {
  const c = BL.cur; if (!c) return;
  if (!String(c.data.title || "").trim()) return show($("#blMsg"), "Scrivi il titolo.", "err");
  const btn = $("#blSave"); btn.disabled = true; btn.textContent = "⏳ Salvo…";
  try {
    if (!c.slug) {
      let base = slugify(c.data.title), s = base, n = 2; const used = new Set(BL.posts.map(p => p.slug));
      while (used.has(s)) s = base + "-" + n++;
      c.slug = s; if (!c.data.group) c.data.group = s;
    }
    const { error } = await sb.from("site_posts").upsert({ slug: c.slug, data: c.data, updated_at: new Date().toISOString() }, { onConflict: "slug" });
    if (error) throw error;
    await loadPosts(true); BL.dirty = false;
    show($("#blMsg"), isDraft(c.data.draft) ? "✅ Salvato come bozza (non visibile sul sito)." : "✅ Salvato! È già sul sito.", "ok");
    if (BL.isNew) { BL.isNew = false; history.replaceState(null, "", "#blog/" + c.slug); curRoute = "blog/" + c.slug; $("#blDel").classList.remove("hidden"); }
  } catch (e) { show($("#blMsg"), "Non salvato: " + e.message, "err"); }
  btn.disabled = false; btn.textContent = "💾 Salva";
};
$("#blDel").onclick = async () => {
  const b = $("#blDel"), c = BL.cur; if (!c || !c.slug) return;
  if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "Sicura? Tocca di nuovo"; setTimeout(() => { b.classList.remove("armed"); b.textContent = "🗑 Elimina"; }, 3500); return; }
  const { error } = await sb.from("site_posts").delete().eq("slug", c.slug);
  if (error) return show($("#blMsg"), "Errore: " + error.message, "err");
  BL.dirty = false; await loadPosts(true); location.hash = "blog";
};

/* se l'app era già aperta prima che questo file fosse pronto */
if (!$("#app").classList.contains("hidden")) { window.seedSite(); const r = location.hash.slice(1); if (/^(edit|blog)/.test(r)) { curRoute = "home"; openTab(r); } }

/* 🌍 blog: crea le versioni dell'articolo nelle altre lingue (come bozze da controllare) */
$("#blTr").onclick = async () => {
  const c = BL.cur; if (!c || !c.slug) return alert("Salva prima l'articolo.");
  if (BL.dirty) return alert("Salva prima le modifiche.");
  const src = c.data.lang || "it", group = c.data.group || c.slug;
  const have = new Set(BL.posts.filter(p => (p.data.group || p.slug) === group).map(p => p.data.lang));
  const to = ED_LANGS.filter(l => l !== src && !have.has(l));
  if (!to.length) return alert("Questo articolo c'è già in tutte le lingue ✅");
  if (!confirm("Creo l'articolo tradotto in: " + to.map(l => ED_FLAG[l]).join(", ") + "?\nLe versioni nuove restano in bozza: le controlli e poi le pubblichi.")) return;
  const F = ["title", "seo_title", "description", "cover_alt", "keyword", "body"].filter(k => String(c.data[k] || "").trim());
  const btn = $("#blTr"); btn.disabled = true; btn.textContent = "⏳ Traduco…";
  try {
    const j = await sb.call({ a: "translate", texts: F.map(k => String(c.data[k])), to, from: src });
    if (j.error) throw new Error(j.error.message);
    if (!c.data.group) { c.data.group = group; await sb.from("site_posts").update({ data: c.data }).eq("slug", c.slug); }
    const used = new Set(BL.posts.map(p => p.slug));
    for (const l of to) {
      const d = Object.assign({}, c.data, { lang: l, group, draft: true });
      F.forEach((k, i) => { d[k] = j.data[l][i]; });
      let base = slugify(d.title) || (c.slug + "-" + l), s2 = base, n = 2; while (used.has(s2)) s2 = base + "-" + n++; used.add(s2);
      const { error } = await sb.from("site_posts").upsert({ slug: s2, data: d, updated_at: new Date().toISOString() }, { onConflict: "slug" });
      if (error) throw new Error(error.message);
    }
    await loadPosts(true);
    show($("#blMsg"), "✅ Create " + to.length + " traduzioni in bozza: le trovi nell'elenco, controllale e pubblicale.", "ok");
  } catch (e) { alert(e.message); }
  btn.disabled = false; btn.textContent = "🌍 Crea le altre lingue";
};
