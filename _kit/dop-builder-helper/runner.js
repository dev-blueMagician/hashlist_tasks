// Runner window: reads the plan and its files from the task folder, finds the
// builder tab, and carries out the plan with planCore (plan.js). Pages and the
// log go to the task's author folder. It stays open while the plan runs; the
// popup would close as soon as the page took focus.
const $ = (id) => document.getElementById(id);
const logBox = $("log");
let checked = null;     // { plan, tabId } after a good Preview
let stopFlag = false;

const log = (line) => {
  logBox.textContent += line + "\n";
  logBox.scrollTop = logBox.scrollHeight;
};
const stamp = () => {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

// ------------------------------------------------------------ files

async function taskFolder(ask) {
  const dir = await folderStore.get();
  if (!dir) throw new Error("No folder chosen. In the popup press Choose folder and pick the task folder (the one that holds author/ and package/).");
  if (dir.name === "author") throw new Error('The chosen folder is "author". Choose the task folder above it, so the plan can read package/ too.');
  if (!(await folderStore.allowed(dir, ask))) throw new Error(`No permission for "${dir.name}". Press Preview again and allow it.`);
  return dir;
}

async function walk(dir, path, kind) {
  const parts = path.split("/").filter((p) => p && p !== ".");
  if (parts.includes("..")) throw new Error(`"${path}": paths may not leave the task folder`);
  let h = dir;
  for (let i = 0; i < parts.length; i++) {
    const last = i === parts.length - 1;
    try {
      h = last && kind === "file" ? await h.getFileHandle(parts[i]) : await h.getDirectoryHandle(parts[i]);
    } catch {
      throw new Error(`"${path}" not found in the task folder`);
    }
  }
  return h;
}

function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// out: a folder inside author/ ("round2") for this plan's pages and log.
function makeIo(dir, tabId, out) {
  // The first call always injects this extension's page.js. A dopHelper left
  // in the page by an older copy of the extension stays there until the tab
  // reloads, and the builder is one page that never reloads on its own: seen
  // 2026-11-06, when runner 2.3 drove page.js 2.1 (HDL_mw3o014d_Trung round 3).
  let injected = false;
  const ensure = async () => {
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: () => !!(globalThis.dopHelper && globalThis.dopHelper.probe) });
    if (!injected || !r.result) await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", files: ["page.js"] });
    injected = true;
  };
  const once = async (fn, args) => {
    await ensure();
    const [r] = await chrome.scripting.executeScript({
      target: { tabId }, world: "MAIN",
      func: (f, a) => globalThis.dopHelper[f](...a),
      args: [fn, args],
    });
    return r.result;
  };
  return {
    async call(fn, ...args) {
      try {
        return await once(fn, args);
      } catch (e) {
        // The page may have been reloading; try once more.
        await new Promise((r) => setTimeout(r, 2500));
        return once(fn, args);
      }
    },
    async readText(path) { return (await (await walk(dir, path, "file")).getFile()).text(); },
    async readB64(path) { return toB64(await (await (await walk(dir, path, "file")).getFile()).arrayBuffer()); },
    async listFolder(path) {
      const top = await walk(dir, path, "dir");
      const out = [];
      const rec = async (h, rel, p) => {
        for await (const [name, child] of h.entries()) {
          if (child.kind === "directory") await rec(child, `${rel}/${name}`, `${p}/${name}`);
          else out.push({ path: `${p}/${name}`, rel: `${rel}/${name}` });
        }
      };
      await rec(top, top.name, path.replace(/\/+$/, ""));
      return out.sort((a, b) => a.rel.localeCompare(b.rel));
    },
    async save(name, text) {
      let to = await dir.getDirectoryHandle("author", { create: true });
      for (const part of (out || "").split("/").filter(Boolean)) to = await to.getDirectoryHandle(part, { create: true });
      await writeText(to, name, text);
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    version: chrome.runtime.getManifest().version,
  };
}

// "any" takes the one builder tab that is open; the title check then makes
// sure it is the right task.
async function builderTab(builder) {
  const want = builder === "any" ? "/app/build/" : `/app/build/${builder}`;
  const tabs = (await chrome.tabs.query({ url: "https://dop.hashlist.com/*" })).filter((t) => (t.url || "").includes(want));
  const which = builder === "any" ? "a builder" : `builder ${builder}`;
  if (!tabs.length) throw new Error(`No open tab shows ${which}. Open the task in the builder first.`);
  if (tabs.length > 1) throw new Error(`${tabs.length} tabs show ${which}. Close all but one.`);
  return tabs[0].id;
}

// ------------------------------------------------------------ buttons

