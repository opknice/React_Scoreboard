// Test Component: Tailwind CSS Integration
// This component demonstrates Tailwind working alongside existing CSS

import React from 'react';

export const TailwindTestCard: React.FC = () => {
  return (
    <div className="max-w-md mx-auto my-4 p-6 bg-gradient-to-br from-accent to-accent-hover rounded-card shadow-xl">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center">
          <svg 
            className="w-6 h-6 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M5 13l4 4L19 7" 
            />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Tailwind CSS ติดตั้งสำเร็จ! 🎉</h3>
          <p className="text-sm text-white/80">Integration Test Component</p>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
          <p className="text-white font-medium mb-2">✅ Tailwind Utilities Working</p>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-success text-white text-xs rounded-full">Responsive</span>
            <span className="px-3 py-1 bg-warning text-white text-xs rounded-full">Colors</span>
            <span className="px-3 py-1 bg-danger text-white text-xs rounded-full">Utilities</span>
          </div>
        </div>
        
        <div className="p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
          <p className="text-white font-medium mb-2">✅ Custom Theme Colors</p>
          <div className="grid grid-cols-4 gap-2">
            <div className="h-8 bg-accent rounded"></div>
            <div className="h-8 bg-success rounded"></div>
            <div className="h-8 bg-warning rounded"></div>
            <div className="h-8 bg-danger rounded"></div>
          </div>
        </div>

        <div className="p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
          <p className="text-white font-medium mb-2">✅ Existing CSS Still Works</p>
          <button className="btn-primary mr-2">Old Style Button</button>
          <button className="px-4 py-2 bg-success hover:bg-success-hover text-white rounded-lg transition-all duration-200 hover:scale-105">
            Tailwind Button
          </button>
        </div>
      </div>

      <div className="mt-4 p-3 bg-card-bg rounded-lg border border-border">
        <p className="text-text-muted text-xs text-center">
          CSS Variables + Tailwind = Perfect Harmony ✨
        </p>
      </div>
    </div>
  );
};

export default TailwindTestCard;
