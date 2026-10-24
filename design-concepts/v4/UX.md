# UX — سنج

Product: حساب‌یار 1.0. Direction: **سنج**. Sample household: سارا نادری، جمعه ۱۸ مهر ۱۴۰۵، تومان. The month is day 18 of 30 so the pace line has something to say. Figures are the books below, not a reskin of the earlier sample screens.

## Audit of the current app

What the live app already does well, and should keep:

- Local books in toman, Jalali dates, Persian digits.
- Accounts, masked cards, a CVV vault, Sheba.
- Expense, income, and transfer.
- SMS drafts waiting for a category.
- Installments, cheques, debts.
- Budgets, goals, and a heavy reports surface.
- Investments with weighted-average cost, buy, sell, issue, redeem, realized and unrealized profit.
- PIN, pattern, biometric.
- Themes, toman or rial, backup, cloud, shared card.
- A desktop sidebar.

What gets in the way of a paid 1.0:

| Today | Why it hurts |
| --- | --- |
| Tabs are خانه، حساب‌ها، ثبت، اقساط، بودجه | The daily loop is “where is the month, what do I file, what did I miss”. Installments occupy a tab. Investments, budgets, goals, and a market browser share the other one. |
| Settings, themes, and SMS review live in the home chrome | The header is a toolbox. The month is not the point of the screen. |
| Quick entry is a form | Kind, then amount, then a sheet for category, a sheet for account, then tags, photo, note. The keypad is not the screen. |
| Home leads with a clock and a total | Net worth does not tell you if you can buy dinner. |
| Reports is several products | A person looking for “how much food is left” meets a market terminal. |
| Desktop repeats the phone | Width is unused. Filing still covers the list. |

## Point of view

Every number is compared to a **خط معیار**.

- On the month, the line is the pace that spends the ceiling exactly on day 30.
- On a category, a tick marks where today falls between zero and the ceiling.
- On an asset, a dashed line is the average cost. The solid line is the price.

The home question is not “how rich am I”. It is “what is left, and am I ahead of the line”.

## Information architecture

```
ورود
  آشنایی (۳ قدم) · قفل (رمز، الگو، اثر انگشت)

خانه          ماه، خط، استثناها، تازه‌ها
دفتر          یک فهرست، صافی روی هم، تأیید پیامک
ثبت           کیپد، الگوهای اخیر، دسته، بعد حساب و تاریخ
دارایی
  حساب‌ها     مانده، کارت، شبا، دفتر همان حساب
  سرمایه‌گذاری  فهرست، سپس برگهٔ دارایی
برنامه
  بودجه       تقسیم‌نشده، گروه‌ها، تیک امروز
  گزارش       بازه، ارزش دارایی، جریان، دسته‌ها
تعهدها        از خانه، نه از نوار: قسط، چک، اشتراک
تنظیمات       از چهرهٔ کاربر، روی هر صفحهٔ اصلی
```

Mobile bar, in order: خانه، دفتر، ثبت، دارایی، برنامه. ثبت is a tab-sized action, not a floating circle. دارایی remembers حساب‌ها or سرمایه‌گذاری. برنامه remembers بودجه or گزارش.

Desktop, right to left: navigation, the work, a composer that never covers the work. Budget and reports are separate sidebar items so each is one click.

### Tap budget

| Job | Taps from anywhere on the bar |
| --- | --- |
| File an expense | 1 (ثبت), then digits and a chip |
| See the month | 1 |
| Open the ledger | 1 |
| Filter the ledger | 2 (دفتر، صافی) |
| Confirm an SMS draft | 1 from the home row, or 1 inside دفتر |
| Accounts | 1 (دارایی, or the نقد figure) |
| Investments | 1 (the سرمایه figure) or 2 (دارایی، then the segment) |
| A single asset | 2 |
| Buy or sell | the buttons are on the asset, so 1 once you are there |
| Budgets | 1 (برنامه) |
| Reports | 1 from the home chart, or 2 via the segment |
| Next installment and cheques | 1 from the home row |
| Settings and themes | 1 (avatar) |

Nothing that is daily is behind a report tab.

## Sample books

