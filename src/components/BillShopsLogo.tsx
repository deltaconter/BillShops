import React from 'react';

interface BillShopsLogoProps {
  subtitle?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BillShopsLogo: React.FC<BillShopsLogoProps> = ({
  subtitle,
  className = '',
  size = 'md',
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Shopping Bag Icon with purple gradient */}
      <div className="relative shrink-0 flex items-center justify-center">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6D28D9] via-[#8B5CF6] to-[#C084FC] p-[1.5px] shadow-md shadow-purple-900/40">
          <div className="w-full h-full bg-[#16122d] rounded-[10px] flex items-center justify-center relative overflow-hidden">
            {/* Ambient light glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-indigo-600/10 pointer-events-none" />
            
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 text-purple-300 relative z-10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
        </div>
      </div>

      {/* Brand Name & Subtitle */}
      <div className="flex flex-col text-left">
        <div className="flex items-center leading-none text-lg font-extrabold tracking-tight">
          <span className="text-white">Bill</span>
          <span className="text-purple-400">Shops</span>
        </div>
        {subtitle && (
          <span className="text-[11px] font-medium text-slate-400 leading-tight mt-0.5">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
