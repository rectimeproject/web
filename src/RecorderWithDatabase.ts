import {IAudioContext} from "standardized-audio-context";
import Recorder, {Opus} from "./Recorder.js";
import RecorderDatabase from "./RecorderDatabase.js";
import {boundMethod} from "autobind-decorator";
import {CodecId} from "opus-codec-worker/actions/actions.js";

export default class RecorderWithDatabase extends Recorder {
  static databaseName = "appRecordings";
  readonly #database;
  #globalPartIndex = 0;
  public constructor(a: IAudioContext, b: Opus) {
    super(a, b);
    this.#database = new RecorderDatabase(RecorderWithDatabase.databaseName);
    this.on("startRecording", this.onStartRecording);
    this.on("encoded", this.onEncoded);
  }
  public close() {
    this.off("startRecording", this.onStartRecording);
    this.off("encoded", this.onEncoded);
  }
  public database() {
    return this.#database;
  }
  @boundMethod private async onEncoded({
    encoderId,
    sampleCount,
    buffer
  }: {
    encoderId: CodecId;
    sampleCount: number;
    buffer: ArrayBuffer;
  }) {
    if (
      !(await this.#database.addRecordingPart({
        encoderId,
        partIndex: this.#globalPartIndex++,
        sampleCount,
        format: "opus",
        encoded: new Blob([buffer], {type: "application/octet-stream"})
      }))
    ) {
      console.error("Failed to add recording part");
    }
  }
  @boundMethod private async onStartRecording(data: {
    encoderId: CodecId;
    sampleRate: number;
    frameSize: number;
    channels: number;
  }) {
    const recordingId = await this.#database.create(data);
    if (recordingId === null) {
      console.error("failed to create recording database item: %o", data);
      return;
    }
  }
}
