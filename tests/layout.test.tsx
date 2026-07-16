/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-require-imports */
// Protected-route and pre-confirmation analytics behavior.

import { render } from '@testing-library/react-native';

import RootLayout from '@/app/_layout';

let mockLegalAgeConfirmed = false;
let mockPathname = '/home';
const mockTrackScreen = jest.fn();

jest.mock('@expo-google-fonts/caveat', () => ({
  Caveat_600SemiBold: {},
}));

jest.mock('@expo-google-fonts/playfair-display', () => ({
  PlayfairDisplay_600SemiBold: {},
}));

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
}));

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const { Text } = require('react-native') as typeof import('react-native');

  const Stack = ({ children }: { children: import('react').ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  function MockScreen({ name }: { name: string }) {
    return React.createElement(Text, null, name);
  }
  function MockProtected({
    children,
    guard,
  }: {
    children: import('react').ReactNode;
    guard: boolean;
  }) {
    return guard ? React.createElement(React.Fragment, null, children) : null;
  }
  Stack.Screen = MockScreen;
  Stack.Protected = MockProtected;

  return {
    Stack,
    usePathname: () => mockPathname,
  };
});

jest.mock('expo-router/react-navigation', () => {
  const React = require('react') as typeof import('react');
  return {
    DefaultTheme: {},
    ThemeProvider: ({ children }: { children: import('react').ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('@/analytics/posthog', () => ({
  trackScreen: (pathname: string) => mockTrackScreen(pathname),
}));

jest.mock('@/data/legal-age', () => ({
  useLegalAgeConfirmed: () => mockLegalAgeConfirmed,
}));

describe('RootLayout legal-age route protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLegalAgeConfirmed = false;
    mockPathname = '/home';
  });

  it('keeps protected screens out of the router and analytics before confirmation', async () => {
    const view = await render(<RootLayout />);

    expect(view.getByText('index')).toBeOnTheScreen();
    expect(view.getByText('age-gate')).toBeOnTheScreen();
    expect(view.queryByText('home')).toBeNull();
    expect(view.queryByText('welcome')).toBeNull();
    expect(view.queryByText('results')).toBeNull();
    expect(view.queryByText('paywall')).toBeNull();
    expect(mockTrackScreen).not.toHaveBeenCalled();

    mockLegalAgeConfirmed = true;
    await view.rerender(<RootLayout />);

    expect(view.getByText('home')).toBeOnTheScreen();
    expect(view.getByText('welcome')).toBeOnTheScreen();
    expect(view.getByText('results')).toBeOnTheScreen();
    expect(view.getByText('paywall')).toBeOnTheScreen();
    expect(mockTrackScreen).toHaveBeenCalledWith('/home');
  });

  it('never records the age-gate screen itself', async () => {
    mockLegalAgeConfirmed = true;
    mockPathname = '/age-gate';

    await render(<RootLayout />);

    expect(mockTrackScreen).not.toHaveBeenCalled();
  });
});
