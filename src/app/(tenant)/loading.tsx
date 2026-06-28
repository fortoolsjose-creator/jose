export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="bg-muted h-8 w-40 rounded-md" />
      <div className="bg-muted h-32 rounded-lg" />
      <div className="bg-muted h-24 rounded-lg" />
    </div>
  );
}
