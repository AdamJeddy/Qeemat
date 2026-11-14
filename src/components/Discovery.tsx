import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from './AppText';
import { colors, radius } from '../theme/theme';

/** Shared compact filter chip used by the Search filters and store rails. */
export function DiscoveryFilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}>
      <AppText weight="semibold" style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filterChip: { minHeight: 44, justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8 },
  filterChipSelected: { borderColor: colors.primary, backgroundColor: colors.blueSoft },
  filterChipText: { fontSize: 13 },
  filterChipTextSelected: { color: colors.primary },
  pressed: { opacity: 0.82 }
});
