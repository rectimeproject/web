import {useCallback, useMemo, useRef} from "react";
import useRecorderContext from "./useRecorderContext";
import {
  AnalyserNode,
  AudioBufferSourceNode,
  IAudioBuffer,
  IAudioContext
} from "standardized-audio-context";
import {useRecorderDatabaseContext} from "./RecorderDatabaseContext";
import {RingBufferF32} from "ringbud";
import {RecordingPlayer} from "./lib/audio-player/RecordingPlayer";

interface IScheduleItem {
  audioBuffer: IAudioBuffer;
  sourceNode: AudioBufferSourceNode<IAudioContext>;
  startTime: number;
}

export interface IImmutablePlayingState {
  recordingId: string;
  cursor: number | null;
}

interface IState {
  destroying: Promise<void> | null;
  recordingId: string;
  ringBuffer: RingBufferF32;
  decoderId: string | null;
  /**
   * if null, it means we're waiting for the first slice to be ready
   */
  playingState: {
    initialCurrentTime: number;
    lastTime: number;
    scheduleOffset: number;
  } | null;
  /**
   * this is filled while we're creating audio buffer sources and audio buffers. it is
   * used to track what is the current duration offset we're currently at
   */
  durationOffset: number;
  schedule: ReadonlyArray<IScheduleItem>;
  requestedStop: boolean;
  analyserNode: AnalyserNode<IAudioContext>;
}

export default function useRecordingPlayer({
  recordingId
}: {
  recordingId: string | null;
}) {
  const recorderContext = useRecorderContext();
  const recorderDatabase = useRecorderDatabaseContext();
  const player = useRef<RecordingPlayer | null>(null);

  const play = useCallback(() => {
    if (recordingId === null) {
      return;
    }

    if (player.current !== null) {
      player.current.destroy();
      player.current = null;
    }

    player.current = new RecordingPlayer({
      db: recorderDatabase,
      opusClient: recorderContext.opus.client,
      audioContext: recorderContext.audioContext,
      recordingId
    });
    player.current.play().catch(err => {
      console.error("Error playing recording:", err);
    });
  }, [recordingId, recorderContext, recorderDatabase]);
  const pause = useCallback(() => {}, []);
  const seek = useCallback((_durationOffset: number) => {}, []);

  return useMemo(
    () => ({
      play,
      playing: null,
      pause,
      seek
    }),
    [play, pause, seek]
  );
}
