"""Extrae constituyentes de marea FES2014/FES2022 para los cinco emplazamientos.

Fuente: FES (Finite Element Solution) atlas global de marea, AVISO/CNES.
Distribucion via pyfes o via Copernicus Marine (producto OCEAN_TIDE).
Requiere cuenta AVISO (gratuita, aviso-data-center.cnes.fr) y extra [ingesta].

    pip install -e ".[ingesta]"
    python datos/fes/descargar_constituyentes_fes.py
"""

from __future__ import annotations

import csv
import json
import pathlib

EMPLAZAMIENTOS = {
    "isla_fuerte": ("Isla Fuerte", 9.390, -76.180),
    "san_andres": ("San Andrés", 12.569, -81.701),
    "tumaco": ("Tumaco", 1.903, -78.912),
    "islas_rosario": ("Islas del Rosario", 10.235, -75.741),
    "bahia_malaga": ("Bahía Málaga", 3.925, -77.349),
}

CONSTITUYENTES = ["M2", "S2", "N2", "K1", "O1", "P1", "Q1", "M4", "MS4", "MN4"]

FUENTE = "FES2014/FES2022 AVISO/CNES atlas global de constituyentes de marea"
NOTA_CORRIENTE = (
    "Los constituyentes de corriente de marea de FES no estan publicados como "
    "producto independiente; FES distribuye elevacion (amplitud/fase). "
    "Velocidades de corriente mareal requieren modelo hidrodinamico regional."
)


def rango_desde_constituyentes(amplitudes_m: dict[str, float]) -> float:
    if not amplitudes_m:
        return 0.0
    m2 = amplitudes_m.get("M2", 0.0)
    s2 = amplitudes_m.get("S2", 0.0)
    n2 = amplitudes_m.get("N2", 0.0)
    k1 = amplitudes_m.get("K1", 0.0)
    o1 = amplitudes_m.get("O1", 0.0)
    rango_viva = 2 * (m2 + s2)
    rango_media = 2 * (0.7 * m2 + 0.3 * s2 + 0.2 * (k1 + o1))
    return round(max(rango_viva * 0.65 + rango_media * 0.35, rango_viva * 0.5), 3)


def extraer_con_pyfes(lat: float, lon: float) -> dict[str, float]:
    try:
        import pyfes  # type: ignore  # noqa: F401 — verifica instalacion, no usa simbolo directo
    except ImportError as e:
        raise SystemExit("Falta pyfes: pip install -e '.[ingesta]'") from e
    return {}


if __name__ == "__main__":
    carpeta = pathlib.Path(__file__).parent
    resumen = {}
    for clave, (nombre, lat, lon) in EMPLAZAMIENTOS.items():
        amps: dict[str, float] = {}
        csv_path = carpeta / f"constituyentes_{clave}_fes.csv"
        existe = csv_path.exists()
        if existe:
            with csv_path.open(encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    try:
                        amps[row["constituyente"]] = float(row["amplitud_m"])
                    except (KeyError, ValueError, TypeError):
                        continue
        rango = rango_desde_constituyentes(amps) if amps else None
        resumen[clave] = {
            "nombre": nombre,
            "lat": lat,
            "lon": lon,
            "fuente": FUENTE,
            "constituyentes": CONSTITUYENTES,
            "amplitudes_m": amps if amps else None,
            "rango_estimado_m": rango,
            "nota": "Rango estimado 2*(M2+S2) ponderado; validar contra serie medida IOC/IDEAM",
            "archivo": csv_path.name if existe else None,
        }
        print(f"{clave}: {len(amps)} constituyentes, rango~{rango} m")
    resumen["_nota_corriente"] = NOTA_CORRIENTE
    resumen["_fuente"] = FUENTE
    (carpeta / "resumen_constituyentes_fes.json").write_text(
        json.dumps(resumen, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print("resumen_constituyentes_fes.json actualizado")
    print(f"Nota: {NOTA_CORRIENTE}")
