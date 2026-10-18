/** Un giorno di calendario (`YYYY-MM-DD`) a `days` giorni da oggi (negativo = nel passato), nel fuso locale. */
export function day(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Un istante (ISO) a `days` giorni da oggi, alle `hour` locali. */
export function at(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Un istante nel passato, per dare un'età ai contenuti (la data di aggiunta) invece di farli nascere tutti oggi. */
export function ago(days: number, hour = 9): string {
  return at(-days, hour);
}
