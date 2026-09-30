/** Le voci libere non hanno un tipo salvato: si deduce dal valore. Una data (YYYY-MM-DD, come chiede il prompt di lettura) si modifica con il calendario, tutto il resto come testo. */
export type StructuredFieldInputType = "date" | "text";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function inferFieldInputType(value: string): StructuredFieldInputType {
  if (!ISO_DATE.test(value)) return "text";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? "text" : "date";
}
