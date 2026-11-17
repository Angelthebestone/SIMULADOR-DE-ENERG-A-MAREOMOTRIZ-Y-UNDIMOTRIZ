"""Reduce el CSV crudo de Tumaco (IOC tumc) a maximos/minimos diarios.

Lee por streaming (csv.DictReader) el crudo
`nivel_mar_tumaco_ioc_2023-2025.csv` (columnas: fecha_hora_utc,nivel_m,sensor),
filtra niveles fuera de [0.5, 8.0], agrupa por dia (YYYY-MM-DD de
fecha_hora_utc), exige >= 10 lecturas/dia y escribe el derivado liviano
`nivel_mar_tumaco_diario_2023-2025.csv` con columnas
fecha,n_min_m,n_max_m,rango_m,n_lecturas,sensor.

Solo stdlib: csv, json, pathlib, statistics, collections.

    python procesar_tumaco_diario.py
"""

import csv
import pathlib
import statistics
from collections import Counter, defaultdict

NIVEL_MIN_PLAUSIBLE = 0.5
NIVEL_MAX_PLAUSIBLE = 8.0
MIN_LECTURAS_DIA = 10


def main() -> None:
    carpeta = pathlib.Path(__file__).parent
    crudo = carpeta / "nivel_mar_tumaco_ioc_2023-2025.csv"
    destino = carpeta / "nivel_mar_tumaco_diario_2023-2025.csv"

    # Agregacion por streaming: por dia se guardan min/max/conteo y
    # conteo de sensores (para reportar el sensor dominante del dia).
    minimos: dict[str, float] = {}
    maximos: dict[str, float] = {}
    conteos: dict[str, int] = defaultdict(int)
    sensores: dict[str, Counter] = defaultdict(Counter)

    total = 0
    descartados = 0
    with open(crudo, newline="", encoding="utf-8") as f:
        lector = csv.DictReader(f)
        for fila in lector:
            total += 1
            try:
                nivel = float(fila["nivel_m"])
            except (TypeError, ValueError):
                descartados += 1
                continue
            if not (NIVEL_MIN_PLAUSIBLE <= nivel <= NIVEL_MAX_PLAUSIBLE):
                descartados += 1
                continue
            dia = fila["fecha_hora_utc"][:10]  # YYYY-MM-DD
            if dia in minimos:
                if nivel < minimos[dia]:
                    minimos[dia] = nivel
                if nivel > maximos[dia]:
                    maximos[dia] = nivel
            else:
                minimos[dia] = nivel
                maximos[dia] = nivel
            conteos[dia] += 1
            sensores[dia][fila.get("sensor", "")] += 1

    dias = sorted(d for d, n in conteos.items() if n >= MIN_LECTURAS_DIA)
    rangos = [maximos[d] - minimos[d] for d in dias]

    with open(destino, "w", newline="", encoding="utf-8") as f:
        escritor = csv.writer(f)
        escritor.writerow(["fecha", "n_min_m", "n_max_m", "rango_m", "n_lecturas", "sensor"])
        for d in dias:
            sensor = sensores[d].most_common(1)[0][0] if sensores[d] else ""
            escritor.writerow(
                [
                    d,
                    round(minimos[d], 3),
                    round(maximos[d], 3),
                    round(maximos[d] - minimos[d], 3),
                    conteos[d],
                    sensor,
                ]
            )

    rango_medio = round(statistics.mean(rangos), 3) if rangos else 0.0
    print(f"lecturas totales leidas: {total}")
    print(f"lecturas descartadas (fuera de rango o invalidas): {descartados}")
    print(f"dias con >= {MIN_LECTURAS_DIA} lecturas: {len(dias)}")
    print(f"rango medio observado: {rango_medio} m")
    print(f"derivado: {destino.name} ({destino.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
