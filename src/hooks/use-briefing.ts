import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Brief } from "@/routes/api/briefing";

export interface GenerateBriefingParams {
  role: string;
  businessSummary: string;
}

/**
 * React Query mutation hook for generating a role-specific executive briefing.
 * Wraps the /api/briefing POST endpoint.
 * Handles error toasting automatically so components stay focused on rendering.
 */
export function useGenerateBriefing() {
  return useMutation<Brief, Error, GenerateBriefingParams>({
    mutationFn: async (params) => {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text.slice(0, 200) || "Briefing failed");
      }
      return res.json() as Promise<Brief>;
    },
    onError: (err) => {
      toast.error(err.message ?? "Briefing failed");
    },
  });
}
