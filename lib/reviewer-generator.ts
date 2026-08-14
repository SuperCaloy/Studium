import type {
  ExtractedDocument,
  ExecutiveSummary,
  Fact,
  QuizQuestion,
  ReviewerData,
  TermDefinition,
  TopicAccordion,
  TopicDetail,
} from "./types";
import { REVIEWER_SCHEMA_VERSION } from "./types";

const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been being before below between both but by can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too until under up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves ang mga ng sa ay ito iyon nito natin ninyo at ngunit subalit dahil kung o kaya para upang mula may wala hindi bilang naman din pa na raw daw tulad kaysa kapag nang sino ano alin ikaw ako kami sila tayo kayo si sina meron mayroon kasi baka lang po ho`.split(
    /\s+/
  )
);

const JUNK_TERMS = new Set(
  `this these those it its they their them that which who whom what when where why how then also often thus however therefore there here all most some many much other each both every either neither one two first second third next last finally because although while after before during through without within between among across because but or so if since then when where why can may must will would could should might shall such very just only even more most less least do does did done making made make state states part parts way ways case cases point points time times number numbers type types form forms kind kinds process processes method methods system systems theory theories model models concept concepts idea ideas role roles function functions level levels group groups class classes unit units section sections term terms key concept principle principle principles law laws rule rules result results effect effects factor factors area areas example examples question questions chapter chapters introduction conclusion summary overview glossary references appendix objectives biology cellular plants plant organisms organism organelles prokaryotic prokaryotes eukaryotic eukaryotes fermentation respiration photosynthesis contents outcomes pretest posttest discussion learning retrieved bibliography reference sources figure table module minutes resources calculator whiteboard available today following numbers use used following resources required lessons lessons outcomes title page index copyright doi url isbn edu ph www com journal edition publishing published print paperback authors author research retrieved statistics engineering mathematics science applications consider hence think write value divide division power represent convert conversion translate demonstration illustrate illustration applications following shown below above described stating states continues continued particular related relating various include includes including included require requires required involve involves involved describe describes describing used uses using`.split(
    /\s+/
  )
);

const CODING_TERMS = new Set(
  `loop array syntax variable compiler algorithm recursion debug debugging object method api database framework library parameter return string integer boolean tuple dictionary module import export closure callback promise async await thread cache buffer pointer stack queue heap node server client query schema deploy test unit constant declaration assignment operator operand expression statement runtime compile interpret execution memory storage input output component state props hook react angular vue python javascript typescript java cpp csharp html css sql git linux windows function class interface function function function variable constant algorithm bug error exception handling concurrency parallel distributed networking protocol url http https tcp ip encryption hash salt token authentication authorization session cookie localstorage json xml api endpoint request response status code validation mutation iteration recursion binary tree graph linked list sorting searching`.split(
    /\s+/
  )
);

const MATH_TERMS = new Set(
  `algebra geometry calculus trigonometry equation formula theorem proof matrix vector probability statistics mean median mode range variance deviation fraction decimal percent percentage ratio proportion integer rational irrational prime composite factor multiple exponent logarithm derivative integral limit sequence series polynomial quadratic linear slope intercept graph axis coordinate angle triangle circle diameter radius circumference area perimeter volume surface variable function domain range inequality absolute value modulo remainder quotient sum difference product quotient dimension symmetry transformation congruence similarity parallel perpendicular hypotenuse leg quadrant regression correlation distribution sample population hypothesis null alternative significance confidence`.split(
    /\s+/
  )
);

const SCIENCE_TERMS = new Set(
  `cell nucleus mitochondria chloroplast membrane cytoplasm dna rna gene chromosome protein enzyme ribosome organism organ tissue system ecosystem habitat species population community biosphere photosynthesis respiration fermentation aerobic anaerobic atom molecule element compound mixture solution solute solvent acid base ph reaction catalyst substrate product reactant energy kinetic potential chemical physical property state of matter solid liquid gas plasma gravity force mass weight velocity acceleration momentum friction inertia newton energy conservation organism evolution fossil natural selection adaptation mutation heredity trait dominant recessive allele genotype phenotype mitosis meiosis osmosis diffusion active transport equilibrium trophic predator prey food chain food web biome climate weather erosion deposition sedimentation tectonic earthquake volcano mineral rock igneous sedimentary metamorphic`.split(
    /\s+/
  )
);

const DEFINITION_PATTERNS = [
  /\b(is|are)\s+defined\s+as\b/i,
  /\b(is|are)\s+known\s+as\b/i,
  /\b(is|are)\s+referred\s+to\s+as\b/i,
  /\brefers?\s+to\b/i,
  /\bis\s+the\s+process\s+by\s+which\b/i,
  /\bis\s+the\s+process\s+of\b/i,
  /\bis\s+the\s+study\s+of\b/i,
  /\bis\s+the\s+ability\s+of\b/i,
  /\bis\s+the\s+measure\s+of\b/i,
  /\bis\s+the\s+(basic|fundamental|primary|central|main)\s+(unit|building|structural|functional|principle)\b/i,
  /\bis\s+a\s+(type|form|kind|method|technique|system|theory|principle|law|model|process|network|structure|organelle|cell)\s+of\b/i,
];

const HEADING_PATTERNS = [
  /^(chapter|section|lesson|module|unit|part|topic|lecture|introduction|conclusion|summary|overview|glossary|references|appendix|objectives|review|quiz)\s*[:.\s-]?\s*\d*/i,
  /^(\d+\.)+\s+[A-Z]/,
  /^(introduction|conclusion|summary|overview|definition|key\s+terms|glossary|references|appendix|objectives|review|quiz|key\s+concepts|learning\s+objectives)$/i,
];

const JUNK_HEADINGS =
  /^(references|bibliography|works cited|glossary|appendix|appendices|index|table of contents|contents|learning outcomes|learning objectives|objectives|module contents|pretest|posttest|quiz|test|assessment|answer key|acknowledg?ments|about the author|about this module|discussion|evaluation|activities?|exercises?|review questions?|study guide|syllabus|course outline|copyright|legal notice)$/i;

const PERSON_NAME_LINE =
  /^(?:prof\.?|professor|propesor|dr\.?|doctor|instructor|lecturer|faculty|adviser|advisor|mentor|teacher|tutor|dean|principal|asst\.?\s*prof\.?|assoc\.?\s*prof\.?)\s+[A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*){0,4}\s*(?:,\s*(?:[A-Z]{2,5}|RMT|RN|MD|PhD|DPT|DVM|MBA|CPA|MT|RT|BSMT|BN|BSN|PA|MA|MS)\b)?$/i;

const PERSON_NAME_SEGMENT =
  /\b(?:prof\.?|professor|propesor|dr\.?|doctor|instructor|lecturer|faculty|adviser|advisor|mentor|teacher|tutor|dean|principal)\s+[A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*){0,4}\s*(?:,\s*[A-Z]{2,5}\b)?/gi;

function cleanToken(t: string): string {
  return t.replace(/[^a-zA-Z'-]/g, "").toLowerCase();
}

function tokenize(text: string): string[] {
  return text
    .split(/[\s,.;:!?()"“”‘’[\]{}|\\/\n\t]+/)
    .map(cleanToken)
    .filter((t) => t.length > 2);
}

function normalizeText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim();
}

function stripNonContent(text: string): string {
  let t = text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/www\.\S+/gi, " ")
    .replace(/\bISBN[\s:]*[\d\-Xx]+/gi, " ")
    .replace(/doi:\s*[\d.]+\/[\S]+/gi, " ")
    .replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/gi, " ");

  const SECTION_END =
    /^(references|bibliography|works cited|references\s*\/\s*appendix|appendix references)\b/i;
  const REF_ENTRY =
    /\(\s*\d+(?:st|nd|rd|th)?\s*(?:ed|edition)\.?\s*\)/i;
  const CITE_NUM = /\[\s*\d+\s*\]/i;
  const AUTHOR_YEAR = /^[A-Z][A-Za-z'\-]+,\s*[A-Z]\.\s*\(?(?:19|20)\d{2}/;
  const YEAR_PART = /\((?:19|20)\d{2}\)|(?:19|20)\d{2}\)\s*[.;]/;

  const blocks = t.split(/\n+/);
  const filtered: string[] = [];
  let dropping = false;
  for (const block of blocks) {
    const lower = block.trim().toLowerCase();
    if (SECTION_END.test(lower)) {
      dropping = true;
      continue;
    }
    if (dropping) continue;
    if (
      /(retrieved from|first published|printed in|research journals|all rights reserved|©|references? to|bibliography|works cited|acknowledgements?)/.test(
        lower
      ) &&
      /(retrieved from|first published|printed in|research journals|all rights reserved|©)/.test(
        lower
      )
    ) {
      continue;
    }
    if (REF_ENTRY.test(block) || CITE_NUM.test(block)) continue;
    if (AUTHOR_YEAR.test(block.trim()) && YEAR_PART.test(block)) continue;
    filtered.push(block);
  }
  t = filtered.join("\n");

  t = t
    .replace(/[ \t]+/g, " ")
    .replace(/\b(Retrieved from|First published|Printed in|All rights reserved|Copyright)\b[^.\n]*/gi, " ")
    .replace(/\s+\(\s*[A-Z][A-Za-z'\-]{1,30}(?:\s*&\s*[A-Z][A-Za-z'\-]{1,30})?(?:,?\s*(?:19|20)\d{2}[a-z]?)\s*\)/gi, " ")
    .replace(/\(\s*(?:19|20)\d{2}\s*\)/g, " ");

  return stripMetadataLines(t);
}

const METADATA_LINE_PATTERNS = [
  // Instructor / person block (colon or bare label only — never prose)
  /^(instructor|professor|propesor|faculty|teacher|lecturer|adviser|advisor|coordinator|consultation(?:\s*hours)?|mentor)\s*:?\s*$/i,
  /^(instructor|professor|propesor|faculty|teacher|lecturer|adviser|advisor|coordinator|consultation(?:\s*hours)?|mentor)\s*:\s*\S/i,
  /^(prepared\s*by|submitted\s*by|noted\s*by|approved\s*by|recommended\s*by|checked\s*by|reviewed\s*by|edited\s*by|verified\s*by|validated\s*by|endorsed\s*by)\s*:?/i,
  // Contact / scheduling
  /^(email|e-mail|contact\s*(no\.?|number)?|mobile|cell\s*(no\.?|number)?|phone|telephone|fax|zoom|meet|skype)\s*:?\s*[\S]+/i,
  /^(room|office|building|location|venue|address|schedule|time|days?)\s*:?\s*[\S]+/i,
  // Course / term metadata
  /^(course\s*code|subject\s*code|course\s*(no\.?|number)?|course\s*title|course\s*name|catalog\s*number|class\s*code|reference\s*number)\s*:?\s*[\S]+/i,
  /^(credit\s*units?|units?|hours?\s*(per\s*wk)?|lecture\s*hours?|lab\s*hours?)\s*:?\s*\d+/i,
  /^(semester|term|trimester|quarter|school\s*year|academic\s*year|ay|sy|s\.?\s*y\.?)\s*:?\s*\d{4}/i,
  /^[a-z]+\s+semester[,:]?\s*(?:ay|sy|s\.?\s*y\.?)?\s*\d{4}/i,
  /^(bachelor|master|doctor|bs|ba|ma|ms|ph\.?\s?d)\s+(of|in)\s+[\S]/i,
  /^[A-Z]{2,8}[\s-]?\d{3,4}$/i,
  // Institution headers (general, any school)
  /^(pamantasan\s+ng|unibersidad\s+ng|university\s+of|universidad\s+de|college\s+of|institute\s+of|school\s+of|faculty\s+of|department\s+of|polytechnic\s+university|technological\s+university|state\s+university|academy|colegio)\b/i,
  // Page furniture / dates / student info
  /^page\s*\d+(\s*of\s*\d+)?$/i,
  /^p\.?\s*\d+$/i,
  /^\d+\s*\/\s*\d+$/i,
  /^(date|date\s*(submitted|released|of\s*submission)|due\s*date|deadline)\s*:?\s*[\S]+/i,
  /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/i,
  /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}$/i,
  /^(student\s*(no\.?|number)?|id\s*(no\.?|number)?|matriculation\s*(no\.?|number)?|registration\s*(no\.?|number)?|s\.?\s*no\.?)\s*:?\s*[\S]+/i,
  // Generic module boilerplate
  /^(module\s*contents|learning\s*outcomes|learning\s*objectives|expected\s*learning\s*outcomes|course\s*objectives|module\s*\d+|lesson\s*\d+)\b/i,
];

const METADATA_INSTITUTION_TOKEN =
  /\b(university|college|institute|academy|polytechnic|state\s+university|pamantasan|unibersidad)\b/i;

function stripMetadataLines(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return "";

  const counts = new Map<string, number>();
  for (const l of lines) counts.set(l, (counts.get(l) ?? 0) + 1);

  const isRepeatedFurniture = (l: string) =>
    (counts.get(l) ?? 0) >= 3 &&
    l.length >= 8 &&
    l.length <= 120 &&
    !/^[\s•▪◦‣·\-*—–0-9]+$/i.test(l);

  const dropped: string[] = [];
  const out: string[] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (line.length > 120) {
      out.push(line);
      continue;
    }
    if (isRepeatedFurniture(line)) {
      dropped.push(line);
      continue;
    }
    const isInstHeader =
      METADATA_INSTITUTION_TOKEN.test(line) &&
      /^[A-Z][A-Z0-9'&.\-\s]{3,80}$/.test(line);
    const isPersonName =
      // Only treat a person-name line as metadata in the document header
      // zone. Mid-document names heading real sections (e.g. "Dr. Jose
      // Rizal", "Gen. Antonio Luna") are legitimate topics and must survive.
      idx < 8 && PERSON_NAME_LINE.test(line);
    if (
      METADATA_LINE_PATTERNS.some((p) => p.test(line)) ||
      isInstHeader ||
      isPersonName
    ) {
      dropped.push(line);
      continue;
    }
    out.push(line);
  }
  return out.join("\n").trim();
}

export interface ProtectedSpan {
  formula: string;
  context: string;
}

export function factsFromSpans(spans: ProtectedSpan[]): Fact[] {
  return spans.map((s) => ({
    formula: s.formula.trim().replace(/\s+/g, " ").slice(0, 200),
    context: s.context.trim().replace(/\s+/g, " ").slice(0, 220),
  }));
}

const FORMULA_UNIT_RE =
  /\b\d+(?:[.,]\d+)?\s*(?:%|percent|km|cm|mm|m|kg|g|mg|µg|ml|mL|L|s|min|hr|hrs|°C|°F|K|mol|atm|Pa|J|N|W|V|A|Hz|M|kWh|cal|kcal|molecules|moles|atoms?|cells?|grams?|liters?|hours?|days?|weeks?|months?|years?|million|billion|thousand)\b/gi;
const FORMULA_EQUATION_RE =
  /\b[a-zA-Z][a-zA-Z0-9_]*\s*(?:=|≈|≠|>|<|≥|≤)\s*[-+]?\d+(?:\.\d+)?(?:[a-zA-Z%]*)\b/g;
const FORMULA_CHEM_RE =
  /\b[A-Z][a-z]?\d{0,2}(?:[A-Z][a-z]?\d{0,2}){2,}\b/g;

function extractProtectedSpans(text: string): ProtectedSpan[] {
  const spans: ProtectedSpan[] = [];
  const seen = new Set<string>();
  const push = (formula: string, context: string) => {
    const f = formula.trim().replace(/\s+/g, " ");
    if (!f || f.length < 2 || f.length > 300) return;
    if (/\s\w{3,}\s/.test(f) && !/[=≈≠<>≤≥+\-×·÷√]/.test(f)) return;
    const key = f.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    spans.push({
      formula: f,
      context: context.trim().replace(/\s+/g, " ").slice(0, 200),
    });
  };
  const around = (text: string, idx: number, len: number) =>
    text.slice(Math.max(0, idx - 90), idx + len + 90);

  for (const m of text.matchAll(/\$([^$\n]{2,200})\$/g)) {
    push(m[1], around(text, m.index!, m[0].length));
  }
  for (const m of text.matchAll(/\\\[([^\]\n]{2,300})\\\]/g)) {
    push(m[1], around(text, m.index!, m[0].length));
  }
  for (const m of text.matchAll(/\\\(([^)\n]{2,200})\\\)/g)) {
    push(m[1], around(text, m.index!, m[0].length));
  }

  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.length < 2 || t.length > 300) continue;
    
    // Explicitly reject programming code across any language (Java, Python, JS, SQL, HTML) without breaking math
    const looksLikeCode = /(?:^|\s)(?:public|private|protected|static|final|void|class|interface|extends|implements|import|export|function|def|return)\s/i.test(t) || /(?:if|for|while|switch|catch)\s*\(/i.test(t) || /\b(?:this\.|console\.|System\.|print\()/.test(t) || /(?:==|===|!=|!==|=>|->)/.test(t) || /;\s*$/.test(t) || /<[a-z]+[^>]*>/i.test(t) || /^(?:SELECT|UPDATE|INSERT|DELETE|CREATE)\s/i.test(t);
    if (looksLikeCode) continue;

    const hasOperators = /(?:[^=]|^)=|→|←|√|²|³|⁴|±|×|·|÷|∑|∫|Δ|π|Ω/.test(t);
    if (!hasOperators) continue;
    const looksLikeEquation =
      /\b\d+(?:[.,]\d+)?\b/.test(t) ||
      /\\(?:\(|\[|frac|sqrt|sum|int)/.test(t) ||
      (t.length <= 90 && /=[^=]/.test(t));
    if (looksLikeEquation) {
      push(t, t);
    }
  }

  for (const m of text.matchAll(FORMULA_UNIT_RE)) {
    push(m[0], around(text, m.index!, m[0].length));
  }
  for (const m of text.matchAll(FORMULA_EQUATION_RE)) {
    push(m[0], around(text, m.index!, m[0].length));
  }
  for (const m of text.matchAll(FORMULA_CHEM_RE)) {
    if (/[A-Z]/.test(m[0]) && /\d/.test(m[0])) {
      push(m[0], around(text, m.index!, m[0].length));
    }
  }

  return spans.slice(0, 250);
}

function isQuestionLike(s: string): boolean {
  const t = s.trim();
  if (/\?\s*$/.test(t)) return true;
  if (/^(what|which|who|whom|whose|where|when|why|how|is|are|does|do|can|could|would|should|will|may|might|identify|describe|explain|list|name|define|give|state|true or false|true\/false)\b/i.test(t)) {
    return true;
  }
  if (/\(\s?[a-d][).]\s|(?:\s|^)[a-d][.)]\s+[A-Z]/i.test(t)) return true;
  return false;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function uniqueBy<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item).toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

function stemKey(word: string): string {
  let s = word.toLowerCase();
  if (s.length > 4 && s.endsWith("ies")) return s.slice(0, -3) + "y";
  if (s.length > 4 && s.endsWith("es")) return s.slice(0, -2);
  if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) return s.slice(0, -1);
  return s;
}

function capTerm(term: string): string {
  return term
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

interface FrequencyEntry {
  word: string;
  count: number;
}

function computeFrequencies(text: string): FrequencyEntry[] {
  const map = new Map<string, number>();
  const sentences = splitSentences(text);
  for (const sentence of sentences) {
    const toks = tokenize(sentence);
    const valid = toks.map(t => ({ t, stop: STOPWORDS.has(t) }));
    for (let i = 0; i < valid.length; i++) {
      if (!valid[i].stop) {
        map.set(valid[i].t, (map.get(valid[i].t) ?? 0) + 1);
      }
      if (i < valid.length - 1 && !valid[i].stop && !valid[i+1].stop) {
        const bigram = `${valid[i].t} ${valid[i+1].t}`;
        map.set(bigram, (map.get(bigram) ?? 0) + 1);
      }
    }
  }
  return Array.from(map.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

const CODE_DOT = "\uE000";

function splitSentences(text: string): string[] {
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
  const protectedSpans: string[] = [];
  const t = text
    .replace(/`[^`]+`/g, (m) => {
      protectedSpans.push(m);
      return `\uE001${protectedSpans.length - 1}\uE001`;
    });
  
  const segments = Array.from(segmenter.segment(t));
  return segments
    .map(s => s.segment.replace(/\uE001(\d+)\uE001/g, (_, i) => protectedSpans[Number(i)] ?? "").trim())
    .filter(s => s.length > 20);
}

