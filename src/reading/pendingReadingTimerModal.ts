let pendingOpenReadingTimerModal = false;

export function requestOpenReadingTimerModal(): void {
  pendingOpenReadingTimerModal = true;
}

export function takePendingOpenReadingTimerModal(): boolean {
  const pending = pendingOpenReadingTimerModal;
  pendingOpenReadingTimerModal = false;
  return pending;
}
