"""Economia — LCOE, comparador diesel/SIN, repago y masa/potencia (M10).

- 5.5 LCOE por MWh desde CAPEX, OPEX, vida y descuento.
- 5.6 diesel ZNI exige localidad/operador/periodo, sino pendiente.
- 5.7 SIN como intervalo 628-659 COP/kWh, no punto 686.
- 5.8 repago por tamano — multiplicar pequenas no reparte base.
- 5.9 masa/potencia con advertencia lastre vs estructura.
"""

from __future__ import annotations

from dataclasses import dataclass

# Isla Fuerte — diesel ZNI
DIESEL_ISLA_FUERTE_COP_KWH: float = 1000.5
DIESEL_FUENTE: str = "Superservicios SOLING DEL SINU 5cvc-m38t ene-jun 2023 (GM+DM+CM)"
DIESEL_OPERADOR: str = "SOLING DEL SINU S.A.S. E.S.P."
DIESEL_PERIODO: str = "2023-01 a 2023-06"
DIESEL_LOCALIDAD: str = "Isla Fuerte (Bolivar)"
DIESEL_AVISO_TECNOLOGIA: str = (
    "codigos 1 y 10 en tipo_tecnologia sin tabla de referencia verificada; "
    "asumido diesel por continuidad planta — ver doc/fuentes_datos_economicos.md"
)

# SIN — intervalo, no punto
SIN_MIN_COP_KWH: float = 628.0
SIN_MAX_COP_KWH: float = 659.0
SIN_PUNTO_DESCARTADO: float = 686.0
SIN_FUENTE: str = (
    "Superservicios td8k-vhq9 2023 — 628 todos, 659 solo 2023 declarado (doc/fuentes_datos_economicos.md)"
)

# Referencias Handbook
CAPEX_BASE_36MW_EUR: float = 6_000_000.0
CAPEX_BASE_750KW_EUR: float = 2_000_000.0
CAPEX_EU_OFFSHORE_EUR_MW: float = 4_000_000.0


@dataclass(frozen=True, slots=True)
class ResultadoLCOE:
    lcoe_cop_mwh: float
    lcoe_eur_mwh: float | None
    capex_cop: float
    opex_anual_cop: float
    aep_mwh: float
    vida_anos: int
    tasa_descuento: float
    factor_recuperacion: float
    detalle: str


@dataclass(frozen=True, slots=True)
class ComparadorDiesel:
    localidad: str
    operador: str
    periodo: str
    diesel_cop_kwh: float
    lcoe_cop_kwh: float
    relacion_lcoe_diesel: float
    veredicto: str
    estado: str
    fuente: str
    avisos: list[str]


@dataclass(frozen=True, slots=True)
class IntervaloSIN:
    minimo_cop_kwh: float
    maximo_cop_kwh: float
    lcoe_cop_kwh: float
    dentro_intervalo: bool
    posicion_relativa: str
    fuente: str


@dataclass(frozen=True, slots=True)
class RepagoCAPEX:
    capex_base_cop: float
    capex_total_cop: float
    potencia_kw: float
    aep_mwh: float
    precio_venta_cop_kwh: float
    ingreso_anual_cop: float
    anos_repago_base: float
    anos_repago_total: float
    multiplica_unidades: str
    fuente: str


@dataclass(frozen=True, slots=True)
class MasaPotencia:
    masa_t: float
    potencia_kw: float
    ratio_t_kw: float
    advertencia: str
    referencia_eolica_t_kw: str


def _crf(tasa: float, vida: int) -> float:
    if tasa == 0:
        return 1.0 / vida
    return tasa * (1 + tasa) ** vida / ((1 + tasa) ** vida - 1)


