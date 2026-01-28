import {useParams} from "react-router";
import {
  useCallback,
  useMemo,
  useState,
  Suspense,
  memo,
  ChangeEventHandler,
  useRef,
  PropsWithChildren
} from "react";
import useRecordingPlayer from "./useRecordingPlayer.js";
import ActivityIndicator from "./ActivityIndicator.js";
import {DateTime} from "luxon";
import secondsToHumanReadable from "./secondsToHumanReadable.js";
import Icon from "./Icon.js";
import {filesize} from "filesize";
import {useRecordingQuery} from "./hooks/queries/useRecordingQuery.js";
import {IAnalyserNode, IAudioContext} from "standardized-audio-context";

// import {useRecordingNotesQuery} from "./hooks/queries/useRecordingNotesQuery";
// import {
//   useUpdateRecordingNoteMutation,
//   useDeleteRecordingNoteMutation
// } from "./hooks/queries/useRecordingNotesMutations";

function RecordingDetailBlock({
  title,
  children
}: PropsWithChildren<{
  title: string;
}>) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all duration-150">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
        {title}
      </div>
      <div className="dark:text-white text-lg font-semibold font-mono">
        {children}
      </div>
    </div>
  );
}

export default memo(function RecordingDetailScreen() {
  const {recordingId} = useParams();
  const [currentTime, setCurrentTime] = useState<number>(0);
  const analyserNodeRef = useRef<IAnalyserNode<IAudioContext> | null>(null);
  const player = useRecordingPlayer({
    recordingId: recordingId ?? null,
    analyserNodeRef,
    setCurrentTime
  });

  // Convert undefined to null for explicit null handling
  const recordingIdOrNull = recordingId ?? null;

  const onChangeCurrentTime = useCallback<ChangeEventHandler<HTMLInputElement>>(
    e => {
      const newTime = e.target.valueAsNumber;
      setCurrentTime(newTime);
      player.seek(newTime);
    },
    [player]
  );

  // Capture real-time waveform data during playback
  // const waveformSamples = usePlaybackWaveform(
  //   player.analyserNode,
  //   player.playing !== null
  // );
  // const waveformSamples = useRef(new Array<number>()).current;

  // Fetch recording and bookmarks using React Query
  const {
    data: recording,
    isLoading: isLoadingRecording,
    isError: isRecordingError,
    error: recordingError,
    refetch: refetchRecording
  } = useRecordingQuery(recordingIdOrNull);

  // const {data: recordingNotes, isLoading: isLoadingNotes} =
  //   useRecordingNotesQuery(recordingIdOrNull);

  // const updateMutation = useUpdateRecordingNoteMutation();
  // const deleteMutation = useDeleteRecordingNoteMutation();

  // const recordingBookmarks = useMemo(() => {
  //   if (!recordingNotes) return [];
  //   return recordingNotes.map(n => ({
  //     id: n.id,
  //     durationOffset: n.durationOffset,
  //     title: n.title,
  //     contents: n.contents
  //   }));
  // }, [recordingNotes]);

  // const handleBookmarkSeek = useCallback(
  //   (bookmark: {id: string; durationOffset: number}) => {
  //     if (recording !== null && recording !== undefined) {
  //       player.seek(bookmark.durationOffset);
  //     }
  //   },
  //   [player, recording]
  // );

  // const handleBookmarkUpdate = useCallback(
  //   (id: string, title: string) => {
  //     const note = recordingNotes?.find(n => n.id === id);
  //     if (!note) return;
  //     updateMutation.mutate({...note, title});
  //   },
  //   [recordingNotes, updateMutation]
  // );

  // const handleBookmarkDelete = useCallback(
  //   (id: string) => {
  //     deleteMutation.mutate({noteId: id});
  //   },
  //   [deleteMutation]
  // );

  const humanReadableRecordingSize = useMemo(
    () => filesize(recording?.size ?? 0).toString(),
    [recording]
  );

  const togglePlayer = useCallback(() => {
    if (player.playing) {
      player.pause();
      return;
    }
    player.play(currentTime);
  }, [player, currentTime]);

  // Loading state
  if (isLoadingRecording) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center">
          <ActivityIndicator />
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
              onClick={togglePlayer}
              className="shrink-0 w-16 h-16 rounded-full bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95 shadow-lg"
              aria-label={player.playing ? "Pause" : "Play"}
            >
              <Icon name={player.playing ? "pause" : "play_arrow"} />
            </button>

            {/* Player current time controller */}
            <div className="flex flex-col flex-1">
              <input
                type="range"
                min={0}
                max={recording.duration / 1000}
                value={currentTime}
                onChange={onChangeCurrentTime}
                className="w-full"
              />
              <div className="dark:text-white text-lg font-mono font-semibold mt-1">
                {secondsToHumanReadable(currentTime)}
              </div>
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <RecordingDetailBlock title={"Duration"}>
            {secondsToHumanReadable(recording.duration / 1000)}
          </RecordingDetailBlock>
          {/* <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all duration-150">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Size
            </div>
            <div className="text-lg font-semibold font-mono">
              {humanReadableRecordingSize}
            </div>
          </div> */}
          <RecordingDetailBlock title={"Size"}>
            {humanReadableRecordingSize}
          </RecordingDetailBlock>
          <RecordingDetailBlock title={"Sample Rate"}>
            {recording.sampleRate}
          </RecordingDetailBlock>

          <RecordingDetailBlock title={"Channels"}>
            {recording.channels}
          </RecordingDetailBlock>

          <RecordingDetailBlock title={"Frame Size"}>
            {recording.frameSize}
          </RecordingDetailBlock>

          <RecordingDetailBlock title={"Created"}>
            {DateTime.fromJSDate(recording.createdAt).toLocaleString(
              DateTime.DATE_SHORT
            )}
          </RecordingDetailBlock>
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
