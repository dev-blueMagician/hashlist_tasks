// In-page test: plan.js drives page.js against the stand-in builder (mock.js),
// with an io object whose files live in memory. Results go into <pre id="out">.
(async () => {
  const out = [];
  let fails = 0;
  const check = (cond, what) => { out.push(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) fails++; };
  const UUID = "aa703c22-37b5-4f2f-a2fd-58b91e767638";
  const files = {
    "author/probes/clean.txt": "id\nls -la /app",
    "author/upload/docs/SRS.md": "new srs",
    "author/upload/docs/VN.md": "vn-07",
    "author/upload/field/log.csv": "new log",
    "author/steps.txt": "Step one.\nStep two.",
    "author/upload/verifier/rtl.json": "{}",
    "author/upload/verifier/tb_x.v": "module tb; endmodule",
    "author/upload/gold.py": "print(1)",
  };
  // The builder's own texts (SectionFiles and Builder bundles, 2026-11-05).
  const TRY = { do: "click", text: ["Try the box", "Try again", "Try the changed box"],
    wait: { pattern: "(Worked|\\d+ failed|Some failed|Answer in the box|Script in the box|Didn't build|Cancelled) · \\d{1,2}:\\d\\d", busy: "Trying", timeout_s: 120 } };
  const VERIFY = { do: "click", text: ["Verify my task", "Verify again"],
    wait: { pattern: "Ready to run|\\d+ problems? to fix|The check could not finish", busy: "Verifying|Checking your task", timeout_s: 120 } };
  const saved = [];
  const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
  const io = {
    // Results cross a structured-clone boundary in the extension; do the same here.
    call: async (fn, ...args) => JSON.parse(JSON.stringify(await globalThis.dopHelper[fn](...JSON.parse(JSON.stringify(args))))),
    readText: async (p) => { if (!(p in files)) throw new Error(`"${p}" not found`); return files[p]; },
    readB64: async (p) => b64(await io.readText(p)),
    listFolder: async (p) => Object.keys(files).filter((k) => k.startsWith(p + "/"))
      .map((k) => ({ path: k, rel: `${p.split("/").pop()}/${k.slice(p.length + 1)}` })),
    save: async (name, text) => { saved.push({ name, text }); },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
  const st = window.mockState;
  const plan = {
    builder: UUID,
    title: "ECP-300 coolant pump resets after software 3.2.0",
    steps: [
      { do: "open", section: "2.2" },
      { do: "select", label: "Step limit", option: "500" },
      { do: "select", label: "CPU", option: "2 cores" },
      { do: "select", label: "Memory", option: "3 GiB", optional: true },
      { do: "open", section: "2.4" },
      { do: "fill", label: "Commands to run in the box", from: "author/probes/clean.txt" },
      TRY,
      TRY,
      { do: "save" },
      { do: "open", section: "3.1" },
      { do: "delete", path: "/app/data/docs/SRS.md" },
      { do: "delete", path: "/app/data/field/log.csv" },
      { do: "upload", folder: "author/upload/docs" },
      { do: "upload", folder: "author/upload/field" },
      { do: "save" },
      { do: "open", section: "5.1" },
      { do: "fill", label: "Your steps", from: "author/steps.txt" },
      { do: "open", section: "6.1" },
      { do: "open", section: "5.2" },
      { do: "upload", files: [{ from: "author/upload/gold.py", rel: "gold.py" }], near: "Upload a file" },
      { do: "open", section: "5.4" },
      { do: "click", label: "Remove verifier/rtl.json" },
      { do: "upload", files: [{ from: "author/upload/verifier/rtl.json", rel: "rtl.json" }, { from: "author/upload/verifier/tb_x.v", rel: "tb_x.v" }], near: "Add a file" },
      { do: "click", text: "No such button", optional: true },
      { do: "open", section: "6.1" },
      VERIFY,
      VERIFY,
      { do: "save_all" },
    ],
  };
  const lines = [];
  try {
    check(!planCore.validate(plan).error, "the test plan is valid");
    await planCore.run(plan, io, (l) => lines.push(l));
    check(/^Plan finished/.test(lines[lines.length - 1]), "the plan ran to the end");
  } catch (e) {
    check(false, `the plan ran to the end (stopped: ${e.message})`);
  }
  check(st.boxes["Commands to run in the box"] === files["author/probes/clean.txt"], "Try-the-box commands replaced");
  check(st.tries === 2 && st.tryChip === "Worked · 04:12 PM", `pressed "Try the box", then "Try again", waiting for each result (${st.tries}, ${st.tryChip})`);
  check(lines.some((l) => l.includes('pressed "Try the box"')) && lines.some((l) => l.includes('pressed "Try again"')), "the log names the alternative pressed");
  check(st.limits.Steps === "500" && st.limits.CPU === "2" && st.limits.Memory === "8", `2.2 selects set by their labels; a missing option changes nothing (${JSON.stringify(st.limits)})`);
  check(lines.some((l) => /has no option "3 GiB"; it offers "4 GiB", "8 GiB"/.test(l)), "a missing option is reported with the options on offer");
  check(st.goldUpload.join() === "gold.py", `5.2 upload went to the input next to "Upload a file" (${st.goldUpload.join()})`);
  check(!st.files.has("/app/data/gold.py") && !st.files.has("/app/data/rtl.json"), "nothing went into the file tree by mistake");
  check(["Dockerfile,report.py,rtl.json,tb_x.v", "Dockerfile,report.py,tb_x.v,rtl.json"].includes(st.verifier.join()), `5.4 verifier list: rtl.json replaced, bench added (${st.verifier.join()})`);
  check(lines.some((l) => l.includes("SKIPPED (optional)")) && /optional steps that failed: \d+/.test(lines[lines.length - 1]), "a failing optional step is logged and the plan goes on");
  check(st.files.get("/app/data/docs/SRS.md") === "7 bytes", "docs/SRS.md replaced by the uploaded copy");
  check(st.files.has("/app/data/docs/VN.md") && st.files.has("/app/data/docs/TAG.md"), "new doc added, untouched doc kept");
  check(st.files.get("/app/data/field/log.csv") === "7 bytes", "field/log.csv replaced");
  check(st.files.has("/app/data/src/a.c"), "unrelated file kept");
  check(st.confirms === 2, `two deletes confirmed (${st.confirms})`);
  check(!st.uploads.some((u) => /^(DUPLICATE|NO-PATH)/.test(u)), `uploads kept their paths without duplicates (${st.uploads.join(", ")})`);
  check(st.boxes["Your steps"] === files["author/steps.txt"], "5.1 filled");
  check(st.verifies === 2 && st.verify === "Ready to run", `Verify ran twice; the second wait ended although the result read the same (${st.verifies})`);
  const htmls = saved.filter((s) => s.name.endsWith(".html"));
  saved.splice(0, saved.length, ...saved.filter((s) => s.name.endsWith(".txt")));
  const names = saved.map((s) => s.name);
  check(saved.length === 19, `19 pages saved (${saved.length})`);
  check(htmls.length === 2, `each failed optional step also saved the page as HTML (${htmls.map((h) => h.name).join(", ")})`);
  const snap = htmls.length ? htmls[htmls.length - 1].text : "";
  check(/^<!doctype html>\n<!-- DOP Builder Helper snapshot\. url: /.test(snap) && !/<script/i.test(snap) && /Remove verifier\/tb_x\.v/.test(snap),
    "the HTML snapshot has its header, no scripts, and the page's markup");
  check(!saved.some((s) => /\nsection: 1 The prompt/.test(s.text)), "1.2's numbered tabs are not taken for sections");
  check(new Set(names).size === names.length, "page names are unique");
  check(!names.some((n) => /^7/.test(n)), "section 7 never saved or opened");
  check(saved.some((s) => s.text.includes("section: 5.4 Scored steps")), "save_all reached 5.4");
  const lagged = saved.filter((s) => {
    const sec = (/\nsection: (\d\.\d)/.exec(s.text) || [])[1];
    const body = (/\nbody: (.*)/.exec(s.text) || [])[1] || "";
    return sec && !/^[345]\./.test(sec) && !body.startsWith(sec);
  }).map((s) => s.name);
  check(!lagged.length, `every numbered page shows its own body, though the mock's body lags the step bar by 450 ms (${lagged.join(", ") || "none lagged"})`);
  check(saved.some((s) => s.text.includes("section: 6.1") && /\nbody: 6\.1 Verify/.test(s.text)), 'the 6.1 score "1.00" is not taken for a number heading');
  check(saved.find((s) => s.name.startsWith("2.4")).text.includes("Worked · 04:12 PM"), "first save shows the finished Try-the-box run");
  check(!st.submitted, "Run was never pressed");

  // A narrow window hides "Screens in this section"; open still works.
  st.narrow = true;
  const o1 = await dopHelper.open("2.4");
  const o2 = await dopHelper.open("5.3");
  check(o1.ok && o2.ok && st.open === "5.3", `open works with the section list hidden (${JSON.stringify([o1, o2])})`);
  st.narrow = false;

  // Pages that differ from the plan: alternatives, dry checks and errors that
  // list what the page offers.
  await dopHelper.open("2.4");
  const alt = await dopHelper.fillBox(["Commands for the box", "Commands to run in the box"], "echo alt");
  check(alt.ok && alt.label === "Commands to run in the box" && st.boxes["Commands to run in the box"] === "echo alt", `fill takes a list of labels and uses the one on the page (${JSON.stringify(alt)})`);
  const dryBox = await dopHelper.fillBox("Commands to run in the box", null);
  check(dryBox.ok && st.boxes["Commands to run in the box"] === "echo alt", "a dry fill changes nothing");
  const miss = await dopHelper.fillBox("Commands for the box", "x");
  check(!miss.ok && /text boxes on this page: "Commands to run in the box"/.test(miss.error), `a missing box names the boxes on the page (${miss.error})`);
  const missBtn = await dopHelper.click("Try it");
  check(!missBtn.ok && /buttons on this page: .*"Try again"/.test(missBtn.error), "a missing button names the buttons on the page");
  const shot = await dopHelper.snapshot();
  check(/<textarea aria-label="Commands to run in the box">echo alt<\/textarea>/.test(shot.html) && /^2\.4-toolchain-\d{8}-\d{6}\.html$/.test(shot.name),
    `the snapshot keeps a typed value in the markup (${shot.name})`);
  await dopHelper.open("2.2");
  const drySel = await dopHelper.choose(["Steps", "Step limit"], "200", { dry: true });
  check(drySel.ok && drySel.label === "Step limit" && st.limits.Steps === "500", `a dry select with alternatives finds "Step limit" and changes nothing (${JSON.stringify(drySel)})`);
  const missSel = await dopHelper.choose("Turns", "200");
  check(!missSel.ok && /selects on this page: .*"CPU"/.test(missSel.error), `a missing select names the selects on the page (${missSel.error})`);
  const missNav = await dopHelper.open("8.1");
  check(!missNav.ok && /navigation entries on this page: .*"5 Golden set"/.test(missNav.error), "a missing section names the sections on the page");
  check(!planCore.validate({ builder: UUID, out: "round2", steps: [{ do: "save", html: true }, { do: "fill", label: ["a", "b"], text: "x" }] }).error, '"out", "html" on save and a list of labels are accepted');
  check(!!planCore.validate({ builder: UUID, out: "../x", steps: [{ do: "save" }] }).error, '"out" may not leave author/');
  check(!!planCore.validate({ builder: UUID, steps: [{ do: "open", section: "2.4", html: true }] }).error, '"html" is refused on steps that save nothing');

  // Refusals.
  check(!!planCore.validate({ builder: UUID, steps: [{ do: "click", text: "Run" }] }).error, 'a plan that clicks "Run" is rejected');
  check(!!planCore.validate({ builder: UUID, steps: [{ do: "click", text: "Generate checks from your steps" }] }).error, "a plan that regenerates checks is rejected");
  check(!!planCore.validate({ builder: UUID, steps: [{ do: "open", section: "7.1" }] }).error, "a plan that opens 7.1 is rejected");
  check(!!planCore.validate({ builder: "x", steps: [{ do: "save" }] }).error, "a plan without a builder uuid is rejected");
  check(!!planCore.validate({ builder: "any", steps: [{ do: "save" }] }).error, '"builder": "any" without a title is rejected');
  check(!planCore.validate({ builder: "any", title: "task-mw3o014d", steps: [{ do: "save" }] }).error, '"builder": "any" with a title is accepted');
  check(!!planCore.validate({ builder: UUID, steps: [{ do: "click", text: ["Try again", "Save and exit"] }] }).error, 'a plan that may click "Save and exit" is rejected');
  check(!!planCore.validate({ builder: UUID, steps: [{ do: "click", label: "Remove verifier/report.py" }] }).error, "a plan that removes the template's report.py is rejected");
  check(!(await dopHelper.open("7")).ok, "page.open refuses section 7");
  check(!(await dopHelper.fillBox("No such box", "x")).ok, "filling a missing box fails");
  check(!(await dopHelper.deleteFile("/app/data/nope.txt")).ok || false, "deleting a missing file fails");
  window.mockState.open = "7.1";
  document.querySelector("nav button").click();   // re-render
  window.mockState.open = "7.1";
  const navTo7 = [...document.querySelectorAll("nav button")].find((b) => b.textContent.replace(/\s+/g, "") === "7Run");
  navTo7.click();
  await new Promise((res) => setTimeout(res, 600));
  const r = await dopHelper.click("Run");
  check(!r.ok && /refused/.test(r.error || ""), `page.click refuses "Run" (${r.error})`);
  check(!st.submitted, "Run still not pressed");
  const anyLog = [];
  try {
    await planCore.run({ builder: "any", title: "ECP-300 coolant pump", steps: [{ do: "save" }] }, io, (l) => anyLog.push(l));
    check(anyLog[0].includes(UUID), `"builder": "any" runs and logs the uuid it found (${anyLog[0]})`);
  } catch (e) {
    check(false, `"builder": "any" runs (${e.message})`);
  }
  try {
    await planCore.run({ builder: "any", title: "task-zzzzzzzz", steps: [{ do: "save" }] }, io, () => {});
    check(false, '"builder": "any" with the wrong title stops');
  } catch (e) {
    check(/does not show/.test(e.message), '"builder": "any" with the wrong title stops');
  }
  try {
    await planCore.run({ builder: "11111111-2222-3333-4444-555555555555", steps: [{ do: "save" }] }, io, () => {});
    check(false, "a plan for another builder stops");
  } catch (e) {
    check(/plan is for/.test(e.message), "a plan for another builder stops");
  }

  // page.js carries the extension's version, and a plan stops on a stale copy.
  let manifest = {};
  try { manifest = await (await fetch("/manifest.json")).json(); } catch (e) { /* checked below */ }
  check(!!manifest.version && dopHelper.version === manifest.version, `page.js says ${dopHelper.version}, manifest.json says ${manifest.version}`);
  check(saved.length > 0 && saved[0].text.includes(`\nhelper: page.js ${manifest.version}\n`), "captures name the page.js version");
  try {
    await planCore.run({ builder: UUID, steps: [{ do: "save" }] }, { ...io, version: "9.9" }, () => {});
    check(false, "a plan stops when the page runs another page.js");
  } catch (e) {
    check(/runs page\.js .* but the extension is 9\.9/.test(e.message), `a plan stops when the page runs another page.js (${e.message})`);
  }
  out.push("", `${fails ? fails + " FAILED" : "ALL PASSED"}`, "", "log:", ...lines);
  document.getElementById("out").textContent = out.join("\n");
})().catch((e) => { document.getElementById("out").textContent = "CRASH " + e.stack; });
