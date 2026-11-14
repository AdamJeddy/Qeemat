import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, NativeModules, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Download, X } from 'lucide-react-native';
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
import { colors, radius, spacing } from '../theme/theme';

const PROGRESS_POLL_MS = 400;

type UpdatePhase = 'idle' | 'downloading' | 'verifying' | 'ready' | 'installing';

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Please try again later.';
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdateNotice({ visible = true }: { visible?: boolean }) {
  const [update, setUpdate] = useState<AvailableUpdate>();
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
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
    const expectedTotal = apk?.size ?? 0;
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
        const total = state.totalBytes || expectedTotal;
        setDownloadedBytes(state.downloadedBytes);
        setTotalBytes(total);
        setProgress(total > 0 ? Math.min(1, state.downloadedBytes / total) : 0);
        setPhase(state.state === 'verifying' ? 'verifying' : 'downloading');
        continue;
      }
      if (state.state === 'ready') {
        setProgress(1);
        setDownloadedBytes(expectedTotal || state.downloadedBytes);
        setTotalBytes(expectedTotal || state.totalBytes);
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
    setDownloadedBytes(0);
    setTotalBytes(apk.size);
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
  const busy = phase === 'downloading' || phase === 'verifying' || phase === 'installing';
  const failed = Boolean(error);
  const percent = Math.round(progress * 100);
  const total = totalBytes || update.apk?.size || 0;

  const title = failed ? 'Update download failed' : phase === 'downloading' ? 'Downloading update' : phase === 'verifying'
    ? 'Verifying update' : phase === 'ready' ? 'Ready to install' : phase === 'installing' ? 'Installing update'
      : 'Update available';
  const subtitle = failed ? error : phase === 'downloading' ? `Qeemat ${update.version}`
    : phase === 'verifying' ? 'Checking the download before installing.'
      : phase === 'ready' ? `Qeemat ${update.version} is downloaded and verified.`
        : phase === 'installing' ? 'Follow the Android prompt to finish installing.'
          : inAppSupported ? `Qeemat ${update.version} is ready to install.` : `Qeemat ${update.version} is available on GitHub.`;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconBadge, failed && styles.iconBadgeError]}>
          {phase === 'downloading' || phase === 'verifying' || phase === 'installing' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : failed ? (
            <AlertTriangle size={20} color={colors.red} />
          ) : phase === 'ready' ? (
            <CheckCircle2 size={20} color={colors.primary} />
          ) : (
            <Download size={20} color={colors.primary} />
          )}
        </View>
        <View style={styles.copy}>
          <AppText weight="semibold" style={styles.title}>{title}</AppText>
          <AppText muted style={[styles.subtitle, failed && styles.subtitleError]}>{subtitle}</AppText>
        </View>
        {busy ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss update notice" onPress={dismiss} hitSlop={10} style={styles.close}>
            <X size={18} color={colors.textSoft} />
          </Pressable>
        )}
      </View>

      {phase === 'downloading' ? (
        <View style={styles.progressBlock}>
          <View style={styles.progressRow}>
            <AppText muted style={styles.progressText}>
              {total > 0 ? `${megabytes(downloadedBytes)} of ${megabytes(total)}` : 'Starting download…'}
            </AppText>
            <AppText weight="semibold" style={styles.percent}>{percent}%</AppText>
          </View>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            accessibilityLabel={`Update download ${percent} percent`}
            style={styles.progressTrack}
          >
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
        </View>
      ) : null}

      {phase === 'downloading' ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel update download" onPress={cancelDownload} hitSlop={8} style={styles.textButton}>
            <AppText weight="semibold" style={styles.textButtonLabel}>Cancel download</AppText>
          </Pressable>
        </View>
      ) : null}

      {phase === 'idle' && inAppSupported ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Download and install Qeemat ${update.version}`}
            onPress={beginDownload}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Download size={16} color="#FFFFFF" />
            <AppText weight="semibold" style={styles.primaryLabel}>{failed ? 'Try again' : 'Download and install'}</AppText>
          </Pressable>
          <Pressable accessibilityRole="link" accessibilityLabel={`Release notes for Qeemat ${update.version}`} onPress={openReleasePage} hitSlop={8} style={styles.textButton}>
            <AppText weight="semibold" style={styles.linkLabel}>Release notes</AppText>
          </Pressable>
        </View>
      ) : null}

      {phase === 'idle' && !inAppSupported ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="link" onPress={openReleasePage} hitSlop={8} style={styles.textButton}>
            <AppText weight="semibold" style={styles.linkLabel}>View release on GitHub</AppText>
          </Pressable>
        </View>
      ) : null}

      {phase === 'ready' ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Install Qeemat ${update.version} update`}
            onPress={beginInstall}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <AppText weight="semibold" style={styles.primaryLabel}>Install update</AppText>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={openReleasePage} hitSlop={8} style={styles.textButton}>
            <AppText weight="semibold" style={styles.linkLabel}>Release notes</AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft },
  iconBadgeError: { backgroundColor: colors.redSoft },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 16, lineHeight: 21, color: colors.text },
  subtitle: { fontSize: 13, lineHeight: 18 },
  subtitleError: { color: colors.red },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  progressBlock: { gap: spacing.sm },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressText: { fontSize: 13, lineHeight: 18 },
  percent: { fontSize: 13, lineHeight: 18, color: colors.primary },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    backgroundColor: colors.primary
  },
  primaryLabel: { color: '#FFFFFF', fontSize: 15 },
  pressed: { opacity: 0.82 },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 },
  textButtonLabel: { color: colors.textMuted, fontSize: 15 },
  linkLabel: { color: colors.primary, fontSize: 15 }
});
