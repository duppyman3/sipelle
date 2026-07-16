/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-require-imports */
// User-facing gate behavior and legal destinations.

import { fireEvent, render } from '@testing-library/react-native';

import AgeGate from '@/app/age-gate';
import { clearLegalAgeForTesting } from '@/data/legal-age';

const mockOpenURL = jest.fn((_url: string) => Promise.resolve(true));
const mockReplace = jest.fn((_href: string) => undefined);
const mockTrack = jest.fn((_event: string, _properties?: Record<string, unknown>) => undefined);
let mockFirstName: string | null = null;

jest.mock('@/data/install-storage', () => ({}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('expo-linking', () => ({
  openURL: (url: string) => mockOpenURL(url),
}));

jest.mock('expo-router', () => ({
  router: {
    replace: (href: string) => mockReplace(href),
  },
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: { View },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/analytics/posthog', () => ({
  track: (event: string, properties?: Record<string, unknown>) => mockTrack(event, properties),
}));

jest.mock('@/components/category-art', () => ({
  CategoryArt: () => null,
}));

jest.mock('@/components/pressable-scale', () => {
  const { Pressable } = require('react-native') as typeof import('react-native');
  return { PressableScale: Pressable };
});

jest.mock('@/constants/motion', () => ({
  enterSoft: undefined,
}));

jest.mock('@/data/user-name', () => ({
  getSavedFirstName: () => mockFirstName,
}));

const values = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, String(value)),
  } satisfies Storage,
});

describe('AgeGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    values.clear();
    clearLegalAgeForTesting();
    mockFirstName = null;
  });

  it('shows legal-age, responsible-use, and legal-link messaging', async () => {
    const view = await render(<AgeGate />);

    expect(view.getByRole('header', { name: 'Before we pour' })).toBeOnTheScreen();
    expect(
      view.getByText(
        'Sipelle is for people of legal drinking age where they live. Please confirm that you meet that requirement.',
      ),
    ).toBeOnTheScreen();
    expect(view.getByText('Enjoy responsibly. Never drink and drive.')).toBeOnTheScreen();
    expect(
      view.getByText('By continuing, you agree to the Terms of Use and acknowledge the Privacy Policy.'),
    ).toBeOnTheScreen();
    expect(view.getByRole('link', { name: 'Terms of Use' })).toBeOnTheScreen();
    expect(view.getByRole('link', { name: 'Privacy Policy' })).toBeOnTheScreen();
  });

  it('persists confirmation, emits its event once, and continues new users to onboarding', async () => {
    const view = await render(<AgeGate />);
    const confirmButton = view.getByRole('button', { name: 'I’m of legal drinking age' });

    await fireEvent.press(confirmButton);
    await fireEvent.press(confirmButton);

    expect(localStorage.getItem('sipelle.legalAgeGateVersion')).toBe('1');
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('legal_age_confirmed', { gate_version: 1 });
    expect(mockReplace).toHaveBeenLastCalledWith('/welcome');
  });

  it('continues an already-onboarded user directly home', async () => {
    mockFirstName = 'Nina';
    const view = await render(<AgeGate />);

    await fireEvent.press(view.getByRole('button', { name: 'I’m of legal drinking age' }));

    expect(mockReplace).toHaveBeenCalledWith('/home');
  });

  it('blocks the current session after a decline without persisting or tracking it', async () => {
    const view = await render(<AgeGate />);

    await fireEvent.press(view.getByRole('button', { name: 'I’m not of legal drinking age' }));

    expect(view.getByRole('header', { name: 'Sipelle is for adults' })).toBeOnTheScreen();
    expect(
      view.getByText(
        'Sipelle is only available to people of legal drinking age where they live. Please close the app.',
      ),
    ).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'I’m of legal drinking age' })).toBeNull();
    expect(view.getByRole('link', { name: 'Contact support' })).toBeOnTheScreen();
    expect(localStorage.length).toBe(0);
    expect(mockTrack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    await fireEvent.press(view.getByRole('link', { name: 'Terms of Use' }));
    await fireEvent.press(view.getByRole('link', { name: 'Privacy Policy' }));
    await fireEvent.press(view.getByRole('link', { name: 'Contact support' }));

    expect(mockOpenURL).toHaveBeenNthCalledWith(1, 'https://www.sipelle.app/terms');
    expect(mockOpenURL).toHaveBeenNthCalledWith(2, 'https://www.sipelle.app/privacy');
    expect(mockOpenURL).toHaveBeenNthCalledWith(3, 'mailto:info@sipelle.app');
  });
});
