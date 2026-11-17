import type { MemberDto } from '@mini-trello/shared';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/user-avatar';

const MAX_SHOWN = 4;

interface PresenceAvatarsProps {
  userIds: string[];
  membersById: Map<string, MemberDto>;
  currentUserId: string;
}

/** Stacked avatars of everyone currently viewing the board. */
export function PresenceAvatars({ userIds, membersById, currentUserId }: PresenceAvatarsProps) {
  const people = userIds
    .map((id) => membersById.get(id))
    .filter((member): member is MemberDto => !!member)
    .sort((a, b) => Number(b.userId === currentUserId) - Number(a.userId === currentUserId));
  if (people.length === 0) return null;

  const names = people.map((p) => (p.userId === currentUserId ? `${p.name} (you)` : p.name));
  const hidden = people.length - MAX_SHOWN;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center gap-2"
          aria-label={`Online now: ${names.join(', ')}`}
          role="group"
        >
          <div className="flex -space-x-2">
            {people.slice(0, MAX_SHOWN).map((person) => (
              <span key={person.userId} className="relative rounded-full ring-2 ring-background">
                <UserAvatar name={person.name} className="size-7" />
                <span className="absolute right-0 bottom-0 size-2 rounded-full bg-success ring-2 ring-background" />
              </span>
            ))}
            {hidden > 0 && (
              <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-background">
                +{hidden}
              </span>
            )}
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {people.length} online
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>Online now: {names.join(', ')}</TooltipContent>
    </Tooltip>
  );
}
