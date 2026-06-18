import { StyleSheet, View } from 'react-native';
import { CheckCircle2, CircleAlert, Clock3, TrendingDown } from 'lucide-react-native';

import { AppText } from './AppText';
import { CheckStatus } from '../domain/types';
import { colors, radius } from '../theme/theme';

type StatusPillProps = {
  status?: CheckStatus;
  label?: string;
};

export function StatusPill({ status = 'ok', label }: StatusPillProps) {
  const tone = status === 'ok' || status === 'price_changed' ? 'green' : status === 'network_error' ? 'amber' : 'red';
  const Icon = status === 'price_changed' ? TrendingDown : status === 'ok' ? CheckCircle2 : status === 'network_error' ? Clock3 : CircleAlert;

  return (
    <View style={[styles.base, styles[tone]]}>
      <Icon size={14} color={tone === 'green' ? colors.green : tone === 'amber' ? colors.amber : colors.red} />
      <AppText
        weight="medium"
        style={[styles.label, tone === 'green' && styles.greenText, tone === 'amber' && styles.amberText, tone === 'red' && styles.redText]}
      >
        {label ?? labelForStatus(status)}
      </AppText>
    </View>
  );
}

function labelForStatus(status: CheckStatus): string {
  if (status === 'price_changed') {
    return 'Price changed';
  }
  if (status === 'ok') {
    return 'Checked';
  }
  if (status === 'price_not_found') {
    return 'Price not found';
  }
  if (status === 'unsupported_page') {
    return 'Unsupported';
  }
  if (status === 'invalid_url') {
    return 'Invalid URL';
  }
  if (status === 'blocked') {
    return 'Blocked';
  }
  return 'Check failed';
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingVertical: 5,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  green: {
    backgroundColor: colors.greenSoft
  },
  amber: {
    backgroundColor: colors.amberSoft
  },
  red: {
    backgroundColor: colors.redSoft
  },
  label: {
    fontSize: 12
  },
  greenText: {
    color: colors.green
  },
  amberText: {
    color: colors.amber
  },
  redText: {
    color: colors.red
  }
});
