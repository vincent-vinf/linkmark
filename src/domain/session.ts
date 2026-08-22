export class UnlockSession {
  private locked = false;

  public constructor(
    private readonly unlockedAt: number,
    private readonly durationMs: number,
    private readonly onLock?: () => void,
  ) {}

  public isLocked(now = Date.now()): boolean {
    if (!this.locked && now >= this.unlockedAt + this.durationMs) this.lock();
    return this.locked;
  }

  public recordActivity(now = Date.now()): void {
    this.isLocked(now);
  }

  public lock(): void {
    if (this.locked) return;
    this.locked = true;
    this.onLock?.();
  }
}
