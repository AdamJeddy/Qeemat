import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { AppText } from './AppText';
import { DISCOVERY_CATEGORY_LABELS } from '../domain/discovery';
import { DiscoveryCategory, DiscoveryProduct } from '../domain/types';
import { colors, radius } from '../theme/theme';

const DEFAULT_DEPARTMENTS: DiscoveryCategory[] = ['footwear', 'phones', 'skincare', 'fragrance', 'clothing', 'fresh_food'];
const DEPARTMENT_IMAGES: Partial<Record<DiscoveryCategory, number>> = {
  footwear: require('../../assets/discovery/footwear.png'),
  phones: require('../../assets/discovery/phones.png'),
  skincare: require('../../assets/discovery/skincare.png'),
  fragrance: require('../../assets/discovery/fragrance.png'),
  clothing: require('../../assets/discovery/clothing.png'),
  fresh_food: require('../../assets/discovery/fresh-food.png')
};

export function DiscoveryDepartments({ selected, products, onSelect, onBrowse }: {
  selected?: DiscoveryCategory;
  products: DiscoveryProduct[];
  onSelect: (category: DiscoveryCategory) => void;
  onBrowse: () => void;
}) {
  const departments = selected && !DEFAULT_DEPARTMENTS.includes(selected)
    ? [selected, ...DEFAULT_DEPARTMENTS.slice(0, 5)] : DEFAULT_DEPARTMENTS;

  return <View style={styles.section}>
    <View style={styles.heading}>
      <AppText weight="bold" style={styles.title}>What are you looking for?</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel="Browse all departments and retailers" onPress={onBrowse} style={styles.browse}>
        <AppText style={styles.link}>All departments</AppText>
      </Pressable>
    </View>
    <View style={styles.grid}>
      {departments.map((department) => {
        const label = DISCOVERY_CATEGORY_LABELS[department];
        const productImage = products.find((product) => (product.categories ?? [product.category]).includes(department) && product.imageUrl)?.imageUrl;
        const image = DEPARTMENT_IMAGES[department] ?? (productImage ? { uri: productImage } : undefined);
        return <Pressable key={department} accessibilityRole="button" accessibilityLabel={`Browse ${label}`} accessibilityState={{ selected: selected === department }} onPress={() => onSelect(department)} style={({ pressed }) => [styles.tile, selected === department && styles.selected, pressed && styles.pressed]}>
          {image ? <Image source={image} resizeMode="contain" style={styles.image} /> : <View style={styles.imageFallback}><Sparkles size={26} color={colors.primary} /></View>}
          <AppText weight="semibold" numberOfLines={2} style={styles.label}>{label}</AppText>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, flex: 1 },
  browse: { minHeight: 44, justifyContent: 'center' },
  link: { color: colors.primary, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31%', flexGrow: 1, minHeight: 112, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  selected: { backgroundColor: colors.blueSoft, borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  image: { width: '100%', height: 72 },
  imageFallback: { height: 72, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center', fontSize: 13 }
});
