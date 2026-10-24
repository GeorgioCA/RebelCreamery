import asyncio, json
from playwright.async_api import async_playwright

BASE="http://127.0.0.1:3100"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True,args=["--no-sandbox"])
        # desktop
        ctx=await b.new_context(viewport={"width":1440,"height":950},device_scale_factor=2,locale="en-CA")
        pg=await ctx.new_page()
        errs=[]
        pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(BASE+"/", wait_until="networkidle")
        await pg.wait_for_timeout(1200)
        dims=await pg.evaluate("({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight})")
        print("home dims",dims)
        await pg.screenshot(path="/workspace/rebel-creamery/screenshots/home.png", full_page=True)
        # cart open
        await pg.click("[data-add='yogurt-6']")
        await pg.wait_for_timeout(700)
        await pg.screenshot(path="/workspace/rebel-creamery/screenshots/cart.png")
        await pg.click("#cart-close")
        # checkout
        await pg.goto(BASE+"/checkout", wait_until="networkidle")
        await pg.wait_for_timeout(600)
        d2=await pg.evaluate("({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})")
        print("checkout dims",d2)
        await pg.screenshot(path="/workspace/rebel-creamery/screenshots/checkout.png", full_page=True)
        # admin
        ctx2=await b.new_context(viewport={"width":1440,"height":900},http_credentials={"username":"owner","password":"local-demo-pass"},device_scale_factor=1.5)
        pg2=await ctx2.new_page()
        await pg2.goto(BASE+"/admin", wait_until="networkidle")
        await pg2.screenshot(path="/workspace/rebel-creamery/screenshots/admin.png", full_page=True)
        # mobile
        ctx3=await b.new_context(viewport={"width":390,"height":844},device_scale_factor=3,is_mobile=True,locale="en-CA")
        pg3=await ctx3.new_page()
        await pg3.goto(BASE+"/", wait_until="networkidle")
        await pg3.wait_for_timeout(800)
        d3=await pg3.evaluate("({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})")
        print("mobile dims",d3)
        await pg3.screenshot(path="/workspace/rebel-creamery/screenshots/mobile.png", full_page=True)
        # success page
        pg4=await ctx.new_page()
        await pg4.goto(BASE+"/success?order=RC-1002", wait_until="networkidle")
        await pg4.screenshot(path="/workspace/rebel-creamery/screenshots/success.png", full_page=True)
        print("console errors:", errs[:8])
        await b.close()
asyncio.run(main())
