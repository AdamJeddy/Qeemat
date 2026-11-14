import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme/theme';

export type SurfaceVariant = 'card' | 'muted' | 'accent' | 'plain';
export type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';
export type SurfaceRadius = 'sm' | 'md' | 'lg';

export type SurfaceProps = ViewProps & {
  children?: ReactNode;
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  radius?: SurfaceRadius;
  style?: StyleProp<ViewStyle>;
};

const PADDING: Record<SurfacePadding, number> = {
  none: 0,
  sm: spacing.md,
  md: spacing.lg,
  lg: spacing.xl
};

const RADIUS: Record<SurfaceRadius, number> = {
  sm: radius.sm,
  md: radius.md,
  lg: radius.lg
};

export function Surface({ children, variant = 'card', padding = 'md', radius: radiusName = 'md', style, ...viewProps }: SurfaceProps) {
  return (
    <View
      {...viewProps}
      style={[
        styles.base,
        styles[variant],
        { padding: PADDING[padding], borderRadius: RADIUS[radiusName] },
        style
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border
  },
  muted: {
    backgroundColor: colors.surfaceMuted
  },
  accent: {
    backgroundColor: colors.blueSoft
  },
  plain: {}
});
