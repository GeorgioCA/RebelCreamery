#!/bin/sh
# Restart the local preview server on :3100 (kills only the node process in this directory).
python3 - <<'PYEOF'
import os, signal
target = '/workspace/rebel-creamery'
for pid in os.listdir('/proc'):
    if not pid.isdigit():
        continue
    try:
        parts = open(f'/proc/{pid}/cmdline', 'rb').read().decode(errors='ignore').split('\x00')
        cwd = os.readlink(f'/proc/{pid}/cwd')
    except Exception:
        continue
    if parts and os.path.basename(parts[0]) == 'node' and 'server.js' in parts and cwd == target:
        os.kill(int(pid), signal.SIGTERM)
PYEOF
sleep 1
cd /workspace/rebel-creamery || exit 1
[ "$1" = "--fresh" ] && rm -rf data
PORT=3100 node --env-file=.env server.js > /tmp/creamery.log 2>&1 &
sleep 1.5
tail -3 /tmp/creamery.log
curl -s -o /dev/null -w 'home %{http_code}\n' http://127.0.0.1:3100/
