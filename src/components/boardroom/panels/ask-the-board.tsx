import { useState } from "react";
import { MessageSquareQuote, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/boardroom/section-heading";
import { ExecAvatar } from "@/components/boardroom/exec-avatar";
import { DiscussionStream } from "@/components/boardroom/discussion-stream";
import { selectExecutives, type ExecRole } from "@/lib/executives";
import { useAskBoard } from "@/hooks/use-board";
import type { BoardDiscussion } from "@/routes/api/board";

import type { BusinessContext } from "@/lib/business";

const SUGGESTED = [
  "Why did profits decrease?",
  "Should we increase prices?",
  "Should we replace Supplier B?",
  "Can we afford to hire another employee?",
  "Should we open another branch?",
];

interface AskTheBoardProps {
  businessContext: BusinessContext;
}

export function AskTheBoard({ businessContext }: AskTheBoardProps) {
  const [question, setQuestion] = useState("");
  const [discussion, setDiscussion] = useState<BoardDiscussion | null>(null);

  const { mutateAsync, isPending } = useAskBoard();

  // Derive the relevant participants preview from the current question text
  const participants: ExecRole[] = question.trim()
    ? selectExecutives(question)
    : [];

  async function ask(q?: string) {
    const query = (q ?? question).trim();
    if (!query) {
      toast.error("Ask the board a question first.");
      return;
    }
    setQuestion(query);
    setDiscussion(null);
    try {
      const result = await mutateAsync({ question: query, businessContext });
      setDiscussion(result);
    } catch {
      // Error already toasted by useAskBoard's onError
    }
  }

  return (
    <section className="mb-16">
      <SectionHeading
        eyebrow="Section 02"
        title="Ask the Board"
        subtitle="Only the relevant executives join each discussion."
      />

      <div className="panel p-5 md:p-7">
        {/* Input row */}
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex-1">
            <Input
              placeholder="e.g. Should we increase prices?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") ask();
              }}
              disabled={isPending}
              className="h-12 text-base"
            />
          </div>
          <Button
            onClick={() => ask()}
            disabled={isPending}
            size="lg"
            className="bg-gold text-gold-foreground hover:opacity-90"
          >
            {isPending ? (
              "Convening…"
            ) : (
              <>
                Convene the board <MessageSquareQuote className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* Suggested prompts */}
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={isPending}
              className="rounded-full border border-border/70 bg-card/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-gold/60 hover:text-foreground disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Participants preview — shown before submitting */}
        {participants.length > 0 && !isPending && !discussion && (
          <div className="text-muted-foreground mt-5 flex items-center gap-2 text-xs">
            <Users className="h-3 w-3" /> Board members joining:
            <div className="flex items-center gap-1">
              {participants.map((r) => (
                <ExecAvatar key={r} role={r} size={22} />
              ))}
              <ExecAvatar role="Business Analyst" size={22} />
            </div>
          </div>
        )}

        {/* Convening state */}
        {isPending && (
          <div className="text-muted-foreground mt-6 flex items-center gap-3 text-sm">
            <div className="flex -space-x-2">
              {participants.map((r) => (
                <ExecAvatar key={r} role={r} size={30} />
              ))}
            </div>
            The board is convening on:{" "}
            <span className="text-foreground italic">"{question}"</span>
          </div>
        )}

        {/* Discussion output */}
        {discussion && (
          <div className="mt-6 border-t border-border/60 pt-5">
            <div className="mb-3 text-muted-foreground text-xs uppercase tracking-widest">
              Board discussion — {discussion.question}
            </div>
            <DiscussionStream
              discussion={discussion}
              companyName={businessContext.financial.companyName}
            />
          </div>
        )}
      </div>
    </section>
  );
}
