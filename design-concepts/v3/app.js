/* Shared interaction for the v3 prototypes. Each concept supplies the markup. */
(function () {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const params = new URLSearchParams(location.search);
  const shot = params.get("shot") === "1";
  const demo = params.get("demo") === "1";
  const screens = [...document.querySelectorAll("[data-screen]")];
  const tabs = [...document.querySelectorAll("[data-tab]")];
  const sheet = document.getElementById("sheet");
  const balance = document.getElementById("balance");
  let current = "login";
  const runs = new WeakMap();

  function fmt(n) {
    const raw = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
    return raw.replace(/\d/g, (d) => fa[d]);
  }

  function countUp(el) {
    if (!el) return;
    const target = Number(el.dataset.value || 0);
    if (shot) {
      el.textContent = fmt(target);
      return;
    }
    const run = (runs.get(el) || 0) + 1;
    runs.set(el, run);
    const start = performance.now();
    const dur = 1100;
    function frame(now) {
      if (runs.get(el) !== run) return;
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(target * eased);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function replayDraw(root) {
    root.querySelectorAll(".draw, .grow, .ring").forEach((node) => {
      node.style.animation = "none";
      void node.offsetWidth;
      node.style.animation = "";
    });
  }

  function swayHero() {
    const hero = document.querySelector('[data-screen="home"] .tilt');
    if (!hero) return;
    hero.classList.remove("sway");
    void hero.offsetWidth;
    hero.classList.add("sway");
  }

  function show(name, opts) {
    opts = opts || {};
    current = name;
    screens.forEach((screen) => {
      const on = screen.dataset.screen === name;
      screen.classList.toggle("on", on);
      if (on) replayDraw(screen);
    });
    tabs.forEach((tab) => tab.classList.toggle("on", tab.dataset.tab === name));
    document.body.classList.toggle("no-tab", name === "login" || name === "asset");
    if (!opts.keepSheet) closeSheet(true);
    if (name === "home") {
      countUp(balance);
      if (demo) swayHero();
    }
    if (name === "invest") countUp(document.getElementById("invest-total"));
  }

  function openSheet() {
    if (!sheet) return;
    sheet.classList.add("open");
    document.body.classList.add("sheet-open");
    const amount = document.getElementById("sheet-amount");
    if (amount) countUp(amount);
  }

  function closeSheet(silent) {
    if (!sheet) return;
    sheet.classList.remove("open");
    document.body.classList.remove("sheet-open");
    if (!silent) {
      const add = document.getElementById("add-btn");
      if (add) {
        add.classList.remove("pop");
        void add.offsetWidth;
        add.classList.add("pop");
      }
    }
  }

  document.getElementById("login-go")?.addEventListener("click", () => show("home"));
  document.getElementById("add-btn")?.addEventListener("click", openSheet);
  document.getElementById("sheet-close")?.addEventListener("click", () => closeSheet());
  document.getElementById("sheet-save")?.addEventListener("click", () => closeSheet());
  document.getElementById("open-asset")?.addEventListener("click", () => show("asset"));
  document.getElementById("asset-back")?.addEventListener("click", () => show("invest"));
  tabs.forEach((tab) => tab.addEventListener("click", () => show(tab.dataset.tab)));

  document.querySelectorAll(".tilt").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      if (shot) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });

  document.querySelectorAll("button").forEach((button) => {
    button.addEventListener("pointerdown", () => button.classList.add("pressed"));
    button.addEventListener("pointerup", () => button.classList.remove("pressed"));
    button.addEventListener("pointerleave", () => button.classList.remove("pressed"));
  });

  if (shot) document.body.classList.add("shot");
  if (demo && !shot) document.body.classList.add("demo");

  const initial = (location.hash || "#login").slice(1);
  if (initial === "sheet") {
    show("home", { keepSheet: true });
    openSheet();
  } else {
    show(screens.some((s) => s.dataset.screen === initial) ? initial : "login");
  }

  if (demo && !shot) {
    const clicks = [
      [700, "login-go"],
      [4200, "add-btn"],
      [7800, "sheet-close"],
      [9200, "tab-reports"],
      [12800, "tab-invest"],
      [16000, "open-asset"],
      [19800, "asset-back"],
      [21400, "tab-settings"],
    ];
    clicks.forEach(([at, id]) => {
      setTimeout(() => document.getElementById(id)?.click(), at);
    });
  }
})();
