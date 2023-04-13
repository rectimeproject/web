import { useCallback, useMemo, useRef, useState } from 'react';
import AppDatabase from './AppDatabase';

export interface IPreferredDevice {
  deviceId: string;
  groupId: string;
}

export default function useAppSettings() {
  const db = useRef(new AppDatabase('app', 1));
  const [isGettingPreferredDevice, setIsGettingPreferredDevice] =
    useState(false);
  const [preferredDevice, setPreferredDevice] =
    useState<IPreferredDevice | null>(null);

  const getPreferredDevice = useCallback(() => {
    if (isGettingPreferredDevice) {
      return;
    }
    setIsGettingPreferredDevice(true);
    db.current
      .transaction('appSettings', 'readonly')
      .objectStore('appSettings')
      .index('key')
      .get('preferredInputDevice')
      .then((value) => {
        setPreferredDevice(
          value
            ? {
                groupId: value.groupId,
                deviceId: value.deviceId,
              }
            : null
        );
      })
      .catch((reason) => {
        console.error('failed to get preferred device with error: %o', reason);
        setPreferredDevice(null);
      })
      .finally(() => {
        setIsGettingPreferredDevice(false);
      });
  }, [db, isGettingPreferredDevice]);
  const [isSettingPreferredDevice, setIsSettingPreferredDevice] =
    useState(false);
  return useMemo(
    () => ({
      getPreferredDevice,
      setPreferredDevice: (device: MediaDeviceInfo) => {
        if (
          isSettingPreferredDevice ||
          (preferredDevice !== null &&
            device.deviceId === preferredDevice.deviceId &&
            device.groupId === preferredDevice?.groupId)
        )
          return;
        setIsSettingPreferredDevice(true);
        db.current
          .transaction('appSettings', 'readwrite')
          .objectStore('appSettings')
          .put({
            key: 'preferredInputDevice',
            groupId: device.groupId,
            deviceId: device.deviceId,
          })
          .then((result) => {
            console.log('set %s to: %o', result, device);
            getPreferredDevice();
          })
          .finally(() => {
            setIsSettingPreferredDevice(false);
          });
      },
      preferredDevice,
      isGettingPreferredDevice,
    }),
    [
      getPreferredDevice,
      isSettingPreferredDevice,
      preferredDevice,
      isGettingPreferredDevice,
    ]
  );
}
