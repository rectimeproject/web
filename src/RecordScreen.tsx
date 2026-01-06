import {
  ChangeEvent,
  ChangeEventHandler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import useInterval from "./useInterval";
import secondsToHumanReadable from "./secondsToHumanReadable";
import useRecordings from "./useRecordings";
import useRecorderContext from "./useRecorderContext";
import useRecorderDatabase from "./useRecorderDatabase";
import {CodecId} from "opus-codec-worker/actions/actions";
import {RecorderStateType} from "./Recorder";
import {filesize} from "filesize";
import Icon from "./Icon";
import TimelineVisualizer from "./components/visualizer/TimelineVisualizer";
import {AnalyserNode, IAudioContext} from "standardized-audio-context";
import {useNavigate} from "react-router";
import useNavigatorStorage from "./useNavigatorStorage";
import ActivityIndicator from "./ActivityIndicator";
import useMediaDevices from "./useMediaDevices";
import useAppSettings from "./useAppSettings";
import useDebounce from "./useDebounce";
import useRecordingNotes from "./useRecordingNotes";
import useDebugAudioVisualizer from "./useDebugAudioVisualizer";
import useTheme from "./useTheme";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";

export default function RecordingListScreen() {
  const theme = useTheme();
  const recordings = useRecordings();
  const recorderContext = useRecorderContext();
  const db = useRecorderDatabase();
  const onStartRecording = useCallback(
    ({encoderId}: {encoderId: CodecId}) => {
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
  const [analyserNode, setAnalyserNode] =
    useState<AnalyserNode<IAudioContext> | null>(null);
  const navigate = useNavigate();
  const navigatorStorage = useNavigatorStorage();
  const goToRecordingListScreen = useCallback(() => {
    navigate("/recordings");
  }, [navigate]);

  // Waveform data for timeline visualization
  const [waveformSamples, setWaveformSamples] = useState<number[]>([]);
  const recording =
    db.recordings.find(r => r.encoderId === recordings.recording?.encoderId) ??
    null;

  // Capture waveform data during recording
  useEffect(() => {
    console.log("[RecordScreen] Waveform capture effect triggered", {
      isRecording: recordings.isRecording,
      hasAnalyserNode: !!analyserNode
    });

    if (!recordings.isRecording || !analyserNode) {
      console.log(
        "[RecordScreen] Clearing waveform samples - not recording or no analyser"
      );
      setWaveformSamples([]);
      return;
    }

    console.log("[RecordScreen] Starting waveform capture");
    analyserNode.fftSize = 2 ** 11; // Higher resolution for better waveform
    analyserNode.smoothingTimeConstant = 0.3; // Smooth out the waveform

    const dataArray = new Uint8Array(analyserNode.fftSize);
    const samplesPerSecond = 20; // Sample 20 times per second
    const intervalMs = 1000 / samplesPerSecond;

    let sampleCount = 0;
    const captureInterval = setInterval(() => {
      // Use time domain data for actual waveform amplitude
      analyserNode.getByteTimeDomainData(dataArray);

      // Calculate RMS (Root Mean Square) for better amplitude representation
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const value = dataArray[i] ?? null;
        if (value !== null) {
          const normalized = (value - 128) / 128; // Center around 0
          sumSquares += normalized * normalized;
        }
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      const amplitude = rms * 255; // Scale back to 0-255 range

      sampleCount++;
      if (sampleCount % 20 === 0) {
        // Log every second
        console.log(
          `[RecordScreen] Captured ${sampleCount} samples, latest amplitude: ${amplitude.toFixed(
            2
          )}`
        );
      }

      setWaveformSamples(prev => [...prev, amplitude]);
    }, intervalMs);

    return () => {
      console.log(
        `[RecordScreen] Stopping waveform capture, total samples: ${sampleCount}`
      );
      clearInterval(captureInterval);
    };
  }, [recordings.isRecording, analyserNode]);
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
  useEffect(() => {
    // if (!db.isGettingRecordings) {
    //   db.getRecordings();
    // }
    recorderContext.recorder.then(recorder => {
      if (recorder === null) {
        return;
      }
      recorder.on("startRecording", onStartRecording);
      const currentState = recorder.currentState();
      switch (currentState.type) {
        case RecorderStateType.Recording:
          db.getRecordingByEncoderId(currentState.encoderId);
          break;
      }
      return recorder;
    });
    return () => {
      recorderContext.recorder.then(async recorder => {
        if (recorder) {
          recorder.off("startRecording", onStartRecording);
        }
      });
    };
  }, [recorderContext, onStartRecording, db]);

  useEffect(() => {
    return () => {
      recorderContext.recorder.then(rec => rec?.stop());
    };
  }, [recorderContext]);
  const {getMoreRecordings} = db;
  useLayoutEffect(() => {
    if (!recordingListScrollViewRef.current) {
      return;
    }
    const {scrollHeight, clientHeight} = recordingListScrollViewRef.current;
    if (scrollHeight === clientHeight) {
      getMoreRecordings();
    }
  }, [getMoreRecordings]);
  /**
   * update current recording in case recording is happening
   */
  const checkRecordingInterval = useInterval(500);
  const recordingSizeOrQuota = useMemo(() => {
    if (recording) {
      return recording.size;
    }
    if (
      navigatorStorage.estimateResult !== null &&
      typeof navigatorStorage.estimateResult.quota === "number"
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
        ? mediaDevices.devices.find(d => d.deviceId === deviceId)
        : mediaDevices.devices[0]) ?? null;

    recordings.startRecording({
      device
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
    e => {
      const device = mediaDevices.devices.find(
        d => d.deviceId === e.target.value
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
    recorderContext.recorder.then(rec => {
      const state = rec?.currentState() ?? null;
      console.log(
        "[RecordScreen] Recorder state:",
        state?.type,
        "has analyserNode:",
        !!(state && "analyserNode" in state && state.analyserNode)
      );

      if (state === null || !("analyserNode" in state) || !state.analyserNode) {
        setAnalyserNode(null);
        return;
      }
      console.log("[RecordScreen] Setting analyserNode from recorder state");
      setAnalyserNode(state.analyserNode);
    });
  }, [recordings.isRecording, recordings.recording, recorderContext]);
  /**
   * enumerate devices
   */
  useEffect(() => {
    if (!mediaDevices.hasLoadedInitialDevices) {
      mediaDevices.enumerateDevices();
    }
  }, [mediaDevices]);
  const recordingNotes = useRecordingNotes();
  const queryClient = useQueryClient();

  // Fetch bookmarks using useQuery
  const {data: recordingBookmarks = []} = useQuery({
    queryKey: ["recordingBookmarks", recording?.id ?? null],
    queryFn: async () => {
      if (recording === null || !recording.id) return [];
      const notes = await recordingNotes.getRecordingNotesByRecordingId(
        recording.id
      );
      return notes.map(n => ({
        id: n.id,
        durationOffset: n.durationOffset,
        title: n.title
      }));
    },
    enabled: recording !== null && !!recording.id
  });

  const [recentBookmark, setRecentBookmark] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Create bookmark using useMutation
  const createBookmarkMutation = useMutation({
    mutationFn: async ({
      recordingId,
      duration
    }: {
      recordingId: string;
      duration: number;
    }) => {
      recordingNotes.createRecordingNote(recordingId, duration);
    },
    onMutate: async ({duration}) => {
      // Optimistic update: add the new bookmark immediately
      const newBookmark = {
        id: crypto.getRandomValues(new Uint32Array(4)).join("-"),
        durationOffset: duration,
        title: ""
      };
      queryClient.setQueryData(
        ["recordingBookmarks", recording?.id],
        (old: typeof recordingBookmarks) => [...(old ?? []), newBookmark]
      );
    },
    onSettled: () => {
      // Refetch to ensure data is up to date
      queryClient.invalidateQueries({
        queryKey: ["recordingBookmarks", recording?.id]
      });
    }
  });

  const createRecordingNote = useCallback(() => {
    if (recording !== null) {
      createBookmarkMutation.mutate({
        recordingId: recording.id,
        duration: recording.duration
      });

      // Visual feedback
      setRecentBookmark(true);
      setTimeout(() => setRecentBookmark(false), 500);
    }
  }, [recording, createBookmarkMutation]);
  return (
    <div className="record-screen">
      {/* Visualizer Section - Full height with centered content */}
      <div className="record-screen__visualizer-section">
        <div
          className="record-screen__visualizer-container"
          ref={onCanvasContainerElementMount}
        >
          {canvasContainerDimensions !== null ? (
            <TimelineVisualizer
              canvasWidth="100%"
              canvasHeight={448}
              samplesPerSecond={20}
              timeWindowSeconds={10}
              waveformSamples={waveformSamples}
              bookmarks={recordingBookmarks}
              currentDuration={recording?.duration ?? 0}
              totalDuration={recording?.duration}
              backgroundColor={theme.colors.background}
              barColor={theme.colors.barColor}
              bookmarkColor={theme.colors.bookmarkColor}
            />
          ) : null}
        </div>

        {/* Metadata Overlay on Visualizer */}
        <div className="record-screen__metadata-overlay">
          <div className="record-screen__duration">
            {secondsToHumanReadable(
              recording !== null ? recording.duration / 1000 : 0
            )}
          </div>
          <div className="record-screen__filesize">
            {filesize(recordingSizeOrQuota).toString()}
          </div>
        </div>
      </div>

      {/* Control Bar - Bottom Fixed */}
      <div className="record-screen__control-bar">
        <div className="record-screen__control-bar-inner">
          {/* Left: Settings button */}
          <button
            className="control-button control-button--ghost"
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Settings"
          >
            <Icon name="settings" />
          </button>

          {/* Center: Record button */}
          <button
            className={`record-button ${
              recordings.isRecording ? "record-button--recording" : ""
            }`}
            onClick={
              recordings.isRecording
                ? recordings.stopRecording
                : startRecording
            }
            aria-label={recordings.isRecording ? "Stop recording" : "Start recording"}
          >
            <div className="record-button__contents">
              {recordings.isStoppingToRecord ||
              recordings.isStartingToRecord ? (
                <ActivityIndicator />
              ) : (
                <Icon name={recordings.isRecording ? "stop" : "mic"} />
              )}
            </div>
          </button>

          {/* Right: Actions */}
          <div className="control-button-group">
            {recordings.recording !== null && (
              <button
                className={`control-button ${
                  recentBookmark ? "control-button--success" : ""
                }`}
                onClick={createRecordingNote}
                aria-label="Add bookmark"
              >
                <Icon name="bookmark_add" />
              </button>
            )}

            <button
              className="control-button"
              onClick={goToRecordingListScreen}
              aria-label="View recordings list"
            >
              <Icon name="list" />
            </button>

            {import.meta.env.DEV && (
              <button
                className="control-button"
                onClick={
                  debugAudioVisualizer.isDebugging
                    ? debugAudioVisualizer.stop
                    : debugAudioVisualizer.start
                }
                aria-label={
                  debugAudioVisualizer.isDebugging
                    ? "Close debug visualizer"
                    : "Open debug visualizer"
                }
              >
                <Icon
                  name={
                    debugAudioVisualizer.isDebugging
                      ? "close"
                      : "remove_red_eye"
                  }
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Settings Panel (Slide-up modal) */}
      {showSettings && (
        <div className="settings-panel">
          <div
            className="settings-panel__backdrop"
            onClick={() => setShowSettings(false)}
          />
          <div className="settings-panel__content">
            <div className="settings-panel__header">
              <h3>Settings</h3>
              <button
                className="control-button control-button--ghost"
                onClick={() => setShowSettings(false)}
                aria-label="Close settings"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="settings-panel__body">
              {recordings.recording !== null && localBitrate !== null && (
                <div className="settings-panel__section">
                  <label
                    htmlFor="bitrate"
                    className="settings-panel__label"
                  >
                    Bitrate
                  </label>
                  <div className="settings-panel__bitrate-control">
                    <input
                      type="range"
                      id="bitrate"
                      className="settings-panel__slider"
                      onChange={onChangeBitrate}
                      value={localBitrate}
                      min={8000}
                      step={1000}
                      max={96000}
                    />
                    <div className="settings-panel__bitrate-value">
                      {localBitrate}
                    </div>
                  </div>
                </div>
              )}

              <div className="settings-panel__section">
                <label
                  htmlFor="microphone_device"
                  className="settings-panel__label"
                >
                  Microphone
                </label>
                <select
                  id="microphone_device"
                  className="settings-panel__select"
                  onChange={onChangeDeviceId}
                  value={deviceId ?? ""}
                >
                  <option value="">Select microphone</option>
                  {mediaDevices.devices
                    .filter(d => d.kind === "audioinput")
                    .map(d => (
                      <option
                        key={d.deviceId}
                        value={d.deviceId}
                      >
                        {d.label}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
