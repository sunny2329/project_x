import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import WelcomeScreen from '../screens/WelcomeScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('WelcomeScreen', () => {
  it('shows the slides and opens sign-up or log-in', async () => {
    await render(<WelcomeScreen />);
    expect(screen.getByText('Get motivation from your people.')).toBeTruthy();
    expect(screen.getByLabelText('Slide 1 of 4')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Join for free' }));
    await fireEvent.press(screen.getByText('Log In'));
    expect(jest.mocked(router.push).mock.calls.map(([route]) => route)).toEqual(['/sign-up', '/sign-in']);
  });
});
