import { ReactNode, useContext } from 'react';
import { StyleProp, StyleSheet, Text, TextProps, TextStyle } from 'react-native';

import { colors } from '../theme/theme';
import { FontScaleContext } from '../theme/FontScaleContext';

type AppTextProps = TextProps & {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
};

export function AppText({ children, style, muted, weight = 'regular', ...textProps }: AppTextProps) {
  const fontScale = useContext(FontScaleContext);
  const textStyle = StyleSheet.flatten([styles.base, muted && styles.muted, styles[weight], style]) as TextStyle;
  const scale = textProps.allowFontScaling === false ? 1 : Math.min(fontScale, 1.3);
  return (
    <Text {...textProps} allowFontScaling={false} style={[textStyle, { fontSize: (textStyle.fontSize ?? 15) * scale, lineHeight: textStyle.lineHeight === undefined ? undefined : textStyle.lineHeight * scale }]}>
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
