/* سنج — interactive prototype. Sample books: سارا نادری، ۱۸ مهر ۱۴۰۵. */

const FA = "۰۱۲۳۴۵۶۷۸۹";
const SPEND_CAP = 30000000;
const ASSIGNED = 32000000;
const PACE = 18000000;
const SPEND_BASE = [0.42, 0.9, 1.35, 1.9, 2.45, 3.1, 3.8, 4.5, 5.2, 9.4, 10.05, 10.8, 11.55, 12.45, 13.6, 14.7, 16.95, 18.64];
const MONTH_LABELS = ["ارد", "خر", "تیر", "مر", "شه", "مهر"];

const CATS = {
  food: { name: "خوراک", color: "#D06A2B" },
  transport: { name: "حمل", color: "#2F6FDB" },
  home: { name: "خانه", color: "#7A5BBF" },
  health: { name: "سلامت", color: "#0E8A78" },
  shop: { name: "خرید", color: "#C44B73" },
  fun: { name: "تفریح", color: "#C9842A" },
  bills: { name: "قبض", color: "#3E6E8C" },
  gift: { name: "هدیه", color: "#8A6A58" },
  salary: { name: "حقوق", color: "#0C7A48" },
  side: { name: "کار جانبی", color: "#0C7A48" },
  profit: { name: "سود", color: "#0C7A48" },
  otherin: { name: "سایر درآمد", color: "#5C6B64" },
  save: { name: "پس‌انداز", color: "#0D6A4F" },
};
const INCOME_CATS = ["salary", "side", "profit", "otherin"];
const BUDGETS = [
  { id: "home", limit: 6000000 },
  { id: "food", limit: 8000000 },
  { id: "bills", limit: 3500000 },
  { id: "health", limit: 2000000 },
  { id: "transport", limit: 3000000 },
  { id: "fun", limit: 2500000 },
  { id: "shop", limit: 4000000 },
  { id: "gift", limit: 1000000 },
  { id: "save", limit: 2000000 },
];
const GROUPS = [
  { name: "ضروری", ids: ["home", "food", "bills", "health"] },
  { name: "زندگی", ids: ["transport", "fun", "shop", "gift"] },
  { name: "آینده", ids: ["save"] },
];
const ACCOUNTS = [
  { id: "mellat", name: "بانک ملت", kind: "جاری", balance: 28650000, short: "مل", pan: "۶۰۳۷ ۹۹۱۲ •••• ۴۴۱۲", sheba: "IR۸۲ ۰۱۲۰ ۰۰۰۰ ۰۰۱۲ ۳۴۵۶ ۷۸۹۰" },
  { id: "cash", name: "کیف پول نقد", kind: "نقد", balance: 1350000, short: "نق" },
  { id: "housing", name: "پس‌انداز مسکن", kind: "کوتاه‌مدت", balance: 10800000, short: "مس" },
];
const CARDS = [
  { id: "hode", name: "کارت هوده", pan: "۶۰۳۷ ۹۹۱۲ •••• ۴۴۱۲", exp: "۰۸/۰۴", cvv: "۲۱۹", bank: "ملت" },
  { id: "saman", name: "کارت سامان", pan: "۶۲۱۹ ۸۶۱۲ •••• ۲۰۴۴", exp: "۰۶/۱۱", cvv: "۴۰۸", bank: "سامان" },
];
const DUES = [
  { kind: "قسط", title: "وام مسکن", date: "۲۸ مهر", amount: 4200000, meta: "قسط ۱۲ از ۲۴ · ۱۰ روز مانده" },
  { kind: "چک", title: "اجاره", date: "۵ آبان", amount: 12000000, meta: "۱۸ روز مانده" },
  { kind: "اشتراک", title: "فیلیمو", date: "۱ آبان", amount: 99000, meta: "تمدید خودکار" },
];
const TEMPLATES = [
  { id: "snapp", name: "اسنپ", amount: 86000, kind: "expense", category: "transport", account: "mellat" },
  { id: "bread", name: "نان سنگک", amount: 42000, kind: "expense", category: "food", account: "cash" },
  { id: "salary", name: "حقوق", amount: 45000000, kind: "income", category: "salary", account: "mellat" },
  { id: "coffee", name: "قهوه", amount: 75000, kind: "expense", category: "fun", account: "mellat" },
];
const DATES = [
  { id: "۱۸ مهر", label: "۱۸ مهر · امروز" },
  { id: "۱۷ مهر", label: "۱۷ مهر" },
  { id: "۱۶ مهر", label: "۱۶ مهر" },
  { id: "۱۰ مهر", label: "۱۰ مهر" },
];

const state = {
  theme: "day",
  unit: "toman",
  screen: "onboard",
  obStep: 1,
  obName: "",
  obAmountStr: "",
  pin: "",
  pattern: [],
  loginMode: "pin",
  stack: [],
  lastTab: "home",
  assetSeg: "accounts",
  planSeg: "budget",
  assetId: "kahroba",
  accountOpen: "mellat",
  settingsPage: null,
  sheet: null,
  trade: null,
  vaultCard: "hode",
  vaultOpen: false,
  draft: { category: null, account: null },
  filters: { kind: "all", category: null, account: null, q: "" },
  market: "all",
  range: "6m",
  assetRange: "6m",
  addKind: "expense",
  amountStr: "",
  amount: 0,
  category: null,
  accountId: "mellat",
  toAccountId: "housing",
  note: "",
  date: "۱۸ مهر",
  templateName: null,
  catOrder: ["transport", "food", "home", "fun", "shop", "bills", "health", "gift"],
  toast: null,
  seq: 1,
  counted: false,
  toggles: { pin: true, pattern: false, bio: true, vault: true, cloud: false, sms: true, share: false },
  txs: [
    { id: "t1", date: "۱۸ مهر", title: "اسنپ", cat: "transport", account: "mellat", amount: 86000, kind: "expense", review: true },
    { id: "t2", date: "۱۸ مهر", title: "نانوایی سنگک", cat: "food", account: "cash", amount: 42000, kind: "expense", review: true },
    { id: "t3", date: "۱۷ مهر", title: "حقوق مهر", cat: "salary", account: "mellat", amount: 45000000, kind: "income", review: true },
    { id: "t4", date: "۱۷ مهر", title: "دیجی‌کالا", cat: "shop", account: "mellat", amount: 1200000, kind: "expense", review: false, note: "از پیامک ملت" },
    { id: "t5", date: "۱۶ مهر", title: "کافه لمیز", cat: "fun", account: "mellat", amount: 215000, kind: "expense", review: true },
    { id: "t6", date: "۱۶ مهر", title: "پس‌انداز مسکن", cat: "save", account: "mellat", to: "housing", amount: 2000000, kind: "transfer", review: true },
    { id: "t7", date: "۱۵ مهر", title: "رستوران نایب", cat: "food", account: "mellat", amount: 640000, kind: "expense", review: true },
    { id: "t8", date: "۱۴ مهر", title: "قبض برق", cat: "bills", account: "mellat", amount: 312000, kind: "expense", review: false, note: "از پیامک ملت" },
    { id: "t9", date: "۱۲ مهر", title: "داروخانه", cat: "health", account: "mellat", amount: 480000, kind: "expense", review: true },
    { id: "t10", date: "۱۰ مهر", title: "قسط وام مسکن", cat: "home", account: "mellat", amount: 4200000, kind: "expense", review: true, note: "قسط ۱۲ از ۲۴" },
    { id: "t11", date: "۸ مهر", title: "هایپراستار", cat: "food", account: "mellat", amount: 2180000, kind: "expense", review: true },
    { id: "t12", date: "۷ مهر", title: "میوه و پروتئین", cat: "food", account: "mellat", amount: 2538000, kind: "expense", review: true },
    { id: "t13", date: "۶ مهر", title: "رفت‌وآمد", cat: "transport", account: "mellat", amount: 1240000, kind: "expense", review: true },
    { id: "t14", date: "۵ مهر", title: "بنزین", cat: "transport", account: "mellat", amount: 824000, kind: "expense", review: true },
    { id: "t15", date: "۴ مهر", title: "شارژ ساختمان", cat: "home", account: "mellat", amount: 2200000, kind: "expense", review: true },
    { id: "t16", date: "۳ مهر", title: "گاز و اینترنت", cat: "bills", account: "mellat", amount: 808000, kind: "expense", review: true },
    { id: "t17", date: "۲ مهر", title: "بلیت کنسرت", cat: "fun", account: "mellat", amount: 1675000, kind: "expense", review: true },
  ],
};

const ASSETS = [
  {
    id: "kahroba", name: "صندوق طلای کهربا", symbol: "عیار", market: "طلا", color: "#8A6A2F",
    unit: "واحد", decimals: 0, qty: 6200, avg: 27400, spot: 33600, realized: 6400000,
    blurb: "برای صندوق، خرید یعنی صدور و فروش یعنی ابطال.",
    series: [24000, 26800, 30800, 29200, 40200, 33600],
    history: [
      { date: "۲۰ اردیبهشت", kind: "buy", qty: 3400, price: 24000 },
      { date: "۸ تیر", kind: "buy", qty: 3400, price: 30800 },
      { date: "۱۹ مرداد", kind: "sell", qty: 400, price: 36000, realized: 3440000 },
      { date: "۲۸ شهریور", kind: "sell", qty: 200, price: 42200, realized: 2960000 },
    ],
  },
  {
    id: "foolad", name: "فولاد مبارکه", symbol: "فولاد", market: "سهام", color: "#2F6FDB",
    unit: "سهم", decimals: 0, qty: 12000, avg: 5480, spot: 5210, realized: 0,
    blurb: "میانگین، بهای سهم‌هایی است که هنوز فروخته نشده‌اند.",
    series: [6200, 6400, 6100, 5900, 5600, 5210],
    history: [{ date: "۱۱ خرداد", kind: "buy", qty: 12000, price: 5480 }],
  },
  {
    id: "coin", name: "ربع سکه", symbol: "سکه", market: "سکه", color: "#C47B2B",
    unit: "عدد", decimals: 0, qty: 2, avg: 16900000, spot: 20680000, realized: 2100000,
    blurb: "قیمت روز را خودت می‌نویسی. این صفحه به بازار وصل نیست.",
    series: [15000000, 16200000, 17100000, 18400000, 19000000, 20680000],
    history: [
      { date: "۲ فروردین", kind: "buy", qty: 3, price: 16900000 },
      { date: "۱۵ مرداد", kind: "sell", qty: 1, price: 19000000, realized: 2100000 },
    ],
  },
  {
    id: "btc", name: "بیت‌کوین", symbol: "BTC", market: "رمزارز", color: "#7A5BBF",
    unit: "بیت‌کوین", decimals: 3, qty: 0.006, avg: 4600000000, spot: 5400000000, realized: 900000,
    blurb: "تعداد اعشاری است. قیمت، بهای یک بیت‌کوین است نه ارزش مانده.",
    series: [3800000000, 4100000000, 4500000000, 5050000000, 5200000000, 5400000000],
    history: [
      { date: "۴ خرداد", kind: "buy", qty: 0.008, price: 4600000000 },
      { date: "۲۲ شهریور", kind: "sell", qty: 0.002, price: 5050000000, realized: 900000 },
    ],
  },
  {
    id: "saman", name: "سپرده ۱۸٪ سامان", symbol: "سپرده", market: "سپرده", color: "#0E8A78",
    mode: "deposit", unit: "تومان", decimals: 0, principal: 18500000, value: 20100000, realized: 0,
    blurb: "خط چین اصل سپرده است. خط پر، مانده با سودِ ثبت‌شده.",
    series: [18500000, 18750000, 19020000, 19340000, 19720000, 20100000],
    history: [{ date: "۱ فروردین", kind: "buy", qty: 18500000, price: 1 }],
  },
];

