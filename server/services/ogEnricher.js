'use strict';

const TIMEOUT_MS = parseInt(process.env.OG_FETCH_TIMEOUT_MS || '3000', 10);

async function ogEnricher(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {};
    }
  } catch {
    return {};
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'gift-guide-bot/1.0' },
    });

    if (!res.ok) return {};

    const html = await res.text();

    const result = {};

    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (titleMatch) result.title = titleMatch[1].trim();

    const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (imageMatch) result.og_image_url = imageMatch[1].trim();

    return result;
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

module.exports = ogEnricher;
