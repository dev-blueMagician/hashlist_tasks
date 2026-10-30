# DOP Builder Helper (Chrome extension)

Two jobs on the Hashlist DOP builder:

- **Save this page as text.** Writes the live page (text, field values, on/off states) to a `.txt` file named after the open section, for example `5.4-scored-steps-20261030-1405.txt`. On 5.4 the file starts with a table of the scored steps. Fields and texts are quoted there, so stray tabs and spaces show.
- **Fill 5.4 Scored steps.** Sets every row from a steps file. Preview lists the changes first. Fill adds rows with "Add a step" when the page has too few. It never removes a row and never presses "Generate checks".

## Install once

1. Open `chrome://extensions` and switch on Developer mode.
2. Load unpacked, and choose this folder.
3. Pin the extension from Chrome's puzzle-piece menu.

After these files change, press the reload arrow on the extension's card.

## Steps file

`author/scored-steps.json` in the task folder:

```json
{"steps": [
  {"text": "...", "field": "clock_ok", "low": 1, "high": 1, "worth": 1, "wrong": ["naive_a"]}
]}
```

- Rows are filled in order: row 1 gets the first entry.
- `wrong` lists the common mistakes that should fail that step. Every other mistake chip on the row is switched off.
- Only "a value between" is supported.

## Evidence

page.js was tested in headless Chrome 155, against saved builder pages, with a stand-in for the builder's own scripts (`driver_peripheral`, 2026-10-30):

- Fill on the 5.4 page passed 25 checks.
- Capture of the 4.4 MB results page took 0.2 s.

Not yet tested: the save window and the live builder. On the first live use, Preview first, then Fill, then save the page as text so Claude can check the result.
