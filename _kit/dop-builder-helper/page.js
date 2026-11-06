// Page side of DOP Builder Helper. popup.js injects this file into the
// active tab, then calls dopHelper.capture() or dopHelper.fill().
(() => {
  const SKIP = new Set(["SCRIPT", "STYLE", "SVG", "NOSCRIPT", "TEMPLATE", "HEAD", "LINK", "META"]);
  const BLOCK = new Set(["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "BR", "BUTTON", "DD", "DETAILS", "DIV",
    "DL", "DT", "FIELDSET", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR",
    "LABEL", "LI", "MAIN", "NAV", "OL", "OPTION", "P", "PRE", "SECTION", "SUMMARY", "TABLE", "TR", "UL"]);
  const MODES = ["a value between", "a line that contains", "the judge reads it"];
  const PAUSE = 80;   // ms for the page to re-render after each change
  // Same as manifest.json's version; test.js checks they agree. Captures
  // and info() report it, so a stale copy left in the page shows.
  const VERSION = "2.4";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => JSON.stringify(s);   // shows tabs, quotes and trailing spaces
  const say = (el) => el.textContent.replace(/\s+/g, " ").trim();
  // Text of el with a space between text nodes: <span>5.4</span><span>Scored steps</span> -> "5.4 Scored steps".
  const words = (el) => {
    const parts = [];
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) if (tw.currentNode.data.trim()) parts.push(tw.currentNode.data.trim());
    return parts.join(" ").replace(/\s+/g, " ");
  };
  const nameOf = (el) => el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.name || el.id || "";

  // ------------------------------------------------------------- page as text

  function marks(el) {
    const m = [];
    if (el.getAttribute("data-on") === "true") m.push("(on)");
    for (const a of ["aria-pressed", "aria-checked", "aria-selected", "aria-expanded"]) {
      const v = el.getAttribute(a);
      if (v !== null) m.push(`[${a.slice(5)}=${v}]`);
    }
    const cur = el.getAttribute("aria-current");
    if (cur && cur !== "false") m.push("(current)");
    if (el.tagName === "BUTTON" && el.disabled) m.push("[disabled]");
    const t = el.getAttribute("title");
    if (t && /^(SPAN|BUTTON|A)$/.test(el.tagName)) m.push(`[title: ${t}]`);
    return m.length ? m.join(" ") + " " : "";
  }

  function control(el, tag) {
    if (tag === "TEXTAREA") return `\n[textarea ${nameOf(el)}]\n${el.value || el.getAttribute("value") || ""}\n[/textarea]\n`;
    if (tag === "SELECT") {
      const o = el.selectedOptions[0];
      return `[select ${nameOf(el)} = ${q(o ? say(o) : "")}]`;
    }
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (type === "hidden") return "";
    if (type === "checkbox" || type === "radio") return `[${type} ${nameOf(el)} = ${el.checked ? "on" : "off"}]`;
    if (type === "file") return `[file input ${nameOf(el)}]`;
    return `[input ${nameOf(el)} = ${q(el.value)}]`;
  }

  function pageText() {
    const out = [];
    const walk = (node, pre) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (pre) out.push(node.data);
        else {
          const s = node.data.replace(/\s+/g, " ").trim();
          if (s) out.push(s + " ");
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toUpperCase();
      if (SKIP.has(tag)) return;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        out.push(control(node, tag));
        return;
      }
      const block = BLOCK.has(tag);
      if (block) out.push("\n");
      out.push(marks(node));
      const keep = pre || getComputedStyle(node).whiteSpace.startsWith("pre");
      for (const child of node.childNodes) walk(child, keep);
      if (block) out.push("\n");
    };
    walk(document.body, false);
    const lines = out.join("").split("\n").map((ln) => ln.trimEnd());
    return lines.filter((ln, i) => ln || (i > 0 && lines[i - 1])).join("\n");
  }

  // The builder marks the open section and sub-section with data-on="true".
  function section() {
    const found = [];
    for (const el of document.querySelectorAll('[data-on="true"], [aria-current]:not([aria-current="false"])')) {
      const m = /^(\d+(?:\.\d+)*)\s+(\S.{0,40})$/.exec(words(el));
      if (m) found.push(m);
    }
    found.sort((a, b) => b[1].split(".").length - a[1].split(".").length);
    return found.length ? `${found[0][1]} ${found[0][2]}` : "";
  }

  // Open tabs and expanded panels, so each copy of a page says which one it shows.
  function openParts() {
    const seen = new Set();
    // File-tree folders also carry aria-expanded; they are not tabs.
    const sel = '[aria-expanded="true"]:not([role="treeitem"]), [role="tab"][aria-selected="true"], details[open] > summary';
    for (const el of document.querySelectorAll(sel)) {
      const t = words(el).slice(0, 60);
      if (t) seen.add(t);
    }
    return [...seen].slice(0, 12);
  }

  function fileName(sec, now) {
    const slug = (sec || document.title || "page").toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 50) || "page";
    const p = (n) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
    return `${slug}-${stamp}.txt`;
  }

  function capture() {
    const now = new Date();
    const sec = section();
    const head = [
      "# DOP builder page capture: live page text and field values",
      `helper: page.js ${VERSION}`,
      `url: ${location.href}`,
      `title: ${document.title}`,
      `section: ${sec || "(not found)"}`,
      `body: ${(() => { const b = bodyHeading(); return `${b.nums.join(", ") || "(no number heading)"} ${b.h1}`.trim(); })()}`,
      `open: ${openParts().join(" | ") || "(no tab or panel marked open)"}`,
      `captured: ${now.toString()}`,
      "",
    ];
    const rows = readSteps();
    if (rows.length) head.push(stepsTable(rows), "");
    return { name: fileName(sec, now), text: head.join("\n") + "\n" + pageText() + "\n" };
  }

  // The live page as HTML, so this file can be tested against a real screen
  // (test/real.js). Field values are written into the markup, scripts and the
  // CSP are removed, and the builder's stylesheets are inlined, so parts the
  // builder hides (the section list at 960 px or less) stay hidden offline.
  function snapshot() {
    const now = new Date();
    const clone = document.documentElement.cloneNode(true);
    const live = document.querySelectorAll("input, textarea, select");
    const copy = clone.querySelectorAll("input, textarea, select");
    live.forEach((el, i) => {
      const c = copy[i];
      if (!c || c.tagName !== el.tagName) return;
      if (el.tagName === "TEXTAREA") c.textContent = el.value;
      else if (el.tagName === "SELECT") [...c.options].forEach((o, k) => o.toggleAttribute("selected", el.options[k] ? el.options[k].selected : false));
      else if (/^(checkbox|radio)$/i.test(el.type)) c.toggleAttribute("checked", el.checked);
      else if (el.type !== "file") c.setAttribute("value", el.value);
    });
    const liveLinks = [...document.querySelectorAll('link[rel~="stylesheet"]')];
    clone.querySelectorAll('link[rel~="stylesheet"]').forEach((c, i) => {
      try {
        const css = [...liveLinks[i].sheet.cssRules].map((r) => r.cssText).join("\n");
        const st = document.createElement("style");
        st.setAttribute("data-from", liveLinks[i].href);
        st.textContent = css;
        c.replaceWith(st);
      } catch { /* another origin (fonts): keep the link */ }
    });
    const adopted = (document.adoptedStyleSheets || []).map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join("\n"); } catch { return ""; } }).join("\n");
    const head = clone.querySelector("head");
    if (adopted && head) { const st = document.createElement("style"); st.textContent = adopted; head.append(st); }
    clone.querySelectorAll('script, meta[http-equiv="content-security-policy" i]').forEach((e) => e.remove());
    const note = `DOP Builder Helper snapshot. url: ${location.href} | section: ${section() || "(not found)"} | captured: ${now.toString()} | window: ${innerWidth}x${innerHeight}`;
    const html = `<!doctype html>\n<!-- ${note.replace(/--/g, "- -")} -->\n${clone.outerHTML}\n`;
    return { name: fileName(section(), now).replace(/\.txt$/, ".html"), html };
  }

  // ------------------------------------------------------- 5.4 scored steps

  // One entry per step row, found through the step text box (aria-label "Step N").
  // Other boxes are looked up inside the same row by the end of their label, so
  // the row number the builder shows does not matter.
  function readSteps() {
    const rows = [];
    for (const stmt of document.querySelectorAll("input[aria-label], textarea[aria-label]")) {
      const m = /^Step (\d+)$/.exec(stmt.getAttribute("aria-label"));
      if (!m) continue;
      let row = stmt.parentElement;
      while (row && row !== document.body && !row.querySelector('[aria-label$="one point more"]')) row = row.parentElement;
      if (!row || row === document.body ||
          [...row.querySelectorAll("input[aria-label], textarea[aria-label]")]
            .filter((el) => /^Step \d+$/.test(el.getAttribute("aria-label"))).length > 1) row = stmt.parentElement;
      const one = (sel) => row.querySelector(sel);
      const modeBtns = [...row.querySelectorAll("button")].filter((b) => MODES.includes(say(b)));
      const on = modeBtns.find((b) => b.getAttribute("data-on") === "true" || b.getAttribute("aria-pressed") === "true");
      rows.push({
        n: Number(m[1]), stmt, row, modeBtns,
        text: stmt.value,
        checkedBy: on ? say(on) : "",
        field: one('[aria-label$=": the field it reads"]'),
        low: one('[aria-label$=": lowest accepted"]'),
        high: one('[aria-label$=": highest accepted"]'),
        points: one('[aria-label$=": points"]'),
        more: one('[aria-label$="one point more"]'),
        less: one('[aria-label$="one point less"]'),
        chips: [...row.querySelectorAll("button[aria-pressed]")]
          .filter((b) => !MODES.includes(say(b)))
          .map((b) => ({ el: b, name: b.getAttribute("title") || say(b), on: b.getAttribute("aria-pressed") === "true" })),
      });
    }
    return rows;
  }

  function stepsTable(rows) {
    const lines = [
      "## Scored steps as the page shows them",
      "",
      "| Row | Step text | Checked by | Field | Lowest | Highest | Worth | Gets it wrong | Not marked |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ];
    rows.forEach((r, i) => {
      const cells = [
        i + 1, q(r.text), r.checkedBy || "?",
        r.field ? q(r.field.value) : "-", r.low ? r.low.value : "-", r.high ? r.high.value : "-",
        r.points ? say(r.points) : "?",
        r.chips.filter((c) => c.on).map((c) => c.name).join(", ") || "none",
        r.chips.filter((c) => !c.on).map((c) => c.name).join(", ") || "none",
      ];
      lines.push("| " + cells.map((c) => String(c).replace(/\|/g, "\\|")).join(" | ") + " |");
    });
    return lines.join("\n");
  }

  function checkSpec(spec) {
    const steps = Array.isArray(spec) ? spec : spec && spec.steps;
    if (!Array.isArray(steps) || !steps.length) return { error: 'The steps file needs {"steps": [ ... ]} with at least one step.' };
    const errs = [];
    steps.forEach((s, i) => {
      const at = `step ${i + 1}`;
      if (typeof s.text !== "string" || !s.text.trim()) errs.push(`${at}: "text" is empty`);
      else if (s.text !== s.text.trim()) errs.push(`${at}: "text" starts or ends with a space`);
      if ((s.checkedBy || "a value between") !== "a value between") errs.push(`${at}: only "a value between" is supported`);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s.field || "")) errs.push(`${at}: "field" must be a plain name such as card_io_ok`);
      if (typeof s.low !== "number" || typeof s.high !== "number" || s.low > s.high) errs.push(`${at}: "low" and "high" must be numbers with low <= high`);
      const w = s.worth === undefined ? 1 : s.worth;
      if (!Number.isInteger(w) || w < 1) errs.push(`${at}: "worth" must be a whole number of at least 1`);
      if (s.wrong !== undefined && !Array.isArray(s.wrong)) errs.push(`${at}: "wrong" must be a list of mistake names`);
    });
    const fields = steps.map((s) => s.field);
    const dup = fields.filter((f, i) => fields.indexOf(f) !== i);
    if (dup.length) errs.push(`the same field is used twice: ${[...new Set(dup)].join(", ")}`);
    return errs.length ? { error: errs.join("\n") } : { steps };
  }

  const numberDiffers = (box, want) => !box || box.value.trim() === "" || Number(box.value) !== want;

  function diffRow(r, s) {
    const d = [];
    if (r.checkedBy !== "a value between") d.push(`checked by ${q(r.checkedBy)} -> "a value between"`);
    if (r.text !== s.text) d.push(`text ${q(r.text)} -> ${q(s.text)}`);
    if (!r.field || r.field.value !== s.field) d.push(`field ${q(r.field ? r.field.value : null)} -> ${q(s.field)}`);
    if (numberDiffers(r.low, s.low)) d.push(`lowest ${r.low ? q(r.low.value) : "-"} -> ${s.low}`);
    if (numberDiffers(r.high, s.high)) d.push(`highest ${r.high ? q(r.high.value) : "-"} -> ${s.high}`);
    const worth = s.worth === undefined ? 1 : s.worth;
    const now = r.points ? parseInt(say(r.points), 10) : NaN;
    if (now !== worth) d.push(`worth ${now} -> ${worth}`);
    const wrong = new Set(s.wrong || []);
    for (const c of r.chips) if (c.on !== wrong.has(c.name)) d.push(`${c.name} ${c.on ? "on -> off" : "off -> on"}`);
    return d;
  }

  async function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    el.focus();
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
    await sleep(PAUSE);
  }

  async function fillRow(i, s) {
    const at = `row ${i + 1}`;
    const get = () => {
      const r = readSteps()[i];
      if (!r) throw new Error(`${at} disappeared`);
      return r;
    };
    let r = get();
    if (r.checkedBy !== "a value between") {
      const b = r.modeBtns.find((x) => say(x) === "a value between");
      if (!b) throw new Error(`${at}: no "a value between" button`);
      b.click();
      await sleep(PAUSE);
      r = get();
    }
    if (r.text !== s.text) { await setValue(r.stmt, s.text); r = get(); }
    if (!r.field || !r.low || !r.high) throw new Error(`${at}: field or range boxes not found`);
    if (r.field.value !== s.field) { await setValue(r.field, s.field); r = get(); }
    if (numberDiffers(r.low, s.low)) { await setValue(r.low, s.low); r = get(); }
    if (numberDiffers(r.high, s.high)) { await setValue(r.high, s.high); r = get(); }
    const worth = s.worth === undefined ? 1 : s.worth;
    for (let k = 0; ; k++) {
      const now = r.points ? parseInt(say(r.points), 10) : NaN;
      if (now === worth) break;
      const b = now < worth ? r.more : r.less;
      if (Number.isNaN(now) || !b || b.disabled || k >= 50) throw new Error(`${at}: cannot set Worth to ${worth}`);
      b.click();
      await sleep(PAUSE);
      r = get();
    }
    const wrong = new Set(s.wrong || []);
    for (const name of r.chips.map((c) => c.name)) {
      const c = get().chips.find((x) => x.name === name);
      if (c && c.on !== wrong.has(name)) { c.el.click(); await sleep(PAUSE); }
    }
  }

  // apply=false only compares. apply=true changes the rows in order, adding rows
  // with "Add a step" when the page has fewer; it never removes a row.
  async function fill(spec, apply) {
    if (!/(^|\.)hashlist\.com$/.test(location.hostname)) {
      return { error: `This tab is ${location.hostname || location.href}, not the Hashlist builder.` };
    }
    const c = checkSpec(spec);
    if (c.error) return { error: c.error };
    const want = c.steps;
    let rows = readSteps();
    if (!rows.length) return { error: "No scored steps on this page. Open section 5.4 Scored steps first." };
    const names = new Set(rows.flatMap((r) => r.chips.map((x) => x.name)));
    const unknown = [...new Set(want.flatMap((s) => s.wrong || []))].filter((n) => !names.has(n));
    if (unknown.length) return { error: `These mistakes are not on the page: ${unknown.join(", ")}. Nothing was changed.` };
    const before = want.map((s, i) => (rows[i] ? diffRow(rows[i], s) : ["new row (Add a step)"]));
    const extra = rows.slice(want.length).map((r, k) => `row ${want.length + k + 1}: ${q(r.text)}`);
    if (!apply) return { before, extra };
    const report = () => {
      const now = readSteps();
      return want.map((s, i) => (now[i] ? diffRow(now[i], s) : ["row missing"]));
    };
    try {
      for (let guard = 0; rows.length < want.length; guard++) {
        const add = [...document.querySelectorAll("button")].find((b) => /add a step/i.test(say(b)));
        if (!add || guard >= 20) throw new Error('could not add rows with "Add a step"');
        add.click();
        await sleep(PAUSE * 3);
        rows = readSteps();
      }
      for (let i = 0; i < want.length; i++) await fillRow(i, want[i]);
    } catch (e) {
      return { before, extra, after: report(), error: `Stopped: ${e.message}. Some rows may be half-filled.` };
    }
    return { before, extra, after: report() };
  }

  // ------------------------------------------------------- plan actions
  // Small, single-purpose actions that runner.js calls one at a time. Each
  // returns { ok: true, ... } or { ok: false, error }. None of them presses Run.

  // Never clicked, whatever a plan says: section 7, Run, submitting, replacing
  // the environment, and regenerating the 5.4 checks.
  const FORBIDDEN = /^(\(on\) )?(\(current\) )?(7\b|7\.\d|run\b|run the task|start (the )?run|submit|hand (it )?in|send (it )?(for|to) review|replace and copy|generate checks|save and exit|fix it)/i;
  const CLICKABLE = 'button, a, summary, [role="button"], [role="tab"], [role="treeitem"], [role="link"], [role="menuitem"], [tabindex]';

  const target = (el) => el.closest(CLICKABLE) || el;
  const visible = (el) => !!(el.offsetParent || el.getClientRects().length);
  const isButton = (el) => el.tagName === "BUTTON" || el.getAttribute("role") === "button";

  // What the page does offer, for an error when a lookup finds nothing, so a
  // screen that differs from the plan can be fixed from the log alone.
  function offered(kind) {
    let xs = [];
    if (kind === "box") xs = [...document.querySelectorAll("textarea, input:not([type]), input[type=text]")].filter(visible).map(nameOf);
    if (kind === "select") xs = [...document.querySelectorAll("select")].map((s) => nameOf(s) || selectText(s));
    if (kind === "button") xs = [...document.querySelectorAll('button, [role="button"], [role="tab"]')].filter(visible)
      .map((b) => words(b) || b.getAttribute("aria-label") || b.getAttribute("title"));
    if (kind === "nav") xs = navItems().map((n) => `${n.id} ${n.label}`);
    const u = [...new Set(xs.filter(Boolean).map((x) => x.slice(0, 60)))];
    const kinds = { box: "text boxes", select: "selects", button: "buttons", nav: "navigation entries" };
    return `; ${kinds[kind]} on this page: ${u.length ? u.slice(0, 30).map(q).join(", ") + (u.length > 30 ? `, ... (${u.length} in all)` : "") : "none"}`;
  }

  // Innermost visible elements whose text is exactly text (or starts with it).
  function byText(text, opts = {}) {
    const within = opts.within || document;
    const found = [];
    for (const el of within.querySelectorAll(`${CLICKABLE}, li, span, div, p, label`)) {
      const raw = el.textContent;
      if (!raw || raw.length > text.length + 80) continue;
      const t = words(el);
      if ((opts.prefix ? t.startsWith(text) : t === text) && visible(el)) found.push(el);
    }
    return found.filter((e) => !found.some((o) => o !== e && e.contains(o)));
  }

  // Visible clickable elements whose aria-label or title is exactly label.
  function byLabel(label, within = document) {
    return [...within.querySelectorAll(CLICKABLE)]
      .filter((el) => (el.getAttribute("aria-label") === label || el.getAttribute("title") === label) && visible(el));
  }

  // What a click on text (or on label) would press. Several hits are narrowed
  // to elements whose own text is the text, then to real buttons, so a heading
  // with the same words as its button ("Try the box", "Verify") is skipped.
  function resolve(text, opts = {}) {
    let hits = (opts.label ? byLabel(text) : byText(text, opts)).map(target).filter((el, i, a) => a.indexOf(el) === i);
    if (hits.length > 1 && !opts.label) {
      const own = hits.filter((el) => (opts.prefix ? words(el).startsWith(text) : words(el) === text));
      if (own.length) hits = own;
    }
    if (hits.length > 1) {
      const btn = hits.filter(isButton);
      if (btn.length) hits = btn;
    }
    return hits;
  }

  function guardedClick(el) {
    const t = words(target(el));
    const l = target(el).getAttribute("aria-label") || "";
    if (FORBIDDEN.test(t) || FORBIDDEN.test(l)) throw new Error(`refused to click ${q(t || l)}`);
    target(el).click();
  }

  function info() {
    const m = /\/app\/build\/([0-9a-f-]{36})(?:\/([^/?#]*))?/.exec(location.pathname);
    const text = document.body ? document.body.innerText : "";
    const id = /\btask-[a-z0-9]{6,}\b/.exec(text);
    return {
      ok: true,
      host: location.hostname,
      builder: m ? m[1] : "",
      slug: m ? m[2] || "" : "",
      task: id ? id[0] : "",
      section: section(),
      saved: saveState(),
      text: text.slice(0, 4000),
      version: VERSION,
    };
  }

  // The save indicator next to the task title: "Saved", "Saving..." or "Unsaved".
  function saveState() {
    for (const el of document.querySelectorAll("span, div, p, small, b, strong")) {
      const t = (el.textContent || "").trim();
      if (t.length < 12 && /^(Saved|Unsaved|Saving\b.*|Not saved.*)$/.test(t) && !el.children.length) return t;
    }
    return "";
  }

  // Navigation entries: "5 Golden set" and "5.3 Common mistakes", in page order.
  // The builder keeps them in <nav> elements (the step bar and "Screens in this
  // section"); entries elsewhere, such as the numbered tabs on 1.2, are only
  // used when no <nav> holds any. In a window 960 px wide or less the builder
  // hides "Screens in this section" (display: none); its buttons are still in
  // the page and still respond to a click, so entries in <nav> count even when
  // hidden, with a visible one preferred.
  function navItems() {
    const scan = (els, needVisible) => {
      const seen = new Map();
      for (const el of els) {
        const t = words(el).replace(/^(\(on\) )?(\(current\) )?/, "");
        const m = /^(\d(?:\.\d+)?) (\S.{0,45})$/.exec(t);
        if (!m || !/^[A-Z]/.test(m[2])) continue;
        const vis = visible(el);
        if (needVisible && !vis) continue;
        const had = seen.get(m[1]);
        if (!had || (vis && !had.vis)) seen.set(m[1], { id: m[1], label: m[2], el, vis });
      }
      return [...seen.values()].map(({ id, label, el }) => ({ id, label, el }));
    };
    const inNav = scan(document.querySelectorAll(`nav :is(${CLICKABLE})`), false);
    return inNav.length ? inNav : scan(document.querySelectorAll(CLICKABLE), true);
  }

  async function open(id) {
    if (/^7(\.|$)/.test(id)) return { ok: false, error: "section 7 is never opened by a plan" };
    const top = id.split(".")[0];
    const find = (x) => navItems().find((n) => n.id === x);
    if (id.includes(".") && !find(id)) {
      const t = find(top);
      if (!t) return { ok: false, error: `no navigation entry ${top}${offered("nav")}` };
      guardedClick(t.el);
      await sleep(PAUSE * 6);
    }
    const n = find(id);
    if (!n) return { ok: false, error: `no navigation entry ${id}${offered("nav")}` };
    guardedClick(n.el);
    for (let i = 0; i < 50; i++) {
      await sleep(PAUSE * 2);
      const sec = section();
      // A top-level entry opens its first sub-section (1 -> 1.1).
      if (sec === id || sec.startsWith(id + " ") || (!id.includes(".") && sec.startsWith(id + "."))) {
        const s = await settled(sec.split(" ")[0]);
        return s.ok ? { ok: true, section: sec } : { ok: false, error: `opened ${id}, but ${s.error}` };
      }
    }
    return { ok: false, error: `opened ${id}, but the page shows ${q(section())}` };
  }

  // The number heading in the page body ("2.3" above "Internet"), outside the
  // navigation and the header. The IDE screens (3 to 5) have none.
  function bodyHeading() {
    const main = document.querySelector(".main2") || document.querySelector("main") || document.body;
    const nums = [...main.querySelectorAll("div, span, p, b")].filter((e) =>
      !e.children.length && !e.closest("nav, header") && /^[1-7]\.[1-9]$/.test((e.textContent || "").trim()) && visible(e));
    const h = main.querySelector("h1");
    return { nums: [...new Set(nums.map((e) => e.textContent.trim()))], h1: h ? say(h) : "", len: (main.innerText || "").length };
  }

  // Seen live (2026-11-06): the step bar changes at once, but the body shows
  // the previous screen for a moment. Wait until the body's number heading, if
  // it has one, is this sub-section's and its text stops changing.
  async function settled(sub) {
    let last = null;
    for (let i = 0; i < 40; i++) {
      await sleep(PAUSE * 2);
      const b = bodyHeading();
      const right = !b.nums.length || (b.nums.length === 1 && b.nums[0] === sub);
      const key = `${b.nums.join()}|${b.h1}|${b.len}`;
      if (right && key === last) return { ok: true };
      last = right ? key : null;
    }
    const b = bodyHeading();
    return { ok: false, error: `the page body still shows ${q(b.nums.join(", ") + " " + b.h1)} after 6 s` };
  }

  function sections() {
    return { ok: true, items: navItems().map((n) => ({ id: n.id, label: n.label })) };
  }

  // text is one text or a list of alternatives; the first one on the page is
  // pressed ("Try the box", "Try again", "Try the changed box"). opts.label
  // matches aria-label or title instead ("Remove verifier/rtl.json"). opts.dry
  // only reports what would be pressed.
  async function click(text, opts = {}) {
    const alts = Array.isArray(text) ? text : [text];
    for (const alt of alts) {
      const hits = resolve(alt, opts);
      if (!hits.length) continue;
      if (hits.length > 1 && !opts.first) return { ok: false, error: `${hits.length} elements read ${q(alt)}; the plan must be more exact` };
      const said = words(hits[0]) || hits[0].getAttribute("aria-label") || "";
      if (opts.dry) return { ok: true, pressed: alt, tag: hits[0].tagName, said };
      try {
        guardedClick(hits[0]);
      } catch (e) {
        return { ok: false, error: e.message };
      }
      await sleep(PAUSE * 3);
      return { ok: true, pressed: alt };
    }
    return { ok: false, error: `no ${alts.map(q).join(" or ")} on the page${offered("button")}` };
  }

  function box(label) {
    const all = [...document.querySelectorAll("textarea, input:not([type]), input[type=text]")];
    return all.filter((el) => nameOf(el) === label && visible(el));
  }

  // labels is one label or a list of alternatives; the first that names
  // exactly one element on the page is used.
  function pickLabel(labels, find, kind) {
    const alts = Array.isArray(labels) ? labels : [labels];
    for (const l of alts) if (find(l).length === 1) return { label: l };
    const counts = alts.map((l) => `${find(l).length} labelled ${q(l)}`).join(", ");
    return { error: `${counts}${offered(kind)}` };
  }

  // text null only checks that the box is there (Preview).
  async function fillBox(labels, text) {
    const p = pickLabel(labels, box, "box");
    if (p.error) return { ok: false, error: p.error };
    if (text === null) return { ok: true, label: p.label };
    await setValue(box(p.label)[0], text);
    await sleep(PAUSE * 2);
    const now = box(p.label)[0];
    if (!now || now.value !== text) return { ok: false, error: `${q(p.label)} does not hold the new text after filling` };
    return { ok: true, chars: text.length, label: p.label };
  }

  // A <select> named by its aria-label, or by the text of the element around
  // it with the options left out: 2.2 shows "CPU", "Step limit model turns"
  // next to selects that have no label of their own.
  function selectText(s) {
    const own = (el) => {
      let t = "";
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) if (!tw.currentNode.parentElement.closest("select")) t += " " + tw.currentNode.data;
      return t.replace(/\s+/g, " ").trim();
    };
    for (let p = s.parentElement, k = 0; p && k < 3; p = p.parentElement, k++) {
      if (p.querySelectorAll("select").length > 1) return "";
      const t = own(p);
      if (t) return t;
    }
    return "";
  }

  function selects(label) {
    return [...document.querySelectorAll("select")].filter((s) => {
      if (nameOf(s) === label) return true;
      const t = selectText(s);
      return !!t && (t === label || t.startsWith(label + " "));
    });
  }

  // opts.dry only checks that the select and the option are there (Preview).
  async function choose(labels, option, opts0 = {}) {
    const p = pickLabel(labels, selects, "select");
    if (p.error) return { ok: false, error: p.error };
    const label = p.label;
    const s = selects(label)[0];
    const opts = [...s.options];
    const o = opts.find((x) => say(x) === option) || opts.find((x) => x.value === option) ||
      opts.find((x) => say(x).startsWith(option + " "));
    if (!o) return { ok: false, error: `${q(label)} has no option ${q(option)}; it offers ${opts.map((x) => q(say(x))).join(", ")}` };
    if (opts0.dry) return { ok: true, label, chose: say(o) };
    s.focus();
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, o.value);
    s.dispatchEvent(new Event("input", { bubbles: true }));
    s.dispatchEvent(new Event("change", { bubbles: true }));
    s.blur();
    await sleep(PAUSE * 3);
    const now = selects(label)[0];
    const shown = now && now.selectedOptions[0] ? say(now.selectedOptions[0]) : "";
    if (!now || now.value !== o.value) return { ok: false, error: `${q(label)} shows ${q(shown)} after choosing ${q(say(o))}` };
    return { ok: true, chose: say(o), label };
  }

  function readBox(label) {
    const hits = box(label);
    return hits.length === 1 ? { ok: true, text: hits[0].value } : { ok: false, error: `${hits.length} boxes labelled ${q(label)}${offered("box")}` };
  }

  // The file input that belongs to the button labelled near ("Add a file",
  // "Upload a file", "Upload a folder"): in the smallest enclosing element
  // that holds one, the first input after the button (the builder puts it
  // right after), else the last one before it.
  function inputNear(near, kind) {
    const fits = (i) => (kind === "folder") === i.hasAttribute("webkitdirectory");
    const anchors = [...byLabel(near), ...resolve(near)].filter((el, i, a) => a.indexOf(el) === i);
    const found = [];
    for (const a of anchors) {
      for (let p = a.parentElement, k = 0; p && k < 4; p = p.parentElement, k++) {
        const ins = [...p.querySelectorAll('input[type="file"]')].filter(fits);
        if (!ins.length) continue;
        const after = ins.filter((i) => a.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING);
        found.push(after.length ? after[0] : ins[ins.length - 1]);
        break;
      }
    }
    return [...new Set(found)];
  }

  // files: [{ rel: "docs/x.md", b64 }]. kind "folder" uses the folder input,
  // as "Upload a folder" does; rel keeps the folder's own name first.
  // near picks the input next to that button; without it, the first input of
  // the kind (the file tree's) is used.
  async function upload(files, kind, near) {
    const inputs = [...document.querySelectorAll('input[type="file"]')];
    let pick = kind === "folder" ? inputs.filter((i) => i.hasAttribute("webkitdirectory")) : inputs.filter((i) => !i.hasAttribute("webkitdirectory"));
    if (near) {
      pick = inputNear(near, kind);
      if (pick.length !== 1) return { ok: false, error: `${pick.length} ${kind} upload inputs next to ${q(near)}${offered("button")}` };
    }
    if (!pick.length) return { ok: false, error: `no ${kind} upload input on this page${offered("button")}` };
    if (files === null) return { ok: true, count: 0 };   // dry check from Preview
    const dt = new DataTransfer();
    for (const f of files) {
      const bin = atob(f.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], f.rel.split("/").pop(), { type: f.type || "" });
      if (kind === "folder") Object.defineProperty(file, "webkitRelativePath", { value: f.rel });
      dt.items.add(file);
    }
    const input = pick[0];
    input.files = dt.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(PAUSE * 10);
    return { ok: true, count: files.length };
  }

  // The open file's header carries its full path in a title attribute.
  const header = (path) => [...document.querySelectorAll(`[title="${CSS.escape(path)}"]`)].filter(visible);

  async function openFile(path) {
    if (header(path).length) {
      const tab = header(path).find((el) => target(el).getAttribute("aria-selected") !== null) || header(path)[0];
      target(tab).click();
      await sleep(PAUSE * 3);
      return { ok: true };
    }
    const name = path.split("/").pop();
    const tree = document.querySelector('[role="tree"]') || document;
    for (const cand of byText(name, { within: tree })) {
      target(cand).click();
      await sleep(PAUSE * 4);
      if (header(path).length) return { ok: true };
    }
    return { ok: false, error: `could not open ${path} from the file tree` };
  }

  async function deleteFile(path) {
    const o = await openFile(path);
    if (!o.ok) return o;
    // The Delete button sits in the open file's header, next to the path.
    let del = null;
    for (const h of header(path)) {
      for (let a = h.parentElement, k = 0; a && k < 6 && !del; a = a.parentElement, k++) {
        del = [...a.querySelectorAll("button")].find((b) => say(b) === "Delete" && visible(b)) || null;
      }
      if (del) break;
    }
    if (!del) return { ok: false, error: `no Delete button next to ${path}` };
    const confirm0 = window.confirm;
    window.confirm = () => true;
    try {
      del.click();
      await sleep(PAUSE * 4);
      const dialog = document.querySelector('[role="dialog"], [role="alertdialog"], dialog[open]');
      if (dialog) {
        const yes = [...dialog.querySelectorAll("button")].find((b) => /^(delete|yes|confirm|ok)$/i.test(say(b)));
        if (yes) { yes.click(); await sleep(PAUSE * 4); }
      }
    } finally {
      window.confirm = confirm0;
    }
    for (let i = 0; i < 25; i++) {
      if (!header(path).length) return { ok: true };
      await sleep(PAUSE * 2);
    }
    return { ok: false, error: `${path} is still open after Delete` };
  }

  // For waits: the first match of pattern in the page text, and whether busy
  // matches. Runs of white space count as one space, because a badge next to
  // its heading ("Try the box" + "Worked · 05:30 PM") can come out of
  // innerText with a line break or with nothing between them.
  function probe(pattern, busy) {
    const text = document.body ? document.body.innerText.replace(/\s+/g, " ") : "";
    const m = new RegExp(pattern).exec(text);
    return { ok: true, match: m ? m[0] : null, busy: busy ? new RegExp(busy).test(text) : false, saved: saveState() };
  }

  globalThis.dopHelper = {
    version: VERSION,
    capture, snapshot, fill, info, sections, open, click, fillBox, readBox, upload, openFile, deleteFile, probe, choose,
  };
})();
