import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  PanResponder,
  type KeyboardTypeOptions,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { GlassView } from '@/src/components/ui/GlassView';

export const liquidColors = {
  deepSpaceBlack: '#050509',
  electricCyan: '#00E5FF',
  electricCyanSoft: 'rgba(0, 229, 255, 0.35)',
  matGlass: 'rgba(18, 20, 31, 0.58)',
  textPrimary: '#F8FBFF',
  textSecondary: '#9FB4CF',
  border: 'rgba(219, 236, 255, 0.14)',
  gold: '#F6C56A',
  danger: '#FF6A74',
};

type LiquidPageProps = {
  title: string;
  subtitle?: string;
  back?: boolean;
  children: ReactNode;
  rightSlot?: ReactNode;
};

type LiquidSettingsTileProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  href?: Href;
  onPress?: () => void;
  delayIndex?: number;
};

type LiquidSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  delay?: number;
};

type LiquidInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  autoCapitalize?: TextInputProps['autoCapitalize'];
};

type LiquidSwitchRowProps = {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

type LiquidActionRowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
};

type LiquidChipGroupProps = {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

type LiquidButtonProps = {
  label: string;
  onPress: () => void;
  danger?: boolean;
};

type LiquidSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function LiquidPage({ title, subtitle, back = false, children, rightSlot }: LiquidPageProps) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= 600 || Math.max(width, height) >= 980;
  const dragRegionStyle =
    Platform.OS === 'web' ? ({ WebkitAppRegion: 'drag' } as unknown as ViewStyle) : undefined;
  const noDragRegionStyle =
    Platform.OS === 'web' ? ({ WebkitAppRegion: 'no-drag' } as unknown as ViewStyle) : undefined;

  return (
    <SafeAreaView style={styles.pageRoot}>
      <View pointerEvents="none" style={styles.ambientLayer}>
        <View style={styles.ambientGlowTop} />
        <View style={styles.ambientGlowBottom} />
        <View style={styles.ambientGlowMiddle} />
      </View>

      {isTablet ? (
        <View style={styles.tabletBarWrap}>
          <GlassView intensity={26} radius={18} style={styles.tabletBar}>
            <View style={[styles.tabletBarDragRegion, dragRegionStyle]}>
              <View style={styles.tabletBarPill} />
            </View>
          </GlassView>
        </View>
      ) : null}

      <View style={styles.pageShell}>
        <GlassView intensity={34} radius={22} style={styles.headerShell}>
          <View style={[styles.headerRow, noDragRegionStyle]}>
            {back ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => [styles.headerBackButton, pressed ? styles.pressed : null]}>
                <MaterialIcons name="arrow-back-ios-new" size={18} color={liquidColors.electricCyan} />
              </Pressable>
            ) : (
              <View style={styles.headerBackSpacer} />
            )}

            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>{title}</Text>
              {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
            </View>

            <View style={styles.headerRightSlot}>{rightSlot}</View>
          </View>
        </GlassView>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          style={styles.keyboardWrap}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(420)} exiting={FadeOut.duration(200)} style={styles.contentWrap}>
              {children}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

export function LiquidSettingsTile({
  title,
  subtitle,
  icon,
  href,
  onPress,
  delayIndex = 0,
}: LiquidSettingsTileProps) {
  const router = useRouter();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (href) {
      router.push(href);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(70 + delayIndex * 55).duration(460)}
      layout={LinearTransition.springify().damping(16)}
      style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        onPress={handlePress}
        onPressIn={() => {
          scale.value = withSpring(0.985, { damping: 18, stiffness: 240 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 220 });
        }}
        style={styles.tilePressable}>
        <GlassView intensity={22} radius={18} style={styles.tileGlass}>
          <View style={styles.tileIconWrap}>
            <MaterialIcons color={liquidColors.electricCyan} name={icon} size={22} />
          </View>

          <View style={styles.tileTextWrap}>
            <Text style={styles.tileTitle}>{title}</Text>
            <Text style={styles.tileSubtitle}>{subtitle}</Text>
          </View>

          <MaterialIcons color={liquidColors.textSecondary} name="chevron-right" size={22} />
        </GlassView>
      </Pressable>
    </Animated.View>
  );
}

