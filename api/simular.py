"""Función serverless de Vercel: POST /api/simular.

Envuelve `app.carcasa.api_simular`, que ya ejecuta `app.servicio.simular(...)` y
devuelve el contrato serializado por `app.contrato.serializar_contrato` — la misma
forma que el frontend consume desde `window.pywebview.api` en la carcasa nativa
(`web/src/api.ts`).

En producción no hay pywebview ni hilo de progreso: cada petición es un cálculo
de una sola condición de mar (~0,3 s), sin barridos ni matriz. Las rutas
`/api/comparar` y `/api/matriz` no existen en esta rama (escenario único).
"""

from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

# La función se empaqueta en la raíz del despliegue (/var/task). Anclamos el
# import y el cwd ahí para que `import app.*` y las lecturas relativas
# (`datos/sitios/*.json`, `datos/zni/*.csv`) resuelvan igual que en local.
RAIZ = Path(__file__).resolve().parent.parent
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))
try:
    os.chdir(RAIZ)
except OSError:
    pass

from app.carcasa import api_simular  # noqa: E402


def _a_json(payload: object) -> bytes:
    # `allow_nan=False`: NaN/Infinity no son JSON válido y JSON.parse los rechaza.
    # Si el contrato trae alguno es un fallo del cálculo, no algo que ocultar.
    return json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")


class handler(BaseHTTPRequestHandler):
    def _responder(self, codigo: int, payload: object) -> None:
        cuerpo = _a_json(payload)
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self) -> None:  # noqa: N802
        self._responder(200, {"ok": True, "servicio": "simular", "metodo": "POST"})

    def do_POST(self) -> None:  # noqa: N802
        try:
            n = int(self.headers.get("Content-Length") or 0)
            crudo = self.rfile.read(n) if n > 0 else b"{}"
            params = json.loads(crudo or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._responder(400, {"error": "cuerpo JSON inválido"})
            return

        try:
            contrato = api_simular(params if isinstance(params, dict) else {})
        except Exception as exc:  # noqa: BLE001
            self._responder(500, {"error": f"fallo al calcular: {exc}"})
            return

        try:
            self._responder(200, contrato)
        except ValueError as exc:  # allow_nan=False
            self._responder(500, {"error": f"contrato con valores no finitos: {exc}"})
