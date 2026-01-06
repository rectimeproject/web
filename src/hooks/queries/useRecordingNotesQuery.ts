import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import useRecordingNotes from '../../useRecordingNotes';

export const useRecordingNotesQuery = (recordingId: string | undefined) => {
  const recordingNotes = useRecordingNotes();

  return useQuery({
    queryKey: queryKeys.recordingNotes.byRecording(recordingId!),
    queryFn: async () => {
      return await recordingNotes.getRecordingNotesByRecordingId(recordingId!);
    },
    enabled: !!recordingId,
  });
};
