"""Write a Try-the-box command list that unpacks local files into /tmp/t inline.

Each file travels gzip+base64-encoded in commands of at most 7000 characters,
so nothing private is added to the environment and no command is long enough
to stall the box (one ~20 KB command stayed "running" for over an hour).
Try the box accepts at most 20 commands.

usage: python -I make_probe.py OUT LINESFILE NAME=PATH [NAME=PATH ...]
  OUT        command list to paste into Try the box
  LINESFILE  commands to run after unpacking, one per line
  NAME=PATH  put the local file PATH at /tmp/t/NAME (its sha256 is printed)
"""
import base64
import gzip
import sys

CHUNK = 7000
LIMIT = 20

if len(sys.argv) < 4 or any("=" not in a for a in sys.argv[3:]):
    sys.exit(__doc__)
out, rest = sys.argv[1], sys.argv[2]
with open(rest) as f:
    lines = [ln.rstrip("\n") for ln in f if ln.strip()]
cmds = ["rm -rf /tmp/t && mkdir -p /tmp/t && echo probe-dir-ready"]
for arg in sys.argv[3:]:
    name, path = arg.split("=", 1)
    with open(path, "rb") as f:
        blob = base64.b64encode(gzip.compress(f.read(), mtime=0)).decode()
    parts = [blob[i:i + CHUNK] for i in range(0, len(blob), CHUNK)]
    for part in parts[:-1]:
        cmds.append("echo %s >> /tmp/t/%s.b64" % (part, name))
    cmds.append("echo %s >> /tmp/t/%s.b64 && base64 -d /tmp/t/%s.b64 | gunzip > /tmp/t/%s"
                " && rm /tmp/t/%s.b64 && sha256sum /tmp/t/%s" % (parts[-1], name, name, name, name, name))
cmds += lines
if len(cmds) > LIMIT:
    sys.exit("%d commands, over the limit of %d: split the probe or send fewer files" % (len(cmds), LIMIT))
with open(out, "w", newline="\n") as f:
    f.write("\n".join(cmds) + "\n")
print("%s: %d commands, longest %d chars" % (out, len(cmds), max(len(c) for c in cmds)))
