// Синхронизация расписания с сайтом СГУ.
// Запускается раз в день через GitHub Actions (см. .github/workflows/sync-sgu.yml).
//
// Принцип: ТОЛЬКО ДОБАВЛЯТЬ НОВОЕ.
// - Новые пары и новые преподаватели с сайта добавляются в src/lib/seed.ts.
// - Всё, что уже есть в seed.ts, не перезаписывается и не удаляется.
// - Правки пользователей на их телефонах этот скрипт не трогает: он меняет
//   только начальные данные «по умолчанию», а локальные правки каждого
//   человека хранятся на его телефоне и накладываются поверх.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SGU_URL = "https://www.sgu.ru/schedule/fps/vo/111";

// Название предмета с сайта СГУ -> наше короткое имя.
const SUBJECT_MAP = {
  "Анатомия центральной нервной системы": "Анатомия",
  "Иностранный язык": "Английский",
  "История России": "История России",
  "Основы Российской государственности": "Основы государственности",
  "Профессиональная этика": "Профессиональная этика",
  "Психология искусства": "Психология искусства",
  "Введение в профессию": "Введение в профессию",
  "История культуры": "История культуры",
};

// Сокращённое ФИО с сайта -> полное имя (дополнять по мере появления новых).
const TEACHER_MAP = {
  "Мельников Е. Ю.": "Мельников Евгений Юрьевич",
  "Воронова Е. Н.": "Воронова Елена Николаевна",
  "Лазунина Е. А.": "Лазунина Екатерина Алексеевна",
  "Рягузова Е. В.": "Рягузова Елена Владимировна",
  "Салий А. С.": "Салий Анастасия Сергеевна",
  "Пантелеев А. Ф.": "Пантелеев Александр Фёдорович",
  "Смирнова А. Ю.": "Смирнова Анна Юрьевна",
  "Шрамкова О. В.": "Шрамкова Оксана Владимировна",
  "Каткова М. В.": "Каткова Маргарита Владимировна",
  "Зеленкина А. С.": "Зеленкина Алёна Сергеевна",
  "Захарова Е. Н.": "Захарова Е. Н.",
  "Ларионова Е. В.": "Ларионова Е. В.",
};

