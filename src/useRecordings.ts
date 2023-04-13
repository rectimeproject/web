import { useCallback, useEffect, useMemo, useState } from 'react';
import useRecorderContext from './useRecorderContext';

export default function useRecordings() {
  const recorderContext = useRecorderContext();
  const [isStartingToRecord, setIsStartingToRecord] = useState(false);
  const [isStoppingToRecord, setIsStoppingToRecord] = useState(false);
  const [recording, setRecording] = useState<{
    encoderId: string;
    duration: number;
  } | null>(null);
  const onEncoded = useCallback(
    ({ encoderId, duration }: { encoderId: string; duration: number }) => {
      if (recording?.encoderId !== encoderId) {
        return;
      }
      setRecording((recording) =>
        recording
          ? {
              ...recording,
              duration: recording.duration + duration,
            }
          : recording
      );
    },
    [recording]
  );
  useEffect(() => {
    recorderContext.recorder.then((recorder) => {
      recorder?.on('encoded', onEncoded);
    });
    return () => {
      recorderContext.recorder.then((recorder) => {
        recorder?.off('encoded', onEncoded);
      });
    };
  }, [recorderContext, onEncoded]);
  const startRecording = useCallback(() => {
    if (isStartingToRecord) {
      return;
    }
    setIsStartingToRecord(true);
    Promise.all([
      recorderContext.recorder,
      recorderContext.audioContext.resume(),
    ])
      .then(async ([recorder]) => {
        const encoderId = recorder
          ? await recorder.start({ maxDataBytes: 1024 * 1024 * 1 })
          : null;

        setRecording(
          encoderId
            ? {
                encoderId,
                duration: 0,
              }
            : null
        );
      })
      .catch((reason) => {
        console.error('failed to start recording with error: %o', reason);
        setRecording(null);
      })
      .finally(() => {
        setIsStartingToRecord(false);
      });
  }, [
    recorderContext,
    setRecording,
    isStartingToRecord,
    setIsStartingToRecord,
  ]);
  const stopRecording = useCallback(() => {
    if (isStoppingToRecord) {
      return;
    }
    setIsStoppingToRecord(true);
    recorderContext.recorder
      .then((recorder) => recorder?.stop())
      .finally(() => {
        setRecording(null);
        setIsStoppingToRecord(false);
      });
  }, [
    isStoppingToRecord,
    recorderContext,
    setRecording,
    setIsStoppingToRecord,
  ]);
  const recordings = useMemo(
    () => ({
      recording,
      isStartingToRecord,
      startRecording,
      isStoppingToRecord,
      stopRecording,
      isRecording: recording !== null,
    }),
    [
      recording,
      isStoppingToRecord,
      isStartingToRecord,
      startRecording,
      stopRecording,
    ]
  );
  return recordings;
}
