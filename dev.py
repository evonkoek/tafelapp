"""Lokale devserver: serveert web/ op / en src/ op /py/.

Start met:  uv run dev.py   en open http://localhost:8000
"""
import http.server
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).parent.resolve()


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        p = unquote(path.split("?", 1)[0].split("#", 1)[0])
        if p.startswith("/py/"):
            base, rel = ROOT / "src", p[len("/py/"):]
        else:
            base, rel = ROOT / "web", p.lstrip("/")
        target = (base / rel).resolve()
        if base.resolve() not in target.parents and target != base.resolve():
            return str(base / "__geen_toegang__")
        return str(target)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("127.0.0.1", 8000), Handler) as server:
        print("Dev-server op http://localhost:8000  (Ctrl+C om te stoppen)")
        server.serve_forever()
