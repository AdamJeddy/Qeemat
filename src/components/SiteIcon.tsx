import { Image, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { getSiteByKey } from '../domain/sites';
import { SiteKey } from '../domain/types';

type SiteIconProps = {
  siteKey: SiteKey;
  size?: number;
};

/** Per-site tint colour used as a fallback when no favicon asset is available. */
const SITE_COLORS: Record<SiteKey, string> = {
  noon: '#F7CF25',
  nike_uae: '#000000',
  sun_sand_sports: '#E2231A',
  level_shoes: '#1A1A1A',
  ay_accessories: '#D4A574',
  ounass: '#000000',
  amazon_ae: '#FF9900',
};

/** First letter to display in the fallback circle. */
function siteInitial(siteKey: SiteKey): string {
  return getSiteByKey(siteKey).shortName.charAt(0).toUpperCase();
}

export function SiteIcon({ siteKey, size = 20 }: SiteIconProps) {
  const site = getSiteByKey(siteKey);
  const bg = SITE_COLORS[siteKey] ?? '#64748B';

  if (site.iconAsset) {
    return (
      <Image
        source={site.iconAsset}
        style={[styles.iconImage, { width: size, height: size }]}
        resizeMode="contain"
      />
    );
  }

  // Fallback: coloured letter-circle
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <AppText weight="bold" style={[styles.fallbackText, { fontSize: size * 0.55 }]}>
        {siteInitial(siteKey)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  iconImage: {
    borderRadius: 4,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#FFFFFF',
    lineHeight: undefined,
  },
});