export function LiquidSection({ title, description, children, delay = 0 }: LiquidSectionProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(420)} style={styles.sectionWrap}>
      <GlassView intensity={25} radius={20} style={styles.sectionGlass}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
        </View>
        <View style={styles.sectionBody}>{children}</View>
      </GlassView>
    </Animated.View>
  );
}

export function LiquidInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  maxLength,
  autoCapitalize = 'sentences',
}: LiquidInputProps) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(159, 180, 207, 0.7)"
        style={styles.inputField}
        value={value}
      />
    </View>
  );
}

export function LiquidSwitchRow({ title, subtitle, value, onChange }: LiquidSwitchRowProps) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchTextWrap}>
        <Text style={styles.switchTitle}>{title}</Text>
        {subtitle ? <Text style={styles.switchSubtitle}>{subtitle}</Text> : null}
      </View>

      <View style={[styles.switchHalo, value ? styles.switchHaloActive : null]}>
        <Switch
          ios_backgroundColor="rgba(255, 255, 255, 0.22)"
          onValueChange={onChange}
          thumbColor={value ? '#DDFBFF' : '#F5F8FF'}
          trackColor={{
            false: 'rgba(255, 255, 255, 0.22)',
            true: 'rgba(0, 229, 255, 0.58)',
          }}
          value={value}
        />
      </View>
    </View>
  );
}

export function LiquidActionRow({ title, subtitle, value, onPress, danger = false }: LiquidActionRowProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [pressed ? styles.pressed : null]}>
      <View style={styles.actionRow}>
        <View style={styles.actionTextWrap}>
          <Text style={[styles.actionTitle, danger ? styles.actionTitleDanger : null]}>{title}</Text>
          {subtitle ? <Text style={styles.actionSubtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.actionTrailingWrap}>
          {value ? <Text style={styles.actionValue}>{value}</Text> : null}
          <MaterialIcons color={danger ? liquidColors.danger : liquidColors.textSecondary} name="chevron-right" size={20} />
        </View>
      </View>
    </Pressable>
  );
}

export function LiquidChipGroup({ label, options, value, onChange }: LiquidChipGroupProps) {
  return (
    <View style={styles.chipGroupWrap}>
      <Text style={styles.chipGroupLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              accessibilityRole="button"
              key={option}
              onPress={() => onChange(option)}
              style={({ pressed }) => [styles.chip, selected ? styles.chipSelected : null, pressed ? styles.pressed : null]}>
              <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function LiquidButton({ label, onPress, danger = false }: LiquidButtonProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.buttonPress, pressed ? styles.pressed : null]}>
      <GlassView
        intensity={28}
        radius={16}
        style={[styles.buttonGlass, danger ? styles.buttonGlassDanger : styles.buttonGlassPrimary]}>
        <Text style={[styles.buttonLabel, danger ? styles.buttonLabelDanger : null]}>{label}</Text>
      </GlassView>
    </Pressable>
  );
}

