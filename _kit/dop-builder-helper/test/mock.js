// Stand-in builder: a tiny single-page app with the parts plans touch.
const UUID = "aa703c22-37b5-4f2f-a2fd-58b91e767638";
const SECTIONS = [
  ["1", "Brief", [["1.1", "What good looks like", "separation"], ["1.2", "A worked example", "example"], ["1.3", "How a run works", "running"]]],
  ["2", "Build settings", [["2.1", "Shell", "template"], ["2.2", "Limits", "limits"], ["2.3", "Internet", "internet"], ["2.4", "Toolchain", "toolchain"]]],
  ["3", "Environment", [["3.1", "Files", "files"]]],
  ["4", "Prompt", [["4.1", "Task title", "brief-title"], ["4.3", "Prompt", "brief-text"]]],
  ["5", "Golden set", [["5.1", "Your steps", "steps"], ["5.2", "Correct answer", "gold"], ["5.3", "Common mistakes", "mistakes"], ["5.4", "Scored steps", "scored"]]],
  ["6", "Verify", [["6.1", "Verify", "verify"]]],
  ["7", "Run", [["7.1", "Run", "run"]]],
];
const state = {
  open: "2.4",
  files: new Map([
    ["/app/data/docs/SRS.md", "old srs"],
    ["/app/data/docs/TAG.md", "tag"],
    ["/app/data/field/log.csv", "old log"],
    ["/app/data/src/a.c", "int a;"],
  ]),
  tabs: [],
  active: "",
  boxes: { "Commands to run in the box": "echo old", "Your steps": "", "Your correct answer": "", "The prompt the model is handed": "prompt" },
  tryChip: "",            // "" until the first try, then "Worked · 04:10 PM"
  trying: false,
  tries: 0,
  verify: "Not checked yet",
  verifying: false,
  verifies: 0,
  verifier: ["Dockerfile", "report.py", "rtl.json"],
  goldUpload: [],
  limits: { CPU: "4", Memory: "8", Steps: "" },
  submitted: false,
  uploads: [],
  confirms: 0,
};
window.mockState = state;

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "on") e.addEventListener("click", v);
    else if (k === "text") e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const k of kids) e.append(k);
  return e;
};

function changed() {
  const s = document.getElementById("saved");
  s.textContent = "Saving...";
  setTimeout(() => { s.textContent = "Saved"; }, 900);
}

function go(id) {
  state.open = id;
  const sub = SECTIONS.flatMap((s) => s[2]).find((x) => x[0] === id);
  if (sub) history.pushState({}, "", `/app/build/${UUID}/${sub[2]}`);
  // As seen live: the step bar changes at once, the body a moment later.
  navRender();
  clearTimeout(state.lag);
  state.lag = setTimeout(render, 450);
}

function navRender() {
  const nav = document.getElementById("nav");
  nav.textContent = "";
  const top = state.open.split(".")[0];
  // As in the builder: a step bar, then "Screens in this section" in its own
  // <nav>, which a window of 960 px or less hides (state.narrow).
  const side = el("nav", { "aria-label": "Screens in this section" });
  if (state.narrow) side.style.display = "none";
  for (const [id, label, subs] of SECTIONS) {
    const b = el("button", { on: () => go(subs[0][0]) }, el("span", { text: id }), el("span", { text: label }));
    if (id === top) { b.setAttribute("data-on", "true"); b.setAttribute("aria-current", "page"); }
    nav.append(b);
    if (id === top) {
      for (const [sid, slabel] of subs) {
        const sb = el("button", { on: () => go(sid) }, el("span", { text: sid }), el("span", { text: slabel }));
        if (sid === state.open) { sb.setAttribute("data-on", "true"); sb.setAttribute("aria-current", "step"); }
        side.append(sb);
      }
    }
  }
  nav.after(side);
  const old = document.getElementById("side");
  if (old) old.remove();
  side.id = "side";
}

