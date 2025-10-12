import { useCallback, useMemo, useState } from 'react';
import useRecorderContext from './useRecorderContext';
import { setToEncoder } from 'opus-codec-worker/actions/actions';
import { OPUS_SET_BITRATE } from 'opus-codec-worker/actions/opus';
import useDebounce from './useDebounce';

export default function useRecordings() {
  const recorderContext = useRecorderContext();
  const [isStartingToRecord, setIsStartingToRecord] = useState(false);
  const [isStoppingToRecord, setIsStoppingToRecord] = useState(false);
  const [recording, setRecording] = useState<{
    encoderId: string;
    bitrate: number;
  } | null>(null);
  const debounce = useDebounce(100);
  const [isSettingBitrate, setIsSettingBitrate] = useState(false);
  const setBitrate = useCallback(
    (newBitrate: number) =>
      debounce.run(() => {
        if (recording === null || isSettingBitrate) {
          return;
        }
        setIsSettingBitrate(true);
        const oldBitrate = recording.bitrate;
        setRecording((recording) =>
          recording
            ? {
                ...recording,
                bitrate: newBitrate,
              }
            : recording
        );
        recorderContext.opus.client
          .sendMessage(
            setToEncoder(OPUS_SET_BITRATE(recording.encoderId, newBitrate))
          )
          .then((result) => {
            if ('failures' in result) {
              console.error(
                'failed to set bitrate with failures: %s',
                result.failures.join(', ')
              );
              setRecording((recording) =>
                recording
                  ? {
                      ...recording,
                      bitrate: oldBitrate,
                    }
                  : recording
              );
            }
          })
          .finally(() => {
            setIsSettingBitrate(false);
          });
      }),
    [
      debounce,
      setIsSettingBitrate,
      isSettingBitrate,
      recorderContext,
      recording,
    ]
  );
  const [settingMicrophone, setSettingMicrophone] = useState(false);
  const setMicrophone = useCallback(
    (device: MediaDeviceInfo) => {
      if (settingMicrophone) {
        return;
      }
      setSettingMicrophone(true);
      recorderContext.recorder
        .then(async (rec) => {
          if (rec) {
            if (!rec.setInputDevice(device)) {
              console.error('failed to set device: %o', device);
            }
          }
        })
        .finally(() => {
          setSettingMicrophone(false);
        });
    },
    [recorderContext, settingMicrophone, setSettingMicrophone]
  );
  const startRecording = useCallback(
    ({ device }: { device: MediaDeviceInfo | null }) => {
      if (isStartingToRecord || recording !== null) {
        return;
      }
      setIsStartingToRecord(true);
      Promise.all([
        recorderContext.recorder,
        recorderContext.audioContext.resume(),
      ])
        .then(async ([recorder]) => {
          const result = recorder
            ? await recorder.start({ device, maxDataBytes: 1024 * 1024 * 1 })
            : null;

          setRecording(result);
        })
        .catch((reason) => {
          console.error('failed to start recording with error: %o', reason);
          setRecording(null);
        })
        .finally(() => {
          setIsStartingToRecord(false);
        });
    },
    [
      recorderContext,
      setRecording,
      recording,
      isStartingToRecord,
      setIsStartingToRecord,
    ]
  );
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
      setMicrophone,
      isStoppingToRecord,
      stopRecording,
      isSettingBitrate,
      setBitrate,
      isRecording: recording !== null,
    }),
    [
      recording,
      setBitrate,
      isSettingBitrate,
      isStoppingToRecord,
      setMicrophone,
      isStartingToRecord,
      startRecording,
      stopRecording,
    ]
  );
  return recordings;
}
