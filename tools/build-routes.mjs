/**
 * يولّد صفحات المسارات العربية + sitemap + robots + 404 + routes.js
 *
 * التشغيل: node tools/build-routes.mjs
 * على Vercel يُستدعى تلقائيًا، ويستعمل نطاق المشروع الفعلي في canonical/sitemap.
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, SITE, DEFAULT_SITE_URL, absoluteUrl } from './routes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(ROOT, 'index.html');

// على Vercel نبني في dist/، ومحليًا نكتب في جذر المشروع (جاهز للـ commit).
const OUT = process.env.VERCEL ? join(ROOT, 'dist') : ROOT;

function resolveSiteUrl() {
  // النطاق الرسمي المُعتمد في tools/routes.mjs هو الأساس دائمًا،
  // ولا يُستبدل بنطاق النشر (*.vercel.app) إلا إذا كان الافتراضي فارغًا.
  const raw = process.env.SITE_URL || DEFAULT_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');

  return raw.replace(/\/+$/, '');
}

const SITE_URL = resolveSiteUrl();

const esc = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const jsonLd = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

function schemaFor(page, url) {
  const base = {
    '@context': 'https://schema.org',
    inLanguage: SITE.language,
    description: page.description,
    url
  };

  if (page.key === 'home') {
    return {
      ...base,
      '@type': 'WebSite',
      name: SITE.name,
      alternateName: 'Noor Islamic Website',
      publisher: { '@type': 'Organization', name: SITE.name, url: `${SITE_URL}/` }
    };
  }

  return {
    ...base,
    '@type': 'WebPage',
    name: page.title,
    isPartOf: { '@type': 'WebSite', name: SITE.name, url: `${SITE_URL}/` },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: page.nav, item: url }
      ]
    }
  };
}

function seoBlock(page) {
  const url = absoluteUrl(SITE_URL, page.path);

  return `<!--seo:start-->
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="${SITE.locale}">
  <meta property="og:site_name" content="${esc(SITE.name)}">
  <meta property="og:title" content="${esc(page.title)}">
  <meta property="og:description" content="${esc(page.description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(page.title)}">
  <meta name="twitter:description" content="${esc(page.description)}">
  <script type="application/ld+json" id="pageSchema">${jsonLd(schemaFor(page, url))}</script>
  <!--seo:end-->`;
}

function applySeo(html, page) {
  const block = seoBlock(page);

  if (html.includes('<!--seo:start-->')) {
    return html.replace(/[ \t]*<!--seo:start-->[\s\S]*?<!--seo:end-->/, block);
  }

  return html.replace(/<title>[\s\S]*?id="pageSchema"[\s\S]*?<\/script>/, block);
}

function setActiveSection(html, key) {
  return html.replace(/<section class="page(?: is-active)?" id="page-([a-z]+)"([^>]*)>/g, (match, id, attrs) => {
    const active = id === key;
    const clean = attrs.replace(/\s*hidden(?:="[^"]*")?/g, '').replace(/\s+$/, '');
    return `<section class="page${active ? ' is-active' : ''}" id="page-${id}"${clean}${active ? '' : ' hidden'}>`;
  });
}

function renderRoute(template, page) {
  const withSeo = applySeo(
    template.replace(/data-route="[a-zA-Z-]+"/, `data-route="${page.key}"`),
    page
  );

  return setActiveSection(withSeo, page.key);
}

function writeSitemap() {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = PAGES.map((page) => {
    const loc = encodeURI(absoluteUrl(SITE_URL, page.path));
    return `  <url>
    <loc>${esc(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  writeFileSync(join(OUT, 'sitemap.xml'), xml, 'utf8');

  // فهرس خرائط بمسار بديل: يفيد عند تعليق حالة قديمة في Search Console
  const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${esc(SITE_URL)}/sitemap.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
</sitemapindex>
`;

  writeFileSync(join(OUT, 'sitemap-index.xml'), index, 'utf8');

  // خريطة نصية (يدعمها Google) كخطة بديلة عند تعليق حالة XML
  const txt = PAGES.map((page) => encodeURI(absoluteUrl(SITE_URL, page.path))).join('\n') + '\n';
  writeFileSync(join(OUT, 'sitemap.txt'), txt, 'utf8');
}

function writeRobots() {
  const txt = `User-agent: *
Allow: /
Disallow: /*?lang=en

Sitemap: ${SITE_URL}/sitemap.xml
Sitemap: ${SITE_URL}/sitemap-index.xml
Sitemap: ${SITE_URL}/sitemap.txt
`;
  writeFileSync(join(OUT, 'robots.txt'), txt, 'utf8');
}

function writeClientRoutes() {
  const pages = {};
  for (const page of PAGES) {
    pages[page.key] = {
      path: page.path,
      title: page.title,
      description: page.description,
      nav: page.nav,
      ...(page.titleEn ? { titleEn: page.titleEn } : {}),
      ...(page.descriptionEn ? { descriptionEn: page.descriptionEn } : {})
    };
  }

  const js = `/* مُولَّد آليًا من tools/routes.mjs — لا تعدّله يدويًا. */
