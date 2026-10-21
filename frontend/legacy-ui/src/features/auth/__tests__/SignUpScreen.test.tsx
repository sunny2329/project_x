import { fireEvent, render, screen } from '@testing-library/react-native';
import SignUpScreen from '../screens/SignUpScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() },
}));

describe('SignUpScreen', () => {
  it('keeps Sign up disabled until every field is filled', async () => {
    await render(<SignUpScreen />);
    expect(screen.getByText('Create an Account')).toBeTruthy();
    const button = () => screen.getByRole('button', { name: 'Sign up' });
    const fields: [string, string][] = [
      ['Full name', 'Aarav Shah'],
      ['Username', 'aarav'],
      ['Email', 'aarav@example.com'],
      ['Phone number', '98765 43210'],
      ['Password', 'Sprint2026'],
      ['Confirm password', 'Sprint2026'],
    ];
    for (const [placeholder, value] of fields) {
      expect(button()).toBeDisabled();
      await fireEvent.changeText(screen.getByPlaceholderText(placeholder), value);
    }
    expect(button()).toBeEnabled();
  });
});
