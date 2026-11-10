/**
 * مصدر الحقيقة الوحيد للمسارات العربية وبيانات SEO.
 * يُستخدم في: tools/build-routes.mjs (توليد الصفحات) و assets/js/routes.js (المتصفح).
 */

export const DEFAULT_SITE_URL = 'https://noorislam.xyz';

export const SITE = {
  name: 'نور',
  locale: 'ar_MA',
  language: 'ar'
};

export const PAGES = [
  {
    key: 'home',
    path: '/',
    file: 'index.html',
    nav: 'الرئيسية',
    title: 'نور | مواقيت الصلاة والقرآن الكريم والأذكار',
    description: 'موقع نور الإسلامي: مواقيت الصلاة بدقة فلكية، القرآن الكريم بالرسم العثماني مع الترجمة والتفسير، الأذكار اليومية، المسبحة الرقمية، أسماء الله الحسنى، واتجاه القبلة.',
    priority: '1.0',
    changefreq: 'weekly'
  },
  {
    key: 'prayer',
    path: '/اوقات-الصلاة',
    file: 'اوقات-الصلاة.html',
    nav: 'مواقيت الصلاة',
    title: 'مواقيت الصلاة اليوم | نور',
    description: 'مواقيت الصلاة اليوم بدقة فلكية حسب مدينتك وطريقة الحساب المعتمدة، مع عدّاد للصلاة القادمة والتاريخ الهجري — يعمل دون إنترنت.',
    priority: '0.9',
    changefreq: 'daily'
  },
  {
    key: 'quran',
    path: '/القرآن-الكريم',
    file: 'القرآن-الكريم.html',
    nav: 'القرآن الكريم',
    title: 'القرآن الكريم بالرسم العثماني مع التفسير | نور',
    description: 'اقرأ القرآن الكريم كاملًا بالرسم العثماني، مع ترجمة إنجليزية معتمدة وتفسير الميسر وابن كثير، وتصفّح حسب الأجزاء والأحزاب وصفحات المصحف.',
    titleEn: 'The Holy Quran with Translation and Tafsir | Noor',
    descriptionEn: 'Read the Holy Quran in Uthmani script with an authentic English translation and trusted tafsir (Ibn Kathir), browsable by juz, hizb and mushaf page.',
    priority: '0.9',
    changefreq: 'weekly'
  },
  {
    key: 'azkar',
    path: '/الأذكار-اليومية',
    file: 'الأذكار-اليومية.html',
    nav: 'الأذكار اليومية',
    title: 'الأذكار اليومية: الصباح والمساء والنوم | نور',
    description: 'أذكار الصباح والمساء والنوم وأدعية اليوم مع عدّاد لكل ذكر وحفظ تلقائي للتقدّم.',
    priority: '0.8',
    changefreq: 'monthly'
  },
  {
    key: 'tasbih',
    path: '/المسبحة-الرقمية',
    file: 'المسبحة-الرقمية.html',
    nav: 'المسبحة الرقمية',
    title: 'المسبحة الرقمية للتسبيح | نور',
    description: 'سبّح إلكترونيًا بأهداف 33 و99 و100 و1000، مع حفظ إجمالي أذكار اليوم والإجمالي الكلي.',
    priority: '0.7',
    changefreq: 'monthly'
  },
  {
    key: 'names',
    path: '/أسماء-الله-الحسنى',
    file: 'أسماء-الله-الحسنى.html',
    nav: 'أسماء الله الحسنى',
    title: 'أسماء الله الحسنى التسعة والتسعون مع معانيها | نور',
    description: 'تسعة وتسعون اسمًا من أسماء الله الحسنى مع شرح موجز لكل اسم، وبحث فوري ونسخ بضغطة.',
    priority: '0.8',
    changefreq: 'monthly'
  },
  {
    key: 'qibla',
    path: '/اتجاه-القبلة',
    file: 'اتجاه-القبلة.html',
    nav: 'اتجاه القبلة',
    title: 'اتجاه القبلة: بوصلة دقيقة مع وضع الكاميرا | نور',
    description: 'اعرف اتجاه القبلة بدقة من موقعك: زاوية من الشمال الحقيقي مع تصحيح الانحراف المغناطيسي (NOAA WMM)، بوصلة حيّة، ووضع كاميرا AR بسهم محاذاة.',
    priority: '0.8',
    changefreq: 'monthly'
  }
];

export const pageByKey = (key) => PAGES.find((p) => p.key === key) || PAGES[0];

export const absoluteUrl = (siteUrl, path) => `${siteUrl.replace(/\/+$/, '')}${path}`;
