'use client';

interface GoalBubbleProps {
  goal: string;
  feedback: string | null;
  createdAt: string;
}

export function GoalBubble({ goal, feedback, createdAt }: GoalBubbleProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] space-y-1">
        {feedback !== null && (
          <div className="text-xs text-muted-foreground text-right">Refinement</div>
        )}
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
          {feedback ?? goal}
        </div>
        <div className="text-xs text-muted-foreground text-right">
          {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
