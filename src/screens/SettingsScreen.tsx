import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '../components/AppText';
import { PrimaryButton } from '../components/PrimaryButton';
import { SiteIcon } from '../components/SiteIcon';
import { deleteAllLocalData } from '../data/database';
import {
  BackgroundStatus,
  getBackgroundStatus,
  markBackgroundSchedule,
  setBackgroundPreferredHour
} from '../domain/backgroundStatus';
import {
  checkBatteryOptimizationExempt,
  openAppSystemSettings,
  requestBatteryOptimizationExemption,
  runBackgroundCheckOnce,
  scheduleBackgroundChecks
} from '../platform/backgroundScheduler';
import { ensureNotificationPermission, openNotificationSettings } from '../platform/notifications';
import { SUPPORTED_SITES } from '../domain/sites';
import { formatRelativeTime, formatSnapshotTime } from '../domain/dates';
import { getPlatformCapabilities } from '../platform/capabilities';
import { isCompactLayout } from '../theme/layout';
import { colors, radius, shadow } from '../theme/theme';

const BACKGROUND_TIME_PRESETS = [
  { label: 'Morning', hour: 9 },
  { label: 'Afternoon', hour: 14 },
  { label: 'Evening', hour: 20 }
];

export function SettingsScreen() {
  const { width, fontScale } = useWindowDimensions();
  const compact = isCompactLayout(width, fontScale);
  const platformCapabilities = getPlatformCapabilities(Platform.OS);
  const [backgroundStatus, setBackgroundStatus] = useState<BackgroundStatus>();
  const [notificationEnabled, setNotificationEnabled] = useState<boolean>();
  const [queueingCheck, setQueueingCheck] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [requestingNotifications, setRequestingNotifications] = useState(false);
  const [batteryExempt, setBatteryExempt] = useState<boolean>();
  const [requestingBattery, setRequestingBattery] = useState(false);

  const loadStatus = useCallback(async () => {
    const [status, notificationsAllowed, batteryOptExempt] = await Promise.all([
      getBackgroundStatus(),
      ensureNotificationPermission(false),
      platformCapabilities.supportsBatteryOptimizationControls
        ? checkBatteryOptimizationExempt().catch(() => false)
        : Promise.resolve(false)
    ]);

    setBackgroundStatus(status);
    setNotificationEnabled(notificationsAllowed);
    setBatteryExempt(batteryOptExempt);
  }, [platformCapabilities.supportsBatteryOptimizationControls]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const selectedPresetHour = backgroundStatus?.preferredHour ?? 9;
  const preferredHourLabel = formatPreferredHour(backgroundStatus?.preferredHour ?? 9);
  const notificationLabel = notificationEnabled === undefined ? 'Checking' : notificationEnabled ? 'Allowed' : 'Blocked';

  async function queueBackgroundCheck() {
    setQueueingCheck(true);
    const queued = await runBackgroundCheckOnce().catch(() => false);
    setQueueingCheck(false);
    Alert.alert(
      queued ? 'Background check queued' : 'Background check unavailable',
      queued
        ? `${platformCapabilities.backgroundSchedulerName} will run a one-off check. Reopen the product detail after a moment to see a new snapshot.`
        : `This build could not reach ${platformCapabilities.backgroundSchedulerName}.`
    );
    await loadStatus();
  }

  async function requestNotifications() {
    setRequestingNotifications(true);
    const granted = await ensureNotificationPermission(true).catch(() => false);
    setRequestingNotifications(false);
    setNotificationEnabled(granted);

    if (!granted) {
      Alert.alert(
        'Notifications still blocked',
        `${platformCapabilities.displayName} is still blocking notifications for Qeemat. Open the app notification settings and allow them there.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open settings', onPress: () => openNotificationSettings() }
        ]
      );
      return;
    }

    Alert.alert('Notifications enabled', 'Qeemat can now show local price alerts on this device.');
  }

  async function requestBatteryOptimize() {
    setRequestingBattery(true);

    const alreadyExempt = await requestBatteryOptimizationExemption().catch(() => false);
    if (alreadyExempt) {
      setRequestingBattery(false);
      setBatteryExempt(true);
      return;
    }

    const opened = await openAppSystemSettings().catch(() => false);
    setRequestingBattery(false);

    if (!opened) {
      Alert.alert('Could not open system settings');
      return;
    }

    Alert.alert(
      'App system settings opened',
      'Find "Battery" or "Battery optimization" in the app info screen and set Qeemat to "Unrestricted" / "Don\'t optimize".\n\nOn Samsung: Battery → Background usage limits → Never auto-disable.\nOn Xiaomi: Battery → App battery saver → No restrictions.\nOn other devices: Look for "Battery optimization" or "App power management".',
      [
        { text: 'Check status', onPress: async () => {
          const exempt = await checkBatteryOptimizationExempt().catch(() => false);
          setBatteryExempt(exempt);
          if (exempt) {
            Alert.alert('Qeemat is now exempt from battery optimization.');
          }
        }},
        { text: 'Done' }
      ]
    );
  }

  async function selectBackgroundSchedule(preferredHour: number) {
    if (savingSchedule || preferredHour === backgroundStatus?.preferredHour) {
      return;
    }

    setSavingSchedule(true);

    try {
      await setBackgroundPreferredHour(preferredHour);
      const scheduled = await scheduleBackgroundChecks(preferredHour).catch(() => false);
      if (!scheduled) {
        Alert.alert('Background schedule unavailable', `This build could not update ${platformCapabilities.backgroundSchedulerName}.`);
        return;
      }

      const nextStatus = await markBackgroundSchedule(preferredHour);
      setBackgroundStatus(nextStatus);
    } finally {
      setSavingSchedule(false);
      await loadStatus();
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <AppText weight="bold" style={styles.heading}>Settings</AppText>
      <AppText muted style={styles.settingsIntro}>
        Control local alerts, daily background timing, and the stores Qeemat can track in this MVP.
      </AppText>
      <View style={styles.settingsCard}>
        <View style={styles.settingsStack}>
          <View style={styles.settingsHeaderRow}>
            <AppText weight="bold">Supported stores</AppText>
            <View style={styles.settingsBadge}>
              <AppText weight="semibold" style={styles.settingsBadgeText}>
                {SUPPORTED_SITES.filter(site => site.status === 'supported').length} live
              </AppText>
            </View>
          </View>
          <AppText muted style={styles.settingsBodyText}>
            Product links are currently supported for these stores. Amazon support is kept intentionally lightweight for the MVP across selected regional domains.
          </AppText>
          <View style={styles.settingsChipWrap}>
            {SUPPORTED_SITES.filter(site => site.status === 'supported').map((site) => (
              <View key={site.key} style={styles.settingsChip}>
                <SiteIcon siteKey={site.key} size={14} />
                <AppText weight="medium" style={styles.settingsChipText}>{site.shortName}</AppText>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.settingsCard}>
        <View style={styles.settingsStack}>
          <View style={styles.settingsHeaderRow}>
            <AppText weight="bold">Notifications</AppText>
            <View style={[styles.settingsBadge, notificationEnabled ? styles.settingsBadgeSuccess : styles.settingsBadgeMuted]}>
              <AppText weight="semibold" style={[styles.settingsBadgeText, notificationEnabled && styles.settingsBadgeSuccessText]}>
                {notificationLabel}
              </AppText>
            </View>
          </View>
          <AppText muted style={styles.settingsBodyText}>
            Local price alerts need {platformCapabilities.displayName} notification access. If notifications remain blocked after the prompt, open the app notification settings directly.
          </AppText>
          <PrimaryButton
            label={notificationEnabled ? 'Open notification settings' : 'Enable notifications'}
            variant="outline"
            onPress={notificationEnabled ? openNotificationSettings : requestNotifications}
            loading={requestingNotifications}
          />
        </View>
      </View>
      {platformCapabilities.supportsBatteryOptimizationControls ? (
        <View style={styles.settingsCard}>
          <View style={styles.settingsStack}>
            <View style={styles.settingsHeaderRow}>
              <AppText weight="bold">Battery optimization</AppText>
              <View style={[styles.settingsBadge, batteryExempt ? styles.settingsBadgeSuccess : styles.settingsBadgeMuted]}>
                <AppText weight="semibold" style={[styles.settingsBadgeText, batteryExempt && styles.settingsBadgeSuccessText]}>
                  {batteryExempt === undefined ? 'Checking' : batteryExempt ? 'Exempt' : 'Restricted'}
                </AppText>
              </View>
            </View>
            <AppText muted style={styles.settingsBodyText}>
              Android may block background checks when the app is closed. Exempt Qeemat from battery optimization so WorkManager can wake up the device for daily price checks.
            </AppText>
            <PrimaryButton
              label={batteryExempt === undefined ? 'Checking' : 'Open app system settings'}
              variant="outline"
              onPress={requestBatteryOptimize}
              loading={requestingBattery}
            />
          </View>
        </View>
      ) : null}
      <View style={styles.settingsCard}>
        <View style={styles.settingsStack}>
          <View style={styles.settingsHeaderRow}>
            <View style={styles.flex}>
              <AppText weight="bold">Daily background check time</AppText>
              <AppText muted style={styles.settingsBodyText}>Choose when Qeemat requests its daily background check.</AppText>
            </View>
            <View style={[styles.settingsBadge, styles.settingsBadgeSuccess]}>
              <AppText weight="semibold" style={[styles.settingsBadgeText, styles.settingsBadgeSuccessText]}>{preferredHourLabel}</AppText>
            </View>
          </View>
          <View style={[styles.settingsPresetRow, compact && styles.settingsPresetRowCompact]}>
            {BACKGROUND_TIME_PRESETS.map((preset) => {
              const selected = preset.hour === selectedPresetHour;
              return (
                <Pressable
                  key={preset.label}
                  style={[styles.settingsPreset, compact && styles.settingsPresetCompact, selected && styles.settingsPresetActive, savingSchedule && styles.settingsPresetDisabled]}
                  onPress={() => selectBackgroundSchedule(preset.hour)}
                  disabled={savingSchedule}
                >
                  <AppText weight="semibold" style={[styles.settingsPresetTitle, selected && styles.settingsPresetTitleActive]}>{preset.label}</AppText>
                  <AppText muted style={[styles.settingsPresetValue, selected && styles.settingsPresetValueActive]}>{formatPreferredHour(preset.hour)}</AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.settingsMetaCard}>
            <InfoRow label="Target" value={preferredHourLabel} />
            <InfoRow label="Scheduled" value={formatStatusTime(backgroundStatus?.lastScheduledAt)} />
            <InfoRow label="Started" value={formatStatusTime(backgroundStatus?.lastStartedAt)} />
            <InfoRow label="Completed" value={formatStatusTime(backgroundStatus?.lastCompletedAt)} />
            <InfoRow
              label="Source"
              value={backgroundStatus?.lastSource ? formatRunSource(backgroundStatus.lastSource, backgroundStatus.lastForceRun) : 'No background run yet'}
            />
            {backgroundStatus?.lastRunError ? <AppText style={styles.errorText}>Last run error: {backgroundStatus.lastRunError}</AppText> : null}
          </View>
          <AppText muted style={styles.settingsHint}>
            {platformCapabilities.supportsBatteryOptimizationControls
              ? 'Best-effort — enable battery exemption above for reliability.'
              : 'Best-effort — the operating system decides when background work can run.'}
          </AppText>
          <PrimaryButton label="Queue background check once" variant="outline" onPress={queueBackgroundCheck} loading={queueingCheck} />
        </View>
      </View>
      <PrimaryButton
        label="Delete all local data"
        variant="danger"
        onPress={() => Alert.alert(
          'Delete local data?',
          'This removes all tracked products and price history from this device.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteAllLocalData() }
          ]
        )}
      />
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText muted>{label}</AppText>
      <AppText weight="medium" style={styles.infoRowValue}>{value}</AppText>
    </View>
  );
}

function formatStatusTime(iso?: string): string {
  if (!iso) {
    return 'Never';
  }

  return `${formatSnapshotTime(iso)} (${formatRelativeTime(iso)})`;
}

function formatPreferredHour(hour: number): string {
  const normalized = Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.round(hour))) : 9;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12}:00 ${suffix}`;
}

function formatRunSource(source: string, forced?: boolean): string {
  if (source === 'work-manager') {
    return forced ? 'Background (forced once)' : 'Background';
  }

  return source;
}

const styles = StyleSheet.create({
  screenContent: { padding: 20, paddingBottom: 110, gap: 16 },
  heading: { fontSize: 28, lineHeight: 34 },
  settingsCard: { padding: 20, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, ...shadow },
  settingsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  settingsBodyText: { lineHeight: 22 },
  settingsIntro: { marginTop: -4, lineHeight: 22 },
  settingsStack: { gap: 16 },
  settingsBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.surfaceMuted },
  settingsBadgeMuted: { backgroundColor: colors.surfaceMuted },
  settingsBadgeSuccess: { backgroundColor: colors.greenSoft },
  settingsBadgeText: { fontSize: 12, color: colors.textMuted },
  settingsBadgeSuccessText: { color: colors.green },
  settingsChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  settingsChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F7FBFF', borderWidth: 1, borderColor: colors.border },
  settingsChipText: { fontSize: 13 },
  settingsHint: { fontSize: 12, lineHeight: 18 },
  settingsMetaCard: { borderRadius: radius.md, backgroundColor: colors.surfaceMuted, padding: 14, gap: 12 },
  settingsPresetRow: { flexDirection: 'row', gap: 12 },
  settingsPresetRowCompact: { flexDirection: 'column' },
  settingsPreset: { flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 16, gap: 6 },
  settingsPresetCompact: { flexGrow: 0, width: '100%' },
  settingsPresetActive: { borderColor: colors.primary, backgroundColor: '#F7FBFF' },
  settingsPresetDisabled: { opacity: 0.7 },
  settingsPresetTitle: { fontSize: 14 },
  settingsPresetTitleActive: { color: colors.primary },
  settingsPresetValue: { fontSize: 12 },
  settingsPresetValueActive: { color: colors.primary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoRowValue: { flexShrink: 1, textAlign: 'right' },
  flex: { flex: 1, minWidth: 0 },
  errorText: { color: colors.red }
});
