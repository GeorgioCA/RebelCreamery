# Unit costs (COGS) used by the metrics container

Every product carries `cost_cents`: **ingredients + primary packaging for one
selling unit**, in integer cents. The metrics container multiplies that by the
units on each paid order line to get COGS, gross profit and (after card fees and
overhead) net profit.

The numbers are seeded once, when the `cost_cents` column is first added. After
that they are ordinary product data — edit the **Unit cost** field in
`/admin/products/<id>`, or the `unit_cost_cad` column in
`/admin/products.csv`. Each order line snapshots the cost it was sold at, so
changing a recipe never rewrites the profit of a past order.

## What is in, what is out

**In:** milk, cream, skim milk powder, cream, cultures, rennet, calcium
chloride, salt, olive oil, za'atar, vinegar, cheesecloth share, and the tub /
clamshell / bottle the unit is sold in.

**Out:** labour, rent, utilities, labels, delivery, spoilage, and card fees.
Card fees and a monthly overhead figure are applied separately by the metrics
container (`STRIPE_FEE_PERCENT`, `STRIPE_FEE_FIXED_CENTS`,
`MONTHLY_OVERHEAD_CENTS`). Until a monthly overhead is set, "net profit" is
before fixed overhead and the dashboard says so.

## Input prices

From `Business/Dairy Shop/The Numbers.md` (owner's supplier quote, 24 Oct 2026):

| Input | Price | Per kg |
|---|---:|---:|
| 3% milk | $6.32 / 3.785 L | $1.621/kg (1.03 kg/L) |
| 35% cream | $5.79 / L | $5.676/kg (1.02 kg/L) |
| Skim milk powder | $12.00 / kg | $12.00/kg |
| Rennet | $15.00 / 60 mL | $0.25/mL |
| Calcium chloride | $4.00 / 60 mL | $0.067/mL |
| Salt | $12.99 / 20 kg | $0.65/kg |
| Cheesecloth | $4.00 / 3 yd | $0.50 per batch share |

Packaging: 828 mL Cubeware tub $0.45 (yogurt, labneh), 8 oz deli tub $0.10
(cream cheese, butter, crème fraîche), clamshell $0.30 (halloumi, ricotta),
1 L container $0.87 (buttermilk).

## The costs

| SKU | Product | Unit | Cost | Basis |
|---|---|---|---:|---|
| RC-YOG-6-750 | Yogurt 6% | 750 g | **$2.23** | recipe book |
| RC-CHZ-227 | Cream Cheese | 227 g | **$2.25** | recipe book |
| RC-HAL-250 | Halloumi | 250 g | **$4.56** | recipe book |
| RC-YOG-3-750 | Yogurt 3% | 750 g | $1.97 | estimated |
| RC-YOG-10-750 | Yogurt 10% | 750 g | $2.65 | estimated |
| RC-YOG-02-750 | Yogurt 0–2% | 750 g | $1.89 | estimated |
| RC-BTR-250 | Cultured Butter | 250 g | $2.73 | estimated, joint cost |
| RC-BTM-1L | Buttermilk | 1 L | $2.84 | estimated, joint cost |
| RC-CRF-250 | Crème fraîche | 250 g | $1.55 | estimated |
| RC-LAB-500 | Labneh | 500 g | $2.78 | estimated |
| RC-LAB-ZAT-500 | Labneh Za'atar | 500 g | $3.17 | estimated |
| RC-RIC-500 | Ricotta | 500 g | $4.53 | estimated |

### How the estimates were built

- **Yogurt 3%** — 765 g input per 750 g tub (2% process loss): 738 g 3% milk
  ($1.20) + 27 g SMP ($0.32) + tub ($0.45).
- **Yogurt 10%** — same 765 g, standardised to 10% fat: 571 g milk + 167 g cream
  ($0.93 + $0.95) + 27 g SMP ($0.32) + tub ($0.45). The 6% recipe's 71 g of
  cream becomes 167 g.
- **Yogurt 0–2%** — 738 g 2% milk at the $1.56/L retail reference ($1.12) + SMP
  + tub.
- **Cultured butter / buttermilk** — a joint batch. 250 g butter at 80% fat needs
  ~571 g of 35% cream ($3.24). That batch also yields ~321 g buttermilk, so the
  cream cost is split by relative sales value ($8.00 butter vs $1.87 buttermilk
  at the shelf prices): butter takes 81% ($2.63) + salt + tub; buttermilk takes
  19% ($0.62), scaled to 1 L, + bottle. Costing all the cream to the butter
  would double-count the buttermilk.
- **Crème fraîche** — 255 g cream ($1.45) + tub.
- **Labneh** — 1 kg of 6% yogurt ($2.33 at the recipe-book rate) drains to
  ~500 g, + salt + 828 mL tub. **Za'atar** adds 15 g za'atar (~$0.30) and 10 mL
  olive oil (~$0.09).
- **Ricotta** — 2.5 L 3% milk ($4.18) added to halloumi whey, vinegar, 500 g
  drained, + clamshell. Inactive SKU; correct it if the recipe changes.

These estimates are close enough to steer pricing, not close enough
to file a tax return. Weigh the first real batch of each and replace the number.

## Net profit, exactly

```
revenue      paid + packed + completed orders only
− COGS       Σ units × cost at time of sale
= gross profit
− card fees  2.9% + $0.30 on paid card orders (STRIPE_FEE_*)
− overhead   MONTHLY_OVERHEAD_CENTS × days/30
= net profit
```

A 12-week plan is credited a 13th week; those extra tubs carry cost but no
revenue, and the metrics count all `weeks_credited × tubs_per_week`. Mixed
orders, discounts and delivery fees are taken from the order totals as recorded.
