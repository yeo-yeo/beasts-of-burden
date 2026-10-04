const BEASTS = [
  { id: "mules", label: "Mules" },
  { id: "donkeys", label: "Donkeys" },
  { id: "horses", label: "Horses" },
  { id: "camels", label: "Camels" },
  { id: "cattle", label: "Cattle" },
];

const FLAGS = {
  E: "estimated",
  I: "imputed",
  X: "unofficial",
  M: "missing",
};

const YEAR = "2024";

const animalsEl = document.querySelector("#animals");
const frame = document.querySelector("#frame");
const mapEl = document.querySelector("#map");
const hoverEl = document.querySelector("#hover");
const legendEl = document.querySelector("#legend");
const statusEl = document.querySelector("#status");
const countBody = document.querySelector("#top-count");
const rateBody = document.querySelector("#top-rate");

const countFormat = new Intl.NumberFormat("en");
const rateFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const state = { animal: "mules" };
const NAMES = new Map(
  WORLD.filter((country) => country.id != null).map((country) => [String(country.id), country.name])
);

function beastLabel() {
  return BEASTS.find((beast) => beast.id === state.animal).label;
}

function rowsFor() {
  return (STOCKS[state.animal] && STOCKS[state.animal][YEAR]) || {};
}

function bucket(value, max) {
  if (!(value > 0) || !(max > 0)) return 0;
  const t = Math.sqrt(value / max);
  if (t >= 0.85) return 5;
  if (t >= 0.65) return 4;
  if (t >= 0.45) return 3;
  if (t >= 0.25) return 2;
  return 1;
}

function drawMap() {
  const [width, height] = WORLD_VIEW;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "World map of livestock stocks");
  for (const country of WORLD) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", country.d);
    path.dataset.name = country.name;
    if (country.id != null) path.dataset.id = String(country.id);
    svg.appendChild(path);
  }
  svg.addEventListener("pointermove", onCountry);
  svg.addEventListener("pointerdown", onCountry);
  svg.addEventListener("pointerleave", () => {
    hoverEl.textContent = "Hover a country";
  });
  mapEl.appendChild(svg);
}

function paint() {
  const rows = rowsFor();
  let max = 0;
  for (const id in rows) max = Math.max(max, rows[id][0]);
  for (const path of mapEl.querySelectorAll("path")) {
    const record = path.dataset.id ? rows[path.dataset.id] : null;
    const level = record ? bucket(record[0], max) : 0;
    path.setAttribute("class", level ? "b" + level : "");
    if (record) {
      path.dataset.value = String(record[0]);
      path.dataset.flag = record[1] || "";
    } else {
      delete path.dataset.value;
      delete path.dataset.flag;
    }
  }
  frame.dataset.animal = state.animal;
  const hi = legendEl.querySelector(".hi");
  if (hi) hi.textContent = max ? countFormat.format(max) : "";
  renderTables();
}

function describe(path) {
  if (!path || !path.dataset.name) {
    hoverEl.textContent = "Hover a country";
    return;
  }
  if (!path.dataset.value) {
    hoverEl.textContent = `${path.dataset.name}, no count`;
    return;
  }
  const count = countFormat.format(Number(path.dataset.value));
  const note = FLAGS[path.dataset.flag];
  const animal = beastLabel().toLowerCase();
  hoverEl.textContent = note
    ? `${path.dataset.name}, ${count} ${animal}, ${note}`
    : `${path.dataset.name}, ${count} ${animal}`;
}

function onCountry(event) {
  describe(event.target.closest("path"));
}

function fillTable(body, ranked, formatValue) {
  body.replaceChildren();
  if (!ranked.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 2;
    cell.textContent = "No counts.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }
  ranked.forEach((entry, index) => {
    const row = document.createElement("tr");
    const place = document.createElement("td");
    place.textContent = `${index + 1}. ${entry.name}`;
    const value = document.createElement("td");
    value.className = "num";
    value.textContent = formatValue(entry.value);
    row.append(place, value);
    body.appendChild(row);
  });
}

function renderTables() {
  const rows = rowsFor();
  const counted = Object.entries(rows)
    .map(([id, record]) => ({ id, name: NAMES.get(id) || "Unknown", value: record[0] }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
  fillTable(countBody, counted.slice(0, 10), (value) => countFormat.format(value));

  const rates = [];
  for (const entry of counted) {
    const people = POP[entry.id] && POP[entry.id][YEAR];
    if (!people) continue;
    rates.push({ name: entry.name, value: (entry.value / people) * 1000 });
  }
  rates.sort((a, b) => b.value - a.value);
  fillTable(rateBody, rates.slice(0, 10), (value) => rateFormat.format(value));
}

function announce() {
  const rows = rowsFor();
  let topId = null;
  let topValue = -1;
  for (const id in rows) {
    if (rows[id][0] > topValue) {
      topValue = rows[id][0];
      topId = id;
    }
  }
  const label = beastLabel();
  if (topId == null) {
    statusEl.textContent = `${label}. Nothing plotted.`;
    return;
  }
  const country = mapEl.querySelector(`path[data-id="${topId}"]`);
  const name = country ? country.dataset.name : "a country";
  statusEl.textContent = `${label}. Most on the map: ${name}, ${countFormat.format(topValue)}.`;
}

function selectAnimal(id) {
  state.animal = id;
  for (const button of animalsEl.querySelectorAll("button")) {
    const selected = button.dataset.animal === id;
    button.setAttribute("aria-checked", selected ? "true" : "false");
  }
  paint();
  announce();
}

function renderAnimals() {
  for (const beast of BEASTS) {
    const button = document.createElement("button");
    button.type = "button";
    button.role = "radio";
    button.dataset.animal = beast.id;
    button.textContent = beast.label;
    button.setAttribute("aria-checked", beast.id === state.animal ? "true" : "false");
    button.addEventListener("click", () => selectAnimal(beast.id));
    animalsEl.appendChild(button);
  }
}

function renderLegend() {
  legendEl.innerHTML = [
    '<span class="key"><i></i> no count</span>',
    '<span class="ramp"><span class="lo">fewer</span>',
    '<i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i><i class="b5"></i>',
    '<span class="hi"></span></span>',
  ].join("");
}

animalsEl.addEventListener("keydown", (event) => {
  if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
  event.preventDefault();
  const index = BEASTS.findIndex((beast) => beast.id === state.animal);
  const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
  const next = BEASTS[(index + direction + BEASTS.length) % BEASTS.length];
  selectAnimal(next.id);
  animalsEl.querySelector(`[data-animal="${next.id}"]`).focus();
});

renderLegend();
renderAnimals();
drawMap();
paint();
announce();