export function LiquidSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue = (input) => String(input),
}: LiquidSliderProps) {
  const [trackWidth, setTrackWidth] = useState(1);

  const progress = clamp((value - min) / Math.max(1, max - min), 0, 1);
  const thumbLeft = progress * Math.max(0, trackWidth - 22);

  const updateFromX = (positionX: number) => {
    const ratio = clamp(positionX / Math.max(trackWidth, 1), 0, 1);
    const rawValue = min + ratio * (max - min);
    const snapped = roundToStep(rawValue, step);
    onChange(clamp(snapped, min, max));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          updateFromX(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          updateFromX(event.nativeEvent.locationX);
        },
      }),
    [max, min, step, trackWidth]
  );

  return (
    <View style={styles.sliderWrap}>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{formatValue(value)}</Text>
      </View>
      <View
        onLayout={(event) => {
          setTrackWidth(event.nativeEvent.layout.width);
        }}
        style={styles.sliderTrack}
        {...panResponder.panHandlers}>
        <View style={[styles.sliderFill, { width: `${progress * 100}%` }]} />
        <View style={[styles.sliderThumb, { left: thumbLeft }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    backgroundColor: liquidColors.deepSpaceBlack,
  },
  ambientLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -120,
    right: -70,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(0, 229, 255, 0.17)',
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -140,
    left: -90,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(57, 82, 180, 0.18)',
  },
  ambientGlowMiddle: {
    position: 'absolute',
    top: '40%',
    left: '48%',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(246, 197, 106, 0.08)',
  },
  tabletBarWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  tabletBar: {
    height: 28,
    justifyContent: 'center',
  },
  tabletBarDragRegion: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabletBarPill: {
    width: 68,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  pageShell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 10,
  },
  headerShell: {
    marginTop: 8,
    borderColor: liquidColors.border,
    backgroundColor: liquidColors.matGlass,
  },
  headerRow: {
    minHeight: 68,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.42)',
    backgroundColor: 'rgba(0, 229, 255, 0.16)',
    shadowColor: liquidColors.electricCyan,
    shadowOpacity: 0.34,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  headerBackSpacer: {
    width: 38,
    height: 38,
  },
  headerTextWrap: {
    flex: 1,
    paddingHorizontal: 10,
    gap: 2,
  },
  headerTitle: {
    color: liquidColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: liquidColors.textSecondary,
    fontSize: 12,
  },
  headerRightSlot: {
    width: 54,
    alignItems: 'flex-end',
  },
  scrollContent: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    paddingBottom: 24,
  },
  keyboardWrap: {
    flex: 1,
  },
  contentWrap: {
    gap: 10,
  },
  tilePressable: {
    borderRadius: 18,
  },
  tileGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 82,
    paddingHorizontal: 14,
    borderColor: liquidColors.border,
    backgroundColor: liquidColors.matGlass,
    gap: 12,
  },
  tileIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: liquidColors.electricCyanSoft,
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
    shadowColor: liquidColors.electricCyan,
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  tileTextWrap: {
    flex: 1,
    gap: 2,
  },
  tileTitle: {
    color: liquidColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  tileSubtitle: {
    color: liquidColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionWrap: {
    borderRadius: 20,
  },
  sectionGlass: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderColor: liquidColors.border,
    backgroundColor: liquidColors.matGlass,
    gap: 12,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: liquidColors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionDescription: {
    color: liquidColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionBody: {
    gap: 12,
  },
  inputWrap: {
    gap: 6,
  },
  inputLabel: {
    color: liquidColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  inputField: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.34)',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(7, 10, 20, 0.74)',
    color: liquidColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  switchTextWrap: {
    flex: 1,
    gap: 3,
  },
  switchTitle: {
    color: liquidColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  switchSubtitle: {
    color: liquidColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  switchHalo: {
    borderRadius: 999,
  },
  switchHaloActive: {
    shadowColor: liquidColors.electricCyan,
    shadowOpacity: 0.46,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  actionRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingHorizontal: 12,
  },
  actionTextWrap: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    color: liquidColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  actionTitleDanger: {
    color: liquidColors.danger,
  },
  actionSubtitle: {
    color: liquidColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  actionTrailingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionValue: {
    color: liquidColors.textSecondary,
    fontSize: 12,
  },
  chipGroupWrap: {
    gap: 7,
  },
  chipGroupLabel: {
    color: liquidColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  chipSelected: {
    borderColor: liquidColors.electricCyanSoft,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    shadowColor: liquidColors.electricCyan,
    shadowOpacity: 0.36,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  chipLabel: {
    color: liquidColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipLabelSelected: {
    color: '#D5FBFF',
  },
  buttonPress: {
    borderRadius: 16,
  },
  buttonGlass: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: liquidColors.border,
  },
  buttonGlassPrimary: {
    backgroundColor: 'rgba(0, 229, 255, 0.22)',
    shadowColor: liquidColors.electricCyan,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  buttonGlassDanger: {
    backgroundColor: 'rgba(255, 106, 116, 0.18)',
    shadowColor: liquidColors.danger,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  buttonLabel: {
    color: '#04262E',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonLabelDanger: {
    color: '#FFE3E6',
  },
  sliderWrap: {
    gap: 10,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    color: liquidColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  sliderValue: {
    color: '#C7F8FF',
    fontSize: 12,
    fontWeight: '700',
  },
  sliderTrack: {
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    left: -1,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.56)',
    shadowColor: liquidColors.electricCyan,
    shadowOpacity: 0.45,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  sliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#9CF6FF',
    backgroundColor: '#E8FDFF',
    shadowColor: liquidColors.electricCyan,
    shadowOpacity: 0.42,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  pressed: {
    opacity: 0.93,
  },
});
