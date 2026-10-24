import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True,args=["--no-sandbox"])
        pg=await (await b.new_context(viewport={"width":1440,"height":950})).new_page()
        await pg.goto("http://127.0.0.1:3100/",wait_until="networkidle")
        r=await pg.evaluate("""() => {
          const q=s=>document.querySelector(s);
          const box=e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}};
          const cards=[...document.querySelectorAll('.card')].map(box);
          return {
            fonts:{fraunces:document.fonts.check('16px Fraunces'),inter:document.fonts.check('16px Inter')},
            h1:{text:q('h1').innerText,size:getComputedStyle(q('h1')).fontSize,box:box(q('h1'))},
            cards, sameHeight:new Set(cards.map(c=>c.h)).size===1,
            stamp:box(q('.stamp')), heroArt:box(q('.hero-art')),
            expensive:q('.card-price').innerText,
            bodyBg:getComputedStyle(document.body).backgroundColor
          }
        }""")
        print(r)
        await b.close()
asyncio.run(main())
