interface Props {
  color: string;
  children: React.ReactNode;
}

export function ModalIcon({ color, children }: Props) {
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      <span style={{ color }}>{children}</span>
    </div>
  );
}
