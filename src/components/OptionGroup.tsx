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
      {options.map((option, index) => {
        const selected = value === option.value;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, compact && styles.optionCompact, !isLast && (compact ? styles.optionDividerCompact : styles.optionDivider)]}
          >
            {selected ? (
              <View
                pointerEvents="none"
                style={[
                  styles.selected,
                  isFirst && (compact ? styles.selectedFirstCompact : styles.selectedFirst),
                  isLast && (compact ? styles.selectedLastCompact : styles.selectedLast)
                ]}
              />
            ) : null}
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
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    minHeight: 86
  },
  containerCompact: {
    flexDirection: 'column'
  },
  option: {
    flex: 1,
    minHeight: 86,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  optionDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border
  },
  optionCompact: {
    minHeight: 64,
    paddingVertical: 10
  },
  optionDividerCompact: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  selected: {
    position: 'absolute',
    top: -1,
    right: -1,
    bottom: -1,
    left: -1,
    backgroundColor: '#F7FBFF',
    borderColor: colors.primary,
    borderWidth: 1.5
  },
  selectedFirst: {
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md
  },
  selectedFirstCompact: {
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md
  },
  selectedLast: {
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md
  },
  selectedLastCompact: {
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md
  },
  label: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.text,
    zIndex: 1
  },
  selectedLabel: {
    color: colors.primary
  },
  description: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    zIndex: 1
  }
});
