"""End-to-end: create a product in the back office, sell it, then delete it."""
import asyncio
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:3100"
CREDS = {"username": "owner", "password": "local-demo-pass"}


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 1440, "height": 950}, http_credentials=CREDS, locale="en-CA")
        pg = await ctx.new_page()
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))

        # create
        await pg.goto(f"{BASE}/admin/products/new", wait_until="networkidle")
        await pg.fill("input[name=name]", "Ricotta")
        await pg.fill("input[name=weight]", "300 g")
        await pg.fill("input[name=price]", "6.50")
        await pg.fill("textarea[name=note]", "Whey ricotta, drained overnight.")
        await pg.fill("input[name=tags]", "Fresh, Spoonable")
        await pg.fill("input[name=stock]", "7")
        await pg.fill("input[name=max]", "4")
        await pg.select_option("select[name=art]", "generic")
        await pg.click("button[type=submit]")
        await pg.wait_for_url("**/admin/products", timeout=10000)
        print("created ->", "Ricotta" in await pg.inner_text("body"))

        # appears on the storefront, with its max per order
        await pg.goto(BASE, wait_until="networkidle")
        print("on storefront:", await pg.locator("article.card[data-product=ricotta]").count() == 1)
        print("price:", await pg.locator("article.card[data-product=ricotta] .card-price").inner_text())
        print("max input:", await pg.locator("article.card[data-product=ricotta] .stepper input").get_attribute("max"))

        # sell one
        await pg.click("[data-add=ricotta]")
        await pg.click("#cart-checkout")
        await pg.wait_for_url("**/checkout")
        await pg.fill("input[name=name]", "Ricotta Buyer")
        await pg.fill("input[name=email]", "ricotta@example.com")
        await pg.check("input[name=payment][value=etransfer]")
        await pg.click("#place-order")
        await pg.wait_for_url("**/success?order=*", timeout=15000)
        print("ordered:", pg.url.split("order=")[-1])

        # stock decremented in the admin
        await pg.goto(f"{BASE}/admin/products", wait_until="networkidle")
        row = pg.locator("tr", has_text="Ricotta")
        print("admin row:", (await row.inner_text()).replace("\n", " | "))

        # hide -> gone from storefront, still in admin
        await pg.goto(f"{BASE}/admin/products/ricotta", wait_until="networkidle")
        await pg.uncheck("input[name=active]")
        await pg.click("button[type=submit]")
        await pg.wait_for_url("**/admin/products")
        await pg.goto(BASE, wait_until="networkidle")
        print("hidden from storefront:", await pg.locator("article.card[data-product=ricotta]").count() == 0)

        # delete
        await pg.goto(f"{BASE}/admin/products", wait_until="networkidle")
        pg.once("dialog", lambda d: asyncio.create_task(d.accept()))
        await pg.locator("tr", has_text="Ricotta").locator("button", has_text="Delete").click()
        await pg.wait_for_load_state("networkidle")
        print("deleted:", "Ricotta" not in await pg.inner_text("body"))
        print("page errors:", errors)
        await b.close()


asyncio.run(main())
