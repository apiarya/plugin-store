export const MEASUREMENT_ID = "G-B8TTJGCDXK";
export const ANALYTICS_HOST = "apiarya.github.io";

export function createAnalytics({ win = globalThis.window, doc = globalThis.document } = {}) {
  const enabled = win?.location?.hostname === ANALYTICS_HOST;
  if (!enabled) return { enabled, track() {} };
  win.dataLayer = win.dataLayer || [];
  win.gtag = function gtag() { win.dataLayer.push(arguments); };
  win.gtag("js", new Date());
  win.gtag("config", MEASUREMENT_ID);
  const script = doc.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  doc.head.append(script);
  return { enabled, track: (name, params = {}) => win.gtag("event", name, params) };
}

export const analytics = createAnalytics();
