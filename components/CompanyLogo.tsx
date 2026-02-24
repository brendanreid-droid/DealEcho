
import React, { useState } from 'react';

interface CompanyLogoProps {
  name: string;
  logoUrl?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const CompanyLogo: React.FC<CompanyLogoProps> = ({ name, logoUrl, className = '', size = 'md' }) => {
  const [error, setError] = useState(false);

  // Deterministic colors based on name
  const getGradient = (str: string) => {
    const gradients = [
      'from-indigo-500 to-blue-600',
      'from-emerald-500 to-teal-600',
      'from-rose-500 to-pink-600',
      'from-amber-500 to-orange-600',
      'from-violet-500 to-purple-600',
      'from-cyan-500 to-blue-500',
      'from-slate-700 to-slate-900',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  const sizeClasses = {
    sm: 'w-8 h-8 text-[10px] rounded-lg',
    md: 'w-12 h-12 text-sm rounded-xl',
    lg: 'w-16 h-16 text-lg rounded-2xl',
    xl: 'w-32 h-32 text-4xl rounded-[32px]',
  };

  if (logoUrl && !error) {
    return (
      <div className={`${sizeClasses[size]} overflow-hidden flex-shrink-0 bg-white border border-slate-100 flex items-center justify-center ${className}`}>
        <img
          src={logoUrl}
          alt={name}
          className="w-full h-full object-contain p-2"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} flex-shrink-0 bg-gradient-to-br ${getGradient(name)} flex items-center justify-center font-black text-white shadow-inner ${className}`}
    >
      {initials}
    </div>
  );
};

export default CompanyLogo;
