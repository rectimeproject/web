import {ChangeEvent, useCallback, useEffect, useMemo, useState} from "react";
import {DateTime} from "luxon";
import Icon from "./Icon";
import secondsToHumanReadable from "./secondsToHumanReadable";
import {useNavigate} from "react-router";
import ActivityIndicator from "./ActivityIndicator";
import {Link} from "react-router-dom";
import {useRecordingsInfiniteQuery} from "./hooks/queries/useRecordingsInfiniteQuery";
import {useUpdateRecordingMutation} from "./hooks/queries/useRecordingMutations";
import Button from "./components/ui/Button";

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
          <div className="mt-2 text-gray-600 dark:text-gray-400">Loading recordings...</div>
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
          <Button onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {!recordingsWithHandlers.length ? (
        <div className="text-center text-gray-600 dark:text-gray-400">
          No recordings yet. <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">Record</Link> something!
        </div>
      ) : (
        <>
          {recordingsWithHandlers.map(r => (
            <div
              key={r.id}
              className="flex items-center gap-4 p-4 mb-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {`${DateTime.fromJSDate(r.createdAt).toLocaleString(
                    DateTime.DATETIME_SHORT
                  )} | ${secondsToHumanReadable(r.duration / 1000)}`}
                </div>
                <div>
                  <input
                    value={newRecordingNames.get(r.id) ?? r.name}
                    onChange={r.onChangeNewRecordingName}
                    className="text-lg font-medium bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -mx-2 w-full"
                    disabled={updateRecordingMutation.isPending}
                  />
                </div>
              </div>
              <div className="flex-shrink-0">
                {updateRecordingMutation.isPending ? (
                  <ActivityIndicator />
                ) : (
                  <button
                    onClick={r.onClickPlay}
                    className="p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label="Play recording"
                  >
                    <Icon name="headphones" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {isFetchingNextPage ? (
            <div className="text-center my-8">
              <ActivityIndicator />
              <div className="mt-2 text-gray-600 dark:text-gray-400">Loading more...</div>
            </div>
          ) : hasNextPage ? (
            <div className="text-center my-8">
              <Button variant="secondary" onClick={() => fetchNextPage()}>
                Load More
              </Button>
            </div>
          ) : (
            <div className="text-center my-8 text-gray-600 dark:text-gray-400">No more results.</div>
          )}
        </>
      )}
    </div>
  );
}
