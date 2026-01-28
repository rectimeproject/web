import {memo, useCallback} from "react";
import {RecordingV1} from "./RecorderDatabase";
import {DateTime} from "luxon";
import {clsx} from "clsx";
import secondsToHumanReadable from "./secondsToHumanReadable";
import {useNavigate} from "react-router";
import ActivityIndicator from "./ActivityIndicator";
import Icon from "./Icon";
import {useRecordingQuery} from "./hooks/queries/useRecordingQuery";
import RecordingTitleInput from "./RecordingTitleInput";

export default memo(function RecordingListScreenItem({
  recording: initialRecording
}: {
  recording: RecordingV1;
}) {
  const {id: recordingId} = initialRecording;
  const navigate = useNavigate();

  const openSpecificRecordingPage = useCallback(() => {
    navigate(`/recording/${recordingId}`);
  }, [navigate, recordingId]);

  const {data: r = null, isPending: isLoadingRecording} =
    useRecordingQuery(recordingId);
  if (r === null) {
    if (isLoadingRecording) {
      return <ActivityIndicator />;
    }
    return null;
  }

  return (
    <div
      className={clsx(
        "md:flex-row",
        "flex-col",
        "flex",
        "items-center",
        "gap-6",
        "p-6",
        "mb-4",
        "bg-white",
        "dark:bg-gray-900",
        "border",
        "border-gray-200",
        "dark:border-gray-700",
        "rounded-2xl",
        "hover:shadow-xl",
        "hover:-translate-y-1",
        "transition-all",
        "duration-200"
      )}
    >
      <div className="text-sm font-mono text-gray-500 dark:text-gray-400 tracking-tight">
        {DateTime.fromJSDate(r.createdAt).toLocaleString(
          DateTime.DATETIME_SHORT
        )}
      </div>
      <div className="lg:block hidden w-px h-8 bg-gray-200 dark:bg-gray-700" />
      <div className="text-sm font-mono text-gray-500 dark:text-gray-400">
        {secondsToHumanReadable(r.duration / 1000)}
      </div>
      <div className="flex-1 min-w-0">
        <RecordingTitleInput recording={initialRecording} />
      </div>
      <div className="shrink-0">
        <button
          onClick={openSpecificRecordingPage}
          className={clsx(
            "w-12",
            "h-12",
            "rounded-full",
            "bg-blue-500",
            "hover:bg-blue-600",
            "dark:bg-blue-600",
            "dark:hover:bg-blue-700",
            "text-white",
            "flex",
            "items-center",
            "justify-center",
            "transition-all",
            "duration-150",
            "hover:scale-105",
            "active:scale-95",
            "shadow-md",
            "hover:shadow-lg"
          )}
          aria-label="Play recording"
        >
          <Icon name="play_arrow" />
        </button>
      </div>
    </div>
  );
});
