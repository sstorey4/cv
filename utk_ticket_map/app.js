

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
  document.getElementById("nDays").textContent = RISK.days;
  document.getElementById("nLots").textContent = lotNames.length;

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
      s.style.color = v >= 0.12 ? riskColor(Math.max(v, 0.3)) : "#666";
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
})();
