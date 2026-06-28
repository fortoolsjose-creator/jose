export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="bg-muted h-8 w-48 rounded-md" />
      <div className="bg-muted h-28 rounded-lg" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="bg-muted h-20 rounded-lg" />
        <div className="bg-muted h-20 rounded-lg" />
        <div className="bg-muted h-20 rounded-lg" />
      </div>
      <div className="bg-muted h-40 rounded-lg" />
    </div>
  );
}
