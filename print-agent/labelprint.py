#!/usr/bin/env python3
"""
labelprint — a small background label printer for the Brother QL-800 (and anything else).

One script, three ways in, three ways out:

  sources   store   poll the Rebel Creamery order book for queued labels
            spool   watch a directory for *.json job files (drop-in for any app/cron job)
            http    POST jobs to it from anywhere on the LAN

  backends  brother  direct USB via brother_ql (QL-800/810W/820NWB, 62 mm tape)
            cups     anything with a CUPS queue (Brother driver, Dymo, office laser)
            file     write PNGs to a folder — dry run, or "print" to a network share

Examples
  labelprint.py preview job.json -o label.png
  labelprint.py print --heading "Cold Brew" --sub "1 L" --body "Best before 12 Nov" --copies 4
  labelprint.py run --source spool --spool-dir /var/spool/labels --backend brother
  labelprint.py run --source store --store-url https://shop.example.ca --token … --backend brother
  labelprint.py serve --port 8099 --backend brother        # LAN print endpoint
  labelprint.py printers

Job JSON (everything is optional except a heading or an image):

  {
    "heading": "Smoked Cheddar",
    "subheading": "220 g",
    "logo": "/path/to/logo.png",
    "rows": [["Packed", "24 Oct 2026"], ["Best before", "21 Nov 2026"]],
    "items": [{"qty": 2, "name": "Yogurt 750 g"}],
    "body": "Whole milk, salt, cultures, microbial rennet.",
    "allergens": "Milk",
    "footer": ["Keep refrigerated", "Rebel Creamery · Calgary, AB"],
    "copies": 2,
    "height_mm": 40,
    "printer": "brother"
  }
"""
from __future__ import annotations

import argparse
import glob
import io
import json
import logging
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image, ImageDraw, ImageFont

LOG = logging.getLogger("labelprint")

# 62 mm tape at 300 dpi = 696 printable dots. Everything is laid out against this.
WIDTH_PX = 696
MARGIN = 26
# Global type scale for printed labels. 1.2 = everything 20% larger than the
# original 62 mm layout; raise or lower this one number to re-tune the whole label.
TEXT_SCALE = 1.2
FONT_DIRS = [
    "/usr/share/fonts/truetype/dejavu",
    "/usr/share/fonts/dejavu",
    "/usr/share/fonts/truetype/liberation",
    "/Library/Fonts",
    "/System/Library/Fonts/Supplemental",
    "C:/Windows/Fonts",
]
BOLD = ["DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf", "Arial Bold.ttf", "arialbd.ttf"]
REGULAR = ["DejaVuSans.ttf", "LiberationSans-Regular.ttf", "Arial.ttf", "arial.ttf"]


# --------------------------------------------------------------------------- fonts
_cache: dict[tuple[int, bool], ImageFont.FreeTypeFont] = {}


def font(size: int, bold: bool = False):
    size = max(8, round(size * TEXT_SCALE))
    key = (size, bold)
    if key in _cache:
        return _cache[key]
    for directory in FONT_DIRS:
        for name in BOLD if bold else REGULAR:
            path = os.path.join(directory, name)
            if os.path.exists(path):
                _cache[key] = ImageFont.truetype(path, size)
                return _cache[key]
    _cache[key] = ImageFont.load_default(size)
    return _cache[key]


def wrap(draw, text, fnt, max_width):
    lines, line = [], ""
    for word in str(text).split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=fnt) <= max_width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


# ------------------------------------------------------------------------ renderer
def normalize(job: dict) -> dict:
    """Accept both the store's label payloads and the generic job shape."""
    if job.get("kind") not in ("order", "product"):
        return job
    out = dict(job)
    out.setdefault("heading", job.get("title"))
    out.setdefault("subheading", job.get("subtitle"))
    out.setdefault("body", job.get("ingredients"))
    rows = []
    if job.get("person"):
        rows.append(["Customer", job["person"]])
    for meta in job.get("meta") or []:
        rows.append(["", meta])
    out["rows"] = rows
    return out


