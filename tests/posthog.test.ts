/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-require-imports */
// PostHog must remain uninitialized until confirmation.

let mockLegalAgeConfirmed = false;

const mockCapture = jest.fn();
const mockCaptureException = jest.fn();
const mockDebug = jest.fn();
const mockIdentify = jest.fn();
const mockScreen = jest.fn();
const mockClient = {
  capture: mockCapture,
  captureException: mockCaptureException,
  debug: mockDebug,
  identify: mockIdentify,
  screen: mockScreen,
};
const mockPostHogConstructor = jest.fn(() => mockClient);

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: mockPostHogConstructor,
}));

jest.mock('@/data/device-id', () => ({
  getDeviceId: () => 'test-device',
}));

jest.mock('@/data/legal-age', () => ({
  getLegalAgeConfirmed: () => mockLegalAgeConfirmed,
}));

describe('PostHog legal-age guard', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockLegalAgeConfirmed = false;
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'test-key';
    process.env.EXPO_PUBLIC_POSTHOG_HOST = 'https://posthog.example';
  });

  it('does not initialize before confirmation and can initialize afterward', () => {
    let analytics!: typeof import('@/analytics/posthog');
    jest.isolateModules(() => {
      analytics = require('@/analytics/posthog') as typeof import('@/analytics/posthog');
    });

    analytics.track('blocked_event');
    analytics.trackScreen('/age-gate');
    analytics.trackError(new Error('blocked'));

    expect(mockPostHogConstructor).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockScreen).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();

    mockLegalAgeConfirmed = true;
    analytics.track('legal_age_confirmed', { gate_version: 1 });

    expect(mockPostHogConstructor).toHaveBeenCalledTimes(1);
    expect(mockIdentify).toHaveBeenCalledWith('test-device');
    expect(mockCapture).toHaveBeenCalledWith('legal_age_confirmed', { gate_version: 1 });

    analytics.trackScreen('/home');
    analytics.track('later_event');

    expect(mockPostHogConstructor).toHaveBeenCalledTimes(1);
    expect(mockScreen).toHaveBeenCalledWith('/home');
    expect(mockCapture).toHaveBeenCalledWith('later_event', undefined);
  });
});