async function preview() {
  logBox.textContent = "";
  checked = null;
  $("run").disabled = true;
  try {
    const dir = await taskFolder(true);
    const io0 = makeIo(dir, null);
    const raw = await io0.readText($("path").value.trim());
    let plan;
    try { plan = JSON.parse(raw); } catch (e) { throw new Error(`The plan is not valid JSON: ${e.message}`); }
    const v = planCore.validate(plan);
    if (v.error) throw new Error(v.error);
    log(`Extension ${chrome.runtime.getManifest().version}`);
    log(`Plan: ${plan.steps.length} steps${plan.note ? ` (${plan.note})` : ""}`);
    plan.steps.forEach((s, i) => log(`  ${i + 1}. ${planCore.describe(s)}`));
    // Every file the plan names must exist now, not halfway through.
    for (const s of plan.steps) {
      if (s.from) await io0.readText(s.from);
      if (s.folder) {
        const files = await io0.listFolder(s.folder);
        log(`  ${s.folder}: ${files.length} files`);
      }
      for (const f of s.files || []) await io0.readB64(f.from);
    }
    const tabId = await builderTab(plan.builder);
    const io = makeIo(dir, tabId, plan.out);
    const info = await io.call("info");
    if (info.version !== io.version) throw new Error(`The builder tab runs page.js ${info.version || "(older than 2.4)"}, but the extension is ${io.version}. Reload the builder tab and press Preview again.`);
    if (plan.builder !== "any" && info.builder !== plan.builder) throw new Error(`The tab shows builder ${info.builder}.`);
    if (plan.title && !info.text.includes(plan.title)) throw new Error(`The tab does not show "${plan.title}".`);
    log(`\nFiles found. Builder tab found: ${info.builder}${info.task ? ` (${info.task})` : ""}, section ${info.section || "?"}, ${info.saved || "no save indicator"}.`);
    // Buttons and upload inputs the plan names on the section that is open now
    // are looked up without pressing anything; other sections are checked when
    // the plan gets there.
    let here = info.section ? info.section.split(" ")[0] : "";
    for (const [i, s] of plan.steps.entries()) {
      if (s.do === "open") here = s.section;
      if (here !== (info.section || "").split(" ")[0]) continue;
      if (s.do === "click") {
        const r = await io.call("click", s.text !== undefined ? s.text : s.label, { label: s.text === undefined, first: !!s.first, dry: true });
        log(`  step ${i + 1}: ${r.ok ? `would press "${r.pressed}"` : `NOT FOUND NOW: ${r.error}`}`);
      } else if (s.do === "upload") {
        const r = await io.call("upload", null, s.kind || (s.folder ? "folder" : "files"), s.near || "");
        log(`  step ${i + 1}: ${r.ok ? "upload input found" : `NOT FOUND NOW: ${r.error}`}`);
      } else if (s.do === "fill") {
        const r = await io.call("fillBox", s.label, null);
        log(`  step ${i + 1}: ${r.ok ? `box "${r.label}" found` : `NOT FOUND NOW: ${r.error}`}`);
      } else if (s.do === "select") {
        const r = await io.call("choose", s.label, s.option, { dry: true });
        log(`  step ${i + 1}: ${r.ok ? `would choose "${r.chose}" in "${r.label}"` : `NOT FOUND NOW: ${r.error}`}`);
      }
    }
    if (plan.out) log(`Pages and the log will go to author/${plan.out}/.`);
    log("Press Run to carry it out. Keep this window open; it never presses Run in section 7.");
    checked = { plan, tabId, dir };
    $("run").disabled = false;
  } catch (e) {
    log(`Not ready: ${e.message}`);
  }
}

async function run() {
  if (!checked) return;
  const { plan, tabId, dir } = checked;
  $("run").disabled = $("preview").disabled = true;
  $("stop").disabled = false;
  stopFlag = false;
  logBox.textContent = "";
  const lines = [];
  const say = (l) => { lines.push(l); log(l); };
  const io = makeIo(dir, tabId, plan.out);
  let failed = null;
  try {
    await planCore.run(plan, io, say, {
      stopped: () => stopFlag,
      pause: (msg) => new Promise((resolve) => {
        $("pausemsg").textContent = msg;
        $("pause").hidden = false;
        $("cont").onclick = () => { $("pause").hidden = true; resolve(); };
      }),
    });
  } catch (e) {
    failed = e.message;
    say(`STOPPED: ${e.message}`);
    const at = stamp();
    try { await io.save(`plan-stop-page-${at}.txt`, (await io.call("capture")).text); say("  the page at the stop was saved too"); } catch { /* page gone */ }
    try { await io.save(`plan-stop-page-${at}.html`, (await io.call("snapshot")).html); say(`  and as HTML (plan-stop-page-${at}.html)`); } catch { /* page gone */ }
  }
  const name = `plan-log-${stamp()}.txt`;
  try {
    await io.save(name, [`plan: ${$("path").value}`, `extension: ${chrome.runtime.getManifest().version}`, `result: ${failed ? "stopped" : "finished"}`, "", ...lines, ""].join("\n"));
    log(`\nLog saved as author/${plan.out ? plan.out + "/" : ""}${name}.`);
  } catch (e) {
    log(`\nLog not saved: ${e.message}`);
  }
  $("stop").disabled = true;
  $("preview").disabled = false;
  checked = null;
}

$("preview").onclick = preview;
$("run").onclick = run;
$("stop").onclick = () => { stopFlag = true; log("Stopping after the current action..."); };
folderStore.get().then((d) => { $("folder").textContent = d ? d.name : "(none chosen)"; });