function extractHeadingCandidates(lines: string[]): string[] {
  const headings: string[] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const trimmed = lines[idx].trim();
    if (trimmed.length < 3 || trimmed.length > 90) continue;
    if (/^[a-z]/.test(trimmed) && !/^\d/.test(trimmed)) continue;
    if (trimmed.split(" ").length > 12) continue;
    if (trimmed.endsWith(".")) continue;
    // Only drop person-name lines in the document header/metadata zone
    // (first few lines). Mid-document person names that head real sections
    // (e.g. "Dr. Jose Rizal", "Gen. Antonio Luna") are legitimate topics.
    if (idx < 8 && PERSON_NAME_LINE.test(trimmed)) continue;
    if (JUNK_HEADINGS.test(trimmed)) continue;
    if (HEADING_PATTERNS.some((p) => p.test(trimmed))) {
      headings.push(trimmed);
    } else if (/^[A-Z0-9]/.test(trimmed) && trimmed.split(" ").length <= 8) {
      headings.push(trimmed);
    }
  }
  return unique(headings);
}

function cleanTerm(raw: string): string | null {
  let t = raw.trim();
  t = t.replace(/^(the|a|an|ang|mga|isang|ito|sa)\s+/i, "");
  t = t.replace(/[,.;:]+\s*$/, "");
  t = t.replace(/\s+/g, " ");
  if (!t || t.length < 2 || t.length > 60) return null;
  if (/[:]/.test(t)) return null;
  if (/^[\d.,%]+$/.test(t)) return null;
  const words = t.split(" ");
  if (words.length > 5) return null;
  if (/[.!?]$/.test(t)) return null;
  const first = words[0].toLowerCase();
  if (["this", "these", "those", "it", "its", "they", "their", "that", "which", "who", "whom", "what", "then", "also", "often", "thus", "however", "therefore", "there", "here", "all", "most", "some", "many", "each", "both", "when", "where", "why", "how", "because", "although", "while", "but", "and", "or", "not", "the", "one", "two", "such", "very", "just", "only", "even", "first", "next", "finally", "then", "in", "on", "at", "by", "for", "of", "to", "from", "with", "out", "up", "down", "into", "during", "before", "after", "between", "within", "without", "among", "can", "may", "must", "will", "would", "could", "should", "might", "shall", "called", "known", "term", "word", "form", "type", "process", "system", "method", "thing", "way", "part", "group", "these", "those", "mga", "ay", "ng", "ito", "isa"].includes(first)) {
    return null;
  }
  if (JUNK_TERMS.has(t.toLowerCase())) return null;
  return capTerm(t);
}

