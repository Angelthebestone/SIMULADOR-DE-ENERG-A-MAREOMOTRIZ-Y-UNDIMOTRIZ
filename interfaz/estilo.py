"""Paleta, tipografia y tratamiento de estados — sistema Laboratorio oceánico."""

from __future__ import annotations

PALETA: dict[str, str] = {
    "fondo": "#F2F2EF",
    "panel": "#FFFFFF",
    "tinta": "#172026",
    "tenue": "#5A636B",
    "borde": "#B8B8B2",
    "borde_suave": "#D6D6D1",
    "recurso": "#0072B2",
    "recurso_hover": "#0A8FD6",
    "captura": "#56B4E9",
    "pto": "#C07A00",
    "electrico": "#0A8F6A",
    "perdida": "#B85A8A",
    "acento": "#C94E1A",
    "acento_suave": "#FFF0E6",
    "foco": "#0072B2",
}

COLOR_SEMAFORO: dict[str, str] = {
    "verificado": "#0A8F6A",
    "inferido": "#C07A00",
    "pendiente": "#C94E1A",
}

SIMBOLO_SEMAFORO: dict[str, str] = {
    "verificado": "●",
    "inferido": "◐",
    "pendiente": "○",
}

TEXTO_PENDIENTE = "pendiente — sin fuente verificada, no entra al cálculo"
TEXTO_VACIO = "sin calcular todavía — mueve un control o pulsa Calcular"

BASE_PT = 11
TITULAR_PT = 20
GRUPO_PT = 11
TABLA_PT = 10
PEQUENO_PT = 9
SUSTENTACION_PT = 16


def semaforo_html(estado: str, texto: str) -> str:
    color = COLOR_SEMAFORO.get(estado, PALETA["tenue"])
    simbolo = SIMBOLO_SEMAFORO.get(estado, "·")
    return f'<span style="color:{color}">{simbolo} {estado}</span> — {texto}'


