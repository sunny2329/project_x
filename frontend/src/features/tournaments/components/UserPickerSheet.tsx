import { useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { usersApi } from '@/features/profile/api/profile.api';
import type { UserSummary } from '@/features/profile/types';
import { useDebounced } from '@/shared/hooks/useCountdown';
import { useOpened, useSearch } from '@/shared/hooks/useSearch';
import { useTheme } from '@/shared/theme';
import { Avatar, SearchField, Sheet, T, Tap } from '@/shared/ui';

/** A sheet to find a registered player (staff invites, court scorers). `header` goes above the search. */
export function UserPickerSheet({ visible, title, sub, header, actionLabel = 'Add', onPick, onClose, footer }: { visible: boolean; title: string; sub?: string; header?: ReactNode; actionLabel?: string; onPick: (user: UserSummary) => void; onClose: () => void; footer?: ReactNode }) {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim(), 300);
  const { results: users, loading } = useSearch<UserSummary>(query, (text) => usersApi.search(text).then((r) => r.users));
  if (useOpened(visible)) setQ('');

  return (
    <Sheet visible={visible} onClose={onClose} height="85%">
      <T size={20} w={700}>
        {title}
      </T>
      {sub ? (
        <T size={13} color={colors.muted}>
          {sub}
        </T>
      ) : null}
      {header}
      <View style={{ flexDirection: 'row' }}>
        <SearchField value={q} onChangeText={setQ} placeholder="Search by name or @username" background={colors.bg} />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      <View>
        {users.map((u) => (
          <Tap key={u.id} label={`${actionLabel} ${u.fullName}`} onPress={() => onPick(u)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
            <Avatar name={u.fullName} id={u.id} photoUrl={u.photoUrl} size={44} />
            <View style={{ flex: 1 }}>
              <T size={15} w={700}>
                {u.fullName}
              </T>
              <T size={13} color={colors.muted}>
                @{u.username}
              </T>
            </View>
            <View style={{ height: 34, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primary, justifyContent: 'center' }}>
              <T size={14} w={700} color={colors.onPrimary}>
                {actionLabel}
              </T>
            </View>
          </Tap>
        ))}
      </View>
      {footer}
    </Sheet>
  );
}
