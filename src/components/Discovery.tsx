import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, EyeOff, Plus, Sparkles, X } from 'lucide-react-native';

import { AppText } from './AppText';
import { PrimaryButton } from './PrimaryButton';
import { formatRelativeTime } from '../domain/dates';
import { DISCOVERY_CATEGORY_LABELS, DISCOVERY_COLLECTIONS, preferredDiscoveryBrands } from '../domain/discovery';
import { cleanUrl, getSiteByKey } from '../domain/sites';
import { DiscoveryCategory, DiscoveryPreferences, DiscoveryProduct, TrackedProduct } from '../domain/types';
import { parseTargetPriceInput } from '../domain/price';
import { formatPrice } from '../domain/price';
import { colors, radius } from '../theme/theme';

export function DiscoverySetupCard({ onPress, onDismiss }: { onPress: () => void; onDismiss: () => void }) {
  return (
    <View style={styles.setupCard}>
      <View style={styles.setupIcon}>
        <Sparkles size={22} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <AppText weight="bold" style={styles.setupTitle}>Make For You yours</AppText>
        <AppText muted style={styles.setupCopy}>Choose a few interests, brands, and budgets. You can change them anytime.</AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Personalize discovery" onPress={onPress} style={styles.setupAction}>
        <ChevronRight size={20} color={colors.primary} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss personalized discovery" onPress={onDismiss} style={styles.setupDismiss}>
        <X size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

export function EmptyDiscovery({ onPreferences }: { onPreferences: () => void }) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Sparkles size={24} color={colors.primary} />
      </View>
      <AppText weight="bold" style={styles.emptyTitle}>Fresh finds are on the way</AppText>
      <AppText muted style={styles.emptyCopy}>Pull to refresh. If a retailer is temporarily unavailable, Qeemat keeps the last products saved on this device.</AppText>
      <PrimaryButton label="Choose interests" variant="outline" onPress={onPreferences} style={styles.emptyButton} />
    </View>
  );
}

export function DiscoveryFilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}>
      <AppText weight="semibold" style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</AppText>
    </Pressable>
  );
}

