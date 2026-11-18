

(function () {
  const RISK = window.LOT_RISK;
  const UTK_CENTER = [35.9545, -83.9295]; // approximate center of the UTK campus

  // ---------- lot outlines ----------
  const isPt = (p) => Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number";
  const shapes = {};
  (window.LOT_COORDS || []).forEach((l) => {
    const s = (l.shapes || []).map((pts) => pts.filter(isPt)).filter((pts) => pts.length >= 3);
    if (s.length && RISK.lots[l.name]) shapes[l.name] = s;
  });

  const lotNames = Object.keys(shapes).sort((a, b) => RISK.lots[b].tickets - RISK.lots[a].tickets);

  // ---------- color: 0 -> light grey, ~0.3 -> UT orange, 0.6+ -> dark orange ----------
  const STOPS = [[0, [242, 242, 242]], [0.12, [255, 210, 163]], [0.3, [255, 130, 0]], [0.6, [168, 79, 0]]];
  function riskColor(v) {
    v = Math.max(0, Math.min(0.6, v));
    for (let i = 1; i < STOPS.length; i++) {
      const [x0, c0] = STOPS[i - 1], [x1, c1] = STOPS[i];
      if (v <= x1) {
        const t = (v - x0) / (x1 - x0);
        return "rgb(" + c0.map((c, k) => Math.round(c + (c1[k] - c) * t)).join(",") + ")";
      }
    }
    return "rgb(168,79,0)";
  }
  const pct = (v) => Math.round(v * 100) + "%";

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- map ----------
  const map = L.map("map").setView(UTK_CENTER, 16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const lotLayers = {};
  lotNames.forEach((name) => {
    lotLayers[name] = shapes[name].map((pts) =>
      L.polygon(pts, { weight: 2, color: "#1f1f1f", opacity: 0.7, fillOpacity: 0.8 })
        .bindTooltip("", { className: "lot-tip", sticky: true })
        .addTo(map)
    );
  });

  // start zoomed to fit every traced lot
  const all = Object.values(lotLayers).flat();
  if (all.length) map.fitBounds(L.featureGroup(all).getBounds(), { padding: [20, 20] });

  // ---------- time ----------
  const slider = document.getElementById("time");
  const timeText = document.getElementById("timeText");
  const timeText2 = document.getElementById("timeText2");
  const topList = document.getElementById("topList");

  function render() {
    const i = Number(slider.value);
    const label = RISK.slots[i];
    timeText.textContent = label;
    timeText2.textContent = label;

    lotNames.forEach((name) => {
      const v = RISK.lots[name].risk[i];
      const tip = "<b>" + escapeHtml(name) + "</b>" + pct(v) + " of weekdays had a ticket at " + label;
      lotLayers[name].forEach((poly) => {
        poly.setStyle({ fillColor: riskColor(v) });
        poly.setTooltipContent(tip);
      });
    });

    const ranked = lotNames.map((n) => [n, RISK.lots[n].risk[i]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    topList.replaceChildren(...ranked.map(([n, v]) => {
      const li = document.createElement("li");
      li.textContent = n;
      const s = document.createElement("span");
      s.textContent = pct(v);
      s.style.color = v >= 0.12 ? riskColor(Math.max(v, 0.3)) : "var(--muted)";
      li.appendChild(s);
      return li;
    }));
  }

  slider.addEventListener("input", render);

  // play button: steps through the day
  const playBtn = document.getElementById("play");
  let timer = null;
  playBtn.addEventListener("click", () => {
    if (timer) { clearInterval(timer); timer = null; playBtn.textContent = "▶"; return; }
    playBtn.textContent = "❚❚";
    timer = setInterval(() => {
      slider.value = (Number(slider.value) + 1) % (RISK.slots.length);
      render();
    }, 600);
  });

  render();

  // ---------- trip planner: chance of a ticket over a stay ----------
  const N = RISK.slots.length; // 48 fifteen-minute windows, 6:00 AM - 5:45 PM
  // time options: start of each window, plus the end of the last one (6:00 PM)
  const lastEnd = (() => {
    const m = RISK.slots[N - 1].match(/(\d+):(\d+) (AM|PM)/);
    let h = Number(m[1]) % 12 + (m[3] === "PM" ? 12 : 0), min = Number(m[2]) + 15;
    if (min >= 60) { h += 1; min -= 60; }
    return ((h + 11) % 12 + 1) + ":" + String(min).padStart(2, "0") + (h >= 12 ? " PM" : " AM");
  })();
  const TIMES = RISK.slots.concat([lastEnd]);
  const lotsAlpha = lotNames.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // chance of at least one ticket across windows [a, d), treating windows as independent
  function stayChance(lot, a, d) {
    const r = RISK.lots[lot].risk;
    let none = 1, peak = a;
    for (let i = a; i < d; i++) {
      none *= 1 - r[i];
      if (r[i] > r[peak]) peak = i;
    }
    return { p: 1 - none, peak, peakRisk: r[peak] };
  }

  function makeSelect(label, options, value) {
    const s = document.createElement("select");
    s.setAttribute("aria-label", label);
    options.forEach(([v, text]) => s.add(new Option(text, v)));
    s.value = String(value);
    return s;
  }

  function cell(label, child, cls) {
    const td = document.createElement("td");
    if (label) td.dataset.label = label;
    if (cls) td.className = cls;
    if (child) td.appendChild(child);
    return td;
  }

  const tripRows = document.getElementById("tripRows");

  function addTrip(init) {
    init = init || {};
    const tr = document.createElement("tr");
    const lot = makeSelect("Lot", lotsAlpha.map((n) => [n, n]), init.lot || lotNames[0]);
    const arrive = makeSelect("Arrival time", TIMES.slice(0, N).map((t, i) => [i, t]), init.arrive ?? 8);
    const depart = makeSelect("Departure time", TIMES.map((t, i) => [i, t]).slice(1), init.depart ?? 20);
    const result = document.createElement("div");
    result.setAttribute("aria-live", "polite");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.textContent = "✕";
    remove.setAttribute("aria-label", "Remove this trip");
    remove.addEventListener("click", () => { tr.remove(); syncRemoveButtons(); });

    tr.append(
      cell("Lot", lot, "lot-cell"),
      cell("Arrival", arrive),
      cell("Departure", depart),
      cell("Chance of a ticket", result, "result-cell"),
      cell(null, remove, "remove-cell")
    );

    function update() {
      const a = Number(arrive.value), d = Number(depart.value);
      // keep departure after arrival
      [...depart.options].forEach((o) => { o.disabled = Number(o.value) <= a; });
      if (d <= a) {
        depart.value = String(Math.min(a + 4, N)); // default to an hour later
        return update();
      }
      const { p, peak, peakRisk } = stayChance(lot.value, a, d);
      const pill = document.createElement("span");
      pill.className = "chance";
      pill.textContent = pct(p);
      pill.style.background = riskColor(p);
      pill.style.color = p >= 0.3 ? "#fff" : "#1f1f1f";
      const lbl = document.createElement("span");
      lbl.className = "chance-label";
      lbl.textContent = p < 0.1 ? "low" : p < 0.3 ? "moderate" : p < 0.6 ? "high" : "very high";
      const pk = document.createElement("span");
      pk.className = "peak";
      pk.textContent = peakRisk > 0
        ? "Riskiest window: " + RISK.slots[peak] + " (" + pct(peakRisk) + ")"
        : "No tickets seen in this lot during these times";
      result.replaceChildren(pill, lbl, pk);
    }

    [lot, arrive, depart].forEach((s) => s.addEventListener("change", update));
    tripRows.appendChild(tr);
    update();
    syncRemoveButtons();
    return tr;
  }

  // the last remaining row can't be removed
  function syncRemoveButtons() {
    const btns = tripRows.querySelectorAll(".remove-btn");
    btns.forEach((b) => { b.hidden = btns.length === 1; });
  }

  document.getElementById("addTrip").addEventListener("click", () => {
    const rows = tripRows.querySelectorAll("tr");
    const last = rows[rows.length - 1];
    const sel = last ? last.querySelectorAll("select") : [];
    // new row starts as a copy of the last one so it's easy to compare lots or times
    const tr = addTrip(sel.length ? { lot: sel[0].value, arrive: Number(sel[1].value), depart: Number(sel[2].value) } : {});
    tr.querySelector("select").focus();
  });

  addTrip();
})();
