import { CodecId } from 'opus-codec-worker/actions/actions';
import { Database } from 'idb-javascript';
import { boundMethod } from 'autobind-decorator';

export type RecordingBlobPartV1 = {
  id: number;
  recordingId: string;
  sampleCount: number;
  createdAt: Date;
  blob: Blob;
};

export type RecordingV1 = {
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
  recordingBlobParts: RecordingBlobPartV1;
}> {
  public constructor(databaseName: string) {
    super(databaseName, 1);
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
    recordingId,
    blobPart,
    sampleCount,
  }: {
    /**
     * recording id
     */
    recordingId: string;
    /**
     * blob part encoded using OPUS codec
     */
    blobPart: ArrayBuffer;
    /**
     * how many samples were used to produce this encoded blob part
     */
    sampleCount: number;
  }) {
    const blobPartId = crypto.getRandomValues(new Uint32Array(1))[0];
    if (typeof blobPartId === 'undefined') {
      return null;
    }

    const blobPartKey = await this.transaction(
      'recordingBlobParts',
      'readwrite',
      {}
    )
      .objectStore('recordingBlobParts')
      .put({
        id: blobPartId,
        createdAt: new Date(),
        recordingId,
        sampleCount,
        blob: new Blob([blobPart], {
          type: 'application/octet-stream',
        }),
      });

    // console.log(
    //   'received %d samples (total duration = %d): %d ms',
    //   sampleCount,
    //   recording.duration,
    //   (sampleCount / recording.sampleRate) * 1000
    // );

    let recording = await this.transaction('recordings', 'readonly')
      .objectStore('recordings')
      .index('id')
      .get(recordingId);

    if (recording === null) {
      console.error('failed to get recording by recording id: %s', recordingId);
      if (
        (await this.transaction('recordingBlobParts', 'readwrite')
          .objectStore('recordingBlobParts')
          .delete(blobPartId)) === null
      ) {
        console.error('failed to delete blob part after failure');
      }
      return null;
    }

    /**
     * update recording object
     */
    recording = {
      ...recording,
      duration:
        recording.duration + (sampleCount / recording.sampleRate) * 1000,
      size: recording.size + blobPart.byteLength,
    };

    const recordingKey = await this.transaction('recordings', 'readwrite')
      .objectStore('recordings')
      .put(recording);

    if (recordingKey === null || blobPartKey === null) {
      // TODO: maybe we should not delete everything after failure, or should we?
      // if(blobPartKey !== null){
      //   if(await this.transaction('recordingBlobParts','readwrite',{}).objectStore('recordingBlobParts').delete(
      //     blobPartKey
      //   ) === null){
      //     console.error('failed to delete blob part after failure');
      //   }
      // }
      // if(recordingKey !== null){
      //   if(await this.transaction('recordings','readwrite',{}).objectStore('recordings').delete(
      //     recordingKey
      //   ) === null){
      //     console.error('failed to delete recording record after failure');
      //   }
      // }
      console.error('failed to update recording or recording blob part: %o', {
        blobPartKey,
        recordingKey,
      });
      return null;
    }
    return {
      blobPartKey,
      recordingKey,
    };
  }
  @boundMethod protected override onUpgradeNeeded(
    _: IDBVersionChangeEvent
  ): void {
    const db = this.request().result;
    // recordingBlobParts
    const recordingBlobParts = db.createObjectStore('recordingBlobParts', {
      keyPath: 'id',
      autoIncrement: true,
    });
    recordingBlobParts.createIndex('id', 'id', {
      unique: true,
    });
    recordingBlobParts.createIndex('recordingId', 'recordingId', {
      unique: false,
    });
    recordingBlobParts.createIndex('sampleCount', 'sampleCount', {
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
