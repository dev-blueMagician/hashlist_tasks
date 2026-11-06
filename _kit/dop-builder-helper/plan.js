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
  const DO = ["open", "fill", "select", "click", "wait", "upload", "delete", "fill_steps", "save", "save_all", "pause"];
  const FORBIDDEN = /^(7\b|7\.\d|run\b|run the task|start (the )?run|submit|hand (it )?in|send (it )?(for|to) review|replace and copy|generate checks|save and exit|fix it)/i;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const POLL = 3000;
  const alts = (t) => (Array.isArray(t) ? t : [t]);

  function validate(plan) {
    const errs = [];
    if (!plan || typeof plan !== "object") return { error: "The plan is not a JSON object." };
    if (plan.builder === "any") {
      if (typeof plan.title !== "string" || !plan.title) errs.push('"builder": "any" needs a "title" (the task title or its task-… id) to check on the page');
    } else if (!UUID.test(plan.builder || "")) errs.push('"builder" must be the uuid in the builder address (…/app/build/<uuid>/…), or "any" with a "title"');
    if (plan.title !== undefined && typeof plan.title !== "string") errs.push('"title" must be text');
    if (plan.out !== undefined && (typeof plan.out !== "string" || !/^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*$/.test(plan.out) || plan.out.split("/").some((p) => /^\.+$/.test(p)))) {
      errs.push('"out" must be a folder name inside author/, such as "round2"');
    }
    if (!Array.isArray(plan.steps) || !plan.steps.length) errs.push('"steps" must be a list with at least one step');
    (plan.steps || []).forEach((s, i) => {
      const at = `step ${i + 1}`;
      if (!s || !DO.includes(s.do)) { errs.push(`${at}: "do" must be one of ${DO.join(", ")}`); return; }
      const need = (k) => { if (typeof s[k] !== "string" || !s[k]) errs.push(`${at} (${s.do}): "${k}" is missing`); };
      // fill and select take one label or a list of alternatives.
      const needLabels = () => { if (!alts(s.label).length || alts(s.label).some((x) => typeof x !== "string" || !x)) errs.push(`${at} (${s.do}): "label" must be text or a list of texts`); };
      if (s.do === "open") {
        need("section");
        if (/^7(\.|$)/.test(s.section || "")) errs.push(`${at}: section 7 (Run) is never opened by a plan`);
      }
      if (s.do === "fill") {
        needLabels();
        if ((s.from === undefined) === (s.text === undefined)) errs.push(`${at} (fill): give exactly one of "from" or "text"`);
      }
      if (s.do === "select") { needLabels(); need("option"); }
      if (s.html !== undefined && (typeof s.html !== "boolean" || !["save", "save_all"].includes(s.do))) errs.push(`${at}: "html" is true or false, on save and save_all only`);
      if (s.do === "click") {
        const t = s.text !== undefined ? s.text : s.label;
        if ((s.text === undefined) === (s.label === undefined)) errs.push(`${at} (click): give exactly one of "text" or "label"`);
        else if (!alts(t).length || alts(t).some((x) => typeof x !== "string" || !x)) errs.push(`${at} (click): "${s.text !== undefined ? "text" : "label"}" must be text or a list of texts`);
        else for (const x of alts(t)) if (FORBIDDEN.test(x) || /^remove verifier\/(dockerfile|report\.py)$/i.test(x)) errs.push(`${at}: clicking ${JSON.stringify(x)} is not allowed in a plan`);
      }
      if (s.optional !== undefined && typeof s.optional !== "boolean") errs.push(`${at}: "optional" must be true or false`);
      if (s.do === "wait") need("pattern");
      if ((s.do === "click" && s.wait) || s.do === "wait") {
        const w = s.do === "wait" ? s : s.wait;
        try { new RegExp(w.pattern); if (w.busy) new RegExp(w.busy); } catch (e) { errs.push(`${at}: bad pattern: ${e.message}`); }
      }
      if (s.do === "upload") {
        if (!s.folder === !Array.isArray(s.files)) errs.push(`${at} (upload): give exactly one of "folder" or "files"`);
        if (s.kind !== undefined && !["folder", "files"].includes(s.kind)) errs.push(`${at} (upload): "kind" must be "folder" or "files"`);
        if (Array.isArray(s.files) && s.files.some((f) => !f || typeof f.from !== "string" || typeof f.rel !== "string")) errs.push(`${at} (upload): each of "files" needs "from" and "rel"`);
        if (s.near !== undefined && (typeof s.near !== "string" || !s.near)) errs.push(`${at} (upload): "near" must be a button's text or label`);
      }
      if (s.do === "delete" && !/^\/app\//.test(s.path || "")) errs.push(`${at} (delete): "path" must be a full path such as /app/data/docs/x.md`);
      if (s.do === "fill_steps") need("from");
      if (s.do === "pause") need("message");
    });
    return errs.length ? { error: errs.join("\n") } : { plan };
  }

  // What a step will do, in one line, for the preview and the log.
  function describe(s) {
    const labels = () => alts(s.label).map((x) => `"${x}"`).join(" or ");
    const html = s.html ? ", with HTML" : "";
    switch (s.do) {
      case "open": return `open section ${s.section}`;
      case "fill": return `fill ${labels()} with ${s.from ? s.from : `${s.text.length} characters`}`;
      case "select": return `choose "${s.option}" in ${labels()}`;
      case "click": return `click ${s.label !== undefined ? "the button labelled " : ""}${alts(s.text !== undefined ? s.text : s.label).map((x) => `"${x}"`).join(" or ")}${s.wait ? `, then wait for /${s.wait.pattern}/` : ""}`;
      case "wait": return `wait for /${s.pattern}/`;
      case "upload": return `${s.folder ? `upload the folder ${s.folder}` : `upload ${s.files.length} file(s)`}${s.near ? ` with the input next to "${s.near}"` : ""}`;
      case "delete": return `delete ${s.path}`;
      case "fill_steps": return `fill the 5.4 table from ${s.from}`;
      case "save": return `save this page${html}`;
      case "save_all": return `save every section (1 to 6)${html}`;
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

    // html also saves the page as HTML under the same name (.html), for
    // testing page.js against the real screen.
    async function savePage(html) {
      const page = await io.call("capture");
      let name = page.name;
      for (let k = 2; names.has(name); k++) name = page.name.replace(/\.txt$/, `-${k}.txt`);
      names.add(name);
      await io.save(name, page.text);
      log(`  saved ${name}`);
      if (html) {
        const h = await io.call("snapshot");
        const hn = name.replace(/\.txt$/, ".html");
        await io.save(hn, h.html);
        log(`  saved ${hn}`);
      }
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

    // Done when the pattern matches, busy no longer does, and either the match
    // differs from the one before the click or busy was seen in between. The
    // second case covers a result that reads the same as the last one, such as
    // "Ready to run" after "Verify again".
    async function waitFor(w, before) {
      const limit = Date.now() + (w.timeout_s || 600) * 1000;
      let sawBusy = false;
      for (;;) {
        if (stopped()) throw new Error("stopped by you");
        const p = await io.call("probe", w.pattern, w.busy || "");
        if (p.busy) sawBusy = true;
        const changed = w.require_change === false || p.match !== before || sawBusy;
        if (p.match && changed && !p.busy) return p.match;
        if (Date.now() > limit) throw new Error(`waited ${w.timeout_s || 600} s for /${w.pattern}/${sawBusy ? " (still busy)" : ""}`);
        await io.sleep(POLL);
      }
    }

    const info = ok(await io.call("info"), "reading the page");
    if (io.version && info.version !== io.version) throw new Error(`the page runs page.js ${info.version || "(no version: older than 2.4)"}, but the extension is ${io.version}; reload the builder tab and try again`);
    if (plan.builder !== "any" && info.builder !== plan.builder) throw new Error(`the open tab is builder ${info.builder || "(none)"}, the plan is for ${plan.builder}`);
    if (plan.title && !info.text.includes(plan.title)) throw new Error(`the page does not show the task title "${plan.title}"`);
    log(`Builder ${info.builder}${info.task ? ` (${info.task})` : ""}${plan.title ? `, "${plan.title}"` : ""}: found.`);

    async function step(s) {
      if (s.do === "open") {
        ok(await io.call("open", s.section), `opening ${s.section}`);
      } else if (s.do === "fill") {
        const text = s.from ? await io.readText(s.from) : s.text;
        const r = ok(await io.call("fillBox", s.label, text), `filling ${JSON.stringify(s.label)}`);
        log(`  ${r.chars} characters${Array.isArray(s.label) ? ` into "${r.label}"` : ""}`);
        await settle(`filling "${r.label}"`);
      } else if (s.do === "select") {
        const r = ok(await io.call("choose", s.label, s.option), `choosing in ${JSON.stringify(s.label)}`);
        log(`  now "${r.chose}"${Array.isArray(s.label) ? ` in "${r.label}"` : ""}`);
        await settle(`choosing in "${r.label}"`);
      } else if (s.do === "click") {
        const byLabel = s.text === undefined;
        const what = byLabel ? s.label : s.text;
        const before = s.wait ? (await io.call("probe", s.wait.pattern, "")).match : null;
        const r = ok(await io.call("click", what, { first: !!s.first, label: byLabel }), `clicking ${JSON.stringify(what)}`);
        if (Array.isArray(what)) log(`  pressed "${r.pressed}"`);
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
        ok(await io.call("upload", payload, s.kind || (s.folder ? "folder" : "files"), s.near || ""), "uploading");
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
        await savePage(!!s.html);
      } else if (s.do === "save_all") {
        // Saving changes nothing, so a section that will not open is noted
        // and skipped rather than ending the plan.
        const tops = ok(await io.call("sections"), "listing sections").items.filter((n) => !n.id.includes(".") && n.id !== "7");
        const missed = [];
        for (const t of tops) {
          const o = await io.call("open", t.id);
          if (!o || !o.ok) { missed.push(t.id); log(`  could not open ${t.id}: ${(o && o.error) || "no answer"}`); continue; }
          const subs = ok(await io.call("sections"), "listing sections").items.filter((n) => n.id.startsWith(t.id + "."));
          if (!subs.length) { await savePage(!!s.html); continue; }
          for (const sub of subs) {
            if (stopped()) throw new Error("stopped by you");
            const so = await io.call("open", sub.id);
            if (!so || !so.ok) { missed.push(sub.id); log(`  could not open ${sub.id}: ${(so && so.error) || "no answer"}; saving what is shown`); }
            // A screen that would not open is saved as HTML too, to see why.
            await savePage(!!s.html || !(so && so.ok));
          }
        }
        if (missed.length) log(`  not opened: ${missed.join(", ")}`);
      } else if (s.do === "pause") {
        if (!hooks.pause) throw new Error("this runner cannot pause");
        await hooks.pause(s.message);
      }
    }

    const skipped = [];
    for (let i = 0; i < plan.steps.length; i++) {
      if (stopped()) throw new Error("stopped by you");
      const s = plan.steps[i];
      log(`${i + 1}. ${describe(s)}${s.optional ? " (optional)" : ""}`);
      try {
        await step(s);
      } catch (e) {
        if (!s.optional || /stopped by you/.test(e.message)) throw e;
        skipped.push(i + 1);
        log(`  SKIPPED (optional): ${e.message}`);
        try { await savePage(true); } catch { /* keep going */ }
      }
    }
    log(skipped.length ? `Plan finished; optional steps that failed: ${skipped.join(", ")}.` : "Plan finished.");
  }

  return { validate, describe, run };
})();

if (typeof module !== "undefined") module.exports = planCore;
