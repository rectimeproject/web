import {useQuery} from "@tanstack/react-query";
import {queryKeys} from "../../lib/queryKeys.js";
import {useRecorderDatabaseContext} from "../../RecorderDatabaseContext.js";

export const useRecordingQuery = (recordingId: string | null) => {
  const db = useRecorderDatabaseContext();

  return useQuery({
    queryKey: queryKeys.recordings.detail(recordingId),
    queryFn: async () => {
      if (recordingId === null) {
        return null;
      }
      const recording = await db.get(recordingId);
      if (!recording) throw new Error("Recording not found");
      return recording;
    },
    enabled: recordingId !== null
  });
};
