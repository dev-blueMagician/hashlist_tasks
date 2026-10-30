// Page side of DOP Builder Helper. popup.js injects this file into the
// active tab, then calls dopHelper.capture() or dopHelper.fill().
(() => {
  const SKIP = new Set(["SCRIPT", "STYLE", "SVG", "NOSCRIPT", "TEMPLATE", "HEAD", "LINK", "META"]);
  const BLOCK = new Set(["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "BR", "BUTTON", "DD", "DETAILS", "DIV",
    "DL", "DT", "FIELDSET", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR",
    "LABEL", "LI", "MAIN", "NAV", "OL", "OPTION", "P", "PRE", "SECTION", "SUMMARY", "TABLE", "TR", "UL"]);
  const MODES = ["a value between", "a line that contains", "the judge reads it"];
  const PAUSE = 80;   // ms for the page to re-render after each change

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
    for (const a of ["aria-pressed", "aria-checked", "aria-selected"]) {
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

  function fileName(sec, now) {
    const slug = (sec || document.title || "page").toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 50) || "page";
    const p = (n) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
    return `${slug}-${stamp}.txt`;
  }

  function capture() {
    const now = new Date();
    const sec = section();
    const head = [
      "# DOP builder page capture: live page text and field values",
      `url: ${location.href}`,
      `title: ${document.title}`,
      `section: ${sec || "(not found)"}`,
      `captured: ${now.toString()}`,
      "",
    ];
    const rows = readSteps();
    if (rows.length) head.push(stepsTable(rows), "");
    return { name: fileName(sec, now), text: head.join("\n") + "\n" + pageText() + "\n" };
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

  globalThis.dopHelper = { capture, fill };
})();
