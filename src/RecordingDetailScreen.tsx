import { useParams } from "react-router";
import { useCallback, useMemo, useState } from "react";
import useRecordingPlayer from "./useRecordingPlayer";
import ActivityIndicator from "./ActivityIndicator";
import { DateTime } from "luxon";
import secondsToHumanReadable from "./secondsToHumanReadable";
import PixiAnalyserNodeView from "./PixiAnalyserNodeView";
import Icon from "./Icon";
import { filesize } from "filesize";
import useTheme from "./useTheme";
import { useRecordingQuery } from "./hooks/queries/useRecordingQuery";
import { useRecordingNotesQuery } from "./hooks/queries/useRecordingNotesQuery";

export default function RecordingDetailScreen() {
  const theme = useTheme();
  const player = useRecordingPlayer();
  const { recordingId } = useParams<{ recordingId: string }>();

  // Convert undefined to null for explicit null handling
  const recordingIdOrNull = recordingId ?? null;

  // Fetch recording and bookmarks using React Query
  const {
    data: recording,
    isLoading: isLoadingRecording,
    isError: isRecordingError,
    error: recordingError,
    refetch: refetchRecording,
  } = useRecordingQuery(recordingIdOrNull);

  const {
    data: recordingNotes,
    isLoading: isLoadingNotes,
  } = useRecordingNotesQuery(recordingIdOrNull);

  const recordingBookmarks = useMemo(() => {
    if (!recordingNotes) return [];
    return recordingNotes.map((n: any) => ({
      id: n.id,
      durationOffset: n.durationOffset,
      title: n.title,
    }));
  }, [recordingNotes]);

  const handleBookmarkClick = useCallback(
    (_bookmark: { id: string; durationOffset: number }) => {
      // TODO: Implement seeking functionality in useRecordingPlayer
      // For now, just start playing from the beginning
      if (recording !== null && recording !== undefined) {
        player.play(recording);
      }
    },
    [player, recording]
  );

  const play = useCallback(() => {
    if (recording !== null && recording !== undefined) {
      player.play(recording);
    }
  }, [recording, player]);

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
          height: current.offsetHeight,
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
      <div className="container recording-screen">
        <div className="row">
          <div className="col-lg-12">
            <div className="text-center my-4">
              <ActivityIndicator width={50} />
              <div className="mt-2">Loading recording...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isRecordingError) {
    return (
      <div className="container recording-screen">
        <div className="row">
          <div className="col-lg-12">
            <div className="text-center my-4">
              <div className="alert alert-danger">
                Failed to load recording:{" "}
                {recordingError?.message ?? "Unknown error"}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => refetchRecording()}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!recording) {
    return (
      <div className="container recording-screen">
        <div className="row">
          <div className="col-lg-12">
            <div className="text-center my-4">
              <div className="alert alert-warning">Recording not found</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container recording-screen">
        <div className="row">
          <div className="col-md-8 col-xs-12">
            <>
              <div className="d-flex">
                <div className="d-flex align-items-center">
                  <div
                    className="recording-screen-play-button"
                    onClick={player.playing !== null ? player.pause : play}
                  >
                    <Icon
                      name={player.playing !== null ? "pause" : "play_arrow"}
                    />
                  </div>
                </div>
                <div
                  className="flex-fill mx-3 canvas-container"
                  ref={onCanvasContainerElementMount}
                >
                  {canvasContainerDimensions !== null ? (
                    <PixiAnalyserNodeView
                      visualizationMode={{
                        type: "frequency",
                        barCount: 64,
                      }}
                      canvasHeight={256}
                      canvasWidth={canvasContainerDimensions.width}
                      isPlaying={player.playing !== null}
                      analyserNode={player.analyserNode()}
                      bookmarks={recordingBookmarks}
                      currentDuration={
                        player.playing?.cursor ? player.playing.cursor * 1000 : 0
                      }
                      totalDuration={recording?.duration}
                      onBookmarkClick={handleBookmarkClick}
                      backgroundColor={theme.colors.background}
                      barColor={theme.colors.barColor}
                      bookmarkColor={theme.colors.bookmarkColor}
                      waveformSamples={[]}
                      playbackPosition={
                        player.playing?.cursor ? player.playing.cursor * 1000 : 0
                      }
                    />
                  ) : null}
                  {player.playing !== null && player.playing.cursor !== null && (
                    <div className="duration">
                      {secondsToHumanReadable(player.playing.cursor)}
                    </div>
                  )}
                </div>
              </div>
            </>
          </div>
          <div className="col-md-4 col-xs-12">
            <hr />
            <div>
              <h4>Information</h4>
              <div>Size: {humanReadableRecordingSize}</div>
              <div>Sample rate: {recording.sampleRate}</div>
              <div>Channels: {recording.channels}</div>
              <div>Frame size: {recording.frameSize}</div>
              <div>
                Created at:{" "}
                {DateTime.fromJSDate(recording.createdAt).toLocaleString(
                  DateTime.DATETIME_SHORT
                )}
              </div>
              <div>
                Duration: {secondsToHumanReadable(recording.duration / 1000)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
