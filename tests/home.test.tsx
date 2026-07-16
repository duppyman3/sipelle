/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-require-imports */
// Responsible-use footer and development reset behavior.

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import Home from '@/app/home';

const mockClearFirstName = jest.fn();
const mockClearLegalAge = jest.fn();
const mockClearPremium = jest.fn();
const mockReplace = jest.fn((_href: string) => undefined);

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return { LinearGradient: View };
});

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  return {
    Redirect: () => null,
    router: { replace: (href: string) => mockReplace(href) },
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(callback, [callback]);
    },
  };
});

jest.mock('lucide-react-native', () => ({
  Camera: () => null,
  RotateCcw: () => null,
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

jest.mock('@/components/category-chip', () => ({
  CategoryChip: () => null,
}));

jest.mock('@/components/pressable-scale', () => {
  const { Pressable } = require('react-native') as typeof import('react-native');
  return { PressableScale: Pressable };
});

jest.mock('@/components/system-down-card', () => {
  const React = require('react') as typeof import('react');
  const { Text } = require('react-native') as typeof import('react-native');
  return {
    SystemDownCard: () => React.createElement(Text, null, 'SYSTEM DOWN'),
  };
});

jest.mock('@/constants/motion', () => ({
  enterSoft: undefined,
}));

jest.mock('@/data/app-status', () => ({
  fetchAppStatus: () => Promise.resolve({ down: true, message: 'Maintenance' }),
}));

jest.mock('@/data/legal-age', () => ({
  clearLegalAgeForTesting: () => mockClearLegalAge(),
}));

jest.mock('@/data/menu', () => ({
  CATEGORIES: [
    { id: 'one' },
    { id: 'two' },
    { id: 'three' },
    { id: 'four' },
    { id: 'five' },
  ],
}));

jest.mock('@/data/premium', () => ({
  clearPremiumForTesting: () => mockClearPremium(),
}));

jest.mock('@/data/scan-menu', () => ({
  scanMenu: jest.fn(),
}));

jest.mock('@/data/user-name', () => ({
  clearFirstName: () => mockClearFirstName(),
  getSavedFirstName: () => 'Nina',
}));

describe('Home responsible-use behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the responsible-use footer during maintenance and resets the age gate in development', async () => {
    const view = await render(<Home />);

    await waitFor(() => expect(view.getByText('SYSTEM DOWN')).toBeOnTheScreen());
    expect(view.getByText('Enjoy responsibly. Never drink and drive.')).toBeOnTheScreen();

    await fireEvent.press(view.getByRole('button', { name: 'Reset onboarding' }));

    expect(mockClearFirstName).toHaveBeenCalledTimes(1);
    expect(mockClearPremium).toHaveBeenCalledTimes(1);
    expect(mockClearLegalAge).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
