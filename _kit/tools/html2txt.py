"""Print the visible text of a saved DOP page, plus form values (inputs, textareas, selects)."""
import sys
from html.parser import HTMLParser

SKIP = {"style", "script", "head", "svg"}
BLOCK = {"div", "p", "li", "tr", "h1", "h2", "h3", "h4", "pre", "section", "details", "summary",
         "label", "dt", "dd", "button", "article", "header", "nav", "textarea", "option", "br"}


class Text(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.out = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in SKIP:
            self.skip += 1
            return
        if self.skip:
            return
        if tag in BLOCK:
            self.out.append("\n")
        if tag == "input":
            self.out.append(f"[input {a.get('aria-label') or a.get('placeholder') or ''} = {a.get('value', '')!r}]")
        if tag == "textarea":
            self.out.append(f"[textarea {a.get('aria-label', '')}]\n{a.get('value', '')}\n[/textarea]")
        if tag == "select":
            self.out.append(f"[select value={a.get('value', '')!r}]")
        if tag == "option" and ("selected" in a):
            self.out.append("(selected) ")
        if tag in ("button", "span") and a.get("data-on") == "true":
            self.out.append("(on) ")
        if a.get("aria-checked") is not None:
            self.out.append(f"[checked={a['aria-checked']}] ")
        if a.get("title") and tag in ("span", "button", "a"):
            self.out.append(f"[title: {a['title']}] ")

    def handle_endtag(self, tag):
        if tag in SKIP:
            self.skip = max(0, self.skip - 1)
            return
        if not self.skip and tag in BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if not self.skip and data.strip():
            self.out.append(data.strip() + " ")


p = Text()
with open(sys.argv[1], encoding="utf-8", errors="replace") as f:
    p.feed(f.read())
text = "".join(p.out)
lines = [ln.rstrip() for ln in text.splitlines()]
compact = []
for ln in lines:
    if ln or (compact and compact[-1]):
        compact.append(ln)
sys.stdout.reconfigure(encoding="utf-8")
print("\n".join(compact))
