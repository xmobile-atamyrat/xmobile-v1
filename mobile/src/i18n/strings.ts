import { SupportedLocale } from './locale';

type SlideStrings = {
  /**
   * Optional: the pill overlaid on the slide image. The delivery slide has
   * none -- it claimed same-day delivery in Ashgabat, which the business does
   * not promise -- and a slide without one simply renders the bare image.
   */
  badge?: string;
  title: string;
  description: string;
};

export type Strings = {
  onboarding: {
    skip: string;
    /**
     * Primary footer CTA on the last slide. It enters the app as a guest --
     * straight to the home page, no account -- because a first-launch user who
     * is still deciding should be able to look before signing anything.
     */
    cta: string;
    /** Secondary footer line: the opt-in route to /user/signup. */
    signUpPrompt: string;
    signUpLink: string;
    /** Fixed at three, one per slide, aligned with SLIDE_VISUALS. */
    slides: [SlideStrings, SlideStrings, SlideStrings];
  };
  app: {
    offlineTitle: string;
    offlineBody: string;
    retry: string;
    errorTitle: string;
    errorBody: string;
    certificateBody: string;
    vpnHint: string;
    supportLink: string;
  };
};

/** The original copy the screens shipped with, kept verbatim. */
const tk: Strings = {
  onboarding: {
    skip: 'Geç',
    cta: 'Myhman hökmünde dowam et',
    signUpPrompt: 'Hasabyňyz ýokmy? ',
    signUpLink: 'Täze hasap döret',
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
        title: 'Çalt eltip berme, gapyňyza çenli',
        description:
          'Türkmenistanyň ähli welaýatlaryna eltip berýäris. Sargydyňyz gelende nagt töläň.',
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
    certificateBody:
      'Howpsuz baglanyşyk gurnap bolmady. Toruňyz şifrlenen maglumaty barlaýan bolmagy mümkin — bu köplenç köpçülik ýa-da iş Wi-Fi torlarynda bolýar.',
    vpnHint:
      'Eger VPN ýa-da gizlin geçiriji ulanýan bolsaňyz, ony öçürip görüň.',
    supportLink: 'Goldaw gullugyna ýüz tutuň',
  },
};

const ru: Strings = {
  onboarding: {
    skip: 'Пропустить',
    cta: 'Продолжить как гость',
    signUpPrompt: 'Нет аккаунта? ',
    signUpLink: 'Зарегистрироваться',
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
        title: 'Быстрая доставка, прямо до двери',
        description:
          'Доставляем во все велаяты Туркменистана. Оплатите наличными при получении заказа.',
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
    certificateBody:
      'Не удалось установить защищённое соединение. Возможно, ваша сеть проверяет зашифрованный трафик — это часто бывает в публичных и корпоративных сетях Wi-Fi.',
    vpnHint:
      'Если вы используете VPN или «Частный узел», попробуйте отключить его.',
    supportLink: 'Обратиться в поддержку',
  },
};

const en: Strings = {
  onboarding: {
    skip: 'Skip',
    cta: 'Continue as a guest',
    signUpPrompt: "Don't have an account? ",
    signUpLink: 'Sign up',
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
        title: 'Fast delivery, right to your door',
        description:
          'We deliver to every velayat of Turkmenistan. Pay in cash when your order arrives.',
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
    certificateBody:
      'A secure connection could not be established. Your network may be inspecting encrypted traffic — this is common on public and corporate Wi-Fi.',
    vpnHint: 'If you are using a VPN or Private Relay, try turning it off.',
    supportLink: 'Contact support',
  },
};

const tr: Strings = {
  onboarding: {
    skip: 'Geç',
    cta: 'Misafir olarak devam et',
    signUpPrompt: 'Hesabınız yok mu? ',
    signUpLink: 'Kayıt ol',
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
        title: 'Hızlı teslimat, kapınıza kadar',
        description:
          "Türkmenistan'ın tüm velayetlerine teslimat yapıyoruz. Siparişiniz geldiğinde nakit ödeyin.",
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
    certificateBody:
      'Güvenli bağlantı kurulamadı. Ağınız şifreli trafiği inceliyor olabilir — bu, genel ve kurumsal Wi-Fi ağlarında sık görülür.',
    vpnHint: 'VPN veya Özel Dolaşım kullanıyorsanız, kapatmayı deneyin.',
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
