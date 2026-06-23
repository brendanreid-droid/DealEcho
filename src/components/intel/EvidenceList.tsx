import React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Review } from "../../../types";
import ReviewCard from "./ReviewCard";

const EvidenceList: React.FC<{ reviews: Review[] }> = ({ reviews }) => (
  <Tooltip.Provider delayDuration={150}>
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {reviews.length} verified report{reviews.length !== 1 ? "s" : ""}
      </p>
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} />
      ))}
    </div>
  </Tooltip.Provider>
);

export default EvidenceList;
