// Laadt Pyodide en roept functies uit tafelapp.core aan.
importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js");

// Voeg hier nieuwe Python-bestanden toe als je ze maakt in src/tafelapp/.
const BESTANDEN = ["__init__.py", "core.py"];

const klaar = (async () => {
  const pyodide = await loadPyodide();
  pyodide.FS.mkdirTree("/home/pyodide/tafelapp");
  for (const f of BESTANDEN) {
    const r = await fetch(`py/tafelapp/${f}`, { cache: "no-cache" });
    if (!r.ok) throw new Error(`Kan ${f} niet laden`);
    pyodide.FS.writeFile(`/home/pyodide/tafelapp/${f}`, await r.text());
  }
  pyodide.runPython("import sys; sys.path.insert(0, '/home/pyodide')");
  const core = pyodide.pyimport("tafelapp.core");
  self.postMessage({ klaar: true });
  return { pyodide, core };
})();

klaar.catch((err) => self.postMessage({ fatal: String(err) }));

self.onmessage = async ({ data }) => {
  const { id, name, args } = data;
  try {
    const { pyodide, core } = await klaar;
    const pyArgs = args.map((a) => pyodide.toPy(a));
    const result = core[name](...pyArgs);
    self.postMessage({
      id,
      result: result?.toJs ? result.toJs({ dict_converter: Object.fromEntries }) : result,
    });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
