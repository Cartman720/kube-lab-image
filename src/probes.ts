export type ProbeName = "healthz" | "readyz" | "livez";

export interface ProbeStatus {
  probe: ProbeName;
  ok: boolean;
  delaySeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  since: number; // epoch ms when probe started
}

export interface ProbeManagerOptions {
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
}

/**
 * Creates a probe manager with the given options.
 * Randomly delays the startup of each probe between the min and max delay seconds.
 * @param options - The options for the probe manager.
 * @returns The probe manager with the given options.
 */
export function createProbeManager(options: ProbeManagerOptions = {}) {
  const minDelaySeconds = Math.max(0, options.minDelaySeconds ?? 15);
  const maxDelaySeconds = Math.max(minDelaySeconds, options.maxDelaySeconds ?? 60);

  const startedAtMs = Date.now();

  const randomDelay = (): number => {
    const range = maxDelaySeconds - minDelaySeconds;
    return minDelaySeconds + Math.floor(Math.random() * (range + 1));
  };

  const delays: Record<ProbeName, number> = {
    healthz: randomDelay(),
    readyz: randomDelay(),
    livez: randomDelay(),
  };

  function getStatus(probe: ProbeName): ProbeStatus {
    const delaySeconds = delays[probe];
    const elapsedSeconds = Math.floor((Date.now() - startedAtMs) / 1000);
    const remainingSeconds = Math.max(0, delaySeconds - elapsedSeconds);
    const ok = remainingSeconds === 0;

    return {
      probe,
      ok,
      delaySeconds,
      elapsedSeconds,
      remainingSeconds,
      since: startedAtMs,
    };
  }

  return { getStatus };
}



