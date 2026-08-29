import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowRight, ShieldCheck, Truck, Zap } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAVY = '#20166E';
const RED = '#E41E2B';
const GREEN = '#1F9A5A';
const INK = '#17161D';
const MUTED = '#8B8A98';
const DOT_INACTIVE = '#E4E3EB';

export const ONBOARDING_SEEN_KEY = 'HAS_SEEN_ONBOARDING';

const SLIDES = [
  {
    image: require('../assets/images/onboarding/fast-shopping.jpg'),
    Icon: Zap,
    iconColor: RED,
    badge: 'Sekuntlarda satyn alyň',
    title: 'Çalt söwda, hiç bir kynçylyksyz',
    description:
      'Müňlerçe hakyky önüm elimiziň astynda. Tapyň, deňeşdiriň we birnäçe basyşda satyn alyň.',
  },
  {
    image: require('../assets/images/onboarding/buyer-protection.jpg'),
    Icon: ShieldCheck,
    iconColor: GREEN,
    badge: 'Alyjynyň goragy',
    title: 'Ygtybarly sargytlar hemişe',
    description:
      'Goralan töleg, barlanan satyjylar we her satyn almada resmi kepillik. Doly ynam bilen söwda ediň.',
  },
  {
    image: require('../assets/images/onboarding/fast-delivery.jpg'),
    Icon: Truck,
    iconColor: RED,
    badge: 'Aşgabatda şol gün eltip berme',
    title: 'Çalt eltip berme, gapyňyza çenli',
    description:
      'Hakyky wagtda yzarlamak we şäher boýunça şol gün eltip berme. Sargydyňyz size gerek wagtynda gelýär.',
  },
];

function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  // The container is padded by the horizontal insets, so a page is narrower
  // than the window. Paging math has to use the padded width or the pager
  // desyncs from the dots on devices with a side cutout.
  const width = windowWidth - insets.left - insets.right;

  const finish = () => {
    AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true').catch(() => {});
    onDone();
  };

  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/* The screen is always white, so the bars must always be dark —
          App.tsx flips to light-content in dark mode, which would make the
          status bar icons invisible here. */}
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />
      <View style={styles.topBar}>
        {!isLast && (
          <TouchableOpacity onPress={finish}>
            <Text style={styles.skip}>Geç</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.scroll}
      >
        {SLIDES.map(slide => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <View style={styles.imageWrap}>
              <Image
                source={slide.image}
                style={styles.image}
                resizeMode="cover"
              />
              <View style={styles.badge}>
                <slide.Icon
                  size={14}
                  color={slide.iconColor}
                  strokeWidth={1.75}
                />
                <Text style={styles.badgeText}>{slide.badge}</Text>
              </View>
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.description}>{slide.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        {isLast ? (
          <>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={finish}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaButtonText}>Başla</Text>
            </TouchableOpacity>
            <View style={styles.signInRow}>
              <Text style={styles.signInPrompt}>Hasabyňyz barmy? </Text>
              <TouchableOpacity onPress={finish}>
                <Text style={styles.signInLink}>Hasaba gir</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.navRow}>
            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={i === index ? styles.dotActive : styles.dotInactive}
                />
              ))}
            </View>
            <TouchableOpacity
              style={styles.nextButton}
              onPress={goNext}
              activeOpacity={0.85}
            >
              <ArrowRight size={22} color="#ffffff" strokeWidth={1.75} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  topBar: {
    height: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  skip: { fontSize: 14, fontWeight: '600', color: MUTED },
  scroll: { flex: 1 },
  slide: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  imageWrap: {
    width: '100%',
    height: 340,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#F5F5F8',
  },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: NAVY },
  textWrap: { paddingTop: 24, paddingBottom: 24 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: INK,
    marginBottom: 12,
    lineHeight: 32,
  },
  description: { fontSize: 15, lineHeight: 23, color: MUTED },
  footer: { paddingHorizontal: 32, paddingBottom: 40 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: { flexDirection: 'row', gap: 7 },
  dotActive: { width: 24, height: 7, borderRadius: 999, backgroundColor: NAVY },
  dotInactive: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: DOT_INACTIVE,
  },
  nextButton: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: NAVY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: NAVY,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  ctaButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  signInRow: { flexDirection: 'row', justifyContent: 'center' },
  signInPrompt: { fontSize: 14, color: MUTED },
  signInLink: { fontSize: 14, color: NAVY, fontWeight: '600' },
});

export default OnboardingScreen;