def calcular_lcoe(
    capex_cop: float,
    opex_anual_cop: float,
    aep_mwh: float,
    vida_anos: int = 20,
    tasa_descuento: float = 0.08,
    eur_por_cop: float | None = None,
) -> ResultadoLCOE:
    """LCOE = (CAPEX*CRF + OPEX) / AEP  [COP/MWh]."""
    if capex_cop < 0 or opex_anual_cop < 0:
        raise ValueError("costes no negativos")
    if aep_mwh <= 0:
        raise ValueError("AEP debe ser positiva")
    if vida_anos <= 0:
        raise ValueError("vida positiva")
    crf = _crf(tasa_descuento, vida_anos)
    anualizado = capex_cop * crf + opex_anual_cop
    lcoe = anualizado / aep_mwh
    lcoe_eur = lcoe * eur_por_cop if eur_por_cop is not None else None
    detalle = f"LCOE=(CAPEX*CRF+OPEX)/AEP; CRF({tasa_descuento:.0%},{vida_anos}a)={crf:.4f}; {lcoe:.0f} COP/MWh"
    return ResultadoLCOE(
        lcoe_cop_mwh=float(lcoe),
        lcoe_eur_mwh=float(lcoe_eur) if lcoe_eur is not None else None,
        capex_cop=float(capex_cop),
        opex_anual_cop=float(opex_anual_cop),
        aep_mwh=float(aep_mwh),
        vida_anos=vida_anos,
        tasa_descuento=float(tasa_descuento),
        factor_recuperacion=float(crf),
        detalle=detalle,
    )


def comparador_diesel(
    lcoe_cop_mwh: float,
    localidad: str | None = None,
    operador: str | None = None,
    periodo: str | None = None,
    diesel_cop_kwh: float | None = None,
) -> ComparadorDiesel:
    """Exige localidad/operador/periodo; si falta alguno => pendiente (5.6)."""
    faltan: list[str] = []
    if not localidad:
        faltan.append("localidad")
    if not operador:
        faltan.append("operador")
    if not periodo:
        faltan.append("periodo")
    if faltan:
        estado = f"pendiente — falta {', '.join(faltan)} (5.6)"
        lcoe_kwh = lcoe_cop_mwh / 1000.0
        return ComparadorDiesel(
            localidad=localidad or "no indicada",
            operador=operador or "no indicado",
            periodo=periodo or "no indicado",
            diesel_cop_kwh=0.0,
            lcoe_cop_kwh=lcoe_kwh,
            relacion_lcoe_diesel=0.0,
            veredicto="pendiente — completar localidad/operador/periodo para comparar",
            estado=estado,
            fuente="pendiente",
            avisos=[
                f"falta {f} — no se puede afirmar competitividad sin trazabilidad" for f in faltan
            ],
        )
    d_kwh = float(diesel_cop_kwh) if diesel_cop_kwh is not None else DIESEL_ISLA_FUERTE_COP_KWH
    lcoe_kwh = lcoe_cop_mwh / 1000.0
    rel = lcoe_kwh / d_kwh if d_kwh else 0.0
    if rel < 1.0:
        veredicto = f"competitivo — LCOE {lcoe_kwh:.0f} < diesel {d_kwh:.0f} COP/kWh ({rel:.2f}x)"
    elif rel < 1.3:
        veredicto = f"marginal — LCOE {lcoe_kwh:.0f} vs diesel {d_kwh:.0f} ({rel:.2f}x)"
    else:
        veredicto = f"no competitivo — LCOE {lcoe_kwh:.0f} > diesel {d_kwh:.0f} ({rel:.2f}x)"
    fuente = DIESEL_FUENTE if diesel_cop_kwh is None else "valor aportado por llamante"
    avisos = [DIESEL_AVISO_TECNOLOGIA]
    estado = "verificado" if diesel_cop_kwh is None else "aportado"
    return ComparadorDiesel(
        localidad=localidad,
        operador=operador,
        periodo=periodo,
        diesel_cop_kwh=d_kwh,
        lcoe_cop_kwh=lcoe_kwh,
        relacion_lcoe_diesel=float(rel),
        veredicto=veredicto,
        estado=estado,
        fuente=fuente,
        avisos=avisos,
    )