window.NOOR_ROUTES = ${JSON.stringify({ siteUrl: SITE_URL, pages }, null, 2)};
`;

  writeFileSync(join(OUT, 'routes.js'), js, 'utf8');
}

function write404() {
  const links = PAGES.filter((page) => page.key !== 'home')
    .map((page) => `        <a href="${esc(page.path)}">${esc(page.nav)}</a>`)
    .join('\n');

  const map = JSON.stringify([
    ...PAGES.map((page) => [page.path, page.path]),
    ...PAGES.flatMap((page) => (page.legacy || []).map((path) => [path, page.path]))
  ]);

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, follow">
  <title>الصفحة غير موجودة | ${esc(SITE.name)}</title>
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
  <main class="container" style="min-height:100vh;display:grid;place-items:center;text-align:center;gap:14px;padding:40px 0">
    <p class="kicker">خطأ 404</p>
    <h1 style="font-size:clamp(28px,5vw,44px)">هذه الصفحة غير موجودة</h1>
    <p class="lead sm">ربما تغيّر الرابط أو كُتب بشكل مختلف. يمكنك الانتقال إلى أحد الأقسام:</p>
    <nav class="footer-links" aria-label="أقسام الموقع" style="border-top:0">
        <a href="/">الرئيسية</a>
${links}
    </nav>
  </main>
  <script>
    (function () {
      var routes = ${map};
      function loose(v) {
        return decodeURI(v).replace(/\\/index\\.html?$/i, '/').replace(/\\.html?$/i, '')
          .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\\/+$/, '').toLowerCase();
      }
      var path = loose(location.pathname);
      var current = decodeURI(location.pathname).replace(/\\/+$/, '') || '/';
      for (var i = 0; i < routes.length; i++) {
        // إعادة التوجيه فقط عند اختلاف فعلي (مثل همزة/تاء مربوطة) — يمنع حلقة 404
        if (loose(routes[i][0]) === path && routes[i][1] !== current) {
          location.replace(routes[i][1]);
          return;
        }
      }
    })();
  </script>
</body>
</html>
`;

  writeFileSync(join(OUT, '404.html'), html, 'utf8');
}

/** صفحة تحويل من مسار قديم (عربي أو إنجليزي سابق) إلى المسار الجديد */
function writeLegacyRedirect(page) {
  const legacyPaths = page.legacy || [];
  if (!legacyPaths.length) return;

  const url = absoluteUrl(SITE_URL, page.path);

  for (const legacyPath of legacyPaths) {
    const file = `${legacyPath.slice(1)}.html`;
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(page.title)}</title>
  <link rel="canonical" href="${esc(url)}">
  <meta name="robots" content="noindex, follow">
  <meta http-equiv="refresh" content="0;url=${esc(page.path)}">
  <script>location.replace(${JSON.stringify(page.path)});</script>
</head>
<body>
  <p style="font-family:Tahoma,sans-serif;text-align:center;padding:40px">
    تم نقل الصفحة إلى <a href="${esc(page.path)}">${esc(page.path)}</a>
  </p>
</body>
</html>
`;

    writeFileSync(join(OUT, file), html, 'utf8');
    console.log(`↪ ${file}  → ${page.path}`);
  }
}

function main() {
  const template = readFileSync(TEMPLATE, 'utf8');

  if (OUT !== ROOT) {
    mkdirSync(OUT, { recursive: true });
    if (existsSync(join(ROOT, 'assets'))) {
      cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
    }
  }

  for (const page of PAGES) {
    const html = renderRoute(template, page);
    writeFileSync(join(OUT, page.file), html, 'utf8');
    console.log(`✓ ${page.file}  (${page.path})`);
  }

  writeClientRoutes();
  writeSitemap();
  writeRobots();
  write404();

  console.log(`\nSite URL: ${SITE_URL}`);
  console.log(`Output: ${OUT}`);
  console.log('تم توليد: routes.js, sitemap.xml, robots.txt, 404.html');
}

main();
