import React, { useState } from 'react';
import { MediaType, ScrapedMedia, DownloadItemState } from '../types';
import { CheckCircle, Circle, PlayCircle, FileImage, ExternalLink, LayoutGrid, List, FileVideo, Film, Check, XCircle } from 'lucide-react';

interface Props {
  media: ScrapedMedia[];
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  toggleAll: () => void;
  mediaType: MediaType;
  downloadStates: Record<string, DownloadItemState>;
}

type ViewMode = 'grid' | 'list';

const MediaGrid: React.FC<Props> = ({ media, selectedIds, toggleSelection, toggleAll, mediaType, downloadStates }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg m-6 bg-gray-50">
        <div className="mb-2 opacity-50">
             <FileImage size={40} />
        </div>
        <p className="font-bold text-gray-600 text-sm">No items to display.</p>
        <p className="text-xs">Start a scrape to see results.</p>
      </div>
    );
  }

  const allSelected = media.length > 0 && selectedIds.size === media.length;

  const formatSize = (bytes?: number) => {
    if (!bytes) return '-';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  const truncateUrl = (url: string) => {
      try {
          const urlObj = new URL(url);
          const name = urlObj.pathname.split('/').pop() || urlObj.hostname;
          return name.length > 40 ? name.substring(0, 40) + '...' : name;
      } catch (e) {
          return url.length > 40 ? url.substring(0, 40) + '...' : url;
      }
  };

  const getDownloadOverlay = (state?: DownloadItemState) => {
      if (!state) return null;

      if (state.status === 'pending' || state.status === 'downloading') {
          return (
              <div className="absolute inset-0 bg-white bg-opacity-80 z-20 flex flex-col items-center justify-center border border-gray-300">
                  <div className="w-16 h-4 border border-gray-400 bg-gray-200 mt-2">
                     <div className="h-full bg-blue-500" style={{ width: `${state.progress}%` }}></div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-600 mt-1">
                      {state.progress}%
                  </span>
              </div>
          );
      }
      if (state.status === 'complete') {
          return (
              <div className="absolute inset-0 bg-green-50 z-20 flex items-center justify-center border border-green-300 bg-opacity-90">
                  <div className="text-green-700 flex flex-col items-center">
                      <Check size={24} />
                      <span className="text-xs font-bold">SAVED</span>
                  </div>
              </div>
          );
      }
      if (state.status === 'error') {
          return (
              <div className="absolute inset-0 bg-red-50 z-20 flex items-center justify-center border border-red-300 bg-opacity-90">
                  <div className="text-red-700 flex flex-col items-center">
                      <XCircle size={24} />
                      <span className="text-xs font-bold">ERROR</span>
                  </div>
              </div>
          );
      }
      return null;
  };

  return (
    <div className="px-4 py-4 max-w-5xl mx-auto">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4 bg-gray-200 border border-gray-400 p-2 rounded-sm shadow-sm">
        <div className="flex items-center gap-3">
             <h2 className="text-sm font-bold text-gray-700 pl-2">
             Results: {media.length} items
             </h2>
             <div className="h-5 w-px bg-gray-400"></div>
             <div className="flex items-center gap-0">
                 <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-1 border border-gray-400 ${viewMode === 'grid' ? 'bg-gray-100 shadow-inner' : 'bg-white hover:bg-gray-50'}`}
                    title="Grid View"
                 >
                     <LayoutGrid size={16} className="text-gray-600" />
                 </button>
                 <button 
                    onClick={() => setViewMode('list')}
                    className={`p-1 border border-l-0 border-gray-400 ${viewMode === 'list' ? 'bg-gray-100 shadow-inner' : 'bg-white hover:bg-gray-50'}`}
                    title="List View"
                 >
                     <List size={16} className="text-gray-600" />
                 </button>
             </div>
        </div>
        
        <button
          onClick={toggleAll}
          className="text-xs font-bold text-gray-700 hover:text-black border border-gray-400 bg-gradient-to-b from-white to-gray-200 hover:from-gray-100 hover:to-gray-300 px-3 py-1 rounded-sm shadow-sm active:translate-y-[1px]"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {viewMode === 'grid' ? (
        /* Grid View - Polaroid Style */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {media.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const downloadState = downloadStates[item.id];

            return (
                <div
                key={item.id}
                onClick={() => toggleSelection(item.id)}
                className={`group relative p-1 bg-white border cursor-pointer select-none transition-none ${
                    isSelected 
                        ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' 
                        : 'border-gray-300 shadow-sm hover:border-gray-500'
                }`}
                >
                {/* Download Status Overlay */}
                {getDownloadOverlay(downloadState)}

                {/* Thumbnail Frame */}
                <div className="aspect-square bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden relative">
                    {item.type === MediaType.VIDEO ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                         <video 
                            src={item.url} 
                            className="w-full h-full object-contain opacity-80" 
                            muted 
                         />
                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <PlayCircle className="text-white opacity-80" size={32} />
                         </div>
                    </div>
                    ) : (
                        <img
                            src={item.url}
                            alt="scraped"
                            className={`w-full h-full ${item.extension === 'svg' ? 'object-contain p-2' : 'object-cover'}`}
                            loading="lazy"
                            onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Error';
                            }}
                        />
                    )}
                    
                    {/* Checkbox (Always visible if selected, or on hover) */}
                    <div className={`absolute top-1 right-1 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                         {isSelected ? (
                            <CheckCircle className="text-blue-600 bg-white rounded-full border border-white" size={20} />
                         ) : (
                            <Circle className="text-white fill-black/50" size={20} />
                         )}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-2 px-1 pb-1">
                    <div className="flex justify-between items-end">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">{item.extension}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{formatSize(item.sizeBytes)}</span>
                    </div>
                    <div className="border-t border-gray-100 mt-1 pt-1 flex justify-between">
                         <span className="text-[10px] text-gray-600 truncate w-20" title={item.url}>{item.id}</span>
                         <a href={item.url} target="_blank" className="text-blue-500 hover:underline text-[10px] flex items-center">
                            OPEN <ExternalLink size={8} className="ml-1" />
                         </a>
                    </div>
                </div>
                </div>
            );
            })}
        </div>
      ) : (
        /* List View - File Explorer Style */
        <div className="bg-white border border-gray-300 shadow-sm">
             <div className="flex bg-gray-100 border-b border-gray-300 p-2 text-xs font-bold text-gray-600">
                 <div className="w-10 text-center">Sel</div>
                 <div className="w-12 text-center">Type</div>
                 <div className="flex-1 px-2">Filename / URL</div>
                 <div className="w-20 text-right px-2">Size</div>
                 <div className="w-16 text-center">Link</div>
             </div>
             <div className="divide-y divide-gray-200">
            {media.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const downloadState = downloadStates[item.id];

                return (
                    <div 
                        key={item.id}
                        onClick={() => toggleSelection(item.id)}
                        className={`flex items-center p-1 hover:bg-blue-50 cursor-pointer ${
                            isSelected ? 'bg-blue-100' : ''
                        }`}
                    >
                        {/* Checkbox */}
                        <div className="w-10 flex justify-center">
                            <input type="checkbox" checked={isSelected} readOnly className="h-4 w-4 text-blue-600" />
                        </div>

                        {/* Thumbnail/Icon */}
                        <div className="w-12 flex justify-center">
                             {item.type === MediaType.VIDEO ? (
                                <Film size={16} className="text-gray-500" />
                             ) : (
                                <img 
                                    src={item.url} 
                                    className="w-8 h-8 object-cover border border-gray-300 bg-gray-50"
                                    alt="" 
                                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                                />
                             )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 px-2 flex flex-col justify-center">
                            <p className="text-xs text-gray-800 truncate font-medium">{truncateUrl(item.url)}</p>
                            {downloadState && (
                                <div className="text-[10px] text-blue-600 font-bold">
                                    {downloadState.status.toUpperCase()} ({downloadState.progress}%)
                                </div>
                            )}
                        </div>

                        {/* Size */}
                        <div className="w-20 text-right px-2 text-xs text-gray-600 font-mono">
                             {formatSize(item.sizeBytes)}
                        </div>

                        {/* Action */}
                        <div className="w-16 flex justify-center">
                            <a 
                                href={item.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                );
            })}
            </div>
        </div>
      )}
    </div>
  );
};

export default MediaGrid;