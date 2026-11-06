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
  tryStatus: "Try the box Worked · 03:56 PM",
  verify: "Ready to run",
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
  render();
}

function navRender() {
  const nav = document.getElementById("nav");
  nav.textContent = "";
  const top = state.open.split(".")[0];
  for (const [id, label, subs] of SECTIONS) {
    const b = el("button", { on: () => go(subs[0][0]) }, `${id} ${label}`);
    if (id === top) { b.setAttribute("data-on", "true"); b.setAttribute("aria-current", "page"); }
    nav.append(b);
    if (id === top) {
      for (const [sid, slabel] of subs) {
        const sb = el("button", { on: () => go(sid) }, `${sid} ${slabel}`);
        if (sid === state.open) { sb.setAttribute("data-on", "true"); sb.setAttribute("aria-current", "step"); }
        nav.append(sb);
      }
    }
  }
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
  m.append(el("h2", { text: id }));
  if (id === "2.4") {
    m.append(el("p", { text: state.tryStatus }));
    m.append(el("button", {
      on: () => {
        state.tryStatus = "Try the box running";
        render();
        setTimeout(() => { state.tryStatus = "Try the box Worked · 04:10 PM"; render(); }, 7000);
      },
    }, "Try again"));
    m.append(textBox("Commands to run in the box"));
  } else if (id === "3.1") {
    m.append(filesPanel());
  } else if (id === "4.3") {
    m.append(textBox("The prompt the model is handed"));
  } else if (id === "5.1") {
    m.append(textBox("Your steps"));
  } else if (id === "5.2") {
    m.append(textBox("Your correct answer"));
  } else if (id === "6.1") {
    m.append(el("p", { text: state.verify }));
    m.append(el("button", {
      on: () => {
        state.verify = "Verifying the correct answer";
        render();
        setTimeout(() => { state.verify = "Correct answer 1.00 naive_a 0.21"; render(); }, 9000);
      },
    }, state.verify === "Ready to run" ? "Verify" : "Verify again"));
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
