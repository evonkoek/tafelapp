// ---- Brug naar de Python-worker ------------------------------------------
const worker = new Worker("worker.js");
const wachtend = new Map();
let teller = 0;
let pythonKlaar = false;

worker.onmessage = ({ data }) => {
  if (data.klaar) {
    pythonKlaar = true;
    $("start").disabled = false;
    melding("Klaar om te oefenen.");
    herstelLaatsteSpeler();
    return;
  }
  if (data.fatal) {
    melding("Laden mislukt: " + data.fatal, true);
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

function el(tag, tekst, klasse) {
  const e = document.createElement(tag);
  if (tekst !== undefined) e.textContent = tekst;
  if (klasse) e.className = klasse;
  return e;
}

function melding(tekst, waarschuwing = false) {
  $("status").textContent = tekst;
  $("status").className = waarschuwing ? "waarschuwing" : "";
}

function toon(scherm) {
  for (const id of ["scherm-start", "scherm-vraag", "scherm-klaar"]) {
    const sectie = $(id);
    const zichtbaar = id === scherm;
    sectie.hidden = !zichtbaar;
    sectie.style.display = zichtbaar && id !== "scherm-klaar" ? "flex" : "";
  }
}

const vandaag = () => new Date().toISOString().slice(0, 10);

// ---- Opslag (per telefoon/browser) ----------------------------------------
const OPSLAG = "tafelapp.v2";
let data = laadData();

function laadData() {
  try {
    const d = JSON.parse(localStorage.getItem(OPSLAG));
    if (d && d.spelers) return d;
  } catch (e) { /* geen of ongeldige opslag */ }
  return { spelers: {}, laatste: "" };
}

function bewaarData() {
  try {
    localStorage.setItem(OPSLAG, JSON.stringify(data));
  } catch (e) {
    melding("Let op: je voortgang kan op dit toestel niet worden opgeslagen.", true);
  }
}

// ---- Speler kiezen ---------------------------------------------------------
let huidig = null; // { naam, sleutel }

function tekenSpelers() {
  const doel = $("spelers");
  doel.replaceChildren();
  const lijst = Object.entries(data.spelers);
  doel.hidden = lijst.length === 0;
  for (const [, speler] of lijst) {
    const b = el("button", speler.naam);
    b.type = "button";
    b.addEventListener("click", () => {
      $("naam").value = speler.naam;
      kiesSpeler(speler.naam);
    });
    doel.appendChild(b);
  }
}

async function kiesSpeler(ruw) {
  if (!pythonKlaar) return null;
  const [naam, sleutel] = await py("speler_id", ruw);
  if (!sleutel) {
    huidig = null;
    $("voortgang-start").replaceChildren();
    return null;
  }
  huidig = { naam, sleutel };
  const speler = data.spelers[sleutel];
  if (speler) {
    zetTafels(speler.tafels && speler.tafels.length ? speler.tafels : [2]);
    if (speler.aantal) $("aantal").value = String(speler.aantal);
  }
  await tekenVoortgang($("voortgang-start"), speler, naam, true);
  return huidig;
}

function herstelLaatsteSpeler() {
  const speler = data.spelers[data.laatste];
  if (speler && !$("naam").value) {
    $("naam").value = speler.naam;
    kiesSpeler(speler.naam);
  }
}

// ---- Voortgang tekenen -----------------------------------------------------
async function tekenVoortgang(doel, speler, naam, metWis) {
  doel.replaceChildren();
  if (!speler || speler.resultaten.length === 0) {
    if (naam && metWis) doel.appendChild(el("p", `Hoi ${naam}! Dit wordt je eerste ronde.`, "klein"));
    return;
  }
  const st = await py("statistieken", JSON.stringify(speler.resultaten));
  if (metWis && (!huidig || huidig.naam !== speler.naam)) return; // inmiddels andere speler

  const kaart = el("div", undefined, "kaart");
  kaart.appendChild(el("h3", `Voortgang van ${speler.naam}`));

  const cijfers = el("div", undefined, "cijfers");
  for (const [waarde, label] of [
    [st.rondes, "rondes"],
    [st.gemiddelde + "%", "gemiddeld"],
    [st.beste + "%", "beste"],
    [st.laatste + "%", "laatste"],
  ]) {
    const vak = el("div");
    vak.append(el("b", String(waarde)), el("span", label));
    cijfers.appendChild(vak);
  }

  const staven = el("div", undefined, "staven");
  const laatste = speler.resultaten.slice(-10);
  const percentages = st.percentages.slice(-10);
  laatste.forEach((r, i) => {
    const stavo = el("div", undefined, "stavo");
    stavo.title = `${r.d}: ${r.goed} van ${r.totaal} goed`;
    const vlak = el("div", undefined, "vlak");
    const staaf = el("div", undefined, "staaf");
    staaf.style.height = percentages[i] + "%";
    vlak.appendChild(staaf);
    stavo.append(vlak, el("span", String(percentages[i])));
    staven.appendChild(stavo);
  });

  kaart.append(cijfers, staven, el("p", st.trend, "klein"));

  if (metWis) {
    const wis = el("button", "Wis mijn voortgang", "tekstknop");
    wis.type = "button";
    wis.addEventListener("click", () => wisSpeler(speler.naam));
    kaart.appendChild(wis);
  }
  doel.appendChild(kaart);
}

function wisSpeler(naam) {
  if (!huidig || !confirm(`Alle rondes van ${naam} wissen? Dit kan niet ongedaan worden gemaakt.`)) return;
  delete data.spelers[huidig.sleutel];
  if (data.laatste === huidig.sleutel) data.laatste = "";
  bewaarData();
  huidig = null;
  $("naam").value = "";
  $("voortgang-start").replaceChildren();
  tekenSpelers();
  melding("Voortgang gewist.");
}

// ---- Startscherm: tafels ---------------------------------------------------
const gekozen = new Set([2]);
const tafelKnoppen = [];

for (let n = 1; n <= 10; n++) {
  const b = el("button", String(n));
  b.type = "button";
  b.setAttribute("aria-pressed", gekozen.has(n));
  b.addEventListener("click", () => {
    gekozen.has(n) ? gekozen.delete(n) : gekozen.add(n);
    b.setAttribute("aria-pressed", gekozen.has(n));
  });
  tafelKnoppen.push(b);
  $("tafels").appendChild(b);
}

function zetTafels(lijst) {
  gekozen.clear();
  lijst.forEach((n) => gekozen.add(n));
  tafelKnoppen.forEach((b, i) => b.setAttribute("aria-pressed", gekozen.has(i + 1)));
}

$("alle").addEventListener("click", () => zetTafels([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
$("geen").addEventListener("click", () => zetTafels([]));

$("naam").addEventListener("change", () => kiesSpeler($("naam").value));
$("naam").addEventListener("input", () => melding(pythonKlaar ? "Klaar om te oefenen." : "Python wordt geladen…"));
$("naam").addEventListener("keydown", (e) => { if (e.key === "Enter") $("naam").blur(); });

// ---- Geluid (zelf gesynthetiseerd, geen bestanden) --------------------------
const GELUID = "tafelapp.geluid";
let ctx = null;
let geluidAan = true;
try { geluidAan = localStorage.getItem(GELUID) !== "uit"; } catch (e) { /* standaard aan */ }

function audio() {
  if (!geluidAan) return null;
  if (!ctx) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    ctx = new A();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function piep(f, t0, d, type = "triangle", vol = 0.18, naar = 0) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + t0;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (naar) o.frequency.exponentialRampToValueAtTime(naar, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + d + 0.05);
}

function geluid(soort, reeks = 0) {
  if (soort === "goed") {
    [523, 659, 784, 1047, 1319].slice(0, Math.min(5, 3 + Math.floor(reeks / 2)))
      .forEach((f, i) => piep(f, i * 0.07, 0.28));
  } else if (soort === "fout") {
    piep(300, 0, 0.25, "sawtooth", 0.08);
    piep(220, 0.18, 0.4, "sawtooth", 0.08);
  } else if (soort === "boing") {
    piep(200, 0, 0.35, "sine", 0.25, 700);
  } else if (soort === "fanfare") {
    [[523, 0], [523, 0.14], [523, 0.28], [659, 0.42], [784, 0.62], [659, 0.82], [784, 0.95], [1047, 1.15]]
      .forEach(([f, t]) => piep(f, t, 0.3, "square", 0.09));
  } else if (soort === "tik") {
    piep(880, 0, 0.05, "square", 0.04);
  }
}

function zetGeluid(aan) {
  geluidAan = aan;
  $("geluid").textContent = aan ? "🔊" : "🔇";
  try { localStorage.setItem(GELUID, aan ? "aan" : "uit"); } catch (e) { /* geen opslag */ }
}

// ---- Panda-toneel: intro en afsluiting -------------------------------------
function toneel(modus, tekst = "", n = 3) {
  return new Promise((klaar) => {
    const t = $("toneel"), f = $("figuur"), knop = $("toneel-knop"), b = $("bubbel");
    const timers = [];
    let gesloten = false;
    const na = (ms, fn) => timers.push(setTimeout(fn, ms));
    const stand = (k) => f.setAttribute("class", k);
    const sluit = () => {
      if (gesloten) return;
      gesloten = true;
      timers.forEach(clearTimeout);
      t.hidden = true;
      if (modus === "intro") { geluid("goed", 4); pandaMood("blij"); }
      klaar();
    };
    t.className = "modus-" + modus;
    t.hidden = false;
    b.textContent = "";
    knop.onclick = t.onclick = sluit;
    if (modus === "intro") {
      knop.textContent = "Overslaan »";
      knop.className = "sec";
      stand("loop");
      na(2200, () => stand("dans"));
      na(4600, () => {
        stand("wenk");
        b.textContent = "Hoi! Kom je mee tafels oefenen? 🎋";
        knop.textContent = "Ik doe mee! 🎋";
        knop.className = "";
      });
    } else {
      knop.textContent = "Verder »";
      knop.className = "";
      stand("feest");
      b.textContent = tekst;
      geluid("fanfare");
      for (let i = 0; i <= n; i++) na(i * 700, () => feest(40 + n * 12));
      na(4500, sluit);
    }
  });
}

function wiebel() {
  document.body.classList.add("wiebel");
  setTimeout(() => document.body.classList.remove("wiebel"), 500);
}

// ---- Panda en feestje ------------------------------------------------------
function pandaMood(klasse, ms = 900) {
  const p = $("panda");
  p.classList.remove("blij", "triest");
  void p.getBoundingClientRect(); // animatie opnieuw starten
  p.classList.add(klasse);
  clearTimeout(p._t);
  p._t = setTimeout(() => p.classList.remove(klasse), ms);
}

function feest(aantal = 20) {
  const laag = $("confetti");
  const lijst = ["🎋", "⭐", "🍃", "✨", "🐼", "🎉", "💚", "🌟"];
  for (let i = 0; i < aantal; i++) {
    const s = el("span", lijst[Math.floor(Math.random() * lijst.length)], "snipper");
    s.style.setProperty("--x", `${(Math.random() * 80 - 40).toFixed(1)}vmin`);
    s.style.setProperty("--y", `${(-(Math.random() * 35 + 10)).toFixed(1)}vmin`);
    s.style.setProperty("--r", `${Math.round(Math.random() * 360 - 180)}deg`);
    s.style.animationDelay = `${(Math.random() * 0.25).toFixed(2)}s`;
    s.style.fontSize = `${(1.1 + Math.random() * 1.6).toFixed(1)}rem`;
    s.style.left = `${Math.round(25 + Math.random() * 50)}%`;
    s.addEventListener("animationend", () => s.remove());
    laag.appendChild(s);
  }
}

function toonReeks(animatie) {
  const r = $("reeks");
  r.textContent = ronde.reeks >= 2 ? `🎋 ${ronde.reeks} op een rij!` : "";
  r.classList.remove("nieuw");
  if (animatie && ronde.reeks >= 2) { void r.offsetWidth; r.classList.add("nieuw"); }
}

// ---- Oefenronde ------------------------------------------------------------
const ronde = { vragen: [], i: 0, goed: 0, fouten: [], invoer: "", wacht: false, sleutel: "", naam: "", tafels: [] };

async function startRonde() {
  if (!pythonKlaar) return;
  const speler = await kiesSpeler($("naam").value);
  if (!speler) {
    melding("Vul eerst je naam in.", true);
    toon("scherm-start");
    $("naam").focus();
    return;
  }
  if (gekozen.size === 0) {
    melding("Kies eerst minstens één tafel.", true);
    toon("scherm-start");
    return;
  }
  const tafels = [...gekozen].sort((a, b) => a - b);
  const aantal = Number($("aantal").value);

  if (!data.spelers[speler.sleutel]) {
    data.spelers[speler.sleutel] = { naam: speler.naam, resultaten: [], tafels, aantal };
  }
  const opgeslagen = data.spelers[speler.sleutel];
  Object.assign(opgeslagen, { naam: speler.naam, tafels, aantal });
  data.laatste = speler.sleutel;
  bewaarData();
  tekenSpelers();

  melding("");
  ronde.vragen = await py("maak_vragen", tafels, aantal);
  Object.assign(ronde, {
    i: 0, goed: 0, reeks: 0, besteReeks: 0, fouten: [], invoer: "", wacht: false,
    sleutel: speler.sleutel, naam: speler.naam, tafels,
  });
  toon("scherm-vraag");
  toonVraag();
}

function toonVraag() {
  const [a, b] = ronde.vragen[ronde.i];
  $("vraag").textContent = `${a} × ${b}`;
  $("teller").textContent = `Som ${ronde.i + 1} van ${ronde.vragen.length}`;
  $("balk").style.width = `${(ronde.i / ronde.vragen.length) * 100}%`;
  $("feedback").textContent = "";
  $("vraag").classList.remove("pop");
  void $("vraag").offsetWidth;
  $("vraag").classList.add("pop");
  toonReeks(false);
  ronde.invoer = "";
  ronde.wacht = false;
  toonInvoer();
}

function toonInvoer(klasse = "") {
  const antwoord = $("antwoord");
  antwoord.textContent = ronde.invoer || "…";
  antwoord.className = "antwoord " + klasse;
}

function toets(teken) {
  if (ronde.wacht) return;
  geluid("tik");
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
    ronde.reeks++;
    ronde.besteReeks = Math.max(ronde.besteReeks, ronde.reeks);
    toonInvoer("goed");
    $("feedback").textContent = await py("lof", ronde.reeks);
    toonReeks(true);
    pandaMood("blij");
    feest(ronde.reeks >= 3 ? 70 : 40);
    geluid("goed", ronde.reeks);
    if ([3, 5, 10].includes(ronde.reeks)) { geluid("fanfare"); wiebel(); }
    if (navigator.vibrate) navigator.vibrate(30);
  } else {
    ronde.reeks = 0;
    ronde.fouten.push({ a, b, jij: ronde.invoer, antwoord: a * b });
    toonInvoer("fout");
    $("feedback").textContent = `${await py("troost")} ${a} × ${b} = ${a * b}`;
    toonReeks(false);
    pandaMood("triest", 1400);
    geluid("fout");
  }
  setTimeout(volgende, goed ? 1100 : 2100);
}

function volgende() {
  ronde.i++;
  if (ronde.i >= ronde.vragen.length) return eindig();
  toonVraag();
}

async function eindig() {
  const totaal = ronde.vragen.length;
  $("balk").style.width = "100%";

  // Resultaat opslaan bij deze speler
  const speler = data.spelers[ronde.sleutel];
  const vorige = speler.resultaten[speler.resultaten.length - 1];
  speler.resultaten.push({ d: vandaag(), goed: ronde.goed, totaal, tafels: ronde.tafels });
  speler.resultaten = speler.resultaten.slice(-200);
  bewaarData();

  $("klaar-kop").textContent = `Klaar, ${ronde.naam}!`;
  $("score").textContent = `${ronde.goed} / ${totaal}`;
  $("bericht").textContent = await py("beoordeling", ronde.goed, totaal);
  const sterren = await py("sterren", ronde.goed, totaal);
  $("sterren").replaceChildren(...[0, 1, 2].map((i) => {
    const s = el("span", i < sterren ? "⭐" : "☆");
    s.style.animationDelay = `${i * 0.25}s`;
    return s;
  }));
  $("vergelijk").textContent = (vorige
    ? `Vorige ronde: ${vorige.goed} / ${vorige.totaal}`
    : "Dit was je eerste ronde!") + (ronde.besteReeks >= 2 ? ` · Langste reeks: ${ronde.besteReeks}` : "");

  const lijst = $("fouten");
  lijst.replaceChildren();
  if (ronde.fouten.length) {
    const ul = el("ul");
    for (const f of ronde.fouten) {
      ul.appendChild(el("li", `${f.a} × ${f.b} = ${f.antwoord} (jij: ${f.jij})`));
    }
    lijst.append(el("h2", "Nog even oefenen:"), ul);
  }

  await tekenVoortgang($("voortgang-klaar"), speler, ronde.naam, false);
  toon("scherm-klaar");
  await toneel("finale", `Wat een toppie, ${ronde.naam}! ${"⭐".repeat(sterren)}`, sterren);
}

function naarStart() {
  toon("scherm-start");
  tekenSpelers();
  if (huidig) kiesSpeler(huidig.naam);
}

// ---- Numpad en toetsenbord -------------------------------------------------
for (const t of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"]) {
  const b = el("button", t);
  b.type = "button";
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
$("andere").addEventListener("click", naarStart);
$("stop").addEventListener("click", naarStart);
tekenSpelers();
toon("scherm-start");

// ---- Opstarten: geluid, panda aantikken, intro -----------------------------
$("figuur-kop").innerHTML = $("panda").innerHTML;
$("figuur-kop").firstElementChild.remove(); // achtergrondschijf weghalen
zetGeluid(geluidAan);
$("geluid").addEventListener("click", () => { zetGeluid(!geluidAan); if (geluidAan) geluid("goed", 2); });
$("panda").addEventListener("click", () => { pandaMood("blij", 900); geluid("boing"); feest(10); });
toneel("intro");
