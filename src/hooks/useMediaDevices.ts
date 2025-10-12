import { useCallback, useEffect, useMemo, useState } from 'react';

export default function useMediaDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [hasLoadedInitialDevices, setHasLoadedInitialDevices] =
    useState<boolean>(false);
  const enumerateDevices = useCallback(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        setDevices(devices);
      })
      .catch((reason) => {
        console.error('failed to enumerate devices with error: %o', reason);
        setDevices([]);
      })
      .finally(() => {
        setHasLoadedInitialDevices(true);
      });
  }, [setDevices, setHasLoadedInitialDevices]);
  useEffect(() => {
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        enumerateDevices
      );
    };
  }, [enumerateDevices]);
  return useMemo(
    () => ({
      devices,
      hasLoadedInitialDevices,
      enumerateDevices,
    }),
    [enumerateDevices, devices, hasLoadedInitialDevices]
  );
}
