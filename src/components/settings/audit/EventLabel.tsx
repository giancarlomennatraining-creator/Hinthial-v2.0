import { describeAuditEvent } from "@/domain/audit/labels";
import type { AuditEventListItem } from "@/domain/audit/types";

export function EventLabel({
  event,
  fieldLabels,
}: {
  event: AuditEventListItem;
  fieldLabels: Record<string, string>;
}) {
  const { label, detail } = describeAuditEvent(event, fieldLabels);
  return (
    <>
      {label}
      {detail ? <span className="text-zinc-500 dark:text-zinc-400"> · {detail}</span> : null}
    </>
  );
}
