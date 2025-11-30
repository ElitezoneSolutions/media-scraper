export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  SVG = 'SVG',
}

export interface ScrapedMedia {
  id: string;
  url: string;
  type: MediaType;
  sizeBytes?: number; // Size in bytes
  dimensions?: string; // e.g. "1920x1080"
  extension: string;
}

export interface ScrapeConfig {
  targetUrl: string;
  mediaType: MediaType;
  limit: number;
  minSizeMB: number;
  // Advanced Settings
  useProxy: boolean;
  retryCount: number;
  smartRetry: boolean; // The logic to wait 200ms and randomize proxy usage
  useDeepScraping: boolean; // Toggle between Simple and Deep scraping
}

export interface ScrapingStatus {
  isScraping: boolean;
  message: string;
  progress: number; // 0 to 100
  totalFound: number;
  filteredCount: number;
}

export interface DownloadItemState {
  status: 'idle' | 'pending' | 'downloading' | 'complete' | 'error';
  progress: number; // 0 to 100
}