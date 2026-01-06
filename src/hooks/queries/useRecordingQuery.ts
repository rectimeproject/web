import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { useRecorderDatabaseContext } from '../../RecorderDatabaseContext';
import { RecordingV1 } from '../../RecorderDatabase';

export const useRecordingQuery = (recordingId: string | undefined) => {
  const db = useRecorderDatabaseContext();

  return useQuery({
    queryKey: queryKeys.recordings.detail(recordingId!),
    queryFn: async () => {
      const recording = await db.get(recordingId!);
      if (!recording) throw new Error('Recording not found');
      return recording;
    },
    enabled: !!recordingId,
  });
};
