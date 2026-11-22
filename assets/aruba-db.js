/* =====================================================================
   Collegamento dell'app al "motore" su Aruba (/api/db.php).
   Offre gli stessi comandi che l'app usava prima (sb.from(...).select()…),
   così tutto funziona uguale, ma i dati restano su Aruba.
   ===================================================================== */
(function () {
  const API = "/api/db.php";
  async function call(body) {
    try {
      const r = await fetch(API, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({ data: null, error: { message: "Risposta non valida dal server (" + r.status + ")" } }));
      return j;
    } catch (e) { return { data: null, error: { message: "Connessione non riuscita: controlla internet e riprova." } }; }
  }

  class Query {
    constructor(table) { this.t = table; this.op = "select"; this.sel = "*"; this.f = []; this.o = []; this.lim = null; this.one = 0; this.head = false; this.vals = null; this.opts = {}; this.ret = false; }
    select(cols, o) { if (this.op !== "select") this.ret = true; else this.sel = cols || "*"; if (o && o.head) this.head = true; return this; }
    insert(v) { this.op = "insert"; this.vals = v; return this; }
    upsert(v, o) { this.op = "upsert"; this.vals = v; this.opts = o || {}; return this; }
    update(v) { this.op = "update"; this.vals = v; return this; }
    delete() { this.op = "delete"; return this; }
    eq(c, v) { this.f.push([c, "eq", v]); return this; }
    neq(c, v) { this.f.push([c, "neq", v]); return this; }
    gt(c, v) { this.f.push([c, "gt", v]); return this; }
    gte(c, v) { this.f.push([c, "gte", v]); return this; }
    lt(c, v) { this.f.push([c, "lt", v]); return this; }
    lte(c, v) { this.f.push([c, "lte", v]); return this; }
    in(c, v) { this.f.push([c, "in", v]); return this; }
    is(c, v) { this.f.push([c, "is", v]); return this; }
    order(c, o) { o = o || {}; const asc = o.ascending !== false; this.o.push([c, asc, o.nullsFirst === undefined ? !asc : !!o.nullsFirst]); return this; }
    limit(n) { this.lim = n; return this; }
    single() { this.one = 1; return this; }
    maybeSingle() { this.one = 2; return this; }
    async run() {
      const j = await call({ a: "db", table: this.t, op: this.op, select: this.sel, filters: this.f, order: this.o, limit: this.lim, head: this.head,
        values: this.vals, ignoreDuplicates: !!this.opts.ignoreDuplicates, returning: this.ret });
      if (j.error) return { data: null, error: j.error, count: null };
      let data = j.data;
      if (this.one && Array.isArray(data)) {
        if (this.one === 1 && data.length !== 1) return { data: null, error: { message: "Nessun risultato" }, count: j.count };
        data = data[0] || null;
      }
      return { data, error: null, count: j.count ?? null };
    }
    then(res, rej) { return this.run().then(res, rej); }
  }

  const listeners = [];
  let current = null;
  const emit = (ev, s) => listeners.forEach(fn => { try { fn(ev, s); } catch (_) {} });

  const auth = {
    async getSession() { const j = await call({ a: "session" }); current = j.data?.session || null; return { data: { session: current, setup: !!j.data?.setup }, error: j.error || null }; },
    async signInWithPassword({ email, password }) {
      const j = await call({ a: "login", email, password });
      if (j.error) return { data: {}, error: j.error };
      current = j.data.session; emit("SIGNED_IN", current); return { data: { session: current, user: current.user }, error: null };
    },
    async signUp({ email, password, options }) {
      const j = await call({ a: "signup", email, password, data: (options && options.data) || {} });
      if (j.error) return { data: {}, error: j.error };
      current = j.data.session; emit("SIGNED_IN", current); return { data: { session: current, user: current.user }, error: null };
    },
    async signOut() { await call({ a: "logout" }); current = null; emit("SIGNED_OUT", null); return { error: null }; },
    async resetPasswordForEmail(email, o) {
      let back = "/area.html"; try { back = new URL((o && o.redirectTo) || "/area.html", location.origin).pathname; } catch (_) {}
      const j = await call({ a: "reset_request", email, redirect: back }); return { data: {}, error: j.error || null };
    },
    async updateUser({ password }) { const j = await call({ a: "update_password", password }); return { data: j.data, error: j.error || null }; },
    onAuthStateChange(fn) {
      listeners.push(fn);
      (async () => {
        const tok = new URLSearchParams(location.search).get("reset");
        if (tok) {
          history.replaceState(null, "", location.pathname + location.hash);
          const j = await call({ a: "reset_login", token: tok });
          if (j.error) { fn("SIGNED_OUT", null); alert(j.error.message); return; }
          current = j.data.session; fn("PASSWORD_RECOVERY", current); return;
        }
        const { data } = await auth.getSession(); fn("INITIAL_SESSION", data.session);
      })();
      return { data: { subscription: { unsubscribe() { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); } } } };
    },
    async setup({ code, email, password }) { const j = await call({ a: "setup", code, email, password }); if (!j.error) current = j.data.session; return { data: j.data, error: j.error || null }; }
  };

  function bucket(b) {
    return {
      async upload(path, file) {
        const fd = new FormData(); fd.append("a", "upload"); fd.append("bucket", b); fd.append("path", path); fd.append("file", file);
        try {
          const r = await fetch(API, { method: "POST", credentials: "same-origin", body: fd });
          const j = await r.json().catch(() => ({ error: { message: r.status === 413 ? "File troppo grande per l'hosting." : "Caricamento non riuscito (" + r.status + ")" } }));
          return { data: j.data || null, error: j.error || null };
        } catch (e) { return { data: null, error: { message: "Connessione non riuscita." } }; }
      },
      getPublicUrl(path) { return { data: { publicUrl: location.origin + "/media/up/" + String(path).split("/").map(encodeURIComponent).join("/") } }; },
      async createSignedUrl(path, expires) { const j = await call({ a: "signed", bucket: b, path, expires }); return { data: j.data, error: j.error || null }; },
      async remove(paths) { const j = await call({ a: "remove", bucket: b, paths }); return { data: j.data, error: j.error || null }; }
    };
  }

  const client = {
    from: t => new Query(t),
    async rpc(fn, params) { const j = await call({ a: "rpc", fn, params }); return { data: j.data, error: j.error || null }; },
    auth,
    storage: { from: bucket },
    call   // per le funzioni in più (visite, traduzioni, importazione…)
  };
  window.ArubaDB = client;
  window.supabase = { createClient: () => client };
})();
