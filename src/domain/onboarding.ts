import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'qeemat.onboarding.v1';

type OnboardingState = {
  completed: boolean;
  completedAt?: string;
};

const DEFAULT_STATE: OnboardingState = {
  completed: false
};

export async function getOnboardingState(): Promise<OnboardingState> {
  const raw = await AsyncStorage.getItem(ONBOARDING_KEY);
  if (!raw) {
    return DEFAULT_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    if (parsed.completed === true) {
      return { completed: true, completedAt: parsed.completedAt };
    }
    return DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export async function markOnboardingCompleted(): Promise<void> {
  await AsyncStorage.setItem(
    ONBOARDING_KEY,
    JSON.stringify({ completed: true, completedAt: new Date().toISOString() })
  );
}

export async function resetOnboarding(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_KEY);
}
