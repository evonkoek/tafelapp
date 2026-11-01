// ---- Brug naar de Python-worker ------------------------------------------
const worker = new Worker("worker.js");
const wachtend = new Map();
let teller = 0;
let pythonKlaar = false;

worker.onmessage = ({ data }) => {
  if (data.klaar) {
    pythonKlaar = true;
    document.getElementById("status").textContent = "Klaar om te oefenen.";
    document.getElementById("start").disabled = false;
    return;
  }
  if (data.fatal) {
    document.getElementById("status").textContent = "Laden mislukt: " + data.fatal;
    return;
  }
  const p = wachtend.get(data.id);
  wachtend.delete(data.id);
  data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
};

function py(name, ...args) {
  return new Promise((resolve, reject) => {
    const id = ++teller;
    wachtend.set(id, { resolve, reject });
    worker.postMessage({ id, name, args });
  });
}

// ---- Hulpfuncties ----------------------------------------------------------
const $ = (id) => document.getElementById(id);
const SLEUTEL = "tafelapp.instellingen";

function toon(scherm) {
  for (const id of ["scherm-start", "scherm-vraag", "scherm-klaar"]) {
    const el = $(id);
    const zichtbaar = id === scherm;
    el.hidden = !zichtbaar;
    el.style.display = zichtbaar && id !== "scherm-klaar" ? "flex" : "";
  }
}

function bewaar(instellingen) {
  try { localStorage.setItem(SLEUTEL, JSON.stringify(instellingen)); } catch (e) { /* geen opslag */ }
}
function laad() {
  try { return JSON.parse(localStorage.getItem(SLEUTEL)) || {}; } catch (e) { return {}; }
}

// ---- Startscherm -----------------------------------------------------------
const opgeslagen = laad();
const gekozen = new Set(opgeslagen.tafels || [2]);

for (let n = 1; n <= 10; n++) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = n;
  b.setAttribute("aria-pressed", gekozen.has(n));
  b.addEventListener("click", () => {
    gekozen.has(n) ? gekozen.delete(n) : gekozen.add(n);
    b.setAttribute("aria-pressed", gekozen.has(n));
  });
  $("tafels").appendChild(b);
}
if (opgeslagen.aantal) $("aantal").value = opgeslagen.aantal;

function zetAlle(aan) {
  gekozen.clear();
  document.querySelectorAll("#tafels button").forEach((b, i) => {
    if (aan) gekozen.add(i + 1);
    b.setAttribute("aria-pressed", aan);
  });
}
$("alle").addEventListener("click", () => zetAlle(true));
$("geen").addEventListener("click", () => zetAlle(false));

// ---- Oefenronde ------------------------------------------------------------
const ronde = { vragen: [], i: 0, goed: 0, fouten: [], invoer: "", wacht: false };

async function startRonde() {
  if (!pythonKlaar) return;
  if (gekozen.size === 0) {
    $("status").textContent = "Kies eerst minstens één tafel.";
    return;
  }
  const tafels = [...gekozen].sort((a, b) => a - b);
  const aantal = Number($("aantal").value);
  bewaar({ tafels, aantal });
  $("status").textContent = "";
  ronde.vragen = await py("maak_vragen", tafels, aantal);
  Object.assign(ronde, { i: 0, goed: 0, fouten: [], invoer: "", wacht: false });
  toon("scherm-vraag");
  toonVraag();
}

function toonVraag() {
  const [a, b] = ronde.vragen[ronde.i];
  $("vraag").textContent = `${a} × ${b}`;
  $("teller").textContent = `Som ${ronde.i + 1} van ${ronde.vragen.length}`;
  $("balk").style.width = `${(ronde.i / ronde.vragen.length) * 100}%`;
  $("feedback").textContent = "";
  ronde.invoer = "";
  ronde.wacht = false;
  toonInvoer();
}

function toonInvoer(klasse = "") {
  const el = $("antwoord");
  el.textContent = ronde.invoer || "…";
  el.className = "antwoord " + klasse;
}

function toets(teken) {
  if (ronde.wacht) return;
  if (teken === "⌫") ronde.invoer = ronde.invoer.slice(0, -1);
  else if (ronde.invoer.length < 3) ronde.invoer += teken;
  toonInvoer();
}

async function bevestig() {
  if (ronde.wacht || ronde.invoer === "") return;
  ronde.wacht = true;
  const [a, b] = ronde.vragen[ronde.i];
  const goed = await py("controleer", a, b, ronde.invoer);
  if (goed) {
    ronde.goed++;
    toonInvoer("goed");
    $("feedback").textContent = "Goed!";
  } else {
    ronde.fouten.push({ a, b, jij: ronde.invoer, antwoord: a * b });
    toonInvoer("fout");
    $("feedback").textContent = `Helaas: ${a} × ${b} = ${a * b}`;
  }
  setTimeout(volgende, goed ? 700 : 1900);
}

async function volgende() {
  ronde.i++;
  if (ronde.i >= ronde.vragen.length) return eindig();
  toonVraag();
}

async function eindig() {
  const totaal = ronde.vragen.length;
  $("balk").style.width = "100%";
  $("score").textContent = `${ronde.goed} / ${totaal}`;
  $("bericht").textContent = await py("beoordeling", ronde.goed, totaal);
  const lijst = $("fouten");
  lijst.replaceChildren();
  if (ronde.fouten.length) {
    const kop = document.createElement("h2");
    kop.textContent = "Nog even oefenen:";
    const ul = document.createElement("ul");
    for (const f of ronde.fouten) {
      const li = document.createElement("li");
      li.textContent = `${f.a} × ${f.b} = ${f.antwoord} (jij: ${f.jij})`;
      ul.appendChild(li);
    }
    lijst.append(kop, ul);
  }
  toon("scherm-klaar");
}

// ---- Numpad en toetsenbord -------------------------------------------------
for (const t of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"]) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = t;
  if (t === "OK") b.classList.add("ok");
  b.addEventListener("click", () => (t === "OK" ? bevestig() : toets(t)));
  $("numpad").appendChild(b);
}

document.addEventListener("keydown", (e) => {
  if ($("scherm-vraag").hidden) return;
  if (/^[0-9]$/.test(e.key)) toets(e.key);
  else if (e.key === "Backspace") toets("⌫");
  else if (e.key === "Enter") bevestig();
});

$("start").addEventListener("click", startRonde);
$("opnieuw").addEventListener("click", startRonde);
$("andere").addEventListener("click", () => toon("scherm-start"));
$("stop").addEventListener("click", () => toon("scherm-start"));
toon("scherm-start");
