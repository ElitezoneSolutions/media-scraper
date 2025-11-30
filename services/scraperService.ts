import { MediaType, ScrapedMedia } from '../types';

const PROXIES = [
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://api.allorigins.win/raw?url=',
    'https://thingproxy.freeboard.io/fetch/'
];

const VIDEO_HOSTS = ['rabbitstream', 'megacloud', 'dokicloud', 'vidcloud', 'upstream', 'dood', 'streamtape', 'voe', 'mixdrop', 'vidsrc', 'filemoon'];

// Expanded Extension Lists
const VIDEO_EXTS = ['mp4', 'webm', 'mkv', 'flv', 'vob', 'ogv', 'ogg', 'drc', 'gifv', 'mng', 'avi', 'mov', 'qt', 'wmv', 'yuv', 'rm', 'rmvb', 'asf', 'amv', 'm4p', 'm4v', 'mpg', 'mp2', 'mpeg', 'mpe', 'mpv', 'm4v', 'svi', '3gp', '3g2', 'm3u8', 'ts'];
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'tif', 'bmp', 'ico', 'svg', 'heic', 'avif', 'jxl'];

const generateId = () => Math.random().toString(36).substring(2, 9);

const normalizeUrl = (url: string): string => {
  let normalized = url.trim();
  // Remove leading slashes if user typed //example.com
  normalized = normalized.replace(/^\/+/, '');
  
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = `https://${normalized}`;
  }
  return normalized;
};

const resolveUrl = (base: string, relative: string): string => {
  try {
    return new URL(relative, base).href;
  } catch (e) {
    return relative;
  }
};

const stripDimensionParams = (urlStr: string, type: MediaType): string => {
    if (type !== MediaType.IMAGE && type !== MediaType.SVG) return urlStr;

    try {
        const url = new URL(urlStr);
        
        // 1. Strip Query Parameters associated with resizing
        const paramsToRemove = ['w', 'h', 'width', 'height', 'size', 'resize', 'fit', 'crop', 'dpr', 'auto', 'quality'];
        paramsToRemove.forEach(p => url.searchParams.delete(p));

        // 2. Strip WordPress/Generic resolution suffixes (e.g., image-1024x768.jpg)
        const pathname = url.pathname;
        const resizePattern = /[-_]\d{2,5}x\d{2,5}(\.(?:jpg|jpeg|png|webp|gif|bmp|tiff))$/i;
        if (resizePattern.test(pathname)) {
            url.pathname = pathname.replace(resizePattern, '$1');
        }

        return url.toString();
    } catch (e) {
        return urlStr;
    }
};

const getExtension = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('.');
    if (parts.length > 1) {
        const ext = parts.pop()?.toLowerCase();
        if (ext && (VIDEO_EXTS.includes(ext) || IMAGE_EXTS.includes(ext))) {
            return ext;
        }
    }
    if (url.includes('.m3u8')) return 'm3u8';
    return '';
  } catch (e) {
    return '';
  }
};

const fetchWithTimeout = async (url: string, timeout = 15000, headers = {}): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                ...headers
            }
        });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
};

/**
 * Advanced Fetch Logic with Retry Strategy
 */
const fetchHtmlWithStrategy = async (
    targetUrl: string, 
    useProxy: boolean, 
    retryCount: number, 
    smartRetry: boolean,
    onProgress?: (msg: string) => void
): Promise<string> => {
    
    const encodedUrl = encodeURIComponent(targetUrl);
    
    const attemptFetch = async (useProxyForThisRequest: boolean): Promise<string> => {
        if (!useProxyForThisRequest) {
            const res = await fetchWithTimeout(targetUrl);
            if (!res.ok) throw new Error(`Direct fetch failed: ${res.status}`);
            return await res.text();
        } else {
            let lastProxyError;
            for (let i = 0; i < PROXIES.length; i++) {
                const proxy = PROXIES[i];
                try {
                    const urlToFetch = proxy.includes('corsproxy') 
                        ? `${proxy}${targetUrl}` 
                        : `${proxy}${encodedUrl}`;
                    
                    const res = await fetchWithTimeout(urlToFetch);
                    if (res.ok) {
                        const text = await res.text();
                        if (text.length > 200 && !text.includes('Access Denied')) {
                            return text;
                        }
                    }
                } catch (e) {
                    lastProxyError = e;
                }
            }
            throw lastProxyError || new Error("All proxies failed");
        }
    };

    try {
        if (onProgress) onProgress(`Attempt 1 via ${useProxy ? 'Proxy' : 'Direct'}...`);
        return await attemptFetch(useProxy);
    } catch (error) {
        console.warn("Initial scrape attempt failed:", error);
        if (retryCount <= 0) throw error;
    }

    let lastError;
    for (let i = 0; i < retryCount; i++) {
        if (onProgress) onProgress(`Retry ${i + 1}/${retryCount}...`);
        await new Promise(r => setTimeout(r, 200));

        let strategyProxy = useProxy;
        if (smartRetry) {
            strategyProxy = Math.random() > 0.5;
            if (onProgress) onProgress(`Smart Retry: Trying ${strategyProxy ? 'Proxy' : 'Direct'}...`);
        }

        try {
            return await attemptFetch(strategyProxy);
        } catch (e) {
            lastError = e;
            console.warn(`Retry ${i+1} failed`);
        }
    }

    throw lastError || new Error("Max retries reached");
};


