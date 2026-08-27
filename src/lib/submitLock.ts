// Re-entrancy guard for submit handlers. A fresh lock must be created per
// component instance (useRef) so a double click / double Enter in the same
// tick can only ever start ONE submission. Backend idempotency cannot protect
// two distinct submissions because each one carries its own generated id and
// idempotency key, so the UI is the only place that can gate duplicate intents.

export class SubmitLock {
  private locked = false;

  acquire(): boolean {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  release(): void {
    this.locked = false;
  }
}