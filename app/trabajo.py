from __future__ import annotations

import threading
from collections.abc import Callable
from typing import Any

from nucleo.resultado import Resultado


class TrabajoSimulacion:
    """Compatibilidad con tests previos: el modulo expone alias `Trabajo`."""

    def __init__(
        self,
        funcion: Callable[[Callable[[int], None], threading.Event], Resultado | dict[str, Any]],
        on_progreso: Callable[[int], None] | None = None,
        on_resultado: Callable[[Resultado | dict[str, Any]], None] | None = None,
        on_error: Callable[[str], None] | None = None,
    ) -> None:
        self._funcion = funcion
        self._on_progreso = on_progreso
        self._on_resultado = on_resultado
        self._on_error = on_error
        self._cancelado = threading.Event()
        self._hilo: threading.Thread | None = None
        self._en_curso = False
        self._lock = threading.Lock()

    def iniciar(self) -> None:
        with self._lock:
            if self._en_curso:
                return
            self._cancelado.clear()
            self._en_curso = True
        hilo = threading.Thread(target=self._ejecutar, daemon=True)
        self._hilo = hilo
        hilo.start()

    def empezar(self) -> None:
        """Alias de `iniciar` para compatibilidad con tests."""
        self.iniciar()

    def _ejecutar(self) -> None:
        try:
            prog = self._envolver_progreso()
            res = self._funcion(prog, self._cancelado)
            if self._cancelado.is_set():
                return
            if self._on_resultado is not None:
                self._on_resultado(res)
        except Exception as exc:  # noqa: BLE001
            if self._cancelado.is_set():
                return
            if self._on_error is not None:
                self._on_error(str(exc))
        finally:
            with self._lock:
                self._en_curso = False

    def notificar_progreso(self, porcentaje: float) -> None:
        """Emite un progreso al callback configurado, validando el rango."""
        if self._on_progreso is None:
            return
        v = max(0, min(100, int(porcentaje)))
        self._on_progreso(v)

    def _envolver_progreso(self) -> Callable[[int], None]:
        def prog(valor: int) -> None:
            if self._cancelado.is_set():
                return
            v = max(0, min(100, int(valor)))
            if self._on_progreso is not None:
                self._on_progreso(v)

        return prog

    @property
    def estado(self) -> str:
        """Estado resumido: 'listo', 'cancelado', 'en curso' o 'error'."""
        if self._en_curso:
            return "en curso"
        if self._cancelado.is_set():
            return "cancelado"
        return "listo"

    def cancelar(self) -> None:
        self._cancelado.set()

    def esta_en_curso(self) -> bool:
        with self._lock:
            return self._en_curso

    def esperar(self, timeout: float | None = None) -> None:
        hilo = self._hilo
        if hilo is not None:
            hilo.join(timeout=timeout)


# Alias publico (los tests importan `Trabajo`)
Trabajo = TrabajoSimulacion
