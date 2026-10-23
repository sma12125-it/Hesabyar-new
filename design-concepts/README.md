# سه جهت طراحی برای حساب‌یار

Static, high-fidelity concepts for a future App Store pass. Nothing in `src/` is changed. Open `index.html` in a browser, or the HTML file for a single screen. Mobile screens are an iPhone logical frame, **390×844**. Each concept also has one desktop view at **1440×900**.

PNG renders live in `screenshots/`. Each `*-board.png` places that concept’s screens side by side.

Sample world, shared so the directions can be compared: سارا نادری، جمعه ۳۰ مهر ۱۴۰۵، مبالغ به **تومان**. نقد ۴۰٬۸۰۰٬۰۰۰، سبد ۳۶۴٬۷۰۰٬۰۰۰، ارزش خالص ۴۰۵٬۵۰۰٬۰۰۰. حساب‌ها: ملت، کیف پول، پس‌انداز مسکن، کارت هوده. سبد: صندوق طلای کهربا (عیار)، فولاد، ربع سکه، بیت‌کوین، سپرده ۱۸٪ سامان.

The concepts cover the product that is live today: ورود (رمز، الگو، اثر انگشت)، خانه (نقد / سرمایه / بدهی، تعهد نزدیک، دفتر تراکنش)، ثبت هزینه و درآمد و انتقال، فهرست سرمایه‌گذاری، جزئیات دارایی با میانگین موزون و تاریخچه صدور و ابطال، گزارش و بودجه و هدف خالی، تنظیمات (تم، تومان، قفل، گاوصندوق، ابر، پیامک، کارت مشترک، MCP، پشتیبان). اقساط و چک در تعهدهای نزدیک دیده می‌شوند.

Fonts in the mockups are OFL and self-hosted: **Vazirmatn** (UI), **Markazi Text** (زرنگار display), **Readex Pro** (نسیم). For a shipped app, license **Peyda** or **IRANSansX** and keep the same roles: a display face for big numbers, a text face for UI. These files do not embed those commercial families.

## زرنگار

دفتر خصوصی شب. For someone who wants the books to feel like a private bank, not a utility.

| Token | Value |
| --- | --- |
| Ink | `#090D16` |
| Panel | `#141B2C` |
| Ivory | `#F4EEE4` |
| Champagne | `#D6B87A` / `#F0DDB0` |
| Jade / ruby | `#8FCBB0` / `#E08B84` |

**Type.** Markazi Text for the wordmark and the big totals (a naskh display). Vazirmatn for labels, rows, and buttons. No letter-spacing on Persian.

**Components.** Gold capsule button with an inset highlight. Ghost pills for اثر انگشت and الگو. Inputs are hairline fields on ink. The home balance is a certificate: inner rule, three facts, no chart noise. Accounts are quiet 2×2 cells. Transactions are a ledger, round seals instead of colorful category art. Reports use a thin donut and hairline budget meters. Settings are grouped rows with a gold badge. Empty state is a dashed certificate («هدف سفر هنوز خالی است»، «ملک هنوز در دفتر نیست»).

**Iconography.** 1.5px stroke, gold or ivory. The mark is an eight-point shamse. Tab bar is a hairline with a small gold plus, not a loud FAB.

**Motion.** Settled in these stills. In product: hero sheen 2.8s, sheets rise 480ms `cubic-bezier(0.2, 0.8, 0.2, 1)`, chart stroke draws over 900ms, stamp scales 0.96 → 1. `prefers-reduced-motion` drops sheen and draw.

## کاشی

کارگاه روز. A Tehran studio ledger: plaster, glaze, and a tile grid you can count.

| Token | Value |
| --- | --- |
| Plaster | `#F3EEE6` |
| Paper | `#FFFDF9` |
| Ink | `#1C1916` |
| Glaze | `#0F6F78` / deep `#0C4E56` |
| Pomegranate / saffron | `#C44536` / `#E0A106` |

**Type.** Vazirmatn only, black headlines, tight leading. Production can swap the family for IRANSansX without changing scale.

**Components.** Tiles with a 1.5px ink or sand border and a hard 4px glaze shadow on the primary button (not a blur). Radius stays near 14–18px, never a full pill, except filter chips. Home is a bento: balance tile, income, expense, paired bars for اردیبهشت تا مهر. The entry screen is a category grid plus a Persian keypad. Investments are cards with a sparkline and a dashed empty tile for ملک. Reports are stacked meters with a tile-stripe fill. Settings is a grid of tiles, not a list. Desktop is the same bento, wider.

**Iconography.** Filled, geometric, almost like tile stamps. The repeating eight-point star is a background structure, kept under 10% ink so it does not fight the numbers.

**Motion.** Press scales a tile to 0.98 in 120ms. Bento items stagger 40ms. Bars grow from the baseline in 420ms. The tab indicator slides. Reduced motion: no stagger, bars appear full.

## نسیم

همراه خانه. Money as a calm household object, closer to a letter than a terminal.

| Token | Value |
| --- | --- |
| Mist | `#F6F1EA` |
| Card | `#FFFDFB` |
| Bark | `#3A332E` |
| Sage | `#5F8F6E` / deep `#3D6A4C` |
| Clay / peach | `#D06A4F` / `#F3CFC3` |

**Type.** Readex Pro for a rounder Arabic voice, Vazirmatn as the fallback. Large titles, 28px radius, 13px secondary copy. Sentences do the work labels do in زرنگار («طلای کهربا این ماه آرام بالا آمد»).

**Components.** White cards floating on warm mist, no borders. Primary button is a sage capsule, 54px tall. Categories are soft pills. The dock is a floating pill, inset from the edges, with a round plus. Home leads with a greeting and an illustrated empty state («چک معوق نداری»). Asset detail is a short story, then the chart, then the trades. Reports say whether a ceiling still has room. Settings rows are large and described in a full sentence.

**Iconography.** Rounded stroke, 1.7px, plus a two-leaf mark on the login. Empty states use a small drawn face or medal, not a stock illustration pack.

**Motion.** Cards breathe (scale 1.03, 8s, login blob only). Sheets rise with a soft spring, 500ms. Numbers count up once. Reduced motion: no breathe, no count-up.

## Comparison

| | زرنگار | کاشی | نسیم |
| --- | --- | --- | --- |
| Feel | Private bank at night | Design studio by day | Calm house ledger |
| Best for | Wealth, investments, trust | Clarity, speed, data | Everyday entry, less anxiety |
| Density | High, certificate and ledger | Medium, bento and tiles | Low, one idea per card |
| Risk | Can feel formal for grocery entry | Ornament must stay quiet | May feel light for a large portfolio |

## Screens

`{concept}/login.html` `home.html` `transaction.html` `investments.html` `asset.html` `reports.html` `settings.html` `desktop.html`

Screenshots: `screenshots/{concept}-{screen}.png` and `screenshots/{concept}-board.png`.
