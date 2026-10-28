import React, { useEffect, useState } from 'react';
import { Alert, Linking, NativeModules, Platform, Pressable, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';
import { AppText } from './AppText';
import { AvailableUpdate, checkForUpdate } from '../domain/updates';
import { colors, radius } from '../theme/theme';

export function UpdateNotice({ visible = true }: { visible?: boolean }) {
  const [update, setUpdate] = useState<AvailableUpdate>();

  useEffect(() => {
    let active = true;
    const version = Platform.OS === 'android' ? NativeModules.QeematBackgroundCheck?.getConstants?.()?.appVersion : undefined;
    if (typeof version === 'string') {
      checkForUpdate(version).then((result) => { if (active) { setUpdate(result); } });
    }
    return () => { active = false; };
  }, []);

  if (!visible || !update) { return null; }
  return (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <View style={styles.copy}>
        <AppText weight="bold">Qeemat {update.version} is available</AppText>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(update.url).catch(() => Alert.alert('Could not open GitHub', 'Please try again later.'))}>
          <AppText style={styles.link}>View release on GitHub</AppText>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss update notice" onPress={() => setUpdate(undefined)} hitSlop={8}>
        <X size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.blueSoft },
  copy: { flex: 1, gap: 4 },
  link: { color: colors.primary, fontWeight: '600' }
});
