import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BoardDiscussion } from "@/routes/api/board";
import type { BusinessContext } from "@/lib/business";

export interface AskBoardParams {
  question: string;
  businessContext: BusinessContext;
  simulation?: {
    label: string;
    before: Record<string, number>;
    after: Record<string, number>;
    narrativeInputs: Record<string, string | number>;
  };
}

/**
 * React Query mutation hook for asking the AI board a question.
 * Wraps the /api/board POST endpoint.
 * Handles error toasting automatically so components stay focused on rendering.
 */
export function useAskBoard() {
  return useMutation<BoardDiscussion, Error, AskBoardParams>({
    mutationFn: async (params) => {
      const res = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text.slice(0, 300) || "Board unavailable");
      }
      const data = (await res.json()) as BoardDiscussion;
      if (!data.messages || data.messages.length === 0) {
        throw new Error("The board returned no responses.");
      }
      return data;
    },
    onError: (err) => {
      toast.error(err.message ?? "Board unavailable");
    },
  });
}
