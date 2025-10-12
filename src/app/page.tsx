"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import NavigationBar from "@/components/NavigationBar";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import ActivityIndicator from "@/components/ui/ActivityIndicator";
import useInterval from "@/hooks/useInterval";
import useRecordings from "@/hooks/useRecordings";
import useRecorderContext from "@/hooks/useRecorderContext";
import useRecorderDatabase from "@/hooks/useRecorderDatabase";
import useNavigatorStorage from "@/hooks/useNavigatorStorage";
import useMediaDevices from "@/hooks/useMediaDevices";
import useAppSettings from "@/hooks/useAppSettings";
import useDebounce from "@/hooks/useDebounce";
import useRecordingNotes from "@/hooks/useRecordingNotes";
import useDebugAudioVisualizer from "@/hooks/useDebugAudioVisualizer";
import secondsToHumanReadable from "@/lib/secondsToHumanReadable";
import { filesize } from "filesize";
import { CodecId } from "opus-codec-worker/actions/actions";
import { RecorderStateType } from "@/lib/Recorder";
import { AnalyserNode, IAudioContext } from "standardized-audio-context";
import dynamic from "next/dynamic";

// Dynamic import for AnalyserNodeView (if it uses canvas)
const AnalyserNodeView = dynamic(
  () => import("@/components/AnalyserNodeView"),
  {
    ssr: false,
  }
);

export default function RecordScreen() {
  const router = useRouter();
  const recordings = useRecordings();
  const recorderContext = useRecorderContext();
  const db = useRecorderDatabase();
  const debugAudioVisualizer = useDebugAudioVisualizer();
  const mediaDevices = useMediaDevices();
  const navigatorStorage = useNavigatorStorage();
  const analyserNodeRef = useRef<AnalyserNode<IAudioContext> | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [recordingSize, setRecordingSize] = useState<number>(0);

  const onStartRecording = useCallback(
    ({ encoderId }: { encoderId: CodecId }) => {
      db.getRecordingByEncoderId(encoderId);
    },
    [db]
  );

  const updateCurrentRecording = useCallback(() => {
    if (recordings.recording !== null) {
      db.getRecordingByEncoderId(recordings.recording.encoderId);
    }
  }, [db, recordings]);

  const goToRecordingListScreen = useCallback(() => {
    router.push("/recordings");
  }, [router]);

  const visualizationMode = useMemo(
    () =>
      ({
        barWidth: 10,
        type: "verticalBars",
      } as const),
    []
  );

  useEffect(() => {
    recorderContext.recorder.then((recorder) => {
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
      recorderContext.recorder.then(async (recorder) => {
        if (recorder) {
          recorder.off("startRecording", onStartRecording);
        }
      });
    };
  }, [recorderContext, onStartRecording, db]);

  useEffect(() => {
    return () => {
      recorderContext.recorder.then((rec) => rec?.stop());
    };
  }, [recorderContext]);

  useInterval(() => {
    if (recordings.recording) {
      setRecordingDuration(recordings.recording.duration);
      setRecordingSize(recordings.recording.size);
    }
  }, 100);

  const startRecording = useCallback(async () => {
    const recorder = await recorderContext.recorder;
    if (!recorder) return;

    try {
      await recorder.record();
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, [recorderContext]);

  const stopRecording = useCallback(async () => {
    const recorder = await recorderContext.recorder;
    if (!recorder) return;

    try {
      await recorder.stop();
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  }, [recorderContext]);

  const pauseRecording = useCallback(async () => {
    const recorder = await recorderContext.recorder;
    if (!recorder) return;

    try {
      await recorder.pause();
    } catch (error) {
      console.error("Failed to pause recording:", error);
    }
  }, [recorderContext]);

  const isRecording = recordings.recording !== null;

  return (
    <>
      <NavigationBar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Main Recording Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="mic" size="lg" className="text-primary" />
                Audio Recorder
              </CardTitle>
              <CardDescription>
                Record high-quality audio with Opus codec
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Visualizer */}
              <div
                className="relative bg-muted rounded-lg overflow-hidden"
                style={{ height: "256px" }}
              >
                {isRecording && analyserNodeRef.current ? (
                  <AnalyserNodeView
                    visualizationMode={visualizationMode}
                    canvasHeight={256 * window.devicePixelRatio}
                    canvasWidth={800 * window.devicePixelRatio}
                    isPlaying={isRecording}
                    analyserNode={analyserNodeRef.current}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-muted-foreground">
                      <Icon name="graphic_eq" size="xl" className="mb-2" />
                      <p>Audio visualization will appear here</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Recording Info */}
              {isRecording && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Duration
                    </div>
                    <div className="text-2xl font-bold">
                      {secondsToHumanReadable(recordingDuration / 1000)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Size</div>
                    <div className="text-2xl font-bold">
                      {filesize(recordingSize)}
                    </div>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                {!isRecording ? (
                  <Button size="lg" onClick={startRecording} className="px-8">
                    <Icon name="fiber_manual_record" className="mr-2" />
                    Start Recording
                  </Button>
                ) : (
                  <>
                    <Button
                      size="lg"
                      variant="secondary"
                      onClick={pauseRecording}
                    >
                      <Icon name="pause" className="mr-2" />
                      Pause
                    </Button>
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={stopRecording}
                    >
                      <Icon name="stop" className="mr-2" />
                      Stop
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Storage Info Card */}
          {navigatorStorage.estimate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Storage Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Used</span>
                    <span className="font-medium">
                      {filesize(navigatorStorage.estimate.usage ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Available</span>
                    <span className="font-medium">
                      {filesize(navigatorStorage.estimate.quota ?? 0)}
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 mt-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{
                        width: `${
                          ((navigatorStorage.estimate.usage ?? 0) /
                            (navigatorStorage.estimate.quota ?? 1)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="flex justify-center">
            <Button variant="outline" onClick={goToRecordingListScreen}>
              <Icon name="library_music" className="mr-2" />
              View All Recordings
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
