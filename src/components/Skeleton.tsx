import React from "react";

/** Shimmer skeleton for a company card while data loads. */
export const CardSkeleton: React.FC = () => (
  <div className="de-card p-6 animate-pulse">
    <div className="flex justify-between items-start mb-5">
      <div className="flex gap-3 items-center">
        <div className="w-11 h-11 rounded-xl bg-slate-100" />
        <div>
          <div className="h-4 w-28 bg-slate-100 rounded mb-2" />
          <div className="h-3 w-20 bg-slate-100 rounded" />
        </div>
      </div>
      <div className="w-14 h-14 rounded-full bg-slate-100" />
    </div>
    <div className="grid grid-cols-2 gap-3 mb-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <div className="h-3 w-full bg-slate-100 rounded mb-1.5" />
          <div className="h-1 w-full bg-slate-100 rounded" />
        </div>
      ))}
    </div>
    <div className="h-3 w-full bg-slate-100 rounded mb-2" />
    <div className="h-3 w-3/4 bg-slate-100 rounded" />
  </div>
);

/** A grid of card skeletons. */
export const CardGridSkeleton: React.FC<{ count?: number }> = ({
  count = 6,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);