def render(job: dict, width: int = WIDTH_PX) -> Image.Image:
    """Render a job dict to a 1-bit image `width` pixels across."""
    job = normalize(job)
    margin = int(job.get("margin", MARGIN))
    inner = width - 2 * margin
    fixed_height = None
    if job.get("height_mm"):
        fixed_height = max(80, round(float(job["height_mm"]) / 25.4 * 300))

    canvas = Image.new("L", (width, fixed_height or 2400), 255)
    d = ImageDraw.Draw(canvas)
    y = margin

    logo_path = job.get("logo")
    if logo_path and os.path.exists(logo_path):
        logo = Image.open(logo_path).convert("L")
        scale = min(inner / logo.width, 150 / logo.height, 1.0)
        if scale < 1.0:
            logo = logo.resize((max(1, int(logo.width * scale)), max(1, int(logo.height * scale))))
        canvas.paste(logo, (margin, y))
        y += logo.height + 12

    brand = job.get("brand")
    if brand:
        f = font(19, bold=True)
        d.text((margin, y), " ".join(str(brand).upper()), font=f, fill=0)
        y += int(f.size * 1.5)
        d.line([(margin, y), (width - margin, y)], fill=0, width=3)
        y += 12

    heading = job.get("heading") or job.get("title")
    if heading:
        f = font(int(job.get("heading_size", 54)), bold=True)
        for line in wrap(d, heading, f, inner):
            d.text((margin, y), line, font=f, fill=0)
            y += int(f.size * 1.12)

    sub = job.get("subheading") or job.get("subtitle")
    if sub:
        y += 4
        f = font(int(job.get("subheading_size", 33)), bold=True)
        for line in wrap(d, sub, f, inner):
            d.text((margin, y), line, font=f, fill=0)
            y += int(f.size * 1.3)

    if job.get("rule", True):
        y += 8
        d.line([(margin, y), (width - margin, y)], fill=0, width=3)
        y += 12

    for row in job.get("rows") or []:
        label, value = (row + ["", ""])[:2] if isinstance(row, list) else (row.get("label"), row.get("value"))
        if label:
            f = font(18, bold=True)
            d.text((margin, y), str(label).upper(), font=f, fill=0)
            y += f.size + 2
        f = font(28)
        for line in wrap(d, value, f, inner):
            d.text((margin, y), line, font=f, fill=0)
            y += int(f.size * 1.25)
        y += 6

    items = job.get("items") or []
    if items:
        y += 4
        f = font(30)
        for item in items:
            text = f"{item.get('qty', 1)}x  {item.get('name', '')}"
            for line in wrap(d, text, f, inner):
                d.text((margin, y), line, font=f, fill=0)
                y += int(f.size * 1.22)
            y += 2

    body = job.get("body") or job.get("ingredients")
    if body:
        y += 10
        f = font(22)
        for line in wrap(d, body, f, inner):
            d.text((margin, y), line, font=f, fill=0)
            y += int(f.size * 1.28)

    allergens = job.get("allergens")
    if allergens:
        y += 10
        f = font(24, bold=True)
        box_h = int(f.size * 1.9)
        d.rectangle([(margin, y), (width - margin, y + box_h)], outline=0, width=3)
        d.text((margin + 12, y + int(f.size * 0.34)), f"Contains: {allergens}", font=f, fill=0)
        y += box_h + 10

    footer = job.get("footer") or []
    if footer:
        y += 10
        if job.get("footer_rule", True):
            d.line([(margin, y), (width - margin, y)], fill=0, width=2)
            y += 12
        f = font(19)
        for line in footer:
            for wrapped in wrap(d, line, f, inner):
                d.text((margin, y), wrapped, font=f, fill=0)
                y += int(f.size * 1.3)

    y += margin
    if fixed_height:
        if y > fixed_height:
            LOG.warning("content is %d px tall but height_mm allows %d px — it will be cropped", y, fixed_height)
            canvas = canvas.crop((0, 0, width, fixed_height))
        else:
            canvas = canvas.crop((0, 0, width, fixed_height))
    else:
        canvas = canvas.crop((0, 0, width, min(y, canvas.height)))
    return canvas.convert("1")


# ------------------------------------------------------------------- job building
def job_from_args(args) -> dict:
    job = {
        "heading": args.heading,
        "subheading": args.sub,
        "body": args.body,
        "allergens": args.allergens,
        "copies": args.copies,
        "printer": args.printer,
    }
    if args.row:
        job["rows"] = [r.split("=", 1) for r in args.row if "=" in r]
    if args.footer:
        job["footer"] = args.footer
    if args.height_mm:
        job["height_mm"] = args.height_mm
    if args.logo:
        job["logo"] = args.logo
    return {k: v for k, v in job.items() if v not in (None, [], "")}