let DESKTOP = false;
let SHOT = false;

function fa(s) { return String(s).replace(/\d/g, (d) => FA[d]); }
function trimNum(n) { return String(Math.round(n * 10) / 10).replace(/\.0$/, ""); }
function digits(n) {
  const v = Math.abs(Math.round(Number(n) || 0));
  return fa(v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "٬"));
}
function shown(n) { return state.unit === "rial" ? n * 10 : n; }
function moneyU(n) { return digits(shown(n)); }
function signed(n) {
  if (n > 0) return "+" + moneyU(n);
  if (n < 0) return "−" + moneyU(Math.abs(n));
  return moneyU(0);
}
function compact(n) {
  const neg = n < 0;
  const v = Math.abs(Math.round(shown(n)));
  const sign = neg ? "−" : "";
  if (v >= 1000000000) return sign + fa(trimNum(v / 1000000000).replace(".", "٫")) + " میلیارد";
  if (v >= 1000000) return sign + fa(trimNum(v / 1000000).replace(".", "٫")) + " میلیون";
  if (v >= 1000) return sign + fa(Math.round(v / 1000)) + " هزار";
  return sign + digits(v);
}
function unitWord() { return state.unit === "rial" ? "ریال" : "تومان"; }
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function num(s) {
  const n = Number(String(s ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function catName(id) { return CATS[id]?.name || "—"; }
function accName(id) { return ACCOUNTS.find((a) => a.id === id)?.name || "—"; }
function acc(id) { return ACCOUNTS.find((a) => a.id === id); }
function currentAsset() { return ASSETS.find((a) => a.id === state.assetId) || ASSETS[0]; }
function roundQty(a, q) { return a.decimals ? Math.round(q * 1000) / 1000 : Math.round(q); }
function formatQty(a, q) {
  if (a.mode === "deposit") return moneyU(q);
  if (a.decimals) return fa(Number(q).toFixed(a.decimals).replace(".", "٫"));
  return digits(q);
}
function priceText(n) {
  const v = Math.abs(shown(n));
  if (v >= 1000000000) return fa(trimNum(v / 1000000000).replace(".", "٫")) + " میلیارد";
  return moneyU(n);
}
function pos(a) {
  if (a.mode === "deposit") {
    return { invested: a.principal, value: a.value, unrealized: a.value - a.principal, realized: a.realized, qty: a.principal, avg: a.principal, spot: a.value };
  }
  const invested = a.qty * a.avg;
  const value = a.qty * a.spot;
  return { qty: a.qty, avg: a.avg, spot: a.spot, invested, value, unrealized: value - invested, realized: a.realized };
}
function portfolio() {
  return ASSETS.reduce((s, a) => {
    const p = pos(a);
    s.value += p.value; s.unrealized += p.unrealized; s.realized += p.realized;
    return s;
  }, { value: 0, unrealized: 0, realized: 0 });
}
function balance(id) {
  let b = acc(id).balance;
  for (const t of state.txs) {
    if (!String(t.id).startsWith("n")) continue;
    if (t.kind === "expense" && t.account === id) b -= t.amount;
    if (t.kind === "income" && t.account === id) b += t.amount;
    if (t.kind === "transfer" && t.account === id) b -= t.amount;
    if (t.kind === "transfer" && t.to === id) b += t.amount;
  }
  return b;
}
function cash() { return ACCOUNTS.reduce((s, a) => s + balance(a.id), 0); }
function spent() { return state.txs.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0); }
function incomeTotal() { return state.txs.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0); }
function spentIn(id) {
  if (id === "save") return state.txs.filter((t) => t.kind === "transfer" && t.to === "housing").reduce((s, t) => s + t.amount, 0);
  return state.txs.filter((t) => t.kind === "expense" && t.cat === id).reduce((s, t) => s + t.amount, 0);
}
function left() { return SPEND_CAP - spent(); }
function unassigned() { return incomeTotal() - ASSIGNED; }
function paceDelta() { return spent() - PACE; }
function assetTotal() { return cash() + portfolio().value; }
function pendingCount() { return state.txs.filter((t) => !t.review).length; }
function kindWord(a, kind) {
  if (kind === "spot") return "قیمت روز";
  if (a?.mode === "deposit") return kind === "buy" ? "واریز" : "برداشت";
  return kind === "buy" ? "خرید" : "فروش";
}

function ic(name) {
  const d = {
    home: '<path d="M4 11.2 12 4.8l8 6.4"/><path d="M7.5 10.8V19h9v-8.2"/>',
    book: '<path d="M6.5 5.5h10A1.5 1.5 0 0 1 18 7v12H8A1.5 1.5 0 0 0 6.5 17.5Z"/>',
    plus: '<path d="M12 6v12M6 12h12"/>',
    wallet: '<rect x="3.5" y="6.5" width="17" height="12" rx="2"/><path d="M3.5 10.5h17"/>',
    plan: '<path d="M5 19V6.5M5 19h14"/><path d="M8 15.5 11.2 12l3 2.2L19 8"/>',
    back: '<path d="M10 6l6 6-6 6"/>',
    gear: '<path d="M4 8h16M4 16h16"/><circle cx="9" cy="8" r="2.2"/><circle cx="15" cy="16" r="2.2"/>',
    close: '<path d="M7 7l10 10M17 7 7 17"/>',
  };
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d[name] || ""}</svg>`;
}
function statusHTML() {
  return `<div class="status"><span>${fa("18:24")}</span><span class="status-ico" aria-hidden="true">
    <svg viewBox="0 0 18 12"><rect x="0" y="7" width="2.4" height="5" rx="0.5" fill="currentColor"/><rect x="4" y="4.5" width="2.4" height="7.5" rx="0.5" fill="currentColor"/><rect x="8" y="2" width="2.4" height="10" rx="0.5" fill="currentColor"/><rect x="12" y="0" width="2.4" height="12" rx="0.5" fill="currentColor" opacity="0.35"/></svg>
    <svg viewBox="0 0 20 12"><rect x="0.6" y="1" width="16" height="10" rx="2" stroke="currentColor" fill="none" stroke-width="1.3"/><rect x="2" y="2.5" width="11" height="7" rx="1" fill="currentColor"/><rect x="17.2" y="4" width="1.6" height="4" rx="0.4" fill="currentColor"/></svg>
  </span></div>`;
}

function spendSeries() {
  const s = SPEND_BASE.slice();
  s[s.length - 1] = Math.round((s[s.length - 1] + (spent() - 18640000) / 1e6) * 100) / 100;
  return s;
}
function paceSvg(empty) {
  const w = 320, h = 156, padL = 6, padR = 8, padT = 14, padB = 16, max = 32;
  const x = (day) => padL + (day / 30) * (w - padL - padR);
  const y = (mil) => padT + (1 - mil / max) * (h - padT - padB);
  const ideal = `M ${x(0).toFixed(1)} ${y(0).toFixed(1)} L ${x(30).toFixed(1)} ${y(30).toFixed(1)}`;
  if (empty) {
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="خط ماه">
      <path d="${ideal}" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="3 4"></path>
      <text class="chart-label" x="${(w - 8)}" y="22" text-anchor="end">خط ماه</text>
    </svg>`;
  }
  const series = spendSeries();
  const line = series.map((v, i) => `${i ? "L" : "M"} ${x(i + 1).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = series[series.length - 1];
  const xT = x(18), yT = y(last);
  const area = `${line} L ${xT.toFixed(1)} ${y(0).toFixed(1)} L ${x(1).toFixed(1)} ${y(0).toFixed(1)} Z`;
  const hot = last > 18.05;
  const stroke = hot ? "var(--warn)" : "var(--ink)";
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="خرج ماه در برابر خط بودجه">
    <path d="${area}" fill="${hot ? "var(--warn)" : "var(--brand)"}" opacity="0.10"></path>
    <path d="${ideal}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="3 4"></path>
    <line x1="${xT}" y1="${padT}" x2="${xT}" y2="${y(0)}" stroke="var(--ink)" stroke-opacity="0.18"></line>
    <path data-draw d="${line}" fill="none" stroke="${stroke}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"></path>
    <circle cx="${xT}" cy="${yT}" r="3.6" fill="${stroke}"></circle>
    <text class="chart-label" x="${x(30)}" y="${Math.max(12, y(30) - 6)}" text-anchor="end">سقف</text>
    <text class="chart-label" x="${xT}" y="${h - 3}" text-anchor="middle">امروز</text>
  </svg>`;
}
function priceSvg(a) {
  const n = state.assetRange === "1m" ? 2 : state.assetRange === "3m" ? 3 : 6;
  const series = a.series.slice(-n);
  const labels = MONTH_LABELS.slice(-n);
  const ref = a.mode === "deposit" ? a.principal : a.avg;
  const w = 320, h = 156, padL = 4, padR = 4, padT = 12, padB = 22;
  const max = Math.max(ref, ...series) * 1.06;
  const min = Math.min(ref, ...series) * 0.94;
  const x = (i) => padL + (series.length === 1 ? 0.5 : i / (series.length - 1)) * (w - padL - padR);
  const y = (v) => padT + (1 - (v - min) / (max - min || 1)) * (h - padT - padB);
  const line = series.map((v, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const up = series[series.length - 1] >= ref;
  const stroke = up ? "var(--up)" : "var(--down)";
  const ticks = labels.map((lb, i) => `<text class="chart-label" x="${x(i).toFixed(1)}" y="${h - 4}" text-anchor="middle">${lb}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="قیمت در برابر میانگین">
    <path d="M ${padL} ${y(ref).toFixed(1)} L ${w - padR} ${y(ref).toFixed(1)}" fill="none" stroke="var(--muted)" stroke-width="1.4" stroke-dasharray="3 4"></path>
    <path data-draw d="${line}" fill="none" stroke="${stroke}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"></path>
    <circle cx="${x(series.length - 1)}" cy="${y(series[series.length - 1])}" r="3.6" fill="${stroke}"></circle>
    ${ticks}
  </svg>`;
}
function legend(solid, dash) {
  return `<div class="legend"><b><i class="sw"></i>${solid}</b><b><i class="sw dash"></i>${dash}</b></div>`;
}
function kickCharts() {
  if (SHOT || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelectorAll("[data-draw]").forEach((p) => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    p.getBoundingClientRect();
    p.style.transition = "stroke-dashoffset .85s cubic-bezier(.22,1,.36,1)";
    p.style.strokeDashoffset = "0";
  });
}
function kickCount() {
  if (SHOT || state.counted) return;
  const el = document.querySelector("[data-count]");
  if (!el) return;
  state.counted = true;
  const target = Number(el.dataset.count);
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 700);
    const e = 1 - (1 - k) ** 3;
    el.textContent = signed(Math.round(target * e)).replace(/^\+/, "");
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function topBar({ title = "", back = false, sub = "", avatar = true } = {}) {
  if (!back && !title) {
    return `<header class="top brand-top"><div class="brand"><span class="mark" aria-hidden="true"><i></i></span><div><b>حساب‌یار</b>${sub ? `<small>${sub}</small>` : ""}</div></div>${avatar ? `<button type="button" class="avatar" data-act="settings" aria-label="تنظیمات">س</button>` : ""}</header>`;
  }
  const start = back
    ? `<button type="button" class="icon-btn" data-act="back" aria-label="بازگشت">${ic("back")}</button>`
    : `<span class="mark"><i></i></span>`;
  const end = avatar
    ? `<button type="button" class="avatar" data-act="settings" aria-label="تنظیمات">س</button>`
    : `<span></span>`;
  return `<header class="top">${start}<h1 class="top-title">${title}</h1>${end}</header>`;
}
function keysHTML(withDot) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", withDot ? "." : "000", "0", "del"];
  return `<div class="keys">${keys.map((k) => {
    const label = k === "del" ? "⌫" : k === "." ? "٫" : fa(k);
    return `<button type="button" data-act="key" data-key="${k}" ${k === "del" || k === "." ? 'class="ghost-key"' : ""}>${label}</button>`;
  }).join("")}</div>`;
}
function chip(label, act, id, on, dot) {
  return `<button type="button" class="chip${on ? " on" : ""}" data-act="${act}" data-id="${id || ""}">${dot ? `<i class="dot" style="background:${dot}"></i>` : ""}${label}</button>`;
}
function txRow(t, act = "open-tx") {
  const dot = t.review ? `style="background:${CATS[t.cat]?.color || "var(--faint)"}"` : `class="dot review"`;
  const amt = t.kind === "income" ? `<span class="row-amt up">+${moneyU(t.amount)}</span>`
    : t.kind === "expense" ? `<span class="row-amt down">−${moneyU(t.amount)}</span>`
    : `<span class="row-amt">${moneyU(t.amount)}</span>`;
  const sub = !t.review ? `<span class="row-sub review">بررسی نشده · ${accName(t.account)}</span>`
    : t.kind === "transfer" ? `<span class="row-sub">انتقال · از ${accName(t.account)}</span>`
    : `<span class="row-sub">${catName(t.cat)} · ${accName(t.account)}</span>`;
  const review = t.review ? "" : `<button type="button" class="mini" data-act="review" data-id="${t.id}">تأیید</button>`;
  return `<button type="button" class="row" data-act="${act}" data-id="${t.id}"><i class="dot" ${dot}></i><span class="row-main"><span class="row-title">${esc(t.title)}</span>${sub}</span>${review}${amt}</button>`;
}
function meterHTML(id) {
  const limit = BUDGETS.find((b) => b.id === id).limit;
  const s = spentIn(id);
  const ratio = limit ? s / limit : 0;
  let tone = "ok";
  let tag = "زیر خط";
  if (id === "save") tag = s >= limit ? "کنار گذاشته شد" : "باقی‌مانده";
  else if (s > limit) { tone = "down"; tag = "از سقف گذشته"; }
  else if (ratio > 18 / 30) { tone = "warn"; tag = "جلوتر از خط"; }
  const width = Math.min(100, ratio * 100);
  const fillClass = tone === "ok" ? "" : tone;
  return `<div class="meter"><div class="meter-top"><i class="dot" style="background:${CATS[id].color}"></i><span class="name">${CATS[id].name}</span><span class="tag ${tone}">${tag}</span><b>${compact(s)} از ${compact(limit)}</b></div><div class="track"><i class="tick" style="inset-inline-start:60%"></i><i class="fill ${fillClass}" style="width:${width}%"></i></div></div>`;
}
function visibleTx() {
  const q = state.filters.q.trim();
  return state.txs.filter((t) => {
    if (state.filters.kind === "review" && t.review) return false;
    if (state.filters.kind === "expense" && t.kind !== "expense") return false;
    if (state.filters.kind === "income" && t.kind !== "income") return false;
    if (state.filters.kind === "transfer" && t.kind !== "transfer") return false;
    if (state.filters.category && t.cat !== state.filters.category) return false;
    if (state.filters.account && t.account !== state.filters.account && t.to !== state.filters.account) return false;
    if (q && !`${t.title} ${catName(t.cat)} ${accName(t.account)} ${t.note || ""}`.includes(q)) return false;
    return true;
  });
}
function ledgerListHTML(rows = visibleTx()) {
  if (!rows.length) return `<p class="quiet">چیزی با این صافی پیدا نشد.</p>`;
  let html = "";
  let prev = "";
  for (const t of rows) {
    if (t.date !== prev) { html += `<div class="day-h">${t.date}</div>`; prev = t.date; }
    html += txRow(t);
  }
  return html;
}
function ledgerMetaHTML(rows = visibleTx()) {
  const exp = rows.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
  const inc = rows.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const bits = [`${fa(rows.length)} تراکنش`];
  if (exp) bits.push(`${moneyU(exp)} خرج`);
  if (inc) bits.push(`${moneyU(inc)} درآمد`);
  return bits.join(" · ");
}

function paceFlag() {
  const d = paceDelta();
  if (d > 50000) return `<p class="flag warn">${compact(d)} جلوتر از خط ماه</p>`;
  if (d < -50000) return `<p class="flag ok">${compact(Math.abs(d))} زیر خط ماه</p>`;
  return `<p class="flag ok">روی خط ماه</p>`;
}
function homeBlocks(split) {
  const over = BUDGETS.find((b) => b.id !== "save" && spentIn(b.id) > b.limit);
  const n = pendingCount();
  const exceptions = `
    <div class="sec-h"><h2>الان</h2></div>
    ${over ? `<button type="button" class="row" data-act="jump" data-id="budgets"><i class="dot" style="background:var(--down)"></i><span class="row-main"><span class="row-title">${CATS[over.id].name} از سقف گذشته</span><span class="row-sub">${compact(spentIn(over.id))} از ${compact(over.limit)}</span></span></button>` : ""}
    ${n ? `<button type="button" class="row" data-act="jump" data-id="review"><i class="dot review"></i><span class="row-main"><span class="row-title">${fa(n)} پیامک بدون دسته</span><span class="row-sub">در دفتر منتظر تأییدند</span></span></button>` : ""}
    <button type="button" class="row" data-act="jump" data-id="dues"><i class="dot" style="background:var(--warn)"></i><span class="row-main"><span class="row-title">قسط وام مسکن</span><span class="row-sub">۲۸ مهر · ۱۰ روز مانده</span></span><span class="row-amt">${moneyU(DUES[0].amount)}</span></button>`;
  const hot = `
    <div class="sec-h"><h2>جلوتر از خط</h2><button type="button" class="link" data-act="jump" data-id="budgets">بودجه</button></div>
    ${meterHTML("fun")}${meterHTML("food")}`;
  const recent = `
    <div class="sec-h"><h2>تازه‌ها</h2><button type="button" class="link" data-act="jump" data-id="ledger">دفتر</button></div>
    ${state.txs.slice(0, 4).map((t) => txRow(t)).join("")}`;
  if (!split) return exceptions + hot + recent;
  return `<div class="desk-home-split"><div>${exceptions}${hot}</div><div>${recent}</div></div>`;
}
function homeView(wide) {
  const hero = `<section class="hero">
      <div class="kicker">ماندهٔ قابل خرج</div>
      <div class="figure-row"><span class="figure" data-count="${left()}">${moneyU(left())}</span><span class="unit">${unitWord()}</span></div>
      <p class="caption">سقف خرج ${compact(SPEND_CAP)} · خط امروز ${compact(PACE)}<br>خرج شده ${compact(spent())}</p>
      ${paceFlag()}
      <button type="button" class="chart-btn" data-act="jump" data-id="reports" aria-label="رفتن به گزارش">${paceSvg(false)}</button>
      ${legend("خرج تو", "خط ماه")}
    </section>`;
  const head = wide
    ? `<header class="top brand-top"><div class="brand"><div><b>مهر ۱۴۰۵</b><small>جمعه ۱۸ مهر · سارا نادری</small></div></div><button type="button" class="avatar" data-act="settings" aria-label="تنظیمات">س</button></header>`
    : topBar({ sub: "جمعه ۱۸ مهر ۱۴۰۵" });
  return `${head}
    ${hero}
    <div class="stats">
      <button type="button" data-act="jump" data-id="cash"><small>نقد</small><b>${compact(cash())}</b></button>
      <button type="button" data-act="jump" data-id="invest"><small>سرمایه</small><b>${compact(portfolio().value)}</b></button>
      <button type="button" data-act="jump" data-id="dues"><small>قسط بعدی</small><b>${compact(DUES[0].amount)}</b><em>${DUES[0].date}</em></button>
    </div>
    ${homeBlocks(wide)}`;
}

function canSubmit() {
  if (state.amount <= 0) return false;
  if (state.addKind === "transfer") return state.accountId !== state.toAccountId;
  if (!state.category) return false;
  if (state.addKind === "expense" && state.amount > balance(state.accountId)) return false;
  return true;
}
function hintText() {
  if (state.addKind === "expense" && state.amount > 0 && state.amount > balance(state.accountId)) return "از ماندهٔ این حساب بیشتر است";
  if (state.amount > 0 && state.addKind !== "transfer" && !state.category) return "دسته را انتخاب کن";
  if (state.addKind === "transfer" && state.accountId === state.toAccountId) return "حساب مبدأ و مقصد یکی است";
  return "";
}
function catChoices() {
  if (state.addKind === "income") return INCOME_CATS;
  return state.catOrder.filter((id) => !INCOME_CATS.includes(id) && id !== "save");
}
function addView(embedded) {
  const head = embedded
    ? `<header class="top brand-top"><div class="brand"><div><b>ثبت سریع</b><small>کنار دفتر، نه روی آن</small></div></div></header>`
    : topBar({ title: "ثبت", back: true, avatar: false });
  const kinds = ["expense", "income", "transfer"].map((k) => {
    const label = k === "expense" ? "هزینه" : k === "income" ? "درآمد" : "انتقال";
    return `<button type="button" class="${state.addKind === k ? "on" : ""}" data-act="set-kind" data-id="${k}">${label}</button>`;
  }).join("");
  const cats = catChoices();
  const shownCats = state.addKind === "income" ? cats : cats.slice(0, 6);
  const more = state.addKind !== "income" && cats.length > 6;
  const catRow = state.addKind === "transfer" ? "" : `<div class="chips" style="margin-top:10px">${shownCats.map((id) => chip(CATS[id].name, "set-cat", id, state.category === id, CATS[id].color)).join("")}${more ? chip("بیشتر", "more-cats", "", false) : ""}</div>`;
  const accountBits = state.addKind === "transfer"
    ? `<div class="chips" style="margin-top:12px">${chip("از " + accName(state.accountId), "pick-account", "", true)}${chip("به " + accName(state.toAccountId), "pick-to", "", true)}</div>`
    : `<div class="chips scroll" style="margin-top:12px">${chip(accName(state.accountId), "pick-account", "", false)}${chip(state.date, "pick-date", "", false)}</div>`;
  const templates = `<div class="chips scroll" style="margin-top:8px">${TEMPLATES.map((t) => chip(`${t.name} · ${compact(t.amount)}`, "template", t.id, state.templateName === t.name)).join("")}</div>`;
  const verb = state.addKind === "income" ? "ثبت درآمد" : state.addKind === "transfer" ? "ثبت انتقال" : "ثبت هزینه";
  return `<div class="add">${head}
    <div class="seg" role="tablist">${kinds}</div>
    <div class="amount-block"><div class="kicker">${state.addKind === "transfer" ? "مبلغ انتقال" : "مبلغ"}</div>
      <div class="figure-row"><span class="figure${state.amount ? "" : " is-zero"}" data-amount>${state.amount ? moneyU(state.amount) : "۰"}</span><span class="unit">${unitWord()}</span></div>
    </div>
    ${accountBits}${templates}${catRow}
    <p class="hint" data-hint>${hintText()}</p>
    <input class="note-line" data-field="note" placeholder="یادداشت، اگر لازم است" value="${esc(state.note)}" />
    <div class="grow"></div>
    <button type="button" class="submit" data-act="submit-add" data-submit ${canSubmit() ? "" : "disabled"}>${verb}</button>
    ${keysHTML(false)}
  </div>`;
}

function ledgerView() {
  const kinds = [["all", "همه"], ["expense", "هزینه"], ["income", "درآمد"], ["transfer", "انتقال"], ["review", "بررسی"]];
  const chips = kinds.map(([id, label]) => {
    const extra = id === "review" && pendingCount() ? ` ${fa(pendingCount())}` : "";
    return chip(label + extra, "kind-filter", id, state.filters.kind === id);
  }).join("");
  const applied = `
    ${state.filters.category ? chip(catName(state.filters.category) + " ×", "clear-cat", "", true) : ""}
    ${state.filters.account ? chip(accName(state.filters.account) + " ×", "clear-account", "", true) : ""}
    ${chip("صافی", "open-filter", "", !!(state.filters.category || state.filters.account))}`;
  return `${topBar({ title: "دفتر" })}
    <div class="sticky">
      <div class="pad"><input class="search" data-field="search" placeholder="جستجو در شرح، دسته، حساب" value="${esc(state.filters.q)}" /></div>
      <div class="chips scroll" style="margin-top:8px">${chips}</div>
      <div class="filter-row">${applied}</div>
      <div class="meta" id="ledger-meta">${ledgerMetaHTML()}</div>
    </div>
    <div id="ledger-list">${ledgerListHTML()}</div>`;
}

function assetSwitch() {
  return `<div class="pad" style="padding-top:4px"><div class="seg two"><button type="button" class="${state.assetSeg === "accounts" ? "on" : ""}" data-act="asset-seg" data-id="accounts">حساب‌ها</button><button type="button" class="${state.assetSeg === "investments" ? "on" : ""}" data-act="asset-seg" data-id="investments">سرمایه‌گذاری</button></div></div>`;
}
function accountsView() {
  const rows = ACCOUNTS.map((a) => `<button type="button" class="row" data-act="open-account" data-id="${a.id}"><span class="sq">${a.short}</span><span class="row-main"><span class="row-title">${a.name}</span><span class="row-sub">${a.kind}${a.pan ? " · " + a.pan : ""}</span></span><span class="row-amt">${moneyU(balance(a.id))}</span></button>`).join("");
  const cards = CARDS.map((c) => `<button type="button" class="row" data-act="open-vault" data-id="${c.id}"><span class="row-main"><span class="row-title">${c.name}</span><span class="row-sub">${c.pan} · ${c.exp}</span></span><span class="row-sub">گاوصندوق</span></button>`).join("");
  return `${topBar({ title: "حساب‌ها" })}
    ${assetSwitch()}
    <div class="big-quiet"><span class="kicker">نقد</span><strong>${moneyU(cash())}</strong><p class="quiet" style="padding-inline:0">کارت‌ها موجودی جدا نیستند. CVV پشت قفل دوم است.</p></div>
    ${rows}
    <div class="sec-h"><h2>کارت‌ها</h2></div>
    ${cards}`;
}
function accountView() {
  const a = acc(state.accountOpen);
  const rows = state.txs.filter((t) => t.account === a.id || t.to === a.id);
  let list = "";
  let prev = "";
  for (const t of rows) {
    if (t.date !== prev) { list += `<div class="day-h">${t.date}</div>`; prev = t.date; }
    list += txRow(t);
  }
  const sheba = a.sheba ? `<button type="button" class="row" data-act="copy-sheba"><span class="row-main"><span class="row-title">شبا</span><span class="row-sub">${a.sheba}</span></span><span class="mini">کپی</span></button>` : "";
  return `${topBar({ title: a.name, back: true })}
    <div class="big-quiet"><span class="kicker">${a.kind}</span><strong>${moneyU(balance(a.id))}</strong></div>
    ${sheba}
    <div class="sec-h"><h2>حرکت‌های این حساب</h2></div>
    ${list || `<p class="quiet">هنوز حرکتی نیست.</p>`}`;
}
function investmentsView() {
  const markets = ["all", "طلا", "سهام", "سکه", "رمزارز", "سپرده"];
  const labels = { all: "همه", طلا: "طلا", سهام: "سهام", سکه: "سکه", رمزارز: "رمزارز", سپرده: "سپرده" };
  const list = ASSETS.filter((a) => state.market === "all" || a.market === state.market);
  const pf = portfolio();
  const rows = list.map((a) => {
    const p = pos(a);
    const pct = p.invested ? (p.unrealized / p.invested) * 100 : 0;
    const cls = p.unrealized >= 0 ? "up" : "down";
    return `<button type="button" class="row" data-act="open-asset" data-id="${a.id}"><i class="dot" style="background:${a.color}"></i><span class="row-main"><span class="row-title">${a.name}</span><span class="row-sub">${a.symbol} · ${a.market}</span></span><span class="row-main" style="margin-inline-start:auto;text-align:end"><span class="row-title">${compact(p.value)}</span><span class="row-sub ${cls}">${pct >= 0 ? "+" : "−"}${fa(trimNum(Math.abs(pct)).replace(".", "٫"))}٪</span></span></button>`;
  }).join("");
  return `${topBar({ title: "سرمایه‌گذاری" })}
    ${assetSwitch()}
    <div class="big-quiet"><span class="kicker">ارزش سبد</span><strong>${moneyU(pf.value)}</strong>
      <p class="quiet" style="padding-inline:0">تحقق‌نیافته <b class="${pf.unrealized >= 0 ? "up" : "down"}">${signed(pf.unrealized)}</b> · تحقق‌یافته <b class="up">${signed(pf.realized)}</b></p>
    </div>
    <div class="chips scroll" style="margin:8px 0">${markets.map((m) => chip(labels[m], "market", m, state.market === m)).join("")}</div>
    ${rows}`;
}
function assetView() {
  const a = currentAsset();
  const p = pos(a);
  const refLabel = a.mode === "deposit" ? "اصل سپرده" : "میانگین خرید";
  const facts = a.mode === "deposit"
    ? [["نرخ", "۱۸٪"], ["اصل", moneyU(a.principal)], ["مانده", moneyU(a.value)], ["شروع", "۱ فروردین"]]
    : [["تعداد", formatQty(a, p.qty) + " " + a.unit], [refLabel, priceText(p.avg)], ["قیمت روز", priceText(p.spot)], ["بهای مانده", moneyU(p.invested)]];
  const history = a.history.map((h) => {
    const label = kindWord(a, h.kind);
    const qty = a.mode === "deposit" ? moneyU(h.qty) : `${formatQty(a, h.qty)} ${a.unit}`;
    const price = a.mode === "deposit" ? "" : ` · ${priceText(h.price)}`;
    const gain = h.realized == null ? "" : ` · تحقق‌یافته ${signed(h.realized)}`;
    return `<div class="row"><span class="row-main"><span class="row-title">${label} ${qty}</span><span class="row-sub">${h.date}${price}${gain}</span></span></div>`;
  }).join("");
  const spotBtn = a.mode === "deposit" ? "" : `<button type="button" class="link" data-act="open-trade" data-id="spot">تغییر قیمت روز</button>`;
  return `${topBar({ title: a.symbol, back: true })}
    <div class="big-quiet"><span class="kicker">${a.name} · ${a.market}</span><strong>${moneyU(p.value)}</strong></div>
    <div class="pl"><span>تحقق‌نیافته</span><b class="${p.unrealized >= 0 ? "up" : "down"}">${signed(p.unrealized)}</b><span>تحقق‌یافته</span><b class="${p.realized >= 0 ? "up" : "down"}">${signed(p.realized)}</b></div>
    <div class="range">
      ${[["1m", "۱ماه"], ["3m", "۳ماه"], ["6m", "۶ماه"]].map(([id, lb]) => `<button type="button" class="${state.assetRange === id ? "on" : ""}" data-act="asset-range" data-id="${id}">${lb}</button>`).join("")}
      ${spotBtn}
    </div>
    <div class="pad">${priceSvg(a)}${legend(a.mode === "deposit" ? "مانده" : "قیمت", refLabel)}</div>
    <div class="facts">${facts.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>
    <p class="quiet">${a.blurb} سود تحقق‌نیافته با قیمت روز عوض می‌شود. سود تحقق‌یافته فقط وقتی قطعی است که فروخته باشی.</p>
    <div class="pair-actions">
      <button type="button" class="primary" data-act="open-trade" data-id="buy">${kindWord(a, "buy")}</button>
      <button type="button" class="ghost" data-act="open-trade" data-id="sell">${kindWord(a, "sell")}</button>
    </div>
    <div class="sec-h"><h2>تاریخچه</h2></div>
    ${history}`;
}

function budgetsView() {
  const u = unassigned();
  return `${topBar({ title: "بودجه" })}
    <div class="pad" style="padding-top:4px"><div class="seg two"><button type="button" class="on" data-act="plan" data-id="budget">بودجه</button><button type="button" data-act="plan" data-id="reports">گزارش</button></div></div>
    <div class="big-quiet"><span class="kicker">تقسیم‌نشده · مهر ۱۴۰۵</span><strong class="${u > 0 ? "brand" : ""}">${moneyU(u)}</strong><p class="quiet" style="padding-inline:0">${u > 0 ? "این پول هنوز به دسته‌ای نرفته." : "درآمد این ماه تقسیم شده."}</p></div>
    <p class="meta">خرج ${moneyU(spent())} از سقف ${moneyU(SPEND_CAP)} · تیک، روز ۱۸ از ۳۰ است</p>
    ${GROUPS.map((g) => `<div class="group-label">${g.name}</div>${g.ids.map(meterHTML).join("")}`).join("")}`;
}
function reportsView() {
  const months = [
    { name: "اردیبهشت", income: 42000000, expense: 28400000, nw: 352000000 },
    { name: "خرداد", income: 42000000, expense: 31200000, nw: 361000000 },
    { name: "تیر", income: 48500000, expense: 29800000, nw: 370000000 },
    { name: "مرداد", income: 45000000, expense: 33600000, nw: 384000000 },
    { name: "شهریور", income: 45000000, expense: 30100000, nw: 396000000 },
    { name: "مهر", income: incomeTotal(), expense: spent(), nw: assetTotal() },
  ];
  const slice = state.range === "1m" ? 1 : state.range === "3m" ? 3 : 6;
  const view = months.slice(-slice);
  const maxBar = Math.max(...view.map((m) => Math.max(m.income, m.expense)));
  const cols = view.map((m) => `<div class="col"><div class="pair"><i class="in" style="height:${(m.income / maxBar) * 100}%"></i><i class="out" style="height:${(m.expense / maxBar) * 100}%"></i></div><span>${m.name}</span></div>`).join("");
  const nw = view.map((m) => m.nw);
  const w = 320, h = 120, min = Math.min(...nw) * 0.98, max = Math.max(...nw) * 1.01;
  const x = (i) => 8 + (nw.length === 1 ? 0.5 : i / (nw.length - 1)) * 304;
  const y = (v) => 12 + (1 - (v - min) / (max - min || 1)) * 90;
  const line = nw.map((v, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const ranked = BUDGETS.filter((b) => b.id !== "save").map((b) => ({ id: b.id, s: spentIn(b.id) })).sort((a, b) => b.s - a.s);
  const over = BUDGETS.find((b) => b.id !== "save" && spentIn(b.id) > b.limit);
  const sentence = over
    ? `${CATS[over.id].name} از سقف ${compact(over.limit)} گذشته. خوراک هنوز داخل سقف است.`
    : "هیچ دسته‌ای از سقف این ماه نگذشته.";
  return `${topBar({ title: "گزارش" })}
    <div class="pad" style="padding-top:4px"><div class="seg two"><button type="button" data-act="plan" data-id="budget">بودجه</button><button type="button" class="on" data-act="plan" data-id="reports">گزارش</button></div></div>
    <div class="range">${[["1m", "۱ماه"], ["3m", "۳ماه"], ["6m", "۶ماه"], ["1y", "۱سال"]].map(([id, lb]) => `<button type="button" class="${state.range === id ? "on" : ""}" data-act="range" data-id="${id}">${lb}</button>`).join("")}</div>
    <div class="big-quiet"><span class="kicker">جمع دارایی</span><strong>${moneyU(assetTotal())}</strong><p class="quiet" style="padding-inline:0">نقد به‌اضافهٔ سبد. تعهدها از این عدد کم نشده‌اند.</p></div>
    <div class="pad"><svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="روند دارایی"><path data-draw d="${line}" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></div>
    <div class="sec-h"><h2>ورود و خروج</h2></div>
    <div class="legend" style="padding-inline:20px"><b><i class="sw brand"></i>درآمد</b><b><i class="sw" style="border-color:var(--down)"></i>خرج</b></div>
    <div class="cols">${cols}</div>
    ${state.range === "1y" ? `<p class="quiet">در این نمونه از اردیبهشت ثبت شده، شش ماه.</p>` : ""}
    <div class="sec-h"><h2>دسته‌های مهر</h2></div>
    ${ranked.slice(0, 5).map((r) => `<div class="row"><i class="dot" style="background:${CATS[r.id].color}"></i><span class="row-main"><span class="row-title">${CATS[r.id].name}</span></span><span class="row-amt">${moneyU(r.s)}</span></div>`).join("")}
    <p class="quiet">${sentence}</p>`;
}
function planView() { return state.planSeg === "reports" ? reportsView() : budgetsView(); }

function themesHTML() {
  return `<div class="themes">${[["day", "روز"], ["night", "شب"], ["plain", "ساده"]].map(([id, lb]) => `<button type="button" class="theme${state.theme === id ? " on" : ""}" data-act="theme" data-id="${id}"><span class="swatch ${id}"><i></i><b></b></span>${lb}</button>`).join("")}</div>`;
}
function switchHTML(id, on) {
  return `<button type="button" class="switch${on ? " on" : ""}" data-act="toggle" data-id="${id}" aria-pressed="${on}"><i></i></button>`;
}
function settingsView() {
  if (state.settingsPage === "security") {
    return `${topBar({ title: "امنیت", back: true, avatar: false })}
      <div class="set-row"><span><b>رمز چهاررقمی</b><small>برای باز کردن برنامه</small></span>${switchHTML("pin", state.toggles.pin)}</div>
      <div class="set-row"><span><b>الگوی ترسیمی</b><small>به‌جای رمز، روی صفحهٔ ورود</small></span>${switchHTML("pattern", state.toggles.pattern)}</div>
      <div class="set-row"><span><b>اثر انگشت</b><small>قفل گوشی، اگر باشد</small></span>${switchHTML("bio", state.toggles.bio)}</div>
      <div class="set-row"><span><b>گاوصندوق کارت</b><small>CVV پشت یک قفل جدا</small></span>${switchHTML("vault", state.toggles.vault)}</div>`;
  }
  if (state.settingsPage === "connect") {
    return `${topBar({ title: "اتصال‌ها", back: true, avatar: false })}
      <div class="set-row"><span><b>همگام‌سازی</b><small>خاموش یعنی دفتر فقط روی همین گوشی است</small></span>${switchHTML("cloud", state.toggles.cloud)}</div>
      <div class="set-row"><span><b>پیامک بانکی</b><small>${fa(pendingCount())} پیش‌نویس در دفتر</small></span>${switchHTML("sms", state.toggles.sms)}</div>
      <div class="set-row"><span><b>کارت مشترک</b><small>دعوت با کد، نه با فرستادن فایل</small></span>${switchHTML("share", state.toggles.share)}</div>
      <button type="button" class="set-row" data-act="backup"><span><b>پشتیبان</b><small>خروجی و بازگرداندن همین دفتر</small></span><em>فایل</em></button>
      <div class="set-row"><span><b>رابط ChatGPT</b><small>برای وقتی خودت وصلش کنی، نه در مسیر هرروز</small></span><em>خاموش</em></div>`;
  }
  if (state.settingsPage === "about") {
    return `${topBar({ title: "درباره", back: true, avatar: false })}
      <div class="big-quiet"><span class="kicker">حساب‌یار</span><strong>۱.۰.۰</strong></div>
      <p class="quiet">دفتر پول تو، با یک خط برای هر ماه. اعداد روی همین گوشی می‌مانند مگر همگام‌سازی را روشن کنی. واحد پیش‌فرض تومان است.</p>`;
  }
  return `${topBar({ title: "تنظیمات", back: true })}
    <div class="set-row" style="box-shadow:none"><span class="sq">س</span><span><b>سارا نادری</b><small>روی این گوشی</small></span></div>
    <div class="group-label">ظاهر</div>
    ${themesHTML()}
    <button type="button" class="set-row" data-act="unit"><span><b>واحد پول</b><small>نمایش همه‌جا عوض می‌شود</small></span><em>${unitWord()}</em></button>
    <div class="group-label">حفظ دفتر</div>
    <button type="button" class="set-row" data-act="settings-go" data-id="security"><span><b>امنیت</b><small>رمز، الگو، اثر انگشت، گاوصندوق</small></span><em>${state.toggles.bio ? "فعال" : "رمز"}</em></button>
    <button type="button" class="set-row" data-act="settings-go" data-id="connect"><span><b>اتصال‌ها</b><small>ابر، پیامک، کارت مشترک، پشتیبان</small></span></button>
    <button type="button" class="set-row" data-act="settings-go" data-id="about"><span><b>درباره</b></span><em>۱.۰.۰</em></button>`;
}
function duesView() {
  const total = DUES.reduce((s, d) => s + d.amount, 0);
  return `${topBar({ title: "تعهدها", back: true })}
    <div class="big-quiet"><span class="kicker">در راه</span><strong>${moneyU(total)}</strong><p class="quiet" style="padding-inline:0">قسط، چک و اشتراک. از جمع دارایی کم نشده‌اند.</p></div>
    ${DUES.map((d) => `<div class="row"><span class="row-main"><span class="row-title">${d.title}</span><span class="row-sub">${d.kind} · ${d.meta}</span></span><span class="row-main" style="text-align:left"><span class="row-title">${moneyU(d.amount)}</span><span class="row-sub">${d.date}</span></span></div>`).join("")}`;
}
function onboardView() {
  const steps = `<div class="steps">${[1, 2, 3].map((n) => `<i class="${n <= state.obStep ? "on" : ""}"></i>`).join("")}</div>`;
  if (state.obStep === 1) {
    return `<div class="fill"><div class="ob">${steps}
      <h1>خرج این ماه را با یک خط بسنج.</h1>
      <p class="lede">اگر از خط جلو بیفتی، همان روز پیداست. نه آخر ماه.</p>
      <section class="hero">${paceSvg(true)}${legend("هنوز خرجی نیست", "خط ماه")}</section>
      <div class="cta-gap"><button type="button" class="submit" data-act="ob-next">شروع</button><button type="button" class="text-btn" data-act="to-login">حساب دارم</button></div>
    </div></div>`;
  }
  if (state.obStep === 2) {
    const amt = num(state.obAmountStr);
    return `<div class="fill"><div class="ob">${steps}
      <h1>اولین حساب</h1>
      <p class="lede">مانده را بنویس. لازم نیست بانک وصل باشد.</p>
      <input class="note-line" data-field="ob-name" placeholder="نام حساب، مثلاً ملت" value="${esc(state.obName)}" />
      <div class="figure-row" style="padding-top:12px"><span class="figure${amt ? "" : " is-zero"}" data-ob-amount>${amt ? moneyU(amt) : "۰"}</span><span class="unit">${unitWord()}</span></div>
      ${keysHTML(false)}
      <div class="cta-gap"><button type="button" class="submit" data-act="ob-next">ادامه</button><button type="button" class="text-btn" data-act="ob-skip">بعداً</button></div>
    </div></div>`;
  }
  return `<div class="fill"><div class="ob">${steps}
    <h1>یک قفل چهاررقمی</h1>
    <p class="lede">دفتر باز می‌ماند تا وقتی خودت قفلش کنی.</p>
    <div class="dots ${state.pinFlash || ""}">${[0, 1, 2, 3].map((i) => `<i class="${i < state.pin.length ? "on" : ""}"></i>`).join("")}</div>
    ${keysHTML(false)}
    <button type="button" class="text-btn" data-act="ob-skip">رد شدن</button>
  </div></div>`;
}
function loginView() {
  const dots = `<div class="dots"><i class="${state.pin.length > 0 ? "on" : ""}"></i><i class="${state.pin.length > 1 ? "on" : ""}"></i><i class="${state.pin.length > 2 ? "on" : ""}"></i><i class="${state.pin.length > 3 ? "on" : ""}"></i></div>`;
  const pattern = `<div class="pattern">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<button type="button" class="${state.pattern.includes(i) ? "on" : ""}" data-act="pattern" data-id="${i}" aria-label="نقطه ${fa(i + 1)}"></button>`).join("")}</div>`;
  return `<div class="fill"><div class="lock">
    <div class="brand"><span class="mark"><i></i></span><b>حساب‌یار</b></div>
    <p class="lock-name">سارا نادری</p>
    ${state.loginMode === "pattern" ? pattern : dots}
    <div class="grow"></div>
    ${state.loginMode === "pattern" ? "" : keysHTML(false)}
    <div style="display:flex;justify-content:center;gap:18px">
      <button type="button" class="text-btn" data-act="bio">اثر انگشت</button>
      <button type="button" class="text-btn" data-act="login-mode">${state.loginMode === "pattern" ? "رمز" : "الگو"}</button>
    </div>
    <p class="quiet" style="text-align:center">نمونهٔ طراحی · نسخهٔ ۱.۰.۰</p>
  </div></div>`;
}

function tradePreview() {
  const a = currentAsset();
  const t = state.trade;
  if (!a || !t) return { ok: false, html: "" };
  if (t.kind === "spot") {
    const price = num(t.price);
    if (!(price > 0)) return { ok: false, html: "قیمت را وارد کن." };
    const unreal = (price - a.avg) * a.qty;
    return { ok: true, html: `این قیمت معامله نیست.<br>تحقق‌نیافته می‌شود <b class="${unreal >= 0 ? "up" : "down"}">${signed(unreal)}</b>` };
  }
  if (a.mode === "deposit") {
    const w = num(t.qty);
    if (!(w > 0)) return { ok: false, html: "مبلغ را وارد کن." };
    if (t.kind === "sell" && w > a.value) return { ok: false, html: "بیشتر از مانده است." };
    if (t.kind === "buy") return { ok: true, html: `اصل و مانده هر دو ${moneyU(w)} زیاد می‌شوند. سود تحقق‌یافته عوض نمی‌شود.` };
    const accrued = Math.max(0, a.value - a.principal);
    const gain = Math.min(w, accrued);
    return { ok: true, html: `برداشت ${moneyU(w)}.<br>سود تحقق‌یافته این برداشت <b class="up">${signed(gain)}</b>` };
  }
  const q = num(t.qty);
  const price = num(t.price);
  if (!(q > 0) || !(price > 0)) return { ok: false, html: "تعداد و قیمت را وارد کن." };
  if (t.kind === "sell" && q > a.qty + 1e-9) return { ok: false, html: "بیشتر از مانده است." };
  if (t.kind === "sell") {
    const gain = (price - a.avg) * q;
    const qty = a.qty - q;
    const unreal = qty * a.spot - qty * a.avg;
    return { ok: true, html: `بعد از فروش ${formatQty(a, q)} ${a.unit} به ${priceText(price)}.<br>سود تحقق‌یافته این معامله <b class="${gain >= 0 ? "up" : "down"}">${signed(gain)}</b><br>مانده ${formatQty(a, qty)} · میانگین همان ${priceText(a.avg)}<br>تحقق‌نیافته تازه <b class="${unreal >= 0 ? "up" : "down"}">${signed(unreal)}</b>` };
  }
  const qty = a.qty + q;
  const avg = (a.qty * a.avg + q * price) / qty;
  const unreal = qty * a.spot - qty * avg;
  return { ok: true, html: `بعد از خرید، مانده ${formatQty(a, qty)} ${a.unit}.<br>میانگین تازه <b>${priceText(avg)}</b><br>تحقق‌نیافته <b class="${unreal >= 0 ? "up" : "down"}">${signed(unreal)}</b>` };
}
function sheetHTML() {
  if (!state.sheet) return "";
  const body = (() => {
    if (state.sheet === "filter") {
      const cats = ["food", "transport", "home", "fun", "shop", "bills", "health", "gift"];
      return `<h3>صافی</h3><div class="kicker">حساب</div><div class="chips" style="padding-inline:0;margin-top:8px">${ACCOUNTS.map((a) => chip(a.name, "draft-account", a.id, state.draft.account === a.id)).join("")}</div>
        <div class="kicker" style="margin-top:12px">دسته</div><div class="chips" style="padding-inline:0;margin-top:8px">${cats.map((id) => chip(CATS[id].name, "draft-cat", id, state.draft.category === id, CATS[id].color)).join("")}</div>
        <div class="pair-actions" style="padding-inline:0"><button type="button" class="primary" data-act="apply-filter">اعمال</button><button type="button" class="ghost" data-act="clear-filter">پاک کردن</button></div>`;
    }
    if (state.sheet === "tx") {
      const t = state.txs.find((x) => x.id === state.txId);
      if (!t) return "";
      return `<h3>${esc(t.title)}</h3><p class="figure" style="font-size:28px">${t.kind === "expense" ? "−" : t.kind === "income" ? "+" : ""}${moneyU(t.amount)}</p>
        <p class="quiet" style="padding-inline:0">${t.date} · ${t.kind === "transfer" ? "انتقال" : catName(t.cat)} · ${accName(t.account)}</p>
        ${t.note ? `<p class="quiet" style="padding-inline:0">${esc(t.note)}</p>` : ""}
        ${t.review ? "" : `<button type="button" class="submit" data-act="review" data-id="${t.id}" style="margin:12px 0 0">تأیید دسته</button>`}`;
    }
    if (state.sheet === "accounts" || state.sheet === "to") {
      const picked = state.sheet === "to" ? state.toAccountId : state.accountId;
      return `<h3>${state.sheet === "to" ? "به حساب" : "از حساب"}</h3>${ACCOUNTS.map((a) => `<button type="button" class="row" data-act="choose-account" data-id="${a.id}"><span class="sq">${a.short}</span><span class="row-main"><span class="row-title">${a.name}</span><span class="row-sub">${moneyU(balance(a.id))}</span></span>${a.id === picked ? `<span class="mini">انتخاب</span>` : ""}</button>`).join("")}`;
    }
    if (state.sheet === "date") {
      return `<h3>تاریخ</h3>${DATES.map((d) => `<button type="button" class="row" data-act="choose-date" data-id="${d.id}"><span class="row-title">${d.label}</span></button>`).join("")}`;
    }
    if (state.sheet === "more-cats") {
      const ids = catChoices().slice(6);
      return `<h3>دسته‌های دیگر</h3><div class="chips" style="padding-inline:0">${ids.map((id) => chip(CATS[id].name, "set-cat", id, state.category === id, CATS[id].color)).join("")}</div>`;
    }
    if (state.sheet === "vault") {
      const c = CARDS.find((x) => x.id === state.vaultCard);
      return `<h3>${c.name}</h3><p class="quiet" style="padding-inline:0">${c.pan}<br>انقضا ${c.exp} · ${c.bank}</p>
        ${state.vaultOpen && state.toggles.vault ? `<p class="figure" style="font-size:28px">CVV ${fa(c.cvv)}</p>` : `<p class="quiet" style="padding-inline:0">CVV پشت گاوصندوق است.</p>`}
        ${state.toggles.vault && !state.vaultOpen ? `<button type="button" class="submit" data-act="unlock-vault" style="margin-top:8px">باز کردن گاوصندوق</button>` : ""}`;
    }
    if (state.sheet === "trade") {
      const a = currentAsset();
      const t = state.trade;
      const view = tradePreview();
      const fields = t.kind === "spot"
        ? `<button type="button" class="field-btn on" data-trade-field="price" data-act="trade-field" data-id="price"><small>قیمت روز هر ${a.unit}</small><b data-trade-price>${t.price ? priceText(num(t.price)) : "۰"}</b></button>`
        : a.mode === "deposit"
          ? `<button type="button" class="field-btn on" data-trade-field="qty" data-act="trade-field" data-id="qty"><small>مبلغ</small><b data-trade-qty>${t.qty ? moneyU(num(t.qty)) : "۰"}</b></button>`
          : `<div class="two-fields">
              <button type="button" class="field-btn${t.field === "qty" ? " on" : ""}" data-trade-field="qty" data-act="trade-field" data-id="qty"><small>تعداد</small><b data-trade-qty>${t.qty ? fa(String(t.qty).replace(".", "٫")) : "۰"}</b></button>
              <button type="button" class="field-btn${t.field === "price" ? " on" : ""}" data-trade-field="price" data-act="trade-field" data-id="price"><small>قیمت واحد</small><b data-trade-price>${t.price ? moneyU(num(t.price)) : "۰"}</b></button>
            </div>`;
      const kinds = t.kind === "spot" ? "" : `<div class="seg two" style="margin:0 0 10px"><button type="button" class="${t.kind === "buy" ? "on" : ""}" data-act="trade-kind" data-id="buy">${kindWord(a, "buy")}</button><button type="button" class="${t.kind === "sell" ? "on" : ""}" data-act="trade-kind" data-id="sell">${kindWord(a, "sell")}</button></div>`;
      return `<h3>${kindWord(a, t.kind)} · ${a.symbol}</h3>${kinds}${fields}<div class="preview" data-preview>${view.html}</div>${keysHTML(!!a.decimals && t.field === "qty" && t.kind !== "spot")}<button type="button" class="submit" data-act="submit-trade" data-trade-submit ${view.ok ? "" : "disabled"} style="margin-top:8px">ثبت</button>`;
    }
    return "";
  })();
  if (!body) return "";
  return `<div class="overlay" data-act="dismiss"><div class="sheet" data-act="noop"><div class="handle"></div>${body}</div></div>`;
}
function toastInner() {
  if (!state.toast) return "";
  const undo = state.toast.undoId ? `<button type="button" data-act="undo">واگرد</button>` : "";
  return `<div class="toast" role="status">${state.toast.text}${undo}</div>`;
}

function stageInner() {
  switch (state.screen) {
    case "onboard": return onboardView();
    case "login": return loginView();
    case "add": return addView(false);
    case "home": return `<div class="scroll">${homeView(false)}</div>`;
    case "ledger": return `<div class="scroll">${ledgerView()}</div>`;
    case "assets": return `<div class="scroll">${state.assetSeg === "investments" ? investmentsView() : accountsView()}</div>`;
    case "account": return `<div class="scroll">${accountView()}</div>`;
    case "asset": return `<div class="scroll">${assetView()}</div>`;
    case "plan": return `<div class="scroll">${planView()}</div>`;
    case "settings": return `<div class="scroll">${settingsView()}</div>`;
    case "commitments": return `<div class="scroll">${duesView()}</div>`;
    default: return `<div class="scroll">${homeView(false)}</div>`;
  }
}
function tabOn(id) {
  const s = state.screen;
  if (id === "home" && (s === "home" || s === "commitments")) return "on";
  if (id === "ledger" && s === "ledger") return "on";
  if (id === "assets" && (s === "assets" || s === "asset" || s === "account")) return "on";
  if (id === "plan" && s === "plan") return "on";
  return "";
}
function tabHTML() {
  const items = [["home", "خانه", "home"], ["ledger", "دفتر", "book"], ["add", "ثبت", "plus"], ["assets", "دارایی", "wallet"], ["plan", "برنامه", "plan"]];
  return `<nav class="tabbar" aria-label="ناوبری">${items.map(([id, label, icon]) => `<button type="button" class="tab ${tabOn(id)}" data-act="tab" data-id="${id}">${ic(icon)}<span>${label}</span></button>`).join("")}</nav>`;
}
function phoneHTML() {
  const bare = ["onboard", "login", "add"].includes(state.screen);
  return `<div class="phone${bare ? " no-tab" : ""}">${statusHTML()}<div class="stage">${stageInner()}</div>${bare ? "" : tabHTML()}${sheetHTML()}<div class="toast-host" id="toast-host">${toastInner()}</div></div>`;
}

function sideHTML() {
  const items = [["home", "خانه", "home"], ["ledger", "دفتر", "book"], ["accounts", "حساب‌ها", "wallet"], ["budgets", "بودجه", "plan"], ["investments", "سرمایه‌گذاری", "plan"], ["reports", "گزارش", "plan"], ["settings", "تنظیمات", "gear"]];
  const on = (id) => {
    const s = state.screen;
    if (id === "home") return s === "home" || s === "commitments";
    if (id === "ledger") return s === "ledger";
    if (id === "accounts") return (s === "assets" && state.assetSeg === "accounts") || s === "account";
    if (id === "investments") return (s === "assets" && state.assetSeg === "investments") || s === "asset";
    if (id === "budgets") return s === "plan" && state.planSeg === "budget";
    if (id === "reports") return s === "plan" && state.planSeg === "reports";
    if (id === "settings") return s === "settings";
    return false;
  };
  return `<aside class="side"><div class="brand"><span class="mark"><i></i></span><div><b>حساب‌یار</b><small>سنج · ۱.۰.۰</small></div></div>
    <button type="button" class="submit" data-act="reset-add">ثبت تراکنش</button>
    ${items.map(([id, label, icon]) => `<button type="button" class="nav-item${on(id) ? " on" : ""}" data-act="nav" data-id="${id}">${ic(icon)}<span>${label}</span></button>`).join("")}
    <div class="side-foot">${themesHTML()}<span>سارا نادری · ۱۸ مهر ۱۴۰۵</span></div></aside>`;
}
function mainDesktop() {
  const s = state.screen === "add" ? "home" : state.screen;
  const inner = s === "home" ? homeView(true)
    : s === "ledger" ? ledgerView()
    : s === "assets" ? (state.assetSeg === "investments" ? investmentsView() : accountsView())
    : s === "account" ? accountView()
    : s === "asset" ? assetView()
    : s === "plan" ? planView()
    : s === "settings" ? settingsView()
    : s === "commitments" ? duesView()
    : homeView(true);
  return inner;
}
function desktopHTML() {
  return `<div class="desk">${sideHTML()}<main class="main">${mainDesktop()}</main><aside class="composer">${addView(true)}</aside>${sheetHTML()}<div class="toast-host" id="toast-host">${toastInner()}</div></div>`;
}

function paint() {
  document.body.classList.toggle("desktop", DESKTOP);
  document.documentElement.dataset.theme = state.theme;
  document.getElementById("app").innerHTML = DESKTOP ? desktopHTML() : phoneHTML();
  kickCharts();
  kickCount();
}
function armToast() {
  if (SHOT || !state.toast) return;
  clearTimeout(state._tt);
  state._tt = setTimeout(() => { state.toast = null; const host = document.getElementById("toast-host"); if (host) host.innerHTML = ""; }, 3200);
}
function toast(text, undoId = null) {
  state.toast = { text, undoId };
  const host = document.getElementById("toast-host");
  if (host) host.innerHTML = toastInner();
  else paint();
  armToast();
}
function resetComposer() {
  state.amountStr = ""; state.amount = 0; state.addKind = "expense"; state.category = null;
  state.accountId = "mellat"; state.toAccountId = "housing"; state.note = ""; state.date = "۱۸ مهر"; state.templateName = null;
}
function openAdd() {
  if (!["add", "onboard", "login"].includes(state.screen)) state.lastTab = state.screen;
  state.screen = "add"; state.sheet = null; resetComposer(); paint();
}
function closeAdd() { state.screen = state.lastTab || "home"; state.sheet = null; paint(); }
function push(screen, patch = {}) {
  state.stack.push({ screen: state.screen, assetId: state.assetId, accountOpen: state.accountOpen, assetSeg: state.assetSeg, planSeg: state.planSeg, settingsPage: state.settingsPage });
  Object.assign(state, patch);
  state.screen = screen; state.sheet = null; paint();
}
function pop() {
  const prev = state.stack.pop();
  state.sheet = null;
  if (!prev) state.screen = "home";
  else Object.assign(state, prev);
  paint();
}
function back() {
  if (state.sheet) { state.sheet = null; paint(); return; }
  if (state.screen === "settings" && state.settingsPage) { state.settingsPage = null; paint(); return; }
  if (state.screen === "add") { closeAdd(); return; }
  if (state.stack.length) pop();
  else { state.screen = "home"; paint(); }
}
function enterApp() { state.screen = "home"; state.stack = []; state.sheet = null; paint(); }
function jump(id) {
  state.sheet = null; state.stack = [];
  if (id === "cash") { state.screen = "assets"; state.assetSeg = "accounts"; }
  else if (id === "invest") { state.screen = "assets"; state.assetSeg = "investments"; }
  else if (id === "dues") { push("commitments"); return; }
  else if (id === "budgets") { state.screen = "plan"; state.planSeg = "budget"; }
  else if (id === "reports") { state.screen = "plan"; state.planSeg = "reports"; }
  else if (id === "ledger") state.screen = "ledger";
  else if (id === "review") { state.screen = "ledger"; state.filters.kind = "review"; }
  paint();
}
function applyTemplate(id) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) return;
  state.addKind = t.kind; state.amount = t.amount; state.amountStr = String(t.amount);
  state.category = t.category; state.accountId = t.account; state.templateName = t.name;
  if (t.category) state.catOrder = [t.category, ...state.catOrder.filter((c) => c !== t.category)];
}
function refreshAddChrome() {
  const el = document.querySelector("[data-amount]");
  if (el) {
    el.textContent = state.amount ? moneyU(state.amount) : "۰";
    el.classList.toggle("is-zero", !state.amount);
    el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick");
  }
  const btn = document.querySelector("[data-submit]");
  if (btn) btn.disabled = !canSubmit();
  const hint = document.querySelector("[data-hint]");
  if (hint) hint.textContent = hintText();
}
function refreshObAmount() {
  const el = document.querySelector("[data-ob-amount]");
  const amt = num(state.obAmountStr);
  if (!el) return;
  el.textContent = amt ? moneyU(amt) : "۰";
  el.classList.toggle("is-zero", !amt);
}
function amountKey(k) {
  let s = state.amountStr;
  if (k === "del") s = s.slice(0, -1);
  else if (k === "000") s = (s + "000").slice(0, 12);
  else if (k === ".") return;
  else s = (s + k).replace(/^0+(\d)/, "$1").slice(0, 12);
  state.amountStr = s; state.amount = num(s); state.templateName = state.templateName;
  refreshAddChrome();
}
function obKey(k) {
  let s = state.obAmountStr;
  if (k === "del") s = s.slice(0, -1);
  else if (k === "000") s = (s + "000").slice(0, 12);
  else if (k === ".") return;
  else s = (s + k).replace(/^0+(\d)/, "$1").slice(0, 12);
  state.obAmountStr = s;
  refreshObAmount();
}
function pinKey(k) {
  if (k === "000" || k === ".") return;
  if (k === "del") state.pin = state.pin.slice(0, -1);
  else if (state.pin.length < 4) state.pin += k;
  const dots = document.querySelectorAll(".lock .dots i, .ob .dots i");
  dots.forEach((d, i) => d.classList.toggle("on", i < state.pin.length));
  if (state.pin.length === 4) setTimeout(() => enterApp(), SHOT ? 0 : 180);
}
function refreshTrade() {
  const t = state.trade;
  if (!t) return;
  const qEl = document.querySelector("[data-trade-qty]");
  const pEl = document.querySelector("[data-trade-price]");
  if (qEl) qEl.textContent = t.qty ? (currentAsset().mode === "deposit" ? moneyU(num(t.qty)) : fa(String(t.qty).replace(".", "٫"))) : "۰";
  if (pEl) pEl.textContent = t.price ? (t.kind === "spot" ? priceText(num(t.price)) : moneyU(num(t.price))) : "۰";
  document.querySelectorAll("[data-trade-field]").forEach((el) => el.classList.toggle("on", el.dataset.tradeField === t.field));
  const view = tradePreview();
  const prev = document.querySelector("[data-preview]");
  if (prev) prev.innerHTML = view.html;
  const btn = document.querySelector("[data-trade-submit]");
  if (btn) btn.disabled = !view.ok;
}
function tradeKey(k) {
  const t = state.trade;
  const field = t.field === "price" ? "price" : "qty";
  let s = t[field] || "";
  if (k === "del") s = s.slice(0, -1);
  else if (k === "000") { if (field === "qty" && currentAsset().decimals) return; s = (s + "000").slice(0, 12); }
  else if (k === ".") { if (!s.includes(".")) s = (s || "0") + "."; }
  else s = (s === "0" ? k : s + k).slice(0, 14);
  t[field] = s.replace(/^0+(\d)/, "$1");
  refreshTrade();
}
function onKey(k) {
  if (state.sheet === "trade") return tradeKey(k);
  if (state.screen === "login" || (state.screen === "onboard" && state.obStep === 3)) return pinKey(k);
  if (state.screen === "onboard" && state.obStep === 2) return obKey(k);
  if (state.screen === "add" || DESKTOP) return amountKey(k);
}
function commitTrade(a, kind, q, price) {
  if (kind === "spot") { a.spot = price; a.series[a.series.length - 1] = price; return; }
  if (a.mode === "deposit") {
    if (kind === "buy") { a.principal += q; a.value += q; a.history.unshift({ date: "۱۸ مهر", kind: "buy", qty: q, price: 1 }); }
    else {
      const gain = Math.min(q, Math.max(0, a.value - a.principal));
      a.realized += gain; a.value -= q; a.principal = Math.max(0, a.principal - (q - gain));
      a.history.unshift({ date: "۱۸ مهر", kind: "sell", qty: q, price: 1, realized: gain });
    }
    a.series[a.series.length - 1] = a.value;
    return;
  }
  if (kind === "buy") {
    const invested = a.qty * a.avg + q * price;
    a.qty = roundQty(a, a.qty + q);
    a.avg = a.qty ? invested / a.qty : 0;
    a.history.unshift({ date: "۱۸ مهر", kind: "buy", qty: q, price });
  } else {
    const gain = (price - a.avg) * q;
    a.qty = roundQty(a, a.qty - q);
    a.realized += gain;
    a.history.unshift({ date: "۱۸ مهر", kind: "sell", qty: q, price, realized: gain });
  }
}
function submitAdd() {
  if (!canSubmit()) return;
  const id = "n" + state.seq++;
  const kind = state.addKind;
  const title = (state.templateName || state.note.trim() || (kind === "transfer" ? "انتقال" : catName(state.category)));
  state.txs.unshift({
    id, date: state.date, title, cat: state.category, account: state.accountId,
    to: kind === "transfer" ? state.toAccountId : undefined,
    amount: state.amount, kind, review: true, note: state.note.trim(),
  });
  resetComposer();
  if (!DESKTOP) state.screen = state.lastTab || "home";
  paint();
  toast(kind === "income" ? "درآمد ثبت شد" : kind === "transfer" ? "انتقال ثبت شد" : `${title} ثبت شد`, id);
}
function submitTrade() {
  const view = tradePreview();
  if (!view.ok || !state.trade) return;
  const a = currentAsset();
  const t = state.trade;
  commitTrade(a, t.kind, num(t.qty), num(t.price));
  const label = kindWord(a, t.kind);
  state.sheet = null; state.trade = null;
  paint();
  toast(t.kind === "spot" ? "قیمت روز ذخیره شد" : `${label} ثبت شد`);
}

function onClick(e) {
  const b = e.target.closest("[data-act]");
  if (!b || !document.getElementById("app").contains(b)) return;
  const act = b.dataset.act;
  const id = b.dataset.id || "";
  if (act === "noop") return;
  if (act === "dismiss") { state.sheet = null; paint(); return; }
  if (act === "tab") { if (id === "add") openAdd(); else { state.stack = []; state.sheet = null; state.screen = id; paint(); } return; }
  if (act === "nav") {
    state.stack = []; state.sheet = null; state.settingsPage = null;
    if (id === "home") state.screen = "home";
    else if (id === "ledger") state.screen = "ledger";
    else if (id === "accounts") { state.screen = "assets"; state.assetSeg = "accounts"; }
    else if (id === "investments") { state.screen = "assets"; state.assetSeg = "investments"; }
    else if (id === "budgets") { state.screen = "plan"; state.planSeg = "budget"; }
    else if (id === "reports") { state.screen = "plan"; state.planSeg = "reports"; }
    else if (id === "settings") state.screen = "settings";
    paint(); return;
  }
  if (act === "settings") { push("settings"); return; }
  if (act === "back") { back(); return; }
  if (act === "jump") { jump(id); return; }
  if (act === "key") { onKey(b.dataset.key); return; }
  if (act === "set-kind") {
    state.addKind = id;
    if (id === "transfer") state.category = null;
    else if (id === "income" && !INCOME_CATS.includes(state.category)) state.category = null;
    else if (id === "expense" && INCOME_CATS.includes(state.category)) state.category = null;
    paint(); return;
  }
  if (act === "set-cat") { state.category = id; state.sheet = null; state.catOrder = [id, ...state.catOrder.filter((c) => c !== id)]; paint(); return; }
  if (act === "template") { applyTemplate(id); paint(); return; }
  if (act === "more-cats") { state.sheet = "more-cats"; paint(); return; }
  if (act === "pick-account") { state.sheet = "accounts"; paint(); return; }
  if (act === "pick-to") { state.sheet = "to"; paint(); return; }
  if (act === "pick-date") { state.sheet = "date"; paint(); return; }
  if (act === "choose-account") {
    if (state.sheet === "to") state.toAccountId = id; else state.accountId = id;
    state.sheet = null; paint(); return;
  }
  if (act === "choose-date") { state.date = id; state.sheet = null; paint(); return; }
  if (act === "submit-add") { submitAdd(); return; }
  if (act === "undo") {
    if (state.toast?.undoId) state.txs = state.txs.filter((t) => t.id !== state.toast.undoId);
    state.toast = null; paint(); return;
  }
  if (act === "kind-filter") { state.filters.kind = id; paint(); return; }
  if (act === "open-filter") { state.draft = { category: state.filters.category, account: state.filters.account }; state.sheet = "filter"; paint(); return; }
  if (act === "draft-cat") { state.draft.category = state.draft.category === id ? null : id; paint(); return; }
  if (act === "draft-account") { state.draft.account = state.draft.account === id ? null : id; paint(); return; }
  if (act === "apply-filter") { state.filters.category = state.draft.category; state.filters.account = state.draft.account; state.sheet = null; paint(); return; }
  if (act === "clear-filter") { state.filters.category = null; state.filters.account = null; state.draft = { category: null, account: null }; state.sheet = null; paint(); return; }
  if (act === "clear-cat") { state.filters.category = null; paint(); return; }
  if (act === "clear-account") { state.filters.account = null; paint(); return; }
  if (act === "review") {
    const t = state.txs.find((x) => x.id === id);
    if (t) t.review = true;
    state.sheet = null; paint(); toast("دسته تأیید شد"); return;
  }
  if (act === "open-tx") { state.txId = id; state.sheet = "tx"; paint(); return; }
  if (act === "open-account") { state.accountOpen = id; push("account"); return; }
  if (act === "open-asset") { state.assetId = id; push("asset"); return; }
  if (act === "open-vault") { state.vaultCard = id; state.vaultOpen = false; state.sheet = "vault"; paint(); return; }
  if (act === "unlock-vault") { state.vaultOpen = true; paint(); return; }
  if (act === "copy-sheba") { toast("شبا کپی شد"); return; }
  if (act === "asset-seg") { state.assetSeg = id; state.screen = "assets"; paint(); return; }
  if (act === "market") { state.market = id; paint(); return; }
  if (act === "plan") { state.planSeg = id; paint(); return; }
  if (act === "range") { state.range = id; paint(); return; }
  if (act === "asset-range") { state.assetRange = id; paint(); return; }
  if (act === "open-trade") {
    const a = currentAsset();
    state.trade = { kind: id, field: id === "spot" ? "price" : "qty", qty: "", price: id === "spot" ? String(Math.round(a.spot)) : "" };
    state.sheet = "trade"; paint(); return;
  }
  if (act === "trade-kind") { state.trade.kind = id; refreshTrade(); paint(); return; }
  if (act === "trade-field") { state.trade.field = id; refreshTrade(); return; }
  if (act === "submit-trade") { submitTrade(); return; }
  if (act === "theme") { state.theme = id; paint(); return; }
  if (act === "unit") { state.unit = state.unit === "toman" ? "rial" : "toman"; paint(); return; }
  if (act === "toggle") { state.toggles[id] = !state.toggles[id]; paint(); return; }
  if (act === "settings-go") { state.settingsPage = id; paint(); return; }
  if (act === "backup") { toast("فایل پشتیبان آمادهٔ ذخیره است"); return; }
  if (act === "ob-next") {
    if (state.obStep < 3) { state.obStep += 1; state.pin = ""; paint(); }
    return;
  }
  if (act === "ob-skip") { enterApp(); return; }
  if (act === "to-login") { state.screen = "login"; state.pin = ""; state.pattern = []; paint(); return; }
  if (act === "bio") { enterApp(); return; }
  if (act === "login-mode") { state.loginMode = state.loginMode === "pin" ? "pattern" : "pin"; state.pattern = []; state.pin = ""; paint(); return; }
  if (act === "pattern") {
    if (!state.pattern.includes(Number(id))) state.pattern.push(Number(id));
    paint();
    if (state.pattern.length >= 3) setTimeout(() => enterApp(), SHOT ? 0 : 200);
    return;
  }
  if (act === "reset-add") { resetComposer(); paint(); return; }
}
function onInput(e) {
  const f = e.target.dataset.field;
  if (f === "note") state.note = e.target.value;
  if (f === "ob-name") state.obName = e.target.value;
  if (f === "search") {
    state.filters.q = e.target.value;
    const list = document.getElementById("ledger-list");
    const meta = document.getElementById("ledger-meta");
    if (list) list.innerHTML = ledgerListHTML();
    if (meta) meta.textContent = ledgerMetaHTML();
  }
}

function applyShot() {
  const params = new URLSearchParams(location.search);
  DESKTOP = !!(window.__FORCE_DESKTOP__ || params.get("view") === "desktop" || params.get("shot") === "desktop");
  SHOT = !!(params.get("shot") || params.get("still") === "1");
  if (SHOT) document.documentElement.classList.add("is-shot");
  const shot = params.get("shot");
  const map = {
    onboard: () => { state.screen = "onboard"; state.obStep = Number(params.get("step") || 1); },
    login: () => { state.screen = "login"; },
    home: () => { state.screen = "home"; },
    add: () => { state.screen = "add"; },
    ledger: () => { state.screen = "ledger"; },
    accounts: () => { state.screen = "assets"; state.assetSeg = "accounts"; },
    budgets: () => { state.screen = "plan"; state.planSeg = "budget"; },
    investments: () => { state.screen = "assets"; state.assetSeg = "investments"; },
    asset: () => { state.screen = "asset"; state.assetId = params.get("asset") || "kahroba"; },
    reports: () => { state.screen = "plan"; state.planSeg = "reports"; },
    settings: () => { state.screen = "settings"; },
    desktop: () => { state.screen = "home"; },
    dues: () => { state.screen = "commitments"; },
  };
  if (shot && map[shot]) map[shot]();
  else state.screen = DESKTOP ? "home" : "onboard";
  if (params.get("filled")) applyTemplate("snapp");
  if (params.get("filtered")) { state.filters.kind = "expense"; state.filters.category = "food"; }
  if (params.get("toast")) {
    state.txs.unshift({ id: "n-shot", date: "۱۸ مهر", title: "اسنپ", cat: "transport", account: "mellat", amount: 86000, kind: "expense", review: true });
    state.toast = { text: "اسنپ ثبت شد", undoId: "n-shot" };
    state.screen = "home";
  }
  if (params.get("trade") === "sell") {
    state.screen = "asset"; state.assetId = "kahroba";
    state.trade = { kind: "sell", field: "qty", qty: "200", price: "33600" };
    state.sheet = "trade";
  }
  if (params.get("traded")) {
    state.screen = "asset"; state.assetId = "kahroba";
    commitTrade(ASSETS.find((a) => a.id === "kahroba"), "sell", 200, 33600);
  }
  if (params.get("theme")) state.theme = params.get("theme");
}

function boot() {
  applyShot();
  document.getElementById("app").addEventListener("click", onClick);
  document.getElementById("app").addEventListener("input", onInput);
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input")) return;
    if (e.key === "Escape") { back(); return; }
    if (SHOT) return;
    if (/^[0-9]$/.test(e.key)) onKey(e.key);
    else if (e.key === "Backspace") onKey("del");
    else if (e.key === "Enter") {
      if (state.sheet === "trade") submitTrade();
      else if (state.screen === "add" || DESKTOP) submitAdd();
    }
  });
  paint();
  const spentNow = spent();
  const port = portfolio().value;
  if (spentNow !== 18640000) console.warn("spent", spentNow);
  if (port !== 364700000) console.warn("portfolio", port);
  if (Math.round(cash() + port) !== 405500000) console.warn("assets", cash() + port);
  document.fonts.ready.then(() => document.documentElement.classList.add("ready"));
}
boot();
