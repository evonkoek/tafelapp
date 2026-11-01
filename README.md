# TafelApp

Vermenigvuldigingssommen oefenen. Rekenlogica in `src/tafelapp/` (Python), UI in `web/`.
Python draait in de browser via Pyodide, dus de app werkt op elke telefoon.

- Lokaal ontwikkelen: `uv sync`, `uv run pytest`, `uv run dev.py` → http://localhost:8000
- Eerste keer publiceren: `bash setup.sh tafelapp`
- Daarna publiceert elke `git push` naar `main` automatisch.
- Nieuwe Python-bestanden? Voeg ze toe aan `BESTANDEN` in `web/worker.js`.
