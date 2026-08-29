import { SupportedLocale } from './locale';

type SlideStrings = {
  badge: string;
  title: string;
  description: string;
};

export type Strings = {
  onboarding: {
    skip: string;
    cta: string;
    signInPrompt: string;
    signInLink: string;
    /** Fixed at three, one per slide, aligned with SLIDE_VISUALS. */
    slides: [SlideStrings, SlideStrings, SlideStrings];
  };
  app: {
    offlineTitle: string;
    offlineBody: string;
    retry: string;
    errorTitle: string;
    errorBody: string;
    supportLink: string;
  };
};

/** The original copy the screens shipped with, kept verbatim. */
const tk: Strings = {
  onboarding: {
    skip: 'Geç',
    cta: 'Başla',
    signInPrompt: 'Hasabyňyz barmy? ',
    signInLink: 'Hasaba gir',
    slides: [
      {
        badge: 'Sekuntlarda satyn alyň',
        title: 'Çalt söwda, hiç bir kynçylyksyz',
        description:
          'Müňlerçe hakyky önüm elimiziň astynda. Tapyň, deňeşdiriň we birnäçe basyşda satyn alyň.',
      },
      {
        badge: 'Alyjynyň goragy',
        title: 'Ygtybarly sargytlar hemişe',
        description:
          'Goralan töleg, barlanan satyjylar we her satyn almada resmi kepillik. Doly ynam bilen söwda ediň.',
      },
      {
        badge: 'Aşgabatda şol gün eltip berme',
        title: 'Çalt eltip berme, gapyňyza çenli',
        description:
          'Hakyky wagtda yzarlamak we şäher boýunça şol gün eltip berme. Sargydyňyz size gerek wagtynda gelýär.',
      },
    ],
  },
  app: {
    offlineTitle: 'Internet baglanyşygy ýok',
    offlineBody:
      'Wi-Fi ýa-da mobil internetiňizi barlaň we täzeden synanyşyň. Sebediňiz ýatda saklandy.',
    retry: 'Täzeden synanyş',
    errorTitle: 'Näsazlyk ýüze çykdy',
    errorBody: 'Bu sahypany häzir ýükläp bolmady. Birazdan täzeden synanyşyň.',
    supportLink: 'Goldaw gullugyna ýüz tutuň',
  },
};

const ru: Strings = {
  onboarding: {
    skip: 'Пропустить',
    cta: 'Начать',
    signInPrompt: 'Уже есть аккаунт? ',
    signInLink: 'Войти',
    slides: [
      {
        badge: 'Покупайте за секунды',
        title: 'Быстрые покупки, без лишних хлопот',
        description:
          'Тысячи оригинальных товаров под рукой. Находите, сравнивайте и покупайте в несколько касаний.',
      },
      {
        badge: 'Защита покупателя',
        title: 'Надёжные заказы всегда',
        description:
          'Защищённая оплата, проверенные продавцы и официальная гарантия на каждую покупку. Покупайте с полной уверенностью.',
      },
      {
        badge: 'Доставка в Ашхабаде в тот же день',
        title: 'Быстрая доставка, прямо до двери',
        description:
          'Отслеживание в реальном времени и доставка по городу в тот же день. Ваш заказ приходит именно тогда, когда нужен.',
      },
    ],
  },
  app: {
    offlineTitle: 'Нет подключения к интернету',
    offlineBody:
      'Проверьте Wi-Fi или мобильный интернет и попробуйте снова. Ваша корзина сохранена.',
    retry: 'Повторить',
    errorTitle: 'Произошла ошибка',
    errorBody:
      'Не удалось загрузить эту страницу. Попробуйте ещё раз чуть позже.',
    supportLink: 'Обратиться в поддержку',
  },
};

const en: Strings = {
  onboarding: {
    skip: 'Skip',
    cta: 'Get started',
    signInPrompt: 'Already have an account? ',
    signInLink: 'Sign in',
    slides: [
      {
        badge: 'Buy in seconds',
        title: 'Fast shopping, without the hassle',
        description:
          'Thousands of genuine products at your fingertips. Find, compare and buy in a few taps.',
      },
      {
        badge: 'Buyer protection',
        title: 'Reliable orders, every time',
        description:
          'Protected payments, verified sellers and an official warranty on every purchase. Shop with complete confidence.',
      },
      {
        badge: 'Same-day delivery in Ashgabat',
        title: 'Fast delivery, right to your door',
        description:
          'Real-time tracking and same-day delivery across the city. Your order arrives exactly when you need it.',
      },
    ],
  },
  app: {
    offlineTitle: 'No internet connection',
    offlineBody:
      'Check your Wi-Fi or mobile data and try again. Your cart has been saved.',
    retry: 'Try again',
    errorTitle: 'Something went wrong',
    errorBody: 'This page could not be loaded right now. Try again shortly.',
    supportLink: 'Contact support',
  },
};

const tr: Strings = {
  onboarding: {
    skip: 'Geç',
    cta: 'Başla',
    signInPrompt: 'Hesabınız var mı? ',
    signInLink: 'Giriş yap',
    slides: [
      {
        badge: 'Saniyeler içinde satın alın',
        title: 'Hızlı alışveriş, hiç zahmetsiz',
        description:
          'Binlerce orijinal ürün elinizin altında. Bulun, karşılaştırın ve birkaç dokunuşla satın alın.',
      },
      {
        badge: 'Alıcı koruması',
        title: 'Her zaman güvenli siparişler',
        description:
          'Korumalı ödeme, doğrulanmış satıcılar ve her alışverişte resmi garanti. Tam bir güvenle alışveriş edin.',
      },
      {
        badge: "Aşkabat'ta aynı gün teslimat",
        title: 'Hızlı teslimat, kapınıza kadar',
        description:
          'Gerçek zamanlı takip ve şehir genelinde aynı gün teslimat. Siparişiniz tam ihtiyacınız olduğunda geliyor.',
      },
    ],
  },
  app: {
    offlineTitle: 'İnternet bağlantısı yok',
    offlineBody:
      'Wi-Fi veya mobil internetinizi kontrol edip tekrar deneyin. Sepetiniz kaydedildi.',
    retry: 'Tekrar dene',
    errorTitle: 'Bir sorun oluştu',
    errorBody:
      'Bu sayfa şu anda yüklenemedi. Lütfen biraz sonra tekrar deneyin.',
    supportLink: 'Destek ekibine başvurun',
  },
};

/**
 * 'ch' (the Chärjew dialect) intentionally reuses the Turkmen bundle. The two
 * are the same language and differ only in wording -- compare src/i18n/tk.json
 * with src/i18n/ch.json on the web side -- so standard Turkmen reads correctly
 * to a Chärjew speaker in the meantime. Replace with dialect copy from a native
 * speaker when it is available; nothing else needs to change.
 */
const BUNDLES: Record<SupportedLocale, Strings> = { en, ru, tk, ch: tk, tr };

export function getStrings(locale: SupportedLocale): Strings {
  return BUNDLES[locale];
}
