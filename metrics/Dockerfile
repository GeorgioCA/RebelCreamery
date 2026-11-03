# Rebel Creamery metrics — a container that only reads the order book.
#
# Deliberately dependency-free: python:3.13-alpine plus tzdata. No pip install,
# no build step, ~60 MB, boots in under a second.
FROM python:3.13-alpine

# zoneinfo needs the IANA database; the slim alpine image does not ship it.
RUN apk add --no-cache tzdata

WORKDIR /app
COPY app.py /app/app.py

ENV PYTHONUNBUFFERED=1 \
    DATA_DIR=/data \
    PORT=9110

EXPOSE 9110

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT','9110'), timeout=4)"

# Runs as root only so SQLite can open the WAL files it is given; the process
# never writes to the database (mode=ro + PRAGMA query_only).
CMD ["python", "/app/app.py"]
