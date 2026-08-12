// Mapa de entidades que soportan modo offline: la ruta base de la API y
// cómo se llaman sus campos en las respuestas (ej. POST /citas responde
// { cita: {...} }, GET /citas responde { citas: [...] }).

export interface EntityConfig {
  base: string; // ej. "/citas"
  singular: string; // ej. "cita"
  plural: string; // ej. "citas"
}

export const OFFLINE_ENTITIES: EntityConfig[] = [
  { base: "/citas", singular: "cita", plural: "citas" },
  { base: "/gastos", singular: "gasto", plural: "gastos" },
  { base: "/ingresos", singular: "ingreso", plural: "ingresos" },
  { base: "/clientes", singular: "cliente", plural: "clientes" },
  { base: "/insumos", singular: "insumo", plural: "insumos" },
];

export function matchEntity(url: string): EntityConfig | null {
  // url puede venir con query string o con /:id al final, quitamos ambos
  const clean = url.split("?")[0];
  for (const cfg of OFFLINE_ENTITIES) {
    if (clean === cfg.base || clean.startsWith(cfg.base + "/")) {
      return cfg;
    }
  }
  return null;
}

export function extractId(url: string, base: string): string | null {
  const clean = url.split("?")[0];
  const rest = clean.slice(base.length).replace(/^\//, "");
  // evita capturar subrutas como /citas/stats/resumen como si fueran un id
  if (!rest || rest.includes("/")) return null;
  return rest;
}
