import { CodecId } from 'opus-codec-worker/actions/actions';
import { Database } from 'idb-javascript';
import { boundMethod } from 'autobind-decorator';
import DatabaseThreadDummy from 'idb-javascript/src/DatabaseThreadDummy';

export type RecordingDataV1 = {
  id: string;
  recordingId: string;
  createdAt: Date;
  data: Blob;
  offsets: {
    start: number;
    end: number;
  }[];
  version: 1;
};

export type RecordingV1 = {
  name: string;
  sampleRate: number;
  channels: number;
  id: string;
  version: 1;
  createdAt: Date;
  /**
   * recording duration in milliseconds
   */
  duration: number;
  size: number;
  frameSize: number;
  encoderId: string;
};

export interface IPaginationFilter {
  offset: number;
  limit: number;
}

export default class RecorderDatabase extends Database<{
  recordings: RecordingV1;
  recordingData: RecordingDataV1;
}> {
  // readonly #encodingQueue = new Map<string, IBlobPartQueue>();
  public constructor(databaseName: string) {
    super(databaseName, 1, {
      thread: new DatabaseThreadDummy(),
    });
  }
  public async getAll({ offset, limit }: IPaginationFilter) {
    const cursor = await this.transaction('recordings', 'readonly')
      .objectStore('recordings')
      .openCursor();
    if (!cursor) {
      return null;
    }
    return new Promise<RecordingV1[] | null>((resolve) => {
      const recordings = new Array<RecordingV1>();
      cursor.onerror = () => {
        console.error(
          'failed to read from cursor with error: %o',
          cursor.error
        );
        resolve(null);
      };
      let advancing = offset > 0;
      cursor.onsuccess = () => {
        if (cursor.result && advancing) {
          cursor.result.advance(offset);
          advancing = false;
          return;
        }
        if (!cursor.result || recordings.length === limit) {
          resolve(
            Array.from(recordings).sort(
              (r1, r2) => r2.createdAt.getTime() - r1.createdAt.getTime()
            )
          );
          return;
        }
        recordings.push(cursor.result.value);
        cursor.result.continue();
      };
    });
  }
  public get(id: string) {
    return this.transaction('recordings', 'readonly')
      .objectStore('recordings')
      .index('id')
      .get(id);
  }
  public getFromEncoderId(id: string) {
    return this.transaction('recordings', 'readonly')
      .objectStore('recordings')
      .index('encoderId')
      .get(id);
  }
  public async create({
    channels,
    sampleRate,
    frameSize,
    encoderId,
  }: {
    frameSize: number;
    encoderId: CodecId;
    sampleRate: number;
    channels: number;
  }) {
    const newRecording: RecordingV1 = {
      sampleRate,
      channels,
      duration: 0,
      frameSize,
      size: 0,
      version: 1,
      name: 'Untitled',
      encoderId,
      createdAt: new Date(),
      id: crypto.getRandomValues(new Uint32Array(4)).join('-'),
    };

    return this.transaction('recordings', 'readwrite')
      .objectStore('recordings')
      .put(newRecording);
  }
  public async close() {
    (await this.result())?.close();
  }
  public async addBlobPart({
    encoderId,
    blobPart,
    sampleCount,
  }: {
    encoderId: string;
    blobPart: ArrayBuffer;
    sampleCount: number;
  }) {
    let recording = await this.transaction('recordings', 'readonly')
      .objectStore('recordings')
      .index('encoderId')
      .get(encoderId);

    if (recording === null) {
      console.error('failed to get recording: %s', encoderId);
      return false;
    }

    let recordingData = await this.transaction('recordingData', 'readonly')
      .objectStore('recordingData')
      .index('recordingId')
      .get(recording.id);
    if (!recordingData) {
      const recordingDataId = crypto
        .getRandomValues(new Uint32Array(4))
        .join('-');

      recordingData = {
        version: 1,
        recordingId: recording.id,
        id: recordingDataId,
        createdAt: new Date(),
        offsets: [],
        data: new Blob([], {
          type: 'application/octet-stream',
        }),
      };
    }
    const lastOffset = recordingData.offsets[recordingData.offsets.length - 1];
    const newOffset = lastOffset
      ? {
          start: lastOffset.end,
          end: lastOffset.end + blobPart.byteLength,
        }
      : {
          start: 0,
          end: blobPart.byteLength,
        };
    recordingData = {
      ...recordingData,
      offsets: [...recordingData.offsets, newOffset],
      data: new Blob([recordingData.data, blobPart], {
        type: 'application/octet-stream',
      }),
    };
    const recordingDataKey = await this.transaction(
      'recordingData',
      'readwrite'
    )
      .objectStore('recordingData')
      .lazyPut(recordingData);

    if (recordingDataKey === null) {
      console.log('failed to update recording data: %o', recordingData);
      return false;
    }

    recording = await this.transaction('recordings', 'readonly')
      .objectStore('recordings')
      .get(recording.id);

    if (recording === null) {
      console.error(
        'failed to get recording after updating recording data: %o',
        recordingData
      );
      return false;
    }

    recording = {
      ...recording,
      duration:
        recording.duration + (sampleCount / recording.sampleRate) * 1000,
      size: recording.size + blobPart.byteLength,
    };

    const recordingKey = await this.transaction('recordings', 'readwrite')
      .objectStore('recordings')
      .put(recording);

    if (recordingKey === null) {
      console.error('failed to update recording: %o', recording);
      return false;
    }
    return true;
  }
  @boundMethod protected override onUpgradeNeeded(
    _: IDBVersionChangeEvent
  ): void {
    const db = this.request().result;
    // recordingBlobParts
    const recordingBlobParts = db.createObjectStore('recordingData', {
      keyPath: 'id',
      autoIncrement: true,
    });
    recordingBlobParts.createIndex('id', 'id', {
      unique: true,
    });
    recordingBlobParts.createIndex('recordingId', 'recordingId', {
      unique: false,
    });
    recordingBlobParts.createIndex('createdAt', 'createdAt', {
      unique: false,
    });
    // recordings
    const recordings = db.createObjectStore('recordings', {
      keyPath: 'id',
      autoIncrement: false,
    });
    recordings.createIndex('id', 'id', {
      unique: true,
    });
    recordings.createIndex('encoderId', 'encoderId', {
      unique: true,
    });
    recordings.createIndex('createdAt', 'createdAt', {
      unique: false,
    });
  }
}
