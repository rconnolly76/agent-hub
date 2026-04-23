export default function RunDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[min(100%,1600px)]">
      {children}
    </div>
  );
}