export function DiscoveryProductGrid({
  products,
  trackedProducts,
  trackingProductId,
  onTrack,
  onDismiss,
  onMoreLikeThis,
  onViewAtRetailer
}: {
  products: DiscoveryProduct[];
  trackedProducts: TrackedProduct[];
  trackingProductId?: string;
  onTrack: (product: DiscoveryProduct) => Promise<void>;
  onDismiss: (productId: string) => Promise<void>;
  onMoreLikeThis: (brand: string) => void;
  onViewAtRetailer: (product: DiscoveryProduct) => Promise<void>;
}) {
  if (!products.length) {
    return <AppText muted style={styles.emptyFilter}>No products match these filters yet.</AppText>;
  }

  return (
    <View style={styles.grid}>
      {products.map((product) => {
        const tracked = trackedProducts.find((item) => cleanUrl(item.canonicalUrl || item.url) === cleanUrl(product.url));
        const tracking = trackingProductId === product.id;
        return (
          <View key={product.id} style={styles.productCard}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Show more ${product.brand} products`} onPress={() => onMoreLikeThis(product.brand)} style={styles.productImageWrap}>
              {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.productImage} resizeMode="contain" /> : <Sparkles size={24} color={colors.textMuted} />}
            </Pressable>
            <View style={styles.productBody}>
              <AppText muted numberOfLines={1} style={styles.productSource}>{product.brand} · {getSiteByKey(product.siteKey).shortName}</AppText>
              <AppText weight="semibold" numberOfLines={2} style={styles.productTitle}>{product.title}</AppText>
              <AppText weight="bold" style={styles.productPrice}>{product.priceMinor === undefined ? 'Price unavailable' : `${product.hasPriceRange ? 'From ' : ''}${formatPrice(product.priceMinor, product.currency)}`}</AppText>
              <AppText muted style={styles.productObserved}>Observed {formatRelativeTime(product.observedAt)}</AppText>
              <Pressable accessibilityRole="button" onPress={() => onTrack(product)} style={({ pressed }) => [styles.trackButton, tracked && styles.trackedButton, pressed && styles.pressed]} disabled={tracking}>
                {tracking ? <ActivityIndicator size="small" color={colors.surface} /> : <><Plus size={15} color={tracked ? colors.primary : colors.surface} /><AppText weight="semibold" style={[styles.trackButtonText, tracked && styles.trackedButtonText]}>{tracked ? 'Tracking' : 'Track price'}</AppText></>}
              </Pressable>
              <View style={styles.feedbackRow}>
                <Pressable accessibilityRole="link" accessibilityLabel={`View ${product.title} at retailer`} onPress={() => onViewAtRetailer(product)}><AppText weight="semibold" style={styles.feedbackLink}>View retailer</AppText></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Show more like ${product.brand}`} onPress={() => onMoreLikeThis(product.brand)}><AppText weight="semibold" style={styles.feedbackLink}>More like this</AppText></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Not interested in ${product.title}`} onPress={() => onDismiss(product.id)} style={styles.dismissButton}><EyeOff size={14} color={colors.textMuted} /><AppText muted style={styles.feedbackLink}>Not for me</AppText></Pressable>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function DiscoveryPreferencesSheet({
  visible,
  initialPreferences,
  onClose,
  onSave
}: {
  visible: boolean;
  initialPreferences?: DiscoveryPreferences;
  onClose: () => void;
  onSave: (update: Pick<DiscoveryPreferences, 'completed' | 'categories' | 'favoriteBrands' | 'budgetsByCategory'>) => Promise<void>;
}) {
  const availableCategories = useMemo(() => [...new Set(DISCOVERY_COLLECTIONS.map((collection) => collection.category))], []);
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<DiscoveryCategory[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [budgets, setBudgets] = useState<Partial<Record<DiscoveryCategory, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setStep(0);
    setCategories(initialPreferences?.categories ?? []);
    setBrands(initialPreferences?.favoriteBrands ?? []);
    setBudgets(Object.fromEntries(Object.entries(initialPreferences?.budgetsByCategory ?? {}).map(([category, value]) => [category, String((value ?? 0) / 100)])));
  }, [initialPreferences, visible]);

  const brandChoices = preferredDiscoveryBrands(categories);
  const title = step === 0 ? 'What are you interested in?' : step === 1 ? 'Any favourite brands?' : 'What do you usually spend?';
  const copy = step === 0 ? 'Choose anything you would like to explore. You can change this later.' : step === 1 ? 'This helps us bring familiar brands to the top of your feed.' : 'Set an optional maximum per category. Leave blank for no budget.';

  async function save() {
    const budgetsByCategory = Object.fromEntries(categories.flatMap((category) => {
      const amount = parseTargetPriceInput(budgets[category] ?? '');
      return amount === undefined ? [] : [[category, amount]];
    })) as Partial<Record<DiscoveryCategory, number>>;
    setSaving(true);
    await onSave({ completed: true, categories, favoriteBrands: brands, budgetsByCategory });
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close preferences" onPress={onClose} style={styles.iconButton}><X size={20} color={colors.text} /></Pressable>
          <AppText weight="bold" style={styles.sheetHeaderTitle}>Personalise For You</AppText>
          <AppText muted style={styles.sheetStep}>{step + 1} of 3</AppText>
        </View>
        <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <AppText weight="bold" style={styles.sheetTitle}>{title}</AppText>
          <AppText muted style={styles.sheetCopy}>{copy}</AppText>
          {step === 0 ? <View style={styles.choiceWrap}>{availableCategories.map((category) => <DiscoveryFilterChip key={category} label={DISCOVERY_CATEGORY_LABELS[category]} selected={categories.includes(category)} onPress={() => setCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])} />)}</View> : null}
          {step === 1 ? <View style={styles.choiceWrap}><DiscoveryFilterChip label="No preference" selected={!brands.length} onPress={() => setBrands([])} />{brandChoices.length ? brandChoices.map((brand) => <DiscoveryFilterChip key={brand} label={brand} selected={brands.includes(brand)} onPress={() => setBrands((current) => current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand])} />) : <AppText muted>Select an interest first, or continue without brand preferences.</AppText>}</View> : null}
          {step === 2 ? <View style={styles.budgetList}>{categories.length ? categories.map((category) => <View key={category} style={styles.budgetRow}><AppText weight="semibold" style={styles.flex}>{DISCOVERY_CATEGORY_LABELS[category]}</AppText><View style={styles.budgetInput}><AppText muted>AED</AppText><TextInput value={budgets[category] ?? ''} onChangeText={(value) => setBudgets((current) => ({ ...current, [category]: value }))} keyboardType="decimal-pad" placeholder="Any" placeholderTextColor={colors.textSoft} style={styles.budgetTextInput} /></View></View>) : <AppText muted>Continue without a spending preference to see the live catalogue.</AppText>}</View> : null}
        </ScrollView>
        <View style={styles.sheetActions}>
          {step > 0 ? <PrimaryButton label="Back" variant="outline" onPress={() => setStep((current) => current - 1)} style={styles.sheetBack} /> : null}
          <PrimaryButton label={step === 2 ? 'Show my picks' : 'Continue'} onPress={step === 2 ? save : () => setStep((current) => current + 1)} loading={saving} style={styles.flex} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.82 },
  setupCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  setupIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  setupTitle: { fontSize: 16 },
  setupCopy: { marginTop: 2, fontSize: 13, lineHeight: 18 },
  setupAction: { padding: 6 },
  setupDismiss: { padding: 6, marginLeft: -10 },
  emptyCard: { alignItems: 'center', padding: 24, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 20 },
  emptyCopy: { textAlign: 'center', marginTop: 8 },
  emptyButton: { marginTop: 18 },
  filterChip: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8 },
  filterChipSelected: { borderColor: colors.primary, backgroundColor: colors.blueSoft },
  filterChipText: { fontSize: 13 },
  filterChipTextSelected: { color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productCard: { width: '48%', flexGrow: 1, flexBasis: '46%', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  productImageWrap: { height: 142, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  productImage: { width: '100%', height: '100%' },
  productBody: { gap: 6, padding: 10 },
  productSource: { fontSize: 11 },
  productTitle: { fontSize: 14, lineHeight: 19, minHeight: 38 },
  productPrice: { fontSize: 16 },
  productObserved: { fontSize: 11 },
  trackButton: { minHeight: 34, borderRadius: radius.sm, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 2, paddingHorizontal: 8 },
  trackedButton: { backgroundColor: colors.blueSoft },
  trackButtonText: { color: colors.surface, fontSize: 12 },
  trackedButtonText: { color: colors.primary },
  feedbackRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  dismissButton: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  feedbackLink: { fontSize: 10, color: colors.textMuted },
  emptyFilter: { paddingVertical: 14, textAlign: 'center' },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  sheetHeaderTitle: { flex: 1, fontSize: 16, textAlign: 'center' },
  sheetStep: { fontSize: 12, minWidth: 36, textAlign: 'right' },
  sheetContent: { padding: 20, gap: 14 },
  sheetTitle: { fontSize: 25, lineHeight: 32 },
  sheetCopy: { fontSize: 15, lineHeight: 22 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  budgetList: { gap: 10, marginTop: 4 },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  budgetInput: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 112, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  budgetTextInput: { flex: 1, minWidth: 0, paddingVertical: 8, color: colors.text, textAlign: 'right' },
  sheetActions: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
  sheetBack: { flex: 0.6 }
});
