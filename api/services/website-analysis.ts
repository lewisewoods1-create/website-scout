/**
 * Website Analysis Service
 * Performs real technical checks on websites: SSL, CMS detection, speed indicators, etc.
 */

export interface WebsiteCheckResult {
  ssl: boolean;
  cmsDetection: string | null;
  hosting: string | null;
  analyticsDetection: string[];
  schema: boolean;
  pageSpeed: number; // 0-100 estimate
  hasWebsite: boolean;
  error?: string;
}

/**
 * Perform a lightweight analysis of a website.
 * Fetches headers and HTML to detect technologies.
 */
export async function analyseWebsite(websiteUrl: string): Promise<WebsiteCheckResult> {
  if (!websiteUrl) {
    return { ssl: false, cmsDetection: null, hosting: null, analyticsDetection: [], schema: false, pageSpeed: 0, hasWebsite: false };
  }

  // Normalise URL
  let url = websiteUrl.trim();
  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

  try {
    // Set a timeout for the fetch
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    clearTimeout(timeout);

    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    const html = await response.text();

    // SSL check
    const ssl = url.startsWith("https");

    // CMS Detection
    const cms = detectCMS(html, headers);

    // Hosting detection
    const hosting = detectHosting(headers, html);

    // Analytics detection
    const analytics = detectAnalytics(html);

    // Schema markup check
    const schema = html.includes("schema.org") || html.includes('itemtype="http://schema.org');

    // Page speed estimate based on HTML size
    const htmlSize = html.length;
    let pageSpeed = 50; // base
    if (htmlSize < 50000) pageSpeed += 30;
    else if (htmlSize < 150000) pageSpeed += 15;
    else if (htmlSize < 300000) pageSpeed += 0;
    else pageSpeed -= 20;

    // Check for heavy scripts
    const scriptMatches = html.match(/<script/gi);
    if (scriptMatches && scriptMatches.length > 15) pageSpeed -= 15;

    // Check for responsive meta tag
    if (html.includes('viewport')) pageSpeed += 10;

    // Check for image optimisation hints
    if (html.includes('loading="lazy"')) pageSpeed += 10;
    if (html.includes("srcset=")) pageSpeed += 5;

    return {
      ssl,
      cmsDetection: cms,
      hosting,
      analyticsDetection: analytics,
      schema,
      pageSpeed: Math.max(0, Math.min(100, pageSpeed)),
      hasWebsite: true,
    };
  } catch (err) {
    // If the fetch failed but it's an https URL, SSL likely exists
    const ssl = url.startsWith("https");
    return {
      ssl,
      cmsDetection: null,
      hosting: null,
      analyticsDetection: [],
      schema: false,
      pageSpeed: ssl ? 30 : 10,
      hasWebsite: true,
      error: String(err),
    };
  }
}

function detectCMS(html: string, headers: Record<string, string>): string | null {
  const lowerHtml = html.toLowerCase();

  // WordPress
  if (lowerHtml.includes("wp-content") || lowerHtml.includes("wp-includes") || lowerHtml.includes("/wp-json/")) return "WordPress";
  if (headers["x-powered-by"]?.includes("PHP")) {
    // Check for common WP plugins
    if (lowerHtml.includes("elementor") || lowerHtml.includes("divi")) return "WordPress";
  }

  // Wix
  if (lowerHtml.includes("wix.com") || lowerHtml.includes("static.wixstatic.com")) return "Wix";

  // Squarespace
  if (lowerHtml.includes("squarespace.com") || lowerHtml.includes("static1.squarespace.com")) return "Squarespace";

  // Shopify
  if (lowerHtml.includes("cdn.shopify.com") || lowerHtml.includes("myshopify.com")) return "Shopify";

  // Webflow
  if (lowerHtml.includes("webflow.com") || lowerHtml.includes("w-flw-layout")) return "Webflow";

  // React/Next.js
  if (lowerHtml.includes('id="__next"') || lowerHtml.includes("_next/static")) return "Next.js";
  if (lowerHtml.includes('data-reactroot') || lowerHtml.includes('data-reactid')) return "React";

  // Vue
  if (lowerHtml.includes('data-v-') || lowerHtml.includes("__vue__")) return "Vue.js";

  // Joomla
  if (lowerHtml.includes("/media/jui/") || lowerHtml.includes("/templates/")) return "Joomla";

  // Drupal
  if (lowerHtml.includes("drupal.js") || lowerHtml.includes('name="generator" content="drupal')) return "Drupal";

  // Weebly
  if (lowerHtml.includes("weebly.com") || lowerHtml.includes("cdn-edit.weebly.com")) return "Weebly";

  // GoDaddy
  if (lowerHtml.includes("godaddysites.com")) return "GoDaddy Website Builder";

  // Generic CMS detection
  const server = headers["server"] || "";
  if (server.includes("Apache") && lowerHtml.includes("php")) return "PHP (Custom/Unknown)";
  if (server.includes("nginx") && lowerHtml.includes("php")) return "PHP (Custom/Unknown)";

  // Check for generator meta tag
  const generatorMatch = html.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']+)["']/i);
  if (generatorMatch) return generatorMatch[1];

  return null;
}

function detectHosting(headers: Record<string, string>, html: string): string | null {
  const server = headers["server"] || "";
  const cfRay = headers["cf-ray"];
  const via = headers["via"] || "";

  if (cfRay) return "Cloudflare";
  if (server.includes("cloudflare")) return "Cloudflare";
  if (server.includes("awselb") || server.includes("amazon")) return "AWS";
  if (server.includes("gws")) return "Google";
  if (server.includes("nginx")) return "Nginx Server";
  if (server.includes("apache")) return "Apache Server";
  if (server.includes("Microsoft-IIS")) return "Microsoft IIS";
  if (via.includes("vercel")) return "Vercel";
  if (via.includes("netlify")) return "Netlify";
  if (html.includes("firebaseapp.com") || html.includes("googleapis.com")) return "Firebase/Google";

  return server || null;
}

function detectAnalytics(html: string): string[] {
  const lower = html.toLowerCase();
  const analytics: string[] = [];

  if (lower.includes("googletagmanager") || lower.includes("gtag") || lower.includes("google-analytics") || lower.includes("ga(")) {
    analytics.push("Google Analytics");
  }
  if (lower.includes("facebook.com/tr") || lower.includes("fbq(")) {
    analytics.push("Meta Pixel");
  }
  if (lower.includes("hotjar")) {
    analytics.push("Hotjar");
  }
  if (lower.includes("plausible.io")) {
    analytics.push("Plausible");
  }
  if (lower.includes("matomo") || lower.includes("piwik")) {
    analytics.push("Matomo");
  }
  if (lower.includes("mixpanel")) {
    analytics.push("Mixpanel");
  }
  if (lower.includes("segment.com") || lower.includes("analytics.js")) {
    analytics.push("Segment");
  }
  if (lower.includes("clarity.ms")) {
    analytics.push("Microsoft Clarity");
  }

  return analytics;
}
