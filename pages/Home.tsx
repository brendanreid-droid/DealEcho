
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Review } from '../types';
import CompanyLogo from '../components/CompanyLogo';

interface HomeProps {
  user: any;
  isPaid: boolean;
  onSignInClick: () => void;
  reviews: Review[];
  trackedIds: string[];
  onToggleTrack: (id: string) => void;
  isLoading?: boolean;
}

const Home: React.FC<HomeProps> = ({ user, isPaid, onSignInClick, reviews, trackedIds, onToggleTrack, isLoading }) => {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search)}`);
    }
  };

  const companyStats = useMemo(() => {
    const stats: Record<string, any> = {};
    
    reviews.forEach(review => {
      const name = review.companyName;
      if (!stats[name]) {
        stats[name] = {
          id: review.companyId,
          name: review.companyName,
          industry: review.industry,
          location: review.location,
          count: 0,
          respTotal: 0,
          negTotal: 0,
          wasteTotal: 0,
          scopeTotal: 0,
          lastDate: review.createdAt,
          content: review.content
        };
      }
      
      stats[name].count++;
      stats[name].respTotal += review.communicationRating;
      stats[name].negTotal += review.negotiationLevel;
      stats[name].wasteTotal += review.timeWasterLevel;
      stats[name].scopeTotal += (review.clarityOfScope || 3);

      if (new Date(review.createdAt) > new Date(stats[name].lastDate)) {
        stats[name].lastDate = review.createdAt;
        stats[name].content = review.content;
      }
    });

    return Object.values(stats)
      .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
      .slice(0, 6)
      .map(c => {
        const avgResp = (c.respTotal / c.count);
        const avgNeg = (c.negTotal / c.count);
        const avgWaste = (c.wasteTotal / c.count);
        const avgScope = (c.scopeTotal / c.count);
        
        const domain = c.name.toLowerCase().replace(/\s/g, '').replace(/\./g, '') + '.com';
        const healthIndex = Math.round(((avgResp + avgNeg + avgWaste + avgScope) / 20) * 100);

        return {
          id: c.id,
          name: c.name,
          industry: c.industry,
          reports: c.count,
          desc: c.content,
          location: c.location,
          logoUrl: `https://logo.clearbit.com/${domain}`,
          website: `https://${domain}`,
          displayWebsite: domain,
          healthIndex,
          metrics: { 
            resp: avgResp.toFixed(1), 
            negot: avgNeg.toFixed(1), 
            waste: avgWaste.toFixed(1),
            scope: avgScope.toFixed(1)
          }
        };
      });
  }, [reviews]);

  return (
    <div className="pb-20 bg-slate-100 min-h-screen">
      <section className="bg-[#101426] text-white pt-20 pb-24 md:pt-28 md:pb-32 px-4 sm:px-6 text-center">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 md:mb-8 tracking-tight leading-[1.1]">
            An <span className="text-[#818cf8]">Intelligence Layer</span> to your Sales Cycle.
          </h1>
          <p className="text-lg md:text-[22px] text-slate-300 mb-10 md:mb-14 max-w-3xl mx-auto leading-relaxed opacity-90 font-medium">
            Real-time insights from 500+ verified enterprise sales cycles.
          </p>

          <form onSubmit={handleSearch} className="max-w-[720px] mx-auto relative group">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">
              <i className="fas fa-search text-lg md:text-xl"></i>
            </div>
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for a prospect or industry..."
              className="w-full bg-white text-slate-900 rounded-2xl py-4 md:py-6 pr-6 pl-14 md:pl-16 text-base md:text-xl focus:outline-none shadow-[0_12px_48px_-12px_rgba(0,0,0,0.15)] transition"
            />
          </form>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 mt-12 md:mt-16">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-12">
          <div>
            <h2 className="text-2xl md:text-[32px] font-bold text-[#1e293b]">Live Buyer Intel</h2>
            <p className="text-slate-500 mt-1 md:mt-2 text-base md:text-lg font-medium">Recently analysed accounts from the DealEcho community.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-bold text-sm uppercase tracking-[0.2em]">Syncing Intelligence Feed...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {companyStats.map((company) => (
              <CompanyCard 
                key={company.name} 
                company={company} 
                user={user}
                onSignInClick={onSignInClick}
                isPro={isPaid}
                isTracked={trackedIds.includes(company.id)}
                onToggleTrack={() => onToggleTrack(company.id)}
                onClick={() => navigate(`/company/${encodeURIComponent(company.id)}`, { state: { company } })} 
              />
            ))}
            {companyStats.length === 0 && (
              <div className="col-span-full text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
                <i className="fas fa-database text-4xl text-slate-200 mb-4 block"></i>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No Recent Activity Found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CompanyCard: React.FC<{ 
  company: any, 
  onClick: () => void, 
  user: any,
  onSignInClick: () => void,
  isPro: boolean, 
  isTracked: boolean, 
  onToggleTrack: () => void 
}> = ({ company, onClick, user, onSignInClick, isPro, isTracked, onToggleTrack }) => {
  const [isScoreHovered, setIsScoreHovered] = useState(false);

  const handleTrackClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      onSignInClick();
    } else {
      onToggleTrack();
    }
  };

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-[28px] md:rounded-[32px] border border-slate-200 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.05)] p-6 md:p-8 flex flex-col hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group relative hover:z-[100]"
    >
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center space-x-3 md:space-x-4">
          <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="lg" className="group-hover:scale-105 transition shadow-sm border border-slate-100" />
          <div>
            <h3 className="text-lg md:text-xl font-bold text-[#1e293b] leading-tight group-hover:text-indigo-600 transition-colors">{company.name}</h3>
            <div className="flex flex-col mt-1">
              <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">{company.industry}</p>
              <span className="text-[10px] font-bold text-indigo-500 flex items-center mt-0.5">
                <i className="fas fa-link text-[8px] mr-1.5 opacity-60"></i>
                {company.displayWebsite}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end space-y-2 relative">
          <div 
            className="bg-[#101426] text-white px-3 py-2 rounded-xl flex flex-col items-center min-w-[65px] shadow-lg text-center border-t-2 border-t-indigo-500 relative cursor-help"
            onMouseEnter={() => setIsScoreHovered(true)}
            onMouseLeave={() => setIsScoreHovered(false)}
          >
            <span className="text-[7px] font-black uppercase tracking-tighter opacity-60">Score</span>
            <span className="text-sm font-black text-indigo-400">{company.healthIndex}%</span>

            {/* Buyer Score Tooltip - Positioned BELOW to avoid collisions with sticky header */}
            {isScoreHovered && (
              <div className="absolute top-full right-0 mt-4 w-72 bg-slate-900 text-white p-6 rounded-[28px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] z-[110] animate-in fade-in slide-in-from-top-2 border border-white/10 text-left pointer-events-none">
                <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-indigo-400 mb-4 border-b border-white/5 pb-3">Buyer Intelligence Summary</h4>
                <p className="text-[10px] text-slate-300 leading-relaxed mb-5 font-medium">Aggregate account health based on {company.reports} verified deal mechanics:</p>
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <i className="fas fa-comments text-indigo-400 text-[10px]"></i>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Responsiveness</span>
                    </div>
                    <span className="text-[10px] font-black text-indigo-300">{company.metrics.resp}/5.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <i className="fas fa-handshake text-amber-400 text-[10px]"></i>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Negotiation ease</span>
                    </div>
                    <span className="text-[10px] font-black text-amber-300">{company.metrics.negot}/5.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <i className="fas fa-bullseye text-rose-400 text-[10px]"></i>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Buyer Intent</span>
                    </div>
                    <span className="text-[10px] font-black text-rose-300">{company.metrics.waste}/5.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <i className="fas fa-map text-emerald-400 text-[10px]"></i>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Scope Maturity</span>
                    </div>
                    <span className="text-[10px] font-black text-emerald-300">{company.metrics.scope}/5.0</span>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-white/5 text-[9px] font-black text-indigo-200 uppercase tracking-widest leading-relaxed">
                  Calculated from verified community reports.
                </div>
                {/* Upward pointing arrow */}
                <div className="absolute bottom-full right-8 w-4 h-4 bg-slate-900 rotate-45 -mt-2"></div>
              </div>
            )}
          </div>
          <button 
            onClick={handleTrackClick}
            className={`p-2 rounded-xl border transition-all ${
              !user ? 'bg-slate-50 border-slate-200 text-slate-300 hover:text-indigo-500 hover:bg-white hover:border-indigo-200' :
              isTracked ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-indigo-500 hover:bg-white hover:border-indigo-200'
            }`}
          >
            {/* If not logged in, show a lock icon to hint it's a gated feature */}
            <i className={`${!user ? 'fas fa-lock' : isTracked ? 'fas fa-bookmark' : 'far fa-bookmark'} text-sm md:text-lg`}></i>
          </button>
        </div>
      </div>

      <div className="relative mb-6 overflow-hidden rounded-xl">
        <div className={`text-slate-600 text-[13px] md:text-[14px] leading-relaxed line-clamp-2 transition-all duration-500 font-medium ${!isPro ? 'filter blur-md opacity-20 pointer-events-none' : ''}`}>
          {company.desc}
        </div>
        {!isPro && (
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="bg-slate-900 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center">
               <i className="fas fa-lock mr-2 text-[8px] text-indigo-400"></i>
               Pro Intel
             </div>
          </div>
        )}
      </div>

      <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
        <div className="flex -space-x-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center">
              <i className="fas fa-user text-[8px] text-slate-400"></i>
            </div>
          ))}
          <div className="pl-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{company.reports} Reports</div>
        </div>
        <span className="text-indigo-600 text-[11px] font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform">
          View <i className="fas fa-chevron-right ml-1"></i>
        </span>
      </div>
    </div>
  );
};

export default Home;
