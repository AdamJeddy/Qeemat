import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from './AppText';
import { colors, radius } from '../theme/theme';
import { isCompactLayout } from '../theme/layout';

type Option<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type OptionGroupProps<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function OptionGroup<T extends string>({ value, options, onChange }: OptionGroupProps<T>) {
  const { width, fontScale } = useWindowDimensions();
  const compact = isCompactLayout(width, fontScale);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.description ? `${option.label}. ${option.description}` : option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              compact && styles.optionCompact,
              selected && styles.optionSelected,
              pressed && styles.optionPressed
            ]}
          >
            <AppText weight="bold" style={[styles.label, selected && styles.selectedLabel]}>
              {option.label}
            </AppText>
            {option.description ? (
              <AppText muted style={[styles.description, selected && styles.selectedLabel]}>
                {option.description}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: 4,
    gap: 4
  },
  containerCompact: {
    flexDirection: 'column'
  },
  option: {
    flex: 1,
    minHeight: 76,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  optionCompact: {
    minHeight: 60,
    paddingVertical: 10
  },
  optionSelected: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.primary,
    borderWidth: 1
  },
  optionPressed: {
    opacity: 0.82
  },
  label: {
    fontSize: 17,
    lineHeight: 23,
    textAlign: 'center'
  },
  selectedLabel: {
    color: colors.primary
  },
  description: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center'
  }
});