function textBox(label) {
  const t = el("textarea", { "aria-label": label });
  t.value = state.boxes[label] || "";
  t.addEventListener("input", () => { state.boxes[label] = t.value; changed(); });
  return t;
}

function tree() {
  const root = el("div", { role: "tree" });
  const dirs = new Map();
  for (const path of [...state.files.keys()].sort()) {
    const parts = path.split("/").slice(1);
    let parent = root, acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
      acc += "/" + parts[i];
      if (!dirs.has(acc)) {
        const g = el("div", { role: "group" });
        const node = el("div", { role: "treeitem", "aria-expanded": "true" }, el("span", { text: parts[i] }));
        node.append(g);
        parent.append(node);
        dirs.set(acc, g);
      }
      parent = dirs.get(acc);
    }
    const file = el("div", { role: "treeitem", on: () => { if (!state.tabs.includes(path)) state.tabs.push(path); state.active = path; render(); } },
      el("span", { text: parts[parts.length - 1] }));
    parent.append(file);
  }
  return root;
}

function filesPanel() {
  const p = el("section");
  const files = el("input", { type: "file", multiple: "" });
  const folder = el("input", { type: "file", multiple: "" });
  folder.setAttribute("webkitdirectory", "");
  const add = (list, isFolder) => {
    for (const f of list) {
      const rel = isFolder ? f.webkitRelativePath : f.name;
      if (!rel) { state.uploads.push("NO-PATH:" + f.name); continue; }
      const path = "/app/data/" + rel;
      // the real builder would make a second copy; the test checks this never happens
      if (state.files.has(path)) state.uploads.push("DUPLICATE:" + path);
      state.files.set(path, `${f.size} bytes`);
      state.uploads.push(path);
    }
    changed();
    render();
  };
  files.addEventListener("change", (e) => add(e.target.files, false));
  folder.addEventListener("change", (e) => add(e.target.files, true));
  p.append(el("span", { title: "New file", text: "+" }), el("span", { title: "Upload files", text: "^" }), el("span", { title: "Upload a folder", text: "^^" }), files, folder);
  p.append(tree());
  const tabs = el("div", { role: "tablist" });
  for (const t of state.tabs) {
    tabs.append(el("span", { role: "tab", class: "tab", "aria-selected": String(t === state.active), title: t, on: () => { state.active = t; render(); } }, t.split("/").pop()),
      el("button", { on: () => { state.tabs = state.tabs.filter((x) => x !== t); render(); } }, "×"));
  }
  p.append(tabs);
  if (state.active) {
    const head = el("div", {}, el("span", { title: state.active, text: state.active }), el("button", { title: "Copy the path", text: "c" }),
      el("button", {
        on: () => {
          if (!window.confirm(`Delete ${state.active}?`)) return;
          state.confirms++;
          state.files.delete(state.active);
          state.tabs = state.tabs.filter((x) => x !== state.active);
          state.active = "";
          changed();
          render();
        },
      }, "Delete"));
    p.append(head, el("textarea", {}));
  }
  return p;
}

