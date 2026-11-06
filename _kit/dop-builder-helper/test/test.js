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
  };
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
      { do: "open", section: "2.4" },
      { do: "fill", label: "Commands to run in the box", from: "author/probes/clean.txt" },
      { do: "click", text: "Try again", wait: { pattern: "Try the box \\w+ · [0-9:]+ [AP]M", busy: "Try the box running", timeout_s: 120 } },
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
      { do: "click", text: "Verify", wait: { pattern: "Correct answer \\d\\.\\d\\d", busy: "Verifying", timeout_s: 120 } },
      { do: "save_all" },
    ],
  };
  const lines = [];
  try {
    check(!planCore.validate(plan).error, "the test plan is valid");
    await planCore.run(plan, io, (l) => lines.push(l));
    check(lines[lines.length - 1] === "Plan finished.", "the plan ran to the end");
  } catch (e) {
    check(false, `the plan ran to the end (stopped: ${e.message})`);
  }
  check(st.boxes["Commands to run in the box"] === files["author/probes/clean.txt"], "Try-the-box commands replaced");
  check(st.tryStatus === "Try the box Worked · 04:10 PM", `waited for the new Try-the-box result (${st.tryStatus})`);
  check(st.files.get("/app/data/docs/SRS.md") === "7 bytes", "docs/SRS.md replaced by the uploaded copy");
  check(st.files.has("/app/data/docs/VN.md") && st.files.has("/app/data/docs/TAG.md"), "new doc added, untouched doc kept");
  check(st.files.get("/app/data/field/log.csv") === "7 bytes", "field/log.csv replaced");
  check(st.files.has("/app/data/src/a.c"), "unrelated file kept");
  check(st.confirms === 2, `two deletes confirmed (${st.confirms})`);
  check(!st.uploads.some((u) => /^(DUPLICATE|NO-PATH)/.test(u)), `uploads kept their paths without duplicates (${st.uploads.join(", ")})`);
  check(st.boxes["Your steps"] === files["author/steps.txt"], "5.1 filled");
  check(/^Correct answer 1\.00/.test(st.verify), "waited for Verify");
  const names = saved.map((s) => s.name);
  check(saved.length === 17, `17 pages saved (${saved.length})`);
  check(new Set(names).size === names.length, "page names are unique");
  check(!names.some((n) => /^7/.test(n)), "section 7 never saved or opened");
  check(saved.some((s) => s.text.includes("section: 5.4 Scored steps")), "save_all reached 5.4");
  check(saved[0].text.includes("Try the box Worked · 04:10 PM"), "first save shows the finished Try-the-box run");
  check(!st.submitted, "Run was never pressed");

  // Refusals.
  check(!!planCore.validate({ builder: UUID, steps: [{ do: "click", text: "Run" }] }).error, 'a plan that clicks "Run" is rejected');
  check(!!planCore.validate({ builder: UUID, steps: [{ do: "click", text: "Generate checks from your steps" }] }).error, "a plan that regenerates checks is rejected");
  check(!!planCore.validate({ builder: UUID, steps: [{ do: "open", section: "7.1" }] }).error, "a plan that opens 7.1 is rejected");
  check(!!planCore.validate({ builder: "x", steps: [{ do: "save" }] }).error, "a plan without a builder uuid is rejected");
  check(!(await dopHelper.open("7")).ok, "page.open refuses section 7");
  check(!(await dopHelper.fillBox("No such box", "x")).ok, "filling a missing box fails");
  check(!(await dopHelper.deleteFile("/app/data/nope.txt")).ok || false, "deleting a missing file fails");
  window.mockState.open = "7.1";
  document.querySelector("nav button").click();   // re-render
  window.mockState.open = "7.1";
  const navTo7 = [...document.querySelectorAll("nav button")].find((b) => b.textContent.startsWith("7 Run"));
  navTo7.click();
  const r = await dopHelper.click("Run");
  check(!r.ok && /refused/.test(r.error || ""), `page.click refuses "Run" (${r.error})`);
  check(!st.submitted, "Run still not pressed");
  try {
    await planCore.run({ builder: "11111111-2222-3333-4444-555555555555", steps: [{ do: "save" }] }, io, () => {});
    check(false, "a plan for another builder stops");
  } catch (e) {
    check(/plan is for/.test(e.message), "a plan for another builder stops");
  }
  out.push("", `${fails ? fails + " FAILED" : "ALL PASSED"}`, "", "log:", ...lines);
  document.getElementById("out").textContent = out.join("\n");
})().catch((e) => { document.getElementById("out").textContent = "CRASH " + e.stack; });
