/* ============================================================
   WMM-2025 — نموذج المجال المغناطيسي الأرضي (NOAA)
   حساب الانحراف المغناطيسي (declination) بين الشمال المغناطيسي
   والشمال الحقيقي، لتُصحَّح به قراءة بوصلة الهاتف.
   المعاملات: WMM2025 COF (مجال رئيسي + تغيّر زمني) — NOAA/NCEI، ملكية عامة.
   التنفيذ مكتوب محليًا بلا أي مكتبة، ومُتحقَّق منه مقابل التطبيق المرجعي
   geomagnetism (Apache-2.0) بخطأ 0.0000°.
   ============================================================ */
'use strict';

const WMM = (() => {
  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;
  const NMAX = 12;
  const EPOCH = 2025;

  // نصف المحاور الكبرى (WGS84) ونصف قطر مرجعي
  const A = 6378.137;
  const B = 6356.7523142;
  const RE = 6371.2;
  const EPSSQ = 1 - (B * B) / (A * A);

  const G0 = [
    0, -29351.8, -1410.8, -2556.6, 2951.1, 1649.3, 1361, -2404.1, 1243.8, 453.6,
    895, 799.5, 55.7, -281.1, 12.1, -233.2, 368.9, 187.2, -138.7, -142,
    20.9, 64.4, 63.8, 76.9, -115.7, -40.9, 14.9, -60.7, 79.5, -77,
    -8.8, 59.3, 15.8, 2.5, -11.1, 14.2, 23.2, 10.8, -17.5, 2,
    -21.7, 16.9, 15, -16.8, 0.9, 4.6, 7.8, 3, -0.2, -2.5,
    -13.1, 2.4, 8.6, -8.7, -12.9, -1.3, -6.4, 0.2, 2, -1,
    -0.6, -0.9, 1.5, 0.9, -2.7, -3.9, 2.9, -1.5, -2.5, 2.4,
    -0.6, -0.1, -0.6, -0.1, 1.1, -1, -0.2, 2.6, -2, -0.2,
    0.3, 1.2, -1.3, 0.6, 0.6, 0.5, -0.1, -0.4, -0.2, -1.3, -0.7
  ];

  const H0 = [
    0, 0, 4545.4, 0, -3133.6, -815.1, 0, -56.6, 237.5, -549.5,
    0, 278.6, -133.9, 212, -375.6, 0, 45.4, 220.2, -122.9, 43,
    106.1, 0, -18.4, 16.8, 48.8, -59.8, 10.9, 72.7, 0, -48.9,
    -14.4, -1, 23.4, -7.4, -25.1, -2.3, 0, 7.1, -12.6, 11.4,
    -9.7, 12.7, 0.7, -5.2, 3.9, 0, -24.8, 12.2, 8.3, -3.3,
    -5.2, 7.2, -0.6, 0.8, 10, 0, 3.3, 0, 2.4, 5.3,
    -9.1, 0.4, -4.2, -3.8, 0.9, -9.1, 0, 0, 2.9, -0.6,
    0.2, 0.5, -0.3, -1.2, -1.7, -2.9, -1.8, -2.3, 0, -1.3,
    0.7, 1, -1.4, 0, 0.6, -0.1, 0.8, 0.1, -1, 0.1, 0.2
  ];

  const GS = [
    0, 12, 9.7, -11.6, -5.2, -8, -1.3, -4.2, 0.4, -15.6,
    -1.6, -2.4, -6, 5.6, -7, 0.6, 1.4, 0, 0.6, 2.2,
    0.9, -0.2, -0.4, 0.9, 1.2, -0.9, 0.3, 0.9, 0, -0.1,
    -0.1, 0.5, -0.1, -0.8, -0.8, 0.8, -0.1, 0.2, 0, 0.5,
    -0.1, 0.3, 0.2, 0, 0.2, 0, -0.1, 0.1, 0.3, -0.3,
    0, 0.3, -0.1, 0.1, -0.1, 0.1, 0, 0.1, 0.1, 0,
    -0.3, 0, -0.1, -0.1, 0, 0, 0, 0, 0, 0,
    0, -0.1, 0, 0, -0.1, -0.1, -0.1, -0.1, 0, 0,
    0, 0, 0, 0, 0.1, 0, 0, 0, -0.1, 0, -0.1
  ];

  const HS = [
    0, 0, -21.5, 0, -27.7, -12.1, 0, 4, -0.3, -4.1,
    0, -1.1, 4.1, 1.6, -4.4, 0, -0.5, 2.2, 0.4, 1.7,
    1.9, 0, 0.3, -1.6, -0.4, 0.9, 0.7, 0.9, 0, 0.6,
    0.5, -0.8, 0, -1, 0.6, -0.2, 0, -0.2, 0.5, -0.4,
    0.4, -0.5, -0.6, 0.3, 0.2, 0, -0.3, 0.3, -0.3, 0.3,
    0.2, -0.1, -0.2, 0.4, 0.1, 0, 0, 0, -0.2, 0.1,
    -0.1, 0.1, 0, -0.1, 0.2, 0, 0, 0, 0.1, 0,
    0.1, 0, 0, 0.1, 0, 0, 0, 0, 0, 0,
    0, -0.1, 0.1, 0, 0, 0, 0, 0, 0, 0, -0.1
  ];

  function legendre(x) {
    const pcup = [];
    const dpcup = [];
    const norm = [];
    pcup[0] = 1;
    dpcup[0] = 0;
    norm[0] = 1;

    const z = Math.sqrt((1 - x) * (1 + x));

    for (let n = 1; n <= NMAX; n += 1) {
      for (let m = 0; m <= n; m += 1) {
        const i = (n * (n + 1)) / 2 + m;
        if (n === m) {
          const i1 = ((n - 1) * n) / 2 + m - 1;
          pcup[i] = z * pcup[i1];
          dpcup[i] = z * dpcup[i1] + x * pcup[i1];
        } else if (n === 1 && m === 0) {
          const i1 = ((n - 1) * n) / 2 + m;
          pcup[i] = x * pcup[i1];
          dpcup[i] = x * dpcup[i1] - z * pcup[i1];
        } else if (n > 1) {
          const i1 = ((n - 2) * (n - 1)) / 2 + m;
          const i2 = ((n - 1) * n) / 2 + m;
          if (m > n - 2) {
            pcup[i] = x * pcup[i2];
            dpcup[i] = x * dpcup[i2] - z * pcup[i2];
          } else {
            const k = ((n - 1) * (n - 1) - m * m) / ((2 * n - 1) * (2 * n - 3));
            pcup[i] = x * pcup[i2] - k * pcup[i1];
            dpcup[i] = x * dpcup[i2] - z * pcup[i2] - k * dpcup[i1];
          }
        }
      }
    }

    for (let n = 1; n <= NMAX; n += 1) {
      let i = (n * (n + 1)) / 2;
      let i1 = ((n - 1) * n) / 2;
      norm[i] = (norm[i1] * (2 * n - 1)) / n;
      for (let m = 1; m <= n; m += 1) {
        i = (n * (n + 1)) / 2 + m;
        i1 = (n * (n + 1)) / 2 + m - 1;
        norm[i] = norm[i1] * Math.sqrt(((n - m + 1) * (m === 1 ? 2 : 1)) / (n + m));
      }
    }

    for (let n = 1; n <= NMAX; n += 1) {
      for (let m = 0; m <= n; m += 1) {
        const i = (n * (n + 1)) / 2 + m;
        pcup[i] *= norm[i];
        dpcup[i] *= -norm[i];
      }
    }

    return { pcup, dpcup };
  }

  function decimalYear(date) {
    const y = date.getUTCFullYear();
    const start = Date.UTC(y, 0, 1);
    return y + (date.getTime() - start) / (1000 * 3600 * 24 * 365);
  }

  /**
   * الانحراف المغناطيسي بالدرجات (شرق موجب) عند نقطة وتاريخ.
   * @param {number} lat خط العرض
   * @param {number} lon خط الطول
   * @param {Date} [date]
   */
  function declination(lat, lon, date = new Date()) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 0;

    const dyear = decimalYear(date) - EPOCH;

    const g = [];
    const h = [];
    for (let i = 0; i <= 90; i += 1) {
      g[i] = G0[i] + dyear * GS[i];
      h[i] = H0[i] + dyear * HS[i];
    }

    const latRad = lat * DEG;
    const lonRad = lon * DEG;
    const coslat = Math.cos(latRad);
    const sinlat = Math.sin(latRad);

    const rc = A / Math.sqrt(1 - EPSSQ * sinlat * sinlat);
    const xp = rc * coslat;
    const zp = rc * (1 - EPSSQ) * sinlat;
    const r = Math.hypot(xp, zp);
    const phig = Math.asin(zp / r);

    const { pcup, dpcup } = legendre(Math.sin(phig));

    const cosM = [];
    const sinM = [];
    cosM[0] = 1;
    sinM[0] = 0;
    cosM[1] = Math.cos(lonRad);
    sinM[1] = Math.sin(lonRad);
    for (let m = 2; m <= NMAX; m += 1) {
      cosM[m] = cosM[m - 1] * cosM[1] - sinM[m - 1] * sinM[1];
      sinM[m] = cosM[m - 1] * sinM[1] + sinM[m - 1] * cosM[1];
    }

    const ratio = RE / r;
    const rp = [ratio * ratio];
    for (let n = 1; n <= NMAX; n += 1) rp[n] = rp[n - 1] * ratio;

    let bx = 0;
    let by = 0;
    let bz = 0;

    for (let n = 1; n <= NMAX; n += 1) {
      for (let m = 0; m <= n; m += 1) {
        const i = (n * (n + 1)) / 2 + m;
        const c = g[i] * cosM[m] + h[i] * sinM[m];
        bz -= rp[n] * c * (n + 1) * pcup[i];
        by += rp[n] * (g[i] * sinM[m] - h[i] * cosM[m]) * m * pcup[i];
        bx -= rp[n] * c * dpcup[i];
      }
    }

    by /= Math.cos(phig);

    const psi = phig - latRad;
    const bxr = bx * Math.cos(psi) - bz * Math.sin(psi);

    return Math.atan2(by, bxr) * RAD;
  }

  return { declination };
})();
