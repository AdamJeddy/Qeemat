import React, { ReactNode, useContext, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle
} from 'react-native';
import { AppText } from './AppText';
import { FontScaleContext } from '../theme/FontScaleContext';
import { colors, radius, spacing, typography } from '../theme/theme';

export type AppTextInputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  /** Render only the input, for embedding inside a custom bordered row. */
  bare?: boolean;
};

export function AppTextInput({
  label,
  hint,
  error,
  leading,
  trailing,
  containerStyle,
  inputStyle,
  bare = false,
  accessibilityLabel,
  placeholderTextColor,
  onFocus,
  onBlur,
  ...textInputProps
}: AppTextInputProps) {
  const [focused, setFocused] = useState(false);
  const fontScale = useContext(FontScaleContext);
  const scale = Math.min(fontScale, 1.3);
  const textStyle = {
    fontSize: typography.body.fontSize * scale,
    lineHeight: typography.body.lineHeight * scale
  };

  const input = (
    <TextInput
      {...textInputProps}
      allowFontScaling={false}
      accessibilityLabel={accessibilityLabel ?? label}
      placeholderTextColor={placeholderTextColor ?? colors.textMuted}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[styles.input, textStyle, inputStyle]}
    />
  );

  if (bare) {
    return input;
  }

  return (
    <View style={styles.wrap}>
      {label ? <AppText weight="semibold" style={styles.label}>{label}</AppText> : null}
      {hint ? <AppText muted style={styles.hint}>{hint}</AppText> : null}
      <View style={[styles.field, focused && styles.fieldFocused, error && styles.fieldError, containerStyle]}>
        {leading ? <View style={styles.accessory}>{leading}</View> : null}
        {input}
        {trailing ? <View style={styles.accessory}>{trailing}</View> : null}
      </View>
      {error ? <AppText accessibilityLiveRegion="polite" style={styles.error}>{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  field: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface
  },
  fieldFocused: { borderColor: colors.primary },
  fieldError: { borderColor: colors.red },
  input: { flex: 1, minWidth: 0, paddingVertical: 0, color: colors.text, textAlignVertical: 'center' },
  accessory: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, lineHeight: 21, color: colors.text },
  hint: { fontSize: 13, lineHeight: 18 },
  error: { fontSize: 13, lineHeight: 18, color: colors.red }
});
