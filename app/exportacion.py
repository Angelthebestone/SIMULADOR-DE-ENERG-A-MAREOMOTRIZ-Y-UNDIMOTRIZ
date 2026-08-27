from __future__ import annotations

import csv
import datetime
import hashlib
import json
import pathlib

from nucleo.resultado import Resultado


def _hash_resultado(resultado: Resultado) -> str:
    canon = json.dumps(resultado.to_dict(), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()[:12]


def exportar_csv(
    resultado: Resultado,
    ruta: str | pathlib.Path,
    version_datos: str = "datos/ 2026-08-25",
) -> pathlib.Path:
    p = pathlib.Path(ruta)
    p.parent.mkdir(parents=True, exist_ok=True)
    meta = {
        "hash": _hash_resultado(resultado),
        "version_datos": version_datos,
        "fecha": datetime.datetime.now().isoformat(),
        "produccion_mwh": resultado.produccion_anual_mwh,
        "potencia_w": resultado.potencia_nominal_w,
    }
    with p.open("w", newline="", encoding="utf-8") as f:
        esc = csv.writer(f)
        esc.writerow(["# hash", meta["hash"]])
        esc.writerow(["# version_datos", meta["version_datos"]])
        esc.writerow(["# fecha", meta["fecha"]])
        esc.writerow(["eslabon", "potencia_entrada_w", "potencia_salida_w", "rendimiento"])
        for e in resultado.eslabones:
            esc.writerow([e.nombre, e.potencia_entrada_w, e.potencia_salida_w, e.rendimiento])
        esc.writerow(["produccion_anual_mwh", resultado.produccion_anual_mwh])
        esc.writerow(["potencia_nominal_w", resultado.potencia_nominal_w])
        esc.writerow(["factor_planta", resultado.factor_planta])
    return p


def exportar_figuras_datos(
    resultado: Resultado,
    carpeta: str | pathlib.Path,
    version_datos: str = "datos/ 2026-08-25",
) -> list[pathlib.Path]:
    base = pathlib.Path(carpeta)
    base.mkdir(parents=True, exist_ok=True)
    meta = {
        "hash": _hash_resultado(resultado),
        "version_datos": version_datos,
        "fecha": datetime.datetime.now().isoformat(),
    }
    p_json = base / "figuras_datos.json"
    datos_fig = {
        "meta": meta,
        "eslabones": [
            {
                "nombre": e.nombre,
                "rendimiento": e.rendimiento,
                "pin": e.potencia_entrada_w,
                "pout": e.potencia_salida_w,
            }
            for e in resultado.eslabones
        ],
        "recurso": resultado.recurso,
        "series_keys": list(resultado.series.keys()),
    }
    p_json.write_text(json.dumps(datos_fig, indent=2, ensure_ascii=False), encoding="utf-8")
    salidas: list[pathlib.Path] = [p_json]
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots()
        nombres = [e.nombre for e in resultado.eslabones] or ["vacio"]
        rends = [e.rendimiento for e in resultado.eslabones] or [0]
        ax.bar(nombres, rends)
        ax.set_ylabel("rendimiento")
        ax.set_ylim(0, 1)
        p_png = base / "cadena_rendimientos.png"
        fig.tight_layout()
        fig.savefig(p_png, dpi=120)
        plt.close(fig)
        salidas.append(p_png)
    except (ImportError, RuntimeError):
        pass
    return salidas
