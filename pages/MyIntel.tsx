
import React, { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Review } from '../types';
import CompanyLogo from '../components/CompanyLogo';

interface MyIntelProps {
  user: any;
  isPaid: boolean;
  reviews: Review[];
  trackedIds: string[];
  onToggleTrack: (id: string) => void;
  notifications: Record<string, number>;
  onClearNotification: (id: string) => void;
  onSignInClick?: () => void;
}

const MyIntel: React.FC<MyIntelProps> = ({ user, isPaid, reviews, trackedIds, onToggleTrack, notifications, onClearNotification, onSignInClick }) => {
  const navigate = useNavigate();

  // Hooks must be called before any early returns to satisfy the Rules of Hooks
  const trackedCompanies = useMemo(() => {
    const stats: Record<string, any> = {};
    reviews.forEach(review => {
      const id = review.companyId;
      if (!trackedIds.includes(id)) return;
      if (!stats[id]) {
        stats[id] = {
          id,
          name: review.companyName,
          industry: review.industry,
          count: 0,
          lastReviewDate: review.createdAt,
          logoUrl: `https://logo.clearbit.com/${review.companyName.toLowerCase().replace(/\s/g, '').replace(/\./g, '')}.com`
        };
      }
      stats[id].count++;
      if (new Date(review.createdAt) > new Date(stats[id].lastReviewDate)) {
        stats[id].lastReviewDate = review.createdAt;
      }
    });
    return Object.values(stats);
  }, [reviews, trackedIds]);

  // Unauthenticated "Vault" Screen (Unified Template)
  if (!user) {
    return (
      <div className="bg-[#101426] min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-indigo-500/5 blur-[120px] rounded-full"></div>
        <div className="max-w-xl w-full bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[48px] p-10 md:p-16 text-center space-y-10 relative z-10 shadow-2xl">
          <div className="w-20 h-20 bg-indigo-600 text-white rounded-[28px] flex items-center justify-center mx-auto text-3xl shadow-2xl border-b-4 border-indigo-700">
            <i className="fas fa-fingerprint"></i>
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase tracking-widest">My Intel</h1>
            <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed">
              Track target accounts, manage deal notifications, and monitor your personal intelligence contributions in your private vault.
            </p>
          </div>
          <button 
            onClick={onSignInClick}
            className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-900/40 hover:bg-indigo-500 transition-all flex items-center justify-center space-x-3"
          >
            <i className="fas fa-lock text-xs opacity-50"></i>
            <span>Sign In to Access</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#0f172a] p-10 rounded-[40px] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-indigo-500/10 blur-[100px] rounded-full"></div>
        <div className="flex items-center space-x-6 relative z-10">
          <img src={user.avatar} className="w-20 h-20 rounded-[28px] border-4 border-white/10" alt="avatar" />
          <div>
            <h1 className="text-3xl font-black tracking-tight">{user.name}</h1>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{user.email}</p>
          </div>
        </div>
        <div className="flex flex-col items-end relative z-10 space-y-2">
            <div className={`px-6 py-3 rounded-2xl text-center border ${isPaid ? 'bg-indigo-600/20 border-indigo-400/30' : 'bg-white/10 border-white/10'}`}>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan</div>
                <div className="text-sm font-black">{isPaid ? 'Sales Pro Member' : 'Pioneer Plan'}</div>
            </div>
            {!isPaid && (
                <Link to="/pricing" className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors">
                    Upgrade to Sales Pro
                </Link>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center">
                <i className="fas fa-bookmark text-indigo-500 mr-3"></i>
                Tracked Accounts
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {trackedIds.length} / {isPaid ? '∞' : '3'}
            </span>
          </div>
          
          <div className="space-y-4">
            {trackedCompanies.length > 0 ? trackedCompanies.map(c => (
              <div key={c.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative group">
                 {notifications[c.id] && <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-[9px] font-black px-2 py-1 rounded-lg">NEW</div>}
                 <div className="flex justify-between items-start mb-4">
                    <Link to={`/company/${c.id}`} className="flex items-center space-x-4 group-hover:text-indigo-600 transition-colors">
                      <CompanyLogo name={c.name} logoUrl={c.logoUrl} size="md" />
                      <div>
                        <h4 className="font-bold text-slate-900">{c.name}</h4>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{c.industry}</p>
                      </div>
                    </Link>
                    <button onClick={() => onToggleTrack(c.id)} className="text-slate-200 hover:text-rose-500"><i className="fas fa-times-circle"></i></button>
                 </div>
                 <div className="pt-4 border-t border-slate-50 flex justify-between">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{c.count} Reports</div>
                    <div className="text-[10px] font-bold text-indigo-500 uppercase">Active tracking</div>
                 </div>
              </div>
            )) : (
              <div className="bg-white p-12 rounded-[32px] border border-dashed border-slate-200 text-center space-y-4">
                <i className="fas fa-search text-slate-200 text-4xl"></i>
                <p className="text-slate-400 text-xs font-bold uppercase">No accounts tracked</p>
                <Link to="/" className="text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:underline">Start Searching</Link>
              </div>
            )}
            
            {!isPaid && trackedIds.length >= 3 && (
                <div className="p-6 bg-indigo-50 rounded-[28px] border border-indigo-100 space-y-4">
                    <div className="flex items-center space-x-3 text-indigo-600">
                        <i className="fas fa-crown text-sm"></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">Limit Reached</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        Upgrade to Sales Pro to track unlimited accounts and get AI-powered persona intelligence.
                    </p>
                    <Link to="/pricing" className="block text-center bg-indigo-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                        Upgrade Now
                    </Link>
                </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-[48px] p-12 border border-slate-100 flex flex-col items-center justify-center text-center space-y-6 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl shadow-inner flex items-center justify-center text-slate-200 text-3xl">
              <i className="fas fa-history"></i>
            </div>
            <div>
              <h4 className="text-2xl font-black text-slate-900 mb-2">Workspace History</h4>
              <p className="text-slate-500 text-sm max-w-sm mx-auto font-medium leading-relaxed">
                Your past reviews, account alerts, and data exports will appear here in chronological order.
              </p>
            </div>
            <Link to="/" className="bg-slate-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">Go to Global Feed</Link>
        </div>
      </div>
    </div>
  );
};

export default MyIntel;
