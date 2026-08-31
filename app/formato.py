from __future__ import annotations


def formatear_numero(valor: float, decimales: int = 1) -> str:
    """Numero en formato espanol: coma decimal, punto de miles.

    Se redondea primero y se parte despues. Al reves se perdia el acarreo:
    5,96 con un decimal daba "5,0" en vez de "6,0", porque la parte entera se
    tomaba de int(5,96)=5 mientras la decimal redondeaba a 1,0.
    """
    texto = f"{float(valor):.{max(decimales, 0)}f}"
    negativo = texto.startswith("-")
    if negativo:
        texto = texto[1:]
    entero, _, dec = texto.partition(".")
    entero_str = f"{int(entero):,}".replace(",", ".")
    res = f"{entero_str},{dec}" if dec else entero_str
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
