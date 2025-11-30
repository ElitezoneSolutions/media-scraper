import React from 'react';
import { MediaType, ScrapeConfig, ScrapingStatus } from '../types';
import { Globe, Layers, ShieldCheck, RefreshCw, Zap } from 'lucide-react';

interface Props {
  config: ScrapeConfig;
  setConfig: React.Dispatch<React.SetStateAction<ScrapeConfig>>;
  onScrape: () => void;
  status: ScrapingStatus;
}

const ControlPanel: React.FC<Props> = ({ config, setConfig, onScrape, status }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    let newValue: any = value;
    if (type === 'checkbox') {
        newValue = (e.target as HTMLInputElement).checked;
    } else if (name === 'limit' || name === 'minSizeMB' || name === 'retryCount') {
        newValue = Number(value);
    }

    setConfig(prev => ({
      ...prev,
      [name]: newValue,
    }));
  };

  return (
    <div className="bg-gradient-to-b from-gray-100 to-gray-200 border-b border-gray-400 shadow-sm sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        
        {/* Header - Web 2.0 Style */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-300 pb-3 shadow-white drop-shadow-[0_1px_0_rgba(255,255,255,1)]">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-xl font-bold text-gray-700 drop-shadow-[0_1px_0_rgba(255,255,255,1)]">
                MediaScrape <span className="text-gray-500 font-normal">v2.0</span>
              </h1>
            </div>
          </div>
          
          <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1 rounded border shadow-sm ${config.useProxy ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>
             <Globe size={12} />
             <span>{config.useProxy ? 'Proxy ON' : 'Direct Connection'}</span>
          </div>
        </div>

        {/* Toolbar / Control Bar */}
        <div className="bg-gray-50 border border-gray-400 p-3 rounded shadow-inner">
          <div className="flex flex-col md:flex-row gap-3">
            
            {/* URL Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                name="targetUrl"
                placeholder="http://www.example.com"
                value={config.targetUrl}
                onChange={handleChange}
                disabled={status.isScraping}
                autoComplete="off"
                className="block w-full pl-3 pr-3 py-1.5 border border-gray-400 rounded-sm bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] text-sm font-sans"
              />
            </div>

            {/* Type Selector - Old School Select */}
            <div className="w-full md:w-32">
               <select
                name="mediaType"
                value={config.mediaType}
                onChange={handleChange}
                disabled={status.isScraping}
                className="block w-full py-1.5 px-2 border border-gray-400 rounded-sm bg-gradient-to-b from-white to-gray-100 text-gray-800 focus:outline-none focus:border-blue-500 text-sm shadow-sm"
              >
                <option value={MediaType.IMAGE}>Images</option>
                <option value={MediaType.VIDEO}>Videos</option>
                <option value={MediaType.SVG}>Icons/SVG</option>
              </select>
            </div>

            {/* Filters Group */}
            <div className="flex gap-2">
                <div className="flex items-center gap-1 bg-white border border-gray-400 rounded-sm px-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Limit:</span>
                    <input
                    type="number"
                    name="limit"
                    min="1"
                    max="500"
                    value={config.limit}
                    onChange={handleChange}
                    disabled={status.isScraping}
                    className="w-12 text-sm text-gray-800 outline-none bg-transparent py-1.5"
                    />
                </div>
                <div className="flex items-center gap-1 bg-white border border-gray-400 rounded-sm px-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Min MB:</span>
                    <input
                    type="number"
                    name="minSizeMB"
                    min="0"
                    step="0.1"
                    value={config.minSizeMB}
                    onChange={handleChange}
                    disabled={status.isScraping}
                    className="w-12 text-sm text-gray-800 outline-none bg-transparent py-1.5"
                    />
                </div>
            </div>

            {/* Action Button - Glossy Blue */}
            <button
              onClick={onScrape}
              disabled={status.isScraping || !config.targetUrl}
              className={`px-6 py-1.5 rounded font-bold text-white text-sm shadow border transition-all active:translate-y-[1px] ${
                  status.isScraping
                  ? 'bg-gray-400 border-gray-500 cursor-not-allowed text-gray-200'
                  : 'glossy-blue border-blue-700 hover:brightness-110'
              }`}
            >
              {status.isScraping ? 'Working...' : 'Scrape'}
            </button>
          </div>
        </div>

        {/* Progress Bar - Striped */}
        {status.isScraping && (
            <div className="border border-gray-400 p-1 bg-white rounded-sm shadow-sm">
                <div className="flex justify-between text-[10px] font-bold text-gray-600 mb-1 px-1">
                    <span>STATUS: {status.message.toUpperCase()}</span>
                    <span>{status.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 h-3 border border-gray-300 rounded-sm overflow-hidden relative">
                    <div 
                        className={`h-full transition-all duration-300 ${status.message.includes('failed') ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ 
                            width: `${status.progress}%`,
                            backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)',
                            backgroundSize: '1rem 1rem'
                        }}
                    />
                </div>
            </div>
        )}
        
        {/* Advanced Settings - Fieldset Style (Always Visible) */}
        <div className="pt-2">
            <fieldset className="border border-gray-300 bg-white p-3 rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <legend className="text-xs font-bold text-gray-500 px-2">Configuration</legend>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            name="useDeepScraping" 
                            checked={config.useDeepScraping} 
                            onChange={handleChange} 
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-1">
                            <Layers size={14} className="text-gray-500" />
                            <span className="text-xs font-bold text-gray-700">Deep Scan Mode</span>
                        </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            name="useProxy" 
                            checked={config.useProxy} 
                            onChange={handleChange} 
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                            <div className="flex items-center gap-1">
                            <ShieldCheck size={14} className="text-gray-500" />
                            <span className="text-xs font-bold text-gray-700">Use Proxy</span>
                        </div>
                    </label>

                    <label className="flex items-center gap-2">
                            <RefreshCw size={14} className="text-gray-500" />
                            <span className="text-xs font-bold text-gray-700">Retries:</span>
                            <input 
                            type="number" 
                            name="retryCount" 
                            min="0" max="10" 
                            value={config.retryCount} 
                            onChange={handleChange} 
                            className="w-10 text-xs border border-gray-300 rounded-sm px-1 py-0.5"
                            />
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                            type="checkbox" 
                            name="smartRetry" 
                            checked={config.smartRetry} 
                            onChange={handleChange} 
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-1">
                            <Zap size={14} className="text-gray-500" />
                            <span className="text-xs font-bold text-gray-700">Smart Fallback</span>
                        </div>
                    </label>
                </div>
            </fieldset>
        </div>

      </div>
    </div>
  );
};

export default ControlPanel;