const fetchFileSize = async (url: string, useProxy: boolean): Promise<number> => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000); 
    const target = useProxy ? `${PROXIES[0]}${url}` : url;
    const response = await fetch(target, { method: 'HEAD', signal: controller.signal });
    clearTimeout(id);
    if (response.ok) {
        const size = response.headers.get('content-length');
        if (size) return parseInt(size, 10);
    }
    return 0;
  } catch (error) {
    return 0;
  }
};

// --- Extraction Helper ---

const extractCandidatesFromDoc = (doc: Document, html: string, baseUrl: string, mediaType: MediaType, deepMode: boolean): Set<string> => {
    const candidates = new Set<string>();
    
    const add = (raw: string | null | undefined) => {
        if (!raw) return;
        const resolved = resolveUrl(baseUrl, raw);
        const cleaned = stripDimensionParams(resolved, mediaType);
        candidates.add(cleaned);
    };

    if (mediaType === MediaType.IMAGE) {
        const imgs = Array.from(doc.querySelectorAll('img'));
        imgs.forEach(img => {
            if (img.src) add(img.src);
            if (img.dataset.src) add(img.dataset.src);
            if (img.srcset) {
                const parts = img.srcset.split(',');
                const lastPart = parts[parts.length - 1]; 
                const src = lastPart.trim().split(' ')[0];
                if (src) add(src);
            }
        });
        const elements = Array.from(doc.querySelectorAll('*'));
        elements.forEach(el => {
            const style = el.getAttribute('style');
            if (style && style.includes('url(')) {
                const match = style.match(/url\(['"]?(.*?)['"]?\)/);
                if (match && match[1]) add(match[1]);
            }
        });
        
        // Regex catch-all for Images
        const imgExts = IMAGE_EXTS.join('|');
        const imgRegex = new RegExp(`["'](https?:\\/\\/[^"'\\s]+\\.(?:${imgExts})[^"'\\s]*?)["']`, 'gi');
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
            if (match[1]) add(match[1].replace(/\\/g, ''));
        }

    } else if (mediaType === MediaType.VIDEO) {
        const videos = Array.from(doc.querySelectorAll('video'));
        videos.forEach(v => {
            if (v.src) add(v.src);
            v.querySelectorAll('source').forEach(s => {
                if (s.src) add(s.src);
            });
        });
        
        const links = Array.from(doc.querySelectorAll('a'));
        links.forEach(a => {
            const ext = getExtension(a.href);
            if (a.href && VIDEO_EXTS.includes(ext)) {
                add(a.href);
            }
        });

        const vidExts = VIDEO_EXTS.join('|');
        const fileRegex = new RegExp(`["'](https?:\\/\\/[^"'\\s]+\\.(?:${vidExts})[^"'\\s]*?)["']`, 'gi');
        
        let match;
        while ((match = fileRegex.exec(html)) !== null) {
            if (match[1]) {
                 const clean = match[1].replace(/\\/g, '');
                 add(clean);
            }
        }

        // Deep Mode Only: Advanced JS Regex checks
        if (deepMode) {
            const sourceRegex = /(?:file|source|src)\s*:\s*["']([^"']+)["']/gi;
            while ((match = sourceRegex.exec(html)) !== null) {
                const val = match[1];
                if (val && !val.includes('[') && (val.startsWith('http') || val.includes('.mp4') || val.includes('.m3u8'))) { 
                    add(val);
                }
            }
            const base64Regex = /([a-zA-Z0-9+/=]{20,})/g;
            const potentialBase64 = html.match(base64Regex);
            if (potentialBase64) {
                potentialBase64.forEach(str => {
                    try {
                        const decoded = atob(str);
                        if (decoded.match(/^https?:\/\/.*\.(mp4|m3u8)$/)) {
                            add(decoded);
                        }
                    } catch(e) {}
                });
            }
        }
    } else if (mediaType === MediaType.SVG) {
        const imgs = Array.from(doc.querySelectorAll('img'));
        imgs.forEach(img => {
            if (img.src && img.src.toLowerCase().includes('svg')) {
                add(img.src);
            }
        });
        const objects = Array.from(doc.querySelectorAll('object[type="image/svg+xml"]'));
        objects.forEach(obj => {
            const el = obj as HTMLObjectElement;
            if (el.data) add(el.data);
        });
        const svgRegex = new RegExp(`["'](https?:\\/\\/[^"'\\s]+\\.svg[^"'\\s]*?)["']`, 'gi');
        let match;
        while ((match = svgRegex.exec(html)) !== null) {
             if (match[1]) add(match[1].replace(/\\/g, ''));
        }
    }

    return candidates;
};

const isPlayerIframe = (url: string): boolean => {
    const lower = url.toLowerCase();
    if (/embed|player|movie|video|cloud|stream/.test(lower)) return true;
    if (VIDEO_HOSTS.some(host => lower.includes(host))) return true;
    return false;
};

// --- CORE PROCESSING LOGIC ---

const findCandidateUrls = async (
    targetUrl: string, 
    mediaType: MediaType, 
    useProxy: boolean, 
    deepMode: boolean,
    onProgress: (msg: string) => void
): Promise<Set<string>> => {
    const allCandidates = new Set<string>();
    const parser = new DOMParser();

    // 1. Fetch Main Page
    // In Simple Mode, we reduce retries to be fast.
    // In Deep Mode, we use the full robust retry strategy.
    const retryCount = deepMode ? 3 : 1;
    const smartRetry = deepMode;

    const html = await fetchHtmlWithStrategy(targetUrl, useProxy, retryCount, smartRetry, onProgress);
    const doc = parser.parseFromString(html, 'text/html');

    // 2. Extract from Main Page
    const mainCandidates = extractCandidatesFromDoc(doc, html, targetUrl, mediaType, deepMode);
    mainCandidates.forEach(c => allCandidates.add(c));

    // 3. Recursive Iframe Scraping (DEEP MODE ONLY)
    if (deepMode && mediaType === MediaType.VIDEO) {
        const frames = Array.from(doc.querySelectorAll('iframe, embed'));
        let iframeUrls = frames
            .map(el => el.getAttribute('src') || el.getAttribute('data'))
            .filter(src => src && isPlayerIframe(src))
            .map(src => resolveUrl(targetUrl, src!));

        VIDEO_HOSTS.forEach(host => {
            const regex = new RegExp(`["']((?:https?:)?\\/\\/[^"']*${host}[^"']*)["']`, 'gi');
            let match;
            while ((match = regex.exec(html)) !== null) {
                if (match[1]) iframeUrls.push(resolveUrl(targetUrl, match[1]));
            }
        });
        
        iframeUrls = [...new Set(iframeUrls)];
        const framesToScrape = iframeUrls.slice(0, 5); // Limit frames
        
        if (framesToScrape.length > 0) {
            onProgress(`Deep Scan: Analyzing ${framesToScrape.length} frames...`);
            
            await Promise.all(framesToScrape.map(async (frameUrl) => {
                try {
                    const frameHtml = await fetchHtmlWithStrategy(frameUrl, useProxy, 0, false);
                    const frameDoc = parser.parseFromString(frameHtml, 'text/html');
                    const frameCandidates = extractCandidatesFromDoc(frameDoc, frameHtml, frameUrl, mediaType, true);
                    frameCandidates.forEach(c => allCandidates.add(c));
                } catch (e) {
                    // Silent fail
                }
            }));
        }
    }

    return allCandidates;
};

const processCandidates = async (
    candidates: Set<string>, 
    limit: number, 
    minSizeMB: number, 
    useProxy: boolean, 
    mediaType: MediaType,
    onProgress: (msg: string, percent: number) => void
): Promise<ScrapedMedia[]> => {
    
    // Sort logic
    const sortedCandidates = Array.from(candidates).sort((a, b) => {
        const aSecure = a.startsWith('https') ? 1 : 0;
        const bSecure = b.startsWith('https') ? 1 : 0;
        if (aSecure !== bSecure) return bSecure - aSecure;
        
        const aHasQuery = a.includes('?') ? 1 : 0;
        const bHasQuery = b.includes('?') ? 1 : 0;
        if (aHasQuery !== bHasQuery) return bHasQuery - aHasQuery;

        return b.length - a.length;
    });

    // Deduplicate
    const uniqueUrls: string[] = [];
    const seenSignatures = new Set<string>();

    for (const url of sortedCandidates) {
        if (!url.startsWith('http')) continue;
        try {
            const urlObj = new URL(url);
            const host = urlObj.hostname.toLowerCase().replace(/^www\./, '');
            const path = urlObj.pathname.replace(/\/$/, '');
            const signature = `${host}${path}`; // Ignore query params for uniqueness

            if (!seenSignatures.has(signature)) {
                seenSignatures.add(signature);
                uniqueUrls.push(url);
            }
        } catch (e) { continue; }
    }

    if (uniqueUrls.length === 0) return [];

    onProgress(`Filtering ${uniqueUrls.length} files...`, 50);

    const results: ScrapedMedia[] = [];
    let processed = 0;
    const BATCH_SIZE = 8;
    
    for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
        if (results.length >= limit) break;
        const batch = uniqueUrls.slice(i, i + BATCH_SIZE);
        
        const promises = batch.map(async (url) => {
            const isStream = url.includes('.m3u8');
            let sizeBytes = 0;
            if (!isStream) {
                sizeBytes = await fetchFileSize(url, useProxy);
            }
            const sizeMB = sizeBytes / (1024 * 1024);
            let ext = getExtension(url);
            if (!ext && isStream) ext = 'm3u8';
            if (!ext) ext = 'unknown';

            if (minSizeMB > 0) {
                if (sizeBytes > 0 && sizeMB < minSizeMB) return null;
                if (sizeBytes === 0 && !isStream) return null;
            }
            return {
                id: generateId(),
                url,
                type: mediaType,
                sizeBytes,
                extension: ext,
            } as ScrapedMedia;
        });

        const processedBatch = await Promise.all(promises);
        results.push(...processedBatch.filter((item): item is ScrapedMedia => item !== null));

        processed += batch.length;
        const percent = 50 + Math.floor((processed / uniqueUrls.length) * 40);
        onProgress(`Processing... (${results.length} valid)`, percent);
    }
    
    return results.slice(0, limit);
};


// --- EXPORTED FUNCTION ---

export const scrapeMedia = async (
  rawUrl: string,
  mediaType: MediaType,
  limit: number,
  minSizeMB: number,
  useProxy: boolean,
  retryCount: number,
  smartRetry: boolean,
  useDeepScraping: boolean,
  onProgress: (msg: string, progress: number) => void
): Promise<{ media: ScrapedMedia[]; pageText: string }> => {
  const targetUrl = normalizeUrl(rawUrl);
  let hostname = targetUrl;
  try { hostname = new URL(targetUrl).hostname; } catch (e) {}

  // --- STRATEGY: Simple First, Fallback to Deep ---
  
  // 1. Determine Initial Mode
  // If user explicitly checked "Deep Scan", we start with Deep.
  // Otherwise, we start with Simple (Fast).
  let mode = useDeepScraping ? 'DEEP' : 'SIMPLE';
  let candidates = new Set<string>();
  
  onProgress(`Connecting to ${hostname} (${mode === 'DEEP' ? 'Deep' : 'Fast'} Mode)...`, 10);

  try {
      candidates = await findCandidateUrls(targetUrl, mediaType, useProxy, mode === 'DEEP', (msg) => onProgress(msg, 20));
  } catch (e) {
      if (mode === 'DEEP') throw e; // If Deep fails, we really failed.
      console.warn("Simple scrape failed, attempting Deep Fallback...", e);
  }

  // 2. Fallback Logic
  // If we were in Simple mode and found NOTHING (or crashed), automatically trigger Deep Scan.
  if (mode === 'SIMPLE' && candidates.size === 0) {
      onProgress('Simple scan found no results. Attempting Deep Scan...', 25);
      try {
          // Switch to Deep Mode
          candidates = await findCandidateUrls(targetUrl, mediaType, useProxy, true, (msg) => onProgress(msg, 30));
      } catch (e) {
          throw new Error("Deep scan also failed to connect.");
      }
  }

  // 3. Process & Filter
  const finalResults = await processCandidates(
      candidates, 
      limit, 
      minSizeMB, 
      useProxy, 
      mediaType, 
      onProgress
  );

  onProgress('Finalizing...', 100);
  return { media: finalResults, pageText: '' };
};
