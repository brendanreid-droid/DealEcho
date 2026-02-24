
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Review } from '../types';

interface GlobalTrendsProps {
  user: any;
  isPaid: boolean;
  reviews: Review[];
  onSignInClick?: () => void;
}

const DEPARTMENTS = [
  "IT / Engineering", "Security / InfoSec", "Data Privacy / DPO", "Procurement", "Finance / Treasury",
  "Legal / Compliance", "Executive Leadership (C-Suite)", "Marketing", "Sales / Business Development",
  "Operations / Enablement", "HR / People Ops", "Product Management", "Customer Success / Support",
  "Supply Chain / Logistics", "Facilities / Real Estate", "R&D / Innovation", "Strategy / Corporate Dev",
  "Quality Assurance / QA", "Regulatory / Gov Affairs", "External Consultants / Advisors", "Board of Directors"
];

const TCV_ORDER = ["< $10k", "$10k - $25k", "$25k - $50k", "$50k - $100k", "$100k - $250k", "$250k - $500k", "$500k - $750k", "$750k - $1M", "$1M+"];
const DURATION_ORDER = ["< 1 Month", "1-3 Months", "3-6 Months", "6-12 Months", "12+ Months"];

const GlobalTrends: React.FC<GlobalTrendsProps> = ({ user, isPaid, reviews, onSignInClick }) => {
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterTeam, setFilterTeam] = useState('all');

  const industries = useMemo(() => Array.from(new Set(reviews.map(r => r.industry))).sort(), [reviews]);

  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      const matchIndustry = filterIndustry === 'all' || r.industry === filterIndustry;
      const matchTeam = filterTeam === 'all' || r.buyingTeam.includes(filterTeam);
      return matchIndustry && matchTeam;
    });
  }, [reviews, filterIndustry, filterTeam]);

  const stats = useMemo(() => {
    const total = filteredReviews.length || 1;
    const wins = filteredReviews.filter(r => r.status === 'Won').length;

    const indMap: Record<string, { count: number, wins: number, respTotal: number, wasteTotal: number }> = {};
    filteredReviews.forEach(r => {
      if (!indMap[r.industry]) indMap[r.industry] = { count: 0, wins: 0, respTotal: 0, wasteTotal: 0 };
      indMap[r.industry].count++;
      indMap[r.industry].respTotal += r.communicationRating;
      indMap[r.industry].wasteTotal += r.timeWasterLevel;
      if (r.status === 'Won') indMap[r.industry].wins++;
    });

    const topIndustries = Object.entries(indMap)
      .map(([name, data]) => ({ 
        name, 
        count: data.count, 
        winRate: Math.round((data.wins / data.count) * 100),
        avgResp: (data.respTotal / data.count).toFixed(1),
        tireKickerScore: Math.round((data.wasteTotal / (data.count * 5)) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const matrix: Record<string, Record<string, { count: number, wins: number }>> = {};
    DURATION_ORDER.forEach(d => {
      matrix[d] = {};
      TCV_ORDER.forEach(t => { matrix[d][t] = { count: 0, wins: 0 }; });
    });

    filteredReviews.forEach(r => {
      if (matrix[r.cycleDuration] && matrix[r.cycleDuration][r.tcvBracket]) {
        matrix[r.cycleDuration][r.tcvBracket].count++;
        if (r.status === 'Won') matrix[r.cycleDuration][r.tcvBracket].wins++;
      }
    });

    const deptStats: Record<string, { count: number, friction: number }> = {};
    filteredReviews.forEach(r => {
      r.buyingTeam.forEach(t => {
        if (!deptStats[t]) deptStats[t] = { count: 0, friction: 0 };
        deptStats[t].count++;
        deptStats[t].friction += (6 - r.negotiationLevel);
      });
    });

    const departments = Object.entries(deptStats)
      .map(([name, data]) => ({ name, avgFriction: (data.friction / data.count).toFixed(1), count: data.count }))
      .sort((a, b) => parseFloat(b.avgFriction) - parseFloat(a.avgFriction));

    return { total: filteredReviews.length, winRate: Math.round((wins / total) * 100), topIndustries, matrix, departments };
  }, [filteredReviews]);

  // Unauthenticated "Vault" Screen (Unified)
  if (!user) {
    return (
      <div className="bg-[#101426] min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-indigo-500/5 blur-[120px] rounded-full"></div>
        <div className="max-w-xl w-full bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[48px] p-10 md:p-16 text-center space-y-10 relative z-10 shadow-2xl">
          <div className="w-20 h-20 bg-indigo-600 text-white rounded-[28px] flex items-center justify-center mx-auto text-3xl shadow-2xl border-b-4 border-indigo-700">
            <i className="fas fa-chart-pie"></i>
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase tracking-widest">Global Analytics</h1>
            <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed">
              Global benchmarks for win rates, department friction, and closing velocity are reserved for verified community members.
            </p>
          </div>
          <button 
            onClick={onSignInClick}
            className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-900/40 hover:bg-indigo-500 transition-all flex items-center justify-center space-x-3"
          >
            <i className="fas fa-lock text-xs opacity-50"></i>
            <span>Sign In to View</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-slate-100 min-h-screen">
      <section className="bg-[#101426] text-white pt-20 md:pt-24 pb-24 md:pb-32 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-indigo-500/10 blur-[120px] rounded-full -mr-32 -mt-32"></div>
        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl">
            <div className="flex items-center space-x-3 mb-6">
              <span className="bg-indigo-600/30 text-indigo-200 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full border border-indigo-500/20 backdrop-blur-md">
                <i className="fas fa-globe mr-2"></i>Global Trends
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-[1.1]">
              Global <span className="text-[#818cf8]">Sales Analytics</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-2xl opacity-80 font-medium">
              Real-time insights across 500+ enterprise sales cycles. Analyze friction and velocity to qualify your pipeline.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 -mt-10 relative z-20">
        <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-wrap gap-6 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Sector Benchmark</label>
            <select value={filterIndustry} onChange={(e) => setFilterIndustry(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-200 focus:bg-white rounded-xl px-5 py-4 text-sm font-bold text-slate-700 outline-none transition-all cursor-pointer">
              <option value="all">All Industries</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Department Persona</label>
            <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-200 focus:bg-white rounded-xl px-5 py-4 text-sm font-bold text-slate-700 outline-none transition-all cursor-pointer">
              <option value="all">All Departments</option>
              {DEPARTMENTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 mt-12 md:mt-20">
        {!isPaid ? (
          <div className="bg-white rounded-[48px] border-2 border-slate-200 shadow-xl overflow-hidden relative min-h-[600px]">
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xl z-30 flex flex-col items-center justify-center p-10 text-center">
                <div className="w-20 h-20 bg-[#101426] text-white rounded-[28px] flex items-center justify-center mb-8 text-2xl shadow-2xl border-b-4 border-indigo-500">
                  <i className="fas fa-crown"></i>
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Sales Pro Analytics Required</h3>
                <p className="text-slate-500 text-base max-w-md mx-auto mb-10 font-medium leading-relaxed">
                  Deep-dive friction maps, velocity matrices, and sector benchmarks are reserved for Sales Pro members.
                </p>
                <Link to="/pricing" className="bg-indigo-600 text-white px-12 py-5 rounded-[24px] font-black uppercase tracking-widest shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all">
                  Upgrade to Sales Pro
                </Link>
            </div>
            <div className="p-12 opacity-5 blur-2xl pointer-events-none select-none grayscale">
              <div className="grid grid-cols-4 gap-8 mb-12">
                <StatSummaryCard label="Reports" value="500" icon="fas fa-fingerprint" />
                <StatSummaryCard label="Win Rate" value="65%" icon="fas fa-trophy" />
                <StatSummaryCard label="Friction" value="3.2" icon="fas fa-handshake" />
                <StatSummaryCard label="Markets" value="20" icon="fas fa-globe" />
              </div>
              <div className="bg-slate-200 h-96 rounded-[40px]"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-12 md:space-y-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              <StatSummaryCard label="Verified Reports" value={stats.total} icon="fas fa-fingerprint" />
              <StatSummaryCard label="Global Win Rate" value={`${stats.winRate}%`} icon="fas fa-trophy" color="text-emerald-500" />
              <StatSummaryCard label="Legal Friction" value={stats.departments[0]?.avgFriction || '0'} icon="fas fa-handshake-simple" color="text-amber-500" />
              <StatSummaryCard label="Markets" value={industries.length} icon="fas fa-globe" color="text-indigo-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
              <div className="bg-[#101426] p-10 md:p-12 rounded-[40px] text-white shadow-2xl space-y-10 relative overflow-hidden border border-white/5">
                <div className="relative z-10">
                  <h3 className="text-2xl font-black mb-2 flex items-center">
                    <span className="w-3 h-3 bg-indigo-500 rounded-full mr-4"></span>
                    Friction Map
                  </h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Departmental Resistance Levels</p>
                </div>
                <div className="space-y-8 relative z-10">
                  {stats.departments.length > 0 ? stats.departments.slice(0, 6).map((dept) => (
                    <div key={dept.name} className="space-y-2.5">
                      <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest text-slate-300">
                        <span>{dept.name}</span>
                        <span className="text-indigo-400">{dept.avgFriction}/5.0</span>
                      </div>
                      <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-1000" style={{ width: `${(parseFloat(dept.avgFriction) / 5) * 100}%` }}></div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-slate-500 text-sm italic py-10 text-center border-2 border-dashed border-white/5 rounded-2xl">
                      No friction data for current filters.
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-[40px] border border-slate-200 p-8 md:p-12 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
                <h3 className="text-2xl font-black text-slate-900 mb-2">Industry Index</h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-10">Closing Metrics by Sector</p>
                <div className="overflow-x-auto -mx-8 px-8">
                  <table className="w-full text-left min-w-[500px]">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Sector</th>
                        <th className="pb-6 text-[10px] font-black uppercase text-slate-400 text-center tracking-widest">Win Rate</th>
                        <th className="pb-6 text-[10px] font-black uppercase text-slate-400 text-right tracking-widest">TK Index</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {stats.topIndustries.map((ind) => (
                        <tr key={ind.name} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-6">
                            <div className="font-bold text-slate-800 text-base group-hover:text-indigo-600 transition-colors">{ind.name}</div>
                            <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{ind.count} Reports Analysed</div>
                          </td>
                          <td className="py-6 text-center">
                            <div className="text-base font-black text-slate-900">{ind.winRate}%</div>
                          </td>
                          <td className="py-6 text-right">
                            <div className="flex flex-col items-end">
                                <span className={`text-[11px] font-black uppercase tracking-tight ${parseInt(ind.tireKickerScore.toString()) > 50 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {ind.tireKickerScore}% Risk
                                </span>
                                <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                    <div className={`h-full ${parseInt(ind.tireKickerScore.toString()) > 50 ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${ind.tireKickerScore}%` }}></div>
                                </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-200 p-10 md:p-14 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
                <div>
                    <h3 className="text-3xl font-black text-slate-900 leading-tight">Velocity Matrix</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Cross-referencing Deal Value vs. Closing Time</p>
                </div>
                <div className="bg-indigo-50 text-indigo-600 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                    Heatmap View
                </div>
              </div>
              <div className="overflow-x-auto -mx-10 px-10">
                <ValueVelocityMatrix data={stats.matrix} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ValueVelocityMatrix: React.FC<{ data: any }> = ({ data }) => {
  return (
    <table className="w-full border-collapse min-w-[900px]">
      <thead>
        <tr>
          <th className="p-5 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 text-left">Closing Cycle</th>
          {TCV_ORDER.map(tcv => (
            <th key={tcv} className="p-5 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 text-center tracking-tighter">
              {tcv}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {DURATION_ORDER.map(duration => (
          <tr key={duration} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
            <td className="p-5 text-[11px] font-black text-slate-500 uppercase w-48">{duration}</td>
            {TCV_ORDER.map(tcv => {
              const cell = data[duration][tcv];
              return (
                <td key={tcv} className="p-1">
                  <div className={`m-1 rounded-2xl py-5 text-center border transition-all ${
                    cell.count > 0 
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg shadow-indigo-100 scale-105 z-10' 
                    : 'bg-slate-50/50 border-transparent text-slate-300 opacity-50'
                  }`}>
                    <div className="text-sm font-black">{cell.count > 0 ? cell.count : '0'}</div>
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const StatSummaryCard: React.FC<{ label: string, value: string | number, icon: string, color?: string }> = ({ label, value, icon, color = "text-slate-900" }) => (
  <div className="bg-white p-8 md:p-12 rounded-[32px] md:rounded-[48px] border border-slate-200 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)] flex flex-col items-center justify-center text-center space-y-4 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-2 transition-all duration-300">
    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-[24px] bg-slate-50 border border-slate-100 flex items-center justify-center ${color}`}>
      <i className={`${icon} text-xl md:text-2xl`}></i>
    </div>
    <div>
      <div className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</div>
      <div className={`text-2xl md:text-5xl font-black tracking-tight ${color}`}>{value}</div>
    </div>
  </div>
);

export default GlobalTrends;
