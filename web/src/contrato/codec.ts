import type { ContratoPayload } from "./types";

export function validarContrato(payload: unknown): payload is ContratoPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p["parametros"] === "object" &&
    typeof p["resultado"] === "object" &&
    typeof p["series"] === "object" &&
    typeof p["formulas"] === "object" &&
    typeof p["progreso"] === "number"
  );
}

export function tamanoPayloadBytes(payload: unknown): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}
