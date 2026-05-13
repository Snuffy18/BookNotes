let pendingBookId: string | null = null;

export function requestOpenPageScanModal(bookId: string): void {
  pendingBookId = bookId;
}

export function takePendingOpenPageScanModal(): string | null {
  const bookId = pendingBookId;
  pendingBookId = null;
  return bookId;
}
