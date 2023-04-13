import { useParams } from 'react-router';
import useRecorderDatabase from './useRecorderDatabase';
import { useCallback, useEffect } from 'react';
import useRecordingPlayer from './useRecordingPlayer';
import ActivityIndicator from './ActivityIndicator';
import { DateTime } from 'luxon';
import secondsToHumanReadable from './secondsToHumanReadable';
import AnalyserNodeView from './AnalyserNodeView';
import Icon from './Icon';

export default function RecordingScreen() {
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
  useEffect(() => {
    getRecording();
  }, [getRecording, recordingId]);
  const play = useCallback(() => {
    if (recording !== null) {
      recordingPlayer.play(recording);
    }
  }, [recording, recordingPlayer]);
  if (recording === null) {
    return null;
  }
  return (
    <>
      <div className="container recording-screen">
        <div className="row">
          <div className="col-lg-12">
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
                  <div className="flex-fill mx-3">
                    <AnalyserNodeView
                      isPlaying={recordingPlayer.playing !== null}
                      analyserNode={recordingPlayer.analyserNode()}
                    />
                  </div>
                  <div>
                    <div>
                      {DateTime.fromJSDate(recording.createdAt).toLocaleString(
                        DateTime.DATETIME_SHORT
                      )}
                    </div>
                    <div>
                      {secondsToHumanReadable(recording.duration / 1000)}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
