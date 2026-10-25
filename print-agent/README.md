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

**Windows:** no Brother driver needed — see [Windows](#windows) for the Zadig/WinUSB setup.

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


## Windows

The `brother` backend talks to the printer **directly over USB**, so you do **not** need — and should
not install — Brother's Windows driver. Instead you bind a libusb driver (WinUSB) to the printer with
Zadig, and Python drives it. That is why this works on a machine with no Brother software at all.

> [!IMPORTANT]
> Binding WinUSB means Windows no longer sees the QL-800 as a printer. Brother's editor, P-touch and
> anything else that prints through the Windows spooler will stop seeing it. The browser fallback
> (`/admin/labels/...`) is the escape hatch if you need to print from Windows itself.

### 1. Python

Install Python 3.10 or newer from [python.org](https://www.python.org/downloads/windows/) — tick
**Add python.exe to PATH** — or `winget install Python.Python.3.12`. Then, in PowerShell:

```powershell
cd RebelCreamery\print-agent
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If PowerShell blocks the activate script:
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.

`libusb-package` is installed automatically on Windows by `requirements.txt` — it ships the
`libusb-1.0.dll` that `pyusb` needs. If `printers` later complains about a missing backend, copy
`libusb-1.0.dll` from [libusb.info](https://libusb.info) next to `python.exe` instead.

### 2. Bind the printer to WinUSB

1. Plug the QL-800 in and switch it on.
2. Download **Zadig** from [zadig.akeo.ie](https://zadig.akeo.ie) and run it.
3. **Options → List All Devices.**
4. Pick **Brother QL-800** — USB ID `04F9 209B`. If you only see "Unknown Device", unplug and replug.
5. Set the target driver to **WinUSB** (libusbK also works; prefer WinUSB).
6. **Replace Driver**, wait for it to finish, then replug the printer.

Check it in Device Manager: the printer should now sit under **Universal Serial Bus devices**, not
under **Printers**.

### 3. Test it

```powershell
python labelprint.py printers
python labelprint.py print --heading "Test label" --sub "62 mm" --backend brother
```

`printers` should list `usb://0x04f9:0x209b`. The second command should feed one label and cut.

### 4. Run the store queue

```powershell
$env:STORE_URL   = "https://rebelcreamery.ca"
$env:PRINT_TOKEN = "<the PRINT_TOKEN from Coolify>"
python labelprint.py run --source store --backend brother
```

`ctrl-c` stops it. Logs go to the console; add `-v` for debug.

### 5. Start it automatically

Task Scheduler is the simplest. Create `C:\RebelCreamery\print-agent\run-labels.cmd`:

```bat
@echo off
set STORE_URL=https://rebelcreamery.ca
set PRINT_TOKEN=change-me
cd /d C:\RebelCreamery\print-agent
.venv\Scripts\python.exe labelprint.py run --source store --backend brother >> labels.log 2>&1
```

Then **Task Scheduler → Create Task**:

- **General:** *Run whether user is logged on or not*, *Do not start a new instance*
- **Triggers:** *At startup* (add a 30-second delay so the network is up)
- **Actions:** start `C:\RebelCreamery\print-agent\run-labels.cmd`
- **Settings:** *Restart the task if it fails*, every 1 minute

Or with [NSSM](https://nssm.cc): `nssm install RebelLabels C:\RebelCreamery\print-agent\.venv\Scripts\python.exe labelprint.py run --source store --backend brother`,
then set **AppDirectory** and the two environment variables on the *Environment* tab.

### What doesn't work on Windows

| Thing | Why |
|---|---|
| `--backend cups` | shells out to `lp`, which is Unix/CUPS only |
| `printers` CUPS section | same — reports `lpstat not installed` |
| `rebel-labels.service` | systemd unit; use Task Scheduler or NSSM instead |

Everything else — `store`, `spool`, `http`, `file`, `preview`, `print` — is platform-neutral.

### Troubleshooting

- **`no backend available` / device not found** — Zadig didn't bind, or another program holds the
  device. Replug, rerun Zadig, confirm it shows under *Universal Serial Bus devices*.
- **`LIBUSB_ERROR_ACCESS`** — close Brother software and anything else using the printer; replug.
  Running the terminal as administrator once can clear a stale handle.
- **Prints a blank 72 px label** — you are sending the store's job wrapper instead of the payload.
  Use `--source store` (it flattens `payload` for you) or post the inner object.
- **Windows Firewall prompt on `serve`** — allow *Private networks* only; the endpoint has a token
  but no TLS.
- **Want the Brother driver back?** Device Manager → right-click the printer → *Uninstall device* →
  tick *Delete the driver software*, replug, then install Brother's driver again.

## Other uses

Because the spool and HTTP sources take plain JSON, the same daemon covers:

- **Batch labels** — loop over a CSV, write one JSON per jar, `run --source spool` once.
- **Name badges** — `heading` = name, `subheading` = role, `rows` = table/meal choice.
- **Price tags** — `heading` = product, `subheading` = price, `body` = unit price.
- **Shipping labels** — `printer: "cups"` with `media` set for a laser queue.

## Browser fallback

`/admin/labels/order/<number>` and `/admin/labels/product/<id>` on the store render a 62 mm page and
open the print dialog — useful from a phone or a machine without this script.
