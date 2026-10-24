#!/usr/bin/env python3
"""
Rebel Creamery print agent.

Runs on the machine the Brother QL-800 is plugged into. Polls the store for queued
label jobs, renders each one to a 696 px-wide PNG (62 mm @ 300 dpi) and prints it over USB.

    pip install brother_ql pillow requests
    STORE_URL=https://shop.example.ca PRINT_TOKEN=... python3 agent.py

Environment:
    STORE_URL       store origin                       (required)
    PRINT_TOKEN     same value as the store's env      (required)
    PRINTER         brother_ql identifier, default usb://0x04f9:0x209b
    PRINTER_MODEL   QL-800 | QL-810W | QL-820NWB ...   (default QL-800)
    LABEL           label spec, default 62 (62 mm endless)
    CUT             1 = cut after each label           (default 1)
    DRY_RUN         1 = render to OUT_DIR, print nothing
    OUT_DIR         where dry-run PNGs land            (default ./labels)
    POLL_SECONDS    idle poll interval                 (default 5)
    ONCE            1 = drain the queue and exit
"""
import io
import os
import sys
import time
import textwrap
import requests
from PIL import Image, ImageDraw, ImageFont

STORE_URL = os.environ.get("STORE_URL", "").rstrip("/")
TOKEN = os.environ.get("PRINT_TOKEN", "")
PRINTER = os.environ.get("PRINTER", "usb://0x04f9:0x209b")
MODEL = os.environ.get("PRINTER_MODEL", "QL-800")
LABEL = os.environ.get("LABEL", "62")
CUT = os.environ.get("CUT", "1") == "1"
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"
OUT_DIR = os.environ.get("OUT_DIR", "./labels")
POLL = float(os.environ.get("POLL_SECONDS", "5"))
ONCE = os.environ.get("ONCE", "0") == "1"

W = 696          # printable width of 62 mm tape at 300 dpi
MARGIN = 26
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

FONT_DIRS = [
    "/usr/share/fonts/truetype/dejavu",
    "/usr/share/fonts/dejavu",
    "/Library/Fonts",
    "/System/Library/Fonts/Supplemental",
    "C:/Windows/Fonts",
]


def font(size, bold=False):
    names = ["DejaVuSans-Bold.ttf", "Arial Bold.ttf", "arialbd.ttf"] if bold else ["DejaVuSans.ttf", "Arial.ttf", "arial.ttf"]
    for directory in FONT_DIRS:
        for name in names:
            path = os.path.join(directory, name)
            if os.path.exists(path):
                return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def wrap(draw, text, fnt, max_width):
    words = str(text).split()
    lines, line = [], ""
    for word in words:
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


def draw_block(draw, text, fnt, x, y, max_width, leading=1.22, bold=False):
    for line in wrap(draw, text, fnt, max_width):
        draw.text((x, y), line, font=fnt, fill="black")
        y += int(fnt.size * leading)
    return y


