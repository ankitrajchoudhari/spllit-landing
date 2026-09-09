import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <span className="font-mono text-[10px] uppercase tracking-widest text-ink-subtle">404</span>
      <h1 className="text-xl font-bold text-ink">No such page in the console</h1>
      <Link href="/" className="text-sm font-semibold text-brand hover:underline">
        Back to the dashboard
      </Link>
    </div>
  );
}
