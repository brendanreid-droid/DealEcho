import React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Review } from "../../../types";
import ReviewCard from "./ReviewCard";
import { useHelpfulVotes } from "../../hooks/useHelpfulVotes";

interface Props {
  reviews: Review[];
  /** Current user's id, or null when signed out. Used to block self-voting. */
  currentUserId?: string | null;
}

const EvidenceList: React.FC<Props> = ({ reviews, currentUserId }) => {
  const { counts, mine, pending, toggle } = useHelpfulVotes(reviews);

  return (
    <Tooltip.Provider delayDuration={150}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          {reviews.length} verified report{reviews.length !== 1 ? "s" : ""}
        </p>
        {reviews.map((r) => {
          const isAuthor = !!currentUserId && r.userId === currentUserId;
          return (
            <ReviewCard
              key={r.id}
              review={r}
              helpful={{
                count: counts[r.id] ?? r.helpfulCount ?? 0,
                mine: !!mine[r.id],
                pending: !!pending[r.id],
                onToggle: () => toggle(r.id),
                // The server enforces both of these. Disabling here only saves
                // the user a pointless round trip and an error they can't act on.
                disabled: !currentUserId || isAuthor,
                disabledReason: !currentUserId
                  ? "Sign in to mark a review helpful"
                  : isAuthor
                    ? "You cannot mark your own review helpful"
                    : undefined,
              }}
            />
          );
        })}
      </div>
    </Tooltip.Provider>
  );
};

export default EvidenceList;
