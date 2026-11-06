# DOP Builder Helper (Chrome extension)

Three jobs on the Hashlist DOP builder: saving a page as text, filling the 5.4 scored-steps table, and running a plan of builder actions in one go.

## Saving a page

- **Save page.** Writes the live page (text, field values, on/off states) to a `.txt` file with no dialog.
  - The file goes to the chosen folder or, if none is chosen, to Chrome's Downloads folder.
  - The name gives the open section and the time to the second, for example `5.4-scored-steps-20261030-140512.txt`.
  - The `open:` line in the file names the open tabs or panels. On a page where opening one tab closes the others, save once per tab.
  - On 5.4 the file starts with a table of the scored steps. Fields and texts are quoted there, so stray tabs and spaces show.
- **also as HTML** (checkbox, remembered). Save page then also writes `<same name>.html`: the page's markup with typed values kept, scripts and CSP removed and the builder's stylesheets inlined. Tick it for a screen that looks new, so the page code can be tested against it (`test/real.js`).
- **Choose folder.** Opens a small window with a folder picker. Pick the task folder, the one that holds `author/` and `package/`; pages then go into its `author/` folder. (Picking `author` itself still works for saving, but plans need the task folder.)
  - Choose again when you switch tasks.
  - "use Downloads" forgets the chosen folder.
- **Permission.** Chrome decides how long the extension may write to the folder. When it needs to ask again, Save opens the small window with an "Allow" button and saves the page once you allow. If Chrome offers "Allow on every visit", choose it.

## Filling 5.4 Scored steps

Press "Fill 5.4 steps" to open the area. Paste the steps file, press Preview, then Fill.

- Fill sets every row in order, adding rows with "Add a step" when the page has too few.
- It never removes a row and never presses "Generate checks".
- Only "a value between" is supported.

The steps file is `author/scored-steps.json` in the task folder:

```json
{"steps": [
  {"text": "...", "field": "clock_ok", "low": 1, "high": 1, "worth": 1, "wrong": ["naive_a"]}
]}
```

`wrong` lists the common mistakes that should fail that step. Every other mistake chip on the row is switched off.

## Running a plan

"Run a plan" opens a window that reads `author/builder-plan.json` (or another path you type) from the task folder, checks it, and carries it out in the builder tab.

1. Open the task in the builder, in one tab only.
2. Press **Preview**. It checks the plan, every file it names, the builder tab and the task title, and lists the steps. Nothing on the page changes.
3. Press **Run**, and keep the window open. **Stop** halts after the current action.
4. Every saved page, and a log `plan-log-<time>.txt`, go into `author/` (or `author/<out>/`). If a step fails, the plan stops there and saves the page as it was, as `plan-stop-page-<time>.txt` and `.html`.

### When a screen is not what the plan expects

- The error names what the page does offer: "0 labelled "X"; text boxes on this page: …", and the same for buttons, selects and navigation entries. The log alone usually shows the new label.
- A failed optional step, a screen `save_all` could not open, and the stop page are also saved as HTML. Run `node test/real.js page.html` (add `--width=800` for a narrow window) to see what the page code finds there: section, body heading, task id, save state, nav entries, boxes, selects, buttons, upload inputs, Try/Verify buttons and 5.4 rows.
- Where a label may differ, give `fill` and `select` a list of labels; the first that names exactly one element is used.
- Preview checks `click`, `upload`, `fill` and `select` steps on the section that is open, without changing anything.

A plan is JSON:

```json
{
  "builder": "<uuid from the builder address, or \"any\">",
  "title": "<task title or task-… id, checked on the page>",
  "out": "round2",
  "steps": [
    { "do": "open", "section": "2.2" },
    { "do": "select", "label": "Step limit", "option": "500" },
    { "do": "open", "section": "2.4" },
    { "do": "fill", "label": "Commands to run in the box", "from": "author/probes/x.txt" },
    { "do": "click", "text": ["Try the box", "Try again", "Try the changed box"],
      "wait": { "pattern": "(Worked|\\d+ failed|Some failed|Answer in the box|Script in the box|Didn't build|Cancelled) · \\d{1,2}:\\d\\d", "busy": "Trying", "timeout_s": 900 } },
    { "do": "delete", "path": "/app/data/docs/old.md" },
    { "do": "upload", "folder": "author/upload/docs" },
    { "do": "upload", "files": [{ "from": "package/verifier/rtl.json", "rel": "rtl.json" }], "near": "Add a file" },
    { "do": "click", "label": "Remove verifier/rtl.json" },
    { "do": "fill_steps", "from": "author/scored-steps.json" },
    { "do": "save" },
    { "do": "save_all", "html": true },
    { "do": "pause", "message": "Check the tree, then press Continue" }
  ]
}
```

