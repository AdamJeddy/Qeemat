import { StyleSheet } from 'react-native';

import { AppText } from './AppText';
import { snapshotSourceLabel } from '../domain/snapshotSource';
import { SnapshotSource } from '../domain/types';
import { typography } from '../theme/theme';

type SourceLabelProps = {
  source: SnapshotSource;
};

/**
 * Provenance is supporting context: muted text only, never a colored success badge.
 */
export function SourceLabel({ source }: SourceLabelProps) {
  return (
    <AppText muted style={styles.label}>
      {snapshotSourceLabel(source)}
    </AppText>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.caption
  }
});
