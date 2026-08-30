"""Regenera las series de oleaje de Open-Meteo Marine API (modelo ERA5-Ocean/ECMWF).

Open-Meteo no exige clave ni registro. El modelo `era5_ocean` reexporta el reanálisis
ERA5 de oleaje de ECMWF, rejilla de 0,5 grados (~55 km), desde 1940 al presente con un
retraso de 5 dias. Es el unico modelo del servicio con cobertura anterior a 2021 en el
Caribe colombiano; los modelos de mayor resolucion (MFWAM, GFS Wave) solo cubren desde
2021-2024 en este punto.

La variable `wave_period` de este modelo es el "mean wave period" (mwp) de ECMWF,
que por definicion de ECMWF (Bidlot, "Ocean wave model output parameters", formula 5:
Tm-1 = m(-1)/m0) es el periodo energetico Te, exactamente la variable que pide la
ecuacion M1 de la especificacion (J = rho g^2 Hm0^2 Te / 64 pi). Ver documentacion en
`documentacion/fuentes_datos_oleaje.md` para el detalle y la referencia.

    python descargar_oleaje.py
"""

from urllib.parse import urlencode
from urllib.request import urlopen
import csv
import json
import pathlib
import statistics

API = "https://marine-api.open-meteo.com/v1/marine"
MODELO = "era5_ocean"
INICIO = "2015-01-01"
FIN = "2024-12-31"
VARIABLES = "wave_height,wave_period,wave_peak_period,wave_direction"

# Nombre, latitud, longitud.
EMPLAZAMIENTOS = {
    "isla_fuerte": ("Isla Fuerte", 9.390, -76.180),
    "san_andres": ("San Andrés", 12.569, -81.701),
    "tumaco": ("Tumaco", 1.903, -78.912),
}

DENSIDAD_AGUA = 1025.0  # kg/m3, agua de mar
G = 9.81  # m/s2
CONSTANTE_J = DENSIDAD_AGUA * G**2 / (64 * 3.141592653589793) / 1000  # kW/m por (Hs^2 * Te)


def descargar(lat: float, lon: float) -> dict:
    consulta = urlencode(
        {
            "latitude": lat,
            "longitude": lon,
            "hourly": VARIABLES,
            "start_date": INICIO,
            "end_date": FIN,
            "models": MODELO,
        }
    )
    with urlopen(f"{API}?{consulta}") as respuesta:
        return json.loads(respuesta.read().decode("utf-8"))


def guardar_csv(datos: dict, destino: pathlib.Path) -> int:
    horas = datos["hourly"]
    filas = list(
        zip(
            horas["time"],
            horas["wave_height"],
            horas["wave_period"],
            horas["wave_peak_period"],
            horas["wave_direction"],
        )
    )
    with open(destino, "w", newline="", encoding="utf-8") as f:
        escritor = csv.writer(f)
        escritor.writerow(["fecha_hora_utc", "hs_m", "te_s", "tp_s", "direccion_deg"])
        escritor.writerows(filas)
    return len(filas)


def densidad_potencia_media(datos: dict) -> tuple[float, float, float]:
    """Media anualizada de Hs, Te y J=0,4906*Hs^2*Te, ignorando horas sin dato."""
    horas = datos["hourly"]
    hs_vals, te_vals, j_vals = [], [], []
    for hs, te in zip(horas["wave_height"], horas["wave_period"]):
        if hs is None or te is None:
            continue
        hs_vals.append(hs)
        te_vals.append(te)
        j_vals.append(CONSTANTE_J * hs**2 * te)
    return statistics.mean(hs_vals), statistics.mean(te_vals), statistics.mean(j_vals)


if __name__ == "__main__":
    carpeta = pathlib.Path(__file__).parent
    resumen = {}
    for clave, (nombre, lat, lon) in EMPLAZAMIENTOS.items():
        datos = descargar(lat, lon)
        destino = carpeta / f"oleaje_{clave}_era5_{INICIO[:4]}-{FIN[:4]}.csv"
        n = guardar_csv(datos, destino)
        hs_m, te_m, j_m = densidad_potencia_media(datos)
        resumen[clave] = {
            "nombre": nombre,
            "lat_solicitada": lat,
            "lon_solicitada": lon,
            "lat_rejilla": datos["latitude"],
            "lon_rejilla": datos["longitude"],
            "registros": n,
            "hs_media_m": round(hs_m, 3),
            "te_media_s": round(te_m, 3),
            "densidad_potencia_media_kw_m": round(j_m, 3),
        }
        print(
            f"{destino.name}: {n} registros, rejilla en "
            f"{datos['latitude']},{datos['longitude']}, "
            f"Hs media {hs_m:.2f} m, Te media {te_m:.2f} s, "
            f"J media {j_m:.2f} kW/m"
        )

    (carpeta / "resumen_oleaje_era5.json").write_text(
        json.dumps(resumen, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # Comprobación: Isla Fuerte debe caer en el rango 0,5-2,5 m de Hs y 4-12 s de Te
    # que trae la especificación (apartado 8). Si esto falla, el modelo o el punto
    # de rejilla cambiaron.
    r = resumen["isla_fuerte"]
    assert 0.3 <= r["hs_media_m"] <= 2.5, r
    assert 4.0 <= r["te_media_s"] <= 12.0, r
    print("\ncomprobación ok")
