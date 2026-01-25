import {ChangeEvent, useCallback, useEffect, useMemo, useState} from "react";
import {DateTime} from "luxon";
import {useNavigate} from "react-router";
import {Link} from "react-router-dom";
import secondsToHumanReadable from "./secondsToHumanReadable.js";
import Icon from "./Icon.js";
import ActivityIndicator from "./ActivityIndicator.js";
import {useRecordingsInfiniteQuery} from "./hooks/queries/useRecordingsInfiniteQuery.js";
import {useUpdateRecordingMutation} from "./hooks/queries/useRecordingMutations.js";
import Button from "./components/ui/Button.js";

export default function RecordingListScreen() {
  const navigate = useNavigate();
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

  const updateRecordingMutation = useUpdateRecordingMutation();

  const openSpecificRecordingPage = useCallback(
    (recordingId: string) => {
      navigate(`/recording/${recordingId}`);
    },
    [navigate]
  );

  const [newRecordingNames, setNewRecordingNames] = useState(
    new Map<string, string>()
  );

  const recordings = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.recordings);
  }, [data]);

  const recordingsWithHandlers = useMemo(
    () =>
      recordings.map(r => ({
        ...r,
        onChangeNewRecordingName: (e: ChangeEvent<HTMLInputElement>) => {
          const newName = e.target.value;
          setNewRecordingNames(
            newRecordingNames =>
              new Map([...newRecordingNames, [r.id, newName]])
          );
        },
        onClickPlay: () => openSpecificRecordingPage(r.id)
      })),
    [openSpecificRecordingPage, setNewRecordingNames, recordings]
  );

  // Handle name updates with debouncing
  useEffect(() => {
    const timeoutIds: NodeJS.Timeout[] = [];

    for (const [id, name] of newRecordingNames) {
      const recording = recordings.find(r => r.id === id);
      if (!recording) {
        console.error("failed to find recording: %s", id);
        continue;
      }
      if (recording.name === name) {
        continue;
      }

      // Debounce: update after user stops typing
      const timeoutId = setTimeout(() => {
        updateRecordingMutation.mutate({
          ...recording,
          name
        });
      }, 500);

      timeoutIds.push(timeoutId);
    }

    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [recordings, newRecordingNames, updateRecordingMutation]);

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
      {!recordingsWithHandlers.length ? (
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
          {recordingsWithHandlers.map(r => (
            <div
              key={r.id}
              className="flex items-center gap-6 p-6 mb-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
            >
              <div className="text-sm font-mono text-gray-500 dark:text-gray-400 tracking-tight">
                {DateTime.fromJSDate(r.createdAt).toLocaleString(
                  DateTime.DATETIME_SHORT
                )}
              </div>
              <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
              <div className="text-sm font-mono text-gray-500 dark:text-gray-400">
                {secondsToHumanReadable(r.duration / 1000)}
              </div>
              <div className="flex-1 min-w-0">
                <input
                  value={newRecordingNames.get(r.id) ?? r.name}
                  onChange={r.onChangeNewRecordingName}
                  className="text-lg font-medium bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 rounded-lg px-3 py-2 -mx-3 w-full transition-all duration-150"
                  disabled={updateRecordingMutation.isPending}
                />
              </div>
              <div className="flex-shrink-0">
                {updateRecordingMutation.isPending ? (
                  <ActivityIndicator />
                ) : (
                  <button
                    onClick={r.onClickPlay}
                    className="w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                    aria-label="Play recording"
                  >
                    <Icon name="play_arrow" />
                  </button>
                )}
              </div>
            </div>
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
