"""PTO — toma de fuerza, cadena undimotriz (M5 Handbook).

Cinco tipos con rendimiento ola→generador y fuente.
Strategy intercambiable sin tocar cadena.
Incluye avisos de oficio, Wells vs impulso, picos y fluctuacion.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from nucleo.resultado import Eslabon

# Rendimientos Handbook cap. 1 tabla 4
RENDIMIENTOS_PTO: dict[str, float] = {
    "hidraulico": 0.65,
    "agua": 0.85,
    "aire": 0.55,
    "mecanico": 0.90,
    "directo": 0.95,
}

FUENTES_PTO: dict[str, str] = {
    "hidraulico": "Handbook cap. 1 tabla 4 — hidraulico 65%",
    "agua": "Handbook cap. 1 tabla 4 — agua 85% (turbina hidraulica baja carga)",
    "aire": "Handbook cap. 1 tabla 4 — aire 55% (turbina autorrectificante)",
    "mecanico": "Handbook cap. 1 tabla 4 — mecanico 90%",
    "directo": "Handbook cap. 1 tabla 4 — accionamiento directo 95%",
}

# Turbinas de aire OWC — compromiso pico vs ancho de banda
EFICIENCIA_WELLS_PICO: float = 0.55
RANGO_WELLS_ESTRECHO: tuple[float, float] = (0.85, 1.15)
EFICIENCIA_IMPULSO_PICO: float = 0.44
RANGO_IMPULSO_ANCHO: tuple[float, float] = (0.40, 1.60)

# Fluctuacion max/medio Handbook cap. 1 tabla 3
RATIOS_FLUCTUACION: dict[str, tuple[float, float]] = {
    "unidireccional_1cuerpo": (15.0, 30.0),
    "bidireccional_1cuerpo": (10.0, 12.0),
    "owc_bidireccional": (10.0, 15.0),
    "10cuerpos_bidireccional": (3.0, 7.0),
}


class EstrategiaPTO(Protocol):
    """Contrato Strategy — aplicar sin tocar la cadena."""

    def aplicar(self, potencia_entrada_w: float) -> Eslabon: ...


@dataclass(frozen=True, slots=True)
class ConfigPTO:
    tipo: str
    rendimiento: float
    fuente: str


def _normalizar_tipo(tipo: str) -> str:
    clave = tipo.strip().lower()
    if clave not in RENDIMIENTOS_PTO:
        raise ValueError(f"tipo PTO desconocido: {tipo} ({list(RENDIMIENTOS_PTO)})")
    return clave


def config_pto(tipo: str) -> ConfigPTO:
    """Devuelve configuracion inmutable del tipo PTO."""
    clave = _normalizar_tipo(tipo)
    return ConfigPTO(
        tipo=clave,
        rendimiento=RENDIMIENTOS_PTO[clave],
        fuente=FUENTES_PTO[clave],
    )


def rendimiento_pto(tipo: str) -> float:
    """Rendimiento 0-1 del PTO segun tipo."""
    return config_pto(tipo).rendimiento


def fuente_pto(tipo: str) -> str:
    """Fuente trazable del rendimiento."""
    return config_pto(tipo).fuente


def crear_eslabon_pto(potencia_entrada_w: float, tipo: str) -> Eslabon:
    """Strategy hidraulico/agua/aire/mecanico/directo — salida proporcional."""
    cfg = config_pto(tipo)
    pot = max(float(potencia_entrada_w), 0.0)
    salida = pot * cfg.rendimiento
    return Eslabon(
        nombre="pto",
        potencia_entrada_w=pot,
        potencia_salida_w=salida,
        rendimiento=cfg.rendimiento,
        detalle={"tipo": cfg.tipo, "fuente": cfg.fuente},
    )


def validar_rendimiento(valor: float) -> str | None:
    """Invariante 7.3 — rendimientos en [0,1]."""
    if 0.0 <= valor <= 1.0:
        return None
    return f"rendimiento {valor} fuera de [0,1]"


# ── 3.2 Reglas de oficio como avisos que no impiden ──


def avisos_oficio(
    un_grado_libertad: bool = True,
    referencia_fija: bool = True,
    control_avanzado: bool = False,
) -> list[str]:
    """Tres reglas de oro Handbook cap.1 §4.4 como avisos no bloqueantes."""
    avisos: list[str] = []
    if not un_grado_libertad:
        avisos.append(
            "PTO fuera de 1 GDL: el cuerpo evita al PTO y baja rendimiento "
            "(Handbook cap.1 §4.4 regla 1) — aviso, no bloquea"
        )
    if not referencia_fija:
        avisos.append(
            "PTO sin referencia fija (fondo/estructura inmovil): eficiencia menor "
            "(Handbook cap.1 §4.4 regla 2) — aviso, no bloquea"
        )
    if control_avanzado:
        avisos.append(
            "Control avanzado: aumenta produccion pero tambien cargas y desgaste "
            "(Handbook cap.1 §4.4 regla 3) — aviso con coste, no bloquea"
        )
    return avisos


# ── 3.3 Wells vs impulso ──


def eficiencia_wells(caudal_norm: float) -> float:
    """Pico 50-55% rango estrecho, caida por perdida aerodinamica fuera de rango."""
    if RANGO_WELLS_ESTRECHO[0] <= caudal_norm <= RANGO_WELLS_ESTRECHO[1]:
        # parabola suave hacia pico 0.55 en 1.0
        desvio = abs(caudal_norm - 1.0) / 0.15
        return EFICIENCIA_WELLS_PICO * max(0.0, 1.0 - 0.35 * desvio * desvio)
    # fuera de banda — perdida
    return EFICIENCIA_WELLS_PICO * 0.35


def eficiencia_impulso(caudal_norm: float) -> float:
    """Pico menor (≈44%) pero ancho de banda mucho mayor."""
    if RANGO_IMPULSO_ANCHO[0] <= caudal_norm <= RANGO_IMPULSO_ANCHO[1]:
        desvio = abs(caudal_norm - 1.0) / 0.60
        return EFICIENCIA_IMPULSO_PICO * max(0.0, 1.0 - 0.25 * desvio * desvio)
    return EFICIENCIA_IMPULSO_PICO * 0.30


def aviso_wells_vs_impulso() -> str:
    """Explica por que impulso puede superar a Wells en energia anual."""
    return (
        "Wells pico 50-55% banda estrecha con perdida; impulso pico menor pero banda ancha. "
        "En oleaje real fuera de punto de diseno, impulso puede dar mas energia anual "
        "pese a menor pico (Handbook cap.6, Cruz 2008)."
    )


# ── 3.4 Registro picos por parada subita / tope carrera ──


def registrar_picos(
    desplazamiento_m: object,
    limite_carrera_m: float,
    tiempo_s: object | None = None,
) -> dict[str, object]:
    """Detecta topes de carrera — picos de carga en paradas subitas."""
    import numpy as np  # import local para no contaminar nucleo

    z = np.asarray(desplazamiento_m, dtype=float)
    t = np.asarray(tiempo_s, dtype=float) if tiempo_s is not None else None
    mask = np.abs(z) >= float(limite_carrera_m)
    indices = np.where(mask)[0]
    picos = int(np.count_nonzero(mask))
    detalle: dict[str, object] = {
        "limite_carrera_m": float(limite_carrera_m),
        "n_picos": picos,
        "aviso": (
            "picos por tope de carrera / parada subita — carga excepcional "
            "(Handbook cap.1 §4.4 regla 4)"
            if picos
            else "sin topes"
        ),
    }
    if picos and t is not None and len(t) == len(z):
        detalle["tiempos_pico_s"] = t[indices].tolist()[:20]
    return detalle


# ── 3.5 Fluctuacion max/medio y conmutador nº flotadores ──


def ratio_fluctuacion(configuracion: str) -> tuple[float, float]:
    """Rango max/medio Handbook cap.1 tabla 3."""
    clave = configuracion.strip().lower()
    if clave not in RATIOS_FLUCTUACION:
        raise ValueError(f"configuracion desconocida: {configuracion}")
    return RATIOS_FLUCTUACION[clave]


def fluctuacion_por_n_flotadores(n: int, pto_bidireccional: bool = True) -> tuple[float, float]:
    """Conmutador nº flotadores — 1 cuerpo 10-12, 10 cuerpos 3-7."""
    if n <= 1:
        return RATIOS_FLUCTUACION[
            "bidireccional_1cuerpo" if pto_bidireccional else "unidireccional_1cuerpo"
        ]
    if n >= 10:
        return RATIOS_FLUCTUACION["10cuerpos_bidireccional"]
    # interpolacion lineal simple entre 1 y 10
    r1 = RATIOS_FLUCTUACION["bidireccional_1cuerpo"]
    r10 = RATIOS_FLUCTUACION["10cuerpos_bidireccional"]
    frac = (n - 1) / 9.0
    bajo = r1[0] + (r10[0] - r1[0]) * frac
    alto = r1[1] + (r10[1] - r1[1]) * frac
    return (float(bajo), float(alto))


# ── Strategy concreta intercambiable ──


@dataclass(frozen=True, slots=True)
class EstrategiaPTOTipo:
    tipo: str

    def aplicar(self, potencia_entrada_w: float) -> Eslabon:
        return crear_eslabon_pto(potencia_entrada_w, self.tipo)
