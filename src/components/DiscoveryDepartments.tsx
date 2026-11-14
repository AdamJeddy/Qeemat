import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText } from './AppText';
import { DISCOVERY_CATEGORY_LABELS } from '../domain/discovery';
import { DiscoveryCategory } from '../domain/types';
import { colors, layoutMetrics, radius } from '../theme/theme';

const DEFAULT_DEPARTMENTS: DiscoveryCategory[] = ['footwear', 'phones', 'skincare', 'fragrance', 'clothing', 'fresh_food'];

/** Compact department rail under the Search banner. */
export function DiscoveryDepartments({
  selected,
  forYou = false,
  preferredCategories = [],
  onSelect,
  onForYou,
  onBrowse
}: {
  selected?: DiscoveryCategory;
  forYou?: boolean;
  preferredCategories?: DiscoveryCategory[];
  onSelect: (category: DiscoveryCategory) => void;
  onForYou: () => void;
  onBrowse: () => void;
}) {
  const departments = [...new Set([...(selected ? [selected] : []), ...preferredCategories, ...DEFAULT_DEPARTMENTS])];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show watchlist picks"
        accessibilityState={{ selected: forYou }}
        onPress={onForYou}
        style={({ pressed }) => [styles.chip, forYou && styles.chipSelected, pressed && styles.pressed]}
      >
        <AppText weight="semibold" style={[styles.chipText, forYou && styles.chipTextSelected]}>For you</AppText>
      </Pressable>
      {departments.map((department) => {
        const label = DISCOVERY_CATEGORY_LABELS[department];
        const active = selected === department;
        return (
          <Pressable
            key={department}
            accessibilityRole="button"
            accessibilityLabel={`Browse ${label}`}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(department)}
            style={({ pressed }) => [styles.chip, active && styles.chipSelected, pressed && styles.pressed]}
          >
            <AppText weight="semibold" numberOfLines={1} style={[styles.chipText, active && styles.chipTextSelected]}>{label}</AppText>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Browse all departments and retailers"
        onPress={onBrowse}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        <AppText weight="semibold" style={styles.linkText}>All departments</AppText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: {
    minHeight: layoutMetrics.touchTarget,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.blueSoft },
  chipText: { fontSize: 13, color: colors.text },
  chipTextSelected: { color: colors.primary },
  linkText: { fontSize: 13, color: colors.primary },
  pressed: { opacity: 0.8 }
});
