import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Download, X } from 'lucide-react-native';
import { AppText } from './AppText';
import { AvailableUpdate } from '../domain/updates';
import {
  cancelInAppUpdateDownload,
  installInAppUpdate,
  openInAppInstallSettings,
  readInAppUpdateDownloadState,
  startInAppUpdateDownload,
  supportsInAppUpdate
} from '../domain/appUpdate';
import { colors, radius, shadow, spacing } from '../theme/theme';

const PROGRESS_POLL_MS = 400;

type UpdatePhase = 'idle' | 'downloading' | 'verifying' | 'ready' | 'installing';

type UpdateNoticeProps = {
  update?: AvailableUpdate;
  visible?: boolean;
  onDismiss: (version: string) => void;
};

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Please try again later.';
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdateNotice({ update, visible = true, onDismiss }: UpdateNoticeProps) {
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [error, setError] = useState<string>();
  const mounted = useRef(true);
  const cancelled = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    cancelled.current = true;
    setPhase('idle');
    setProgress(0);
    setDownloadedBytes(0);
    setTotalBytes(0);
    setError(undefined);
  }, [update?.version]);

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

  function requestClose() {
    if (!update || phase === 'installing') { return; }
    if (phase === 'downloading' || phase === 'verifying') {
      cancelDownload();
    }
    onDismiss(update.version);
  }

  if (!update) { return null; }

  const inAppSupported = Boolean(update.apk) && supportsInAppUpdate();
  const busy = phase === 'downloading' || phase === 'verifying' || phase === 'installing';
  const failed = Boolean(error);
  const percent = Math.round(progress * 100);
  const total = totalBytes || update.apk?.size || 0;

  const title = failed ? 'Update download failed' : phase === 'downloading' ? 'Downloading update'
    : phase === 'verifying' ? 'Verifying update' : phase === 'ready' ? 'Ready to install'
      : phase === 'installing' ? 'Installing update' : 'Update available';
  const subtitle = failed ? error : phase === 'downloading' ? `Qeemat ${update.version}`
    : phase === 'verifying' ? 'Checking the download before installing.'
      : phase === 'ready' ? `Qeemat ${update.version} was downloaded and verified.`
        : phase === 'installing' ? 'Follow the Android prompt to finish installing.'
          : inAppSupported ? `Qeemat ${update.version} is ready to install.`
            : `Qeemat ${update.version} is available on GitHub.`;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={requestClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close update dialog"
          onPress={requestClose}
        />
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.header}>
            <View style={[styles.iconBadge, failed && styles.iconBadgeError]}>
              {phase === 'downloading' || phase === 'verifying' || phase === 'installing' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : failed ? (
                <AlertTriangle size={22} color={colors.red} />
              ) : phase === 'ready' ? (
                <CheckCircle2 size={22} color={colors.primary} />
              ) : (
                <Download size={22} color={colors.primary} />
              )}
            </View>
            <View style={styles.copy}>
              <AppText weight="bold" accessibilityRole="header" style={styles.title}>{title}</AppText>
              <AppText muted style={[styles.subtitle, failed && styles.subtitleError]}>{subtitle}</AppText>
            </View>
            {busy ? null : (
              <Pressable accessibilityRole="button" accessibilityLabel="Dismiss update notice" onPress={requestClose} hitSlop={10} style={styles.close}>
                <X size={20} color={colors.textSoft} />
              </Pressable>
            )}
          </View>

          {phase === 'downloading' || phase === 'verifying' ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressRow}>
                <AppText muted style={styles.progressText}>
                  {phase === 'verifying' ? 'Verifying download…'
                    : total > 0 ? `${megabytes(downloadedBytes)} of ${megabytes(total)}` : 'Starting download…'}
                </AppText>
                {phase === 'downloading' ? <AppText weight="semibold" style={styles.percent}>{percent}%</AppText> : null}
              </View>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: phase === 'verifying' ? 100 : percent }}
                accessibilityLabel={`Update download ${phase === 'verifying' ? 'verifying' : `${percent} percent`}`}
                style={styles.progressTrack}
              >
                <View style={[styles.progressFill, { width: `${phase === 'verifying' ? 100 : percent}%` }]} />
              </View>
            </View>
          ) : null}

          {phase === 'downloading' ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel update download" onPress={cancelDownload} style={styles.outlineButton}>
              <AppText weight="semibold" style={styles.outlineLabel}>Cancel download</AppText>
            </Pressable>
          ) : null}

          {phase === 'idle' && inAppSupported ? (
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Download and install Qeemat ${update.version}`}
                onPress={beginDownload}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Download size={18} color="#FFFFFF" />
                <AppText weight="semibold" style={styles.primaryLabel}>{failed ? 'Try again' : 'Download and install'}</AppText>
              </Pressable>
              <Pressable accessibilityRole="link" accessibilityLabel={`Release notes for Qeemat ${update.version}`} onPress={openReleasePage} hitSlop={8} style={styles.secondaryButton}>
                <AppText weight="semibold" style={styles.linkLabel}>Release notes</AppText>
              </Pressable>
            </View>
          ) : null}

          {phase === 'idle' && !inAppSupported ? (
            <Pressable accessibilityRole="link" onPress={openReleasePage} hitSlop={8} style={styles.secondaryButton}>
              <AppText weight="semibold" style={styles.linkLabel}>View release on GitHub</AppText>
            </Pressable>
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
              <Pressable accessibilityRole="link" onPress={openReleasePage} hitSlop={8} style={styles.secondaryButton}>
                <AppText weight="semibold" style={styles.linkLabel}>Release notes</AppText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.scrim
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    padding: spacing.xl,
    gap: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft },
  iconBadgeError: { backgroundColor: colors.redSoft },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 18, lineHeight: 24, color: colors.text },
  subtitle: { fontSize: 14, lineHeight: 20 },
  subtitleError: { color: colors.red },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  progressBlock: { gap: spacing.sm },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressText: { fontSize: 13, lineHeight: 18 },
  percent: { fontSize: 13, lineHeight: 18, color: colors.primary },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  actions: { gap: spacing.sm },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg
  },
  primaryLabel: { color: '#FFFFFF', fontSize: 16 },
  pressed: { opacity: 0.82 },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { color: colors.primary, fontSize: 15 },
  outlineButton: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center'
  },
  outlineLabel: { color: colors.text, fontSize: 15 }
});
