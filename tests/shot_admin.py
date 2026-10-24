import asyncio, os
from playwright.async_api import async_playwright
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","screenshots")
BASE="http://127.0.0.1:3100"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True,args=["--no-sandbox"])
        ctx=await b.new_context(viewport={"width":1440,"height":950},device_scale_factor=2,
            http_credentials={"username":"owner","password":"local-demo-pass"})
        pg=await ctx.new_page()
        await pg.goto(BASE+"/admin/products",wait_until="networkidle")
        await pg.screenshot(path=f"{OUT}/admin-products.png",full_page=True)
        await pg.goto(BASE+"/admin/products/yogurt-6",wait_until="networkidle")
        await pg.screenshot(path=f"{OUT}/product-form.png",full_page=True)
        await b.close()
asyncio.run(main())