- `out` (optional) is a folder inside `author/` for this plan's pages and log, such as `round2`. It is created if missing.
- `"html": true` on `save` or `save_all` also saves each page as `.html`.

- `builder` is the uuid in the address. `"any"` takes the one open builder tab and needs a `title`; the log names the uuid it found, for later plans. A new task shows its `task-…` id where the title will go.
- `fill` puts text from a file (or `"text"`) into the box or text input with that label (or the first of a list of labels that is on the page), then waits for "Saved".
- `select` picks an option in the select with that label (its own aria-label, or the text next to it, as on 2.2: "CPU", "Step limit"). It matches the option's text, then its value, then text that starts with it ("4" fits "4 cores"), and reads the select back.
- `click` presses the one element with exactly that text, or with `label`, the one whose aria-label or title is exactly that. `text` can be a list: the first one on the page is pressed and the log says which. When a heading and a button read the same, the button wins. With `wait`, it waits until the pattern matches, `busy` no longer matches, and either the match changed or busy was seen.
- `delete` opens the file from the tree and presses its Delete button.
- `upload` with `folder` sends the folder as "Upload a folder" does: paths start with the folder's own name, so `author/upload/docs` lands in `/app/data/docs/`. With `files` (each `from` and `rel`) it sends single files. `near` names the button whose input to use ("Add a file" on 5.4, "Upload a file" on 5.2 and 5.3); without it the file tree's input is used.
- `save_all` opens every section from 1 to 6 and saves each sub-section. A section that will not open is logged and skipped.
- `"optional": true` on any step logs a failure, saves the page and goes on. Without it the plan stops there.
- It never opens section 7 and never clicks Run, Submit, "Replace and copy", "Generate checks", "Save and exit", "Fix it", or Remove on the template's `verifier/Dockerfile` or `report.py`. Both the plan check and the page code refuse them.
- Preview also looks up the buttons and upload inputs of steps on the section that is open, without pressing anything, and prints "NOT FOUND NOW" for any it cannot find.

### The builder's own texts

From its scripts (`SectionFiles-C9Ky-b_k.js`, `Builder-DwGBaEVn.js`, 2026-11-05). Use them for `click` and `wait`:

| Place | Button | While busy | Result |
| --- | --- | --- | --- |
| 2.4 Try the box | "Try the box", then "Try again"; "Try the changed box" after the box itself changed | "Trying…" | chip "Worked · 05:30 PM", "N failed", "Some failed", "Answer in the box", "Script in the box", "Didn't build" or "Cancelled", then " · " and the time in the browser's locale |
| 6.1 Verify | "Verify my task", then "Verify again" | "Verifying…", "Checking your task…" | "Ready to run", "N problem(s) to fix", or "The check could not finish." ("Not checked yet" before the first) |
| Header | — | "Saving" | "Saved" or "Unsaved" |

In `innerText` the chip runs straight on from its heading ("Try the boxWorked · 05:30 PM"), so start the pattern at the chip. Waits see the page text with runs of white space as one space.

### Narrow windows

At 960 px wide or less the builder hides "Screens in this section" (`@media (width<=960px) { .side2 { display: none } }`); half of a 1920 px screen is exactly 960 px. `open` still works, because it clicks those hidden buttons, which the builder still answers. To read the pages yourself, make the window wider.

## Install and update

1. Open `chrome://extensions` and switch on Developer mode.
2. Load unpacked, and choose this folder.
3. Pin the extension from the puzzle-piece menu.

After these files change, press the reload arrow on the extension's card.

Check which copy runs. The reload arrow reloads the folder the card was loaded from; a newer copy unzipped elsewhere is not picked up. Preview's first line and each plan log's `extension:` line give the version (since 2.3).

