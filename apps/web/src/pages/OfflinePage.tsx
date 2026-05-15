export function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="text-5xl" aria-hidden>
        📡
      </div>
      <h1 className="font-display text-3xl text-primary tracking-wider">You're offline</h1>
      <p className="text-text-secondary font-sans max-w-sm">
        No internet connection detected. Check your connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-4 py-2 rounded-md bg-primary/20 text-primary text-sm font-sans hover:bg-primary/30 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
