import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  AnalyserNode,
  IAudioContext,
  MediaStreamAudioSourceNode
} from "standardized-audio-context";
import useRecorderContext from "./useRecorderContext.js";
import domExceptionToString from "./domExceptionToString.js";

interface IDebugAudioVisualizerData {
  streamAudioSourceNode: MediaStreamAudioSourceNode<IAudioContext>;
  analyserNode: AnalyserNode<IAudioContext>;
  stream: MediaStream;
}

export default function useDebugAudioVisualizer() {
  const recorder = useRecorderContext();
  const dataRef = useRef<Promise<IDebugAudioVisualizerData | null> | null>(
    null
  );
  const [debuggingState, setDebuggingState] = useState<
    "idle" | "stopping" | "starting" | "debugging"
  >("idle");
  const [analyserNode, setAnalyserNode] =
    useState<AnalyserNode<IAudioContext> | null>(null);
  const stop = useCallback(() => {
    if (debuggingState !== "debugging" || !dataRef.current) {
      return;
    }
    setDebuggingState("stopping");
    dataRef.current
      .then(async result => {
        if (result === null) {
          return;
        }
        try {
          result.analyserNode.disconnect(recorder.audioContext.destination);
          result.streamAudioSourceNode.disconnect(result.analyserNode);
        } catch (reason) {
          console.error(
            "failed to disconnect nodes: %o",
            domExceptionToString(reason)
          );
        }

        for (const t of result.stream.getTracks()) {
          t.stop();
        }
        // Don't suspend audio context - it's shared with the recorder
        // Suspending it would pause any active recording
      })
      .catch(reason => {
        console.error(
          "failed to stop debugging audio from microphone with error: %o",
          reason
        );
      })
      .finally(() => {
        dataRef.current = null;
        setAnalyserNode(null);
        setDebuggingState("idle");
      });
  }, [recorder.audioContext, setDebuggingState, debuggingState]);
  const start = useCallback(() => {
    if (dataRef.current !== null || debuggingState !== "idle") {
      return;
    }
    setDebuggingState("starting");
    const pendingData = recorder.audioContext
      .resume()
      .then(async () => {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true
          });
        } catch (reason) {
          console.error("failed to get stream with error: %o", reason);
          return null;
        }
        const streamAudioSourceNode =
          recorder.audioContext.createMediaStreamSource(stream);
        const analyserNode = recorder.audioContext.createAnalyser();
        try {
          streamAudioSourceNode.connect(analyserNode);
        } catch (reason) {
          console.error(
            "failed to connect stream audio source node with analyser node with error: %o",
            reason
          );
          for (const t of stream.getTracks()) {
            try {
              t.stop();
            } catch (reason) {
              console.error("failed to stop track with error: %o", reason);
            }
          }
          return null;
        }
        return {
          stream,
          analyserNode,
          streamAudioSourceNode
        };
      })
      .then(rec => {
        if (rec) setAnalyserNode(rec.analyserNode);
        setDebuggingState("debugging");
        return rec;
      })
      .catch(reason => {
        setAnalyserNode(null);
        console.error(
          "failed to start debug audio visualizer data with error: %o",
          reason
        );
        return null;
      });
    dataRef.current = pendingData;
  }, [recorder.audioContext, debuggingState]);
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);
  return useMemo(
    () => ({
      stop,
      isDebugging: debuggingState === "debugging",
      isStopping: debuggingState === "stopping",
      isIdle: debuggingState === "idle",
      isStarting: debuggingState === "starting",
      start,
      analyserNode
    }),
    [start, stop, analyserNode, debuggingState]
  );
}
