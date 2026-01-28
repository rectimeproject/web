import {
  ChangeEventHandler,
  memo,
  useCallback,
  useEffect,
  useState
} from "react";
import {RecordingV1} from "./RecorderDatabase";
import {DateTime} from "luxon";
import {clsx} from "clsx";
import secondsToHumanReadable from "./secondsToHumanReadable";
import {useNavigate} from "react-router";
import ActivityIndicator from "./ActivityIndicator";
import {useUpdateRecordingMutation} from "./useRecorderDatabase";
import Icon from "./Icon";
import {useRecordingQuery} from "./hooks/queries/useRecordingQuery";
import {useDebounceCallback} from "usehooks-ts";

export default memo(function RecordingListScreenItem({
  recording: {id: recordingId, name: initialRecordingName}
}: {
  recording: RecordingV1;
}) {
  const navigate = useNavigate();

  const updateRecordingMutation = useUpdateRecordingMutation({
    recordingId
  });

  const updateRecording = useDebounceCallback((newRecordingName: string) => {
    if (updateRecordingMutation.isPending) {
      return;
    }
    updateRecordingMutation.mutate({
      recordingId,
      recording: {
        name: newRecordingName
      }
    });
  }, 2000);

  const openSpecificRecordingPage = useCallback(() => {
    navigate(`/recording/${recordingId}`);
  }, [navigate, recordingId]);

  const {data: r = null, isPending: isLoadingRecording} =
    useRecordingQuery(recordingId);
  const [recordingName, setRecordingName] = useState(initialRecordingName);

  useEffect(() => {
    console.log(initialRecordingName, r?.name);
  }, [initialRecordingName, r?.name]);

  const onChangeRecordingName = useCallback<
    ChangeEventHandler<HTMLInputElement>
  >(
    e => {
      setRecordingName(e.target.value);
      updateRecording(e.target.value);
    },
    [updateRecording]
  );

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
        <input
          id={`recording-name-input-${r.id}`}
          type="text"
          value={recordingName}
          onChange={onChangeRecordingName}
          className={clsx(
            "text-lg",
            "dark:text-white",
            "font-medium",
            "bg-transparent",
            "border-none",
            "outline-none",
            "focus:ring-2",
            "focus:ring-blue-500",
            "dark:focus:ring-blue-400",
            "focus:ring-offset-2",
            "rounded-lg",
            "px-3",
            "py-2",
            "lg:-mx-3",
            "w-full",
            "transition-all",
            "duration-150"
          )}
        />
      </div>
      <div className="shrink-0">
        {updateRecordingMutation.isPending ? (
          <ActivityIndicator />
        ) : (
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
        )}
      </div>
    </div>
  );
});
