import {useParams} from "react-router";
import {
  useCallback,
  useMemo,
  useState,
  lazy,
  Suspense,
  useRef,
  memo
} from "react";
import useRecordingPlayer from "./useRecordingPlayer";
import ActivityIndicator from "./ActivityIndicator";
import {DateTime} from "luxon";
import secondsToHumanReadable from "./secondsToHumanReadable";
import Icon from "./Icon";
import {filesize} from "filesize";
import {useRecordingQuery} from "./hooks/queries/useRecordingQuery";
import {useRecordingNotesQuery} from "./hooks/queries/useRecordingNotesQuery";
import {
  useUpdateRecordingNoteMutation,
  useDeleteRecordingNoteMutation
} from "./hooks/queries/useRecordingNotesMutations";
import {ICreateDecoderOptions} from "opus-codec-worker/actions/actions";
import OpusCodecOptions from "./OpusCodecOptions";

export default memo(function RecordingDetailScreen() {
  const {recordingId} = useParams();
  const player = useRecordingPlayer({
    recordingId: recordingId ?? null
  });

  // Convert undefined to null for explicit null handling
  const recordingIdOrNull = recordingId ?? null;

  // Capture real-time waveform data during playback
  // const waveformSamples = usePlaybackWaveform(
  //   player.analyserNode,
  //   player.playing !== null
  // );
  const waveformSamples = useRef(new Array<number>()).current;

  // Fetch recording and bookmarks using React Query
  const {
    data: recording,
    isLoading: isLoadingRecording,
    isError: isRecordingError,
    error: recordingError,
    refetch: refetchRecording
  } = useRecordingQuery(recordingIdOrNull);

  const {data: recordingNotes, isLoading: isLoadingNotes} =
    useRecordingNotesQuery(recordingIdOrNull);

  const updateMutation = useUpdateRecordingNoteMutation();
  const deleteMutation = useDeleteRecordingNoteMutation();

  const recordingBookmarks = useMemo(() => {
    if (!recordingNotes) return [];
    return recordingNotes.map(n => ({
      id: n.id,
      durationOffset: n.durationOffset,
      title: n.title,
      contents: n.contents
    }));
  }, [recordingNotes]);

  const handleBookmarkSeek = useCallback(
    (bookmark: {id: string; durationOffset: number}) => {
      if (recording !== null && recording !== undefined) {
        player.seek(bookmark.durationOffset);
      }
    },
    [player, recording]
  );

  const handleBookmarkUpdate = useCallback(
    (id: string, title: string) => {
      const note = recordingNotes?.find(n => n.id === id);
      if (!note) return;
      updateMutation.mutate({...note, title});
    },
    [recordingNotes, updateMutation]
  );

  const handleBookmarkDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate({noteId: id});
    },
    [deleteMutation]
  );

  const humanReadableRecordingSize = useMemo(
    () => filesize(recording?.size ?? 0).toString(),
    [recording]
  );

  const [canvasContainerDimensions, setCanvasContainerDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const onCanvasContainerElementMount = useCallback(
    (current: HTMLDivElement | null) => {
      if (current !== null) {
        setCanvasContainerDimensions({
          width: current.offsetWidth,
          height: current.offsetHeight
        });
      } else {
        setCanvasContainerDimensions(null);
      }
    },
    [setCanvasContainerDimensions]
  );

  // Loading state
  if (isLoadingRecording || isLoadingNotes) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center">
          <ActivityIndicator width={50} />
          <div className="mt-4 text-gray-600 dark:text-gray-400">
            Loading recording...
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isRecordingError) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center">
          <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            Failed to load recording:{" "}
            {recordingError?.message ?? "Unknown error"}
          </div>
          <button
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xl font-medium transition-all duration-150 hover:scale-105 active:scale-95"
            onClick={() => refetchRecording()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Not found state
  if (!recording) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center">
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
            Recording not found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero Section with Visualizer */}
      <div className="mb-8">
        {/* Visualizer Container with Play Button */}
        <div className="relative bg-gray-50 dark:bg-gray-900 rounded-3xl shadow-lg overflow-hidden mb-6">
          <div className="flex items-center p-6 gap-6">
            {/* Play/Pause Button */}
            <button
              onClick={player.playing !== null ? player.pause : player.play}
              className="shrink-0 w-16 h-16 rounded-full bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95 shadow-lg"
              aria-label={player.playing !== null ? "Pause" : "Play"}
            >
              <Icon name={player.playing !== null ? "pause" : "play_arrow"} />
            </button>

            {/* Visualizer */}
            <div
              className="flex-1 relative"
              ref={onCanvasContainerElementMount}
              style={{height: "320px"}}
            >
              {canvasContainerDimensions !== null ? (
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-full">
                      <ActivityIndicator width={30} />
                    </div>
                  }
                >
                  {/* <TimelineVisualizer
                    canvasHeight={320}
                    canvasWidth={canvasContainerDimensions.width}
                    samplesPerSecond={20}
                    timeWindowSeconds={5}
                    waveformSamples={waveformSamples}
                    bookmarks={recordingBookmarks}
                    currentDuration={
                      player.playing?.cursor ? player.playing.cursor * 1000 : 0
                    }
                    totalDuration={recording?.duration}
                    onBookmarkClick={handleBookmarkSeek}
                    backgroundColor={theme.colors.background}
                    barColor={theme.colors.barColor}
                    bookmarkColor={theme.colors.bookmarkColor}
                  /> */}
                </Suspense>
              ) : null}
              {player.playing !== null && player.playing.cursor !== null && (
                <div className="absolute bottom-4 right-4 px-4 py-2 bg-white/90 dark:bg-black/90 backdrop-blur-md rounded-xl text-sm font-mono font-semibold shadow-md">
                  {secondsToHumanReadable(player.playing.cursor)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all duration-150">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Duration
            </div>
            <div className="text-lg font-semibold font-mono">
              {secondsToHumanReadable(recording.duration / 1000)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all duration-150">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Size
            </div>
            <div className="text-lg font-semibold font-mono">
              {humanReadableRecordingSize}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all duration-150">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Sample Rate
            </div>
            <div className="text-lg font-semibold font-mono">
              {recording.sampleRate}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all duration-150">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Channels
            </div>
            <div className="text-lg font-semibold font-mono">
              {recording.channels}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all duration-150">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Frame Size
            </div>
            <div className="text-lg font-semibold font-mono">
              {recording.frameSize}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all duration-150">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Created
            </div>
            <div className="text-lg font-semibold font-mono">
              {DateTime.fromJSDate(recording.createdAt).toLocaleString(
                DateTime.DATE_SHORT
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bookmarks Section */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-8">
              <ActivityIndicator width={30} />
            </div>
          }
        >
          {/* <BookmarkPanel
            bookmarks={recordingBookmarks}
            onSeek={handleBookmarkSeek}
            onUpdate={handleBookmarkUpdate}
            onDelete={handleBookmarkDelete}
            updatingIds={
              new Set(
                updateMutation.isPending && updateMutation.variables
                  ? [updateMutation.variables.id]
                  : []
              )
            }
            deletingIds={
              new Set(
                deleteMutation.isPending && deleteMutation.variables
                  ? [deleteMutation.variables.noteId]
                  : []
              )
            }
          /> */}
        </Suspense>
      </div>
    </div>
  );
});
