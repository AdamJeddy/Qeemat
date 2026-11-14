import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { AppText } from './AppText';
import { AppTextInput } from './AppTextInput';
import { DiscoveryFilterChip } from './Discovery';
import { PrimaryButton } from './PrimaryButton';
import { DISCOVERY_CATEGORY_LABELS } from '../domain/discovery';
import { getSiteByKey } from '../domain/sites';
import { DiscoveryCategory, SiteKey } from '../domain/types';
import { colors, layoutMetrics, radius, spacing } from '../theme/theme';

export type SearchFilters = {
  category?: DiscoveryCategory;
  siteKey?: SiteKey;
  brand?: string;
  maximumPrice: string;
};

export type SearchFilterSheetProps = {
  visible: boolean;
  filters: SearchFilters;
  departments: DiscoveryCategory[];
  stores: { siteKey: SiteKey; count: number }[];
  brands: string[];
  resultCount: number;
  onChangeFilters: (next: SearchFilters) => void;
  onClear: () => void;
  onClose: () => void;
};

/** Brand chips stay scannable on a phone; the full list lives in the browse sheet. */
const MAX_BRAND_CHIPS = 20;

export function SearchFilterSheet({
  visible,
  filters,
  departments,
  stores,
  brands,
  resultCount,
  onChangeFilters,
  onClear,
  onClose
}: SearchFilterSheetProps) {
  const { height } = useWindowDimensions();
  const update = (patch: Partial<SearchFilters>) => onChangeFilters({ ...filters, ...patch });
  const brandChoices = brands.filter(Boolean).slice(0, MAX_BRAND_CHIPS);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable accessible={false} importantForAccessibility="no" style={styles.backdrop} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { maxHeight: height * 0.85 }]}>
          <View style={styles.header}>
            <AppText weight="bold" accessibilityRole="header" style={styles.headerTitle}>Filter products</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={onClose} style={styles.closeButton}>
              <X size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <AppText muted style={styles.summary}>{resultCount} products</AppText>

            <View style={styles.section}>
              <AppText weight="semibold" style={styles.sectionTitle}>Department</AppText>
              <View style={styles.chips}>
                <DiscoveryFilterChip
                  label="All departments"
                  selected={!filters.category}
                  onPress={() => update({ category: undefined })}
                />
                {departments.map((category) => (
                  <DiscoveryFilterChip
                    key={category}
                    label={DISCOVERY_CATEGORY_LABELS[category]}
                    selected={filters.category === category}
                    onPress={() => update({ category: filters.category === category ? undefined : category })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <AppText weight="semibold" style={styles.sectionTitle}>Store</AppText>
              <View style={styles.chips}>
                <DiscoveryFilterChip
                  label="All stores"
                  selected={!filters.siteKey}
                  onPress={() => update({ siteKey: undefined })}
                />
                {stores.map((store) => (
                  <DiscoveryFilterChip
                    key={store.siteKey}
                    label={`${getSiteByKey(store.siteKey).shortName} (${store.count})`}
                    selected={filters.siteKey === store.siteKey}
                    onPress={() => update({ siteKey: filters.siteKey === store.siteKey ? undefined : store.siteKey })}
                  />
                ))}
              </View>
            </View>

            {brandChoices.length ? (
              <View style={styles.section}>
                <AppText weight="semibold" style={styles.sectionTitle}>Brand</AppText>
                <View style={styles.chips}>
                  <DiscoveryFilterChip label="Any brand" selected={!filters.brand} onPress={() => update({ brand: undefined })} />
                  {brandChoices.map((brand) => (
                    <DiscoveryFilterChip
                      key={brand}
                      label={brand}
                      selected={filters.brand === brand}
                      onPress={() => update({ brand: filters.brand === brand ? undefined : brand })}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <AppText weight="semibold" style={styles.sectionTitle}>Maximum price</AppText>
              <AppTextInput
                accessibilityLabel="Maximum price"
                value={filters.maximumPrice}
                onChangeText={(maximumPrice) => update({ maximumPrice })}
                keyboardType="decimal-pad"
                placeholder="Maximum price (AED)"
                leading={<AppText muted>AED</AppText>}
              />
            </View>

            <PrimaryButton label="Clear filters" variant="outline" onPress={onClear} />
          </ScrollView>

          <View style={styles.footer}>
            <PrimaryButton label="Show results" onPress={onClose} />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden'
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  headerTitle: {
    flex: 1,
    fontSize: 18
  },
  closeButton: {
    width: layoutMetrics.touchTarget,
    height: layoutMetrics.touchTarget,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scroll: {
    flexShrink: 1
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg
  },
  summary: {
    fontSize: 13,
    lineHeight: 18
  },
  section: {
    gap: spacing.sm
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 19
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  }
});
