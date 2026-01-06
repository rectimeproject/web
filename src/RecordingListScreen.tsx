import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import Icon from './Icon';
import secondsToHumanReadable from './secondsToHumanReadable';
import { useNavigate } from 'react-router';
import ActivityIndicator from './ActivityIndicator';
import { Link } from 'react-router-dom';
import { useRecordingsInfiniteQuery } from './hooks/queries/useRecordingsInfiniteQuery';
import { useUpdateRecordingMutation } from './hooks/queries/useRecordingMutations';

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
    refetch,
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
    return data.pages.flatMap((page) => page.recordings);
  }, [data]);

  const recordingsWithHandlers = useMemo(
    () =>
      recordings.map((r) => ({
        ...r,
        onChangeNewRecordingName: (e: ChangeEvent<HTMLInputElement>) => {
          const newName = e.target.value;
          setNewRecordingNames(
            (newRecordingNames) =>
              new Map([...newRecordingNames, [r.id, newName]])
          );
        },
        onClickPlay: () => openSpecificRecordingPage(r.id),
      })),
    [openSpecificRecordingPage, setNewRecordingNames, recordings]
  );

  // Handle name updates with debouncing
  useEffect(() => {
    for (const [id, name] of newRecordingNames) {
      const recording = recordings.find((r) => r.id === id);
      if (!recording) {
        console.error('failed to find recording: %s', id);
        continue;
      }
      if (recording.name === name) {
        continue;
      }

      // Debounce: update after user stops typing
      const timeoutId = setTimeout(() => {
        updateRecordingMutation.mutate({
          ...recording,
          name,
        });
      }, 500);

      return () => clearTimeout(timeoutId);
    }
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
    window.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [onScroll]);

  // Loading state
  if (isLoading) {
    return (
      <div className="container recording-list-screen">
        <div className="row">
          <div className="col-lg-12">
            <div className="text-center my-4">
              <ActivityIndicator />
              <div className="mt-2">Loading recordings...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="container recording-list-screen">
        <div className="row">
          <div className="col-lg-12">
            <div className="text-center my-4">
              <div className="alert alert-danger">
                Failed to load recordings: {error?.message ?? 'Unknown error'}
              </div>
              <button className="btn btn-primary" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container recording-list-screen">
      <div className="row">
        <div className="col-lg-12">
          {!recordingsWithHandlers.length ? (
            <>
              <div className="text-center">
                No recordings yet. <Link to="/">Record</Link> something!
              </div>
            </>
          ) : (
            <>
              {recordingsWithHandlers.map((r) => (
                <div className="d-flex recording" key={r.id}>
                  <div className="flex-fill overflow-hidden">
                    <div>
                      {`${DateTime.fromJSDate(r.createdAt).toLocaleString(
                        DateTime.DATETIME_SHORT
                      )} | ${secondsToHumanReadable(r.duration / 1000)}`}
                    </div>
                    <div>
                      <h4>
                        <input
                          value={newRecordingNames.get(r.id) ?? r.name}
                          onChange={r.onChangeNewRecordingName}
                          style={{
                            border: 'none',
                          }}
                          disabled={updateRecordingMutation.isPending}
                        />
                      </h4>
                    </div>
                  </div>
                  <div>
                    {updateRecordingMutation.isPending ? (
                      <ActivityIndicator />
                    ) : (
                      <div className="play-arrow" onClick={r.onClickPlay}>
                        <Icon name="headphones" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isFetchingNextPage ? (
                <div className="text-center my-4">
                  <ActivityIndicator />
                  <div className="mt-2">Loading more...</div>
                </div>
              ) : hasNextPage ? (
                <div className="text-center my-4">
                  <button
                    className="btn btn-secondary"
                    onClick={() => fetchNextPage()}
                  >
                    Load More
                  </button>
                </div>
              ) : (
                <div className="text-center my-4">No more results.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