Cash **۴۰٬۸۰۰٬۰۰۰**. Portfolio **۳۶۴٬۷۰۰٬۰۰۰**. Assets together **۴۰۵٬۵۰۰٬۰۰۰**. Commitments are not subtracted; they are listed as money that will leave.

| Account | Balance |
| --- | --- |
| بانک ملت، جاری | ۲۸٬۶۵۰٬۰۰۰ |
| کیف پول نقد | ۱٬۳۵۰٬۰۰۰ |
| پس‌انداز مسکن | ۱۰٬۸۰۰٬۰۰۰ |

Cards stay masked. CVV stays in the vault until a second unlock.

Spend ceiling for مهر **۳۰٬۰۰۰٬۰۰۰**. Assigned including a 2٬000٬000 savings job **۳۲٬۰۰۰٬۰۰۰**. Income **۴۵٬۰۰۰٬۰۰۰**. Still unassigned **۱۳٬۰۰۰٬۰۰۰**. Spent **۱۸٬۶۴۰٬۰۰۰**. Left inside the ceiling **۱۱٬۳۶۰٬۰۰۰**. The straight line says today should be **۱۸٬۰۰۰٬۰۰۰**. She is **۶۴۰٬۰۰۰** ahead of it. خانه is over its own ceiling (۶٫۴ of ۶). خوراک and تفریح are under the ceiling but ahead of today’s tick.

| Asset | Value | Unrealized | Realized |
| --- | --- | --- | --- |
| کهربا (عیار)، ۶٬۲۰۰ واحد، میانگین ۲۷٬۴۰۰، روز ۳۳٬۶۰۰ | ۲۰۸٬۳۲۰٬۰۰۰ | +۳۸٬۴۴۰٬۰۰۰ | +۶٬۴۰۰٬۰۰۰ |
| فولاد، ۱۲٬۰۰۰ سهم، میانگین ۵٬۴۸۰، روز ۵٬۲۱۰ | ۶۲٬۵۲۰٬۰۰۰ | −۳٬۲۴۰٬۰۰۰ | ۰ |
| ربع سکه، ۲ عدد | ۴۱٬۳۶۰٬۰۰۰ | +۷٬۵۶۰٬۰۰۰ | +۲٬۱۰۰٬۰۰۰ |
| بیت‌کوین، ۰٫۰۰۶ | ۳۲٬۴۰۰٬۰۰۰ | +۴٬۸۰۰٬۰۰۰ | +۹۰۰٬۰۰۰ |
| سپرده ۱۸٪ سامان | ۲۰٬۱۰۰٬۰۰۰ | +۱٬۶۰۰٬۰۰۰ | ۰ |

کهربا’s value is ۶٬۲۰۰ × ۳۳٬۶۰۰ = **۲۰۸٬۳۲۰٬۰۰۰**. The four other lines plus کهربا equal ۳۶۴٫۷ million. فولاد is the red line, so the list is not a victory lap. Unrealized on the portfolio nets to **+۴۹٬۱۶۰٬۰۰۰**.

Realized is closed. It does not move when the spot price moves. Unrealized is `(price − average) × quantity still held`. The asset screen says that in one sentence, and the sell sheet repeats it with the numbers of the trade you are about to file.

## Flows

### File a purchase

1. ثبت. The keypad is up. Amount is zero and the button is quiet.
2. Type the amount, or tap a template (اسنپ fills amount, حمل، ملت).
3. Tap a category chip if the template did not. Account is already ملت. Date is already ۱۸ مهر.
4. ثبت هزینه. The sheet leaves. The new row is on top of the month. A toast offers واگرد.

Transfer hides categories and asks for از and به. Income swaps the chip set to حقوق، کار جانبی، سود، سایر. A note is a single line, not a step. If the amount is larger than the account, the button stays off and the line says so.

### Clear bank SMS

Home, row «۲ پیامک بدون دسته». The ledger opens on بررسی‌نشده. Each row has تأیید. تأیید marks it reviewed in place. Opening the row is only for changing the category. The dot is the only chrome. There is no second app called “pending”.

### Read and trade an asset

