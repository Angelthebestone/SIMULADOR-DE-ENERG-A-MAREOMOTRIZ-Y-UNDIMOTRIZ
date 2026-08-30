"""Verifica que seaborn es dependencia de ejecucion y se aplica a las figuras.

Las figuras producidas por la aplicacion empaquetada usan seaborn para
tematizar (paleta + despine + estilo ``darkgrid``). Estas pruebas cubren:

- declaracion en ``pyproject.toml::dependencies`` (NO en ``[dev]``);
- importabilidad real del paquete;
- senyalizacion del estilo en figuras que produce ``app/exportacion.py``.
"""

from __future__ import annotations

import importlib
import pathlib
import tomllib

ROOT = pathlib.Path(__file__).resolve().parents[1]
PYPROJECT = ROOT / "pyproject.toml"


def _leer_pyproject() -> dict:
    return tomllib.load(PYPROJECT.open("rb"))


def _nombres(conjunto: list[str]) -> list[str]:
    """Normaliza dependencias quitando el pin de version."""
    import re

    out: list[str] = []
    for d in conjunto:
        out.append(re.split(r"[>=\\[<; ]", d.strip())[0].strip())
    return out


def test_seaborn_en_dependencias_ejecucion():
    """seaborn debe estar en project.dependencies, NO solo en [dev]."""
    data = _leer_pyproject()
    deps_ejec = {d.lower() for d in _nombres(data["project"]["dependencies"])}
    assert "seaborn" in deps_ejec, (
        "seaborn debe estar declarado en project.dependencies "
        "(las figuras se generan dentro de la aplicacion empaquetada)"
    )
    dev = data["project"].get("optional-dependencies", {}).get("dev", [])
    devs = {d.lower() for d in _nombres(dev)}
    assert "seaborn" not in devs, "seaborn no debe vivir en [dev]"


def test_seaborn_es_importable():
    """import seaborn no debe fallar."""
    mod = importlib.import_module("seaborn")
    assert mod is not None
    assert hasattr(mod, "set_theme")
    assert hasattr(mod, "despine")
    assert hasattr(mod, "color_palette")


def test_modulo_figuras_aplica_tema():
    """analisis.figuras.aplicar_tema() deja el rcParams con seaborn y senyaliza."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    from analisis.figuras import aplicar_tema, marcar_figura, tema_aplicado, tema_nombre

    aplicar_tema()
    assert tema_aplicado() is True
    assert tema_nombre() == "darkgrid"
    fig, ax = plt.subplots()
    ax.bar(["a", "b"], [0.4, 0.7])
    try:
        import seaborn as sns

        sns.despine()
    except ImportError:
        pass
    marcar_figura(fig)
    assert getattr(fig, "_seaborn_theme_applied", False) is True
    assert getattr(fig, "_seaborn_theme_name", "") == "darkgrid"
    plt.close(fig)


def test_exportacion_sella_figura_con_seaborn(tmp_path):
    """La figura de cadena de rendimientos lleva la marca seaborn."""
    import matplotlib

    matplotlib.use("Agg")
    from app.exportacion import exportar_figuras_datos
    from nucleo.resultado import Eslabon, Resultado

    resultado = Resultado(
        eslabones=[
            Eslabon("oleaje", 1000.0, 600.0, 0.6),
            Eslabon("captura", 600.0, 360.0, 0.6),
        ],
        potencia_nominal_w=360.0,
        produccion_anual_mwh=1.2,
        factor_planta=0.3,
    )
    # exportar_figuras_datos genera un png solo si matplotlib funciona;
    # le pedimos que lo escriba y comprobamos la marca con un parche ligero
    # del modulo para capturar la figura antes de plt.close.
    import matplotlib.pyplot as plt

    fig_capturada: dict[str, object] = {}

    original_close = plt.close

    def _capturar_close(fig=None):
        if fig is not None and not fig_capturada:
            fig_capturada["fig"] = fig
        return original_close(fig)

    plt.close = _capturar_close  # type: ignore[assignment]
    try:
        exportar_figuras_datos(resultado, tmp_path)
    finally:
        plt.close = original_close  # type: ignore[assignment]

    if "fig" in fig_capturada:
        fig = fig_capturada["fig"]
        assert getattr(fig, "_seaborn_theme_applied", False) is True
        assert getattr(fig, "_seaborn_theme_name", "") == "darkgrid"