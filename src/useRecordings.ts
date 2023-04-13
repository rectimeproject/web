import { useCallback, useMemo, useState } from 'react';
import useRecorderContext from './useRecorderContext';

export default function useRecordings() {
  const recorderContext = useRecorderContext();
  const [isStartingToRecord, setIsStartingToRecord] = useState(false);
  const [isStoppingToRecord, setIsStoppingToRecord] = useState(false);
  const [recording, setRecording] = useState<{
    encoderId: string;
  } | null>(null);
  const startRecording = useCallback(() => {
    if (isStartingToRecord || recording !== null) {
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
    recording,
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
