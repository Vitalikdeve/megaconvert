import { StyleSheet, Text, View } from 'react-native';

import { premiumPalette } from '@/constants/theme';

type BrandLogoProps = {
  size?: number;
};

export function BrandLogo({ size = 86 }: BrandLogoProps) {
  const borderRadius = Math.round(size * 0.3);
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius }]}>
      <View
        style={[
          styles.glow,
          {
            top: size * 0.12,
            left: size * 0.12,
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: size * 0.15,
          },
        ]}
      />
      <Text style={[styles.mark, { fontSize: size * 0.32 }]}>MC</Text>
      <View
        style={[
          styles.line,
          {
            width: size * 0.5,
            bottom: size * 0.2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: premiumPalette.surfaceElevated,
    borderWidth: 1,
    borderColor: premiumPalette.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    backgroundColor: '#124DA3',
    opacity: 0.5,
  },
  mark: {
    color: premiumPalette.textPrimary,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  line: {
    position: 'absolute',
    height: 2,
    borderRadius: 999,
    backgroundColor: premiumPalette.accent,
  },
});
