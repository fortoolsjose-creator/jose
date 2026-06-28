export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center p-4">
      {children}
    </main>
  );
}
