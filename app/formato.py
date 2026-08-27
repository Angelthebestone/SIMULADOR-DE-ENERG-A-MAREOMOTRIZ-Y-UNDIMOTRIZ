from __future__ import annotations


def formatear_numero(valor: float, decimales: int = 1) -> str:
    negativo = valor < 0
    v = abs(float(valor))
    entero = int(v)
    dec = v - entero
    entero_str = f"{entero:,}".replace(",", ".")
    if decimales <= 0:
        res = entero_str
    else:
        dec_str = f"{dec:.{decimales}f}"[1:].replace(".", ",")
        res = entero_str + dec_str
    return f"-{res}" if negativo else res


def formatear_magnitud(valor: float, unidad: str, decimales: int = 2) -> str:
    num = formatear_numero(valor, decimales)
    return f"{num} {unidad}".strip()


def formatear_kw_m(valor_kw_m: float) -> str:
    return formatear_magnitud(valor_kw_m, "kW/m", 1)


def formatear_gwh(valor_gwh: float) -> str:
    return formatear_magnitud(valor_gwh, "GWh/año", 1)


def formatear_potencia_w(valor_w: float) -> str:
    if abs(valor_w) >= 1e6:
        return formatear_magnitud(valor_w / 1e6, "MW", 2)
    if abs(valor_w) >= 1e3:
        return formatear_magnitud(valor_w / 1e3, "kW", 1)
    return formatear_magnitud(valor_w, "W", 0)


def formatear_porcentaje(valor_01: float) -> str:
    return formatear_magnitud(valor_01 * 100.0, "%", 1)
