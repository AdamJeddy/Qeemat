import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { VariantAttributes, getVariantOptionGroups } from '../domain/variants';
import { ProductVariant } from '../domain/types';
import { colors, radius } from '../theme/theme';
import { getVariantGridMetrics } from '../theme/layout';

type VariantSelectorProps = {
  variants: ProductVariant[];
  selectedAttributes: VariantAttributes;
  onSelect: (name: string, value: string) => void;
};

export function VariantSelector({ variants, selectedAttributes, onSelect }: VariantSelectorProps) {
  const groups = getVariantOptionGroups(variants, selectedAttributes);
  const [groupWidths, setGroupWidths] = useState<Record<string, number>>({});

  return (
    <View style={styles.container}>
      {groups.map((group) => (
        <View key={group.name} style={styles.group}>
          <AppText weight="semibold" style={styles.label}>
            {group.name}
          </AppText>
          <View
            style={styles.options}
            onLayout={({ nativeEvent }) => {
              const width = Math.round(nativeEvent.layout.width);
              setGroupWidths((current) => (current[group.name] === width ? current : { ...current, [group.name]: width }));
            }}
          >
            {group.values.map((option) => {
              const selected = selectedAttributes[group.name] === option.value;
              const { tileWidth } = getVariantGridMetrics(groupWidths[group.name] ?? 0, group.values.length);
              const measuredWidth = tileWidth > 0 ? { width: tileWidth } : undefined;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityLabel={`${group.name} ${option.value}`}
                  accessibilityState={{ selected, disabled: option.disabled }}
                  disabled={option.disabled}
                  onPress={() => onSelect(group.name, option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    measuredWidth,
                    selected && styles.optionSelected,
                    option.disabled && styles.optionDisabled,
                    pressed && !option.disabled && styles.optionPressed
                  ]}
                >
                  <AppText weight="medium" style={[styles.optionText, selected && styles.optionTextSelected, option.disabled && styles.optionTextDisabled]}>
                    {option.value}
                  </AppText>
                  {option.disabled ? <AppText muted style={styles.unavailable}>Unavailable</AppText> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 18
  },
  group: {
    gap: 6
  },
  label: {
    fontSize: 15
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  option: {
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 2,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.blueSoft
  },
  optionDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border
  },
  optionPressed: {
    opacity: 0.8
  },
  optionText: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center'
  },
  optionTextSelected: {
    color: colors.primary
  },
  optionTextDisabled: {
    textDecorationLine: 'line-through'
  },
  unavailable: {
    fontSize: 8,
    lineHeight: 10,
    marginTop: 2,
    textAlign: 'center'
  }
});
