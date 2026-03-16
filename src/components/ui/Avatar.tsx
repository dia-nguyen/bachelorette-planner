"use client";

interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
}

const AVATAR_PALETTE = [
  "#A78BFA", "#F472B6", "#34D399", "#60A5FA", "#FBBF24",
  "#F87171", "#818CF8", "#2DD4BF", "#FB923C", "#C084FC",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function Avatar({ name, color, size = 28 }: AvatarProps) {
  const resolvedColor = color ?? AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length];
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <span
      title={name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: resolvedColor,
        color: "#fff",
        fontSize: size * 0.4,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

interface AvatarGroupProps {
  users: { name: string; color?: string; }[];
  max?: number;
  size?: number;
}

export function AvatarGroup({ users, max = 4, size = 28 }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex items-center" style={{ gap: -4 }}>
      {visible.map((u, i) => (
        <span key={i} style={{ marginLeft: i > 0 ? -6 : 0, position: "relative", zIndex: max - i }}>
          <Avatar name={u.name} color={u.color} size={size} />
        </span>
      ))}
      {remaining > 0 && (
        <span
          style={{
            marginLeft: -6,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: size,
            height: size,
            borderRadius: "50%",
            background: "var(--color-bg-muted)",
            color: "var(--color-text-secondary)",
            fontSize: size * 0.35,
            fontWeight: 600,
          }}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}
