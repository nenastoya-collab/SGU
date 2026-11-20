// Лист добавления / редактирования пункта (задание, доклад, экзамен…).
// Долгое нажатие бэкспейса подключается централизованно в Sheet (Bits.tsx).
import { useEffect, useMemo, useState } from "react";
import { Trash2, CalendarDays } from "lucide-react";
import { Sheet } from "./Bits";
import { addItem, updateItem, deleteItem, useAppData } from "@/lib/store";
import { parseRuDate, formatShort, formatShortYear, todayISO } from "@/lib/dates";
import { DatePicker } from "@/components/DatePicker";
import { findNextClass, classesForDate } from "@/lib/schedule";
import { addDays } from "@/lib/dates";
import type { SubjectItem } from "@/types";

export function ItemSheet({
  open,
  onClose,
  subjectId,
  editing,
  editingSubjectId,
}: {
  open: boolean;
  onClose: () => void;
  /** Предмет по умолчанию для нового пункта (null — предложить выбор). */
  subjectId: string | null;
  /** Редактируемый пункт (null = создаём). */
  editing: SubjectItem | null;
  /** Предмет, которому принадлежит редактируемый пункт. */
  editingSubjectId: string | null;
}) {
  const d = useAppData();

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dateText, setDateText] = useState("");
  const [calOpen, setCalOpen] = useState(false);
  const [pickedSubject, setPickedSubject] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setDetails(editing?.details ?? "");
      setDateText(editing?.date ? formatShort(editing.date) : "");
      setCalOpen(false);
      setPickedSubject(subjectId ?? editingSubjectId ?? null);
      setTried(false);
    }
  }, [open, editing, subjectId, editingSubjectId]);

  // Понимаем и «завтра», и формат вида «ср, 20 нояб.»
  const parsed = useMemo(() => {
    const t = dateText.trim();
    if (!t) return undefined; // даты нет — и не нужна
    const direct = parseRuDate(t);
    if (direct) return direct;
    const m = t.toLowerCase().match(/^[а-я]{2},\s*(.+)$/u);
    const viaShort = m ? parseRuDate(m[1]) : null;
    return viaShort ?? null; // null = не распознали
  }, [dateText]);

  const titleOk = title.trim().length > 0;
  const dateBad = dateText.trim().length > 0 && parsed === null;
  const targetSubject = editing ? editingSubjectId : pickedSubject;
  const canSave = titleOk && !dateBad && targetSubject !== null;

  // Чип «к ближайшей паре»: ближайшая будущая пара этого предмета из расписания
  const targetSubjectName = d.subjects.find((s) => s.id === targetSubject)?.name ?? null;
  const nearestClass = useMemo(
    () => (targetSubjectName ? findNextClass(d, targetSubjectName, todayISO()) : null),
    [d, targetSubjectName]
  );

  // Дни, когда у выбранного предмета есть пары (для подсветки в календаре) — на полгода вперёд
  const subjectDays = useMemo(() => {
    if (!targetSubjectName) return undefined;
    const set = new Set<string>();
    const q = targetSubjectName.toLowerCase();
    for (let i = 0; i < 183; i++) {
      const iso = addDays(todayISO(), i);
      if (classesForDate(d, iso).some((c) => c.subject.toLowerCase().includes(q) || q.includes(c.subject.toLowerCase()))) {
        set.add(iso);
      }
    }
    return set;
  }, [d, targetSubjectName]);

  const save = () => {
    setTried(true);
    if (!canSave || !targetSubject) return;
    const payload = {
      title: title.trim(),
      details: details.trim() || undefined,
      date: parsed || undefined,
    };
    if (editing && editingSubjectId) updateItem(editingSubjectId, editing.id, payload);
    else addItem(targetSubject, payload);
    onClose();
  };

  const remove = () => {
    if (editing && editingSubjectId) deleteItem(editingSubjectId, editing.id);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Изменить пункт" : "Новый пункт"}>
      <div className="flex flex-col gap-4">
        {!editing && !subjectId && d.subjects.length > 0 && (
          <div>
            <span className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
              Предмет
            </span>
            <div className="flex flex-wrap gap-2">
              {d.subjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="chip"
                  data-active={pickedSubject === s.id}
                  onClick={() => setPickedSubject(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>
            {tried && !pickedSubject && (
              <p className="mt-1 text-sm" style={{ color: "var(--danger)" }}>
                Выберите предмет
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="item-title" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
            Что нужно сделать
          </label>
          <textarea
            id="item-title"
            className="field min-h-[64px] resize-y"
            placeholder="Доклад, тест, экзамен…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={2}
          />
          {tried && !titleOk && (
            <p className="mt-1 text-sm" style={{ color: "var(--danger)" }}>
              Напишите, что за пункт
            </p>
          )}
        </div>

        <div>
          <label htmlFor="item-date" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
            Дата <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>(если есть)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="item-date"
              className="field tnum flex-1"
              placeholder="завтра, пятница, 20.11…"
              value={dateText}
              onChange={(e) => setDateText(e.target.value)}
              inputMode="text"
              autoComplete="off"
            />
            <button
              type="button"
              aria-label="Выбрать дату в календаре"
              onClick={() => setCalOpen((v) => !v)}
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl cursor-pointer transition-transform active:scale-95"
              style={{
                background: calOpen ? "var(--accent)" : "var(--surface-2)",
                color: calOpen ? "var(--on-accent)" : "var(--accent)",
              }}
            >
              <CalendarDays size={22} />
            </button>
          </div>
          {calOpen && (
            <div className="mt-2.5">
              <DatePicker
                highlight={subjectDays}
                onPick={(iso) => {
                  // День в прошлом — подставляем текст с годом, чтобы дата осталась точной
                  // (иначе «2 нояб.» без года понимается как ближайшее будущее и уезжает на +1 год).
                  setDateText(iso < todayISO() ? formatShortYear(iso) : formatShort(iso));
                  setCalOpen(false);
                }}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-2.5">
            {["завтра", "послезавтра", "суббота"].map((w) => (
              <button key={w} type="button" className="chip tnum" onClick={() => setDateText(w)}>
                {w}
              </button>
            ))}
            {nearestClass && (
              <button
                type="button"
                className="chip tnum"
                onClick={() => setDateText(formatShort(nearestClass.date))}
              >
                к ближайшей паре
              </button>
            )}
            {dateText.trim() && (
              <button type="button" className="chip" onClick={() => setDateText("")}>
                убрать дату
              </button>
            )}
          </div>
          {dateText.trim() && (
            <p className="mt-2 text-[15px] tnum" style={{ color: parsed ? "var(--accent)" : "var(--danger)" }}>
              {parsed ? `→ ${formatShort(parsed)}` : "Не понимаю дату — попробуйте «20.11» или «пятница»"}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="item-details" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
            Детали <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>(требования, почта — необязательно)</span>
          </label>
          <textarea
            id="item-details"
            className="field min-h-[96px] resize-y"
            placeholder="Например: отправить на почту преподавателю до вечера"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex gap-3 mt-2">
          {editing && (
            <button
              type="button"
              onClick={remove}
              aria-label="Удалить пункт"
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl cursor-pointer transition-transform active:scale-95"
              style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              <Trash2 size={20} />
            </button>
          )}
          <button type="button" className="btn-primary flex-1" onClick={save}>
            {editing ? "Сохранить" : "Добавить"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
