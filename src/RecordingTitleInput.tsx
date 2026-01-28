import {useDebounceCallback} from "usehooks-ts";
import {RecordingV1} from "./RecorderDatabase";
import {useUpdateRecordingMutation} from "./useRecorderDatabase";
import {ChangeEventHandler, useCallback, useState} from "react";
import clsx from "clsx";

export default function RecordingTitleInput({
  recording: {id: recordingId, name: initialRecordingName}
}: {
  recording: RecordingV1;
}) {
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

  const [recordingName, setRecordingName] = useState(initialRecordingName);

  const onChangeRecordingName = useCallback<
    ChangeEventHandler<HTMLInputElement>
  >(
    e => {
      setRecordingName(e.target.value);
      updateRecording(e.target.value);
    },
    [updateRecording]
  );

  return (
    <input
      id={`recording-name-input-${recordingId}`}
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
  );
}
