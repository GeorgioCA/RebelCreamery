# Print agent — Brother QL-800

The store never talks to the printer directly. It writes a row to `print_jobs` when you click
**Label**; this agent polls for queued jobs, renders a label at 62 mm / 300 dpi and prints it over
USB. That means the store can live on a server anywhere and the printer only needs to be plugged
into a machine that can run Python.

## Hardware

- Brother **QL-800** (USB only) — the wireless siblings (QL-810W, QL-820NWB) also work through
  `brother_ql`, just with a network identifier instead of USB.
- Tape: **DK-22205** (62 mm continuous) is what the label layout assumes. DK-1202 (62 × 100 mm
  die-cut) works too if you set `LABEL=62x100`.
- The QL-800 prints 696 px across at 300 dpi. Everything below is sized to that.

## Install (on the machine with the printer — a Raspberry Pi is fine)

```sh
sudo apt-get install -y libusb-1.0-0 python3-pip
sudo pip3 install --break-system-packages -r requirements.txt
```

USB access without root — add `/etc/udev/rules.d/99-brother-ql.rules`:

```
SUBSYSTEM=="usb", ATTR{idVendor}=="04f9", MODE="0666", GROUP="plugdev"
```

then `sudo udevadm control --reload-rules && sudo udevadm trigger` and replug the printer.

Find the identifier (usually `usb://0x04f9:0x209b` for the QL-800):

```sh
python3 -c "from brother_ql.backends.helpers import discover; print(discover())"
```

## Run

```sh
STORE_URL=https://shop.example.ca \
PRINT_TOKEN=<same value as the store> \
DRY_RUN=1 ONCE=1 python3 agent.py      # render to ./labels, print nothing
```

```sh
STORE_URL=https://shop.example.ca PRINT_TOKEN=... python3 agent.py
```

Set `PRINT_TOKEN` on the store too, otherwise `/api/print/*` returns 503.

### systemd

```ini
[Unit]
Description=Rebel Creamery label printer
After=network-online.target

[Service]
WorkingDirectory=/home/pi/rebel-creamery/print-agent
Environment=STORE_URL=https://shop.example.ca
Environment=PRINT_TOKEN=change-me
Environment=PRINTER=usb://0x04f9:0x209b
Environment=PRINTER_MODEL=QL-800
ExecStart=/usr/bin/python3 agent.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```sh
sudo cp rebel-labels.service /etc/systemd/system/
sudo systemctl enable --now rebel-labels
journalctl -u rebel-labels -f
```

## What gets printed

- **Order label** (from the order book's `Label` button): order number, customer, pickup or delivery
  window, every line item with quantity, date, storage line.
- **Product label** (from the product page, 1–20 copies): name, net weight, ingredients, allergen,
  packed date, calculated best-before, business line.

Best-before = print date + the product's *shelf life (days)*, which is set per product in the
back office along with ingredients and allergens.

## Browser fallback

`/admin/labels/order/<number>` and `/admin/labels/product/<id>` open a 62 mm page that auto-opens
the print dialog. That path uses Brother's own CUPS/driver install instead of this agent — useful on
a Windows or Mac machine, or for a one-off print from a phone.
