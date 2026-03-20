import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

type NeonButtonSize = 'default' | 'icon';

type NeonButtonProps = {
  label?: string;
  title?: string;
  icon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  size?: NeonButtonSize;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function NeonButton({
  label,
  title,
  icon,
  onPress,
  disabled = false,
  size = 'default',
  style,
  labelStyle,
}: NeonButtonProps) {
  const resolvedLabel = title ?? label;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'icon' ? styles.iconSize : styles.defaultSize,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}>
      <LinearGradient
        colors={['rgba(0, 229, 255, 0.08)', 'rgba(0, 229, 255, 0.5)', 'rgba(0, 229, 255, 0.08)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.specular} />
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      {resolvedLabel ? <Text style={[styles.label, labelStyle]}>{resolvedLabel}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#00E5FF',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.62,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  defaultSize: {
    borderRadius: 16,
    minHeight: 56,
    paddingHorizontal: 18,
    gap: 10,
  },
  iconSize: {
    borderRadius: 22,
    width: 44,
    height: 44,
  },
  specular: {
    position: 'absolute',
    top: 2,
    left: 8,
    right: 8,
    height: 12,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.44)',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#03202A',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.52,
  },
});
