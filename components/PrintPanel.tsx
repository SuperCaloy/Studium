import type { ReviewerData } from "@/lib/types";

export default function PrintPanel({ reviewer }: { reviewer: ReviewerData }) {
  const s = reviewer.summary;
  return (
    <div id="print-area" className="hidden print:block">
      <div className="p-8 text-zinc-900">
        <header className="mb-6 border-b-2 border-zinc-900 pb-4">
          <h1 className="text-2xl font-bold">{s.title}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Study Reviewer · {s.docCount} document(s) ·{" "}
            {s.totalWords.toLocaleString()} words · ~{s.targetStudyMinutes} min
            study time
          </p>
        </header>

        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 text-lg font-bold">Executive Summary</h2>
          <p className="text-sm leading-relaxed">{s.overview}</p>
          {s.keyTakeaways.length > 0 && (
            <>
              <h3 className="mb-1 mt-3 text-sm font-bold">Key Takeaways</h3>
              <ul className="text-sm">
                {s.keyTakeaways.map((t, i) => (
                  <li key={i} className="mb-1">
                    • {t}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {reviewer.topics.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 text-lg font-bold">Topics</h2>
            {reviewer.topics.map((topic) => (
              <div
                key={topic.id}
                className="mb-4 break-inside-avoid rounded border border-zinc-300 p-4"
              >
                <h3 className="text-base font-bold">{topic.title}</h3>
                <p className="mt-1 text-sm">{topic.summary}</p>
                {topic.details.map((d) => (
                  <div key={d.id} className="mt-2">
                    <p className="text-sm font-semibold">{d.heading}</p>
                    <ul className="text-sm">
                      {d.points.map((p, i) => (
                        <li key={i} className="ml-3">
                          • {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}

        {reviewer.terms.length > 0 && (
          <section className="mb-6 break-inside-avoid">
            <h2 className="mb-3 text-lg font-bold">Terms & Definitions</h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-zinc-400 bg-zinc-100 px-3 py-2 text-left font-bold">
                    Term
                  </th>
                  <th className="border border-zinc-400 bg-zinc-100 px-3 py-2 text-left font-bold">
                    Definition
                  </th>
                </tr>
              </thead>
              <tbody>
                {reviewer.terms.map((t) => (
                  <tr key={t.id}>
                    <td className="border border-zinc-300 px-3 py-2 align-top font-semibold">
                      {t.term}
                    </td>
                    <td className="border border-zinc-300 px-3 py-2 align-top">
                      {t.definition}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {reviewer.quizBank.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-bold">Practice Quiz</h2>
            {reviewer.quizBank.map((q, i) => (
              <div key={q.id} className="mb-4 break-inside-avoid">
                <p className="text-sm font-bold">
                  {i + 1}. {q.question}
                  {q.type === "tf" && (
                    <span className="ml-1 font-normal italic text-zinc-500">
                      (True/False)
                    </span>
                  )}
                </p>
                <ul className="ml-4 mt-1 text-sm">
                  {q.options.map((opt, oi) => (
                    <li key={oi} className={oi === q.correctAnswerIndex ? "font-semibold" : ""}>
                      {String.fromCharCode(65 + oi)}. {opt}
                      {oi === q.correctAnswerIndex && "  ✓"}
                    </li>
                  ))}
                </ul>
                {q.explanation && (
                  <p className="mt-1 text-xs italic text-zinc-600">
                    {q.explanation}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        <footer className="mt-8 border-t border-zinc-300 pt-3 text-center text-xs text-zinc-500">
          Generated with Study Reviewer Generator · {new Date(reviewer.updatedAt).toLocaleDateString()}
        </footer>
      </div>
    </div>
  );
}
