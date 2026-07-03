interface BadgeProps {
  children: string;
}

export function Badge({ children }: BadgeProps) {
  return <span className="badge">#{children}</span>;
}