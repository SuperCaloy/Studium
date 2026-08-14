import { buildQuiz } from "../lib/reviewer-generator.ts";

const terms = [
  { id: "t1", term: "Software Testing", definition: "The process of evaluating and verifying that a software application meets its specified requirements and works as intended." },
  { id: "t2", term: "Verification", definition: "Activities that ensure the software performs correctly according to its design and specifications." },
  { id: "t3", term: "Regression Testing", definition: "Re-executes previously passed tests to ensure new changes do not adversely affect existing functionality." },
  { id: "t4", term: "pytest", definition: "A testing framework for Python applications." },
];

const topics = [
  {
    id: "tp1",
    title: "Test Execution",
    summary: "The phase where test cases are executed and results are recorded.",
    details: [{ id: "tp1d1", heading: "Purpose", points: ["Execute test cases.", "Record results and report defects."] }],
  },
  {
    id: "tp2",
    title: "Test Closure",
    summary: "The phase where testing results are evaluated and lessons learned are documented.",
    details: [{ id: "tp2d1", heading: "Activities", points: ["Evaluate testing results.", "Prepare the closure report."] }],
  },
];

const messyText = `PAMANTASAN NG CABUYAO | SOFTWARE ENGINEERING 2 4
STUDY REVIEWER
Lesson 1: Software Testing
Test Execution Purpose
• Execute test cases.
• Record results.
Typical pytest statuses:
• New
• Assigned
• Reopened
7. Test Closure
Responses are not somewhat organized but lack clarity or sufficient explanation.
The use of software tools and scripts to execute tests automatically.
Correctly identifies appropriate testing types with strong justification (8 pts)
8. Examples: SQL Injection Cross - Site Scripting (XSS) Authentication flaws
The process of evaluating and verifying that a software application meets its specified requirements and works as intended.`;

const quiz = buildQuiz(terms, topics, messyText, 40);
const tf = quiz.filter((q) => q.type === "tf");
let fail = 0;
for (const q of tf) {
  const t = q.question;
  const issues: string[] = [];
  if (/[•●◦]|\|/.test(t)) issues.push("bullet/pipe");
  if (/PAMANTASAN|CABUYAO|STUDY REVIEWER/i.test(t)) issues.push("header");
  if (/^\d+[\.\)]\s|(?:^|\s)\d+[\.\)]\s*$/.test(t)) issues.push("stray number");
  if (/Responses are|strong justification|\(8 pts\)/i.test(t)) issues.push("rubric");
  if (/does not use of|does not create test data/i.test(t)) issues.push("broken negation");
  if (/T ests|S tudy|C lass/i.test(t)) issues.push("spaced word");
  if (issues.length) {
    fail++;
    console.log("ISSUE:", issues.join(","), "->", t);
  }
}
const broken = tf.filter((q) => /does not use of/i.test(q.question)).length;
console.log(`TF questions: ${tf.length} / total ${quiz.length}`);
console.log(`flagged: ${fail}, broken-negation: ${broken}`);
console.log(fail === 0 && broken === 0 ? "CLEAN" : "DIRTY");
process.exit(fail === 0 && broken === 0 ? 0 : 1);