def intervalo_sin(lcoe_cop_mwh: float) -> IntervaloSIN:
    """Compara LCOE contra intervalo SIN 628-659, nunca contra 686 puntual (5.7)."""
    lcoe_kwh = lcoe_cop_mwh / 1000.0
    dentro = SIN_MIN_COP_KWH <= lcoe_kwh <= SIN_MAX_COP_KWH
    if lcoe_kwh < SIN_MIN_COP_KWH:
        pos = f"por debajo del intervalo SIN ({SIN_MIN_COP_KWH:.0f}-{SIN_MAX_COP_KWH:.0f}) — competitivo vs red"
    elif dentro:
        pos = f"dentro del intervalo SIN {SIN_MIN_COP_KWH:.0f}-{SIN_MAX_COP_KWH:.0f} COP/kWh"
    else:
        pos = f"por encima del intervalo SIN ({SIN_MAX_COP_KWH:.0f}) — no competitivo vs red interconectada"
    pos += f" (686 puntual descartado; ver {SIN_FUENTE})"
    return IntervaloSIN(
        minimo_cop_kwh=SIN_MIN_COP_KWH,
        maximo_cop_kwh=SIN_MAX_COP_KWH,
        lcoe_cop_kwh=lcoe_kwh,
        dentro_intervalo=dentro,
        posicion_relativa=pos,
        fuente=SIN_FUENTE,
    )


def repago_capex(
    capex_base_cop: float,
    capex_total_cop: float,
    potencia_kw: float,
    aep_mwh: float,
    precio_venta_cop_kwh: float = DIESEL_ISLA_FUERTE_COP_KWH,
) -> RepagoCAPEX:
    """Anos para repagar CAPEX base y total; multiplica unidades no reparte base (5.8)."""
    if aep_mwh <= 0 or precio_venta_cop_kwh <= 0:
        raise ValueError("AEP y precio positivos")
    ingreso = aep_mwh * 1000.0 * precio_venta_cop_kwh
    anos_base = capex_base_cop / ingreso if ingreso else float("inf")
    anos_total = capex_total_cop / ingreso if ingreso else float("inf")
    nota_multi = (
        "Multiplicar unidades pequenas NO reparte CAPEX base (6M EUR para 3,6MW vs 2M EUR para 750kW "
        "Handbook): cada unidad replica coste base; escalar tamano, no numero, reduce anos de repago."
    )
    return RepagoCAPEX(
        capex_base_cop=float(capex_base_cop),
        capex_total_cop=float(capex_total_cop),
        potencia_kw=float(potencia_kw),
        aep_mwh=float(aep_mwh),
        precio_venta_cop_kwh=float(precio_venta_cop_kwh),
        ingreso_anual_cop=float(ingreso),
        anos_repago_base=float(anos_base),
        anos_repago_total=float(anos_total),
        multiplica_unidades=nota_multi,
        fuente="Handbook cap.1 §4.2 — 13 anos pequena vs 4 anos grande; base no se reparte",
    )


def masa_por_potencia(masa_t: float, potencia_kw: float) -> MasaPotencia:
    """t/kW con advertencia lastre vs estructura (5.9)."""
    if potencia_kw <= 0:
        raise ValueError("potencia positiva")
    ratio = masa_t / potencia_kw
    adv = (
        "Advertencia Handbook cap.1 §4.2: masa/potencia engana si no se separa "
        "lastre barato de estructura cara (factor 100). Eolica 0,1-0,2 t/kW es "
        "estructura; WEC con hormigon/lastre no comparable directo."
    )
    return MasaPotencia(
        masa_t=float(masa_t),
        potencia_kw=float(potencia_kw),
        ratio_t_kw=float(ratio),
        advertencia=adv,
        referencia_eolica_t_kw="0,1-0,2 t/kW (estructura eolica marina)",
    )
