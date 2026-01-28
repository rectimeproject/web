import {useState} from "react";
import BookmarkListItem from "./BookmarkListItem.js";
import BookmarkEmpty from "./BookmarkEmpty.js";

interface IBookmark {
  id: string;
  durationOffset: number;
  title: string;
  contents?: string;
}

interface BookmarkPanelProps {
  bookmarks: IBookmark[];
  onSeek: (bookmark: IBookmark) => void;
  onUpdate: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  updatingIds?: Set<string>;
  deletingIds?: Set<string>;
  initiallyCollapsed?: boolean;
}

/**
 * Collapsible panel displaying bookmark list with CRUD operations
 */
export default function BookmarkPanel({
  bookmarks,
  onSeek,
  onUpdate,
  onDelete,
  updatingIds = new Set(),
  deletingIds = new Set(),
  initiallyCollapsed = false
}: BookmarkPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);

  const sortedBookmarks = [...bookmarks].sort(
    (a, b) => a.durationOffset - b.durationOffset
  );

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5"
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
          <span className="font-medium text-sm">
            Bookmarks
            {bookmarks.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                {bookmarks.length}
              </span>
            )}
          </span>
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="max-h-80 overflow-y-auto">
          {sortedBookmarks.length === 0 ? (
            <BookmarkEmpty />
          ) : (
            <div>
              {sortedBookmarks.map(bookmark => (
                <BookmarkListItem
                  key={bookmark.id}
                  bookmark={bookmark}
                  onSeek={onSeek}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  isUpdating={updatingIds.has(bookmark.id)}
                  isDeleting={deletingIds.has(bookmark.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
