/* ============================================================
   نور — منطق الموقع
   ============================================================ */
'use strict';

(() => {
  /* ---------- أدوات ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const AR = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  // كل الأرقام في الموقع تُعرض بالأرقام اللاتينية 0-9
  const toAr = (v) => String(v);
  const fromAr = (v) => String(v).replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)));
  const pad2 = (n) => String(n).padStart(2, '0');
  // المواقيت والأرقام تُعرض بأرقام لاتينية (0-9) لا عربية-هندية
  const fmtTime = (t) => `${pad2(t.h)}:${pad2(t.m)}`;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const normalizeAr = (s) => String(s)
    .replace(/[\u064B-\u0652\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase();

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const dayOfYear = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  };

  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* التخزين غير متاح */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { /* تجاهل */ }
    }
  };

  const vibrate = (ms = 12) => {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* تجاهل */ }
  };

  /* ---------- الحالة ---------- */
  const state = {
    page: 'home',
    theme: storage.get('theme', 'dark'),
    city: null,
    methodId: storage.get('methodId', null),
    customLoc: null,
    prayer: null,
    next: null,
    dayKey: todayKey(),
    selectedSurah: null,
    surahCache: new Map(),
    pageCache: new Map(),
    currentAyahs: null,
    currentSurah: null,
    surahAbort: null,
    quranSize: storage.get('quranSize', 30),
    lang: 'ar',
    quranTab: 'surahs',
    quranEnglish: storage.get('quranEnglish', true),
    quranPage: null,
    quranView: null,
    quranRequest: 0,
    surahIndexLoaded: false,
    urlSurah: null,
    urlPage: null,
    azkarCat: 'morning',
    azkarDone: { day: todayKey(), data: {} },
    dhikrIndex: 0,
    tasbihCount: 0,
    tasbihTarget: 33,
    totals: { day: todayKey(), today: 0, total: 0 },
    qiblaBearing: 0,
    heading: null,
    declination: 0,
    compassAccuracy: null,
    compassJitter: null,
    gpsAccuracy: null,
    compassBound: false,
    ar: { open: false, stream: null }
  };

  const els = {};

  /* ---------- المسارات العربية (SEO) ---------- */
  const ROUTE_PAGES = (window.NOOR_ROUTES && window.NOOR_ROUTES.pages) ? window.NOOR_ROUTES.pages : {
    home: {
      path: '/',
      title: 'نور | مواقيت الصلاة والقرآن الكريم والأذكار',
      description: 'موقع نور الإسلامي: مواقيت الصلاة بدقة فلكية، القرآن الكريم بالرسم العثماني مع الترجمة والتفسير، الأذكار اليومية، المسبحة الرقمية، أسماء الله الحسنى، واتجاه القبلة.'
    },
    prayer: {
      path: '/prayer-times',
      title: 'مواقيت الصلاة اليوم | نور',
      description: 'مواقيت الصلاة اليوم بدقة فلكية حسب مدينتك وطريقة الحساب المعتمدة، مع عدّاد للصلاة القادمة والتاريخ الهجري.'
    },
    quran: {
      path: '/quran',
      title: 'القرآن الكريم بالرسم العثماني مع التفسير | نور',
      description: 'اقرأ القرآن الكريم كاملًا بالرسم العثماني، مع ترجمة إنجليزية معتمدة وتفسير الميسر وابن كثير، وتصفّح حسب الأجزاء والأحزاب وصفحات المصحف.',
      titleEn: 'The Holy Quran with Translation and Tafsir | Noor',
      descriptionEn: 'Read the Holy Quran in Uthmani script with an authentic English translation and trusted tafsir (Ibn Kathir), browsable by juz, hizb and mushaf page.'
    },
    azkar: {
      path: '/azkar',
      title: 'الأذكار اليومية: الصباح والمساء والنوم | نور',
      description: 'أذكار الصباح والمساء والنوم وأدعية اليوم مع عدّاد لكل ذكر وحفظ تلقائي للتقدّم.'
    },
    tasbih: {
      path: '/tasbih',
      title: 'المسبحة الرقمية للتسبيح | نور',
      description: 'سبّح إلكترونيًا بأهداف 33 و99 و100 و1000، مع حفظ إجمالي أذكار اليوم والإجمالي الكلي.'
    },
    names: {
      path: '/names-of-allah',
      title: 'أسماء الله الحسنى التسعة والتسعون مع معانيها | نور',
      description: 'تسعة وتسعون اسمًا من أسماء الله الحسنى مع شرح موجز لكل اسم، وبحث فوري ونسخ بضغطة.'
    },
    qibla: {
      path: '/qibla-finder',
      title: 'اتجاه القبلة: بوصلة دقيقة مع وضع الكاميرا | نور',
      description: 'اعرف اتجاه القبلة بدقة من موقعك: زاوية من الشمال الحقيقي مع تصحيح الانحراف المغناطيسي (NOAA WMM)، بوصلة حيّة، ووضع كاميرا AR بسهم محاذاة.'
    }
  };

  const SITE_URL = (window.NOOR_ROUTES && window.NOOR_ROUTES.siteUrl) || 'https://noorislam.xyz';

  function loosePath(value) {
    return decodeURI(String(value || '/'))
      .replace(/\/index\.html?$/i, '/')
      .replace(/\.html?$/i, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[\u064B-\u0652\u0640]/g, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }

  function pageFromPath() {
    const current = loosePath(location.pathname);
    const keys = Object.keys(ROUTE_PAGES);
    for (const key of keys) {
      if (loosePath(ROUTE_PAGES[key].path) === current) return key;
    }
    return null;
  }

  function pathFor(page) {
    return (ROUTE_PAGES[page] || ROUTE_PAGES.home).path;
  }

  const METHOD_BY_COUNTRY = {
    'المغرب': 'morocco',
    'السعودية': 'umm',
    'مصر': 'egypt',
    'الإمارات': 'dubai',
    'باكستان': 'karachi',
    'الهند': 'karachi',
    'بنغلاديش': 'karachi',
    'أفغانستان': 'karachi',
    'تركيا': 'turkey',
    'الولايات المتحدة': 'isna',
    'كندا': 'isna'
  };

  const PRAYER_ICONS = {
    fajr: 'i-sunrise',
    sunrise: 'i-sunrise',
    dhuhr: 'i-sun',
    asr: 'i-sun',
    maghrib: 'i-sunset',
    isha: 'i-moon'
  };

  /* ---------- عناصر ---------- */
  function cacheEls() {
    const ids = [
      'nav', 'themeToggle', 'toast', 'footerYear',
      'heroCity', 'heroNextName', 'heroNextTime', 'cdH', 'cdM', 'cdS',
      'hijriDate', 'gregDate', 'heroProgress',
      'dailyVerse', 'dailyVerseRef', 'dailyHadith', 'dailyHadithRef',
      'citySelect', 'methodSelect', 'geoBtn', 'pNextName', 'pNextTime', 'pNextMeta',
      'pCdH', 'pCdM', 'pCdS', 'prayerGrid',
      'surahSearch', 'surahCount', 'surahList', 'readerEmpty', 'readerLoading',
      'readerError', 'readerBody', 'readerType', 'readerTitle', 'readerMeta',
      'readerBismillah', 'ayahs', 'readerCopy', 'fontMinus', 'fontPlus',
      'surahAudio', 'retrySurah', 'offlineSurahs',
      'langToggle', 'langLabel', 'idxTabs', 'indexGrid', 'enToggle',
      'pageNav', 'pagePrev', 'pageNext', 'pageLabel', 'audioBar',
      'azkarCats', 'azkarList', 'azkarProgress', 'azkarProgressBar',
      'azkarProgressText', 'azkarReset',
      'dhikrChips', 'tasbihCount', 'tasbihTargetLabel', 'tasbihBtn', 'ringProgress',
      'tasbihReset', 'tasbihTarget', 'targetValue', 'tasbihToday', 'tasbihTotal',
      'namesSearch', 'namesGrid', 'namesCount', 'namesEmpty',
      'qiblaDeg', 'qiblaCity', 'qiblaDist', 'qiblaLat', 'qiblaLng',
      'qiblaGeo', 'qiblaCompass', 'compassHint', 'compassNeedle',
      'qiblaDecl', 'qiblaGps', 'qiblaLive', 'liveHeading', 'liveDelta', 'liveAccuracy',
      'qiblaAR', 'arOverlay', 'arVideo', 'arArrow', 'arDelta', 'arStatus', 'arFreeze', 'arClose',
    ];
    for (const id of ids) els[id] = document.getElementById(id);
    els.compassSvg = $('#compass svg');
    els.pages = $$('.page');
    els.navLinks = $$('.nav-link');
  }

  /* ---------- تنبيه ---------- */
  let toastTimer = null;
  function toast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2800);
  }

  function copyText(text) {
    const fallback = () => {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      area.remove();
      toast(ok ? 'تم النسخ' : 'تعذّر النسخ');
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => toast('تم النسخ')).catch(fallback);
    } else {
      fallback();
    }
  }

  /* ---------- المظهر ---------- */
  function applyTheme(theme) {
    state.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = state.theme;
    const use = els.themeToggle ? els.themeToggle.querySelector('use') : null;
    if (use) use.setAttribute('href', state.theme === 'dark' ? '#i-sun' : '#i-moon');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.theme === 'dark' ? '#06130f' : '#f7f3e8');
    storage.set('theme', state.theme);
  }

  /* ---------- التنقل ---------- */
  function go(page, opts = {}) {
    if (!ROUTE_PAGES[page]) page = 'home';
    state.page = page;

    els.pages.forEach((section) => {
      const active = section.id === `page-${page}`;
      section.hidden = !active;
      section.classList.toggle('is-active', active);
    });

    els.navLinks.forEach((btn) => {
      const active = btn.dataset.page === page;
      btn.classList.toggle('is-active', active);
      if (active) {
        btn.setAttribute('aria-current', 'page');
        if (window.innerWidth <= 960) {
          btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        }
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    updateSeo(page);

    if (!opts.skipUrl) {
      const url = buildUrl(page);
      const current = `${location.pathname}${location.search}`;
      if (url !== current) {
        try {
          if (opts.replace) history.replaceState({ page }, '', url);
          else history.pushState({ page }, '', url);
        } catch (e) { /* تجاهل */ }
      }
    }

    if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: opts.instant ? 'auto' : 'auto' });

    if (page === 'quran' && !state.quranView) loadInitialQuran();
    if (page === 'azkar') renderAzkarList();
    if (page === 'qibla') renderQibla();
    if (page !== 'qibla') closeAR();
  }

  /* ---------- الرابط واللغة ---------- */
  function buildUrl(page) {
    const params = new URLSearchParams();
    if (state.lang === 'en' && page === 'quran') params.set('lang', 'en');
    if (page === 'quran') {
      if (state.urlPage) params.set('page', String(state.urlPage));
      else if (state.urlSurah) params.set('surah', String(state.urlSurah));
    }
    const qs = params.toString();
    return `${pathFor(page)}${qs ? `?${qs}` : ''}`;
  }

  function syncUrl(patch = {}) {
    if ('surah' in patch) {
      state.urlSurah = patch.surah;
      if (patch.surah) state.urlPage = null;
    }
    if ('page' in patch) {
      state.urlPage = patch.page;
      if (patch.page) state.urlSurah = null;
    }

    const url = buildUrl(state.page);
    if (url !== `${location.pathname}${location.search}`) {
      try { history.replaceState({ page: state.page }, '', url); } catch (e) { /* تجاهل */ }
    }
  }

  function setMetaContent(selector, value) {
    const el = document.querySelector(selector);
    if (el && value) el.setAttribute('content', value);
  }

  function updateSeo(page) {
    const meta = ROUTE_PAGES[page] || ROUTE_PAGES.home;
    const english = state.lang === 'en' && page === 'quran';
    const title = english && meta.titleEn ? meta.titleEn : meta.title;
    const description = english && meta.descriptionEn ? meta.descriptionEn : meta.description;
    const canonical = `${location.origin}${pathFor(page)}`;

    document.title = title;
    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[property="og:url"]', canonical);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);

    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.append(link);
    }
    link.setAttribute('href', canonical);

    const robots = document.querySelector('meta[name="robots"]');
    if (robots) {
      robots.setAttribute('content', english ? 'noindex, follow' : 'index, follow, max-image-preview:large');
    }

    document.documentElement.dataset.route = page;

    const schema = document.getElementById('pageSchema');
    if (schema) {
      schema.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': page === 'home' ? 'WebSite' : 'WebPage',
        name: title,
        description,
        url: canonical,
        inLanguage: 'ar',
        isPartOf: { '@type': 'WebSite', name: 'نور', url: `${location.origin}/` }
      });
    }
  }

  function applyLang(lang, opts = {}) {
    state.lang = lang === 'en' ? 'en' : 'ar';
    storage.set('lang', state.lang);
    document.documentElement.lang = 'ar';

    const quranPage = document.getElementById('page-quran');
    if (quranPage) {
      quranPage.dir = state.lang === 'en' ? 'ltr' : 'rtl';
      quranPage.lang = state.lang;
    }

    $$('[data-en]').forEach((el) => {
      if (!el.dataset.ar) el.dataset.ar = el.textContent;
      el.textContent = state.lang === 'en' ? el.dataset.en : el.dataset.ar;
    });

    $$('[data-en-placeholder]').forEach((el) => {
      if (!el.dataset.arPlaceholder) el.dataset.arPlaceholder = el.placeholder;
      el.placeholder = state.lang === 'en' ? el.dataset.enPlaceholder : el.dataset.arPlaceholder;
    });

    if (els.langLabel) els.langLabel.textContent = state.lang === 'en' ? 'ع' : 'EN';
    if (els.langToggle) {
      const label = state.lang === 'en' ? 'العربية' : 'English';
      els.langToggle.title = label;
      els.langToggle.setAttribute('aria-label', label);
    }

    updateSeo(state.page);

    renderIndex();
    if (state.quranView) renderQuranView(state.quranView);
    updateEnToggle();
    if (!opts.silent) syncUrl();
  }

  function updateEnToggle() {
    if (!els.enToggle) return;
    els.enToggle.classList.toggle('is-active', !!state.quranEnglish);
    els.enToggle.setAttribute('aria-pressed', String(!!state.quranEnglish));
    els.enToggle.title = state.quranEnglish
      ? T('إخفاء الترجمة الإنجليزية', 'Hide English translation')
      : T('إظهار الترجمة الإنجليزية', 'Show English translation');
  }

  /* ---------- التاريخ ---------- */
  function renderDates() {
    const now = new Date();
    try {
      els.hijriDate.textContent = Prayer.hijriParts(now).text;
    } catch (e) { els.hijriDate.textContent = '—'; }

    try {
      els.gregDate.textContent = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).format(now);
    } catch (e) {
      els.gregDate.textContent = now.toLocaleDateString('ar-u-nu-latn');
    }
  }

  function renderDaily() {
    const day = dayOfYear();
    const verse = DATA.verses[day % DATA.verses.length];
    const hadith = DATA.hadiths[(day + 4) % DATA.hadiths.length];
    els.dailyVerse.textContent = `﴿ ${verse.text} ﴾`;
    els.dailyVerseRef.textContent = verse.ref;
    els.dailyHadith.textContent = `« ${hadith.text} »`;
    els.dailyHadithRef.textContent = hadith.ref;
  }

  /* ---------- الموقع ---------- */
  function activeLocation() {
    return state.customLoc || state.city;
  }

  function getMethod() {
    return DATA.methods.find((m) => m.id === state.methodId) || DATA.methods[0];
  }

  function suggestMethod(country) {
    return METHOD_BY_COUNTRY[country] || 'mwl';
  }

  function locationLabel() {
    const loc = activeLocation();
    return loc.country ? `${loc.name}، ${loc.country}` : loc.name;
  }

  /* ---------- الصلاة ---------- */
  function renderPrayer() {
    const loc = activeLocation();
    if (!loc) return;

    let result;
    try {
      result = Prayer.timesForCity(loc, getMethod(), new Date());
    } catch (e) {
      console.error('تعذّر حساب المواقيت', e);
      toast('تعذّر حساب المواقيت لهذه المدينة');
      return;
    }

    state.prayer = result;
    const next = Prayer.nextPrayer(result, new Date());
    state.next = next;

    const label = locationLabel();
    els.heroCity.textContent = loc.name;
    els.heroCity.title = label;
    els.heroNextName.textContent = next.timing.label;
    els.heroNextTime.textContent = fmtTime(next.timing);

    els.pNextName.textContent = next.timing.label;
    els.pNextTime.textContent = fmtTime(next.timing);
    els.pNextMeta.textContent = next.tomorrow
      ? `غدًا · ${label}`
      : `${label} · ${next.timing.key === 'sunrise' ? 'ينتهي وقت الفجر' : 'حسب توقيت مدينتك'}`;

    const nowMs = Date.now();
    els.prayerGrid.innerHTML = Prayer.PRAYER_KEYS.map((key) => {
      const t = result.timings[key];
      const isNext = next.timing.key === key && !next.tomorrow;
      const past = t.date.getTime() <= nowMs && !isNext;
      const cls = isNext ? 'is-next' : (past ? 'is-past' : '');
      let sub = isNext ? 'الصلاة القادمة' : (past ? 'انقضى' : 'قادمة');
      if (key === 'sunrise') sub = past ? 'انقضى' : 'ينتهي وقت الفجر';
      return `
        <article class="prayer-item ${cls}">
          <span class="p-icon"><svg class="icon"><use href="#${PRAYER_ICONS[key]}"></use></svg></span>
          <span class="p-name">${t.label}</span>
          <strong class="p-time">${fmtTime(t)}</strong>
          <span class="p-sub">${sub}</span>
        </article>`;
    }).join('');

    updateCountdownToNext();
    updateProgress();
  }

  function updateCountdownToNext() {
    if (!state.next) return;
    const diff = state.next.timing.date.getTime() - Date.now();
    updateCountdown(Math.max(0, diff));
  }

  function updateCountdown(diff) {
    const total = Math.floor(diff / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const setPair = (a, b, value) => {
      const va = pad2(value);
      if (els[a]) els[a].textContent = va;
      if (els[b]) els[b].textContent = va;
    };
    setPair('cdH', 'pCdH', h);
    setPair('cdM', 'pCdM', m);
    setPair('cdS', 'pCdS', s);
  }

  function updateProgress() {
    if (!state.prayer || !state.next) return;
    const now = Date.now();
    const prev = Prayer.previousPrayer(state.prayer, new Date(now));
    const total = state.next.timing.date.getTime() - prev.date.getTime();
    const passed = now - prev.date.getTime();
    const pct = total > 0 ? clamp((passed / total) * 100, 0, 100) : 0;
    if (els.heroProgress) els.heroProgress.style.width = `${pct}%`;
  }

  function tick() {
    const day = todayKey();
    if (day !== state.dayKey) {
      state.dayKey = day;
      renderDates();
      renderDaily();
      if (state.azkarDone.day !== day) {
        state.azkarDone = { day, data: {} };
        renderAzkarList();
      }
      if (state.totals.day !== day) {
        state.totals = { day, today: 0, total: state.totals.total };
        storage.set('tasbihTotals', state.totals);
        updateTasbihUI();
      }
      renderPrayer();
    }

    if (!state.next) return;
    const diff = state.next.timing.date.getTime() - Date.now();
    if (diff <= 0) {
      renderPrayer();
      return;
    }
    updateCountdown(diff);
    updateProgress();
  }

  /* ---------- إعداد القوائم ---------- */
  function initSelects() {
    const storedCity = storage.get('cityName', 'الدار البيضاء');
    let selected = DATA.cities.find((c) => c.name === storedCity);

    const grouped = new Map();
    for (const city of DATA.cities) {
      if (!grouped.has(city.country)) grouped.set(city.country, []);
      grouped.get(city.country).push(city);
    }

    const countries = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, 'ar'));
    let html = '';
    for (const country of countries) {
      html += `<optgroup label="${country}">`;
      const list = grouped.get(country).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      for (const city of list) {
        html += `<option value="${city.name}">${city.name}</option>`;
      }
      html += '</optgroup>';
    }
    els.citySelect.innerHTML = html;

    if (!selected) selected = DATA.cities.find((c) => c.name === 'الدار البيضاء') || DATA.cities[0];
    state.city = selected;
    els.citySelect.value = selected.name;

    els.methodSelect.innerHTML = DATA.methods
      .map((m) => `<option value="${m.id}">${m.name}</option>`)
      .join('');

    const storedMethod = state.methodId;
    state.methodId = storedMethod && DATA.methods.some((m) => m.id === storedMethod)
      ? storedMethod
      : suggestMethod(selected.country);
    els.methodSelect.value = state.methodId;
  }

  /* ---------- تحديد الموقع ---------- */
  function nearestCity(lat, lng) {
    let best = null;
    for (const city of DATA.cities) {
      const dLat = (city.lat - lat) * Math.PI / 180;
      const dLng = (city.lng - lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat * Math.PI / 180) * Math.cos(city.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      const dist = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
      if (!best || dist < best.dist) best = { city, dist };
    }
    return best;
  }

  function locate() {
    if (!navigator.geolocation) {
      toast('متصفحك لا يدعم تحديد الموقع');
      return;
    }
    toast('جارٍ تحديد موقعك…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const near = nearestCity(lat, lng);
        const name = near && near.dist < 70 ? `قرب ${near.city.name}` : 'موقعي الحالي';
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        state.gpsAccuracy = Math.round(pos.coords.accuracy || 0) || null;
        state.customLoc = { name, country: '', lat, lng, tz };
        renderPrayer();
        renderQibla();
        toast(state.gpsAccuracy
          ? `تم تحديد موقعك (دقة ±${state.gpsAccuracy} م)`
          : 'تم تحديد موقعك وحساب المواقيت');
      },
      () => toast('تعذّر تحديد الموقع — تحقّق من إذن الموقع'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    );
  }

  /* ---------- القرآن ---------- */
  const QURAN_API = 'https://api.alquran.cloud/v1';
  const TAFSIR_BASE = 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir';
  const TAFSIR_EDITIONS = {
    ar: {
      slug: 'ar-tafsir-muyassar',
      label: 'تفسير الميسر',
      labelEn: 'Tafsir al-Muyassar',
      by: 'مجمع الملك فهد لطباعة المصحف الشريف',
      byEn: 'King Fahd Quran Printing Complex'
    },
    en: {
      slug: 'en-tafisr-ibn-kathir',
      label: 'تفسير ابن كثير (مختصر)',
      labelEn: 'Ibn Kathir (Abridged)',
      by: 'الحافظ ابن كثير',
      byEn: 'Hafiz Ibn Kathir'
    }
  };
  const INDEX_SIZE = { juz: 30, hizb: 60, pages: 604 };

  const esc = (value) => String(value == null ? '' : value)
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const T = (ar, en) => (state.lang === 'en' ? en : ar);

  const showReader = (view) => {
    els.readerEmpty.hidden = view !== 'empty';
    els.readerLoading.hidden = view !== 'loading';
    els.readerError.hidden = view !== 'error';
    els.readerBody.hidden = view !== 'body';
  };

  function stripBismillah(text) {
    const normalized = normalizeAr(text).replace(/[\u0610-\u061A\u06D6-\u06ED]/g, '');
    if (normalized.startsWith('بسم الله الرحمن الرحيم')) {
      const words = text.trim().split(/\s+/);
      if (words.length > 4) return words.slice(4).join(' ');
    }
    return text;
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function surahInfo(n) {
    return DATA.surahs.find((s) => s.n === Number(n)) ||
      { n: Number(n), name: `سورة ${n}`, ayahs: 0, type: 'مكية' };
  }

  function apiSurahMeta(n, raw) {
    const local = surahInfo(n);
    return {
      n: Number(n),
      name: (raw && raw.name) || local.name,
      en: (raw && raw.englishName) || local.en || '',
      enT: (raw && raw.englishNameTranslation) || '',
      ayahs: (raw && raw.numberOfAyahs) || local.ayahs,
      type: local.type,
      typeEn: (raw && raw.revelationType) || (local.type === 'مدنية' ? 'Medinan' : 'Meccan')
    };
  }

  function mapAyah(ayah, enText) {
    return {
      n: ayah.numberInSurah,
      ar: String(ayah.text || '').replace(/^\uFEFF/, '').trim(),
      en: String(enText || '').trim(),
      juz: ayah.juz,
      page: ayah.page,
      hizb: ayah.hizbQuarter
    };
  }

  function renderSurahList(filter = '') {
    const query = normalizeAr(fromAr(filter));
    const raw = fromAr(filter.trim());
    const list = DATA.surahs.filter((s) => {
      if (!query) return true;
      return normalizeAr(s.name).includes(query) ||
        normalizeAr(s.en || '').includes(query) ||
        String(s.n) === raw ||
        normalizeAr(s.type).includes(query);
    });

    els.surahCount.textContent = T(`${list.length} سورة`, `${list.length} surahs`);

    if (!list.length) {
      els.surahList.innerHTML =
        `<p class="empty-state">${T('لا توجد سورة مطابقة لبحثك.', 'No surah matches your search.')}</p>`;
      return;
    }

    els.surahList.innerHTML = list.map((s) => `
      <button type="button" class="surah-item ${state.selectedSurah === s.n ? 'is-active' : ''}"
        data-surah="${s.n}" role="option" aria-selected="${state.selectedSurah === s.n}">
        <span class="surah-num">${s.n}</span>
        <span class="s-name">${esc(s.name)}${state.lang === 'en' && s.en ? ` <i class="s-en">${esc(s.en)}</i>` : ''}</span>
        <span class="s-meta">${s.ayahs} · ${state.lang === 'en' ? esc(s.type === 'مدنية' ? 'Medinan' : 'Meccan') : esc(s.type)}</span>
      </button>`).join('');
  }

  function renderIndex() {
    const tab = state.quranTab;
    const isSurahs = tab === 'surahs';

    const searchBox = els.surahSearch.closest('.search-box');
    if (searchBox) searchBox.hidden = !isSurahs;
    els.surahList.hidden = !isSurahs;
    els.indexGrid.hidden = isSurahs;

    if (isSurahs) {
      renderSurahList(els.surahSearch.value);
      return;
    }

    const max = INDEX_SIZE[tab] || 0;
    const labelAr = tab === 'juz' ? `${max} جزءًا` : tab === 'hizb' ? `${max} حزبًا` : `${max} صفحة`;
    const labelEn = tab === 'juz' ? `${max} juz` : tab === 'hizb' ? `${max} hizb` : `${max} pages`;
    els.surahCount.textContent = T(labelAr, labelEn);

    const frag = document.createDocumentFragment();
    for (let i = 1; i <= max; i += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'idx-cell';
      cell.dataset.jump = `${tab}:${i}`;
      cell.textContent = i;
      frag.append(cell);
    }
    els.indexGrid.replaceChildren(frag);
  }

  async function loadSurahIndex() {
    if (state.surahIndexLoaded) return;
    try {
      const json = await fetchJson(`${QURAN_API}/surah`);
      const list = (json && json.data) || [];
      list.forEach((item) => {
        const local = DATA.surahs.find((s) => s.n === item.number);
        if (local) {
          local.en = item.englishName || '';
          local.enT = item.englishNameTranslation || '';
        }
      });
      state.surahIndexLoaded = true;
      if (state.quranTab === 'surahs') renderSurahList(els.surahSearch.value);
    } catch (e) {
      /* تبقى القائمة بالأسماء العربية */
    }
  }

  function applyFontSize() {
    state.quranSize = clamp(state.quranSize, 24, 44);
    if (els.readerBody) els.readerBody.style.setProperty('--quran-size', `${state.quranSize}px`);
    storage.set('quranSize', state.quranSize);
  }

  function updatePageNav(p) {
    if (els.pageLabel) els.pageLabel.textContent = T(`الصفحة ${p} من 604`, `Page ${p} of 604`);
    if (els.pagePrev) els.pagePrev.disabled = p <= 1;
    if (els.pageNext) els.pageNext.disabled = p >= 604;
  }

  function renderQuranView(view, opts = {}) {
    state.quranView = view;
    const isSurah = view.mode === 'surah';
    const surah = view.surah || (view.groups[0] && view.groups[0].surah) || null;
    state.currentSurah = surah;

    showReader('body');

    if (isSurah && surah) {
      els.readerTitle.textContent = T(`سورة ${surahInfo(surah.n).name}`, `Surah ${surah.en || surah.n}`);
      els.readerType.textContent = T(surah.type, surah.typeEn);
    } else {
      els.readerTitle.textContent = T(`الصفحة ${view.page}`, `Page ${view.page}`);
      els.readerType.textContent = T('مصحف', 'Mushaf');
    }

    const total = view.groups.reduce((sum, g) => sum + g.ayahs.length, 0);
    const meta = [];
    if (isSurah) {
      meta.push(T(`${total} آية`, `${total} verses`));
    } else {
      meta.push(T(`${view.groups.length} سورة`, `${view.groups.length} surah${view.groups.length === 1 ? '' : 's'}`));
    }
    if (view.juz) meta.push(T(`الجزء ${view.juz}`, `Juz ${view.juz}`));
    if (view.page) meta.push(T(`الصفحة ${view.page}`, `Page ${view.page}`));
    if (view.hizb) meta.push(T(`الحزب ${Math.ceil(view.hizb / 4)}`, `Hizb ${Math.ceil(view.hizb / 4)}`));
    els.readerMeta.textContent = meta.join(' · ');

    if (els.readerBismillah) els.readerBismillah.hidden = true;

    const frag = document.createDocumentFragment();
    view.groups.forEach((group) => {
      const section = document.createElement('section');
      section.className = 'surah-block';

      if (!isSurah) {
        const divider = document.createElement('div');
        divider.className = 'surah-divider';
        const name = document.createElement('span');
        name.textContent = T(group.surah.name, group.surah.en || group.surah.name);
        const sub = document.createElement('small');
        sub.textContent = T(
          `${group.surah.type} · ${group.surah.ayahs} آية`,
          `${group.surah.typeEn} · ${group.surah.ayahs} verses`
        );
        divider.append(name, sub);
        section.append(divider);
      }

      if (group.bismillah) {
        const bism = document.createElement('p');
        bism.className = 'bismillah-line';
        bism.textContent = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
        section.append(bism);
      }

      const list = document.createElement('div');
      list.className = 'ayahs';
      group.ayahs.forEach((ayah) => list.append(buildAyah(group, ayah)));
      section.append(list);
      frag.append(section);
    });
    els.ayahs.replaceChildren(frag);

    const isPage = view.mode === 'page';
    if (els.audioBar) els.audioBar.hidden = isPage;
    if (els.pageNav) els.pageNav.hidden = !isPage;
    if (isPage) {
      updatePageNav(view.page);
    } else if (surah) {
      els.surahAudio.src = `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${surah.n}.mp3`;
    }

    applyFontSize();

    if (opts.scroll && window.innerWidth < 960) {
      els.readerBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function buildAyah(group, ayah) {
    const wrap = document.createElement('div');
    wrap.className = 'ayah-block';
    wrap.dataset.surah = group.surah.n;
    wrap.dataset.ayah = ayah.n;

    const line = document.createElement('p');
    line.className = 'ayah';
    line.tabIndex = 0;
    line.setAttribute('role', 'button');
    line.setAttribute('aria-expanded', 'false');
    line.title = T('اضغط لعرض التفسير', 'Click to show the tafsir');

    const text = document.createElement('span');
    text.className = 'ayah-text';
    text.textContent = ayah.ar;

    const num = document.createElement('span');
    num.className = 'ayah-num';
    num.textContent = ayah.n;

    line.append(text, document.createTextNode(' '), num);
    wrap.append(line);

    if (state.quranEnglish && ayah.en) {
      const en = document.createElement('p');
      en.className = 'ayah-en';
      en.dir = 'ltr';
      en.lang = 'en';
      en.textContent = ayah.en;
      wrap.append(en);
    }

    const open = () => toggleTafsir(wrap, group.surah.n, ayah.n);
    line.addEventListener('click', open);
    line.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });

    return wrap;
  }

  const tafsirCache = new Map();

  function fetchTafsir(surah, ayah, lang) {
    const key = `${surah}:${ayah}:${lang}`;
    if (tafsirCache.has(key)) return tafsirCache.get(key);

    const url = `${TAFSIR_BASE}/${TAFSIR_EDITIONS[lang].slug}/${surah}/${ayah}.json`;
    const job = fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => (json && json.text ? String(json.text).trim() : ''))
      .catch(() => '')
      .then((text) => {
        if (!text) tafsirCache.delete(key);
        return text;
      });

    tafsirCache.set(key, job);
    return job;
  }

  function tafsirSection(lang, text) {
    const edition = TAFSIR_EDITIONS[lang];
    const sec = document.createElement('section');
    sec.className = 'tafsir-sec';
    sec.dataset.lang = lang;
    sec.dir = lang === 'en' ? 'ltr' : 'rtl';
    sec.lang = lang;

    const head = document.createElement('div');
    head.className = 'tafsir-src';
    const name = document.createElement('b');
    name.textContent = T(edition.label, edition.labelEn);
    const by = document.createElement('span');
    by.textContent = T(edition.by, edition.byEn);
    head.append(name, by);

    const body = document.createElement('div');
    body.className = 'tafsir-text';
    body.textContent = text;

    sec.append(head, body);
    return sec;
  }

  function tafsirShell() {
    const panel = document.createElement('div');
    panel.className = 'tafsir';
    panel.hidden = true;

    const head = document.createElement('div');
    head.className = 'tafsir-head';

    const title = document.createElement('strong');
    title.className = 'tafsir-title';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tafsir-close';
    close.textContent = '×';
    close.setAttribute('aria-label', T('إغلاق التفسير', 'Close tafsir'));

    head.append(title, close);

    const body = document.createElement('div');
    body.className = 'tafsir-body';

    panel.append(head, body);

    close.addEventListener('click', (event) => {
      event.stopPropagation();
      panel.hidden = true;
      const line = panel.parentElement && panel.parentElement.querySelector('.ayah');
      if (line) line.setAttribute('aria-expanded', 'false');
    });

    return panel;
  }

  function tafsirLoading() {
    const row = document.createElement('div');
    row.className = 'tafsir-loading';
    const spin = document.createElement('span');
    spin.className = 'spinner sm';
    const text = document.createElement('p');
    text.textContent = T('جارٍ تحميل التفسير…', 'Loading tafsir…');
    row.append(spin, text);
    return row;
  }

  function tafsirError(retry) {
    const row = document.createElement('div');
    row.className = 'tafsir-error';
    const text = document.createElement('p');
    text.textContent = T('تعذّر تحميل التفسير. تحقّق من اتصالك بالإنترنت.', 'Could not load the tafsir. Check your connection.');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-sm';
    btn.textContent = T('إعادة المحاولة', 'Retry');
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      retry();
    });
    row.append(text, btn);
    return row;
  }

  async function toggleTafsir(wrap, surah, ayah) {
    let panel = wrap.querySelector('.tafsir');
    if (!panel) {
      panel = tafsirShell();
      wrap.append(panel);
    }

    const line = wrap.querySelector('.ayah');

    if (!panel.hidden) {
      panel.hidden = true;
      if (line) line.setAttribute('aria-expanded', 'false');
      return;
    }

    panel.hidden = false;
    if (line) line.setAttribute('aria-expanded', 'true');

    const lang = state.lang === 'en' ? 'en' : 'ar';
    const info = surahInfo(surah);
    const enName = (() => {
      const view = state.quranView;
      if (view) {
        const group = view.groups.find((g) => g.surah.n === Number(surah));
        if (group && group.surah.en) return group.surah.en;
      }
      return info.en || info.name;
    })();

    panel.querySelector('.tafsir-title').textContent = lang === 'en'
      ? `Tafsir of verse ${ayah} — ${enName}`
      : `تفسير الآية ${ayah} — سورة ${info.name}`;

    if (panel.dataset.loaded === '1') return;

    const body = panel.querySelector('.tafsir-body');
    body.replaceChildren(tafsirLoading());

    let text = '';
    try {
      text = await fetchTafsir(surah, ayah, lang);
    } catch (e) {
      text = '';
    }

    if (!text) {
      body.replaceChildren(tafsirError(() => {
        panel.hidden = true;
        toggleTafsir(wrap, surah, ayah);
      }));
      return;
    }

    body.replaceChildren(tafsirSection(lang, text));
    panel.dataset.loaded = '1';
  }

  async function fetchSurahView(n) {
    const json = await fetchJson(`${QURAN_API}/surah/${n}/editions/quran-uthmani,en.sahih`);
    const data = json && json.data;
    if (!Array.isArray(data) || !data.length) throw new Error('بيانات غير صالحة');

    const arEd = data[0];
    const enEd = data.find((d) => d && d.edition && d.edition.identifier === 'en.sahih') || data[1] || {};
    const enList = Array.isArray(enEd.ayahs) ? enEd.ayahs : [];

    const ayahs = (arEd.ayahs || []).map((a, i) => mapAyah(a, (enList[i] || {}).text));
    if (!ayahs.length) throw new Error('لا توجد آيات');

    if (n !== 1 && n !== 9) ayahs[0].ar = stripBismillah(ayahs[0].ar);

    const meta = apiSurahMeta(n, arEd);
    return {
      mode: 'surah',
      surah: meta,
      groups: [{ surah: meta, ayahs, bismillah: n !== 1 && n !== 9 }],
      juz: ayahs[0].juz,
      page: ayahs[0].page,
      hizb: ayahs[0].hizb
    };
  }

  async function fetchPageView(p) {
    const [arJson, enJson] = await Promise.all([
      fetchJson(`${QURAN_API}/page/${p}/quran-uthmani`),
      fetchJson(`${QURAN_API}/page/${p}/en.sahih`)
    ]);

    const arAyahs = arJson && arJson.data && arJson.data.ayahs;
    if (!Array.isArray(arAyahs) || !arAyahs.length) throw new Error('لا توجد آيات');

    const enList = (enJson && enJson.data && enJson.data.ayahs) || [];
    const enMap = new Map(enList.map((a) => [a.number, a.text]));

    const groups = [];
    let current = null;

    for (const raw of arAyahs) {
      const info = raw.surah || {};
      if (!current || current.surah.n !== info.number) {
        current = {
          surah: apiSurahMeta(info.number, info),
          ayahs: [],
          bismillah: info.number !== 1 && info.number !== 9
        };
        groups.push(current);
      }

      const ayah = mapAyah(raw, enMap.get(raw.number));
      if (!current.ayahs.length && current.bismillah) ayah.ar = stripBismillah(ayah.ar);
      current.ayahs.push(ayah);
    }

    return {
      mode: 'page',
      page: Number(p),
      groups,
      juz: arAyahs[0].juz,
      hizb: arAyahs[0].hizbQuarter,
      surah: groups.length === 1 ? groups[0].surah : null
    };
  }

  async function selectSurah(n, opts = {}) {
    n = Number(n);
    if (!n || n < 1 || n > 114) return;

    const listScroll = els.surahList.scrollTop;
    state.selectedSurah = n;
    state.quranPage = null;
    renderSurahList(els.surahSearch.value);
    els.surahList.scrollTop = listScroll;
    if (!opts.silentUrl) syncUrl({ surah: n, page: null });
    updateSurahSelection();

    if (!opts.force && state.surahCache.has(n)) {
      renderQuranView(state.surahCache.get(n), { scroll: opts.scroll });
      return;
    }

    const token = ++state.quranRequest;
    showReader('loading');

    try {
      const view = await fetchSurahView(n);
      state.surahCache.set(n, view);
      if (token !== state.quranRequest) return;
      renderQuranView(view, { scroll: opts.scroll });
    } catch (err) {
      if (token !== state.quranRequest) return;
      if (DATA.fallbackQuran[n]) {
        const meta = apiSurahMeta(n, null);
        const ayahs = DATA.fallbackQuran[n].map((text, i) => ({ n: i + 1, ar: text, en: '' }));
        renderQuranView({
          mode: 'surah',
          surah: meta,
          groups: [{ surah: meta, ayahs, bismillah: false }],
          juz: 0,
          page: 0,
          hizb: 0
        }, { scroll: opts.scroll });
        toast(T('تعذّر الاتصال — عُرضت نسخة محفوظة من السورة', 'Offline — showing a saved copy of the surah'));
      } else {
        showReader('error');
        els.surahAudio.removeAttribute('src');
      }
    }
  }

  async function openPage(p, opts = {}) {
    p = Number(p);
    if (!p || p < 1 || p > 604) return;

    state.quranPage = p;
    state.selectedSurah = null;
    updateSurahSelection();
    syncUrl({ page: p, surah: null });

    if (!opts.force && state.pageCache.has(p)) {
      renderQuranView(state.pageCache.get(p), { scroll: opts.scroll });
      return;
    }

    const token = ++state.quranRequest;
    showReader('loading');

    try {
      const view = await fetchPageView(p);
      state.pageCache.set(p, view);
      if (token !== state.quranRequest) return;
      renderQuranView(view, { scroll: opts.scroll });
    } catch (err) {
      if (token !== state.quranRequest) return;
      showReader('error');
      els.surahAudio.removeAttribute('src');
    }
  }

  async function jumpTo(kind, n) {
    if (kind === 'pages') {
      openPage(n, { scroll: true });
      return;
    }

    const ref = kind === 'juz' ? 'juz' : 'hizbQuarter';
    const label = kind === 'juz' ? T(`الجزء ${n}`, `Juz ${n}`) : T(`الحزب ${n}`, `Hizb ${n}`);
    toast(T(`جارٍ الانتقال إلى ${label}…`, `Jumping to ${label}…`));

    try {
      const json = await fetchJson(`${QURAN_API}/${ref}/${n}/quran-uthmani?offset=0&limit=1`);
      const first = json && json.data && json.data.ayahs && json.data.ayahs[0];
      if (!first) throw new Error('لا يوجد موضع');
      openPage(first.page, { scroll: true });
    } catch (e) {
      toast(T('تعذّر الانتقال — تحقّق من اتصالك', 'Could not jump — check your connection'));
    }
  }

  function loadInitialQuran() {
    const params = new URLSearchParams(location.search);
    const page = Number(params.get('page'));
    if (page) return openPage(page);
    const surah = Number(params.get('surah'));
    return selectSurah(surah || 1, { silentUrl: !surah });
  }

  function updateSurahSelection() {
    $$('.surah-item', els.surahList).forEach((item) => {
      const active = Number(item.dataset.surah) === state.selectedSurah;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
    });
  }

  function initOfflineChips() {
    els.offlineSurahs.innerHTML = Object.keys(DATA.fallbackQuran)
      .sort((a, b) => Number(a) - Number(b))
      .map((n) => {
        const s = DATA.surahs.find((x) => x.n === Number(n));
        return `<button type="button" class="chip" data-offline="${n}">${s ? s.name : n}</button>`;
      }).join('');
  }

  /* ---------- الأذكار ---------- */
  function loadAzkarProgress() {
    const saved = storage.get('azkarDone', null);
    if (saved && saved.day === todayKey() && saved.data && typeof saved.data === 'object') {
      state.azkarDone = saved;
    } else {
      state.azkarDone = { day: todayKey(), data: {} };
    }
  }

  function currentCategory() {
    return DATA.azkar.find((c) => c.id === state.azkarCat) || DATA.azkar[0];
  }

  function azkarKey(catId, index) {
    return `${catId}:${index}`;
  }

  function zikrCount(catId, index) {
    const value = state.azkarDone.data[azkarKey(catId, index)];
    return Number.isFinite(value) ? value : 0;
  }

  function renderAzkarCats() {
    els.azkarCats.innerHTML = DATA.azkar.map((cat) => `
      <button type="button" class="chip ${cat.id === state.azkarCat ? 'is-active' : ''}"
        data-cat="${cat.id}" role="tab" aria-selected="${cat.id === state.azkarCat}">${cat.title}</button>`).join('');
  }

  function renderAzkarList() {
    const cat = currentCategory();
    els.azkarCats.querySelectorAll('.chip').forEach((chip) => {
      const active = chip.dataset.cat === cat.id;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-selected', String(active));
    });

    els.azkarList.innerHTML = cat.items.map((item, i) => {
      const done = zikrCount(cat.id, i);
      const finished = done >= item.count;
      return `
        <article class="azkar-card ${finished ? 'is-done' : ''}" data-z="${i}">
          <p class="z-text">${item.text}</p>
          <div class="z-foot">
            <span class="z-note">${item.note || ''}</span>
            <button type="button" class="z-count" data-inc="${i}"
              aria-label="${finished ? 'تم إتمام الذكر' : `عدّ الذكر ${toAr(done)} من ${toAr(item.count)}`}"
              ${finished ? 'disabled' : ''}>
              ${finished
                ? '<svg class="icon"><use href="#i-check"></use></svg> تم'
                : `${toAr(done)} / ${toAr(item.count)} <span aria-hidden="true">+</span>`}
            </button>
          </div>
        </article>`;
    }).join('');

    updateAzkarProgress();
  }

  function updateAzkarProgress() {
    const cat = currentCategory();
    let total = 0;
    let done = 0;
    cat.items.forEach((item, i) => {
      total += item.count;
      done += Math.min(zikrCount(cat.id, i), item.count);
    });
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    if (els.azkarProgressBar) els.azkarProgressBar.style.width = `${pct}%`;
    if (els.azkarProgress) els.azkarProgress.setAttribute('aria-valuenow', String(pct));
    if (els.azkarProgressText) {
      els.azkarProgressText.textContent = pct === 100
        ? 'أتممت أذكار هذا القسم — تقبّل الله منك'
        : `${toAr(done)} من ${toAr(total)} · ${toAr(pct)}٪`;
    }
  }

  function incrementZikr(index) {
    const cat = currentCategory();
    const item = cat.items[index];
    if (!item) return;
    const key = azkarKey(cat.id, index);
    const current = zikrCount(cat.id, index);
    if (current >= item.count) return;

    state.azkarDone.data[key] = current + 1;
    storage.set('azkarDone', state.azkarDone);

    const card = els.azkarList.querySelector(`[data-z="${index}"]`);
    if (card) {
      const button = card.querySelector('[data-inc]');
      const finished = current + 1 >= item.count;
      card.classList.toggle('is-done', finished);
      if (button) {
        if (finished) {
          button.disabled = true;
          button.innerHTML = '<svg class="icon"><use href="#i-check"></use></svg> تم';
          button.setAttribute('aria-label', 'تم إتمام الذكر');
          vibrate(25);
          toast('أتممت الذكر — تقبّل الله منك');
        } else {
          button.innerHTML = `${toAr(current + 1)} / ${toAr(item.count)} <span aria-hidden="true">+</span>`;
          button.setAttribute('aria-label', `عدّ الذكر ${toAr(current + 1)} من ${toAr(item.count)}`);
          vibrate(8);
        }
      }
    }
    updateAzkarProgress();
  }

  function resetAzkar() {
    state.azkarDone = { day: todayKey(), data: {} };
    storage.set('azkarDone', state.azkarDone);
    renderAzkarList();
    toast('أُعيد ضبط أذكار اليوم');
  }

  /* ---------- المسبحة ---------- */
  function renderDhikrChips() {
    els.dhikrChips.innerHTML = DATA.dhikr.map((d, i) => `
      <button type="button" class="chip ${i === state.dhikrIndex ? 'is-active' : ''}" data-dhikr="${i}">${d.text}</button>`).join('');
  }

  function selectDhikr(index) {
    const item = DATA.dhikr[index];
    if (!item) return;
    state.dhikrIndex = index;
    state.tasbihCount = 0;
    state.tasbihTarget = item.target;
    renderDhikrChips();
    updateTasbihUI();
  }

  function updateTasbihUI(pulse = false) {
    const target = state.tasbihTarget;
    const count = state.tasbihCount;
    if (els.tasbihCount) els.tasbihCount.textContent = String(count);
    if (els.tasbihTargetLabel) els.tasbihTargetLabel.textContent = `من ${target}`;
    if (els.targetValue) els.targetValue.textContent = String(target);
    if (els.tasbihToday) els.tasbihToday.textContent = String(state.totals.today);
    if (els.tasbihTotal) els.tasbihTotal.textContent = String(state.totals.total);

    const circumference = 2 * Math.PI * 122;
    const ratio = target > 0 ? clamp(count / target, 0, 1) : 0;
    if (els.ringProgress) {
      els.ringProgress.style.strokeDasharray = String(circumference);
      els.ringProgress.style.strokeDashoffset = String(circumference * (1 - ratio));
    }

    if (pulse && els.tasbihBtn) {
      els.tasbihBtn.classList.remove('pulse');
      void els.tasbihBtn.offsetWidth;
      els.tasbihBtn.classList.add('pulse');
      setTimeout(() => els.tasbihBtn.classList.remove('pulse'), 360);
    }
  }

  function initTasbih() {
    state.totals = storage.get('tasbihTotals', { day: todayKey(), today: 0, total: 0 });
    if (!state.totals || state.totals.day !== todayKey()) {
      state.totals = { day: todayKey(), today: 0, total: Number(state.totals && state.totals.total) || 0 };
    }
    state.tasbihTarget = DATA.dhikr[0].target;
    renderDhikrChips();
    updateTasbihUI();
  }

  function addTasbih() {
    state.tasbihCount += 1;
    state.totals.today += 1;
    state.totals.total += 1;
    storage.set('tasbihTotals', state.totals);
    updateTasbihUI(true);
    vibrate(10);
    if (state.tasbihCount === state.tasbihTarget) {
      toast('بلغت الهدف — تقبّل الله منك');
      vibrate(40);
    }
  }

  function resetTasbih() {
    state.tasbihCount = 0;
    updateTasbihUI();
    toast('تم تصفير العدّاد');
  }

  function cycleTasbihTarget() {
    const targets = [33, 99, 100, 1000];
    const index = targets.indexOf(state.tasbihTarget);
    state.tasbihTarget = targets[(index + 1) % targets.length];
    state.tasbihCount = 0;
    updateTasbihUI();
    toast(`الهدف الآن ${state.tasbihTarget} تسبيحة`);
  }

  /* ---------- الأسماء الحسنى ---------- */
  function renderNames(filter = '') {
    const query = normalizeAr(fromAr(filter));
    const list = DATA.names.filter((item) => {
      if (!query) return true;
      return normalizeAr(item.name).includes(query) || normalizeAr(item.meaning).includes(query);
    });

    const todayName = (dayOfYear() % DATA.names.length) + 1;
    els.namesGrid.innerHTML = list.map((item) => `
      <button type="button" class="name-card ${item.n === todayName ? 'is-today' : ''}" data-name-index="${item.n - 1}">
        <span class="n-num">${toAr(item.n)}</span>
        <span class="n-name">${item.name}</span>
        <span class="n-meaning">${item.meaning}</span>
      </button>`).join('');

    els.namesCount.textContent = query ? `${toAr(list.length)} نتيجة` : '99 اسمًا';
    els.namesEmpty.hidden = list.length > 0;
  }

  function copyName(index) {
    const item = DATA.names[index];
    if (!item) return;
    copyText(`${item.name} — ${item.meaning}`);
  }

  /* ---------- القبلة ---------- */
  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  function declinationAt(lat, lng) {
    try {
      if (typeof WMM === 'undefined') return 0;
      const value = WMM.declination(lat, lng, new Date());
      return Number.isFinite(value) ? value : 0;
    } catch (e) {
      return 0;
    }
  }

  function signedDelta(target, heading) {
    return ((((target - heading) % 360) + 540) % 360) - 180;
  }

  function renderQibla() {
    const loc = activeLocation();
    if (!loc) return;
    const bearing = Prayer.qiblaBearing(loc.lat, loc.lng);
    state.qiblaBearing = bearing;
    state.declination = declinationAt(loc.lat, loc.lng);

    els.qiblaDeg.textContent = bearing.toFixed(1);
    els.qiblaCity.textContent = locationLabel();
    els.qiblaDist.textContent = `${Prayer.distanceToKaaba(loc.lat, loc.lng)} كم`;
    els.qiblaLat.textContent = `${loc.lat.toFixed(2)}°`;
    els.qiblaLng.textContent = `${loc.lng.toFixed(2)}°`;

    if (els.qiblaDecl) {
      const d = state.declination;
      els.qiblaDecl.textContent = `${d >= 0 ? '+' : ''}${d.toFixed(1)}°`;
    }
    if (els.qiblaGps) {
      els.qiblaGps.textContent = Number.isFinite(state.gpsAccuracy) ? `±${state.gpsAccuracy} م` : '—';
    }

    applyNeedle();
    if (state.heading != null) updateCompassUI();
  }

  function applyNeedle() {
    if (!els.compassNeedle || !els.compassSvg) return;
    els.compassNeedle.style.transform = `rotate(${state.qiblaBearing}deg)`;
    els.compassSvg.style.transform = state.heading == null ? 'rotate(0deg)' : `rotate(${-state.heading}deg)`;

    if (!els.compassHint) return;
    if (state.heading == null) {
      els.compassHint.textContent = 'وجّه أعلى الشاشة نحو الشمال، ثم اتبع السهم الذهبي.';
      els.compassHint.classList.remove('is-aligned');
      return;
    }

    const delta = signedDelta(state.qiblaBearing, state.heading);
    const abs = Math.abs(delta);
    if (abs <= 3) {
      els.compassHint.textContent = 'أنت تواجه القبلة الآن ✓';
      els.compassHint.classList.add('is-aligned');
    } else {
      els.compassHint.textContent = `أدر ${delta > 0 ? 'يمينًا' : 'يسارًا'} ${Math.round(abs)}° حتى ينطبق السهم على القبلة`;
      els.compassHint.classList.remove('is-aligned');
    }
  }

  /**
   * اتجاه الهاتف الحقيقي (بعد تصحيح الانحراف المغناطيسي لاحقًا).
   * يعتمد على webkitCompassHeading في iOS، وعلى مصفوفة الدوران في أندرويد.
   */
  function readHeading(event) {
    if (Number.isFinite(event.webkitCompassHeading)) {
      return {
        heading: event.webkitCompassHeading,
        accuracy: Number.isFinite(event.webkitCompassAccuracy) ? event.webkitCompassAccuracy : null
      };
    }

    const absolute = event.absolute === true || event.type === 'deviceorientationabsolute';
    if (!absolute || !Number.isFinite(event.alpha)) return null;

    const a = event.alpha * DEG2RAD;
    const b = (event.beta || 0) * DEG2RAD;
    const g = (event.gamma || 0) * DEG2RAD;

    const ca = Math.cos(a); const sa = Math.sin(a);
    const cb = Math.cos(b); const sb = Math.sin(b);
    const cg = Math.cos(g); const sg = Math.sin(g);

    // اتجاه الكاميرا (محور الجهاز -Z) في الإطار الأرضي
    let x = -(ca * sg + sa * sb * cg);
    let y = -sa * sg + ca * sb * cg;

    // إن كان الهاتف شبه أفقي فمحور الكاميرا يشير للأسفل: نستخدم الحافة العلوية
    if (Math.abs(sb) < 0.35) {
      x = -sa * cb;
      y = ca * cb;
    }

    if (Math.hypot(x, y) < 0.05) return null;

    let heading = Math.atan2(x, y) * RAD2DEG;
    if (heading < 0) heading += 360;
    return { heading, accuracy: null };
  }

  function smoothHeading(next) {
    if (state.heading == null) {
      state.heading = next;
      return;
    }
    const delta = signedDelta(next, state.heading);
    if (Math.abs(delta) > 45) {
      state.heading = next;
      return;
    }
    state.heading = (state.heading + delta * 0.3 + 360) % 360;
  }  function qualityLabel() {
    if (Number.isFinite(state.compassAccuracy)) {
      if (state.compassAccuracy <= 10) return 'ممتازة';
      if (state.compassAccuracy <= 25) return 'جيدة';
      return 'ضعيفة — حرّك الهاتف 8';
    }
    if (state.compassJitter == null) return '—';
    if (state.compassJitter < 4) return 'ممتازة';
    if (state.compassJitter < 10) return 'جيدة';
    return 'ضعيفة — حرّك الهاتف 8';
  }

  function updateCompassUI() {
    if (state.heading == null) return;
    applyNeedle();

    const delta = signedDelta(state.qiblaBearing, state.heading);
    if (els.qiblaLive) els.qiblaLive.hidden = false;
    if (els.liveHeading) els.liveHeading.textContent = `${Math.round(state.heading) % 360}°`;
    if (els.liveDelta) {
      const abs = Math.round(Math.abs(delta));
      els.liveDelta.textContent = `${abs}°`;
      els.liveDelta.classList.toggle('is-good', abs <= 3);
    }
    if (els.liveAccuracy) els.liveAccuracy.textContent = qualityLabel();

    if (state.ar.open) updateAR(delta);
  }

  function onOrientation(event) {
    const sample = readHeading(event);
    if (!sample) return;

    if (sample.accuracy != null) state.compassAccuracy = sample.accuracy;

    const trueHeading = (sample.heading + state.declination + 360) % 360;

    if (state.heading != null) {
      const jitter = Math.abs(signedDelta(trueHeading, state.heading));
      state.compassJitter = state.compassJitter == null
        ? jitter
        : state.compassJitter * 0.85 + jitter * 0.15;
    }

    smoothHeading(trueHeading);

    if (state.page === 'qibla' || state.ar.open) updateCompassUI();
  }

  async function startCompass() {
    if (state.compassBound) return true;

    try {
      if (typeof DeviceOrientationEvent === 'undefined') {
        toast('جهازك لا يدعم البوصلة');
        return false;
      }
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          toast('لم يُسمح باستخدام البوصلة');
          return false;
        }
      }
      window.addEventListener('deviceorientationabsolute', onOrientation, true);
      window.addEventListener('deviceorientation', onOrientation, true);
      state.compassBound = true;

      toast('تم تشغيل البوصلة — حرّك الهاتف على شكل 8 لتحسين الدقة');
      setTimeout(() => {
        if (state.heading == null) {
          toast('لم تصل إشارة بوصلة — تحقّق من صلاحية الحركة والاتجاه');
        }
      }, 4000);
      return true;
    } catch (e) {
      toast('تعذّر تشغيل البوصلة على هذا الجهاز');
      return false;
    }
  }

  /* ---------- وضع الكاميرا (AR) ---------- */
  function setARStatus(text) {
    if (els.arStatus) els.arStatus.textContent = text;
  }

  function updateAR(delta) {
    if (!els.arArrow) return;
    els.arArrow.style.transform = `rotate(${delta}deg)`;
    const aligned = Math.abs(delta) <= 3;
    els.arArrow.classList.toggle('is-aligned', aligned);
    if (els.arDelta) els.arDelta.textContent = `${Math.round(Math.abs(delta))}°`;
    setARStatus(aligned
      ? 'أنت تواجه القبلة — صلِّ في هذا الاتجاه'
      : `أدر ${delta > 0 ? 'يمينًا' : 'يسارًا'} ${Math.round(Math.abs(delta))}°`);
  }

  async function openAR() {
    if (!els.arOverlay || state.ar.open) return;
    state.ar.open = true;
    els.arOverlay.hidden = false;
    document.body.classList.add('ar-open');

    if (state.heading != null) updateCompassUI();
    else setARStatus('حرّك الهاتف ببطء حتى تصل إشارة البوصلة…');

    await startCompass();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('camera-unsupported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      state.ar.stream = stream;
      els.arVideo.srcObject = stream;
      const playing = els.arVideo.play();
      if (playing && typeof playing.catch === 'function') playing.catch(() => {});
    } catch (err) {
      setARStatus('تعذّر تشغيل الكاميرا — اسمح بالوصول إلى الكاميرا من إعدادات المتصفح.');
    }
  }

  function closeAR() {
    if (!state.ar.open) return;
    state.ar.open = false;
    if (els.arOverlay) els.arOverlay.hidden = true;
    document.body.classList.remove('ar-open');
    if (state.ar.stream) {
      state.ar.stream.getTracks().forEach((track) => track.stop());
      state.ar.stream = null;
    }
    if (els.arVideo) els.arVideo.srcObject = null;
    if (els.arFreeze) els.arFreeze.textContent = 'تثبيت الصورة';
  }

  function toggleFreezeAR() {
    if (!els.arVideo || !state.ar.open) return;
    if (els.arVideo.paused) {
      els.arVideo.play().catch(() => {});
      if (els.arFreeze) els.arFreeze.textContent = 'تثبيت الصورة';
    } else {
      els.arVideo.pause();
      if (els.arFreeze) els.arFreeze.textContent = 'استئناف الكاميرا';
    }
  }

  /* ---------- ربط الأحداث ---------- */
  function bindEvents() {
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const goto = event.target.closest('[data-goto]');
      if (goto) {
        event.preventDefault();
        go(goto.dataset.goto);
        return;
      }
      const nav = event.target.closest('.nav-link[data-page]');
      if (nav) {
        event.preventDefault();
        go(nav.dataset.page);
      }
    });

    els.themeToggle.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    window.addEventListener('popstate', () => {
      const page = pageFromPath() || 'home';
      if (page !== state.page) go(page, { skipUrl: true });
    });

    els.citySelect.addEventListener('change', () => {
      const city = DATA.cities.find((c) => c.name === els.citySelect.value);
      if (!city) return;
      state.city = city;
      state.customLoc = null;
      storage.set('cityName', city.name);
      state.methodId = suggestMethod(city.country);
      storage.set('methodId', state.methodId);
      els.methodSelect.value = state.methodId;
      renderPrayer();
      renderQibla();
      toast(`تم اختيار ${city.name}`);
    });

    els.methodSelect.addEventListener('change', () => {
      state.methodId = els.methodSelect.value;
      storage.set('methodId', state.methodId);
      renderPrayer();
    });

    els.geoBtn.addEventListener('click', locate);
    els.qiblaGeo.addEventListener('click', locate);
    els.qiblaCompass.addEventListener('click', startCompass);
    els.qiblaAR.addEventListener('click', openAR);
    els.arClose.addEventListener('click', closeAR);
    els.arFreeze.addEventListener('click', toggleFreezeAR);

    /* القرآن */
    els.surahSearch.addEventListener('input', () => renderSurahList(els.surahSearch.value));
    els.idxTabs.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-tab]');
      if (!tab) return;
      state.quranTab = tab.dataset.tab;
      $$('.idx-tab', els.idxTabs).forEach((btn) => {
        const active = btn.dataset.tab === state.quranTab;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', String(active));
      });
      renderIndex();
    });
    els.surahList.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-surah]');
      if (btn) selectSurah(Number(btn.dataset.surah), { scroll: true });
    });
    els.indexGrid.addEventListener('click', (event) => {
      const cell = event.target.closest('[data-jump]');
      if (!cell) return;
      const [kind, num] = cell.dataset.jump.split(':');
      jumpTo(kind, Number(num));
    });
    els.offlineSurahs.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-offline]');
      if (btn) selectSurah(Number(btn.dataset.offline), { scroll: true });
    });
    els.retrySurah.addEventListener('click', () => {
      if (state.quranPage) openPage(state.quranPage, { force: true });
      else if (state.selectedSurah) selectSurah(state.selectedSurah, { force: true });
    });
    els.fontPlus.addEventListener('click', () => {
      state.quranSize += 2;
      applyFontSize();
    });
    els.fontMinus.addEventListener('click', () => {
      state.quranSize -= 2;
      applyFontSize();
    });
    els.enToggle.addEventListener('click', () => {
      state.quranEnglish = !state.quranEnglish;
      storage.set('quranEnglish', state.quranEnglish);
      updateEnToggle();
      if (state.quranView) renderQuranView(state.quranView);
    });
    els.pagePrev.addEventListener('click', () => {
      if (state.quranPage > 1) openPage(state.quranPage - 1, { scroll: true });
    });
    els.pageNext.addEventListener('click', () => {
      if (state.quranPage < 604) openPage(state.quranPage + 1, { scroll: true });
    });
    els.langToggle.addEventListener('click', () => {
      applyLang(state.lang === 'en' ? 'ar' : 'en');
      toast(state.lang === 'en' ? 'English mode — Quran page' : 'الوضع العربي');
    });
    els.readerCopy.addEventListener('click', () => {
      const view = state.quranView;
      if (!view) return;
      const lines = [];
      view.groups.forEach((group) => {
        if (view.mode === 'page' || view.groups.length > 1) lines.push(`سورة ${group.surah.name}`);
        group.ayahs.forEach((ayah) => {
          lines.push(`${ayah.ar} ﴿${ayah.n}﴾`);
          if (state.quranEnglish && ayah.en) lines.push(ayah.en);
        });
        lines.push('');
      });
      copyText(lines.join('\n').trim());
    });
    els.surahAudio.addEventListener('error', () => {
      if (els.surahAudio.getAttribute('src')) toast('تعذّر تحميل التلاوة — تحقّق من الاتصال');
    });

    /* الأذكار */
    els.azkarCats.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-cat]');
      if (!chip) return;
      state.azkarCat = chip.dataset.cat;
      renderAzkarCats();
      renderAzkarList();
    });
    els.azkarList.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-inc]');
      if (!btn) return;
      incrementZikr(Number(btn.dataset.inc));
    });
    els.azkarReset.addEventListener('click', resetAzkar);

    /* المسبحة */
    els.dhikrChips.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-dhikr]');
      if (chip) selectDhikr(Number(chip.dataset.dhikr));
    });
    els.tasbihBtn.addEventListener('click', addTasbih);
    els.tasbihReset.addEventListener('click', resetTasbih);
    els.tasbihTarget.addEventListener('click', cycleTasbihTarget);

    document.addEventListener('keydown', (event) => {
      if (event.code !== 'Space' || state.page !== 'tasbih') return;
      const tag = (event.target.tagName || '').toLowerCase();
      if (['input', 'select', 'textarea', 'button', 'a'].includes(tag)) return;
      event.preventDefault();
      addTasbih();
    });

    /* الأسماء */
    els.namesSearch.addEventListener('input', () => renderNames(els.namesSearch.value));
    els.namesGrid.addEventListener('click', (event) => {
      const card = event.target.closest('[data-name-index]');
      if (card) copyName(Number(card.dataset.nameIndex));
    });

    /* نسخ الآية / الحديث */
    $$('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.querySelector(btn.dataset.copy);
        if (target) copyText(target.textContent.trim());
      });
    });
  }

  /* ---------- بدء التشغيل ---------- */
  function initialRoute() {
    const hash = location.hash.replace('#', '');
    if (hash && ROUTE_PAGES[hash]) return { page: hash, legacy: true };
    const fromPath = pageFromPath();
    if (fromPath) return { page: fromPath, legacy: false };
    return { page: 'home', legacy: location.pathname !== '/' };
  }

  function init() {
    cacheEls();
    applyTheme(state.theme);

    const params = new URLSearchParams(location.search);
    const pageParam = Number(params.get('page'));
    const surahParam = Number(params.get('surah'));
    if (pageParam) state.urlPage = pageParam;
    else if (surahParam) state.urlSurah = surahParam;

    let initialLang = params.get('lang');
    if (initialLang !== 'en' && initialLang !== 'ar') initialLang = storage.get('lang', 'ar');
    applyLang(initialLang === 'en' ? 'en' : 'ar', { silent: true });

    initSelects();
    renderDates();
    renderDaily();
    renderPrayer();
    renderQibla();
    renderIndex();
    initOfflineChips();
    loadSurahIndex();
    loadAzkarProgress();
    renderAzkarCats();
    renderAzkarList();
    renderNames();
    initTasbih();
    bindEvents();
    updateEnToggle();

    const start = initialRoute();
    state.page = start.page;
    go(start.page, { replace: true, instant: true });

    if (els.footerYear) els.footerYear.textContent = new Date().getFullYear();

    setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
