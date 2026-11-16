// Лист добавления / редактирования предмета.
// Включает блок «Пары по расписанию»: список пар предмета и добавление пары
// через тот же редактор, что и во вкладке «Расписание».
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Sheet } from "./Bits";
import { addSubject, updateSubject, deleteSubject, useAppData } from "@/lib/store";
import { rangeLabel } from "@/lib/schedule";
import { EntryEditor, DAY_SHORT } from "@/pages/Schedule";
import type { Subject, ScheduleEntry } from "@/types";

const WEEK_LABEL: Record<ScheduleEntry["weekType"], string> = {
  both: "каждую неделю",
  numerator: "числитель",
  denominator: "знаменатель",
};

export function SubjectSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Subject | null;
}) {
  const d = useAppData();
  const [name, setName] = useState("");
  const [teacher, setTeacher] = useState("");
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState("");
  const [tried, setTried] = useState(false);
  // Новый предмет сохраняется сразу, чтобы к нему можно было добавить пары,
  // не закрывая окно.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryEditing, setEntryEditing] = useState<ScheduleEntry | null>(null);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setTeacher(editing?.teacher ?? "");
      setNote(editing?.note ?? "");
      setNotes(editing?.notes ?? "");
      setTried(false);
      setCreatedId(null);
      setCreatedName("");
      setEntryOpen(false);
      setEntryEditing(null);
    }
  }, [open, editing]);

  const nameOk = name.trim().length > 0;

  const save = () => {
    setTried(true);
    if (!nameOk) return;
    const payload = { name: name.trim(), teacher: teacher.trim(), note: note.trim(), notes: notes.trim() };
    if (editing) {
      updateSubject(editing.id, payload);
      onClose();
      return;
    }
    if (createdId) {
      // Предмет уже создан — досохраняем правки и закрываем.
      updateSubject(createdId, payload);
      onClose();
      return;
    }
    const id = addSubject(payload);
    setCreatedId(id);
    setCreatedName(payload.name);
  };

  const remove = () => {
    if (editing) deleteSubject(editing.id);
    onClose();
  };

  // Пары предмета ищем по названию (расписание хранит предмет по имени).
  const listName = editing ? editing.name : createdName;
  const myEntries =
    editing || createdId ? d.schedule.filter((e) => e.subject === listName) : [];

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={editing ? "Изменить предмет" : createdId ? "Предмет добавлен" : "Новый предмет"}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="subj-name" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
              Название предмета
            </label>
            <input
              id="subj-name"
              className="field"
              placeholder="Например: Анатомия"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {tried && !nameOk && (
              <p className="mt-1 text-sm" style={{ color: "var(--danger)" }}>
                Напишите название
              </p>
            )}
          </div>

          <div>
            <label htmlFor="subj-teacher" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
              Преподаватель <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>(необязательно)</span>
            </label>
            <input
              id="subj-teacher"
              className="field"
              placeholder="Иванова Мария Петровна"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="subj-note" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
              Пометка <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>(необязательно)</span>
            </label>
            <input
              id="subj-note"
              className="field"
              placeholder="Кафедра, направление…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="subj-notes" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
              Пометки <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>(что нужно для зачёта — необязательно)</span>
            </label>
            <textarea
              id="subj-notes"
              className="field min-h-[96px] resize-y"
              placeholder={"Например: зачёт ставится автоматом при всех закрытых докладах,\nпрезентации сдавать через старосту"}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {(editing || createdId) && (
            <div>
              <span className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
                Пары по расписанию
              </span>
              {createdId && !editing && (
                <p className="mb-2 text-[13px] font-medium" style={{ color: "var(--accent)" }}>
                  Предмет сохранён. Добавьте его пары ниже — или нажмите «Готово».
                </p>
              )}
              {myEntries.length > 0 && (
                <div className="card px-4 mb-2">
                  {myEntries.map((e) => (
                    <button
                      type="button"
                      key={e.id}
                      className="hairline-b flex w-full items-center gap-2 py-3 min-h-[48px] text-left cursor-pointer"
                      onClick={() => {
                        setEntryEditing(e);
                        setEntryOpen(true);
                      }}
                    >
                      <span className="tnum text-[14px] font-semibold shrink-0" style={{ color: "var(--ink)" }}>
                        {DAY_SHORT[e.day]}, {e.start}–{e.end}
                      </span>
                      <span className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>
                        {WEEK_LABEL[e.weekType]}
                        {rangeLabel(e) ? ` · ${rangeLabel(e)}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="chip"
                onClick={() => {
                  setEntryEditing(null);
                  setEntryOpen(true);
                }}
              >
                + Добавить пару
              </button>
              <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
                У пары задаются день, время, числитель/знаменатель и даты, с какого по какое
                число предмет идёт. Эти же пары видны во вкладке «Расписание».
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            {editing && (
              <button
                type="button"
                onClick={remove}
                aria-label="Удалить предмет"
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl cursor-pointer transition-transform active:scale-95"
                style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
              >
                <Trash2 size={20} />
              </button>
            )}
            <button type="button" className="btn-primary flex-1" onClick={save}>
              {editing ? "Сохранить" : createdId ? "Готово" : "Добавить"}
            </button>
          </div>
        </div>
      </Sheet>

      <EntryEditor
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        editing={entryEditing}
        presetDay={1}
        presetSubject={listName || undefined}
      />
    </>
  );
}