# ---------------------------------------------------------------------- backends
def save_png(img: Image.Image, directory: str, name: str) -> str:
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, f"{name}.png")
    img.save(path)
    return path


def print_brother(img: Image.Image, job: dict, args):
    try:
        from brother_ql.backends.helpers import send
        from brother_ql.conversion import convert
        from brother_ql.raster import BrotherQLRaster
    except ImportError:
        raise RuntimeError("brother_ql is not installed (pip install brother_ql)")

    qlr = BrotherQLRaster(job.get("model") or args.model)
    cut = job.get("cut", not getattr(args, "no_cut", False))
    convert(qlr, images=[img], label=job.get("label") or args.label,
            cut=cut, dpi_600=False)
    send(instructions=qlr.data, printer_identifier=job.get("device") or args.device,
         backend_identifier="pyusb", blocking=True)


def print_cups(img: Image.Image, job: dict, args):
    queue = job.get("queue") or args.queue
    if not queue:
        raise RuntimeError("--queue is required for the cups backend")
    if not shutil.which("lp"):
        raise RuntimeError("lp not found — install CUPS client tools")
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        img.save(tmp.name)
        path = tmp.name
    try:
        cmd = ["lp", "-d", queue, "-o", "fit-to-page", path]
        if job.get("media"):
            cmd += ["-o", f"media={job['media']}"]
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if out.returncode != 0:
            raise RuntimeError(out.stderr.strip() or "lp failed")
        LOG.info("cups: %s", out.stdout.strip())
    finally:
        os.unlink(path)


def emit(img: Image.Image, job: dict, args, name: str):
    backend = job.get("printer") or args.backend
    if args.backend == "file" or backend == "file":
        LOG.info("file: %s", save_png(img, args.out_dir, name))
    elif backend == "brother":
        print_brother(img, job, args)
        LOG.info("brother: printed %s", name)
    elif backend == "cups":
        print_cups(img, job, args)
        LOG.info("cups: printed %s", name)
    else:
        raise RuntimeError(f"unknown backend/Printer {backend!r}")


def print_job(job: dict, args, name: str | None = None):
    copies = max(1, min(50, int(job.get("copies") or 1)))
    img = render(job, width=int(job.get("width_px", WIDTH_PX)))
    name = name or time.strftime("label-%Y%m%d-%H%M%S")
    for i in range(copies):
        emit(img, job, args, f"{name}-{i + 1}" if copies > 1 else name)
    return img


# ----------------------------------------------------------------------- sources
class StoreSource:
    """Polls the Rebel Creamery order book for queued labels."""

    def __init__(self, url, token, limit=10):
        import requests  # local import: only this source needs it
        self.requests = requests
        self.url = url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {token}"}
        self.limit = limit

    def poll(self):
        r = self.requests.get(f"{self.url}/api/print/jobs", headers=self.headers,
                              params={"limit": self.limit}, timeout=20)
        if r.status_code == 401:
            raise RuntimeError("print token rejected by the store")
        r.raise_for_status()
        jobs = []
        for row in r.json().get("jobs", []):
            # API rows are {id, copies, payload:{...}} — flatten for the renderer.
            job = dict(row.get("payload") or {})
            job["_id"] = row["id"]
            job.setdefault("copies", row.get("copies", 1))
            jobs.append(job)
        return jobs

    def ack(self, job, ok, error=None):
        self.requests.post(
            f"{self.url}/api/print/jobs/{job['_id']}/done",
            headers=self.headers,
            json={"status": "printed" if ok else "error", "error": (error or "")[:300]},
            timeout=20,
        )

    def name(self, job):
        return f"store-{job['_id']}"


