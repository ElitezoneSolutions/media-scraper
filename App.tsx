import React, { useState } from 'react';
import ControlPanel from './components/ControlPanel';
import MediaGrid from './components/MediaGrid';
import { MediaType, ScrapeConfig, ScrapedMedia, ScrapingStatus, DownloadItemState } from './types';
import { scrapeMedia } from './services/scraperService';
import { Download, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [config, setConfig] = useState<ScrapeConfig>({
    targetUrl: '',
    mediaType: MediaType.IMAGE,
    limit: 50,
    minSizeMB: 0,
    useProxy: true,
    retryCount: 3,
    smartRetry: true,
    useDeepScraping: false,
  });

  const [status, setStatus] = useState<ScrapingStatus>({
    isScraping: false,
    message: '',
    progress: 0,
    totalFound: 0,
    filteredCount: 0,
  });

  const [media, setMedia] = useState<ScrapedMedia[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadItemState>>({});

  const handleScrape = async () => {
    if (!config.targetUrl) return;
    
    setMedia([]);
    setSelectedIds(new Set());
    setError(null);
    setDownloadStates({});
    setStatus({
      isScraping: true,
      message: 'Initializing...',
      progress: 5,
      totalFound: 0,
      filteredCount: 0
    });

    try {
      const { media: results } = await scrapeMedia(
        config.targetUrl,
        config.mediaType,
        config.limit,
        config.minSizeMB,
        config.useProxy,
        config.retryCount,
        config.smartRetry,
        config.useDeepScraping,
        (msg, progress) => setStatus(prev => ({ ...prev, message: msg, progress }))
      );

      setMedia(results);
      setStatus(prev => ({ ...prev, isScraping: false, progress: 100 }));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStatus(prev => ({ 
          ...prev, 
          isScraping: false, 
          message: 'Error Occurred', 
      }));
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === media.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(media.map(m => m.id)));
    }
  };

  const downloadFile = async (item: ScrapedMedia) => {
    const updateState = (status: DownloadItemState['status'], progress: number) => {
      setDownloadStates(prev => ({
        ...prev,
        [item.id]: { status, progress }
      }));
    };

    updateState('pending', 0);

    try {
      let response: Response;
      
      try {
        response = await fetch(item.url);
        if (!response.ok) throw new Error('Direct fetch failed');
      } catch (e) {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(item.url)}`;
        response = await fetch(proxyUrl);
      }

      if (!response.ok) throw new Error('Network response was not ok');
      if (!response.body) throw new Error('ReadableStream not supported');

      const contentLength = Number(response.headers.get('Content-Length'));
      const reader = response.body.getReader();
      
      let receivedLength = 0;
      const chunks = [];

      updateState('downloading', 0);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        let percent = 0;
        if (contentLength && contentLength > 0) {
            percent = Math.round((receivedLength / contentLength) * 100);
        } else {
            percent = Math.min(90, Math.floor(receivedLength / 102400) * 10);
        }
        
        updateState('downloading', percent);
      }

      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      
      let ext = item.extension.replace(/[^a-z0-9]/gi, '') || 'bin';
      if (item.url.includes('.m3u8')) ext = 'm3u8';
      
      a.download = `media_${item.id.substring(0,6)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      updateState('complete', 100);

      setTimeout(() => {
          setDownloadStates(prev => {
              const next = { ...prev };
              delete next[item.id];
              return next;
          });
      }, 3000);

    } catch (error) {
      console.error("Download failed for", item.url, error);
      updateState('error', 0);
      setTimeout(() => {
        setDownloadStates(prev => {
            const next = { ...prev };
            delete next[item.id];
            return next;
        });
      }, 5000);
    }
  };

  const handleDownload = async () => {
    const selectedMedia = media.filter(m => selectedIds.has(m.id));
    if (selectedMedia.length === 0) return;

    const BATCH_SIZE = 3;
    for (let i = 0; i < selectedMedia.length; i += BATCH_SIZE) {
        const batch = selectedMedia.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(item => downloadFile(item)));
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <ControlPanel
        config={config}
        setConfig={setConfig}
        onScrape={handleScrape}
        status={status}
      />

      <main className="flex-1 w-full pb-20">
        {/* Vintage Error Box */}
        {error && (
          <div className="max-w-5xl mx-auto px-4 mt-4">
            <div className="bg-red-50 border border-red-300 text-red-800 p-3 rounded-sm flex items-start gap-3 shadow-sm">
               <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
               <div>
                   <h4 className="font-bold text-sm">System Alert</h4>
                   <p className="text-sm">{error}</p>
                   <p className="text-xs mt-1 text-red-600 font-mono">CODE: CONNECT_FAIL_0X1</p>
               </div>
            </div>
          </div>
        )}

        <MediaGrid
          media={media}
          selectedIds={selectedIds}
          toggleSelection={toggleSelection}
          toggleAll={toggleAll}
          mediaType={config.mediaType}
          downloadStates={downloadStates}
        />
      </main>

      {/* Fixed Footer Bar / Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-200 border-t border-gray-400 p-3 shadow-[0_-2px_5px_rgba(0,0,0,0.1)] z-50">
           <div className="max-w-5xl mx-auto flex justify-between items-center">
              <div className="text-sm font-bold text-gray-700">
                  <span className="bg-white border border-gray-400 px-2 py-1 rounded-sm shadow-inner">{selectedIds.size}</span>
                  <span className="ml-2">files selected</span>
              </div>
              <button
                onClick={handleDownload}
                className="glossy-blue border-blue-800 text-white font-bold px-6 py-2 rounded shadow-sm flex items-center gap-2 active:translate-y-[1px]"
              >
                <Download size={16} />
                START DOWNLOAD
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;