import { BlurView, type BlurTint } from 'expo-blur';
import { type PropsWithChildren } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

type GlassViewProps = PropsWithChildren<
  ViewProps & {
    intensity?: number;
    tint?: BlurTint;
    radius?: number;
    style?: StyleProp<ViewStyle>;
  }
>;

export function GlassView({
  children,
  intensity = 20,
  tint = 'dark',
  radius = 14,
  style,
  ...viewProps
}: GlassViewProps) {
  return (
    <View
      {...viewProps}
      style={[
        styles.container,
        {
          borderRadius: radius,
        },
        style,
      ]}>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      <View
        pointerEvents="none"
        style={[
          styles.facet,
          {
            borderRadius: radius,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.edge,
          {
            borderRadius: radius,
          },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(16, 16, 26, 0.3)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  facet: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(16, 16, 26, 0.12)',
  },
  edge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
});
