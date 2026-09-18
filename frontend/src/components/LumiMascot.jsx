import React from 'react';

export default function LumiMascot({ className = "w-6 h-6", alt = "Lumi AI Mascot" }) {
  return (
    <img 
      src="/lumi-avatar.png" 
      alt={alt} 
      className={`object-cover rounded-full select-none shrink-0 aspect-square ${className}`}
      loading="eager"
    />
  );
}
