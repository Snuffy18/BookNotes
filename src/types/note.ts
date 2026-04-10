export type GeneratedNotes = {
  summary: string;
  mainIdeas: string[];
  detailedNotes: string;
  keywords: string[];
};

export type ScanItem = {
  id: string;
  createdAt: string;
  imageUri: string;
  bookId?: string;
  book?: string;
  chapter?: string;
  notes: GeneratedNotes;
};

export type BookItem = {
  id: string;
  title: string;
  author: string;
  coverUri: string;
  createdAt: string;
};

export type BookReport = {
  book: BookItem;
  scans: ScanItem[];
};
