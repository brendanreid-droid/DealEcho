import React from "react";
import { Link } from "react-router-dom";
import { Flag } from "../../../services/accountSignal";
import FlagCard from "./FlagCard";

const FlagList: React.FC<{ flags: Flag[]; isPro: boolean }> = ({ flags, isPro }) => {
  if (flags.length === 0) {
    return <p className="text-sm text-slate-400">No red flags detected across recent reports.</p>;
  }
  return (
    <div className="space-y-2">
      {flags.map((f) => (
        <FlagCard key={f.type} flag={f} showEvidence={isPro} />
      ))}
      {!isPro && (
        <Link
          to="/pricing"
          className="block text-center bg-navy text-white rounded-control px-4 py-3 text-2xs font-semibold uppercase tracking-widest hover:bg-navy-800 transition-colors"
        >
          Unlock {flags.length} flags with Sales Pro
        </Link>
      )}
    </div>
  );
};

export default FlagList;
