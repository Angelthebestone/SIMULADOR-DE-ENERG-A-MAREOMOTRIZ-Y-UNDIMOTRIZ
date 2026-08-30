export type EstadoDato = "verificado" | "inferido" | "pendiente";

export type DatoRecurso = {
  valor: number;
  unidad: string;
  fuente: string;
  estado: EstadoDato;
};

export type SeriesMeta = {
  forma: number[];
  dtype: "float64";
  techo_bytes: number;
};

export type ContratoPayload = {
  parametros: Record<string, unknown>;
  resultado: {
    recurso: Record<string, DatoRecurso | number | string>;
    eslabones: Array<{
      nombre: string;
      potencia_entrada_w: number;
      potencia_salida_w: number;
      rendimiento: number;
      detalle: Record<string, unknown>;
    }>;
    potencia_nominal_w: number;
    produccion_anual_mwh: number;
    factor_planta: number;
    disponibilidad: number;
    horas_ano: number;
    avisos: string[];
    metadatos: Record<string, unknown>;
    series: Record<string, number[]>;
    series_meta: Record<string, SeriesMeta>;
    series_codificacion: { tipo: string; forma: string; dtype: string };
    techo_bytes: number;
    payload_bytes: number;
    truncado?: boolean;
  };
  series: Record<string, number[]>;
  series_meta: Record<string, SeriesMeta>;
  formulas: Record<string, { expresion: string; sustitucion: string; resultado: string; valor: number }>;
  progreso: number;
  error: string | null;
  cancelado: boolean;
  payload_bytes: number;
};