1. سرمایه on the home figures, or دارایی → سرمایه‌گذاری.
2. The row shows value and percent against average, red or green.
3. The asset opens on value, unrealized, realized, the price against the average line, then the facts (quantity, average, spot, cost of what remains).
4. فروش or خرید. Quantity and price use the same keypad. A preview states the realized profit of this trade, the quantity that will remain, and the new unrealized figure. ثبت writes the trade into the history.
5. قیمت روز is separate. Editing it does not pretend a trade happened. The copy says the price is not a fill.

صندوق طلا uses خرید and فروش, with one line that صدور and ابطال are the same two verbs. The deposit uses واریز and برداشت.

### Give money a job

برنامه opens on بودجه. The first number is what is still unassigned, not a donut. Groups are ضروری، زندگی، آینده. Each category is spent against ceiling, with today’s tick at day 18/30. Over the ceiling is one color. Under the ceiling but past the tick is another. Savings filled on purpose stay calm. Reports is the other segment: six months, assets, money in and out, and one sentence.

### Desktop

The composer stays in the left column. Filing an اسنپ does not cover the month. The sidebar is the full set, so reports are not a segment. The month’s two lists sit side by side under the chart, because the column is wide enough.

### First run

Three steps, then the month. No quiz.

1. The sentence and the empty pace line.
2. One account and its opening balance, on a keypad. Skip is allowed.
3. A four-digit lock. Pattern and biometric are the alternatives on the return screen.

The return screen is the lock, not a marketing page. Any four digits pass in this prototype; the production app checks the stored PIN.

## What moved, merged, or was demoted

| Before | After |
| --- | --- |
| اقساط as a tab | تعهدها, opened from the month |
| بودجه tab holding investments and markets | برنامه holds budget and reports only. Markets are not a home. |
| Investments inside reports | دارایی, beside the cash accounts |
| All-transactions as a sheet from home | دفتر, a primary destination |
| SMS bell | A review row and a ledger filter |
| Theme button on home | Themes inside settings, three complete palettes |
| Quick entry sheet | Full-screen keypad |
| Goals as a separate editor | The unassigned number and the category ceilings. A travel goal can be a category later; it does not need its own world. |
| ChatGPT / MCP | Still in settings, under اتصال‌ها, not in the primary list |

## Screen list

| Screen | Role |
| --- | --- |
| آشنایی | One idea: the line |
| ورود | PIN, with الگو and اثر انگشت |
| خانه | Left to spend, pace chart, three figures, exceptions, hot categories, latest rows |
| ثبت | Keypad composer |
| دفتر | Search, kind chips, stacked filters, day groups |
| حساب‌ها | Cash total, accounts, masked cards |
| برگهٔ حساب | Balance, Sheba, that account’s rows |
| بودجه | Unassigned, groups, ticks |
| سرمایه‌گذاری | Portfolio, unrealized net, rows |
| دارایی | Value, both P&Ls, chart, facts, buy, sell, history |
| گزارش | Range, asset line, cash flow, categories, one sentence |
| تنظیمات | Themes, toman/rial, security, vault, connections, about 1.0.0 |
| تعهدها | Installment, cheque, subscription |
| دسکتاپ | Sidebar, month, composer |

## Motion

| Gesture | Duration | Curve |
| --- | --- | --- |
| Sheet and toast | 420ms / 280ms | cubic-bezier(0.22, 1, 0.36, 1) |
| Pace or price line | 850ms, once | same family |
| Digit settle while typing | 180ms | ease-out |
| Pressed key | 80ms | background only |

No stagger, no loop, no bounce. Reduced motion and the screenshot mode jump to the end state.

## Visual system (for the prototype)

Tokens live in `styles.css`. Type is Estedad, SIL OFL, self-hosted, variable. Do not letter-space Persian. Digits are Persian and tabular. Radii stay at 10–14, sheets at 20. The only brand green is the mark, the primary button, the active tab, and links. Review is a blue dot and nothing else. Up and down are reserved for money. Three themes — روز، شب، ساده — change the same tokens. ساده is the high-contrast pair for people who want black on white.

Icons are 1.5px strokes. If a control needs a new metaphor, it gets a word. The wordmark is the word حساب‌یار plus a short rule: the line, small enough to be a mark.
