import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { DISCOVERY_CATEGORY_GROUPS, DISCOVERY_CATEGORY_LABELS, ShoppingCategory } from '../domain/discoveryCategories';
import { colors, radius } from '../theme/theme';

export function ProductCategoryPicker({ value, onChange }: { value?: ShoppingCategory; onChange: (category?: ShoppingCategory) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={styles.section}>
    <AppText weight="semibold">Product category</AppText>
    <AppText muted>Used to find related products in Search.</AppText>
    <Pressable accessibilityRole="button" accessibilityLabel="Choose product category" onPress={() => setOpen(true)} style={styles.button}>
      <AppText>{value ? DISCOVERY_CATEGORY_LABELS[value] : 'Choose a category (optional)'}</AppText>
    </Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}><AppText weight="bold" style={styles.title}>Product category</AppText><Pressable accessibilityRole="button" accessibilityLabel="Close category picker" onPress={() => setOpen(false)}><AppText>Close</AppText></Pressable></View>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable accessibilityRole="button" onPress={() => { onChange(undefined); setOpen(false); }} style={styles.row}><AppText>No category</AppText></Pressable>
          {DISCOVERY_CATEGORY_GROUPS.map(group => <View key={group.id}><AppText weight="bold" style={styles.group}>{group.label}</AppText>{group.categories.map(category => <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${DISCOVERY_CATEGORY_LABELS[category]}`} accessibilityState={{ selected: category === value }} key={category} onPress={() => { onChange(category); setOpen(false); }} style={styles.row}><AppText>{DISCOVERY_CATEGORY_LABELS[category]}{category === value ? ' ✓' : ''}</AppText></Pressable>)}</View>)}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 6 }, screen: { flex: 1, backgroundColor: colors.surface }, header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20 }, content: { paddingHorizontal: 20, paddingBottom: 30 }, group: { marginTop: 18, marginBottom: 4 },
  row: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  button: { padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }
});
