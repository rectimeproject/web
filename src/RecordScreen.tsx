import {
  ChangeEventHandler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense
} from "react";
import secondsToHumanReadable from "./secondsToHumanReadable.js";
import useRecordings from "./useRecordings.js";
import useRecorderContext from "./useRecorderContext.js";
import useRecorderDatabase from "./useRecorderDatabase.js";
import {CodecId} from "opus-codec-worker/actions/actions.js";
import {filesize} from "filesize";
import Icon from "./Icon.js";
import {useNavigate} from "react-router";
import useNavigatorStorage from "./useNavigatorStorage.js";
import ActivityIndicator from "./ActivityIndicator.js";
import useMediaDevices from "./useMediaDevices.js";
import useAppSettings from "./useAppSettings.js";
import useRecordingNotes from "./useRecordingNotes.js";
import useTheme from "./useTheme.js";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {randomUUID} from "./lib/randomUUID.js";
import {useDebounceCallback} from "usehooks-ts";
import {useGetRecordingByEncoderId} from "./hooks/queries/useRecordingQuery.js";
import clsx from "clsx";
import {IRecordingTimelineState} from "./components/visualizer/TimelineVisualizer.js";

// Lazy load heavy visualizer component
const TimelineVisualizer = lazy(
  () => import("./components/visualizer/TimelineVisualizer.js")
);

