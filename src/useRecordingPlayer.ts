import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import useRecorderContext from "./useRecorderContext.js";
import {useRecorderDatabaseContext} from "./RecorderDatabaseContext.js";
import {RecordingPlayer} from "./lib/audio-player/RecordingPlayer.js";
import {IAnalyserNode, IAudioContext} from "standardized-audio-context";

export interface IImmutablePlayingState {
  recordingId: string;
  cursor: number | null;
}

export default function useRecordingPlayer({
  recordingId,
  onUpdate,
  setCurrentTime
}: {
  recordingId: string | null;
  onUpdate: (state: {
    analyserNode: IAnalyserNode<IAudioContext> | null;
  }) => void;
  setCurrentTime?: (currentTime: number) => void;
}) {
  const recorderContext = useRecorderContext();
  const recorderDatabase = useRecorderDatabaseContext();
  const playerRef = useRef<RecordingPlayer | null>(null);
  const [playing, setPlaying] = useState<boolean>(false);

  const pause = useCallback(() => {
    onUpdate({analyserNode: null});
    if (playerRef.current === null) {
      return;
    }
    playerRef.current.destroy();
    playerRef.current = null;
  }, [onUpdate]);
  const play = useCallback(
    (currentTime: number) => {
      if (playerRef.current === null && recordingId !== null) {
        const player = new RecordingPlayer({
          db: recorderDatabase,
          opusClient: recorderContext.opus.client,
          audioContext: recorderContext.audioContext,
          recordingId
        });
        playerRef.current = player;
        onUpdate({analyserNode: player.analyserNode});
        player.on("state", state => {
          setPlaying(state === "playing");
        });
        player.on("duration", ({duration}) => {
          setCurrentTime?.(duration);
        });
      }
      playerRef.current?.play(currentTime);
    },
    [recordingId, recorderContext, recorderDatabase, setCurrentTime, onUpdate]
  );
  const seek = useCallback((newDuration: number) => {
    if (playerRef.current === null) {
      return;
    }
    playerRef.current.setCurrentTime(newDuration);
  }, []);

  useEffect(() => {
    if (
      recordingId === null ||
      playerRef.current?.recordingId !== recordingId
    ) {
      pause();
    }
    return pause;
  }, [recordingId, pause]);

  return useMemo(
    () => ({
      play,
      playing,
      pause,
      seek
    }),
    [play, playing, pause, seek]
  );
}
