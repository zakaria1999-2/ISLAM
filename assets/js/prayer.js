/* ============================================================
   محرك حساب مواقيت الصلاة فلكيًا + القبلة + التاريخ الهجري
   يعمل بالكامل على جهاز المستخدم دون أي اتصال
   ============================================================ */
'use strict';

const Prayer = (() => {
  const DEG = Math.PI / 180;
  const sin = (d) => Math.sin(d * DEG);
  const cos = (d) => Math.cos(d * DEG);
  const tan = (d) => Math.tan(d * DEG);
  const asin = (x) => Math.asin(x) / DEG;
  const acos = (x) => Math.acos(x) / DEG;
  const atan2 = (y, x) => Math.atan2(y, x) / DEG;
  const fixAngle = (a) => ((a % 360) + 360) % 360;
  const fixHour = (h) => ((h % 24) + 24) % 24;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const KAABA = { lat: 21.4225, lng: 39.8262 };
  const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const NEXT_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

  const LABELS = {
    fajr: 'الفجر',
    sunrise: 'الشروق',
    dhuhr: 'الظهر',
    asr: 'العصر',
    maghrib: 'المغرب',
    isha: 'العشاء'
  };

  /* ---------- دوال الوقت ---------- */
  const formatters = new Map();
  function partsFormatter(tz) {
    if (!formatters.has(tz)) {
      formatters.set(tz, new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }));
    }
    return formatters.get(tz);
  }

  function zonedParts(date, tz) {
    const parts = partsFormatter(tz).formatToParts(date);
    const o = {};
    for (const p of parts) o[p.type] = p.value;
    return {
      year: Number(o.year),
      month: Number(o.month),
      day: Number(o.day),
      hour: Number(o.hour) % 24,
      minute: Number(o.minute),
      second: Number(o.second)
    };
  }

  function tzOffsetHours(date, tz) {
    const p = zonedParts(date, tz);
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return (asUTC - date.getTime()) / 3600000;
  }

  /* ---------- الحساب الفلكي ---------- */
  function julianDay(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  function sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = fixAngle(357.529 + 0.98560028 * D);
    const q = fixAngle(280.459 + 0.98564736 * D);
    const L = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
    const e = 23.439 - 0.00000036 * D;
    const RA = fixHour(atan2(cos(e) * sin(L), cos(L)) / 15);
    const decl = asin(sin(e) * sin(L));
    const eqt = q / 15 - RA;
    return { decl, eqt };
  }

  function hourAngle(altitude, lat, decl) {
    const numerator = sin(-altitude) - sin(lat) * sin(decl);
    const denominator = cos(lat) * cos(decl);
    const x = clamp(numerator / denominator, -1, 1);
    return acos(x) / 15;
  }

  function toClock(hours) {
    let total = Math.round(hours * 60);
    total = ((total % 1440) + 1440) % 1440;
    return { h: Math.floor(total / 60), m: total % 60, minutes: total };
  }

  /**
   * حساب مواقيت يوم كامل لمدينة.
   * @returns {object} { timings, tomorrowFajr, date, tz, method }
   */
  function timesForCity(city, method, date = new Date(), opts = {}) {
    const tz = city.tz || 'UTC';
    const today = zonedParts(date, tz);
    const y = today.year;
    const mo = today.month;
    const d = today.day;

    // منتصف نهار اليوم محليًا لتقدير فرق التوقيت
    const noonGuess = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    const tzOffset = tzOffsetHours(noonGuess, tz);

    // موضع الشمس عند ظهر المدينة
    const jd = julianDay(y, mo, d) + 0.5 - city.lng / 360;
    const { decl, eqt } = sunPosition(jd);

    const dhuhr = fixHour(12 + tzOffset - city.lng / 15 - eqt);
    const haSunrise = hourAngle(0.833, city.lat, decl);
    const fajrHour = dhuhr - hourAngle(method.fajr, city.lat, decl);
    const sunriseHour = dhuhr - haSunrise;
    const maghribHour = dhuhr + haSunrise;

    let ishaHour;
    if (typeof method.isha === 'number' && method.isha > 60) {
      ishaHour = maghribHour + method.isha / 60;
    } else {
      ishaHour = dhuhr + hourAngle(method.isha, city.lat, decl);
    }

    const asrAltitude = atan2(1, 1 + tan(Math.abs(city.lat - decl)));
    const asrHour = dhuhr + hourAngle(-asrAltitude, city.lat, decl);

    const raw = {
      fajr: fajrHour,
      sunrise: sunriseHour,
      dhuhr: dhuhr,
      asr: asrHour,
      maghrib: maghribHour,
      isha: ishaHour
    };

    const baseUTC = Date.UTC(y, mo - 1, d, 0, 0, 0) - tzOffset * 3600000;

    const timings = {};
    for (const key of PRAYER_KEYS) {
      const clock = toClock(raw[key]);
      timings[key] = {
        key,
        label: LABELS[key],
        h: clock.h,
        m: clock.m,
        minutes: clock.minutes,
        date: new Date(baseUTC + clock.minutes * 60000)
      };
    }

    // فجر الغد — لحساب العدّ التنازلي بعد العشاء
    let tomorrowFajr = null;
    if (!opts.skipTomorrow) {
      const tomorrowInstant = new Date(baseUTC + 25 * 3600000);
      try {
        const next = timesForCity(city, method, tomorrowInstant, { skipTomorrow: true });
        tomorrowFajr = next.timings.fajr;
      } catch (e) {
        tomorrowFajr = null;
      }
    }

    return { timings, tomorrowFajr, date: { y, m: mo, d }, tz, method, city };
  }

  /**
   * الصلاة القادمة مع الوقت المتبقي.
   */
  function nextPrayer(result, now = new Date()) {
    const nowMs = now.getTime();
    for (const key of NEXT_KEYS) {
      const t = result.timings[key];
      if (t.date.getTime() > nowMs) return { timing: t, tomorrow: false };
    }
    if (result.tomorrowFajr) return { timing: result.tomorrowFajr, tomorrow: true };
    // احتياط: فجر اليوم التالي محسوب محليًا
    const fajr = result.timings.fajr;
    const next = new Date(fajr.date.getTime() + 24 * 3600000);
    return { timing: { ...fajr, date: next }, tomorrow: true };
  }

  function previousPrayer(result, now = new Date()) {
    const nowMs = now.getTime();
    let prev = null;
    for (const key of NEXT_KEYS) {
      const t = result.timings[key];
      if (t.date.getTime() <= nowMs) prev = t;
    }
    if (!prev) {
      const isha = result.timings.isha;
      prev = { ...isha, date: new Date(isha.date.getTime() - 24 * 3600000) };
    }
    return prev;
  }

  /* ---------- القبلة ---------- */
  function qiblaBearing(lat, lng) {
    const dLng = (KAABA.lng - lng) * DEG;
    const latRad = lat * DEG;
    const kaabaLat = KAABA.lat * DEG;
    const y = Math.sin(dLng);
    const x = Math.cos(latRad) * Math.tan(kaabaLat) - Math.sin(latRad) * Math.cos(dLng);
    return (Math.atan2(y, x) / DEG + 360) % 360;
  }

  function distanceToKaaba(lat, lng) {
    const R = 6371;
    const dLat = (KAABA.lat - lat) * DEG;
    const dLng = (KAABA.lng - lng) * DEG;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat * DEG) * Math.cos(KAABA.lat * DEG) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
  }

  /* ---------- التاريخ ---------- */
  function hijriParts(date = new Date()) {
    try {
      const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      const parts = fmt.formatToParts(date);
      const o = {};
      for (const p of parts) o[p.type] = p.value;
      return { day: o.day, month: o.month, year: o.year, text: `${o.day} ${o.month} ${o.year} هـ` };
    } catch (e) {
      // تحويل تقريبي عند غياب دعم المتصفح
      const jd = Math.floor(date.getTime() / 86400000) + 2440588;
      const l = jd - 1948440 + 10632;
      const n = Math.floor((l - 1) / 10631);
      let l2 = l - 10631 * n + 354;
      const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
        Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
      l2 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
        Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
      const month = Math.floor((24 * l2) / 709);
      const day = l2 - Math.floor((709 * month) / 24);
      const year = 30 * n + j - 30;
      const months = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
        'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
      return { day, month: months[month - 1], year, text: `${day} ${months[month - 1]} ${year} هـ` };
    }
  }

  return {
    timesForCity,
    nextPrayer,
    previousPrayer,
    qiblaBearing,
    distanceToKaaba,
    hijriParts,
    zonedParts,
    tzOffsetHours,
    LABELS,
    PRAYER_KEYS,
    NEXT_KEYS
  };
})();