function findDefinitionForWord(
  word: string,
  sentences: string[]
): string | undefined {
  const re = new RegExp(`\\b${word}\\b`, "i");
  const defSentences = sentences.filter(
    (s) =>
      re.test(s) &&
      !isQuestionLike(s) &&
      DEFINITION_PATTERNS.some((p) => p.test(s))
  );
  if (defSentences.length > 0) return defSentences[0];
  return sentences.find((s) => {
    if (!re.test(s) || isQuestionLike(s)) return false;
    // Fallback must be a descriptive sentence, not just a heading or short fragment
    if (s.length < 30 || s.toUpperCase() === s) return false; 
    return /\b(is|are|was|were|has|have|do|does|can|could|will|would|should|provides|contains|generates|forms|uses|causes|creates|divides|performs|refers|means|represents)\b/i.test(s);
  });
}

function termScore(word: string): number {
  const lw = word.toLowerCase();
  let s = 0;
  if (CODING_TERMS.has(lw)) s += 100;
  if (MATH_TERMS.has(lw)) s += 80;
  if (SCIENCE_TERMS.has(lw)) s += 60;
  if (/^[A-Z]/.test(word)) s += 20;
  return s;
}

function isCodeLike(raw: string): boolean {
  if (/[_.$()]|\d/.test(raw)) return true;
  const lw = raw.toLowerCase();
  if (CODING_TERMS.has(lw)) return true;
  return /[A-Z]/.test(raw.slice(1));
}

