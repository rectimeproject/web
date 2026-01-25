import {useQuery} from "@tanstack/react-query";
import {queryKeys} from "../../lib/queryKeys.js";
import useRecordingNotes from "../../useRecordingNotes.js";

export const useRecordingNotesQuery = (recordingId: string | null) => {
  const recordingNotes = useRecordingNotes();

  return useQuery({
    queryKey: queryKeys.recordingNotes.byRecording(recordingId),
    queryFn: async () => {
      if (recordingId === null) {
        throw new Error("Recording ID is required");
      }
      return await recordingNotes.getRecordingNotesByRecordingId(recordingId);
    },
    enabled: recordingId !== null
  });
};
