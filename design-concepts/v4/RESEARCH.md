# Research for Hesabyar 1.0

Studied October 2026, for a Persian RTL ledger that is entered by hand and from bank SMS, not from Plaid. The question was what makes a finance app feel worth paying for, and what to leave behind after three rejected rounds: ornamental (زرنگار، کاشی، نسیم), generic (سپید، اُنیکس، هاله), and spectacular (آئورا، ویستا، ریتم).

Sources: Copilot’s own help and the Apple Developer conversation with the team, Monarch’s product surface, YNAB’s 2025 “plan” redesign notes, public breakdowns of YNAB and Copilot onboarding, Revolut and Wise product write-ups, Blu Bank’s 2.0 notes and icon system, the Dux Studio neobank transfer study, and the recurring patterns in Mobbin and Dribbble finance flows (Wallet, Apple Card, category pace, review queues). Screenshots of the live apps were not all publicly crawlable; the notes below stick to documented behavior and to patterns that show up consistently across those products.

## Navigation

Copilot’s iOS bar is a dashboard plus the books: transactions, categories, cash flow, accounts. The dashboard is home, and it is about **this month’s spending**, not a shrine to net worth. On iPad and Mac the same sections sit in a sidebar that can hide, and the extra width is used for the month at a glance. Web added keyboard review (arrows, R to mark reviewed, C to recategorize) because a ledger is a list you clear, not a page you admire.

YNAB’s 2025 pass renamed “budget” to “plan” and made the plan the place you act. The home screen is a checklist of money that still needs a job. Reports (“Reflect”) are a separate mode, not a junk drawer.

Monarch keeps one transaction list for every account, with accounts, budget, goals, and reports as peers. The weakness is the customizable dashboard: many cards, no point of view.

Revolut’s home is a short list of products plus a row of verbs (send, request, exchange). The verbs are the navigation. Blu’s 2.0 rewrite had the same aim: fewer taps to the thing you opened the app to do, night mode that follows the system, and no service-grid of bills, top-ups, and charity on the way to the balance.

Wise and Revolut both onboard with progressive disclosure. YNAB’s store listing is the cautionary case: a 24-step quiz before the product. Copilot does the opposite at the start of account setup — you can add an account by hand before connecting a bank, so you see a balance without a credential wall.

**Takeaway for Hesabyar.** Five destinations, each one a verb or a book. The month (home), the ledger, add, the balance sheet (cash accounts and investments together), the plan (budget and reports). Installments, cheques, and SMS review are not tabs. They are items on the month, one tap from home. Settings is the avatar, on every primary header. Desktop is a sidebar plus the work plus a composer, the way Copilot uses an iPad, not a stretched phone.

## Quick entry

Toshl and the better Revolut keypads prove the same loop: amount first, category second, done. YNAB’s 2025 keypad change was small and right: only show buttons that do something. Copilot can assume a bank feed; Iran cannot. SMS import is the feed, and the human still types the groceries.

The Dux Studio test of Iranian neobank transfers is specific. People expect toman (with rial as a choice), the source account already chosen, the primary button in a place the thumb already is, and no exam about پایا versus ساتنا. They also abandon a flow when the empty state has no starting button.

Blu’s own 2.0 notes match that: the app picks the transfer rail, the user writes a note, and a goal on a savings box is a percent, not a new product area.

**Takeaway.** Full-screen composer, not a form sheet. Persian keypad, amount in the largest type on the screen, then a row of recent templates (اسنپ with its usual amount), then category chips in frequency order. Account and date are chips that already have today’s answer. Note, tags, and receipt stay one tap away and off the critical path. Submitting is a single button that states the verb: ثبت هزینه، ثبت درآمد، ثبت انتقال. Target: template in two taps, or amount + category + ثبت. Undo, not a confirm dialog.

## Data viewing

Copilot’s dashboard graph is the clearest pattern in this set. The headline is **free to spend**. A solid line is the month so far. A dotted line is the pace that would land on the budget at month end. Rent spikes are why they invented recurrings: a mortgage should not look like a restaurant. Under the graph, in order: transactions to review, the categories that are trending hot, upcoming recurrings, net income. Review is a state, shown as a dot, clearable in the list without opening a form.

Category color in Copilot is semantic, not decorative. Green means on pace, yellow to orange means you will overshoot if you continue, red means over the ceiling. Past months collapse to under or over. Outlined bars mean “already expected” (the recurring).

Monarch’s useful idea is the review check on a single merged list, plus filters that stack (account, category, date, status) and a total for the filtered set. Copilot web does the same and adds the filtered net.

Apple Card and Wallet show one balance, a masked number, and transactions grouped by day under it. The card is a material, not a stack of marketing plastics. Vista already tried the stack.

