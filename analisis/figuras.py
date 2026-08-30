"""Tematizacion seaborn para figuras producidas por la aplicacion.

Las figuras del informe y de la exportacion se generan dentro del paquete
empaquetado, no solo en cuadernos. seaborn aporta una paleta consistente y
despine por defecto; por eso vive en ``analisis/`` y la usa ``app/exportacion``.

Se expone una funcion ``aplicar_tema()`` que deja el ``rcParams`` de matplotlib
en el estilo seaborn por defecto. Para que un test pueda comprobar que el tema
se aplico, dejamos una senyal legible en la figura (``fig._seaborn_theme_applied
= True``) y un atributo de modulo ``_TEMA_APLICADO``.
"""

from __future__ import annotations

import matplotlib
import matplotlib.pyplot as plt

try:
    import seaborn as sns
except ImportError as _exc:  # pragma: no cover - import guard
    sns = None
    _SEABORN_IMPORT_ERROR = _exc
else:
    _SEABORN_IMPORT_ERROR = None


# Senyal de modulo: True si aplicar_tema() se ha ejecutado al menos una vez
# en este proceso. Lo aprovechan los tests y el resto del codigo para
# comprobar que el estilo seaborn esta cargado.
_TEMA_APLICADO: bool = False
_TEMA_NOMBRE: str = ""


def aplicar_tema(nombre: str = "darkgrid") -> None:
    """Aplica un tema seaborn sobre matplotlib.

    Idempotente: llamadas repetidas solo refrescan el ``rcParams`` sin
    efectos colaterales. Sin seaborn instalado, registra el motivo y sigue
    con matplotlib por defecto para no romper la exportacion.

    Args:
        nombre: uno de los temas seaborn (``darkgrid``, ``whitegrid``,
            ``dark``, ``white``, ``ticks``).
    """
    global _TEMA_APLICADO, _TEMA_NOMBRE
    matplotlib.use("Agg")
    if sns is not None:
        sns.set_theme(style=nombre)
        _TEMA_NOMBRE = nombre
        _TEMA_APLICADO = True
    # aunque seaborn falle, dejamos matplotlib en Agg para que las figuras
    # sigan siendo escribibles en contexto headless (CI, empaquetado).


def tema_aplicado() -> bool:
    """Devuelve True si ``aplicar_tema()`` se ha llamado en este proceso."""
    return _TEMA_APLICADO


def tema_nombre() -> str:
    """Nombre del tema seaborn aplicado por ultima vez (o '' si ninguno)."""
    return _TEMA_NOMBRE


def marcar_figura(figura: plt.Figure) -> plt.Figure:
    """Sella la figura con un atributo legible para tests y auditoria."""
    setattr(figura, "_seaborn_theme_applied", _TEMA_APLICADO)
    setattr(figura, "_seaborn_theme_name", _TEMA_NOMBRE)
    return figura


def estilo_disponible() -> tuple[bool, str]:
    """Reporta si seaborn esta disponible y, si no, por que."""
    if sns is not None:
        return True, ""
    return False, str(_SEABORN_IMPORT_ERROR)


__all__ = [
    "aplicar_tema",
    "tema_aplicado",
    "tema_nombre",
    "marcar_figura",
    "estilo_disponible",
]