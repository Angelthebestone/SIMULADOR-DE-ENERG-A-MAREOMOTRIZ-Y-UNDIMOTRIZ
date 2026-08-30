# -*- mode: python ; coding: utf-8 -*-
"""Spec de PyInstaller para el Simulador de Energia Marina.

Distribucion en forma de CARPETA (onedir), no de archivo unico autoextraible.
La decision D6 del diseno justifica esta eleccion: el archivo unico descomprime
a almacenamiento temporal en cada arranque y penaliza el primer arranque en la
sustentacion; la carpeta arranca inmediatamente y sigue sin exigir permisos de
administrador.

Contenido empaquetado:
- Codigo Python del nucleo, analisis, app e interfaz (interfaz queda
  versionada y la migra la fase 26; se incluye para que el binario siga siendo
  ejecutable hasta entonces).
- Datos estaticos: datos/ (manifiesto, sitios, dispositivos, oleaje, etc.).
- Cartografia: web/dist/ (resultado de `npm run build`), con MapLibre, KaTeX,
  ECharts y Plotly vendorizados; tipografias declaradas como pila del sistema.

Uso:
    cd web && npm ci && npm run build && cd ..
    pyinstaller pyinstaller.spec --clean --noconfirm

Produce dist/SimuladorEnergia/SimuladorEnergia.exe + dist/SimuladorEnergia/_internal/
"""

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules  # noqa: E402

# Bloque PyInstaller: configuracion declarativa.
a = Analysis(
    ['app/__main__.py'],
    pathex=[str(Path('.').resolve())],
    binaries=[],
    datas=[
        ('datos', 'datos'),
        ('web/dist', 'web/dist'),
    ],
    hiddenimports=collect_submodules('app'),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'PySide6',           # Capa anterior retirada (tarea 26).
        'matplotlib.tests',  # Tests y datos de ejemplo no entran al artefacto.
        'numpy.tests',
        'scipy.tests',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='SimuladorEnergia',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,        # GUI: sin consola en Windows.
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='SimuladorEnergia',
)