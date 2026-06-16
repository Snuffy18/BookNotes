/** A user-set goal to finish a book by a target date. One plan per book. */
export type ReadingPlan = {
  bookId: string;
  /** Page the reader was on when the plan was created (progress baseline). */
  startPage: number;
  /** Local-midnight ISO date the reader wants to finish by. */
  targetFinishDate: string;
  /** ISO timestamp the plan was created. */
  createdAt: string;
};

export type ReadingPlansSnapshot = ReadingPlan[];
