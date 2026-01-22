import {CodecId} from "opus-codec-worker/actions/actions";
import {Database} from "idb-javascript";
import {boundMethod} from "autobind-decorator";
import DatabaseThreadDummy from "idb-javascript/src/DatabaseThreadDummy";
import {randomUUID} from "./lib/randomUUID";

export interface IRecordingDataOffset {
  /**
   * current duration offset
   */
  currentDuration: number;
  /**
   * duration of this slice
   */
  sliceDuration: number;
  start: number;
  end: number;
}

export type RecordingDataV1 = {
  id: string;
  recordingId: string;
  createdAt: Date;
  data: Blob;
  offsets: IRecordingDataOffset[];
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

export interface IRecordingNote {
  recordingId: string;
  id: string;
  createdAt: Date;
  durationOffset: number;
  contents: string;
  title: string;
}

export interface IRecordingPartV1 {
  recordingId: string;
  id: string;
  encoded: Blob;
  format: "opus";
  partIndex: number;
  sampleCount: number;
  version: 1;
}

export default class RecorderDatabase extends Database<{
  recordings: RecordingV1;
  recordingData: RecordingDataV1;
  recordingNotes: IRecordingNote;
  recordingParts: IRecordingPartV1;
}> {
  // readonly #encodingQueue = new Map<string, IBlobPartQueue>();
  public constructor(databaseName: string) {
    super(databaseName, 2, {
      thread: new DatabaseThreadDummy()
    });
  }
  public async getAll({offset, limit}: IPaginationFilter) {
    const cursor = await this.transaction("recordings", "readonly")
      .objectStore("recordings")
      .index("createdAt")
      .openCursor(null, "prev");
    if (!cursor) {
      return null;
    }
    return new Promise<RecordingV1[] | null>(resolve => {
      const recordings = new Array<RecordingV1>();
      cursor.onerror = () => {
        console.error(
          "failed to read from cursor with error: %o",
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
    return this.transaction("recordings", "readonly")
      .objectStore("recordings")
      .index("id")
      .get(id);
  }
  public getFromEncoderId(id: string) {
    return this.transaction("recordings", "readonly")
      .objectStore("recordings")
      .index("encoderId")
      .get(id);
  }
  public async create({
    channels,
    sampleRate,
    frameSize,
    encoderId
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
      name: "Untitled",
      encoderId,
      createdAt: new Date(),
      id: randomUUID()
    };

    return this.transaction("recordings", "readwrite")
      .objectStore("recordings")
      .put(newRecording);
  }
  public async close() {
    (await this.result())?.close();
  }
  public async addRecordingPart(part: {
    encoderId: string;
    partIndex: number;
    sampleCount: number;
    format: "opus";
    encoded: Blob;
  }) {
    const recording = await this.transaction("recordings", "readonly")
      .objectStore("recordings")
      .index("encoderId")
      .get(part.encoderId);
    if (recording === null) {
      throw new Error(`Recording not found for encoderId: ${part.encoderId}`);
    }

    const [recordingPartKey] = await Promise.all([
      this.transaction("recordingParts", "readwrite")
        .objectStore("recordingParts")
        .put({
          partIndex: part.partIndex,
          recordingId: recording.id,
          encoded: part.encoded,
          format: part.format,
          sampleCount: part.sampleCount,
          id: randomUUID(),
          version: 1
        }),
      this.transaction(["recordings"], "readwrite")
        .objectStore("recordings")
        .put({
          ...recording,
          size: recording.size + part.encoded.size,
          duration:
            recording.duration +
            (part.sampleCount / recording.sampleRate) * 1000
        })
    ]);

    if (recordingPartKey === null) {
      throw new Error(`Failed to add recording part: ${part.partIndex}`);
    }

    return true;
  }
  /**
   * @deprecated Use addRecordingPart instead
   */
  public async addBlobPart({
    encoderId,
    blobPart,
    sampleCount
  }: {
    encoderId: string;
    blobPart: ArrayBuffer;
    sampleCount: number;
  }) {
    let recording = await this.transaction("recordings", "readonly")
      .objectStore("recordings")
      .index("encoderId")
      .get(encoderId);

    if (recording === null) {
      console.error("failed to get recording: %s", encoderId);
      return false;
    }

    let recordingData = await this.transaction("recordingData", "readonly")
      .objectStore("recordingData")
      .index("recordingId")
      .get(recording.id);
    if (!recordingData) {
      const recordingDataId = randomUUID();

      recordingData = {
        version: 1,
        recordingId: recording.id,
        id: recordingDataId,
        createdAt: new Date(),
        offsets: [],
        data: new Blob([], {
          type: "application/octet-stream"
        })
      };
    }
    const sliceDuration = (sampleCount / recording.sampleRate) * 1000;
    const lastOffset = recordingData.offsets[recordingData.offsets.length - 1];
    const newOffset: IRecordingDataOffset =
      typeof lastOffset === "undefined"
        ? {
            currentDuration: recording.duration,
            sliceDuration,
            start: 0,
            end: blobPart.byteLength
          }
        : {
            currentDuration: recording.duration,
            sliceDuration,
            start: lastOffset.end,
            end: lastOffset.end + blobPart.byteLength
          };
    recordingData = {
      ...recordingData,
      offsets: [...recordingData.offsets, newOffset],
      data: new Blob([recordingData.data, blobPart], {
        type: "application/octet-stream"
      })
    };
    const recordingDataKey = await this.transaction(
      "recordingData",
      "readwrite"
    )
      .objectStore("recordingData")
      .put(recordingData);

    if (recordingDataKey === null) {
      console.log("failed to update recording data: %o", recordingData);
      return false;
    }

    recording = await this.transaction("recordings", "readonly")
      .objectStore("recordings")
      .get(recording.id);

    if (recording === null) {
      console.error(
        "failed to get recording after updating recording data: %o",
        recordingData
      );
      return false;
    }

    recording = {
      ...recording,
      duration: recording.duration + sliceDuration,
      size: recording.size + blobPart.byteLength
    };

    const recordingKey = await this.transaction("recordings", "readwrite")
      .objectStore("recordings")
      .put(recording);

    if (recordingKey === null) {
      console.error("failed to update recording: %o", recording);
      return false;
    }
    return true;
  }
  @boundMethod protected override onUpgradeNeeded(
    e: IDBVersionChangeEvent
  ): void {
    const db = this.request().result;

    if (e.oldVersion < 1) {
      // recordingBlobParts
      const recordingBlobParts = db.createObjectStore("recordingData", {
        keyPath: "id",
        autoIncrement: true
      });
      recordingBlobParts.createIndex("id", "id", {
        unique: true
      });
      recordingBlobParts.createIndex("recordingId", "recordingId", {
        unique: false
      });
      recordingBlobParts.createIndex("createdAt", "createdAt", {
        unique: false
      });
      // recordings
      const recordings = db.createObjectStore("recordings", {
        keyPath: "id",
        autoIncrement: false
      });
      recordings.createIndex("id", "id", {
        unique: true
      });
      recordings.createIndex("encoderId", "encoderId", {
        unique: true
      });
      recordings.createIndex("createdAt", "createdAt", {
        unique: false
      });
      // recordingNotes
      const recordingNotes = db.createObjectStore("recordingNotes", {
        keyPath: "id"
      });
      recordingNotes.createIndex("id", "id", {
        unique: true
      });
      recordingNotes.createIndex("createdAt", "createdAt", {
        unique: false
      });
      recordingNotes.createIndex("recordingId", "recordingId", {
        unique: false
      });
    }

    if (e.oldVersion < 2) {
      const recordingParts = db.createObjectStore("recordingParts", {
        keyPath: ["recordingId", "partIndex"]
      });
      recordingParts.createIndex("recordingId", "recordingId", {
        unique: false
      });
      recordingParts.createIndex("partIndex", "partIndex", {
        unique: false
      });
    }
  }
}
