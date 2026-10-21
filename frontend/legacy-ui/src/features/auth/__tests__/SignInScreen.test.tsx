import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import SignInScreen from '../screens/SignInScreen';
import { useAuthStore } from '../store/auth.store';
import { authResult, fail, ok } from './test-utils';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('../social/google', () => ({ getGoogleIdToken: jest.fn(), signOutOfGoogle: jest.fn() }));
jest.mock('../social/apple', () => ({ getAppleCredential: jest.fn(), isAppleSignInAvailable: jest.fn(async () => false) }));

const fetchMock = jest.fn();
global.fetch = fetchMock;

beforeEach(() => {
  fetchMock.mockReset();
  jest.mocked(router.push).mockClear();
  useAuthStore.setState({ status: 'unauthenticated', user: null });
});

async function renderScreen() {
  await render(<SignInScreen />);
  await screen.findByText('Log In to ProjectX');
}

describe('SignInScreen', () => {
  it('renders the design elements', async () => {
    await renderScreen();
    for (const text of ['Forgot password?', 'Log In', 'Continue with Google', 'Continue with phone', 'New here?', 'Create an account']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    // The decorative divider is hidden from screen readers.
    expect(screen.getByText('or', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByPlaceholderText('Username, email or phone')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
  });

  it('keeps Log In disabled until both fields are filled', async () => {
    await renderScreen();
    const button = () => screen.getByRole('button', { name: 'Log In' });
    expect(button()).toBeDisabled();
    await fireEvent.changeText(screen.getByPlaceholderText('Username, email or phone'), 'athlete');
    expect(button()).toBeDisabled();
    await fireEvent.changeText(screen.getByPlaceholderText('Password'), 'Sprint2026');
    expect(button()).toBeEnabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the server error for wrong credentials', async () => {
    fetchMock.mockResolvedValueOnce(fail(401, 'INVALID_CREDENTIALS', 'Incorrect email/phone or password.'));
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText('Username, email or phone'), 'athlete@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Log In' }));
    expect(await screen.findByText('Incorrect email/phone or password.')).toBeTruthy();
  });

  it('shows a friendly message when the server is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText('Username, email or phone'), 'athlete@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('Password'), 'Sprint2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Log In' }));
    expect(await screen.findByText(/Can't reach ProjectX/)).toBeTruthy();
  });

  it('signs in with a phone number normalized to E.164', async () => {
    fetchMock.mockResolvedValueOnce(ok(authResult()));
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText('Username, email or phone'), '98765 43210');
    await fireEvent.changeText(screen.getByPlaceholderText('Password'), 'Sprint2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Log In' }));

    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.identifier).toBe('+919876543210');
  });

  it('navigates to the other auth screens', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Create an account'));
    await fireEvent.press(screen.getByText('Forgot password?'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with phone' }));
    expect(jest.mocked(router.push).mock.calls.map(([route]) => route)).toEqual(['/sign-up', '/forgot-password', '/phone']);
  });
});