def render(payload):
    """Render a label payload to a PIL image, 696 px wide, height as needed."""
    scratch = Image.new("L", (W, 10))
    measure = ImageDraw.Draw(scratch)

    f_brand = font(19, bold=True)
    f_title = font(54, bold=True)
    f_sub = font(33, bold=True)
    f_person = font(44, bold=True)
    f_item = font(31)
    f_body = font(23)
    f_small = font(19)

    y = MARGIN
    height_guess = 1400
    img = Image.new("L", (W, height_guess), color=255)
    d = ImageDraw.Draw(img)

    # brand
    brand = str(payload.get("brand") or "REBEL CREAMERY").upper()
    d.text((MARGIN, y), " ".join(brand), font=f_brand, fill=0)
    y += int(f_brand.size * 1.5)
    d.line([(MARGIN, y), (W - MARGIN, y)], fill=0, width=3)
    y += 14

    # title + subtitle
    for line in wrap(d, payload.get("title", ""), f_title, W - 2 * MARGIN):
        d.text((MARGIN, y), line, font=f_title, fill=0)
        y += int(f_title.size * 1.12)
    if payload.get("subtitle"):
        y += 6
        d.text((MARGIN, y), str(payload["subtitle"]), font=f_sub, fill=0)
        y += int(f_sub.size * 1.35)

    if payload.get("person"):
        y += 8
        y = draw_block(d, payload["person"], f_person, MARGIN, y, W - 2 * MARGIN, leading=1.15)

    for meta in payload.get("meta", []):
        y = draw_block(d, meta, f_body, MARGIN, y, W - 2 * MARGIN, leading=1.3)
        y += 2

    items = payload.get("items") or []
    if items:
        y += 8
        for item in items:
            label = f"{item.get('qty', 1)}x  {item.get('name', '')}"
            y = draw_block(d, label, f_item, MARGIN, y, W - 2 * MARGIN, leading=1.22)
            y += 2

    if payload.get("ingredients"):
        y += 10
        y = draw_block(d, payload["ingredients"], f_small, MARGIN, y, W - 2 * MARGIN, leading=1.3)
    if payload.get("allergens"):
        y += 8
        text = f"Contains: {payload['allergens']}"
        height = int(f_body.size * 1.9)
        d.rectangle([(MARGIN, y), (W - MARGIN, y + height)], outline=0, width=3)
        d.text((MARGIN + 12, y + int(f_body.size * 0.35)), text, font=font(24, bold=True), fill=0)
        y += height + 10

    y += 14
    d.line([(MARGIN, y), (W - MARGIN, y)], fill=0, width=2)
    y += 12
    for line in payload.get("footer", []):
        y = draw_block(d, line, f_small, MARGIN, y, W - 2 * MARGIN, leading=1.3)

    y += MARGIN
    return img.crop((0, 0, W, min(y, height_guess))).convert("1")


def print_image(img, name):
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    if DRY_RUN:
        os.makedirs(OUT_DIR, exist_ok=True)
        path = os.path.join(OUT_DIR, f"{name}.png")
        img.save(path)
        print(f"[dry-run] {path} ({img.width}x{img.height})")
        return
    from brother_ql.conversion import convert
    from brother_ql.raster import BrotherQLRaster
    from brother_ql.backends.helpers import send

    qlr = BrotherQLRaster(MODEL)
    convert(qlr, images=[img], label=LABEL, cut=CUT, dpi_600=False)
    send(instructions=qlr.data, printer_identifier=PRINTER, backend_identifier="pyusb", blocking=True)
    print(f"[printed] {name}")


def poll_once():
    resp = requests.get(f"{STORE_URL}/api/print/jobs", headers=HEADERS, timeout=20)
    if resp.status_code == 401:
        sys.exit("print token rejected")
    resp.raise_for_status()
    jobs = resp.json().get("jobs", [])
    for job in jobs:
        try:
            for i in range(int(job.get("copies") or 1)):
                img = render(job["payload"])
                print_image(img, f"job{job['id']}-{i + 1}")
            requests.post(
                f"{STORE_URL}/api/print/jobs/{job['id']}/done",
                headers=HEADERS, json={"status": "printed"}, timeout=20
            ).raise_for_status()
        except Exception as exc:  # keep the queue moving; the error shows in the store
            print(f"[error] job {job['id']}: {exc}", file=sys.stderr)
            try:
                requests.post(
                    f"{STORE_URL}/api/print/jobs/{job['id']}/done",
                    headers=HEADERS, json={"status": "error", "error": str(exc)[:300]}, timeout=20
                )
            except Exception:
                pass
    return len(jobs)


def main():
    if not STORE_URL or not TOKEN:
        sys.exit("STORE_URL and PRINT_TOKEN are required")
    print(f"print agent → {STORE_URL} ({'dry run' if DRY_RUN else PRINTER}, model {MODEL}, label {LABEL})")
    while True:
        try:
            poll_once()
        except Exception as exc:
            print(f"[poll] {exc}", file=sys.stderr)
        if ONCE:
            break
        time.sleep(POLL)


if __name__ == "__main__":
    main()
