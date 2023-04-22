import {
  ChangeEvent,
  ChangeEventHandler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import useInterval from './useInterval';
import secondsToHumanReadable from './secondsToHumanReadable';
import useRecordings from './useRecordings';
import useRecorderContext from './useRecorderContext';
import useRecorderDatabase from './useRecorderDatabase';
import { CodecId } from 'opus-codec-worker/actions/actions';
import { RecorderStateType } from './Recorder';
import { filesize } from 'filesize';
import Icon from './Icon';
import AnalyserNodeView from './AnalyserNodeView';
import { AnalyserNode, IAudioContext } from 'standardized-audio-context';
import { useNavigate } from 'react-router';
import useNavigatorStorage from './useNavigatorStorage';
import ActivityIndicator from './ActivityIndicator';
import useMediaDevices from './useMediaDevices';
import useAppSettings from './useAppSettings';
import useDebounce from './useDebounce';
import useRecordingNotes from './useRecordingNotes';
import useDebugAudioVisualizer from './useDebugAudioVisualizer';

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
  const debugAudioVisualizer = useDebugAudioVisualizer();
  const mediaDevices = useMediaDevices();
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
  const { getMoreRecordings } = db;
  useLayoutEffect(() => {
    if (!recordingListScrollViewRef.current) {
      return;
    }
    const { scrollHeight, clientHeight } = recordingListScrollViewRef.current;
    if (scrollHeight === clientHeight) {
      getMoreRecordings();
    }
  }, [getMoreRecordings]);
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
  const [localBitrate, setLocalBitrate] = useState<number | null>(null);
  const onChangeBitrate = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (
      Number.isInteger(e.target.valueAsNumber) ||
      !Number.isNaN(e.target.valueAsNumber)
    ) {
      setLocalBitrate(e.target.valueAsNumber);
    }
  }, []);
  /**
   * if current recording bitrate changes, change local bitrate
   */
  const currentRecordingStateBitrate = recordings.recording?.bitrate ?? null;
  useEffect(() => {
    if (currentRecordingStateBitrate !== null) {
      setLocalBitrate(currentRecordingStateBitrate);
    }
  }, [setLocalBitrate, currentRecordingStateBitrate]);
  /**
   * if local bitrate changes, change current recording bitrate
   */
  const debounce = useDebounce(1000);
  useEffect(() => {
    debounce.run(() => {
      if (localBitrate !== null) {
        recordings.setBitrate(localBitrate);
      }
    });
  }, [localBitrate, debounce, recordings]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const startRecording = useCallback(() => {
    const device =
      (deviceId === null
        ? mediaDevices.devices.find((d) => d.deviceId === deviceId)
        : mediaDevices.devices[0]) ?? null;

    recordings.startRecording({
      device,
    });
  }, [recordings, deviceId, mediaDevices]);
  const appSettings = useAppSettings();
  useEffect(() => {
    if (appSettings.preferredDevice !== null) {
      setDeviceId(appSettings.preferredDevice.deviceId);
    } else {
      appSettings.getPreferredDevice();
    }
  }, [appSettings, setDeviceId]);
  const onChangeDeviceId = useCallback<ChangeEventHandler<HTMLSelectElement>>(
    (e) => {
      const device = mediaDevices.devices.find(
        (d) => d.deviceId === e.target.value
      );
      if (device) {
        setDeviceId(device.deviceId);
        recordings.setMicrophone(device);
        appSettings.setPreferredDevice(device);
      }
    },
    [mediaDevices.devices, setDeviceId, appSettings, recordings]
  );
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
    if (!navigatorStorage.hasLoadedInitialEstimation) {
      navigatorStorage.estimate();
    }
  }, [navigatorStorage]);
  useEffect(() => {
    recorderContext.recorder.then((rec) => {
      const state = rec?.currentState() ?? null;
      if (state === null || !('analyserNode' in state) || !state.analyserNode)
        return;
      analyserNodeRef.current = state.analyserNode;
    });
  }, [recording, recorderContext, analyserNodeRef]);
  /**
   * enumerate devices
   */
  useEffect(() => {
    if (!mediaDevices.hasLoadedInitialDevices) {
      mediaDevices.enumerateDevices();
    }
  }, [mediaDevices]);
  const recordingNotes = useRecordingNotes();
  const createRecordingNote = useCallback(() => {
    if (recording) {
      console.log(recording.duration);
      recordingNotes.createRecordingNote(recording.id, recording.duration);
    }
  }, [recordingNotes, recording]);
  return (
    <div className="recording-list-screen">
      <div className="container">
        <div className="row">
          <div className="d-flex col-md-8">
            <div className="d-flex flex-column flex-fill">
              <div className="flex-fill">
                <div className="canvas-container d-flex justify-content-end">
                  <AnalyserNodeView
                    canvasWidth="100%"
                    visualizationMode={visualizationMode}
                    // isPlaying={recording !== null}
                    isPlaying
                    analyserNode={
                      recording === null
                        ? debugAudioVisualizer.analyserNode
                        : analyserNodeRef.current
                    }
                  />
                </div>
              </div>
              <div className="d-flex align-items-center">
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
                        : startRecording
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
                <div className="button" onClick={goToRecordingListScreen}>
                  <Icon name="list" />
                </div>
                {process.env['NODE_ENV'] === 'development' && (
                  <div
                    className="button"
                    onClick={
                      debugAudioVisualizer.isDebugging
                        ? debugAudioVisualizer.stop
                        : debugAudioVisualizer.start
                    }
                  >
                    <Icon
                      name={
                        debugAudioVisualizer.isDebugging
                          ? 'close'
                          : 'remove_red_eye'
                      }
                    />
                  </div>
                )}
                {recordings.recording !== null && (
                  <div className="button" onClick={createRecordingNote}>
                    <Icon name="add" />
                  </div>
                )}
              </div>

              {/* <div className="d-flex recording-list-screen-bottom-bar">
                <div className="button" onClick={goToRecordingListScreen}>
                  <Icon name="list" />
                </div>
                {process.env['NODE_ENV'] === 'development' && (
                  <div className="button" onClick={debugAudioVisualizer.start}>
                    <Icon name="leaderboard" />
                  </div>
                )}
                <div className="button" onClick={goToRecordingListScreen}>
                  <Icon name="list" />
                </div>
                {recordings.recording !== null && (
                  <div className="button" onClick={createRecordingNote}>
                    <Icon name="add" />
                  </div>
                )}
              </div> */}
            </div>
          </div>
          <div className="col-md-4">
            <h4>Additional options</h4>
            {recordings.recording !== null && localBitrate !== null && (
              <div className="mb-3">
                <label htmlFor="bitrate" className="form-label">
                  Bitrate
                </label>
                <div className="d-flex">
                  <input
                    type="range"
                    id="bitrate"
                    className="form-range flex-fill"
                    onChange={onChangeBitrate}
                    value={localBitrate}
                    min={8000}
                    step={1000}
                    max={96000}
                  />
                  <div className="mx-3">{localBitrate}</div>
                </div>
              </div>
            )}
            <div>
              <label htmlFor="microphone_device" className="form-label">
                Microphone
              </label>
              <select
                id="microphone_device"
                className="form-select"
                onChange={onChangeDeviceId}
                value={deviceId ?? ''}
              >
                <option></option>
                {mediaDevices.devices
                  .filter((d) => d.kind === 'audioinput')
                  .map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
