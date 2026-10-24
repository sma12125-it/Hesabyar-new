# نئوبانک — سه جهت تازه

Minimal modern banking. No ornament, no paper, no cultural motif. Same sample world as v1: سارا نادری، ۳۰ مهر ۱۴۰۵، تومان، ارزش خالص ۴۰۵٬۵۰۰٬۰۰۰. Type is **Vazirmatn** everywhere (crisp Persian sans). Peyda or IRANSansX can replace it later if licensed. Mobile frames are 390×844. Desktop is 1440×900.

Open `boards/*.html` or the PNGs in `screenshots/`. The earlier زرنگار / کاشی / نسیم set stays in the parent folder.

## سپید — Sepid

Light and airy, one decisive blue.

| | |
| --- | --- |
| Canvas | `#F3F4F6` |
| Card | `#FFFFFF`, shadow `0 10px 28px rgba(16,20,28,.06)` |
| Ink | `#101114` |
| Accent | `#1F4BFF` — primary card, add button, bars, active tab |
| Up / down | `#0C9A6A` / `#E11D48` |

Home is type-first: the balance sits on the canvas, then a 2×2 of flat account cards (ملت filled blue, the others white). Entry is a Revolut-style keypad. Reports are quiet horizontal bars, not a decorated chart. Tab bar is white; the add control is a blue rounded square.

Motion, when built: sheets 220ms ease-out, keypad press 80ms, bars grow from the start in 360ms. Reduced motion shows the end state.

## اُنیکس — Onyx

Dark premium fintech. Mostly monochrome.

| | |
| --- | --- |
| Canvas | `#0C0D11` |
| Card | `#17191F` with a 1px white hairline |
| Ink | `#F4F5F7` |
| Metal card | `#2C3038` → `#121318` |
| Ice accent | `#8EB6FF` — chart and status only |
| Add / primary | solid `#F4F5F7` |

The home hero is one metal account card (chip, masked number, net worth). Transactions are a plain list. The report ring is a four-segment donut. Buttons are white on black, the way Revolut dark treats a primary action.

Motion: card settles 240ms, list rows fade in 40ms stagger, ring draws 700ms. No glow loops.

## هاله — Haleh

Soft-gradient wallet. The gradient is allowed on one surface.

| | |
| --- | --- |
| Canvas | `#F5F6FB` plus a pale blue/violet mesh |
| Card | white, radius 20 |
| Ink | `#14151A` |
| Gradient | `#5C6CFF` → `#7A5CFF` → `#B86CFF` |
| Up / down | `#12996A` / `#EF3D5A` |

The balance card carries the gradient (Apple Card logic). Account rows, lists, and settings stay white. The add button and the submit button reuse that same gradient. The dock floats.

Motion: hero card shadow only, no mesh animation. Sheet 260ms. Reduced motion keeps the gradient flat.

## Comparison

| | سپید | اُنیکس | هاله |
| --- | --- | --- | --- |
| Feel | Daylight neobank | Night premium | Soft modern wallet |
| Accent | One blue, used often | Ice blue, used rarely | One violet gradient, one card |
| Best if | You want the default App Store look | You want a darker, quieter product | You want a single memorable card |
| Watch | Blue can feel generic if every control uses it | Low contrast if ice blue spreads | Gradient must stay on the hero and the add button |
