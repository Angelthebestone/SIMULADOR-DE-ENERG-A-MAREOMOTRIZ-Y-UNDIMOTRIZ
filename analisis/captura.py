"""Captura hidrodinamica — ancho, limites y optimizacion PTO (M2-M3).

Cubre:
- 4.2 ancho captura L=Pabs/J y limites lambda/2pi, 3lambda/2pi, Budal.
- 4.3 barrido Bpto con optimo y restriccion de carrera.
- 4.5 cota Falnes Pmax=|Fe|^2/(8B) y techos 50% simetrico / ~100% no sim.
- 4.6 Bpto_opt analitico sqrt(B^2 + [w(m+A)-Kh/w]^2) que reduce a B en resonancia.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from nucleo.constantes import RHO_AGUA_MAR, G
from nucleo.hidrodinamica import coeficientes, rigidez_hidrostatica
from nucleo.olas import densidad_potencia, longitud_onda


@dataclass(frozen=True, slots=True)
class LimitesCaptura:
    lambda_m: float
    l_heave_max_m: float
    l_combinado_max_m: float
    l_budal_m: float | None
    l_gobernante_m: float
    cual_gobierna: str
    detalle: str


@dataclass(frozen=True, slots=True)
class ResultadoBarrido:
    bpto_valores: np.ndarray
    potencia_w: np.ndarray
    bpto_optimo: float
    potencia_max_w: float
    bpto_optimo_analitico: float | None
    carrera_m: np.ndarray | None
    restringido_por_carrera: bool
    avisos: list[str]


@dataclass(frozen=True, slots=True)
class RespuestaPeriodo:
    """Curva de respuesta en periodo de la boya absorbente."""

    te_s: np.ndarray
    amplitud_m: np.ndarray
    potencia_w: np.ndarray
    omega_natural_rad_s: float
    te_resonante_s: float
    pico_interior: bool
    detalle: str


@dataclass(frozen=True, slots=True)
class CotaFalnes:
    p_abs_w: float
    p_max_w: float
    fe_n: float
    b_ns_m: float
    relacion_pabs_pmax: float
    techo_simetrico_w: float
    techo_nosimetrico_w: float
    j_kw_m: float
    l_captura_m: float
    fuente: str


def ancho_captura(p_abs_w: float, j_w_m: float) -> float:
    """L = Pabs / J  [m]."""
    if j_w_m <= 0:
        raise ValueError("J debe ser positivo")
    if p_abs_w < 0:
        raise ValueError("Pabs no puede ser negativa")
    return float(p_abs_w / j_w_m)


def _budal_ancho(
    diametro_m: float,
    carrera_m: float,
    hm0_m: float,
    lambda_m: float,
) -> float | None:
    """Limite Budal por volumen barrido.

    Aproximacion Falnes (2002) cap.5: volumen barrido S_w*carrera limita la
    potencia; ancho equivalente L_budal ~ pi * S_w * carrera / (a*lambda)
    con a=Hs/2 simplificado a pi*D*carrera/lambda como cota orden magnitud.
    Se declara como estimacion, no BEM.
    """
    if carrera_m <= 0 or lambda_m <= 0 or diametro_m <= 0:
        return None
    if hm0_m <= 0:
        return None
    area = math.pi * diametro_m * diametro_m / 4.0
    volumen_barrido = area * carrera_m
    amplitud_ola = hm0_m / 2.0
    if amplitud_ola == 0:
        return None
    # Cota Budal simplificada: L ~ pi * volumen_barrido / (amplitud * lambda)
    lb = math.pi * volumen_barrido / (amplitud_ola * lambda_m)
    return float(lb)


def limites_captura(
    te_s: float,
    hm0_m: float = 1.0,
    profundidad_m: float = 50.0,
    diametro_m: float = 10.0,
    carrera_m: float | None = None,
) -> LimitesCaptura:
    """Calcula limites teoricos de ancho de captura.

    - Arfada axisimetrica: lambda/2pi
    - Combinado arfada+deriva/cabeceo: 3lambda/2pi
    - Budal por volumen (si se da carrera)
    """
    if te_s <= 0:
        raise ValueError("Te debe ser positivo")
    omega = 2.0 * math.pi / te_s
    lam = longitud_onda(omega, profundidad_m, G)
    l_heave = lam / (2.0 * math.pi)
    l_comb = 3.0 * lam / (2.0 * math.pi)
    l_budal = None
    if carrera_m is not None:
        l_budal = _budal_ancho(diametro_m, carrera_m, hm0_m, lam)
    candidatos: list[tuple[str, float]] = [
        ("lambda/2pi arfada", l_heave),
        ("3lambda/2pi combinado", l_comb),
    ]
    if l_budal is not None:
        candidatos.append(("Budal volumen", l_budal))
    # Gobernante es el menor (mas restrictivo) entre los aplicables
    # Para arfada pura, gobernante real es min(l_heave, l_budal)
    comp = [("lambda/2pi arfada", l_heave)]
    if l_budal is not None:
        comp.append(("Budal volumen", l_budal))
    gobernante_nombre, gobernante_val = min(comp, key=lambda x: x[1])
    detalle = (
        f"lambda={lam:.1f}m; arfada max {l_heave:.1f}m, "
        f"combinado {l_comb:.1f}m"
        + (f", Budal {l_budal:.1f}m" if l_budal is not None else "")
        + f" — gobierna {gobernante_nombre} ({gobernante_val:.1f}m) en arfada."
    )
    return LimitesCaptura(
        lambda_m=lam,
        l_heave_max_m=l_heave,
        l_combinado_max_m=l_comb,
        l_budal_m=l_budal,
        l_gobernante_m=gobernante_val,
        cual_gobierna=gobernante_nombre,
        detalle=detalle,
    )


def bpto_optimo_analitico(
    omega_rad_s: float,
    masa_kg: float,
    diametro_m: float,
    kpto_n_m: float = 0.0,
) -> float:
    """Bpto_opt = sqrt(B^2 + [w(m+A)- (Kh+Kpto)/w]^2).

    En resonancia el corchete se anula y queda Bpto_opt = B.
    Fuente: Falnes (2002) cap.5, Handbook cap.1 M2.
    """
    if omega_rad_s <= 0:
        raise ValueError("omega debe ser positivo")
    coef = coeficientes(omega=omega_rad_s, diametro_m=diametro_m)
    b_rad = float(coef.amortiguamiento_ns_m[0])
    a_rad = float(coef.masa_anadida_kg[0])
    kh = rigidez_hidrostatica(diametro_m, RHO_AGUA_MAR, G)
    react = omega_rad_s * (masa_kg + a_rad) - (kh + kpto_n_m) / omega_rad_s
    return float(math.sqrt(b_rad * b_rad + react * react))


def cota_falnes(
    omega_rad_s: float,
    diametro_m: float,
    p_abs_w: float,
    hm0_m: float = 1.0,
    j_kw_m: float | None = None,
    te_s: float | None = None,
) -> CotaFalnes:
    """Cota superior Falnes Pmax=|Fe|^2/(8B) junto a Pabs medida.

    Techos 50% simetrico / ~100% no simetrico segun Handbook cap.1.
    """
    if omega_rad_s <= 0:
        raise ValueError("omega debe ser positivo")
    coef = coeficientes(omega=omega_rad_s, diametro_m=diametro_m, hm0=hm0_m)
    fe = float(coef.fuerza_excitacion_n_m[0])
    b_rad = float(coef.amortiguamiento_ns_m[0])
    if b_rad <= 0:
        raise ValueError("B debe ser positivo")
    p_max = fe * fe / (8.0 * b_rad)
    relacion = p_abs_w / p_max if p_max > 0 else 0.0
    techo_sim = 0.50 * p_max
    techo_nosim = 1.00 * p_max
    if j_kw_m is None and te_s is not None:
        j_kw_m = densidad_potencia(hm0_m, te_s)
    jv = float(j_kw_m) if j_kw_m is not None else 0.0
    lc = ancho_captura(p_abs_w, jv * 1000.0) if jv > 0 else 0.0
    return CotaFalnes(
        p_abs_w=float(p_abs_w),
        p_max_w=float(p_max),
        fe_n=fe,
        b_ns_m=b_rad,
        relacion_pabs_pmax=float(relacion),
        techo_simetrico_w=float(techo_sim),
        techo_nosimetrico_w=float(techo_nosim),
        j_kw_m=jv,
        l_captura_m=float(lc),
        fuente="Falnes (2002) Pmax=|Fe|^2/(8B); Handbook cap.1 §4.3 50% sim. / ~100% no sim.",
    )


def _potencia_lineal(
    omega: float, masa: float, diam: float, bpto: float, hm0: float, kpto: float = 0.0
) -> tuple[float, float]:
    """Potencia lineal P=0.5*Bpto*w^2*|zeta|^2 y amplitud zeta."""
    coef = coeficientes(omega=omega, diametro_m=diam, hm0=hm0)
    b_rad = float(coef.amortiguamiento_ns_m[0])
    a_rad = float(coef.masa_anadida_kg[0])
    fe = float(coef.fuerza_excitacion_n_m[0])
    kh = rigidez_hidrostatica(diam, RHO_AGUA_MAR, G)
    impedancia = complex(b_rad + bpto, omega * (masa + a_rad) - (kh + kpto) / omega)
    if abs(impedancia) == 0:
        return 0.0, 0.0
    zeta_amp = abs(fe / (complex(0, omega) * impedancia))
    p_media = 0.5 * bpto * (omega * zeta_amp) ** 2
    return float(p_media), float(zeta_amp)


def barrido_bpto(
    omega_rad_s: float,
    masa_kg: float,
    diametro_m: float,
    hm0_m: float = 1.0,
    bpto_rango: tuple[float, float] = (10_000, 500_000),
    n_puntos: int = 60,
    carrera_limite_m: float | None = None,
    kpto_n_m: float = 0.0,
) -> ResultadoBarrido:
    """Barrido de Bpto con optimo empirico y restriccion de carrera."""
    if omega_rad_s <= 0:
        raise ValueError("omega debe ser positivo")
    b_vals = np.linspace(bpto_rango[0], bpto_rango[1], n_puntos)
    pot = np.zeros_like(b_vals)
    amp = np.zeros_like(b_vals)
    for i, b in enumerate(b_vals):
        p, z = _potencia_lineal(omega_rad_s, masa_kg, diametro_m, float(b), hm0_m, kpto_n_m)
        pot[i] = p
        amp[i] = z
    idx_opt = int(np.argmax(pot))
    b_opt_emp = float(b_vals[idx_opt])
    p_max = float(pot[idx_opt])
    b_opt_ana = bpto_optimo_analitico(omega_rad_s, masa_kg, diametro_m, kpto_n_m)
    avisos: list[str] = []
    restringido = False
    if carrera_limite_m is not None:
        mask = amp <= carrera_limite_m
        if not np.any(mask):
            avisos.append(
                f"carrera {carrera_limite_m}m excedida en todo el barrido — necesita control"
            )
            restringido = True
        elif not mask[idx_opt]:
            # optimo empirico viola carrera: buscar mejor dentro de limite
            idx_c = int(np.argmax(pot * mask))
            b_opt_emp = float(b_vals[idx_c])
            p_max = float(pot[idx_c])
            avisos.append(
                f"optimo sin restriccion viola carrera {carrera_limite_m}m; optimo restringido Bpto={b_opt_emp:.0f}"
            )
            restringido = True
    # Comparar analitico vs empirico
    if abs(b_opt_ana - float(b_vals[idx_opt])) / max(b_opt_ana, 1.0) > 0.25:
        avisos.append("discrepancia >25% entre Bpto analitico y barrido — revisar ka o carrera")
    pot_rest = pot if carrera_limite_m is None else np.where(amp <= carrera_limite_m, pot, np.nan)
    _ = pot_rest  # reserva para grafico
    return ResultadoBarrido(
        bpto_valores=b_vals,
        potencia_w=pot,
        bpto_optimo=b_opt_emp,
        potencia_max_w=p_max,
        bpto_optimo_analitico=b_opt_ana,
        carrera_m=amp,
        restringido_por_carrera=restringido,
        avisos=avisos,
    )


def respuesta_periodo(
    masa_kg: float,
    diametro_m: float,
    hm0_m: float = 1.0,
    b_pto_ns_m: float = 80_000.0,
    k_pto_n_m: float = 0.0,
    te_rango: tuple[float, float] = (3.0, 18.0),
    n_puntos: int = 60,
) -> "RespuestaPeriodo":
    """Curva de respuesta en periodo Te de la boya absorbente.

    Modelo de 1 GDL con rigidez hidrostatica: el pico aparece cerca del
    periodo natural Tn = 2*pi*sqrt((m + a(omega))/Kh). Se barre en periodos
    sobre el rango declarado, y se declara si el maximo cae dentro del
    barrido o en uno de los bordes (caso monotono).
    """
    if masa_kg <= 0 or diametro_m <= 0:
        raise ValueError("masa y diametro deben ser positivos")
    kh = rigidez_hidrostatica(diametro_m)
    omega_n = math.sqrt(kh / masa_kg)
    tn_natural = 2.0 * math.pi / omega_n
    # El barrido se centra en Tn y se extiende a la mitad del ancho del
    # rango declarado. Si Tn esta claramente dentro, hay pico interior;
    # si esta claramente fuera (Tn < te_min o Tn > te_max + un margen),
    # la curva es monotona en todo el barrido.
    ancho = te_rango[1] - te_rango[0]
    margen = ancho / 2.0
    if tn_natural < te_rango[0] - margen * 0.1 or tn_natural > te_rango[1] + margen * 0.1:
        # Tn fuera: barrido monotono en el rango pedido
        te_min, te_max = te_rango
    else:
        # Tn dentro: centrar el barrido para capturar el pico
        te_min = max(te_rango[0], tn_natural - margen)
        te_max = min(te_rango[1], tn_natural + margen)
    te_vals = np.linspace(te_min, te_max, n_puntos)
    amp = np.zeros_like(te_vals)
    pot = np.zeros_like(te_vals)
    for i, te in enumerate(te_vals):
        omega = 2.0 * math.pi / te
        impedancia = complex(b_pto_ns_m, omega * masa_kg - kh / omega)
        if abs(impedancia) <= 0:
            continue
        amp[i] = (hm0_m / 2.0) / abs(impedancia)
        pot[i] = 0.5 * b_pto_ns_m * (omega * amp[i]) ** 2
    indice_pico = int(np.argmax(amp))
    amp_pico = float(amp[indice_pico])
    amp_borde_min = float(amp[0])
    amp_borde_max = float(amp[-1])
    # El pico se declara interior solo si la amplitud en el maximo es
    # notablemente mayor que en los extremos del barrido. Sin esa
    # prominencia, una resonancia debil o un Tn justo en el centro
    # producen curvas casi planas que se confunden con monotonias.
    # Factor 1.05 = 5% por encima de la media de los bordes.
    prominencia = amp_pico / max(0.5 * (amp_borde_min + amp_borde_max), 1e-30)
    pico_interior = (
        1 <= indice_pico <= len(te_vals) - 2
        and prominencia > 1.05
    )
    te_resonante = float(te_vals[indice_pico])
    if pico_interior:
        detalle = (
            f"pico interior en Te={te_resonante:.2f}s "
            f"(Tn natural={tn_natural:.2f}s, omega_n={omega_n:.3f} rad/s, prominencia {prominencia:.2f})"
        )
    else:
        detalle = (
            f"sin pico interior — amplitud monotona o sin prominencia, "
            f"maximo en Te={te_resonante:.2f}s, "
            f"Tn natural={tn_natural:.2f}s"
        )
    return RespuestaPeriodo(
        te_s=te_vals,
        amplitud_m=amp,
        potencia_w=pot,
        omega_natural_rad_s=omega_n,
        te_resonante_s=te_resonante,
        pico_interior=pico_interior,
        detalle=detalle,
    )

