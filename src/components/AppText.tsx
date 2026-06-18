import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextProps, TextStyle } from 'react-native';

import { colors } from '../theme/theme';

type AppTextProps = TextProps & {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
};

export function AppText({ children, style, muted, weight = 'regular', ...textProps }: AppTextProps) {
  return (
    <Text {...textProps} style={[styles.base, muted && styles.muted, styles[weight], style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21
  },
  muted: {
    color: colors.textMuted
  },
  regular: {
    fontWeight: '400'
  },
  medium: {
    fontWeight: '500'
  },
  semibold: {
    fontWeight: '600'
  },
  bold: {
    fontWeight: '700'
  }
});
