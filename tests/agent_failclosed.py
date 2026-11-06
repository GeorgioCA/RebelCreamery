"""Fail-closed checks for the print agent (audit fix F6).

- logo field resolves only inside the agent's own directory
- HTTP intake refuses to bind beyond loopback without --token
Run: python tests/agent_failclosed.py
"""
import importlib.util
import io
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "print-agent"))

spec = importlib.util.spec_from_file_location("labelprint", os.path.join(ROOT, "print-agent", "labelprint.py"))
lp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lp)

failures = []
def check(label, cond, detail=""):
    print(("PASS  " if cond else "FAIL  ") + label + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        failures.append(label)

# logo allow-list
outside = os.path.join(tempfile.gettempdir(), "rc-outside-logo.png")
with open(outside, "wb") as fh:
    fh.write(b"not a real image, but a plausible path")
inside = os.path.join(ROOT, "print-agent", "rc-inside-logo.png")
with open(inside, "wb") as fh:
    fh.write(b"not a real image either")

check("logo inside agent dir is allowed", lp.logo_allowed(inside))
check("logo outside agent dir is refused", not lp.logo_allowed(outside))
check("logo traversal via parent ref is refused", not lp.logo_allowed("../AGENTS.md"))
os.unlink(outside)
os.unlink(inside)

# render() must skip the outside logo, not open it
job = {"heading": "Test", "rows": [], "items": [], "footer": [], "logo": outside.replace("\\", "/")}
try:
    img = lp.render(job)
    check("render ignores an outside logo", img.size[0] == lp.WIDTH_PX)
except Exception as e:
    check("render ignores an outside logo (threw %s)" % e, False)

# fail-closed http source — via build_source() so nothing actually binds long-term
import argparse

def source_exit(host, token):
    ns = argparse.Namespace(source="http", host=host, token=token, port=8098)
    try:
        return lp.build_source(ns)
    except SystemExit as e:
        return str(e)

try:
    src = source_exit("0.0.0.0", "")
    check("http source on 0.0.0.0 without token is refused", src is not None and "requires --token" in src, str(src))
except Exception as e:
    check("http source on 0.0.0.0 without token is refused (threw %s)" % e, False)

try:
    src = source_exit("0.0.0.0", "secret")
    # NB: src.stop() would deadlock here (serve_forever() was never started —
    # stdlib shutdown() waits on that loop); close the socket instead.
    check("http source with token binds anywhere", type(src).__name__ == "HttpSource")
    src.server.server_close()
except Exception as e:
    check("http source with token binds anywhere (threw %s)" % e, False)

try:
    src = source_exit("127.0.0.1", "")
    check("http source without token on loopback starts", type(src).__name__ == "HttpSource")
    src.server.server_close()
except Exception as e:
    check("http source without token on loopback starts (threw %s)" % e, False)

print()
print(("FAILURES: " + ", ".join(failures)) if failures else "all print-agent fail-closed checks passed")
sys.exit(1 if failures else 0)
