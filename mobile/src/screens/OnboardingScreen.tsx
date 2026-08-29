import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowRight, ShieldCheck, Truck, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

const NAVY = '#20166E';
const RED = '#E41E2B';
const GREEN = '#1F9A5A';
const INK = '#17161D';
const MUTED = '#8B8A98';
const DOT_INACTIVE = '#E4E3EB';

export const ONBOARDING_SEEN_KEY = 'HAS_SEEN_ONBOARDING';

// Route in the web app that the "Hasaba gir" link hands off to.
const SIGN_IN_PATH = '/user/signin';

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

function OnboardingScreen({
  onDone,
}: {
  onDone: (landingPath?: string) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  // A page is as wide as the pager, not as wide as the window -- an ancestor
  // pads for the safe area, so on a device with a side cutout the two differ
  // and the pager would desync from the dots. Measuring means this stays right
  // no matter who adds padding above us. windowWidth is only the first-frame
  // guess, replaced as soon as layout runs.
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = measuredWidth || windowWidth;

  const handleLayout = (e: LayoutChangeEvent) => {
    setMeasuredWidth(e.nativeEvent.layout.width);
  };

  // Rotating the device changes the page width, which leaves the saved scroll
  // offset pointing into the middle of a page -- two half-slides, dots on the
  // wrong one. Re-anchor to the current slide whenever the width changes.
  //
  // The index is read through a ref so this depends on width alone. Depending
  // on the index state as well would re-run it on every swipe, and an instant
  // scrollTo landing mid-snap turns the paging animation into a jump.
  const indexRef = useRef(0);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      x: indexRef.current * width,
      animated: false,
    });
  }, [width]);

  const isFinishingRef = useRef(false);

  const finish = useCallback(
    async (landingPath?: string) => {
      // The await below yields, so a double tap could otherwise call onDone twice.
      if (isFinishingRef.current) {
        return;
      }
      isFinishingRef.current = true;

      try {
        await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
      } catch (error) {
        // Still let the user through -- trapping them on the intro is worse
        // than replaying it. But say so: swallowing this silently means
        // onboarding reappears on every launch with nothing to explain why.
        console.warn('Failed to persist onboarding state:', error);
      }
      onDone(landingPath);
    },
    [onDone],
  );

  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  // Both handlers are needed. onMomentumScrollEnd covers flicks; a slow drag
  // released without a flick never starts momentum, so on its own it would
  // leave the dots pointing at the previous slide.
  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    indexRef.current = next;
    setIndex(next);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        {!isLast && (
          <TouchableOpacity onPress={() => finish()}>
            <Text style={styles.skip}>Geç</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={handleLayout}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
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
              onPress={() => finish()}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaButtonText}>Başla</Text>
            </TouchableOpacity>
            <View style={styles.signInRow}>
              <Text style={styles.signInPrompt}>Hasabyňyz barmy? </Text>
              <TouchableOpacity onPress={() => finish(SIGN_IN_PATH)}>
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
    // Yoga defaults flexShrink to 0, so on a short screen (iPhone SE) the fixed
    // 340 plus the text overflowed the centred slide and clipped at both ends.
    // Shrinking gives the height back to the text; resizeMode="cover" just
    // crops a little more.
    flexShrink: 1,
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
