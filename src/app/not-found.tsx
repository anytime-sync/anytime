import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-display text-muted-fg/40">404</p>
      <h1 className="text-xl font-medium text-fg">Page not found</h1>
      <p className="text-sm text-muted-fg max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className="btn-primary mt-2">
        Back to First Light
      </Link>
    </div>
  );
}
