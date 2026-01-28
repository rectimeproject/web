import {useMemo, useState} from "react";
import AppDatabase from "./AppDatabase.js";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {queryKeys} from "./lib/queryKeys.js";

export interface IPreferredDevice {
  deviceId: string;
  groupId: string;
}

export default function useAppSettings() {
  const [db] = useState(() => new AppDatabase("app", 1));
  const queryClient = useQueryClient();

  const getPreferredDeviceQuery = useQuery({
    queryKey: queryKeys.appSettings.preferredDevice(),
    queryFn: async () => {
      return await db
        .transaction("appSettings", "readonly")
        .objectStore("appSettings")
        .index("key")
        .get("preferredInputDevice");
    }
  });
  const setPreferredDeviceMutation = useMutation({
    mutationKey: queryKeys.appSettings.preferredDevice(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.appSettings.preferredDevice()
      });
    },
    mutationFn: async ({device}: {device: MediaDeviceInfo}) => {
      return await db
        .transaction("appSettings", "readwrite")
        .objectStore("appSettings")
        .put({
          key: "preferredInputDevice",
          groupId: device.groupId,
          deviceId: device.deviceId
        });
    }
  });
  return useMemo(
    () => ({
      getPreferredDevice: getPreferredDeviceQuery,
      preferredDevice: getPreferredDeviceQuery.data ?? null,
      setPreferredDevice: setPreferredDeviceMutation
    }),
    [getPreferredDeviceQuery, setPreferredDeviceMutation]
  );
}
