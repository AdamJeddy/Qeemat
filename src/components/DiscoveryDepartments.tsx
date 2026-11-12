import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { DISCOVERY_CATEGORY_LABELS } from '../domain/discovery';
import { DiscoveryCategory, DiscoveryProduct } from '../domain/types';
import { colors, radius } from '../theme/theme';

const DEFAULT_DEPARTMENTS: DiscoveryCategory[] = ['footwear', 'phones', 'skincare', 'fragrance', 'clothing', 'fresh_food'];
export function DiscoveryDepartments({ selected, preferredCategories = [], onSelect, onBrowse }: {
  selected?: DiscoveryCategory;
  products: DiscoveryProduct[];
  preferredCategories?: DiscoveryCategory[];
  onSelect: (category: DiscoveryCategory) => void;
  onBrowse: () => void;
}) {
  const departments = [...new Set([...(selected ? [selected] : []), ...preferredCategories, ...DEFAULT_DEPARTMENTS])];

  return <View style={styles.section}>
    <View style={styles.heading}>
      <AppText weight="bold" style={styles.title}>Departments</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel="Browse all departments and retailers" onPress={onBrowse} style={styles.browse}>
        <AppText style={styles.link}>All departments</AppText>
      </Pressable>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grid}>
      {departments.map((department) => {
        const label = DISCOVERY_CATEGORY_LABELS[department];
        return <Pressable key={department} accessibilityRole="button" accessibilityLabel={`Browse ${label}`} accessibilityState={{ selected: selected === department }} onPress={() => onSelect(department)} style={({ pressed }) => [styles.tile, selected === department && styles.selected, pressed && styles.pressed]}>
          <AppText weight="semibold" numberOfLines={1} style={styles.label}>{label}</AppText>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, flex: 1 },
  browse: { minHeight: 44, justifyContent: 'center' },
  link: { color: colors.primary, fontSize: 13 },
  grid: { flexDirection: 'row', gap: 8 },
  tile: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  selected: { backgroundColor: colors.blueSoft, borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  label: { textAlign: 'center', fontSize: 13 }
});
