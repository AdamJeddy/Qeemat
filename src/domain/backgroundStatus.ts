import AsyncStorage from '@react-native-async-storage/async-storage';

import { nowIso } from './dates';

const BACKGROUND_STATUS_KEY = 'qeemat.background-status.v1';
const DEFAULT_PREFERRED_HOUR = 9;

export type BackgroundStatus = {
  preferredHour: number;
  lastScheduledAt?: string;
  lastStartedAt?: string;
  lastCompletedAt?: string;
  lastSource?: string;
  lastForceRun?: boolean;
  lastRunError?: string;
};

const DEFAULT_BACKGROUND_STATUS: BackgroundStatus = {
  preferredHour: DEFAULT_PREFERRED_HOUR
};

export async function getBackgroundStatus(): Promise<BackgroundStatus> {
  const raw = await AsyncStorage.getItem(BACKGROUND_STATUS_KEY);
  if (!raw) {
    return DEFAULT_BACKGROUND_STATUS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BackgroundStatus>;
    return {
      ...DEFAULT_BACKGROUND_STATUS,
      ...parsed,
      preferredHour: normalizePreferredHour(parsed.preferredHour)
    };
  } catch {
    return DEFAULT_BACKGROUND_STATUS;
  }
}

export async function setBackgroundPreferredHour(preferredHour: number): Promise<BackgroundStatus> {
  const existing = await getBackgroundStatus();
  const next = {
    ...existing,
    preferredHour: normalizePreferredHour(preferredHour)
  };
  await AsyncStorage.setItem(BACKGROUND_STATUS_KEY, JSON.stringify(next));
  return next;
}

export async function markBackgroundSchedule(preferredHour: number): Promise<BackgroundStatus> {
  return updateBackgroundStatus({
    preferredHour: normalizePreferredHour(preferredHour),
    lastScheduledAt: nowIso(),
    lastRunError: undefined
  });
}

export async function markBackgroundRunStarted(source: string, force = false): Promise<BackgroundStatus> {
  return updateBackgroundStatus({
    lastStartedAt: nowIso(),
    lastSource: source,
    lastForceRun: force,
    lastRunError: undefined
  });
}

export async function markBackgroundRunCompleted(): Promise<BackgroundStatus> {
  return updateBackgroundStatus({
    lastCompletedAt: nowIso(),
    lastRunError: undefined
  });
}

export async function markBackgroundRunFailed(message: string): Promise<BackgroundStatus> {
  return updateBackgroundStatus({
    lastRunError: message
  });
}

async function updateBackgroundStatus(partial: Partial<BackgroundStatus>): Promise<BackgroundStatus> {
  const existing = await getBackgroundStatus();
  const next = {
    ...existing,
    ...partial
  };
  await AsyncStorage.setItem(BACKGROUND_STATUS_KEY, JSON.stringify(next));
  return next;
}

function normalizePreferredHour(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_PREFERRED_HOUR;
  }

  return Math.min(23, Math.max(0, Math.round(value)));
}
