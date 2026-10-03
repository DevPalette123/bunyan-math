const AVATAR_TONES = [
  "bg-teach-100 text-teach-700",
  "bg-mint-100 text-mint-600",
  "bg-lilac-100 text-lilac-500",
  "bg-sun-50 text-sun-600",
  "bg-rose-50 text-rose-500",
];

/** Deterministic so the same student always gets the same tone. */
function toneFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % AVATAR_TONES.length;
  return AVATAR_TONES[hash];
}

interface AvatarProps {
  name: string;
  className?: string;
}

export default function Avatar({ name, className = "w-10 h-10" }: AvatarProps) {
  const letter = name.trim().charAt(0) || "؟";
  return (
    <span
      className={`${className} rounded-2xl flex items-center justify-center font-extrabold shrink-0 ${toneFor(name)}`}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}
