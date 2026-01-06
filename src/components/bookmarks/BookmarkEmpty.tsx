/**
 * Empty state component for when there are no bookmarks
 */
export default function BookmarkEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <svg
        className="w-12 h-12 mb-4 opacity-50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
      <p className="text-sm opacity-60">No bookmarks yet</p>
      <p className="text-xs opacity-40 mt-1">
        Add bookmarks during recording to mark important moments
      </p>
    </div>
  );
}
