// Строка чек-листа: галочка, название, детали, дата, редактирование.
import { Check, Pencil } from "lucide-react";
import { DateBadge } from "./Bits";
import { daysUntil, relLabel } from "@/lib/dates";
import { updateItem } from "@/lib/store";
import type { SubjectItem } from "@/types";

export function ItemRow({
  subjectId,
  item,
  onEdit,
}: {
  subjectId: string;
  item: SubjectItem;
  onEdit: () => void;
}) {
  const toggle = () => updateItem(subjectId, item.id, { done: !item.done });

  const urgency = (() => {
    if (!item.date) return null;
    const n = daysUntil(item.date);
    if (item.done) return "ok" as const;
    if (n < 0) return "over" as const;
    if (n <= 7) return "soon" as const;
    return "ok" as const;
  })();

  return (
    <div className="hairline-b flex items-stretch">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={item.done}
        aria-label={item.done ? `Снять отметку: ${item.title}` : `Отметить выполненным: ${item.title}`}
        className="flex flex-1 items-start gap-3 py-3.5 pr-1 text-left cursor-pointer min-h-[56px]"
      >
        <span
          className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full transition-all duration-150"
          style={{
            background: item.done ? "var(--ok)" : "transparent",
            border: item.done ? "none" : "2px solid var(--ink-3)",
          }}
        >
          {item.done && <Check size={16} strokeWidth={3} color="var(--on-accent)" />}
        </span>
        <span className="flex-1 min-w-0">
          <span
            className="block text-[16px] leading-snug transition-colors"
            style={{
              color: item.done ? "var(--ink-3)" : "var(--ink)",
              textDecoration: item.done ? "line-through" : "none",
              textDecorationColor: "var(--ink-3)",
            }}
          >
            {item.title}
          </span>
          {item.details && (
            <span className="block mt-1 text-[13.5px] leading-snug" style={{ color: "var(--ink-3)" }}>
              {item.details}
            </span>
          )}
          {item.date && urgency && (
            <span className="inline-block mt-1.5">
              <DateBadge label={relLabel(item.date)} urgent={urgency} />
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Изменить: ${item.title}`}
        className="flex w-[44px] items-center justify-center cursor-pointer"
        style={{ color: "var(--ink-3)" }}
      >
        <Pencil size={17} />
      </button>
    </div>
  );
}
