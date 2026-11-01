/**
 * Runs the boot steps that can fail. Quit handling is wired first, so a step that rejects (or
 * throws) is reported to `onError` and boot carries on; quitting always flushes the save.
 */
export async function boot(
  wireQuit: () => Promise<void>,
  steps: readonly (() => Promise<void>)[],
  onError: (e: unknown) => void,
): Promise<void> {
  await wireQuit();
  for (const step of steps) {
    try {
      await step();
    } catch (e) {
      onError(e);
    }
  }
}
