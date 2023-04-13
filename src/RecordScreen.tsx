import {
  // UIEventHandler,
  // useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import useInterval from './useInterval';
import secondsToHumanReadable from './secondsToHumanReadable';
import useRecordings from './useRecordings';
import useRecorderContext from './useRecorderContext';
import useRecorderDatabase from './useRecorderDatabase';
import { CodecId } from 'opus-codec-worker/actions/actions';
import { RecorderStateType } from './Recorder';
// import useRecordingPlayer from './useRecordingPlayer';
// import { Link } from 'react-router-dom';
// import classNames from 'classnames';
// import Icon from './Icon';
import { filesize } from 'filesize';
import Icon from './Icon';
import AnalyserNodeView from './AnalyserNodeView';
import { AnalyserNode, IAudioContext } from 'standardized-audio-context';
import { useNavigate } from 'react-router';
import useNavigatorStorage from './useNavigatorStorage';
import ActivityIndicator from './ActivityIndicator';

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
  const recordingListScrollViewRef = useRef<HTMLDivElement>(null);
  const updateCurrentRecording = useCallback(() => {
    if (recordings.recording !== null) {
      db.getRecordingByEncoderId(recordings.recording.encoderId);
    }
  }, [db, recordings]);
  const analyserNodeRef = useRef<AnalyserNode<IAudioContext> | null>(null);
  const navigate = useNavigate();
  const navigatorStorage = useNavigatorStorage();
  const goToRecordingListScreen = useCallback(() => {
    navigate('/recordings');
  }, [navigate]);
  const visualizationMode = useMemo(
    () =>
      ({
        barWidth: 10,
        type: 'verticalBars',
      } as const),
    []
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
      recorderContext.recorder.then(async (recorder) => {
        if (recorder) {
          recorder.off('startRecording', onStartRecording);
        }
      });
    };
  }, [recorderContext, onStartRecording, db]);

  useEffect(() => {
    return () => {
      recorderContext.recorder.then((rec) => rec?.stop());
    };
  }, [recorderContext]);
  useLayoutEffect(() => {
    if (!recordingListScrollViewRef.current) {
      return;
    }
    const { scrollHeight, clientHeight } = recordingListScrollViewRef.current;
    if (scrollHeight === clientHeight) {
      db.getMoreRecordings();
    }
  }, [db.getMoreRecordings]);
  /**
   * update current recording in case recording is happening
   */
  const checkRecordingInterval = useInterval(500);
  const recording =
    db.recordings.find(
      (r) => r.encoderId === recordings.recording?.encoderId
    ) ?? null;
  const recordingSizeOrQuota = useMemo(() => {
    if (recording) {
      return recording.size;
    }
    if (
      navigatorStorage.estimateResult !== null &&
      typeof navigatorStorage.estimateResult.quota === 'number'
    ) {
      return navigatorStorage.estimateResult.quota;
    }
    return 0;
  }, [navigatorStorage, recording]);
  useEffect(() => {
    checkRecordingInterval.setCallback(updateCurrentRecording);
  }, [checkRecordingInterval, updateCurrentRecording]);
  useEffect(() => {
    if (recordings.isRecording) {
      checkRecordingInterval.start();
    } else {
      checkRecordingInterval.stop();
    }
  }, [recordings.isRecording, checkRecordingInterval]);
  useEffect(() => {
    navigatorStorage.estimate();
    recorderContext.recorder.then((rec) => {
      const state = rec?.currentState() ?? null;
      if (state === null || !('analyserNode' in state) || !state.analyserNode)
        return;
      analyserNodeRef.current = state.analyserNode;
    });
  }, [recording, navigatorStorage, recorderContext, analyserNodeRef]);
  return (
    <div className="recording-list-screen">
      <div className="container">
        <div className="row">
          <div className="col-lg-12 d-flex">
            <div className="d-flex flex-column flex-fill">
              <div className="flex-fill">
                <div className="canvas-container d-flex justify-content-end">
                  <AnalyserNodeView
                    canvasWidth="100%"
                    visualizationMode={visualizationMode}
                    isPlaying={recording !== null}
                    analyserNode={analyserNodeRef.current}
                  />
                </div>
              </div>
              <div className="d-flex">
                <div className="flex-fill d-flex align-items-center justify-content-end">
                  {secondsToHumanReadable(
                    recording !== null ? recording.duration / 1000 : 0
                  )}
                </div>
                <div className="flex-fill d-flex justify-content-center">
                  <div
                    className="record-button"
                    onClick={
                      recordings.isRecording
                        ? recordings.stopRecording
                        : recordings.startRecording
                    }
                  >
                    {recordings.isStoppingToRecord ||
                    recordings.isStartingToRecord ? (
                      <ActivityIndicator />
                    ) : (
                      <Icon name={recordings.isRecording ? 'stop' : 'mic'} />
                    )}
                  </div>
                </div>
                <div className="flex-fill d-flex align-items-center justify-content-start">
                  {filesize(recordingSizeOrQuota).toString()}
                </div>
              </div>

              <div className="recording-list-screen-bottom-bar">
                <div className="button" onClick={goToRecordingListScreen}>
                  <Icon name="list" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    // <div className="container">
    //   <div className="row">
    //     <div className="col-lg-12">
    //       <button
    //         className="btn btn-primary mb-3"
    //         disabled={recordings.isStartingToRecord}
    //         onClick={
    //           recordings.isRecording
    //             ? recordings.stopRecording
    //             : recordings.startRecording
    //         }
    //       >
    //         {recordings.isStartingToRecord
    //           ? 'Starting...'
    //           : recordings.isRecording
    //           ? 'Stop recording'
    //           : 'Start recording'}
    //       </button>
    //     </div>
    //   </div>
    //   <div className="row">
    //     <div
    //       ref={recordingListScrollViewRef}
    //       className="col-lg-12"
    //       style={{
    //         overflow: 'auto',
    //         maxHeight: '20rem',
    //       }}
    //       onScroll={onScrollRecordingList}
    //     >
    //       {recordingList.map((r) => (
    //         <div
    //           className={classNames('d-flex recording-item', {
    //             'mb-3': r !== recordingList[recordingList.length - 1],
    //           })}
    //           key={r.id}
    //         >
    //           <div className="justify-content-center align-items-center d-flex">
    //             <Icon name="save" />
    //           </div>
    //           <div className="flex-fill"></div>
    //           <div>
    //             <div>{r.duration}</div>
    //             {r.isRecording ? null : (
    //               <div>
    //                 <Link to={`/recording/${r.id}`}>
    //                   {`#${r.id.split('-')[0]}`}
    //                 </Link>
    //               </div>
    //             )}
    //             <div>{r.size} bytes</div>
    //           </div>
    //         </div>
    //       ))}
    //     </div>
    //   </div>
    // </div>
  );
}
