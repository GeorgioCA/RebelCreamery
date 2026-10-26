import asyncio
import os
from playwright.async_api import async_playwright
BASE="http://127.0.0.1:3100"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True,args=["--no-sandbox"])
        ctx=await b.new_context(viewport={"width":1440,"height":950},locale="en-CA")
        pg=await ctx.new_page()
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(BASE+"/",wait_until="networkidle")
        # add 2 yogurt + 1 halloumi via cards
        await pg.fill(".card[data-product='yogurt-6'] .stepper input","2")
        await pg.click("[data-add='yogurt-6']")
        await pg.click("#cart-close")
        await pg.click("[data-add='halloumi']")
        await pg.click("#cart-checkout")
        await pg.wait_for_url("**/checkout")
        # address must be hidden on pickup
        vis = await pg.is_visible("#address-field")
        print("address visible on pickup:", vis)
        await pg.fill("input[name=name]","E2E Buyer")
        await pg.fill("input[name=email]","e2e@example.com")
        await pg.fill("input[name=phone]","4035550199")
        await pg.check("input[name=method][value=delivery]")
        print("address visible on delivery:", await pg.is_visible("#address-field"))
        await pg.fill("input[name=street]", "99 Ave SW")
        await pg.fill("input[name=postal]", "T2P 1K1")
        print("summary:", await pg.inner_text("#sum-total"), "| delivery row visible:", await pg.is_visible("#sum-delivery-row"))
        await pg.check("input[name=payment][value=etransfer]")
        await pg.click("#place-order")
        await pg.wait_for_url("**/order/*", timeout=15000)
        body=await pg.inner_text("body")
        print("url:", pg.url)
        print("has etransfer box:", "Interac e-Transfer" in body, "| total:", [l for l in body.split("\n") if "$" in l][:6])
        print("page errors:", errs)
        os.makedirs("screenshots", exist_ok=True)
        await pg.screenshot(path="screenshots/success.png", full_page=True)
        await b.close()
asyncio.run(main())
