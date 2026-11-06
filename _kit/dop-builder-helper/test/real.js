// Runs page.js against real saved builder pages and prints what it sees:
// section, body heading, task id, save state, navigation entries, text boxes,
// selects, buttons and upload inputs. Use it when a screen differs from what a
// plan expects: save the page as HTML (popup "also as HTML", "html": true in a
// plan, or the plan-stop-page-*.html a failed plan leaves), then run
//   node test/real.js [--width=800] page.html [more.html ...]
// Scripts and any CSP are removed first, so only page.js runs.
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const root = path.resolve(__dirname, "..");
const chrome = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const args = process.argv.slice(2);
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=1400").split("=")[1]);
const pages = args.filter((a) => !a.startsWith("--"));
if (!pages.length) { console.log("usage: node test/real.js [--width=800] page.html ..."); process.exit(2); }

// Inside the page: what each lookup that plans rely on finds.
const REPORT = `<script src="/page.js"></script><script>
(async () => {
  const h = globalThis.dopHelper, out = [];
  const i = h.info();
  const cap = h.capture().text.split("\\n");
  const line = (k) => (cap.find((l) => l.startsWith(k + ": ")) || "").slice(k.length + 2);
  out.push("section: " + (i.section || "(not found)"), "body: " + line("body"), "open: " + line("open"),
    "task: " + (i.task || "(not found)"), "builder: " + (i.builder || "(no uuid in the address)"), "saved: " + (i.saved || "(no indicator)"));
  out.push("nav: " + h.sections().items.map((n) => n.id + " " + n.label).join(" | "));
  const vis = (e) => !!(e.offsetParent || e.getClientRects().length);
  const name = (e) => e.getAttribute("aria-label") || e.getAttribute("placeholder") || e.name || e.id || "";
  out.push("text boxes: " + [...document.querySelectorAll("textarea, input:not([type]), input[type=text]")].filter(vis).map((e) => JSON.stringify(name(e))).join(", "));
  const r = await h.choose("\\u0000no such select", "x");
  out.push("selects: " + ((/selects on this page: (.*)$/.exec(r.error || "") || [])[1] || "none"));
  const b = await h.click("\\u0000no such button");
  out.push("buttons: " + ((/buttons on this page: (.*)$/.exec(b.error || "") || [])[1] || "none"));
  const ups = [...document.querySelectorAll('input[type="file"]')];
  out.push("upload inputs: " + ups.length + " (" + ups.filter((u) => u.hasAttribute("webkitdirectory")).length + " for folders)");
  for (const near of ["Add a file", "Upload a file", "Upload files", "Upload a folder"]) {
    const kind = near === "Upload a folder" ? "folder" : "files";
    const u = await h.upload(null, kind, near);
    if (u.ok || !/^0 /.test(u.error)) out.push("  next to " + JSON.stringify(near) + ": " + (u.ok ? "found" : u.error.split(";")[0]));
  }
  for (const t of [["Try the box", "Try again", "Try the changed box"], ["Verify my task", "Verify again"]]) {
    const c = await h.click(t, { dry: true });
    if (c.ok) out.push("would press " + JSON.stringify(c.pressed));
  }
  const steps = h.capture().text.match(/^\\| \\d+ \\|.*$/gm) || [];
  if (steps.length) out.push("5.4 rows: " + steps.length);
  document.body.insertAdjacentHTML("beforeend", '<pre id="dop-report"></pre>');
  document.getElementById("dop-report").textContent = out.join("\\n");
})().catch((e) => { document.body.insertAdjacentHTML("beforeend", '<pre id="dop-report"></pre>'); document.getElementById("dop-report").textContent = "CRASH " + e.stack; });
</script>`;

function clean(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<meta[^>]+content-security-policy[^>]*>/gi, "")
    .replace(/<\/body>(?![\s\S]*<\/body>)/i, REPORT + "</body>");
}

let current = "";
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url.startsWith("/app/build/")) { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(current); return; }
  if (url === "/page.js") { res.writeHead(200, { "content-type": "text/javascript" }); res.end(fs.readFileSync(path.join(root, "page.js"))); return; }
  res.writeHead(404); res.end();
});

server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  (async () => {
    for (const p of pages) {
      let html = fs.readFileSync(p, "utf8");
      if (!/<\/body>/i.test(html)) html += "</body>";
      current = clean(html);
      // Keep the page's own builder address when the snapshot header has one.
      const m = /\/app\/build\/([0-9a-f-]{36})\/([\w-]*)/.exec(html.slice(0, 600));
      const at = m ? `/app/build/${m[1]}/${m[2]}` : "/app/build/00000000-0000-0000-0000-000000000000/page";
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dop-real-"));
      let dom = "";
      try {
        dom = await new Promise((resolve) => {
          execFile(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`,
            `--window-size=${width},1000`, "--virtual-time-budget=20000", "--dump-dom", `http://127.0.0.1:${port}${at}`],
            { timeout: 120000, maxBuffer: 1 << 28 }, (err, stdout) => resolve(stdout || (err ? "ERR " + err.message : "")));
        });
      } finally {
        fs.rmSync(profile, { recursive: true, force: true });
      }
      // The last one: the report script itself contains the same tag as text.
      const r = /<pre id="dop-report">([\s\S]*?)<\/pre>/.exec(dom.slice(dom.lastIndexOf('<pre id="dop-report">')));
      const text = r ? r[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&") : "no report: " + dom.slice(0, 200);
      console.log(`=== ${path.basename(p)} (${width} px)\n${text}\n`);
    }
    server.close();
  })();
});
