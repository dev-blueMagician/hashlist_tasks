// Plan runner core of DOP Builder Helper. It checks a plan file and carries
// it out step by step through an io object, so the same code runs in the
// extension (runner.js) and in the local tests (test/).
//
// io = {
//   call(fn, ...args)   runs dopHelper[fn](...args) in the builder tab
//   readText(path)      text of a file, path relative to the task folder
//   readB64(path)       the same file as base64
//   listFolder(path)    [{ path, rel }] for every file below path; rel starts
//                       with the folder's own name, as "Upload a folder" sends it
//   save(name, text)    writes a page or log into the task's author folder
//   sleep(ms)
// }
const planCore = (() => {
  const DO = ["open", "fill", "click", "wait", "upload", "delete", "fill_steps", "save", "save_all", "pause"];
  const FORBIDDEN = /^(7\b|7\.\d|run\b|run the task|start (the )?run|submit|hand (it )?in|send (it )?(for|to) review|replace and copy|generate checks)/i;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const POLL = 3000;

  function validate(plan) {
    const errs = [];
    if (!plan || typeof plan !== "object") return { error: "The plan is not a JSON object." };
    if (!UUID.test(plan.builder || "")) errs.push('"builder" must be the uuid in the builder address (…/app/build/<uuid>/…)');
    if (plan.title !== undefined && typeof plan.title !== "string") errs.push('"title" must be text');
    if (!Array.isArray(plan.steps) || !plan.steps.length) errs.push('"steps" must be a list with at least one step');
    (plan.steps || []).forEach((s, i) => {
      const at = `step ${i + 1}`;
      if (!s || !DO.includes(s.do)) { errs.push(`${at}: "do" must be one of ${DO.join(", ")}`); return; }
      const need = (k) => { if (typeof s[k] !== "string" || !s[k]) errs.push(`${at} (${s.do}): "${k}" is missing`); };
      if (s.do === "open") {
        need("section");
        if (/^7(\.|$)/.test(s.section || "")) errs.push(`${at}: section 7 (Run) is never opened by a plan`);
      }
      if (s.do === "fill") {
        need("label");
        if ((s.from === undefined) === (s.text === undefined)) errs.push(`${at} (fill): give exactly one of "from" or "text"`);
      }
      if (s.do === "click") {
        need("text");
        if (FORBIDDEN.test(s.text || "")) errs.push(`${at}: clicking ${JSON.stringify(s.text)} is not allowed in a plan`);
      }
      if (s.do === "wait") need("pattern");
      if ((s.do === "click" && s.wait) || s.do === "wait") {
        const w = s.do === "wait" ? s : s.wait;
        try { new RegExp(w.pattern); if (w.busy) new RegExp(w.busy); } catch (e) { errs.push(`${at}: bad pattern: ${e.message}`); }
      }
      if (s.do === "upload" && !s.folder && !Array.isArray(s.files)) errs.push(`${at} (upload): give "folder" or "files"`);
      if (s.do === "delete" && !/^\/app\//.test(s.path || "")) errs.push(`${at} (delete): "path" must be a full path such as /app/data/docs/x.md`);
      if (s.do === "fill_steps") need("from");
      if (s.do === "pause") need("message");
    });
    return errs.length ? { error: errs.join("\n") } : { plan };
  }

  // What a step will do, in one line, for the preview and the log.
  function describe(s) {
    switch (s.do) {
      case "open": return `open section ${s.section}`;
      case "fill": return `fill "${s.label}" with ${s.from ? s.from : `${s.text.length} characters`}`;
      case "click": return `click "${s.text}"${s.wait ? `, then wait for /${s.wait.pattern}/` : ""}`;
      case "wait": return `wait for /${s.pattern}/`;
      case "upload": return s.folder ? `upload the folder ${s.folder}` : `upload ${s.files.length} file(s)`;
      case "delete": return `delete ${s.path}`;
      case "fill_steps": return `fill the 5.4 table from ${s.from}`;
      case "save": return "save this page";
      case "save_all": return "save every section (1 to 6)";
      case "pause": return `pause: ${s.message}`;
      default: return s.do;
    }
  }

  async function run(plan, io, log, hooks = {}) {
    const stopped = () => hooks.stopped && hooks.stopped();
    const names = new Set();
    const ok = (r, what) => {
      if (!r || !r.ok) throw new Error(`${what}: ${(r && r.error) || "no answer from the page"}`);
      return r;
    };

    async function savePage() {
      const page = await io.call("capture");
      let name = page.name;
      for (let k = 2; names.has(name); k++) name = page.name.replace(/\.txt$/, `-${k}.txt`);
      names.add(name);
      await io.save(name, page.text);
      log(`  saved ${name}`);
      return name;
    }

    // After a change the builder shows "Saving..." and then "Saved".
    async function settle(what) {
      for (let i = 0; i < 20; i++) {
        const p = await io.call("probe", "$^");
        if (p.saved === "Saved") return;
        if (!p.saved) { log(`  (no save indicator found after ${what}; check the page)`); return; }
        await io.sleep(1500);
      }
      throw new Error(`${what}: the page still says "${(await io.call("probe", "$^")).saved}" after 30 s`);
    }

    async function waitFor(w, before) {
      const limit = Date.now() + (w.timeout_s || 600) * 1000;
      let sawBusy = false;
      for (;;) {
        if (stopped()) throw new Error("stopped by you");
        const p = await io.call("probe", w.pattern, w.busy || "");
        if (p.busy) sawBusy = true;
        const changed = w.require_change === false || p.match !== before;
        if (p.match && changed && !p.busy) return p.match;
        if (Date.now() > limit) throw new Error(`waited ${w.timeout_s || 600} s for /${w.pattern}/${sawBusy ? " (still busy)" : ""}`);
        await io.sleep(POLL);
      }
    }

    const info = ok(await io.call("info"), "reading the page");
    if (info.builder !== plan.builder) throw new Error(`the open tab is builder ${info.builder || "(none)"}, the plan is for ${plan.builder}`);
    if (plan.title && !info.text.includes(plan.title)) throw new Error(`the page does not show the task title "${plan.title}"`);
    log(`Builder ${plan.builder}${plan.title ? `, "${plan.title}"` : ""}: found.`);

    for (let i = 0; i < plan.steps.length; i++) {
      if (stopped()) throw new Error("stopped by you");
      const s = plan.steps[i];
      log(`${i + 1}. ${describe(s)}`);
      if (s.do === "open") {
        ok(await io.call("open", s.section), `opening ${s.section}`);
      } else if (s.do === "fill") {
        const text = s.from ? await io.readText(s.from) : s.text;
        const r = ok(await io.call("fillBox", s.label, text), `filling "${s.label}"`);
        log(`  ${r.chars} characters`);
        await settle(`filling "${s.label}"`);
      } else if (s.do === "click") {
        const before = s.wait ? (await io.call("probe", s.wait.pattern, "")).match : null;
        ok(await io.call("click", s.text, { first: !!s.first }), `clicking "${s.text}"`);
        if (s.wait) log(`  done: ${await waitFor(s.wait, before)}`);
      } else if (s.do === "wait") {
        log(`  found: ${await waitFor({ ...s, require_change: false }, null)}`);
      } else if (s.do === "upload") {
        const files = s.folder
          ? await io.listFolder(s.folder)
          : s.files.map((f) => ({ path: f.from, rel: f.rel }));
        const payload = [];
        for (const f of files) payload.push({ rel: f.rel, b64: await io.readB64(f.path) });
        for (const f of payload) log(`  ${f.rel}`);
        ok(await io.call("upload", payload, s.kind || "folder"), "uploading");
        await settle("uploading");
      } else if (s.do === "delete") {
        ok(await io.call("deleteFile", s.path), `deleting ${s.path}`);
        await settle(`deleting ${s.path}`);
      } else if (s.do === "fill_steps") {
        const spec = JSON.parse(await io.readText(s.from));
        const r = await io.call("fill", spec, true);
        if (r.error) throw new Error(`filling 5.4: ${r.error}`);
        const left = (r.after || []).map((d, k) => (d.length ? `row ${k + 1}: ${d.join("; ")}` : "")).filter(Boolean);
        if (left.length) throw new Error(`5.4 rows still differ:\n${left.join("\n")}`);
        if (r.extra && r.extra.length) log(`  rows beyond the steps file: ${r.extra.join(", ")}`);
        await settle("filling 5.4");
      } else if (s.do === "save") {
        await savePage();
      } else if (s.do === "save_all") {
        const tops = ok(await io.call("sections"), "listing sections").items.filter((n) => !n.id.includes(".") && n.id !== "7");
        for (const t of tops) {
          ok(await io.call("open", t.id), `opening ${t.id}`);
          const subs = ok(await io.call("sections"), "listing sections").items.filter((n) => n.id.startsWith(t.id + "."));
          if (!subs.length) { await savePage(); continue; }
          for (const sub of subs) {
            if (stopped()) throw new Error("stopped by you");
            ok(await io.call("open", sub.id), `opening ${sub.id}`);
            await savePage();
          }
        }
      } else if (s.do === "pause") {
        if (!hooks.pause) throw new Error("this runner cannot pause");
        await hooks.pause(s.message);
      }
    }
    log("Plan finished.");
  }

  return { validate, describe, run };
})();

if (typeof module !== "undefined") module.exports = planCore;
