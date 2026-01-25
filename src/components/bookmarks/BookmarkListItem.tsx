import {useState, useCallback, KeyboardEvent} from "react";
import secondsToHumanReadable from "../../secondsToHumanReadable.js";

interface IBookmark {
  id: string;
  durationOffset: number;
  title: string;
  contents?: string;
}

interface BookmarkListItemProps {
  bookmark: IBookmark;
  onSeek: (bookmark: IBookmark) => void;
  onUpdate: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

/**
 * Individual bookmark list item with inline editing
 */
export default function BookmarkListItem({
  bookmark,
  onSeek,
  onUpdate,
  onDelete,
  isUpdating = false,
  isDeleting = false
}: BookmarkListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(bookmark.title);

  const handleSave = useCallback(() => {
    if (editedTitle !== bookmark.title) {
      onUpdate(bookmark.id, editedTitle);
    }
    setIsEditing(false);
  }, [editedTitle, bookmark.title, bookmark.id, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditedTitle(bookmark.title);
    setIsEditing(false);
  }, [bookmark.title]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  const handleSeek = useCallback(() => {
    if (!isEditing) {
      onSeek(bookmark);
    }
  }, [isEditing, bookmark, onSeek]);

  const timestamp = secondsToHumanReadable(bookmark.durationOffset / 1000);

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700
        hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
        ${!isEditing ? "cursor-pointer" : ""}
      `}
      onClick={handleSeek}
    >
      {/* Timestamp */}
      <div className="flex-shrink-0 w-16 text-sm font-mono opacity-60">
        {timestamp}
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editedTitle}
            onChange={e => setEditedTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            autoFocus
            disabled={isUpdating}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <div className="text-sm truncate">
            {bookmark.title || (
              <span className="opacity-40 italic">Untitled bookmark</span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-2 flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              disabled={isUpdating}
              className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
              title="Save"
            >
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </button>
            <button
              onClick={handleCancel}
              disabled={isUpdating}
              className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
              title="Cancel"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(true)}
              disabled={isUpdating || isDeleting}
              className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50"
              title="Edit"
            >
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
            <button
              onClick={() => onDelete(bookmark.id)}
              disabled={isUpdating || isDeleting}
              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
              title="Delete"
            >
              {isDeleting ? (
                <svg
                  className="w-5 h-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
