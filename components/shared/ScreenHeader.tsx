import type { ReactNode } from 'react';
import { AppHeader } from './AppHeader';

type Props = {
  title: string;
  fallbackRoute: string;
  rightAction?: ReactNode;
  subtitle?: string;
  variant?: 'gradient' | 'plain';
};

export default function ScreenHeader({ title, fallbackRoute, rightAction, subtitle }: Props) {
  return (
    <AppHeader
      variant="sub"
      title={title}
      fallbackRoute={fallbackRoute}
      subtitle={subtitle}
      rightAction={rightAction}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  plainRow: {
    paddingHorizontal: 16,
  },
  action: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSpacer: {
    width: 40,
    height: 40,
  },
  plainAction: {
    backgroundColor: '#ecfdf5',
  },
  rightAction: {
    minWidth: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  plainTitle: {
    color: '#0f172a',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    textAlign: 'center',
  },
  plainSubtitle: {
    color: '#64748b',
  },
});
