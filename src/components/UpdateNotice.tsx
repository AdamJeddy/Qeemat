import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, NativeModules, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Download, X } from 'lucide-react-native';
import { AppText } from './AppText';
import { AvailableUpdate, checkForUpdate } from '../domain/updates';
import {
  cancelInAppUpdateDownload,
  installInAppUpdate,
  openInAppInstallSettings,
  readInAppUpdateDownloadState,
  startInAppUpdateDownload,
  supportsInAppUpdate
} from '../domain/appUpdate';
import { colors, radius } from '../theme/theme';

const PROGRESS_POLL_MS = 400;

type UpdatePhase = 'idle' | 'downloading' | 'verifying' | 'ready' | 'installing';

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Please try again later.';
}

export function UpdateNotice({ visible = true }: { visible?: boolean }) {
  const [update, setUpdate] = useState<AvailableUpdate>();
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  const mounted = useRef(true);
  const cancelled = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const version = Platform.OS === 'android' ? NativeModules.QeematBackgroundCheck?.getConstants?.()?.appVersion : undefined;
    if (typeof version === 'string') {
      checkForUpdate(version).then((result) => { if (active) { setUpdate(result); } });
    }
    return () => { active = false; mounted.current = false; };
  }, []);

  function openReleasePage() {
    if (!update) { return; }
    Linking.openURL(update.url).catch(() => Alert.alert('Could not open GitHub', 'Please try again later.'));
  }

  async function beginInstall() {
    setPhase('installing');
    let result;
    try {
      result = await installInAppUpdate();
    } catch (installError) {
      setPhase('ready');
      Alert.alert('Could not open the installer', errorMessage(installError));
      return;
    }
    if (result.started) { return; }
    setPhase('ready');
    if (result.permissionRequired) {
      Alert.alert(
        'Allow updates from Qeemat',
        'Android needs your permission to install this update. In Settings, allow installs from Qeemat, then tap Install update.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => { openInAppInstallSettings().catch(() => undefined); } }
        ]
      );
      return;
    }
    Alert.alert('Could not start the installer', 'You can still install the update from the GitHub release page.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open GitHub', onPress: openReleasePage }
    ]);
  }

  async function waitForDownload(): Promise<void> {
    const apk = update?.apk;
    for (;;) {
      await delay(PROGRESS_POLL_MS);
      if (!mounted.current || cancelled.current) { return; }
      let state;
      try {
        state = await readInAppUpdateDownloadState();
      } catch (readError) {
        setPhase('idle');
        setError(errorMessage(readError));
        return;
      }
      if (!state) {
        setPhase('idle');
        setError('Could not read the update download. Please try again.');
        return;
      }
      if (state.state === 'downloading' || state.state === 'verifying') {
        const total = state.totalBytes || apk?.size || 0;
        setProgress(total > 0 ? Math.min(1, state.downloadedBytes / total) : 0);
        setPhase(state.state === 'verifying' ? 'verifying' : 'downloading');
        continue;
      }
      if (state.state === 'ready') {
        setProgress(1);
        await beginInstall();
        return;
      }
      if (state.state === 'failed') {
        setPhase('idle');
        setError(state.error ?? 'Could not download the update. Please try again.');
        return;
      }
      setPhase('idle');
      setProgress(0);
      return;
    }
  }

  async function beginDownload() {
    const apk = update?.apk;
    if (!apk || !supportsInAppUpdate()) {
      openReleasePage();
      return;
    }
    setError(undefined);
    setProgress(0);
    cancelled.current = false;
    setPhase('downloading');
    try {
      await startInAppUpdateDownload(apk);
    } catch (startError) {
      setPhase('idle');
      Alert.alert('Could not start the download', errorMessage(startError));
      return;
    }
    await waitForDownload();
  }

  function cancelDownload() {
    cancelled.current = true;
    setPhase('idle');
    setProgress(0);
    cancelInAppUpdateDownload().catch(() => undefined);
  }

  function dismiss() {
    if (phase === 'downloading' || phase === 'verifying') {
      cancelInAppUpdateDownload().catch(() => undefined);
    }
    setUpdate(undefined);
  }

  if (!visible || !update) { return null; }

  const inAppSupported = Boolean(update.apk) && supportsInAppUpdate();
  const percent = Math.round(progress * 100);

  return (
    <View style={styles.notice}>
      <View style={styles.copy}>
        <AppText weight="bold">Qeemat {update.version} is available</AppText>
        {!inAppSupported ? (
          <Pressable accessibilityRole="link" onPress={openReleasePage}>
            <AppText style={styles.link}>View release on GitHub</AppText>
          </Pressable>
        ) : null}
        {phase === 'downloading' ? (
          <View style={styles.actions}>
            <View style={styles.progressBlock}>
              <AppText muted style={styles.progressLabel}>Downloading update… {percent}%</AppText>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${percent}%` }]} />
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel update download" onPress={cancelDownload} hitSlop={8} style={styles.secondaryAction}>
              <AppText style={styles.link}>Cancel</AppText>
            </Pressable>
          </View>
        ) : null}
        {phase === 'verifying' ? (
          <AppText muted style={styles.progressLabel}>Verifying download…</AppText>
        ) : null}
        {phase === 'installing' ? (
          <AppText muted>Follow the Android prompt to finish installing the update.</AppText>
        ) : null}
        {phase === 'ready' ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Install Qeemat ${update.version} update`}
              onPress={beginInstall}
              style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
            >
              <AppText weight="semibold" style={styles.primaryLabel}>Install update</AppText>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={openReleasePage} hitSlop={8}>
              <AppText style={styles.link}>Release notes</AppText>
            </Pressable>
          </View>
        ) : null}
        {phase === 'idle' && inAppSupported ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Download and install Qeemat ${update.version}`}
              onPress={beginDownload}
              style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
            >
              <Download size={16} color="#FFFFFF" />
              <AppText weight="semibold" style={styles.primaryLabel}>{error ? 'Try again' : 'Download and install'}</AppText>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={openReleasePage} hitSlop={8}>
              <AppText style={styles.link}>Release notes</AppText>
            </Pressable>
          </View>
        ) : null}
        {error ? <AppText accessibilityLiveRegion="polite" style={styles.error}>{error}</AppText> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss update notice" onPress={dismiss} hitSlop={8}>
        <X size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.blueSoft },
  copy: { flex: 1, gap: 6 },
  link: { color: colors.primary, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 2 },
  primaryAction: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.primary },
  primaryLabel: { color: '#FFFFFF' },
  pressed: { opacity: 0.82 },
  secondaryAction: { minHeight: 44, justifyContent: 'center' },
  progressBlock: { flex: 1, gap: 6, minWidth: 160 },
  progressLabel: { fontSize: 13 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.surface, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  error: { color: colors.red }
});
