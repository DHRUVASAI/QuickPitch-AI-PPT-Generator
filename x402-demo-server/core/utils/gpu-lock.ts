/**
 * Global GPU Lock & Memory Management
 * Ensures mutual exclusion between Whisper (speech-to-text) and Qwen (Ollama LLM)
 * on single-GPU hardware (RTX 4060 8GB).
 */

export class GPULock {
  private locked: boolean = false;
  private queue: Array<() => void> = [];

  async acquire(taskName: string = 'GPU-Task'): Promise<() => void> {
    if (this.locked) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.locked = true;
    let released = false;

    return () => {
      if (!released) {
        released = true;
        this.locked = false;
        const next = this.queue.shift();
        if (next) {
          this.locked = true;
          next();
        }
      }
    };
  }

  isLocked(): boolean {
    return this.locked;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export const gpuLock = new GPULock();
