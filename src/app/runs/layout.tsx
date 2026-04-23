/** Full-bleed layout for run routes (command center uses full viewport width). */
export default function RunsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="w-full min-w-0 pt-2 sm:pt-3">{children}</div>;
}
