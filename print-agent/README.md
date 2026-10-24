# labelprint — background label printing

One script that sits in the background and prints labels: for the Rebel Creamery store, and for
anything else on the same machine or LAN. Sized for a **Brother QL-800** on 62 mm tape, but the CUPS
backend drives any printer you have a queue for.

```
sources                      backends
 store  poll the shop   ─┐    brother  QL-800 USB via brother_ql
 spool  watch a folder  ─┼──► cups     any CUPS queue (lp)
 http   LAN endpoint    ─┘    file     write PNGs (dry run / network share)
```

## Install

```sh
sudo apt-get install -y libusb-1.0-0 python3-pip
sudo pip3 install --break-system-packages -r requirements.txt
```

`requests` is only needed for the `store` and `http` sources; `brother_ql` only for the USB backend.
Everything else runs on Pillow alone.

USB access without root — `/etc/udev/rules.d/99-brother-ql.rules`:

```
SUBSYSTEM=="usb", ATTR{idVendor}=="04f9", MODE="0666", GROUP="plugdev"
```

`sudo udevadm control --reload-rules && sudo udevadm trigger`, replug. Confirm with
`python3 labelprint.py printers`.

## Three ways to run it

**Store queue** — the shop writes jobs when you click `Label` / `Queue labels`:

```sh
STORE_URL=https://shop.example.ca PRINT_TOKEN=… \
python3 labelprint.py run --source store --backend brother
```

**Spool folder** — any program (cron, a spreadsheet export, a shell script) drops a `.json` file in
and it prints; the file moves to `printed/` or `failed/`:

```sh
python3 labelprint.py run --source spool --spool-dir /var/spool/labels --backend brother
```

**HTTP endpoint** — POST a job from anywhere on the LAN, or POST raw PNG bytes:

```sh
python3 labelprint.py serve --port 8099 --token lan-secret --backend brother
curl -X POST localhost:8099/print -H 'X-Print-Token: lan-secret' \
     -H 'Content-Type: application/json' -d '{"heading":"Name Badge","subheading":"Hermes"}'
curl -X POST localhost:8099/print -H 'X-Print-Token: lan-secret' \
     -H 'Content-Type: image/png' --data-binary @label.png
```

`GET /health` reports liveness. With no `--token` the endpoint is open — only do that on a trusted
network.

## One-offs and previews

```sh
python3 labelprint.py print --heading "Smoked Cheddar" --sub "220 g" \
  --row "Packed=$(date +%d\ %b\ %Y)" --body "Whole milk, salt, cultures, rennet." \
  --allergens Milk --footer "Keep refrigerated" --backend brother

python3 labelprint.py preview job.json -o label.png     # render only, never prints
```

## Job format

```json
{
  "heading": "Smoked Cheddar",
  "subheading": "220 g",
  "logo": "/home/pi/logo.png",
  "rows": [["Packed", "24 Oct 2026"], ["Best before", "21 Nov 2026"]],
  "items": [{"qty": 2, "name": "Yogurt 750 g"}],
  "body": "Whole milk, salt, cultures, microbial rennet.",
  "allergens": "Milk",
  "footer": ["Keep refrigerated", "Rebel Creamery · Calgary, AB"],
  "copies": 2,
  "height_mm": 40,
  "printer": "brother"
}
```

- `heading` → large name, `subheading` → size/price line, `body` → wrapped paragraph.
- `rows` → label/value pairs; leave the label empty for a plain line.
- `allergens` → boxed and bold (food labels).
- `height_mm` → fixes the label height for die-cut stock (content is cropped, with a warning if it
  overflows); omit it for continuous tape, where height follows the content.
- `copies` → 1–50, printed sequentially.
- `printer` → per-job override of the backend.

Store payloads (`kind: order|product`) are accepted as-is — they are normalised into this shape.

## systemd

```ini
[Unit]
Description=Label printer
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/home/pi/rebel-creamery/print-agent
Environment=STORE_URL=https://shop.example.ca
Environment=PRINT_TOKEN=change-me
Environment=PRINTER=usb://0x04f9:0x209b
Environment=PRINTER_MODEL=QL-800
ExecStart=/usr/bin/python3 labelprint.py run --source store --backend brother
Restart=always
RestartSec=5
User=pi

[Install]
WantedBy=multi-user.target
```

`sudo systemctl enable --now rebel-labels && journalctl -u rebel-labels -f`.

## Other uses

Because the spool and HTTP sources take plain JSON, the same daemon covers:

- **Batch labels** — loop over a CSV, write one JSON per jar, `run --source spool` once.
- **Name badges** — `heading` = name, `subheading` = role, `rows` = table/meal choice.
- **Price tags** — `heading` = product, `subheading` = price, `body` = unit price.
- **Shipping labels** — `printer: "cups"` with `media` set for a laser queue.

## Browser fallback

`/admin/labels/order/<number>` and `/admin/labels/product/<id>` on the store render a 62 mm page and
open the print dialog — useful from a phone or a machine without this script.
