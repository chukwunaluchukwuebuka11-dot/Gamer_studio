const jsonResponse = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body)
});

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function getXmlValue(item, tag) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]).replace(/<[^>]*>/g, '').trim() : '';
}

function getXmlRawValue(item, tag) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]).trim() : '';
}

function getValidImageUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(decodeXml(value));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function getRssImage(item) {
  const mediaMatch = item.match(/<(?:media:content|media:thumbnail)\b[^>]*\burl=["']([^"']+)["'][^>]*>/i);
  if (mediaMatch) {
    const imageUrl = getValidImageUrl(mediaMatch[1]);
    if (imageUrl) return imageUrl;
  }

  const enclosure = item.match(/<enclosure\b([^>]*)>/i);
  if (enclosure && /\btype=["']image\//i.test(enclosure[1])) {
    const enclosureUrl = enclosure[1].match(/\burl=["']([^"']+)["']/i);
    const imageUrl = getValidImageUrl(enclosureUrl?.[1]);
    if (imageUrl) return imageUrl;
  }

  const description = [
    getXmlRawValue(item, 'description'),
    getXmlRawValue(item, 'content:encoded')
  ].join(' ');
  const imageMatch = description.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  return imageMatch ? getValidImageUrl(imageMatch[1]) : null;
}

const gamingTopicPattern = /\b(?:video[\s-]?games?|gaming|gamers?|playstation|xbox|nintendo|steam|epic games|esports?|pc gaming|game developers?|game development|game studios?|game releases?|game updates?|gaming industry|gaming console|gaming hardware|fortnite|free[\s-]?fire|pubg(?:\s?mobile)?|bgmi|call of duty(?:\s?mobile)?|cod mobile|warzone|minecraft|roblox|mobile legends(?:\s?bang bang)?|mlbb|league of legends|wild rift|valorant|counter[\s-]?strike|overwatch|apex legends|rocket league|fall guys|among us|genshin impact|honor of kings|arena of valor|clash of clans|clash royale|grand theft auto|gta vi|elden ring|final fantasy|zelda|pokemon|destiny 2|helldivers|monster hunter|resident evil|assassin'?s creed|cyberpunk 2077|the sims|world of warcraft|diablo)\b/i;
const gamingSearchQuery = '"Fortnite" OR "Free Fire" OR "PUBG Mobile" OR BGMI OR "COD Mobile" OR "Mobile Legends" OR Valorant OR "Apex Legends" OR Minecraft OR Roblox OR "Genshin Impact" OR esports';

function filterGamingArticles(articles) {
  const seenUrls = new Set();
  return articles
    .filter((article) => {
      if (!article.title || !article.url || !gamingTopicPattern.test(`${article.title} ${article.description || ''}`)) {
        return false;
      }
      try {
        const url = new URL(article.url);
        if (!['http:', 'https:'].includes(url.protocol) || seenUrls.has(url.href)) return false;
        seenUrls.add(url.href);
        article.url = url.href;
        article.image = getValidImageUrl(article.image);
        return true;
      } catch {
        return false;
      }
    })
    .slice(0, 10);
}

function normalizeArticleTitle(title) {
  return title
    .toLowerCase()
    .split(/\s(?:-|–|—|\|)\s/, 1)[0]
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function getMatchingRssImage(article, rssArticles) {
  const titleWords = normalizeArticleTitle(article.title);
  if (titleWords.length < 3) return null;

  let bestMatch = null;
  let bestScore = 0;
  for (const rssArticle of rssArticles) {
    if (!rssArticle.image) continue;
    const rssWords = normalizeArticleTitle(rssArticle.title);
    if (rssWords.length < 3) continue;
    const titleWordSet = new Set(titleWords);
    const matchingWords = rssWords.filter((word) => titleWordSet.has(word)).length;
    const score = matchingWords / new Set([...titleWords, ...rssWords]).size;
    if (matchingWords >= 3 && score >= 0.5 && score > bestScore) {
      bestMatch = rssArticle.image;
      bestScore = score;
    }
  }
  return bestMatch;
}

function addRssImageFallbacks(articles, rssArticles) {
  return articles.map((article) => {
    const rssImage = getMatchingRssImage(article, rssArticles);
    return rssImage ? { ...article, image: rssImage } : article;
  });
}

async function getGNewsArticles(apiKey) {
  const url = new URL('https://gnews.io/api/v4/search');
  url.searchParams.set('q', gamingSearchQuery);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw new Error(`GNews API returned ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.articles)) {
    throw new Error('GNews response did not contain an articles list');
  }
  return filterGamingArticles(data.articles.map((article) => ({
    title: article.title,
    description: article.description,
    image: getValidImageUrl(article.image),
    publishedAt: article.publishedAt,
    url: article.url
  })));
}

async function getRssArticles() {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', gamingSearchQuery);
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('gl', 'US');
  url.searchParams.set('ceid', 'US:en');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml',
      'User-Agent': 'GamerStudioNews/1.0'
    },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw new Error(`Gaming RSS feed returned ${response.status}`);
  }

  const xml = await response.text();
  return filterGamingArticles([...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
    .map(([, item]) => ({
      title: getXmlValue(item, 'title'),
      description: getXmlValue(item, 'description'),
      image: getRssImage(item),
      publishedAt: getXmlValue(item, 'pubDate'),
      url: getXmlValue(item, 'link')
    })));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { Allow: 'GET' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let articles;
  const apiKey = process.env.GNEWS_API_KEY;

  if (apiKey) {
    try {
      articles = await getGNewsArticles(apiKey);
    } catch (error) {
      console.error('Unable to fetch gaming news from GNews; trying RSS fallback:', error);
    }
  }

  let rssArticles;
  try {
    rssArticles = await getRssArticles();
    if (articles?.length) {
      const currentImageCount = articles.filter((article) => article.image).length;
      const rssImageCount = rssArticles.filter((article) => article.image).length;
      const enrichedArticles = addRssImageFallbacks(articles, rssArticles);
      articles = rssImageCount > currentImageCount
        ? rssArticles
        : enrichedArticles;
    } else {
      articles = rssArticles;
    }
  } catch (error) {
    console.error('Unable to fetch gaming news from RSS fallback:', error);
    if (!articles?.length) {
      return jsonResponse(502, { error: 'Gaming news is temporarily unavailable.' });
    }
  }

  return jsonResponse(
    200,
    { articles },
    { 'Cache-Control': 'public, max-age=900' }
  );
};
