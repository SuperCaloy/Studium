import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ExtractedDocument, ReviewerData } from "./types";
import { REVIEWER_SCHEMA_VERSION } from "./types";

interface MetaRow {
  key: string;
  value: unknown;
}

interface ReviewerDB extends DBSchema {
  documents: {
    key: string;
    value: ExtractedDocument;
  };
  reviewers: {
    key: string;
    value: ReviewerData;
  };
  meta: {
    key: string;
    value: MetaRow;
  };
}

const DB_NAME = "reviewer-generator";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ReviewerDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ReviewerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ReviewerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("documents")) {
          db.createObjectStore("documents", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("reviewers")) {
          db.createObjectStore("reviewers", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveDocuments(docs: ExtractedDocument[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("documents", "readwrite");
  await Promise.all(docs.map((d) => tx.store.put(d)));
  await tx.done;
}

export async function loadDocuments(): Promise<ExtractedDocument[]> {
  const db = await getDB();
  return db.getAll("documents");
}

export async function removeDocument(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("documents", id);
}

export async function clearDocuments(): Promise<void> {
  const db = await getDB();
  await db.clear("documents");
}

export async function saveReviewer(reviewer: ReviewerData): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("reviewers", "readwrite");
  const existing = await tx.store.getAll();
  for (const r of existing) {
    if (r.id !== reviewer.id) await tx.store.delete(r.id);
  }
  await tx.store.put(reviewer);
  await tx.done;
}

export async function loadReviewers(): Promise<ReviewerData[]> {
  const db = await getDB();
  return db.getAll("reviewers");
}

export async function loadLatestReviewer(): Promise<ReviewerData | null> {
  const reviewers = await loadReviewers();
  if (reviewers.length === 0) return null;
  const latest = reviewers.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if ((latest.version ?? 1) !== REVIEWER_SCHEMA_VERSION) {
    await clearReviewers();
    return null;
  }
  return latest;
}

export async function clearReviewers(): Promise<void> {
  const db = await getDB();
  await db.clear("reviewers");
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["documents", "reviewers"], "readwrite");
  await Promise.all([
    tx.objectStore("documents").clear(),
    tx.objectStore("reviewers").clear(),
  ]);
  await tx.done;
}