class SpoolSource:
    """Drops a *.json file in a directory and it gets printed; then it is archived."""

    def __init__(self, directory):
        self.dir = directory
        self.done = os.path.join(directory, "printed")
        self.failed = os.path.join(directory, "failed")
        os.makedirs(self.done, exist_ok=True)
        os.makedirs(self.failed, exist_ok=True)

    def poll(self):
        jobs = []
        for path in sorted(glob.glob(os.path.join(self.dir, "*.json"))):
            try:
                with open(path) as fh:
                    job = json.load(fh)
                job["_path"] = path
                jobs.append(job)
            except Exception as exc:
                LOG.error("bad job file %s: %s", path, exc)
                shutil.move(path, os.path.join(self.failed, os.path.basename(path)))
        return jobs

    def ack(self, job, ok, error=None):
        path = job["_path"]
        target = self.done if ok else self.failed
        shutil.move(path, os.path.join(target, os.path.basename(path)))

    def name(self, job):
        return os.path.splitext(os.path.basename(job["_path"]))[0]


class HttpSource:
    """Minimal LAN endpoint: POST a job JSON (or raw PNG) to /print."""

    def __init__(self, host, port, token=None, args=None):
        self.token = token
        self.args = args
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, fmt, *a):
                LOG.debug("%s - %s", self.address_string(), fmt % a)

            def _auth(self):
                if not outer.token:
                    return True
                given = (self.headers.get("X-Print-Token")
                         or (self.headers.get("Authorization") or "").replace("Bearer ", ""))
                return given == outer.token

            def _json(self, code, payload):
                body = json.dumps(payload).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                if self.path.startswith("/health"):
                    self._json(200, {"ok": True, "backend": outer.args.backend})
                else:
                    self._json(404, {"error": "not found"})

            def do_POST(self):
                if not self.path.startswith("/print"):
                    return self._json(404, {"error": "not found"})
                if not self._auth():
                    return self._json(401, {"error": "bad token"})
                length = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(length)
                try:
                    if self.headers.get("Content-Type", "").startswith("image/"):
                        img = Image.open(io.BytesIO(raw))
                        emit(img.convert("1"), {}, outer.args, time.strftime("http-%Y%m%d-%H%M%S"))
                    else:
                        job = json.loads(raw or b"{}")
                        print_job(job, outer.args)
                    self._json(200, {"ok": True})
                except Exception as exc:
                    LOG.exception("http job failed")
                    self._json(500, {"error": str(exc)})

        self.server = ThreadingHTTPServer((host, port), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def start(self):
        self.thread.start()
        LOG.info("listening on http://%s:%d/print", *self.server.server_address[:2])

    def poll(self):
        return []

    def ack(self, job, ok, error=None):
        pass

    def name(self, job):
        return "http"

    def stop(self):
        self.server.shutdown()


# -------------------------------------------------------------------------- run
def run(args):
    source = build_source(args)
    if isinstance(source, HttpSource):
        source.start()

    LOG.info("ready — source=%s backend=%s", args.source, args.backend)
    while not args._stop.is_set():
        try:
            jobs = source.poll()
        except Exception as exc:
            LOG.error("poll failed: %s", exc)
            jobs = []

        for job in jobs:
            try:
                print_job(job, args, name=source.name(job))
                source.ack(job, True)
            except Exception as exc:
                LOG.error("job failed: %s", exc)
                try:
                    source.ack(job, False, str(exc))
                except Exception:
                    LOG.exception("could not acknowledge failed job")

        if args.once:
            break
        args._stop.wait(args.interval)

    if isinstance(source, HttpSource):
        source.stop()


def build_source(args):
    if args.source == "store":
        if not args.store_url or not args.token:
            sys.exit("--store-url and --token are required for the store source")
        return StoreSource(args.store_url, args.token, args.limit)
    if args.source == "spool":
        if not args.spool_dir:
            sys.exit("--spool-dir is required for the spool source")
        os.makedirs(args.spool_dir, exist_ok=True)
        return SpoolSource(args.spool_dir)
    if args.source == "http":
        return HttpSource(args.host, args.port, args.token, args)
    sys.exit(f"unknown source {args.source!r}")


def list_printers():
    try:
        from brother_ql.backends.helpers import discover
        found = discover()
        print("brother (pyusb):")
        for p in found:
            print("  ", p.get("identifier"), p.get("model") or "")
        if not found:
            hint = (
                "check the cable and the WinUSB binding from Zadig"
                if os.name == "nt"
                else "check the USB cable and the udev rule"
            )
            print("   none detected (" + hint + ")")
    except Exception as exc:
        print("brother: unavailable —", exc)
    if shutil.which("lpstat"):
        out = subprocess.run(["lpstat", "-p"], capture_output=True, text=True)
        print("cups queues:")
        print(out.stdout.strip() or "   none configured")
    else:
        print("cups: lpstat not installed")


# ------------------------------------------------------------------------- main
def main(argv=None):
    p = argparse.ArgumentParser(prog="labelprint", description="Background label printer for QL-800 and friends.")
    p.add_argument("-v", "--verbose", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)

    def backend_flags(sp):
        sp.add_argument("--backend", choices=["file", "brother", "cups"], default="file")
        sp.add_argument("--out-dir", default="./labels")
        sp.add_argument("--device", default=os.environ.get("PRINTER", "usb://0x04f9:0x209b"))
        sp.add_argument("--model", default=os.environ.get("PRINTER_MODEL", "QL-800"))
        sp.add_argument("--label", default=os.environ.get("LABEL", "62"))
        sp.add_argument("--no-cut", action="store_true", help="do not cut after each label")
        sp.add_argument("--queue", default=os.environ.get("CUPS_QUEUE"))

    runp = sub.add_parser("run", help="run as a background service")
    runp.add_argument("--source", choices=["store", "spool", "http"], default="store")
    runp.add_argument("--interval", type=float, default=5.0)
    runp.add_argument("--once", action="store_true", help="drain once and exit")
    runp.add_argument("--store-url", default=os.environ.get("STORE_URL"))
    runp.add_argument("--token", default=os.environ.get("PRINT_TOKEN"))
    runp.add_argument("--limit", type=int, default=10)
    runp.add_argument("--spool-dir", default=os.environ.get("SPOOL_DIR", "./spool"))
    runp.add_argument("--host", default="0.0.0.0")
    runp.add_argument("--port", type=int, default=8099)
    backend_flags(runp)

    pr = sub.add_parser("print", help="print one job from flags")
    pr.add_argument("--heading")
    pr.add_argument("--sub")
    pr.add_argument("--body")
    pr.add_argument("--allergens")
    pr.add_argument("--row", action="append", help="label=value (repeatable)")
    pr.add_argument("--footer", action="append")
    pr.add_argument("--copies", type=int, default=1)
    pr.add_argument("--height-mm", type=float)
    pr.add_argument("--logo")
    pr.add_argument("--printer", choices=["file", "brother", "cups"])
    backend_flags(pr)

    pv = sub.add_parser("preview", help="render a job JSON to PNG")
    pv.add_argument("file")
    pv.add_argument("-o", "--out", default="label.png")
    pv.add_argument("--width", type=int, default=WIDTH_PX)
    backend_flags(pv)

    sp = sub.add_parser("serve", help="HTTP intake only")
    sp.add_argument("--host", default="0.0.0.0")
    sp.add_argument("--port", type=int, default=8099)
    sp.add_argument("--token", default=os.environ.get("PRINT_TOKEN"))
    backend_flags(sp)

    sub.add_parser("printers", help="list available printers")

    args = p.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    args._stop = threading.Event()

    if args.cmd == "printers":
        return list_printers()

    if args.cmd == "preview":
        with open(args.file) as fh:
            job = json.load(fh)
        img = render(job, width=args.width)
        img.save(args.out)
        print(f"{args.out}  {img.width}x{img.height}")
        return

    if args.cmd == "print":
        job = job_from_args(args)
        if not (job.get("heading") or job.get("body")):
            sys.exit("nothing to print — pass --heading and/or --body")
        print_job(job, args)
        return

    if args.cmd == "serve":
        args.source = "http"
        args.interval = 1
        args.once = False
        for attr in ("store_url", "limit", "spool_dir"):
            setattr(args, attr, None)
        args._stop = threading.Event()
        source = HttpSource(args.host, args.port, args.token, args)
        source.start()
        LOG.info("ready — http intake on :%d, backend=%s", args.port, args.backend)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            source.stop()
        return

    # run
    def bye(*_):
        LOG.info("stopping")
        args._stop.set()

    signal.signal(signal.SIGTERM, bye)
    signal.signal(signal.SIGINT, bye)

    for attr, env in (("store_url", "STORE_URL"), ("token", "PRINT_TOKEN")):
        if getattr(args, attr) is None:
            setattr(args, attr, os.environ.get(env))
    run(args)


if __name__ == "__main__":
    main()
