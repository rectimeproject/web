import {useQuery} from "@tanstack/react-query";
import {queryKeys} from "../../lib/queryKeys";
import useRecordingNotes from "../../useRecordingNotes";

export const useRecordingNotesQuery = (recordingId: string | null) => {
  const recordingNotes = useRecordingNotes();

  return useQuery({
    queryKey:
      recordingId !== null
        ? queryKeys.recordingNotes.byRecording(recordingId)
        : ["recordingNotes", "null"],
    queryFn: async () => {
      if (recordingId === null) {
        throw new Error("Recording ID is required");
      }
      return await recordingNotes.getRecordingNotesByRecordingId(recordingId);
    },
    enabled: recordingId !== null
  });
};
