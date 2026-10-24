"""Smoke test for print-agent/labelprint.py: render, spool source, CLI backend."""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
AGENT = os.path.join(HERE, "..", "print-agent", "labelprint.py")
sys.path.insert(0, os.path.join(HERE, "..", "print-agent"))

import labelprint  # noqa: E402
from PIL import Image  # noqa: E402


def check(cond, msg):
    print(("PASS  " if cond else "FAIL  ") + msg)
    if not cond:
        raise SystemExit(1)


job = {
    "heading": "Smoked Cheddar",
    "subheading": "220 g",
    "rows": [["Packed", "24 Oct 2026"]],
    "body": "Whole milk, salt, cultures.",
    "allergens": "Milk",
    "footer": ["Keep refrigerated"],
}
img = labelprint.render(job)
check(img.width == 696, f"render width {img.width}px")
check(img.height > 250, f"render height {img.height}px")
check(img.mode == "1", "render is 1-bit")

# store payloads are normalised
store = {"kind": "product", "brand": "Rebel Creamery", "title": "Halloumi", "subtitle": "250 g",
         "ingredients": "Milk, salt, rennet.", "allergens": "Milk",
         "meta": ["Packed 24 Oct 2026"], "footer": ["Keep refrigerated"]}
check(labelprint.render(store).height > 250, "store payload renders full height")

with tempfile.TemporaryDirectory() as tmp:
    spool = os.path.join(tmp, "spool")
    out = os.path.join(tmp, "out")
    os.makedirs(spool)
    with open(os.path.join(spool, "cheddar.json"), "w") as fh:
        json.dump(dict(job, copies=2), fh)
    subprocess.run([sys.executable, AGENT, "run", "--source", "spool", "--spool-dir", spool,
                    "--once", "--out-dir", out], check=True, capture_output=True)
    files = sorted(os.listdir(out))
    check(files == ["cheddar-1.png", "cheddar-2.png"], f"spool printed {files}")
    check(os.path.exists(os.path.join(spool, "printed", "cheddar.json")), "job archived to printed/")

print("all labelprint checks passed")