Wise’s contribution is the sentence under the number. Fees, rate, and what will happen are visible before you confirm. For an investment that is the difference between realized and unrealized, written as a formula a person can repeat.

YNAB’s “give every dollar a job” is the other half of free-to-spend. Money that has arrived and not been assigned is a number, not a leftover. They put it in human language (“cost to be me”, “age of money”) rather than in accounting codes. Age of money needs a long history; assigned-versus-not does not.

Emma’s only idea worth taking is that upcoming bills are the home, not a report. Cleo’s only idea worth taking is one sentence of interpretation. The mascot and the roast are a different product.

**Takeaway.** Home is the pace of this month: what is left to spend, the line you should be on today, and the few exceptions (over ceiling, unreviewed SMS, next cheque or installment). The ledger is one list, grouped by Jalali day, with stacked filters and a total. Budgets use the same pace tick as the home chart, and they lead with money that still has no job. Investments show value, unrealized, and realized as three different facts, with the average-cost line drawn on the price chart. Reports are the long version of the same lines, not a second design language.

## Visual style

What the durable apps share once you ignore theme skins:

- One type family. Figures are a lighter optical size than labels, tabular, never tracked out. Persian letter-spacing is always wrong.
- Color is meaning. Brand color is scarce. Income, expense, warning, and “needs review” are the only other hues. Category color is a dot or a bar, not a card fill.
- Hairlines and a surface change, not drop shadows and not glass. Apple Card is allowed one material. Revolut dark is a real palette, not an inverted light theme.
- Eight-point spacing, radii in a tight band (about 10–14 for controls). Full-pill buttons and 28px squircles read as a template.
- Icons at 24px, about 1.5px stroke, familiar metaphors. Blu’s icon program is explicit: if the metaphor is new, put a word next to it. Don’t invent a glyph for “budget”.
- No illustration pack, no mascot, no coin, no mesh, no gradient button. Copilot’s 2024 brand work existed to get the cartoon out.
- Masked card numbers in groups of four, and secrets behind a second lock. That is the Iranian expectation too (Sheba, CVV, vault).

Blu is the local quality bar for tone: plain Persian sentences, night mode, a goal as a percent, and restraint. It is also the look the previous “plain” round already explored, so the difference has to be structural. A blue neobank with a big balance is not a point of view. A metal card, a violet gradient, and a glass mesh were the other rejected points of view.

**Takeaway.** A cool mineral canvas, one deep green used as ink rather than as a fill-everything accent, and a single drawn gesture: the reference line. On the month it is the pace. On a budget it is today’s tick. On an asset it is the average cost. The line is the logo. Estedad (OFL, variable) replaces Vazirmatn so the voice is not the previous three rounds. Figures at a medium weight, not black.

## Animation

The apps that feel expensive move very little.

- Sheets rise once, about 400ms, with a deceleration curve (`cubic-bezier(0.22, 1, 0.36, 1)` or similar). No bounce.
- A chart draws once when you arrive. Copilot’s cash-flow line and Wise’s progress steps are the references. Nothing loops.
- Keypad presses are 80–100ms and local.
- One number may count up when you land, then it sits. Counting every time you switch tabs feels like a toy.
- List rows do not stagger in.
- Theme changes cross-fade the canvas. They don’t flip every shadow.
- `prefers-reduced-motion` means the end state, immediately.

**Takeaway.** Three moves only: the sheet, the line drawing itself, and a 180ms digit settle on the amount you are typing. Everything else is instant.

## What “premium” actually is

Across Copilot, Wise, Apple Card, and Blu 2.0, premium is not a dark theme and not a gold edge. It is the feeling that the app has already decided what matters today, that the number you need is the first number, that the next action is obvious, and that nothing decorative competes with a figure. Trust is a formula written in the interface (Wise), a review queue you can finish (Copilot), a secret that stays masked (Apple Wallet, and a card vault), and a primary button you cannot miss (Dux, Revolut, Blu).

For a paid Iranian 1.0 that is mostly manual, the equivalent is: open the app and see whether this month is ahead of its line; file a purchase without a form; clear two SMS drafts from the same list; buy or sell a gold fund and read the realized result before confirming. If those four are calm, fast, and exact, the app is sellable. If they are wrapped in a texture, it is not.

## What this round will not do

- No shamse, tile, naskh, plaster, saffron, or household illustration. That was round 1.
- No single-blue neobank, no graphite bank card, no one-gradient wallet. That was round 2.
- No glass, mesh, stacked plastic, or poster numerals. That was round 3.
- No chatbot, no monster, no spending “roast”.
- No widget garden. The month has one layout.
- No fake broker. Prices are the prices the person entered. The unrealized figure says so.