const clean = (s) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const toISO = (dmy) => {
  const m = dmy.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

// Разбор таблицы «Расписание занятий» с сайта СГУ.
function parseSgu(html) {
  // Не отрезаем «Расписание сессии»: эта фраза встречается в навигации раньше
  // самой таблицы. Просто разбираем все строки <tr> — лишних пар это не даст,
  // потому что мы ищем только строки с временем и ячейками пар.
  const rows = html.split("<tr>").slice(1);
  const pairs = [];

  for (const row of rows) {
    // Время строки: в <th> стоят «10:00 <br> 11:35».
    const th = row.match(/schedule-table__header'>\s*(\d{2}:\d{2})\s*<br>\s*(\d{2}:\d{2})/);
    if (!th) continue;
    const start = th[1];
    const end = th[2];

    // Ячейки дней (<td ...>), по порядку: Пн=1 ... Сб=6.
    const cells = row.split(/<td(?:\s[^>]*)?>/).slice(1);
    for (let ci = 0; ci < cells.length && ci < 6; ci++) {
      const day = ci + 1;
      const cell = cells[ci];

      // Каждая пара в ячейке — блок schedule-table__lesson.
      const lessons = cell.split('class="schedule-table__lesson"').slice(1);
      for (const les of lessons) {
        const subjectRaw = clean((les.match(/schedule-table__lesson-name'>([\s\S]*?)<\/div>/) || [])[1] || "");
        if (!subjectRaw) continue;
        const subject = SUBJECT_MAP[subjectRaw] || subjectRaw;

        const teacherRaw = clean((les.match(/schedule-table__lesson-teacher[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/) || [])[1] || "");
        const teacher = TEACHER_MAP[teacherRaw] || teacherRaw;

        const room = clean((les.match(/schedule-table__lesson-room[\s\S]*?<span>([\s\S]*?)<\/span>/) || [])[1] || "")
          .replace(" комната", "");

        const kind = /lesson-prop__lecture/.test(les) ? "лекция" : "практика";

        // Чётность: lesson-prop__num = «Ч» (числитель), lesson-prop__denom = «З» (знаменатель).
        const weekType = /lesson-prop__num/.test(les)
          ? "numerator"
          : /lesson-prop__denom/.test(les)
            ? "denominator"
            : "both";

        // Даты «с — по»: «12.09.2026 - 10.10.2026».
        const dateM = les.match(/lesson-date[\s\S]*?<span>([\s\S]*?)<\/span>/);
        let from, to;
        if (dateM) {
          const dm = clean(dateM[1]).match(/(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})/);
          if (dm) {
            from = toISO(dm[1]);
            to = toISO(dm[2]);
          }
        }

        pairs.push({ day, start, end, subject, kind, teacher, room, weekType, from, to });
      }
    }
  }
  return pairs;
}

// --- Основной код ---

const html = await fetch(SGU_URL, {
  headers: { "User-Agent": "Mozilla/5.0 (compatible; study-helper-sync)" },
}).then((r) => r.text());

const pairs = parseSgu(html);
console.log(`Прочитано с сайта СГУ: ${pairs.length} пар`);

const seedPath = fileURLToPath(new URL("../src/lib/seed.ts", import.meta.url));
let seed = readFileSync(seedPath, "utf8");

// Ключ существующей пары: день+время+предмет. Преподавателя и даты
// намеренно НЕ включаем: если пара уже есть в расписании, то даже с другим
// преподавателем или другими датами мы её не дублируем. Так избегаем дублей.
const existing = new Set();
for (const m of seed.matchAll(/e\((\d),\s*"(\d{2}:\d{2})",\s*"(\d{2}:\d{2})",\s*"([^"]+)"/g)) {
  existing.add(`${m[1]}|${m[2]}|${m[4]}`);
}

// Новые пары: которых нет в seed.ts по дню+времени+предмету.
// Дополнительно отсекаем пары без предмета и явные дубли внутри самой выгрузки.
const seen = new Set();
const fresh = pairs.filter((p) => {
  if (!p.subject.trim()) return false;
  const key = `${p.day}|${p.start}|${p.subject}`;
  if (existing.has(key)) return false;
  if (seen.has(key + "|" + p.weekType)) return false; // та же пара, другая чётность — не дублируем
  seen.add(key + "|" + p.weekType);
  return true;
});

if (fresh.length === 0) {
  console.log("Новых пар нет — seed.ts не менялся.");
  process.exit(0);
}

// Генерируем строки для вставки в seedSchedule().
const lines = fresh.map((p) => {
  const args = [
    p.day,
    `"${p.start}"`,
    `"${p.end}"`,
    `"${p.subject}"`,
    `"${p.kind}"`,
    `"${p.teacher}"`,
    `"${p.room}"`,
    `"${p.weekType}"`,
    p.from ? `"${p.from}"` : "undefined",
    p.to ? `"${p.to}"` : "undefined",
  ];
  return `    e(${args.join(", ")}),`;
});

// Вставляем перед закрывающей скобкой массива в seedSchedule().
const anchor = /(\n  \];\n\})/;
if (!anchor.test(seed)) {
  console.error("Не нашёл место вставки в seed.ts — прерываю.");
  process.exit(1);
}
seed = seed.replace(anchor, `\n    // Добавлено автосинхронизацией с сайта СГУ (${new Date().toISOString().slice(0, 10)})\n${lines.join("\n")}$1`);

// Предметы, по которым появились пары, но которых ещё нет в списке предметов.
// Пары и предмет всегда должны существовать вместе — иначе пара висит в
// расписании, а карточки предмета (с пунктами и пометками) у человека нет.
const existingSubjects = new Set(
  [...seed.matchAll(/name: "([^"]+)"/g)].map((m) => m[1])
);
const freshSubjects = [...new Set(fresh.map((p) => p.subject))].filter(
  (s) => !existingSubjects.has(s)
);
if (freshSubjects.length > 0) {
  const subjectBlocks = freshSubjects.map((name) => {
    const p = fresh.find((x) => x.subject === name);
    return `      {\n        id: id(),\n        name: "${name}",\n        teacher: "${p?.teacher ?? ""}",\n        notes: "",\n        items: [],\n      },`;
  });
  const subjAnchor = /(\n    \],\n  \};\n\})/;
  if (!subjAnchor.test(seed)) {
    console.error("Не нашёл место вставки предметов в seed.ts — прерываю.");
    process.exit(1);
  }
  seed = seed.replace(subjAnchor, `\n${subjectBlocks.join("\n")}$1`);
  console.log(`Добавлено новых предметов: ${freshSubjects.join(", ")}`);
}

// Если в расписании что-то изменилось — обязательно поднимаем SCHED_VERSION.
// Иначе новые пары увидят только те, кто установит приложение с нуля,
// а у уже пользующихся людей они не появятся.
if (!/export const SCHED_VERSION = (\d+);/.test(seed)) {
  console.error("Не нашёл SCHED_VERSION в seed.ts — прерываю.");
  process.exit(1);
}
seed = seed.replace(
  /export const SCHED_VERSION = (\d+);/,
  (_, n) => `export const SCHED_VERSION = ${Number(n) + 1};`
);
writeFileSync(seedPath, seed);
console.log("SCHED_VERSION поднят — новые пары доедут до всех, кто уже пользуется приложением.");

console.log(`Добавлено новых пар: ${fresh.length}`);
for (const p of fresh) console.log(`  + ${p.subject} | день ${p.day} | ${p.start} | ${p.teacher} | ${p.weekType}`);
