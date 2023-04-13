import {
  UIEventHandler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import useInterval from './useInterval';
import useRecordingPlayer from './useRecordingPlayer';
import secondsToHumanReadable from './secondsToHumanReadable';
import useRecordings from './useRecordings';
import useRecorderContext from './useRecorderContext';
import useRecorderDatabase from './useRecorderDatabase';
import { CodecId } from 'opus-codec-worker/actions/actions';
import { Link } from 'react-router-dom';
import { RecorderStateType } from './Recorder';
import classNames from 'classnames';
import Icon from './Icon';

export default function RecordingListScreen() {
  const recordings = useRecordings();
  const recorderContext = useRecorderContext();
  const db = useRecorderDatabase();
  const onStartRecording = useCallback(
    ({ encoderId }: { encoderId: CodecId }) => {
      db.getRecordingByEncoderId(encoderId);
    },
    [db]
  );
  useEffect(() => {
    // if (!db.isGettingRecordings) {
    //   db.getRecordings();
    // }
    recorderContext.recorder.then((recorder) => {
      if (recorder === null) {
        return;
      }
      recorder.on('startRecording', onStartRecording);
      const currentState = recorder.currentState();
      switch (currentState.type) {
        case RecorderStateType.Recording:
          db.getRecordingByEncoderId(currentState.encoderId);
          break;
      }
      return recorder;
    });
    return () => {
      recorderContext.recorder.then((recorder) => {
        if (recorder) {
          recorder.off('startRecording', onStartRecording);
        }
      });
    };
  }, [recorderContext, onStartRecording, db]);
  const recordingListScrollViewRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!recordingListScrollViewRef.current) {
      return;
    }
    const { scrollHeight, clientHeight } = recordingListScrollViewRef.current;
    if (scrollHeight === clientHeight) {
      db.getMoreRecordings();
    }
  }, [db]);
  const onScrollRecordingList: UIEventHandler<HTMLDivElement> = (e) => {
    const pct =
      (e.currentTarget.scrollTop /
        (e.currentTarget.scrollHeight - e.currentTarget.clientHeight)) *
      100;
    if (pct >= 98) {
      db.getMoreRecordings();
    }
  };
  const updateCurrentRecording = useCallback(() => {
    if (recordings.recording !== null) {
      db.getRecordingByEncoderId(recordings.recording.encoderId);
    }
  }, [db, recordings]);
  const checkRecordingInterval = useInterval(1000);
  const player = useRecordingPlayer();
  const recordingList = useMemo(
    () =>
      db.recordings.map((r) => ({
        id: r.id,
        size: r.size,
        duration: secondsToHumanReadable(r.duration / 1000),
        play: () => player.play(r),
        pause: () => player.pause(),
        isRecording: recordings.recording?.encoderId === r.encoderId,
      })),
    [db.recordings, player, recordings]
  );
  useEffect(() => {
    checkRecordingInterval.setCallback(updateCurrentRecording);
    checkRecordingInterval.start();
  }, [checkRecordingInterval, updateCurrentRecording]);
  return (
    <div className="container">
      <div className="row">
        <div className="col-lg-12">
          <button
            className="btn btn-primary mb-3"
            disabled={recordings.isStartingToRecord}
            onClick={
              recordings.isRecording
                ? recordings.stopRecording
                : recordings.startRecording
            }
          >
            {recordings.isStartingToRecord
              ? 'Starting...'
              : recordings.isRecording
              ? 'Stop recording'
              : 'Start recording'}
          </button>
        </div>
      </div>
      <div className="row">
        <div
          ref={recordingListScrollViewRef}
          className="col-lg-12"
          style={{
            overflow: 'auto',
            maxHeight: '20rem',
          }}
          onScroll={onScrollRecordingList}
        >
          {recordingList.map((r) => (
            <div
              className={classNames('d-flex recording-item', {
                'mb-3': r !== recordingList[recordingList.length - 1],
              })}
              key={r.id}
            >
              <div className="justify-content-center align-items-center d-flex">
                <Icon name="save" />
              </div>
              <div className="flex-fill"></div>
              <div>
                <div>{r.duration}</div>
                {r.isRecording ? null : (
                  <div>
                    <Link to={`/recording/${r.id}`}>
                      {`#${r.id.split('-')[0]}`}
                    </Link>
                  </div>
                )}
                <div>{r.size} bytes</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
