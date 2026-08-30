"""Tarea 139 — Semaforo en las tres pantallas (Ver, Mapa, Disenar).

El semaforo de trazabilidad (verificado / inferido / pendiente) tiene que
verse igual en las tres pantallas donde aparece. Esto se verifica a nivel
de codigo: el origen unico de estilo (`web/src/styles/semaforo.css`) declara
los tres estados con sus glifos, y el resto del codigo los referencia con
los mismos tokens.
"""

from __future__ import annotations

import pathlib
import re


_RAIZ = pathlib.Path(__file__).resolve().parent.parent
_SEMAFORO_CSS = _RAIZ / "web" / "src" / "styles" / "semaforo.css"
_TOKENS_CSS = _RAIZ / "web" / "src" / "styles" / "tokens.css"
_MAIN_TS = _RAIZ / "web" / "src" / "main.ts"
_DISENAR = _RAIZ / "web" / "src" / "views" / "Disenar.vue"
_COMPARAR = _RAIZ / "web" / "src" / "views" / "Comparar.vue"
_MAPA_TS = _RAIZ / "web" / "src" / "map" / "mapa.ts"
_ESTADO_BLOQUE = _RAIZ / "web" / "src" / "components" / "EstadoBloque.vue"


def _leer(p: pathlib.Path) -> str:
    return p.read_text(encoding="utf-8")


def test_semaforo_declara_los_tres_estados_con_glifos() -> None:
    """semaforo.css declara verificado / inferido / pendiente con sus
    glifos circulares ● ◐ ○."""
    src = _leer(_SEMAFORO_CSS)
    # glifos en CSS via `::before { content: "..." }`
    assert 'content: "●"' in src, "semaforo.css no declara el glifo verificado"
    assert 'content: "◐"' in src, "semaforo.css no declara el glifo inferido"
    assert 'content: "○"' in src, "semaforo.css no declara el glifo pendiente"
    # clases CSS que mapean a cada estado
    for clase in ("semaforo--verificado", "semaforo--inferido", "semaforo--pendiente"):
        assert clase in src, f"semaforo.css no declara la clase {clase!r}"


def test_semaforo_declara_los_tokens_de_color_de_estado() -> None:
    """semaforo.css define `--conf-verificado`, `--conf-inferido`,
    `--conf-pendiente`."""
    src = _leer(_SEMAFORO_CSS)
    for token in ("--conf-verificado", "--conf-inferido", "--conf-pendiente"):
        assert token in src, f"semaforo.css no declara el token {token!r}"


def test_mapa_usa_los_mismos_tokens_que_el_semaforo() -> None:
    """`mapa.ts` lee los colores del estado desde los mismos tokens CSS."""
    mapa = _leer(_MAPA_TS)
    semaforo = _leer(_SEMAFORO_CSS)
    for token in ("--conf-verificado", "--conf-inferido", "--conf-pendiente"):
        # aparece en mapa.ts (consumidor) y en semaforo.css (origen)
        assert token in mapa, (
            f"mapa.ts no consume el token {token!r} — divergencia con semaforo"
        )
        assert token in semaforo, (
            f"semaforo.css no define el token {token!r}"
        )


def test_estado_bloque_consume_los_tokens_del_semaforo() -> None:
    """`EstadoBloque.vue` aplica los mismos colores al borde del bloque."""
    bloque = _leer(_ESTADO_BLOQUE)
    semaforo = _leer(_SEMAFORO_CSS)
    # al menos uno de los tokens de estado aparece en el estilo
    for token in ("--conf-verificado", "--conf-inferido", "--conf-pendiente"):
        if token in bloque:
            assert token in semaforo, (
                f"semaforo.css no define el token {token!r} que consume EstadoBloque"
            )
            return
    # si no aparece ninguno, falla explicitamente
    raise AssertionError(
        "EstadoBloque.vue no aplica ningun token --conf-* — diverge del semaforo"
    )


def test_disenar_consume_los_tokens_del_semaforo() -> None:
    """`Disenar.vue` aplica los mismos colores al borde del estado legal."""
    disenar = _leer(_DISENAR)
    semaforo = _leer(_SEMAFORO_CSS)
    # la regla de estado legal usa --conf-pendiente (descartado) y
    # --conf-inferido (restringido)
    for token in ("--conf-inferido", "--conf-pendiente"):
        assert token in disenar, (
            f"Disenar.vue no consume el token {token!r}"
        )
        assert token in semaforo, (
            f"semaforo.css no define el token {token!r}"
        )


def test_comparar_rinde_los_tres_estados_en_la_tabla() -> None:
    """`Comparar.vue` muestra los tres estados para Isla Fuerte."""
    src = _leer(_COMPARAR)
    # tres filas: verificado, inferido, inferido (las dos rejillas)
    assert "verificado" in src, "Comparar.vue no muestra estado verificado"
    assert "inferido" in src, "Comparar.vue no muestra estado inferido"
    assert "pendiente" in src, "Comparar.vue no muestra estado pendiente"


def test_semaforo_y_tokens_comparten_lienzo() -> None:
    """semaforo.css importa tokens.css — origen unico de estilo."""
    src = _leer(_SEMAFORO_CSS)
    assert "@import" in src and "tokens.css" in src, (
        "semaforo.css no importa tokens.css — los colores pueden diverger"
    )


def test_ningun_color_de_estado_es_rol_de_cadena() -> None:
    """Los vocabularios --conf-* y --rol-* son disjuntos (decision 17.2)."""
    semaforo = _leer(_SEMAFORO_CSS)
    # extraemos los valores de los tokens --conf-* y --rol-*
    rol_re = re.compile(r"--rol-([\w-]+):\s*([^;]+);")
    conf_re = re.compile(r"--conf-([\w-]+):\s*([^;]+);")
    roles = {k: v.strip() for k, v in rol_re.findall(semaforo)}
    confs = {k: v.strip() for k, v in conf_re.findall(semaforo)}
    assert roles, "no se encontro ningun --rol-* en semaforo.css"
    assert confs, "no se encontro ningun --conf-* en semaforo.css"
    comunes = set(roles) & set(confs)
    assert not comunes, (
        f"hay tokens con el mismo nombre en --rol-* y --conf-*: {sorted(comunes)}"
    )