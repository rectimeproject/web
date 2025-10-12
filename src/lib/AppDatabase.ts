import { boundMethod } from 'autobind-decorator';
import { Database } from 'idb-javascript';

export default class AppDatabase extends Database<{
  appSettings: {
    key: 'preferredInputDevice';
    deviceId: string;
    groupId: string;
  };
}> {
  @boundMethod protected override onUpgradeNeeded(
    _: IDBVersionChangeEvent
  ): void {
    const db = this.request().result;
    const appSettings = db.createObjectStore('appSettings', {
      keyPath: 'key',
      autoIncrement: false,
    });
    appSettings.createIndex('key', 'key', {
      unique: true,
    });
  }
}
