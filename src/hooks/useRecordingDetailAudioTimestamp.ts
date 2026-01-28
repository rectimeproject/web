import {useCallback, useMemo} from "react";
import {useLocation, useNavigate, useParams} from "react-router";

export default function useRecordingDetailAudioTimestamp() {
  const {recordingId} = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const duration = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const t = searchParams.get("t");
    if (!t) {
      return null;
    }
    const parsed = parseInt(t, 10);
    if (isNaN(parsed) || parsed < 0) {
      return null;
    }
    return parsed;
  }, [location.search]);

  const update = useCallback(
    (duration: number) => {
      const url = new URL(window.location.href);
      if (recordingId) {
        url.pathname = `/recording/${recordingId}`;
      }
      url.searchParams.set("t", Math.floor(duration).toString());
      navigate(url.pathname + url.search, {replace: true});
    },
    [navigate, recordingId]
  );

  return [duration, update] as const;
}