def hoja_estilos(sustentacion: bool = False) -> str:
    pt = SUSTENTACION_PT if sustentacion else BASE_PT
    pt_titular = int(TITULAR_PT * (1.45 if sustentacion else 1))
    pt_grupo = int(GRUPO_PT * (1.35 if sustentacion else 1))
    pt_tabla = int(TABLA_PT * (1.35 if sustentacion else 1))
    pt_peq = int(PEQUENO_PT * (1.35 if sustentacion else 1))
    return f"""
    QWidget {{
        background: {PALETA["fondo"]};
        color: {PALETA["tinta"]};
        font-family: "Segoe UI", "DejaVu Sans", sans-serif;
        font-size: {pt}pt;
    }}
    QLabel[papel="titular"] {{
        font-size: {pt_titular}pt;
        font-weight: 800;
        color: {PALETA["tinta"]};
        letter-spacing: -0.01em;
    }}
    QLabel[papel="subtitulo"] {{
        font-size: {pt_peq}pt;
        color: {PALETA["tenue"]};
        letter-spacing: 0.01em;
    }}
    QLabel[papel="tesis"] {{
        background: {PALETA["panel"]};
        border: 1px solid {PALETA["borde"]};
        border-left: 3px solid {PALETA["acento"]};
        border-radius: 6px;
        padding: {pt // 2}px {pt}px;
        font-size: {pt_peq}pt;
        color: {PALETA["tenue"]};
    }}
    QGroupBox {{
        background: {PALETA["panel"]};
        border: 1px solid {PALETA["borde"]};
        border-radius: 8px;
        margin-top: {pt_grupo + 8}px;
        padding: {pt}px {pt}px {pt + 2}px {pt}px;
    }}
    QGroupBox::title {{
        subcontrol-origin: margin;
        left: {pt}px;
        padding: 0 6px;
        font-size: {pt_grupo}pt;
        font-weight: 700;
        color: {PALETA["tinta"]};
        letter-spacing: 0.01em;
    }}
    QPushButton {{
        background: {PALETA["panel"]};
        border: 1px solid {PALETA["borde"]};
        border-radius: 6px;
        padding: {pt // 2 + 1}px {pt + 2}px;
        font-weight: 600;
    }}
    QPushButton:hover {{
        background: #EAF4FA;
        border-color: {PALETA["recurso"]};
    }}
    QPushButton:pressed {{
        background: {PALETA["recurso"]};
        color: white;
        border-color: {PALETA["recurso"]};
    }}
    QPushButton:checked {{
        background: {PALETA["recurso"]};
        color: white;
        border-color: {PALETA["recurso"]};
        font-weight: 700;
    }}
    QPushButton:checked:hover {{
        background: {PALETA["recurso_hover"]};
    }}
    QPushButton:disabled {{ color: {PALETA["tenue"]}; background: {PALETA["fondo"]}; border-color: {PALETA["borde_suave"]}; }}
    QPushButton:focus, QComboBox:focus, QDoubleSpinBox:focus, QSlider:focus, QCheckBox:focus {{
        border: 2px solid {PALETA["foco"]};
        border-radius: 6px;
    }}
    QComboBox {{
        background: {PALETA["panel"]};
        border: 1px solid {PALETA["borde"]};
        border-radius: 6px;
        padding: 4px 8px;
        min-width: 160px;
    }}
    QComboBox:hover {{ border-color: {PALETA["recurso"]}; }}
    QCheckBox::indicator {{ width: 16px; height: 16px; border: 1px solid {PALETA["borde"]}; border-radius: 3px; background: {PALETA["panel"]}; }}
    QCheckBox::indicator:checked {{ background: {PALETA["recurso"]}; border-color: {PALETA["recurso"]}; }}
    QSlider::groove:horizontal {{ height: 4px; background: {PALETA["borde_suave"]}; border-radius: 2px; }}
    QSlider::handle:horizontal {{ width: 18px; height: 18px; margin: -7px 0; border-radius: 9px; background: {PALETA["recurso"]}; border: 2px solid white; }}
    QSlider::handle:horizontal:hover {{ background: {PALETA["recurso_hover"]}; width: 20px; height: 20px; margin: -8px 0; }}
    QSlider::sub-page:horizontal {{ background: {PALETA["recurso"]}; border-radius: 2px; }}
    QDoubleSpinBox {{
        background: {PALETA["panel"]};
        border: 1px solid {PALETA["borde"]};
        border-radius: 6px;
        padding: 3px 6px;
        min-width: 110px;
    }}
    QDoubleSpinBox:hover {{ border-color: {PALETA["recurso"]}; }}
    QLabel[estado="pendiente"] {{
        color: {COLOR_SEMAFORO["pendiente"]};
        font-style: italic;
        border-left: 3px solid {COLOR_SEMAFORO["pendiente"]};
        padding-left: 8px;
        background: {PALETA["acento_suave"]};
        border-radius: 0 4px 4px 0;
    }}
    QLabel[estado="vacio"] {{
        color: {PALETA["tenue"]};
        font-style: italic;
        border: 1px dashed {PALETA["borde"]};
        border-radius: 6px;
        padding: {pt}px;
        background: {PALETA["fondo"]};
    }}
    QTabWidget::pane {{ border: 1px solid {PALETA["borde"]}; border-radius: 8px; background: {PALETA["panel"]}; margin-top: -1px; }}
    QTabBar::tab {{ background: {PALETA["fondo"]}; border: 1px solid {PALETA["borde"]}; border-bottom: none; padding: 7px 14px; margin-right: 2px; border-top-left-radius: 6px; border-top-right-radius: 6px; font-weight: 600; color: {PALETA["tenue"]}; }}
    QTabBar::tab:selected {{ background: {PALETA["panel"]}; color: {PALETA["tinta"]}; border-color: {PALETA["borde"]}; }}
    QTabBar::tab:hover:!selected {{ background: #EAF4FA; color: {PALETA["tinta"]}; }}
    QTableWidget {{ background: {PALETA["panel"]}; gridline-color: {PALETA["borde_suave"]}; font-size: {pt_tabla}pt; border: 1px solid {PALETA["borde"]}; border-radius: 6px; }}
    QTableWidget::item {{ padding: 5px 6px; }}
    QHeaderView::section {{ background: {PALETA["fondo"]}; padding: 6px 8px; border: none; border-bottom: 1px solid {PALETA["borde"]}; font-size: {pt_peq}pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: {PALETA["tenue"]}; }}
    QProgressBar {{ border: 1px solid {PALETA["borde"]}; border-radius: 6px; background: {PALETA["panel"]}; text-align: center; font-size: {pt_peq}pt; max-height: 14px; }}
    QProgressBar::chunk {{ background: {PALETA["recurso"]}; border-radius: 5px; }}
    QStatusBar {{ background: {PALETA["fondo"]}; border-top: 1px solid {PALETA["borde_suave"]}; font-size: {pt_peq}pt; color: {PALETA["tenue"]}; }}
    QStatusBar::item {{ border: none; }}
    """