function body() {
  const m = el("div");
  const id = state.open;
  const label = (SECTIONS.flatMap((x) => x[2]).find((x) => x[0] === id) || [])[1] || "";
  // Numbered screens show "2.4" above their name; the IDE screens (3 to 5) do not.
  if (!/^[345]\./.test(id)) m.append(el("div", { class: "num", text: id }), el("h1", { text: label }));
  if (id === "2.2") {
    // As the 2.2 capture reads: "CPU [select = "4 cores"]", "Step limit model turns [select = ""]".
    const sel = (key, opts) => {
      const s = el("select");
      for (const [v, t] of opts) { const o = el("option", { value: v, text: t }); s.append(o); }
      s.value = state.limits[key];
      s.addEventListener("change", () => { state.limits[key] = s.value; changed(); });
      return s;
    };
    m.append(el("label", {}, el("span", { text: "CPU" }), sel("CPU", [["1", "1 core"], ["2", "2 cores"], ["4", "4 cores"]])));
    m.append(el("label", {}, el("span", { text: "Memory" }), sel("Memory", [["4", "4 GiB"], ["8", "8 GiB"]])));
    m.append(el("div", {}, el("span", { text: "Step limit" }), el("small", { text: "model turns" }),
      sel("Steps", [["", ""], ...["10", "20", "40", "60", "100", "200", "500"].map((v) => [v, v])])));
  } else if (id === "1.2") {
    // numbered tabs in the page body, outside the nav: not navigation entries
    for (const t of ["1 The prompt", "2 The container", "3 The golden set"]) m.append(el("button", { role: "tab", "aria-selected": "false" }, t));
  } else if (id === "2.4") {
    // As in SectionFiles: <b>Try the box</b>, a status chip, and one button
    // whose text follows the state ("Try the box" -> "Trying…" -> "Try again").
    const head = el("div", { style: "display:flex;gap:8px" }, el("b", { text: "Try the box" }));
    if (state.tryChip) head.append(el("span", { class: "tb ok", text: state.tryChip }));
    head.append(el("button", {
      on: () => {
        if (state.trying) return;
        state.trying = true;
        render();
        setTimeout(() => { state.trying = false; state.tries++; state.tryChip = `Worked · 04:1${state.tries} PM`; render(); }, 7000);
      },
    }, state.trying ? "Trying…" : state.tries ? "Try again" : "Try the box"));
    m.append(head);
    m.append(textBox("Commands to run in the box"));
  } else if (id === "3.1") {
    m.append(filesPanel());
  } else if (id === "4.3") {
    m.append(textBox("The prompt the model is handed"));
  } else if (id === "5.1") {
    m.append(textBox("Your steps"));
  } else if (id === "5.2") {
    m.append(filesPanel());
    const up = el("input", { type: "file" });
    up.addEventListener("change", (e) => { for (const f of e.target.files) state.goldUpload.push(f.name); changed(); });
    m.append(el("button", { text: "Upload a file" }), up);
    m.append(textBox("Your correct answer"));
  } else if (id === "5.4") {
    // RTL shell: a verifier/ file list with "Add a file" and Remove buttons
    // labelled "Remove verifier/<name>"; the file tree's inputs come first.
    m.append(filesPanel());
    const add = el("input", { type: "file", multiple: "" });
    add.addEventListener("change", (e) => { for (const f of e.target.files) if (!state.verifier.includes(f.name)) state.verifier.push(f.name); changed(); render(); });
    m.append(el("div", {}, el("span", { text: "verifier/" }), el("span", {}, el("button", { text: "Add a file" }), add)));
    for (const f of state.verifier) {
      m.append(el("div", {}, el("span", { text: f }), el("button", { "aria-label": `Remove verifier/${f}`, on: () => { state.verifier = state.verifier.filter((x) => x !== f); changed(); render(); } }, "Remove")));
    }
  } else if (id === "6.1") {
    m.append(el("div", {}, el("span", { text: "Correct answer" }), el("span", { class: "num", text: "1.00" })));
    const status = state.verifying ? "Checking your task…" : state.verify;
    m.append(el("div", { role: "status" }, el("b", { text: status }), el("button", {
      on: () => {
        if (state.verifying) return;
        state.verifying = true;
        render();
        setTimeout(() => { state.verifying = false; state.verifies++; state.verify = "Ready to run"; render(); }, 9000);
      },
    }, state.verifying ? "Verifying…" : state.verifies ? "Verify again" : "Verify my task")));
  } else if (id === "7.1") {
    m.append(el("button", { on: () => { state.submitted = true; } }, "Run"));
  } else {
    m.append(el("p", { text: `Section ${id}` }));
  }
  m.append(el("button", { text: "Continue" }));
  return m;
}

function render() {
  navRender();
  const main = document.getElementById("main");
  main.textContent = "";
  main.append(body());
}

history.replaceState({}, "", `/app/build/${UUID}/toolchain`);
render();
