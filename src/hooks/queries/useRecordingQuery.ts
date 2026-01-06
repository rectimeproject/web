import {useQuery} from "@tanstack/react-query";
import {queryKeys} from "../../lib/queryKeys";
import {useRecorderDatabaseContext} from "../../RecorderDatabaseContext";

export const useRecordingQuery = (recordingId: string | null) => {
  const db = useRecorderDatabaseContext();

  return useQuery({
    queryKey:
      recordingId !== null
        ? queryKeys.recordings.detail(recordingId)
        : ["recordings", "detail", "null"],
    queryFn: async () => {
      if (recordingId === null) {
        throw new Error("Recording ID is required");
      }
      const recording = await db.get(recordingId);
      if (!recording) throw new Error("Recording not found");
      return recording;
    },
    enabled: recordingId !== null
  });
};
