import { useState } from "react";
import { Plus, Mic } from "lucide-react";
import { Home } from "@/pages/Home";
import { Subjects } from "@/pages/Subjects";
import { Deadlines } from "@/pages/Deadlines";
import { Schedule } from "@/pages/Schedule";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { SubjectDetail } from "@/components/SubjectDetail";
import { ItemSheet } from "@/components/ItemSheet";
import { VoiceSheet } from "@/components/VoiceSheet";
import { useAppData } from "@/lib/store";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const d = useAppData();

  const openSubject = (id: string) => setOpenSubjectId(id);

  return (
    <div className="min-h-dvh" style={{ background: "var(--bg)" }}>
      {/* Рабочая колонка: на телефоне — во всю ширину, на компьютере — по центру */}
      <div className="mx-auto max-w-md min-h-dvh relative">
        <main className="pb-40">
          {tab === "home" && <Home onOpenSubject={openSubject} />}
          {tab === "schedule" && <Schedule />}
          {tab === "subjects" && <Subjects onOpenSubject={openSubject} />}
          {tab === "deadlines" && <Deadlines onOpenSubject={openSubject} />}
        </main>

        {/* Плавающие кнопки: голосовая команда + ручное добавление */}
        {d.subjects.length > 0 && !openSubjectId && (
          <>
            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              aria-label="Голосовая команда"
              className="fixed z-30 flex h-16 w-16 items-center justify-center rounded-full cursor-pointer transition-transform active:scale-95"
              style={{
                right: "max(1.25rem, calc(50vw - 14rem + 1.25rem))",
                bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "0 8px 24px -6px oklch(0.45 0.085 205 / 0.55)",
              }}
            >
              <Mic size={28} />
            </button>
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              aria-label="Добавить пункт вручную"
              className="fixed z-30 flex h-12 w-12 items-center justify-center rounded-full cursor-pointer transition-transform active:scale-95"
              style={{
                right: "max(1.5rem, calc(50vw - 14rem + 1.5rem))",
                bottom: "calc(10.5rem + env(safe-area-inset-bottom))",
                background: "var(--surface)",
                color: "var(--accent)",
                border: "1.5px solid var(--line)",
                boxShadow: "0 4px 14px -4px oklch(0.24 0.03 212 / 0.25)",
              }}
            >
              <Plus size={22} />
            </button>
          </>
        )}

        <BottomNav tab={tab} onChange={setTab} />

        {openSubjectId && (
          <SubjectDetail subjectId={openSubjectId} onClose={() => setOpenSubjectId(null)} />
        )}

        <ItemSheet
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          subjectId={null}
          editing={null}
          editingSubjectId={null}
        />

        <VoiceSheet open={voiceOpen} onClose={() => setVoiceOpen(false)} />
      </div>
    </div>
  );
}