function extractCodeTerms(text: string): string[] {
  const out: string[] = [];
  const add = (raw: string) => {
    const cleaned = raw.replace(/[()]+$/g, "").trim();
    if (!cleaned || cleaned.length < 2 || cleaned.length > 60) return;
    const lc = cleaned.toLowerCase();
    if (STOPWORDS.has(lc) || JUNK_TERMS.has(lc)) return;
    out.push(capTerm(cleaned));
  };

  for (const m of text.matchAll(/`([^`]+)`/g)) {
    const span = m[1].trim();
    if (span.includes(" ")) {
      for (const part of span.split(/[^A-Za-z0-9_$.-]+/)) {
        if (part && part.length >= 2 && isCodeLike(part)) add(part);
      }
    } else if (span.length >= 2) {
      add(span);
    }
  }

  const re = /\b[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*(?:\(\))?\b/g;
  for (const m of text.matchAll(re)) {
    const raw = m[0];
    if (raw.length < 3 || raw.length > 60) continue;
    if (/^[a-z]{1,2}\./i.test(raw)) continue;
    if (/^[a-z]+$/i.test(raw) && (STOPWORDS.has(raw) || JUNK_TERMS.has(raw))) continue;
    if (!isCodeLike(raw)) continue;
    add(raw);
    for (const part of raw.split(/[._]/)) {
      for (const sub of part.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)) {
        if (sub.length >= 3 && (CODING_TERMS.has(sub.toLowerCase()) || termScore(sub) >= 80)) {
          add(sub);
        }
      }
    }
  }
  return unique(out);
}

function snippetAround(text: string, index: number, before = 80, after = 160): string {
  const start = Math.max(0, index - before);
  const end = Math.min(text.length, index + after);
  let snip = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snip = "…" + snip;
  return snip.slice(0, 240);
}

function extractTerms(
  text: string,
  sourceDocs: Map<string, string>,
  isShort: boolean,
  termCap: number
): TermDefinition[] {
  const sentences = splitSentences(text);
  const terms: TermDefinition[] = [];
  let seq = 0;

  const pushTerm = (term: string, definition: string, sourceDoc?: string) => {
    if (!term || !definition) return;
    if (terms.length >= termCap) return;
    const exists = terms.some(
      (t) => stemKey(t.term) === stemKey(term)
    );
    if (exists) return;
    terms.push({
      id: `term-${seq++}`,
      term,
      definition: tightenDefinition(term, definition).slice(0, 240),
      sourceDoc,
    });
  };

  const candidateTerms = new Set<string>();

  const acronymRegex = /((?:[A-Z][a-zA-Z\-]+\s+){1,5}[A-Z][a-zA-Z\-]+)\s+\(([A-Z]{2,6})\)/g;
  for (const m of text.matchAll(acronymRegex)) {
    const term = m[2];
    const def = `${term} stands for ${m[1].trim()}`;
    const sourceDoc = findSourceDoc(m[0], sourceDocs);
    pushTerm(term, def, sourceDoc);
    candidateTerms.add(stemKey(term));
  }

  for (const sentence of sentences) {
    if (isQuestionLike(sentence)) continue;
    for (const pattern of DEFINITION_PATTERNS) {
      const verbMatch = sentence.match(pattern);
      if (!verbMatch) continue;
      const verbIndex = verbMatch.index ?? sentence.indexOf(verbMatch[0]);
      if (verbIndex < 2) continue;
      const before = sentence.slice(0, verbIndex);
      const lastPeriod = Math.max(before.lastIndexOf("."), before.lastIndexOf(";"), before.lastIndexOf(","));
      const subject = before.slice(lastPeriod === -1 ? 0 : lastPeriod + 1).trim();
      const term = cleanTerm(subject);
      if (term) {
        pushTerm(term, sentence, findSourceDoc(sentence, sourceDocs));
        candidateTerms.add(stemKey(term));
        break;
      }
    }
  }

  for (const term of extractCodeTerms(text)) {
    const key = stemKey(term);
    if (candidateTerms.has(key)) continue;
    const def = findDefinitionForWord(term, sentences);
    if (!def) continue;
    pushTerm(term, def, findSourceDoc(def, sourceDocs));
    candidateTerms.add(key);
  }

  const freq = computeFrequencies(text).filter(
    (f) =>
      (isShort ? f.word.length >= 3 : f.word.length > 4) &&
      f.count >= (isShort ? 1 : 2) &&
      !JUNK_TERMS.has(f.word)
  );
  freq.sort(
    (a, b) => termScore(b.word) - termScore(a.word) || b.count - a.count
  );
  for (const fw of freq) {
    if (terms.length >= termCap) break;
    const w = fw.word.toLowerCase();
    const key = stemKey(w);
    if (candidateTerms.has(key)) continue;
    const capitalized = capTerm(w);
    if (!new RegExp(`\\b${w}`, "i").test(text)) continue;
    const sentence = findDefinitionForWord(w, allSentences(text, sourceDocs));
    if (!sentence) continue;
    pushTerm(capitalized, sentence, findSourceDoc(sentence, sourceDocs));
    candidateTerms.add(key);
  }

  for (const [docName, docText] of sourceDocs.entries()) {
    if (terms.length >= termCap) break;
    const docFreq = computeFrequencies(docText).filter(
      (f) =>
        (isShort ? f.word.length >= 3 : f.word.length > 4) &&
        f.count >= (isShort ? 1 : 2) &&
        !JUNK_TERMS.has(f.word)
    );
    docFreq.sort(
      (a, b) => termScore(b.word) - termScore(a.word) || b.count - a.count
    );
    for (const fw of docFreq) {
      if (terms.length >= termCap) break;
      const w = fw.word.toLowerCase();
      const key = stemKey(w);
      if (candidateTerms.has(key)) continue;
      const sentence = findDefinitionForWord(w, splitSentences(docText));
      if (!sentence) continue;
      pushTerm(capTerm(w), sentence, docName);
      candidateTerms.add(key);
    }
  }

  return uniqueBy(terms, (t) => stemKey(t.term)).slice(0, termCap);
}

function allSentences(text: string, sourceDocs: Map<string, string>): string[] {
  const sets = [splitSentences(text)];
  for (const docText of sourceDocs.values()) sets.push(splitSentences(docText));
  return unique(sets.flat());
}

function findSourceDoc(
  snippet: string,
  sourceDocs: Map<string, string>
): string | undefined {
  const needle = snippet.slice(0, 60).toLowerCase();
  for (const [name, docText] of sourceDocs.entries()) {
    if (docText.toLowerCase().includes(needle)) return name;
  }
  return undefined;
}

function sectionsFromHeadings(
  docText: string,
  headings: string[]
): { title: string; body: string }[] {
  const idxs: { h: string; i: number }[] = [];
  for (const h of headings) {
    const re = new RegExp(
      `(?:^|\\n)\\s*${escapeRegExp(h)}\\s*(?:\\n|$)`
    );
    const m = docText.match(re);
    if (m && m.index !== undefined) {
      idxs.push({ h, i: m.index + m[0].indexOf(h) });
    }
  }
  idxs.sort((a, b) => a.i - b.i);
  const out: { title: string; body: string }[] = [];
  for (let k = 0; k < idxs.length; k++) {
    const start = idxs[k].i + idxs[k].h.length;
    const end = k + 1 < idxs.length ? idxs[k + 1].i : docText.length;
    const body = docText.slice(start, end);
    if (body.replace(/\s/g, "").length >= 60) {
      let rawTitle = idxs[k].h.replace(/[:.\-]\s*$/, "").trim();
      rawTitle = rawTitle.replace(/^[•●◦▪*=\-–—]\s*/, "").replace(/^\d+\.\s*/, "").trim();
      if (rawTitle.includes(" - ") && rawTitle.length > 40) {
        rawTitle = rawTitle.split(" - ")[0].trim();
      }
      out.push({ title: rawTitle, body });
    }
  }
  return out;
}

function deriveTitle(body: string): string {
  const first = body.split(/\s*[.!?]\s+/)[0] ?? body;
  const defVerb = first.match(
    /^(.{2,60}?)\s+(?:is|are|was|were|refers?\s+to|means|involves?|describes?|focuses?\s+on|occurs|happens|takes\s+place|plays?|functions?)\b/i
  );
  if (defVerb) {
    const t = defVerb[1].replace(/[;:]\s*$/, "").trim();
    if (t.length >= 2 && t.length <= 60) return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const cap = first.match(/^([A-Z][A-Za-z'-]*(?:\s+[A-Za-z'-]+){0,5})/);
  if (cap && cap[1].length >= 3) return cap[1];
  return first.split(/\s+/).slice(0, 4).join(" ") || "Section";
}

function chunkText(docText: string): { title: string; body: string }[] {
  const sentences = splitSentences(docText);
  if (sentences.length === 0) return [];
  const perChunk = sentences.length <= 15 ? sentences.length : 12;
  const chunks: { title: string; body: string }[] = [];
  for (let i = 0; i < sentences.length; i += perChunk) {
    const body = sentences.slice(i, i + perChunk).join(" ");
    const words = body
      .split(/\s+/)
      .map((w) => w.replace(/[^A-Za-z]/g, ""))
      .filter((w) => w.length > 4 && !STOPWORDS.has(w.toLowerCase()) && !JUNK_TERMS.has(w.toLowerCase()));
    const top =
      deriveTitle(body) ||
      (words.find((w) => /^[A-Z]/.test(w)) ??
        words.sort((a, b) => b.length - a.length)[0]);
    chunks.push({
      title: top ? capTerm(top) : `Section ${i / perChunk + 1}`,
      body,
    });
  }
  return chunks;
}

function buildTopic(
  section: { title: string; body: string },
  terms: TermDefinition[],
  isShort: boolean
): TopicAccordion | null {
  const sentences = splitSentences(section.body);
  if (sentences.length === 0) return null;
  const nonQ = sentences.filter((s) => !isQuestionLike(s));
  const secLower = section.body.toLowerCase();
  const sectionTerms = terms
    .filter((t) => secLower.includes(t.term.toLowerCase()))
    .slice(0, 4);
  const secFreq = computeFrequencies(section.body);
  const freqMap = new Map(secFreq.map((f) => [f.word, f.count]));
  const secTermsLower = sectionTerms.map((t) => t.term.toLowerCase());
  const isFact = (s: string) =>
    /\b\d+(?:[.,]\d+)?\s*(?:%|percent|km|cm|mm|m|kg|g|mg|ml|mL|L|s|min|hr|hrs|°C|°F|K|mol|moles|atoms?|cells?|grams?|liters?|hours?|days?|weeks?|months?|years?|million|billion|thousand)\b/i.test(
      s
    ) ||
    /[=≈≠<>≤≥+×·÷√]|\b(?:19|20)\d{2}\b/.test(s);
  const scored = unique(
    nonQ.filter((s) => !DEFINITION_PATTERNS.some((p) => p.test(s)))
  )
    .map((s, i) => {
      const toks = tokenize(s).filter((t) => !STOPWORDS.has(t));
      const density =
        toks.reduce((sum, t) => sum + (freqMap.get(t) ?? 0), 0) /
        (toks.length || 1);
      const lower = s.toLowerCase();
      const hasTerm = secTermsLower.some(
        (t) => t.length > 3 && lower.includes(t)
      );
      const score =
        density * 2 +
        (hasTerm ? 2.5 : 0) +
        (isFact(s) ? 3 : 0) +
        (i < 3 ? 1.5 : 0) -
        (i > 8 ? 1 : 0);
      return { s, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.s.replace(/^[•●◦▪*=\-–—]\s*/, "").replace(/^\d+\.\s*/, "").trim().slice(0, 220))
    .sort(
      (a, b) =>
        section.body.indexOf(a) - section.body.indexOf(b) ||
        a.localeCompare(b)
    );
  const points = scored;

  const details: TopicDetail[] = [];
  for (const st of sectionTerms) {
    if (details.length >= 4) break;
    details.push({
      id: `det-${st.id}`,
      heading: st.term,
      points: [st.definition.slice(0, 240)],
    });
  }
  if (points.length > 0) {
    details.push({
      id: `det-${section.title}-key`,
      heading: "Key Points",
      points: points.slice(0, 8),
    });
  }
  if (details.length === 0) {
    details.push({
      id: `det-${section.title}-overview`,
      heading: "Overview",
      points: nonQ.slice(0, 2).map((s) => s.slice(0, 200)),
    });
  }

  return {
    id: `topic-${section.title}`,
    title: section.title,
    summary: points[0] ?? sentences[0]?.slice(0, 200) ?? section.body.slice(0, 200),
    details: uniqueBy(details, (d) => d.heading).slice(0, 5),
  };
}

function buildFallbackTopic(terms: TermDefinition[]): TopicAccordion {
  const top = terms.slice(0, 4);
  const details: TopicDetail[] =
    top.length > 0
      ? top.map((t) => ({
          id: `det-fb-${t.id}`,
          heading: t.term,
          points: [t.definition.slice(0, 240)],
        }))
      : [{ id: "det-fb-overview", heading: "Overview", points: [] }];
  return {
    id: "topic-key-concepts",
    title: "Key Concepts",
    summary: "Key concepts covered in the study material.",
    details,
  };
}

function buildTopicsForDocs(
  sourceDocs: Map<string, string>,
  terms: TermDefinition[],
  topicCap: number
): TopicAccordion[] {
  const topics: TopicAccordion[] = [];
  const usedTitles = new Set<string>();
  const cleanFileName = (name: string) =>
    name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || name;

  // 1. Gather all sections from all documents
  const allSections: { title: string; body: string; source: string }[] = [];
  
  for (const [name, docText] of sourceDocs.entries()) {
    const headings = extractHeadingCandidates(docText.split(/\n+/));
    const sections =
      headings.length >= 2
        ? sectionsFromHeadings(docText, headings)
        : chunkText(docText); // fallback for headerless docs
    for (const sec of sections) {
      allSections.push({ ...sec, source: name });
    }
  }

  // 2. Heading-similarity deduplication (cross-file merging)
  const mergedSections: { title: string; body: string; sources: Set<string> }[] = [];
  for (const sec of allSections) {
    const existing = mergedSections.find(
      (m) =>
        similarity(m.title, sec.title) > 0.6 ||
        m.title.toLowerCase() === sec.title.toLowerCase()
    );
    if (existing) {
      existing.body += "\n\n" + sec.body;
      existing.sources.add(sec.source);
    } else {
      mergedSections.push({
        title: sec.title,
        body: sec.body,
        sources: new Set([sec.source]),
      });
    }
  }

  // 3. Build topics
  for (const sec of mergedSections) {
    if (topics.length >= topicCap) break;
    const topic = buildTopic(sec, terms, topicCap < 40);
    if (!topic) continue;
    let title = topic.title;
    if (usedTitles.has(title.toLowerCase())) {
      const srcs = Array.from(sec.sources).map(cleanFileName).join(", ");
      title = `${title} (${srcs})`;
    }
    usedTitles.add(title.toLowerCase());
    topics.push({
      ...topic,
      id: `topic-${topics.length}`,
      title,
    });
  }

  if (topics.length === 0) {
    topics.push(buildFallbackTopic(terms));
  }
  return topics.slice(0, topicCap);
}

function similarity(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\s+/));
  const wb = new Set(b.toLowerCase().split(/\s+/));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  const union = wa.size + wb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function negateStatement(s: string): string | null {
  if (/\b(not|n't|never|no)\b/i.test(s)) return null;
  const modal = s.match(
    /\b(is|are|was|were|has|have|had|can|could|will|would|should|must|may|might)\b/i
  );
  if (modal && modal.index !== undefined) {
    const w = modal[0];
    return s.slice(0, modal.index) + `${w} not` + s.slice(modal.index + w.length);
  }
  const action = s.match(
    /\b(contains?|produces?|generates?|forms?|uses?|causes?|creates?|divides?|performs?|provides?|requires?|releases?|absorbs?|transforms?|converts?|maintains?|regulates?|prevents?|increases?|decreases?|stores?|breaks?|builds?)\b/i
  );
  if (action && action.index !== undefined) {
    const w = action[0];
    const after = s.slice(action.index + w.length);
    const base = /ies$/i.test(w)
      ? w.slice(0, -3) + "y"
      : /es$/i.test(w)
        ? w.slice(0, -2)
        : /s$/i.test(w)
          ? w.slice(0, -1)
          : w;
    if (/^use$/i.test(base) && /\bof\b/i.test(after)) return null;
    return s.slice(0, action.index) + `does not ${base.toLowerCase()}` + after;
  }
  return null;
}

function cleanStatement(s: string, minLen: number): string | null {
  if (/\n|\r/.test(s)) return null;
  let x = s
    .replace(/^\s*[•●◦▪]\s*/, "")
    .replace(/^\s*[-–—]\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!x) return null;
  if (x.length < minLen || x.length > 240) return null;
  if (/[•●◦]|\|/.test(x)) return null;
  if (/✓|✗/.test(x)) return null;
  if (/^\s*\d+[\.\)]\s*/.test(x)) return null;
  if (/\s\d+[\.\)]\s*$/.test(x)) return null;
  if (/\(\s*\d+\s*(?:pts?|points?|marks?)\)/i.test(x)) return null;
  if (/^(true|false|yes|no)\b/i.test(x)) return null;
  if (/^\s*(chapter|section|lesson|unit|module)\s+\d/i.test(x)) return null;
  if (/^[\s\-–—+*=#@>]/.test(x)) return null;
  return x;
}

function extractExampleLists(
  text: string
): { subject: string; items: string[] }[] {
  const out: { subject: string; items: string[] }[] = [];
  const re = /\b([A-Za-z][A-Za-z \-']{2,60}?)\s+(?:such as|e\.g\.|including)\s+([^.;\n]{3,140})/gi;
  for (const m of text.matchAll(re)) {
    const subject = m[1].trim();
    if (/^(chapter|section|the|this|these|those|a|an)$/i.test(subject)) continue;
    const items = m[2]
      .split(/\s*(?:,|;|\s+and\s+|\s+or\s+)\s*/)
      .map((s) => s.trim().replace(/[,.]+$/, ""))
      .filter((s) => s.length >= 2 && s.length <= 45);
    if (items.length >= 2) out.push({ subject, items: unique(items) });
  }
  return out;
}

function extractNumericValues(text: string): string[] {
  const re =
    /\b(?:\d[\d,]*(?:\.\d+)?\s*(?:%|percent|km|cm|m|mm|kg|g|mg|ml|s|min|hr|h|days?|weeks?|months?|years?|°C|°F|degrees?|million|billion|thousand)|(?:19|20)\d{2})\b/gi;
  return unique(
    Array.from(text.matchAll(re), (m) => m[0].trim())
  ).slice(0, 60);
}

const PHRASE_DEFINE = [
  (t: string) => `What is "${t}"?`,
  (t: string) => `Which best describes "${t}"?`,
  (t: string) => `Which statement best defines "${t}"?`,
  (t: string) => `What does "${t}" mean?`,
];

const PHRASE_STATEMENT = [
  "Which of the following statements is correct?",
  "Which statement is true?",
  "Which of these statements is correct?",
  "Which statement is supported by the material?",
];

export function buildQuiz(
  terms: TermDefinition[],
  topics: TopicAccordion[],
  text: string,
  questionTarget: number
): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  let seq = 0;
  const isShort = text.split(/\s+/).length < 800;
  const minLen = isShort ? 30 : 40;

  const cleanTerms = terms.filter(
    (t) => t.definition.length > (isShort ? 25 : 30) && !JUNK_TERMS.has(t.term.toLowerCase())
  );
  const topicPoints = topics
    .flatMap((t) => [t.summary, ...t.details.flatMap((d) => d.points)])
    .filter((s) => s && s.length > minLen && !isQuestionLike(s));

  const tfTarget = Math.min(20, Math.round(questionTarget * 0.3));
  const mcTarget = Math.max(0, questionTarget - tfTarget);
  const usedQuestions = new Set<string>();
  const add = (
    q: Omit<QuizQuestion, "id" | "type">,
    type: "mcq" | "tf" = "mcq"
  ) => {
    if (questions.length >= questionTarget) return;
    const key = q.question.toLowerCase().replace(/\s+/g, " ").trim();
    if (usedQuestions.has(key)) return;
    usedQuestions.add(key);
    questions.push({ ...q, id: seq++, type });
  };

  const tfCount = () => questions.filter((q) => q.type === "tf").length;
  const mcCount = () => questions.filter((q) => q.type === "mcq").length;

  const tfPrimary = unique(
    [...topicPoints, ...cleanTerms.map((t) => t.definition)]
      .filter((s) => s && !isQuestionLike(s))
      .map((s) => cleanStatement(s, minLen))
      .filter((s): s is string => !!s)
  );
  const tfRaw = unique(
    splitSentences(text)
      .filter((s) => !isQuestionLike(s))
      .map((s) => cleanStatement(s, 60))
      .filter((s): s is string => !!s)
  );
  const tfStatements = [...shuffle(tfPrimary), ...shuffle(tfRaw)];
  for (const stmt of shuffle(tfStatements)) {
    if (tfCount() >= tfTarget || questions.length >= questionTarget) break;
    const lower = stmt.toLowerCase();
    const keyTerm = cleanTerms.find(
      (t) => t.term.length > 3 && lower.includes(t.term.toLowerCase())
    );
    const distractors = cleanTerms.filter(
      (t) => t.term.length > 3 && !lower.includes(t.term.toLowerCase())
    );
    const distractor = distractors[Math.floor(Math.random() * distractors.length)];
    const mode = Math.random();
    if (keyTerm && distractor && mode < 0.55) {
      const swapped = stmt.replace(
        new RegExp(`\\b${escapeRegExp(keyTerm.term)}\\b`, "i"),
        distractor.term
      );
      if (swapped !== stmt) {
        add(
          {
            question: `True or False: ${swapped.slice(0, 240)}`,
            options: ["True", "False"],
            correctAnswerIndex: 1,
            explanation: `False. ${keyTerm.term}: ${keyTerm.definition.slice(0, 200)}`,
            sourceDoc: keyTerm.sourceDoc,
            difficulty: "medium",
          },
          "tf"
        );
        continue;
      }
    }
    const negated = mode >= 0.55 && mode < 0.85 ? negateStatement(stmt) : null;
    if (negated) {
      add(
        {
          question: `True or False: ${negated.slice(0, 240)}`,
          options: ["True", "False"],
          correctAnswerIndex: 1,
          explanation: `False. ${stmt.slice(0, 240)}`,
          difficulty: "medium",
        },
        "tf"
      );
      continue;
    }
    add(
      {
        question: `True or False: ${stmt.slice(0, 240)}`,
        options: ["True", "False"],
        correctAnswerIndex: 0,
        explanation: `True. ${stmt.slice(0, 240)}`,
        difficulty: "easy",
      },
      "tf"
    );
  }

  const usedAnswers = new Set<string>();
  for (const term of cleanTerms) {
    if (questions.length >= questionTarget) break;
    const ansKey = term.definition.toLowerCase();
    if (usedAnswers.has(ansKey)) continue;
    const sameContext = cleanTerms.filter((t) => t.id !== term.id && t.sourceDoc === term.sourceDoc && t.definition.toLowerCase() !== ansKey);
    const otherContext = cleanTerms.filter((t) => t.id !== term.id && t.sourceDoc !== term.sourceDoc && t.definition.toLowerCase() !== ansKey);
    
    let distractorPool = shuffle(sameContext).map(t => t.definition);
    if (distractorPool.length < 3) {
       distractorPool = distractorPool.concat(shuffle(otherContext).map(t => t.definition));
    }
    
    const distractors = distractorPool
      .filter((d) => similarity(d, term.definition) < 0.55)
      .filter((d, i, arr) => arr.indexOf(d) === i)
      .slice(0, 3);
    if (distractors.length < 3) continue;
    usedAnswers.add(ansKey);
    const options = shuffle([term.definition, ...distractors.slice(0, 3)]);
    const correctAnswerIndex = options.indexOf(term.definition);
    const phrase = PHRASE_DEFINE[seq % PHRASE_DEFINE.length];
    add(
      {
        question: phrase(term.term),
        options,
        correctAnswerIndex,
        explanation: `"${term.term}" is ${term.definition.slice(0, 220)}`,
        sourceDoc: term.sourceDoc,
        difficulty: term.definition.split(" ").length > 30 ? "hard" : "medium",
      },
      "mcq"
    );
  }

  let defFillTarget = Math.min(
    10,
    questionTarget - questions.length
  );
  for (const term of shuffle(cleanTerms)) {
    if (defFillTarget <= 0 || questions.length >= questionTarget) break;
    const def = term.definition.slice(0, 200);
    const re = new RegExp(`\\b${escapeRegExp(term.term)}\\b`, "i");
    const m = def.match(re);
    if (!m || m.index === undefined) continue;
    const blanked =
      def.slice(0, m.index) + "_____" + def.slice(m.index + m[0].length);
    const distractors = shuffle(
      cleanTerms.filter((t) => t.id !== term.id && !re.test(t.definition))
    )
      .slice(0, 3)
      .map((t) => t.term);
    if (distractors.length < 3) continue;
    const options = shuffle([term.term, ...distractors]);
    add(
      {
        question: `Complete the statement: "${blanked}"`,
        options,
        correctAnswerIndex: options.indexOf(term.term),
        explanation: `"${term.term}" is ${term.definition.slice(0, 220)}`,
        sourceDoc: term.sourceDoc,
        difficulty: "medium",
      },
      "mcq"
    );
    defFillTarget--;
  }

  const byTopic: string[][] = topics.map((t) =>
    unique([
      t.summary,
      ...t.details.flatMap((d) => d.points),
    ])
      .map((p) => cleanStatement(p, minLen + 10))
      .filter((p): p is string => !!p)
  );
  const allPoints = unique(byTopic.flat());

  const maxPool = Math.max(...byTopic.map((p) => p.length), 0);
  for (let round = 0; round < maxPool && questions.length < questionTarget; round++) {
    for (const [ti, points] of byTopic.entries()) {
      if (questions.length >= questionTarget) break;
      const point = points[round];
      if (!point || point.length < minLen + 10 || isQuestionLike(point)) continue;
      const answer = point.slice(0, 220);
      const crossTopic = byTopic.flatMap((p, i) =>
        i === ti ? [] : p.filter((x) => x && x.length > minLen)
      );
      const pool = crossTopic.length >= 3
        ? crossTopic
        : allPoints.filter((x) => x !== point);
      const distractors = shuffle(pool)
        .filter(
          (d) =>
            d !== point &&
            similarity(d, point) < 0.5 &&
            d.length >= answer.length * 0.5 &&
            d.length <= answer.length * 2
        )
        .map((d) => d.slice(0, 220))
        .filter((d, i, arr) => arr.findIndex((x) => x === d) === i)
        .slice(0, 3);
      if (distractors.length < 3) continue;
      const options = shuffle([answer, ...distractors.slice(0, 3)]);
      add(
        {
          question: PHRASE_STATEMENT[seq % PHRASE_STATEMENT.length],
          options,
          correctAnswerIndex: options.indexOf(answer),
          explanation: answer,
          difficulty: "easy",
        },
        "mcq"
      );
    }
  }

  const exampleLists = extractExampleLists(text);
  for (const list of shuffle(exampleLists)) {
    if (questions.length >= questionTarget) break;
    const answer = list.items[0];
    const otherItems = new Set(exampleLists.flatMap((l) => l.items).filter((i) => !list.items.includes(i)));
    const extra = [...otherItems];
    const distractorPool = shuffle([...extra, ...cleanTerms.map((t) => t.term)]);
    const distractor = distractorPool.find((d) => !list.items.includes(d));
    if (!distractor || distractor === answer) continue;
    const options = shuffle([answer, ...list.items.slice(1, 3), distractor]);
    const correctAnswerIndex = options.indexOf(answer);
    add(
      {
        question: `Which of the following is NOT an example of ${list.subject}?`,
        options,
        correctAnswerIndex,
        explanation: `"${answer}" is an example of ${list.subject}. Examples include: ${list.items.join(", ")}.`,
        difficulty: "medium",
      },
      "mcq"
    );
  }

  const numericValues = extractNumericValues(text);
  const numericSentences = splitSentences(text)
    .filter((s) => extractNumericValues(s).length > 0 && !isQuestionLike(s))
    .slice(0, 30);
  for (const sentence of numericSentences) {
    if (questions.length >= questionTarget) break;
    const nums = extractNumericValues(sentence);
    const answer = nums[nums.length - 1];
    if (!answer) continue;
    const distractors = shuffle(
      numericValues.filter((n) => n !== answer).slice(0, 12)
    ).slice(0, 3);
    if (distractors.length < 3) continue;
    const lastIdx = sentence.lastIndexOf(answer);
    const blanked =
      lastIdx !== -1
        ? sentence.slice(0, lastIdx) + "_____" + sentence.slice(lastIdx + answer.length)
        : sentence;
    const options = shuffle([answer, ...distractors]);
    add(
      {
        question: `Complete the statement: "${blanked.slice(0, 200)}"`,
        options,
        correctAnswerIndex: options.indexOf(answer),
        explanation: `The value is "${answer}". ${sentence.slice(0, 220)}`,
        difficulty: "medium",
      },
      "mcq"
    );
  }

  const freq = computeFrequencies(text).filter(
    (f) =>
      (isShort ? f.word.length >= 3 : f.word.length > 4) &&
      !JUNK_TERMS.has(f.word)
  );
  for (const f of shuffle(freq)) {
    if (questions.length >= questionTarget) break;
    const sentences = splitSentences(text)
      .filter((s) => new RegExp(`\\b${escapeRegExp(f.word)}\\b`, "i").test(s))
      .filter((s) => !isQuestionLike(s))
      .slice(0, 5);
    for (const sent of sentences) {
      if (questions.length >= questionTarget) break;
      const sentence = sent.slice(0, 200);
      const re = new RegExp(`\\b${escapeRegExp(f.word)}\\b`, "ig");
      const matches = [...sentence.matchAll(re)];
      const blanked =
        matches.length > 0
          ? sentence.slice(0, matches[matches.length - 1].index) +
            "_____" +
            sentence.slice(
              (matches[matches.length - 1].index ?? 0) +
                matches[matches.length - 1][0].length
            )
          : sentence;
      const distractors = shuffle(freq)
        .filter((x) => x.word !== f.word)
        .slice(0, 3)
        .map((x) => capTerm(x.word));
      const options = shuffle([capTerm(f.word), ...distractors.slice(0, 3)]);
      add(
        {
          question: `Complete the statement: "${blanked}"`,
          options,
          correctAnswerIndex: options.indexOf(capTerm(f.word)),
          explanation: `The word is "${f.word}". ${sentence}`,
          difficulty: "medium",
        },
        "mcq"
      );
    }
  }

  return questions.slice(0, questionTarget);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tightenDefinition(term: string, def: string): string {
  const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
  const m = def.match(re);
  if (!m || m.index === undefined) return def;
  const before = def.slice(0, m.index);
  const boundary = Math.max(
    before.lastIndexOf(". "),
    before.lastIndexOf("; "),
    before.lastIndexOf(": ")
  );
  const from = boundary === -1 ? Math.max(0, m.index - 70) : boundary + 2;
  const after = def.slice(m.index);
  const endRel = after.indexOf(".", m[0].length);
  const end = endRel === -1 ? def.length : m.index + endRel + 1;
  return def.slice(from, end).trim();
}

function pickOverview(sentences: string[], freq: FrequencyEntry[]): string {
  const freqMap = new Map(freq.map((f) => [f.word, f.count]));
  const scored = sentences
    .map((s, i) => {
      const tokens = tokenize(s).filter((t) => !STOPWORDS.has(t));
      const density = tokens.reduce((sum, t) => sum + (freqMap.get(t) ?? 0), 0) /
        (tokens.length || 1);
      const leadBonus = Math.max(0, 1 - i * 0.06);
      return { s, score: density * leadBonus };
    })
    .sort((a, b) => b.score - a.score);

  const picked: string[] = [];
  for (const { s } of scored) {
    if (picked.length >= 3) break;
    if (picked.some((p) => similarity(p, s) > 0.5)) continue;
    picked.push(s);
  }
  return picked.length > 0
    ? picked.join(" ")
    : sentences.slice(0, 2).join(" ");
}

export interface SourceDraft {
  title: string;
  overview: string;
  keyTakeaways: string[];
  topics: TopicAccordion[];
  terms: TermDefinition[];
}

export function prepareDraft(docs: ExtractedDocument[]): {
  cleanedDocs: ExtractedDocument[];
  text: string;
  draft: SourceDraft;
  protectedFacts: string[];
  protectedSpans: ProtectedSpan[];
} {
  const cleanedDocs = docs.map((d) => ({ ...d, text: stripNonContent(d.text) }));
  const text = cleanedDocs.map((d) => d.text).join("\n\n");
  const sourceDocs = new Map(cleanedDocs.map((d) => [d.name, d.text]));
  const wordCount = text.split(/\s+/).length;
  const isShort = wordCount < 800;
  const termCap = Math.max(15, Math.min(isShort ? 30 : 60, Math.round(wordCount / 40)));
  const topicCap = Math.max(5, Math.min(15, Math.round(wordCount / 250)));

  const protectedSpans = extractProtectedSpans(text);
  const protectedFacts = protectedSpans.map((s) => s.formula);

  const sentences = splitSentences(text);
  const freq = computeFrequencies(text);

  const lines = normalizeText(text).split("\n");
  const headings = extractHeadingCandidates(lines);

  const terms = extractTerms(text, sourceDocs, isShort, termCap);
  const topics = buildTopicsForDocs(sourceDocs, terms, topicCap);

  const freqMap = new Map(freq.map((f) => [f.word, f.count]));
  const BOILERPLATE = /^(introduction|conclusion|summary|overview|glossary|references|bibliography|appendix|objectives|abstract|acknowledg?ments?|about|background|review|quiz|learning\s+objectives|learning\s+outcomes|key\s+terms|key\s+concepts|module\s+contents|contents|pretest|posttest|discussion|evaluation|activity|activities|exercise|exercises)$/i;
  const takeawayCandidates = unique(
    sentences
      .filter(
        (s) =>
          !isQuestionLike(s) &&
          !PERSON_NAME_LINE.test(s.trim()) &&
          !BOILERPLATE.test(s.trim()) &&
          s.length > 40 &&
          s.length < 260
      )
      .map((s, i) => {
        const lower = s.toLowerCase();
        const imp =
          /(important|crucial|key|main|primary|core|essential|major|significant|fundamental|according to|is the process|is defined|refers to|plays? a|responsible for)/i.test(
            s
          )
            ? 3
            : 0;
        const hasFact =
          /\b\d+(?:[.,]\d+)?\s*(?:%|percent|km|cm|mm|m|kg|g|mg|ml|mL|L|s|min|hr|hrs|°C|°F|mol|million|billion|thousand)\b/i.test(
            s
          ) || /[=≈≠<>≤≥]/.test(s)
            ? 2
            : 0;
        const toks = tokenize(s).filter((t) => !STOPWORDS.has(t));
        const density =
          toks.reduce((sum, t) => sum + (freqMap.get(t) ?? 0), 0) /
          (toks.length || 1);
        const lead = Math.max(0, 1 - i * 0.02);
        return { s, score: (imp + hasFact + density * 2) * lead };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s.replace(/^[•●◦▪*=\-–—]\s*/, "").replace(/^\d+\.\s*/, "").trim())
      .filter(
        (s, idx, arr) =>
          !arr.slice(0, idx).some((p) => similarity(p, s) > 0.55)
      )
  );

  const titleCandidates = headings.filter((h) => !PERSON_NAME_LINE.test(h));
  const personCandidates = headings.filter((h) => PERSON_NAME_LINE.test(h));
  const numbered =
    titleCandidates.find((h) => !/^(chapter|section|lesson|module|unit|part)\s+\d/i.test(h)) ??
    titleCandidates[0];
  const cleanHeading = (h: string) =>
    h.replace(/[:.\-]\s*$/, "").replace(/[_-]+/g, " ").trim();
  const cleanFileName = (name: string) => {
    const withoutExt = name.replace(/\.[^.]+$/, "").trim();
    const stripped = withoutExt
      .replace(/\((20\d{2})\d*-\d{4,6}\)/g, "")
      .replace(PERSON_NAME_SEGMENT, " ")
      .replace(/[_-]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s\-–—:;,.]+|[\s\-–—:;,]+$/g, "")
      .trim();
    return stripped || withoutExt;
  };
  const title =
    numbered && !BOILERPLATE.test(numbered)
      ? cleanHeading(numbered)
      : titleCandidates.find((h) => !BOILERPLATE.test(h))?.length
        ? cleanHeading(titleCandidates.find((h) => !BOILERPLATE.test(h))!)
        : numbered?.length
          ? cleanHeading(numbered)
          : personCandidates[0]?.length
            ? cleanHeading(personCandidates[0])
            : docs
                .map((d) => cleanFileName(d.name))
                .join(", ")
                .slice(0, 80) || "Study Materials";

  return {
    cleanedDocs,
    text,
    draft: {
      title,
      overview: pickOverview(sentences, freq) || text.slice(0, 400),
      keyTakeaways: uniqueBy(
        takeawayCandidates.slice(0, 6).map((s) => s.slice(0, 220)),
        (s) => s
      ),
      topics,
      terms,
    },
    protectedFacts,
    protectedSpans,
  };
}

export function buildOfflineQuiz(
  docs: ExtractedDocument[],
  questionTarget: number
): QuizQuestion[] {
  const { text, draft } = prepareDraft(docs);
  return buildQuiz(draft.terms, draft.topics, text, questionTarget);
}

export function normalizeIds(
  topics: TopicAccordion[],
  terms: TermDefinition[]
): { topics: TopicAccordion[]; terms: TermDefinition[] } {
  let seq = 0;
  const withIds = topics.map((t, ti) => {
    const topicId = typeof t.id === "string" && t.id ? t.id : `topic-${ti}`;
    const details = (t.details ?? []).map((d, di) => ({
      ...d,
      id:
        typeof d.id === "string" && d.id ? d.id : `${topicId}-detail-${di}`,
    }));
    return { ...t, id: topicId, details };
  });
  const used = new Set<string>();
  const normalizedTerms = terms.map((t) => {
    let id = typeof t.id === "string" && t.id ? t.id : `term-${seq++}`;
    if (used.has(id)) id = `${id}-${++seq}`;
    used.add(id);
    return { ...t, id };
  });
  return { topics: withIds, terms: normalizedTerms };
}

export function buildQuizFromReviewer(
  topics: TopicAccordion[],
  terms: TermDefinition[],
  keyTakeaways: string[],
  sourceText: string,
  questionTarget: number
): QuizQuestion[] {
  const pool = sourceText ? [sourceText] : [];
  const text = pool.join("\n\n");
  const withTakeaways = [...terms, ...keyTakeaways.map((t) => ({
    id: `tk-${t.slice(0, 8)}`,
    term: "",
    definition: t,
  } as TermDefinition))];
  return buildQuiz(withTakeaways, topics, text, questionTarget);
}

export function buildOfflineReviewer(
  docs: ExtractedDocument[],
  questionTarget: number
): ReviewerData {
  const { text, draft, protectedSpans } = prepareDraft(docs);

  const totalWords = docs.reduce((s, d) => s + d.wordCount, 0);
  const totalPages = docs.reduce((s, d) => s + (d.pageCount ?? 0), 0);

  const quizBank = buildQuiz(draft.terms, draft.topics, text, questionTarget);
  const { topics, terms } = normalizeIds(draft.topics, draft.terms);

  const summary: ExecutiveSummary = {
    title: draft.title,
    overview: draft.overview,
    keyTakeaways: draft.keyTakeaways,
    docCount: docs.length,
    totalPages,
    totalWords,
    targetStudyMinutes: Math.max(10, Math.round(totalWords / 220)),
  };

  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    summary,
    topics,
    terms,
    facts: factsFromSpans(protectedSpans),
    quizBank,
    engine: "offline",
    version: REVIEWER_SCHEMA_VERSION,
  };
}
