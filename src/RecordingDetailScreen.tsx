import { useParams } from 'react-router';
import useRecorderDatabase from './useRecorderDatabase';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useRecordingPlayer from './useRecordingPlayer';
import ActivityIndicator from './ActivityIndicator';
import { DateTime } from 'luxon';
import secondsToHumanReadable from './secondsToHumanReadable';
import AnalyserNodeView from './AnalyserNodeView';
import Icon from './Icon';
import { filesize } from 'filesize';

export default function RecordingDetailScreen() {
  const recorderDatabase = useRecorderDatabase();
  const recordingPlayer = useRecordingPlayer();
  const { recordingId } = useParams<{ recordingId: string }>();
  const recording =
    recorderDatabase.recordings.find((r) => r.id === recordingId) ?? null;
  const getRecording = useCallback(() => {
    if (!recording && typeof recordingId === 'string') {
      recorderDatabase.getRecording(recordingId);
    }
  }, [recorderDatabase, recordingId, recording]);
  const play = useCallback(() => {
    if (recording !== null) {
      recordingPlayer.play(recording);
    }
  }, [recording, recordingPlayer]);
  const humanReadableRecordingSize = useMemo(
    () => filesize(recording?.size ?? 0).toString(),
    [recording]
  );
  const [canvasContainerDimensions, setCanvasContainerDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    getRecording();
  }, [getRecording, recordingId]);
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
  if (recording === null) {
    return null;
  }
  return (
    <>
      <div className="container recording-screen">
        <div className="row">
          <div className="col-md-8 col-xs-12">
            {recorderDatabase.loadingRecordIds.includes(recording.id) ? (
              <ActivityIndicator width={50} />
            ) : (
              <>
                <div className="d-flex">
                  <div className="d-flex align-items-center">
                    <div
                      className="recording-screen-play-button"
                      onClick={
                        recordingPlayer.playing !== null
                          ? recordingPlayer.pause
                          : play
                      }
                    >
                      <Icon
                        name={
                          recordingPlayer.playing !== null
                            ? 'pause'
                            : 'play_arrow'
                        }
                      />
                    </div>
                  </div>
                  <div
                    className="flex-fill mx-3 canvas-container"
                    ref={onCanvasContainerElementMount}
                  >
                    {canvasContainerDimensions !== null ? (
                      <AnalyserNodeView
                        visualizationMode={{
                          type: 'verticalBars',
                          barWidth: 20,
                        }}
                        canvasHeight={256 * window.devicePixelRatio}
                        canvasWidth={
                          canvasContainerDimensions.width *
                          window.devicePixelRatio
                        }
                        isPlaying={recordingPlayer.playing !== null}
                        analyserNode={recordingPlayer.analyserNode()}
                      />
                    ) : null}
                    {recordingPlayer.playing !== null &&
                      recordingPlayer.playing.cursor !== null && (
                        <div className="duration">
                          {secondsToHumanReadable(
                            recordingPlayer.playing.cursor
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </>
            )}
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
                Created at:{' '}
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