- Seen 2026-11-06 (`HDL_mw3o014d_Trung/author/round2/` and `round3/`): captures had no `body:` line and showed the previous screen. Round 3's log said `extension: 2.3`, so the runner was new, but the page was still running a `page.js` injected in an earlier round. The builder is a single page that does not reload by itself, and the runner injected `page.js` only when none was present.
- Since 2.4, each runner window injects its own `page.js` on its first call. `page.js` carries `VERSION`, which must equal manifest.json's version (test.js checks this). Captures carry a `helper: page.js <version>` line, and Preview and Run stop when the page's copy differs from the extension's.
- When moving a new copy in, remove the old card and load the new folder, or copy the new files over the folder the card points to and reload. Reload the builder tab too (F5).

## Evidence

Tested in headless Chrome 155 (`driver_peripheral`, 2026-10-30):

- **page.js:** 28 checks on the saved 5.4 page, with a stand-in for the builder's scripts. A capture of the 4.4 MB results page took 0.2 s.
- **popup.js and folder.js:** 27 checks with stand-ins for Chrome's extension functions and the folder picker. File writes went to a real browser-managed folder.

Plan runner (2026-11-05, `realtime_budget`): `node test/run.js` serves a stand-in builder (`test/mock.js`, built from saved pages) and runs `test/test.js` in headless Chrome 155. 28 checks pass:

- a full plan: Try the box, deleting two files, uploading two folders with no duplicates, filling 5.1, Verify, and saving 17 pages;
- every refusal: Run, section 7, "Generate checks", another builder's plan.

Version 2.1 (2026-11-05, `HDL_mw3o014d_Trung`):

- `node test/run.js`: 43 checks pass. The stand-in now copies the builder's real Try-the-box and Verify states, the 2.2 selects, the RTL 5.4 `verifier/` list, 5.2's own upload input, 1.2's numbered tabs and a hidden section list.
- `page.js` was also run against 10 real saved builder pages, scripts removed, at 800 and 1400 px (scratch harness, not kept). It found the section, the nav entries (hidden ones included), "Saved", the task id, and these:
  - "Try again" and "Verify again" as buttons, with the Try chip and "Ready to run" matched;
  - "Remove verifier/rtl.json" as one button, while a bare "Remove" was refused as ambiguous;
  - the upload input next to "Add a file" (5.4) and "Upload a file" (5.2), rather than the file tree's.
- No 2.2 page was saved as HTML, so `select` is tested only on the stand-in.

First live run (2026-11-06, `HDL_mw3o014d_Trung/author/round1/`): the runner window, folder access, the tab lookup with `"builder": "any"`, `open`, `save_all`, optional clicks and the stop page all worked. It showed that the builder renders a screen's body after its step bar, so saves and fills came one screen early. `open` now waits for the body's number heading and steady text, and captures carry a `body:` line. With the stand-in's body made to lag by 450 ms, 45 checks pass, including "every numbered page shows its own body".

Version 2.2 (2026-11-05, `HDL_mw3wykhl_Yeal`), Chrome 156:

- `node test/run.js`: 58 checks pass. The 13 new ones cover label lists, dry fill and select, errors that list what the page offers, HTML snapshots (header, no scripts, a typed value kept in the markup), `out` and `html` validation.
- `node test/real.js` on 6 real saved pages (HDL 1.1 and 5.4; `driver_peripheral` 3.1, 5.2, 5.4c, 6c) at 1400 px, and 5.2 at 800 px. It found the section, every nav entry, "Saved", the 5.4 rows, the inputs next to "Add a file", "Upload a file", "Upload files" and "Upload a folder", and "Verify again".
- File names use the browser's clock and time zone. The live captures showed GMT−0700 on one day and GMT+0700 on another, while the PC's shell runs on EST. Use file times, not names, to order files from different days.

Not tested:

- on the live builder: `select`, `fill`, `upload`, `delete`, `fill_steps`, waits and `snapshot` (next plans);
- how large a snapshot of the live builder is, with its stylesheets inlined;
- the real folder picker;
- Chrome's permission prompt, and how long it keeps the permission for an extension;
- downloads, and the live builder.
