import {useMemo} from "react";
import useRecorderContext from "./useRecorderContext.js";
import {setToEncoder} from "opus-codec-worker/actions/actions.js";
import {OPUS_SET_BITRATE} from "opus-codec-worker/actions/opus.js";
import {useMutation} from "@tanstack/react-query";

export default function useRecordings() {
  const recorderContext = useRecorderContext();
  const setBitrate = useMutation({
    mutationFn: async ({
      encoderId,
      newBitrate
    }: {
      encoderId: string;
      newBitrate: number;
    }) => {
      const result = await recorderContext.opus.client.sendMessage(
        setToEncoder(OPUS_SET_BITRATE(encoderId, newBitrate))
      );

      if ("failures" in result) {
        throw new Error(
          `Failed to set bitrate with failures: ${result.failures.join(", ")}`
        );
      }

      return newBitrate;
    }
  });
  const setMicrophone = useMutation({
    mutationFn: async (device: MediaDeviceInfo) => {
      await (await recorderContext.recorder)?.setInputDevice(device);
    }
  });
  const startRecording = useMutation({
    mutationKey: ["recording", "start"],
    mutationFn: async ({device}: {device: MediaDeviceInfo | null}) => {
      const recorder = await recorderContext.recorder;
      if (recorder === null) {
        return null;
      }

      return recorder.start({device, maxDataBytes: 1024 * 1024 * 1});
    }
  });
  const stopRecording = useMutation({
    mutationKey: ["recording", "stop"],
    onSuccess: async () => {
      startRecording.reset();
    },
    mutationFn: async () => {
      return (await (await recorderContext.recorder)?.stop()) ?? null;
    }
  });
  const recordings = useMemo(() => {
    const recording = startRecording.data ?? null;

    return {
      recording,
      startRecording,
      setMicrophone,
      stopRecording,
      setBitrate,
      isRecording: recording !== null
    };
  }, [setBitrate, setMicrophone, startRecording, stopRecording]);
  return recordings;
}
