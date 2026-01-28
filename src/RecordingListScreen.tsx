import {useCallback, useEffect, useMemo} from "react";
import {Link} from "react-router-dom";
import ActivityIndicator from "./ActivityIndicator.js";
import {useRecordingsInfiniteQuery} from "./hooks/queries/useRecordingsInfiniteQuery.js";
import Button from "./components/ui/Button.js";
import RecordingListScreenItem from "./RecordingListScreenItem.js";

export default function RecordingListScreen() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch
  } = useRecordingsInfiniteQuery(10);

  const recordings = useMemo(
    () => data.pages.flatMap(page => page.recordings),
    [data]
  );

  const onScroll = useCallback(() => {
    if (!document.scrollingElement || !hasNextPage || isFetchingNextPage) {
      return;
    }
    const pct =
      window.scrollY /
      (document.scrollingElement.scrollHeight -
        document.scrollingElement.clientHeight);
    if (pct < 0.9) {
      return;
    }
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [onScroll]);

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center my-8">
          <ActivityIndicator />
          <div className="mt-2 text-gray-600 dark:text-gray-400">
            Loading recordings...
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center my-8">
          <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            Failed to load recordings: {error?.message ?? "Unknown error"}
          </div>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {!recordings.length ? (
        <div className="text-center text-gray-600 dark:text-gray-400">
          No recordings yet.{" "}
          <Link
            to="/"
            className="text-blue-500 dark:text-blue-400 hover:underline"
          >
            Record
          </Link>{" "}
          something!
        </div>
      ) : (
        <>
          {recordings.map(r => (
            <RecordingListScreenItem
              key={r.id}
              recording={r}
            />
          ))}
          {isFetchingNextPage ? (
            <div className="text-center my-8">
              <ActivityIndicator />
              <div className="mt-2 text-gray-600 dark:text-gray-400">
                Loading more...
              </div>
            </div>
          ) : hasNextPage ? (
            <div className="text-center my-8">
              <Button
                variant="secondary"
                onClick={() => fetchNextPage()}
              >
                Load More
              </Button>
            </div>
          ) : (
            <div className="text-center my-8 text-gray-600 dark:text-gray-400">
              No more results.
            </div>
          )}
        </>
      )}
    </div>
  );
}
