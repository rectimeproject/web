import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import useRecorderContext from "./useRecorderContext.js";
import {useRecorderDatabaseContext} from "./RecorderDatabaseContext.js";
import {RecordingPlayer} from "./lib/audio-player/RecordingPlayer.js";

export interface IImmutablePlayingState {
  recordingId: string;
  cursor: number | null;
}

export default function useRecordingPlayer({
  recordingId,
  setCurrentTime
}: {
  recordingId: string | null;
  setCurrentTime?: (currentTime: number) => void;
}) {
  const recorderContext = useRecorderContext();
  const recorderDatabase = useRecorderDatabaseContext();
  const audioPlayerRef = useRef<RecordingPlayer | null>(null);
  const [playing, setPlaying] = useState<boolean>(false);

  const pause = useCallback(() => {
    if (audioPlayerRef.current === null) {
      return;
    }
    audioPlayerRef.current.destroy();
    audioPlayerRef.current = null;
  }, []);
  const play = useCallback(
    (currentTime: number) => {
      if (audioPlayerRef.current === null && recordingId !== null) {
        audioPlayerRef.current = new RecordingPlayer({
          db: recorderDatabase,
          opusClient: recorderContext.opus.client,
          audioContext: recorderContext.audioContext,
          recordingId
        });
        audioPlayerRef.current.on("state", state => {
          setPlaying(state === "playing");
        });
        audioPlayerRef.current.on("duration", ({duration}) => {
          setCurrentTime?.(duration);
        });
      }
      audioPlayerRef.current?.play(currentTime);
    },
    [recordingId, recorderContext, recorderDatabase, setCurrentTime]
  );
  const seek = useCallback((newDuration: number) => {
    if (audioPlayerRef.current === null) {
      return;
    }
    audioPlayerRef.current.setCurrentTime(newDuration);
  }, []);

  useEffect(() => {
    if (
      recordingId === null ||
      audioPlayerRef.current?.recordingId !== recordingId
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