export default function RecordScreen() {
  const theme = useTheme();
  const recorderContext = useRecorderContext();
  const db = useRecorderDatabase();
  const [encoderId, setEncoderId] = useState<string | null>(null);
  const onStartRecording = useCallback(
    ({encoderId}: {encoderId: CodecId}) => {
      setEncoderId(encoderId);
    },
    [setEncoderId]
  );
  const getRecordingByEncoderId = useGetRecordingByEncoderId(encoderId);
  const recording = getRecordingByEncoderId.data ?? null;
  const mediaDevices = useMediaDevices();
  const recordingListScrollViewRef = useRef<HTMLDivElement>(null);
  const visualizerState = useRef<IRecordingTimelineState>({
    analyserNode: null
  });
  const navigate = useNavigate();
  const navigatorStorage = useNavigatorStorage();
  const goToRecordingListScreen = useCallback(() => {
    navigate("/recordings");
  }, [navigate]);
  const recordings = useRecordings();

  const [canvasContainerDimensions, setCanvasContainerDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const recordingSizeOrQuota = useMemo(() => {
    if (recording !== null) {
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
  /**
   * if local bitrate changes, change current recording bitrate
   */
  const mutateBitrate = useDebounceCallback(() => {
    if (
      localBitrate === null ||
      recording === null ||
      recordings.setBitrate.isPending
    ) {
      return;
    }
    recordings.setBitrate.mutate({
      encoderId: recording.encoderId,
      newBitrate: localBitrate
    });
  }, 1000);
  const onChangeBitrate = useCallback<ChangeEventHandler<HTMLInputElement>>(
    e => {
      const newBitrate = e.target.valueAsNumber;
      if (
        !Number.isInteger(newBitrate) ||
        Number.isNaN(newBitrate) ||
        !Number.isFinite(newBitrate)
      ) {
        return;
      }
      mutateBitrate();
      setLocalBitrate(newBitrate);
    },
    [mutateBitrate]
  );
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const {audioContext} = recorderContext;
  const startRecording = useCallback(() => {
    const device =
      (deviceId === null
        ? mediaDevices.devices.find(d => d.deviceId === deviceId)
        : mediaDevices.devices[0]) ?? null;

    if (recordings.startRecording.isPending) {
      return;
    }

    recordings.startRecording.mutate(
      {
        device
      },
      {
        async onSuccess(data) {
          const initialBitrate = data?.bitrate ?? null;
          if (initialBitrate === null) {
            return;
          }
          setLocalBitrate(initialBitrate);
          await audioContext.resume();
        }
      }
    );
  }, [recordings, audioContext, deviceId, mediaDevices, setLocalBitrate]);
  const stopRecording = useCallback(() => {
    if (recordings.stopRecording.isPending) {
      return;
    }

    recordings.stopRecording.mutate(void 0, {
      onSuccess: async () => {
        await audioContext.suspend();
        setEncoderId(null);
      }
    });
  }, [recordings, audioContext]);
  const appSettings = useAppSettings();
  const onChangeDeviceId = useCallback<ChangeEventHandler<HTMLSelectElement>>(
    e => {
      const device =
        mediaDevices.devices.find(d => d.deviceId === e.target.value) ?? null;
      setDeviceId(device?.deviceId ?? null);
      if (device === null) {
        return;
      }
      recordings.setMicrophone.mutate(device);
      appSettings.setPreferredDevice.mutate({device});
    },
    [mediaDevices.devices, setDeviceId, appSettings, recordings]
  );
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
        visualizerState.current.analyserNode = null;
        return;
      }
      console.log("[RecordScreen] Setting analyserNode from recorder state");
      visualizerState.current.analyserNode = state.analyserNode;
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

  const {getMoreRecordings} = db;
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
        id: randomUUID(),
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

  useEffect(() => {
    const startRecordingCallback = onStartRecording;
    const onEncodedCallback = async () => {
      await getRecordingByEncoderId.refetch({cancelRefetch: true});
    };
    const pendingRecorder = recorderContext.recorder.then(recorder => {
      if (recorder === null) {
        return null;
      }
      recorder
        .on("startRecording", startRecordingCallback)
        .on("encoded", onEncodedCallback);
      return recorder;
    });
    return () => {
      pendingRecorder.then(async recorder => {
        if (recorder === null) {
          return;
        }
        recorder.off("startRecording", startRecordingCallback);
        recorder.off("encoded", onEncodedCallback);
      });
    };
  }, [
    getRecordingByEncoderId,
    recorderContext,
    onStartRecording,
    queryClient,
    db
  ]);

  useEffect(() => {
    return () => {
      recorderContext.recorder.then(rec => rec?.stop());
    };
  }, [recorderContext]);
  // Use ResizeObserver to get actual dimensions after layout
  useEffect(() => {
    const element = canvasContainerRef.current;
    console.log("[RecordScreen] ResizeObserver setup, element:", element);
    if (!element) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const {width, height} = entry.contentRect;
        console.log("[RecordScreen] ResizeObserver fired:", width, height);
        if (width > 0 && height > 0) {
          setCanvasContainerDimensions({width, height});
        }
      }
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!recordingListScrollViewRef.current) {
      return;
    }
    const {scrollHeight, clientHeight} = recordingListScrollViewRef.current;
    if (scrollHeight === clientHeight) {
      getMoreRecordings();
    }
  }, [getMoreRecordings]);
  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-64px)] bg-white dark:bg-black overflow-hidden">
      {/* Visualizer Section - Full height with centered content */}
      <div
        className={clsx(
          "flex-1",
          "flex",
          "flex-col",
          "justify-center",
          "items-center",
          "px-4",
          "py-8",
          "md:px-6",
          "relative",
          "overflow-hidden",
          "md:gap-0",
          "gap-4"
        )}
      >
        <div
          className={clsx(
            "w-full",
            "lg:max-w-300",
            "h-[calc(60vh)]",
            "lg:h-96",
            "bg-gray-50",
            "dark:bg-gray-900",
            "rounded-3xl",
            "shadow-lg-apple",
            "overflow-hidden",
            "transition-all",
            "duration-300",
            "relative",
            "hover:shadow-xl-apple",
            "hover:-translate-y-0.5"
          )}
          ref={canvasContainerRef}
        >
          {canvasContainerDimensions !== null ? (
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <ActivityIndicator width={30} />
                </div>
              }
            >
              <TimelineVisualizer
                canvasWidth={canvasContainerDimensions.width}
                canvasHeight={canvasContainerDimensions.height}
                mutableStateRef={visualizerState}
                backgroundColor={theme.colors.background}
                barColor={theme.colors.barColor}
              />
            </Suspense>
          ) : null}
        </div>

        {/* Metadata Overlay on Visualizer */}
        <div
          className={clsx(
            "md:absolute",
            "md:bottom-8",
            "md:left-1/2",
            "md:-translate-x-1/2",
            "md:w-[calc(100%-3rem)]",
            "md:sm:w-[calc(100%-2rem)]",
            "md:max-w-300",
            "flex",
            "flex-row",
            "justify-between",
            "gap-2",
            "sm:gap-0",
            "items-start",
            "sm:items-center",
            "pointer-events-none",
            "z-10"
          )}
        >
          <div className="font-mono text-2xl sm:text-base font-semibold text-gray-900 dark:text-gray-100 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl backdrop-saturate-150 px-5 py-3 sm:px-3 sm:py-2 rounded-xl shadow-md-apple transition-all duration-200 hover:-translate-y-px hover:shadow-lg-apple">
            {secondsToHumanReadable(
              recording !== null ? recording.duration / 1000 : 0
            )}
          </div>
          <div className="font-mono text-2xl sm:text-base font-semibold text-gray-900 dark:text-gray-100 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl backdrop-saturate-150 px-5 py-3 sm:px-3 sm:py-2 rounded-xl shadow-md-apple transition-all duration-200 hover:-translate-y-px hover:shadow-lg-apple">
            {filesize(recordingSizeOrQuota).toString()}
          </div>
        </div>
      </div>

      {/* Control Bar - Bottom Fixed */}
      <div className="flex lg:flex-row flex-col px-4 py-5 sm:px-3 sm:py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_16px_rgb(0_0_0/0.04)]">
        <div className="flex flex-row items-center lg:max-w-300 mx-auto justify-between gap-4 sm:gap-2">
          {/* Left: Settings button */}
          <button
            className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center cursor-pointer transition-all duration-150 text-gray-900 dark:text-gray-100 hover:scale-105 active:scale-95"
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Settings"
          >
            <Icon name="settings" />
          </button>

          {/* Center: Record button */}
          <button
            className={`w-20 h-20 sm:w-17 sm:h-17 rounded-full ${recordings.isRecording ? "bg-linear-to-br from-orange-500 to-orange-400 animate-[pulse-recording_2s_ease-in-out_infinite]" : "bg-linear-to-br from-red-600 to-red-400"} border-0 shadow-lg-apple flex items-center justify-center cursor-pointer transition-all duration-200 text-white relative hover:scale-105 active:scale-98`}
            onClick={recordings.isRecording ? stopRecording : startRecording}
            aria-label={
              recordings.isRecording ? "Stop recording" : "Start recording"
            }
          >
            <div className="flex items-center justify-center text-[2rem] sm:text-[1.5rem]">
              {recordings.stopRecording.isPending ||
              recordings.startRecording.isPending ? (
                <ActivityIndicator />
              ) : (
                <Icon name={recordings.isRecording ? "stop" : "mic"} />
              )}
            </div>
          </button>

          {/* Right: Actions */}
          <div className="flex gap-2 sm:gap-1">
            {recordings.recording !== null && (
              <button
                className={`w-11 h-11 sm:w-10 sm:h-10 rounded-full ${recentBookmark ? "bg-green-500 text-white animate-[pulse-success_0.5s_ease-in-out]" : "bg-gray-100 dark:bg-gray-800"} flex items-center justify-center cursor-pointer transition-all duration-150 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-105 active:scale-95`}
                onClick={createRecordingNote}
                aria-label="Add bookmark"
              >
                <Icon name="bookmark_add" />
              </button>
            )}

            <button
              className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center cursor-pointer transition-all duration-150 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-105 active:scale-95"
              onClick={goToRecordingListScreen}
              aria-label="View recordings list"
            >
              <Icon name="list" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel (Slide-up modal) */}
      {showSettings && (
        <div className="fixed inset-0 z-400">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_200ms_cubic-bezier(0.4,0,0.2,1)]"
            onClick={() => setShowSettings(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[60vh] sm:max-h-[80vh] bg-white dark:bg-gray-900 rounded-t-3xl px-6 py-6 sm:px-5 sm:py-5 shadow-xl-apple animate-[slideUp_300ms_cubic-bezier(0.4,0,0.2,1)] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold m-0 text-gray-900 dark:text-gray-100">
                Settings
              </h3>
              <button
                className="w-11 h-11 rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center cursor-pointer transition-all duration-150 text-gray-900 dark:text-gray-100 hover:scale-105 active:scale-95"
                onClick={() => setShowSettings(false)}
                aria-label="Close settings"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="flex flex-col gap-6">
              {recordings.recording !== null && localBitrate !== null && (
                <div className="flex flex-col gap-3">
                  <label
                    htmlFor="bitrate"
                    className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Bitrate
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      id="bitrate"
                      className="flex-1 h-1 rounded-sm bg-gray-200 dark:bg-gray-700 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 dark:[&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-120 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 dark:[&::-moz-range-thumb]:bg-blue-400 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:duration-150 [&::-moz-range-thumb]:hover:scale-120"
                      onChange={onChangeBitrate}
                      value={localBitrate}
                      min={8000}
                      step={1000}
                      max={96000}
                    />
                    <div className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100 min-w-16 text-right">
                      {localBitrate}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <label
                  htmlFor="microphone_device"
                  className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Microphone
                </label>
                <select
                  id="microphone_device"
                  className="px-4 py-3 text-base font-sans text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer transition-all duration-150 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(0,122,255,0.1)]"
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
