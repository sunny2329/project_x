import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useCountdown } from '@/shared/hooks/useCountdown';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, CodeBoxes, D, Icon, IconButton, Notice, Row, Screen, StepDots, T, TextButton } from '@/shared/ui';
import { prettyPhone } from '@/shared/utils/format';

/**
 * "Enter the code": six boxes, a 10-minute note, a resend countdown. Used for sign-up (step 2 of 4)
 * and for logging in with a text code (no steps).
 */
export function CodeScreen({
  phone,
  step,
  onVerify,
  onResend,
  onChangeNumber,
}: {
  phone: string;
  step?: number;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onChangeNumber: () => void;
}) {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const countdown = useCountdown(60);
  const { submit, submitting, formError } = useSubmit();
  const resend = useSubmit();

  const verify = (value = code) => {
    if (value.length !== 6) return;
    void submit(() => onVerify(value));
  };
  useEffect(() => {
    if (code.length === 6) verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <Screen px={24} gap={28} bottom={20}>
      <Row between>
        <IconButton icon="back" label="Back" onPress={onChangeNumber} />
        {step ? <StepDots step={step} /> : null}
        <View style={{ width: 44 }} />
      </Row>

      <View style={{ gap: 8 }}>
        <D size={44} lh={44} upper accessibilityRole="header">
          Enter the code
        </D>
        <T size={15} lh={22} color={colors.muted}>
          We sent 6 digits to <T w={700}>{prettyPhone(phone)}</T>.{' '}
          <T size={15} color={colors.fg} style={{ textDecorationLine: 'underline' }} onPress={onChangeNumber} accessibilityRole="link">
            Change
          </T>
        </T>
      </View>

      <View style={{ gap: 14 }}>
        <CodeBoxes value={code} onChange={setCode} />
        <Row between>
          <Row gap={6}>
            <Icon name="clock" size={16} color={colors.muted} />
            <T size={14} color={colors.muted}>
              Code works for 10 minutes
            </T>
          </Row>
          {countdown.done ? (
            <TextButton
              label="Resend code"
              size={14}
              onPress={() =>
                void resend.submit(async () => {
                  await onResend();
                  countdown.restart();
                })
              }
            />
          ) : (
            <T size={14} color={colors.muted}>
              Resend in {countdown.label}
            </T>
          )}
        </Row>
        {formError || resend.formError ? <Notice tone="error" icon="alert" text={(formError ?? resend.formError)!} /> : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 12, padding: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.surface }}>
        <Icon name="phone" size={20} color={colors.fg} />
        <T size={13} lh={19} color={colors.muted} flex>
          The code fills in by itself on most phones. You can ask for 5 codes an hour.
        </T>
      </View>

      <View style={{ marginTop: 'auto' }}>
        <Button label="Verify" weight={700} onPress={() => verify()} loading={submitting} disabled={code.length !== 6} />
      </View>
    </Screen>
  );
}
