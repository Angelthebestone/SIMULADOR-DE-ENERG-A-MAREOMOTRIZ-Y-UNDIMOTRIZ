"""Cachea referencias offline de la API XM (EquipoAnaliticaXM/API_XM, MIT, sin clave).

Dos métricas mínimas para la tesis del simulador:
  - PrecBolsNaci (Precio de Bolsa Nacional, Sistema, Horaria) -> validación cruzada vs CU Superservicios
  - factorEmisionCO2e (Factor de Emisión CO2eq/kWh, Sistema, Horaria) -> tCO2 evitadas

El simulador NUNCA llama a la red: lee los CSV/JSON de esta carpeta.
Este script es el único que toca la red y es manual: `python descargar_xm.py`.

Restricciones XM: horaria/diaria máx 30 días por llamada; mensual 732; anual 366.
Se pagina por ventanas de 30 días (horaria) para respetar el límite.

Requiere solo biblioteca estándar (urllib + json + csv). No necesita pydataxm.

    python descargar_xm.py                 # 2023-2024 (por defecto, rápido)
    python descargar_xm.py 2015-01-01 2024-12-31  # rango largo
"""

import csv
import json
import pathlib
import sys
import time
from datetime import date, timedelta
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = "https://servapibi.xm.com.co"
INICIO_DEF = "2023-01-01"
FIN_DEF = "2024-12-31"

METRICAS = {
    "PrecBolsNaci": {
        "period": "hourly",
        "endpoint": "HourlyEntities",
        "delta": 30,
        "entity": "Sistema",
        "desc": "Precio de Bolsa Nacional",
        "unidad": "COP/kWh",
    },
    "factorEmisionCO2e": {
        "period": "hourly",
        "endpoint": "HourlyEntities",
        "delta": 30,
        "entity": "Sistema",
        "desc": "Factor de emisión CO2eq/kWh",
        "unidad": "tCO2eq/kWh",
    },
}


def split_ranges(start: str, end: str, delta: int):
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    cur = s
    out = []
    while cur <= e:
        nxt = min(cur + timedelta(days=delta - 1), e)
        out.append((cur.isoformat(), nxt.isoformat()))
        cur = nxt + timedelta(days=1)
    return out


def xm_post(period: str, body: dict, retries: int = 3) -> dict:
    url = f"{BASE}/{period}"
    payload = json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json", "Connection": "close"}
    last_err = None
    for attempt in range(retries):
        try:
            req = Request(url, data=payload, headers=headers, method="POST")
            with urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as err:
            last_err = err
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"XM fallo tras {retries} intentos ({period} {body}): {last_err}")


def fetch_metric(metric_id: str, cfg: dict, start: str, end: str) -> list[dict]:
    period = cfg["period"]
    endpoint = cfg["endpoint"]
    delta = cfg["delta"]
    entity = cfg["entity"]
    ranges = split_ranges(start, end, delta)
    rows: list[dict] = []
    for s, e in ranges:
        body = {"MetricId": metric_id, "StartDate": s, "EndDate": e, "Entity": entity, "Filter": []}
        data = xm_post(period, body)
        items = data.get("Items", [])
        for item in items:
            for ent in item.get(endpoint, []):
                rows.extend(_horas_de_entidad(item.get("Date"), ent))
        time.sleep(0.3)
    return rows


def _horas_de_entidad(fecha: str, ent: dict) -> list[dict]:
    vals = ent.get("Values", {})
    filas: list[dict] = []
    for k, v in vals.items():
        if k == "code":
            continue
        try:
            hour = int(k.replace("Hour", ""))
            val = float(str(v).replace(",", "."))
        except (ValueError, TypeError):
            continue
        filas.append(
            {
                "fecha_hora": f"{fecha}T{hour:02d}:00:00",
                "valor": val,
                "id": vals.get("code", ent.get("Id", "")),
            }
        )
    return filas


def guardar_csv(rows: list[dict], destino: pathlib.Path) -> int:
    if not rows:
        destino.write_text("fecha_hora,valor,id\n", encoding="utf-8")
        return 0
    with open(destino, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["fecha_hora", "valor", "id"])
        w.writeheader()
        w.writerows(rows)
    return len(rows)


if __name__ == "__main__":
    inicio = sys.argv[1] if len(sys.argv) > 1 else INICIO_DEF
    fin = sys.argv[2] if len(sys.argv) > 2 else FIN_DEF
    carpeta = pathlib.Path(__file__).parent
    carpeta.mkdir(parents=True, exist_ok=True)
    resumen: dict = {
        "_fuente": "XM/API_XM (EquipoAnaliticaXM, pydataxm, MIT, sin clave) https://github.com/EquipoAnaliticaXM/API_XM",
        "_nota": "Bolsa = solo generación (horaria), distinto de CU Superservicios (GM+DM+CM). Factor emisión horario. Cache offline; la app no hace requests.",
        "periodo_solicitado": f"{inicio} a {fin}",
    }
    for mid, cfg in METRICAS.items():
        print(f"descargando {mid} ({cfg['desc']}) {inicio} -> {fin} ...")
        rows = fetch_metric(mid, cfg, inicio, fin)
        destino = carpeta / f"{mid}_{inicio[:4]}-{fin[:4]}.csv"
        n = guardar_csv(rows, destino)
        print(f"  -> {destino.name}: {n} filas")
        resumen[mid] = {
            "metric_id": mid,
            "descripcion": cfg["desc"],
            "period": cfg["period"],
            "entity": cfg["entity"],
            "endpoint": cfg["endpoint"],
            "unidad": cfg["unidad"],
            "archivo": destino.name,
            "filas": n,
            "formato": "fecha_hora (ISO8601), valor (float), id",
        }
        if n == 0:
            print(f"  AVISO: {mid} sin filas (API vacía o rango fuera de cobertura)")
    (carpeta / "resumen_xm.json").write_text(
        json.dumps(resumen, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    assert resumen["PrecBolsNaci"]["filas"] >= 0
    assert resumen["factorEmisionCO2e"]["filas"] >= 0
    print("\nresumen_xm.json actualizado")
    print("comprobación ok — CSVs en datos/xm/ listos para uso offline")
