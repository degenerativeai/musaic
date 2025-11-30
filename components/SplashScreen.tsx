import React, { useState } from 'react';
import { IconMusaic, IconKey, IconArrowRight } from './Icons';

interface SplashScreenProps {
  onComplete: (key: string | null) => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState('');

  const handleEnter = () => {
    if (!inputKey.trim()) {
      setError('Please enter a valid API key');
      return;
    }
    sessionStorage.setItem('gemini_api_key', inputKey.trim());
    onComplete(inputKey.trim());
  };

  const handleSkip = () => {
    // Skip mode: No key saved. App will load in limited/preview state.
    onComplete(null);
  };

  return (
    <div className="fixed inset-0 bg-obsidian flex flex-col items-center justify-center p-6 z-50">
      <div className="w-full max-w-md space-y-12 animate-fade-in-up">
        
        {/* Logo Section */}
        <div className="flex flex-col items-center gap-4 group cursor-default">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 bg-musaicPurple/20 blur-xl rounded-full"></div>
            <IconMusaic className="w-24 h-24 relative z-10 transition-transform duration-300 group-hover:scale-105 glitch-hover" />
          </div>
          <h1 className="text-4xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-musaicPurple to-musaicGold">
            MUSAIC
          </h1>
          <p className="text-gray-500 font-mono text-sm tracking-widest uppercase">
            Dataset Architect
          </p>
        </div>

        {/* Auth Section */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <IconKey className="w-3 h-3 text-musaicGold" />
              Gemini API Key
            </label>
            <div className="relative group">
              <input
                type="password"
                value={inputKey}
                onChange={(e) => {
                    setInputKey(e.target.value);
                    setError('');
                }}
                placeholder="sk-..."
                className="w-full bg-charcoal border border-gray-800 rounded-xl px-4 py-4 text-white placeholder-gray-600 focus:border-musaicPurple focus:ring-1 focus:ring-musaicPurple outline-none transition-all font-mono text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-musaicPurple/10 to-musaicGold/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500" />
            </div>
            {error && <p className="text-xs text-red-500 font-mono animate-fade-in">{error}</p>}
          </div>

          <button
            onClick={handleEnter}
            className="w-full py-4 bg-gradient-to-r from-musaicPurple to-blue-600 hover:from-musaicPurple hover:to-blue-500 text-white rounded-xl font-bold tracking-widest uppercase text-xs transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            Authenticate Session
            <IconArrowRight className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
             <button 
               onClick={handleSkip}
               className="text-xs text-gray-500 hover:text-gray-300 transition-colors font-mono"
             >
               Skip (Demo Mode)
             </button>
             <a 
               href="https://aistudio.google.com/app/apikey" 
               target="_blank" 
               rel="noreferrer"
               className="text-xs text-musaicGold hover:text-yellow-300 transition-colors font-mono flex items-center gap-1"
             >
               Get Key ↗
             </a>
          </div>
          
          <p className="text-[10px] text-gray-600 text-center leading-relaxed max-w-xs mx-auto">
            Your key is stored locally in session storage and is cleared when you close this tab. It is never sent to any server other than Google's API.
          </p>
        </div>
      </div>
    </div>
  );
};