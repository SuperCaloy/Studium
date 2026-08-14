import type { ReviewerData } from "@/lib/types";

export default function PrintPanel({ reviewer }: { reviewer: ReviewerData }) {
  const s = reviewer.summary;
  const sections: { title: string; el: React.ReactNode }[] = [];

  sections.push({
    title: "Executive Summary",
    el: (
      <>
        <p className="sr-topic-summary">{s.overview}</p>
        {s.keyTakeaways.length > 0 && (
          <div className="sr-callout">
            <h3>Key Takeaways</h3>
            <ul>
              {s.keyTakeaways.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </>
    ),
  });

  if (reviewer.topics.length > 0) {
    sections.push({
      title: "Topics",
      el: (
        <>
          {reviewer.topics.map((topic, ti) => (
            <div key={topic.id} className="sr-topic">
              <p className="sr-topic-label">Topic {ti + 1}</p>
              <h3 className="sr-topic-title">{topic.title}</h3>
              <p className="sr-topic-summary">{topic.summary}</p>
              {topic.details.map((d) => (
                <div key={d.id} className="sr-detail">
                  <p className="sr-detail-head">{d.heading}</p>
                  <ul className="sr-detail-points">
                    {d.points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </>
      ),
    });
  }

  if (reviewer.terms.length > 0) {
    sections.push({
      title: "Terms & Definitions",
      el: (
        <table className="sr-table">
          <thead>
            <tr>
              <th style={{ width: "30%" }}>Term</th>
              <th>Definition</th>
            </tr>
          </thead>
          <tbody>
            {reviewer.terms.map((t) => (
              <tr key={t.id}>
                <td className="sr-term">{t.term}</td>
                <td>{t.definition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    });
  }

  if ((reviewer.facts ?? []).length > 0) {
    sections.push({
      title: "Key Facts & Formulas",
      el: (
        <table className="sr-table">
          <thead>
            <tr>
              <th style={{ width: "38%" }}>Formula / Fact</th>
              <th>Context</th>
            </tr>
          </thead>
          <tbody>
            {reviewer.facts.map((f, i) => (
              <tr key={i}>
                <td className="sr-term">{f.formula}</td>
                <td>{f.context || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    });
  }

  const date = new Date(reviewer.updatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="sr-panel">
      <header className="sr-doc-head">
        <span className="sr-doc-title-src" aria-hidden="true">
          {s.title}
        </span>
        <p className="sr-doc-meta">
          Study Reviewer &middot; {date} &middot; {s.docCount}{" "}
          {s.docCount === 1 ? "document" : "documents"} &middot;{" "}
          {s.totalWords.toLocaleString()} words
        </p>
        <span className="rule" />
      </header>

      {sections.map((sec) => (
        <section key={sec.title} className="sr-section">
          <div className="sr-section-heading">
            <h2>{sec.title}</h2>
            <span className="rule" />
          </div>
          {sec.el}
        </section>
      ))}
    </div>
  );
}
