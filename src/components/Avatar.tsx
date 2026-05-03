'use client';
import { getUser, avatarBg } from '@/lib/data';

interface Props {
  userId?: string;
  name?: string;
  hue?: number;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'w-5 h-5 text-[9px]', md: 'w-6 h-6 text-[10px]', lg: 'w-8 h-8 text-[11.5px]' };

export function Avatar({ userId, name, hue, size = 'md' }: Props) {
  const user = userId ? getUser(userId) : null;
  const displayName = user?.name ?? name ?? '?';
  const displayHue = user?.hue ?? hue ?? 250;
  const initials = displayName.split(' ').map(w => w[0]).slice(0, 2).join('');

  return (
    <span
      className={`${sizes[size]} rounded-full inline-flex items-center justify-center font-semibold text-white flex-shrink-0 border-[1.5px] border-[var(--surface)]`}
      style={{ background: avatarBg(displayHue) }}
      title={displayName}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({ userIds, max = 3 }: { userIds: string[]; max?: number }) {
  const shown = userIds.slice(0, max);
  return (
    <span className="inline-flex">
      {shown.map((id, i) => (
        <span key={id} style={{ marginLeft: i > 0 ? -8 : 0 }}>
          <Avatar userId={id} size="sm" />
        </span>
      ))}
    </span>
  );
}
