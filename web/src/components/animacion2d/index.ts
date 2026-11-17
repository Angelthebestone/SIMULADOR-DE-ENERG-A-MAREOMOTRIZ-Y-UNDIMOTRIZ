// Capa 2D hiperrealista de dispositivos — re-exports.
// Cada módulo exporta una función de dibujo autocontenida (sin estado de
// AnimacionCanvas), alineada con las escenas 3D y documentacion/referencias/.
// Extensión .ts explícita para que node --experimental-strip-types (tests)
// pueda resolver los módulos; Vite los acepta igual.

export { dibujarGranja2D } from "./granja2d.ts";
export type { OptsGranja2D, Cimentacion2D } from "./granja2d.ts";

export { dibujarAbsorbedor2D } from "./absorbedor2d.ts";
export type { OptsAbsorbedor2D } from "./absorbedor2d.ts";

export { dibujarDique2D } from "./dique2d.ts";
export type { OptsDique2D } from "./dique2d.ts";
