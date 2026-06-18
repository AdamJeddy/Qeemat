import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { colors, radius } from '../theme/theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  variant?: 'primary' | 'outline' | 'danger';
  style?: ViewStyle;
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
  variant = 'primary',
  style
}: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (disabled || loading) && styles.disabled,
        pressed && !disabled ? styles.pressed : null,
        style
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : colors.primary} /> : icon}
      <AppText
        weight="semibold"
        style={[styles.label, variant !== 'primary' && styles.outlineLabel, variant === 'danger' && styles.dangerLabel]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 58,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18
  },
  primary: {
    backgroundColor: colors.primary
  },
  outline: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1
  },
  danger: {
    backgroundColor: colors.surface,
    borderColor: colors.red,
    borderWidth: 1
  },
  disabled: {
    opacity: 0.55
  },
  pressed: {
    opacity: 0.82
  },
  label: {
    color: '#FFFFFF',
    fontSize: 17
  },
  outlineLabel: {
    color: colors.primary
  },
  dangerLabel: {
    color: colors.red
  }
});
