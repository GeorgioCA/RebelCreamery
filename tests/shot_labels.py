import asyncio
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:3100"
CREDS = {"username": "owner", "password": "local-demo-pass"}
OUT = "/workspace/rebel-creamery/screenshots"


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 1280, "height": 900}, http_credentials=CREDS, locale="en-CA")
        pg = await ctx.new_page()
        await pg.goto(f"{BASE}/admin", wait_until="networkidle")
        await pg.screenshot(path=f"{OUT}/admin-orders.png", full_page=True)
        await pg.goto(f"{BASE}/admin/products/yogurt-6", wait_until="networkidle")
        await pg.locator("section.print-block").scroll_into_view_if_needed()
        await pg.screenshot(path=f"{OUT}/product-label-block.png", full_page=True)
        await pg.goto(f"{BASE}/admin/labels/product/yogurt-6", wait_until="networkidle")
        await pg.emulate_media(media="print")
        el = pg.locator(".sheet")
        await el.screenshot(path=f"{OUT}/label-print.png")
        print("shots done")
        await b.close()


asyncio.run(main())
