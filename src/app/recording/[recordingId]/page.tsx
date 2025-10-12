"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { filesize } from "filesize";
import NavigationBar from "@/components/NavigationBar";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import ActivityIndicator from "@/components/ui/ActivityIndicator";
import useRecorderDatabase from "@/hooks/useRecorderDatabase";
import useRecordingPlayer from "@/hooks/useRecordingPlayer";
import secondsToHumanReadable from "@/lib/secondsToHumanReadable";
import dynamic from "next/dynamic";

const AnalyserNodeView = dynamic(
  () => import("@/components/AnalyserNodeView"),
  {
    ssr: false,
  }
);

export default function RecordingDetailScreen() {
  const params = useParams();
  const router = useRouter();
  const recorderDatabase = useRecorderDatabase();
  const player = useRecordingPlayer();
  const recordingId = params?.recordingId as string;

  const recording = useMemo(
    () => recorderDatabase.recordings.find((r) => r.id === recordingId) ?? null,
    [recorderDatabase.recordings, recordingId]
  );

  const [canvasContainerDimensions, setCanvasContainerDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const getRecording = useCallback(() => {
    if (!recording && typeof recordingId === "string") {
      recorderDatabase.getRecording(recordingId);
    }
  }, [recorderDatabase, recordingId, recording]);

  const play = useCallback(() => {
    if (recording !== null) {
      player.play(recording);
    }
  }, [recording, player]);

  const humanReadableRecordingSize = useMemo(
    () => filesize(recording?.size ?? 0).toString(),
    [recording]
  );

  useEffect(() => {
    getRecording();
  }, [getRecording]);

  const onCanvasContainerElementMount = useCallback(
    (current: HTMLDivElement | null) => {
      if (current !== null) {
        setCanvasContainerDimensions({
          width: current.offsetWidth,
          height: current.offsetHeight,
        });
      } else {
        setCanvasContainerDimensions(null);
      }
    },
    []
  );

  if (!recording) {
    return (
      <>
        <NavigationBar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <ActivityIndicator size="lg" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavigationBar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Back Button */}
          <Button variant="ghost" onClick={() => router.push("/recordings")}>
            <Icon name="arrow_back" className="mr-2" />
            Back to Recordings
          </Button>

          {/* Main Player Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="music_note" size="lg" className="text-primary" />
                {recording.name || "Untitled Recording"}
              </CardTitle>
              <CardDescription>
                {DateTime.fromJSDate(recording.createdAt).toLocaleString(
                  DateTime.DATETIME_FULL
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {recorderDatabase.loadingRecordIds.includes(recording.id) ? (
                <div className="flex justify-center py-12">
                  <ActivityIndicator size="lg" />
                </div>
              ) : (
                <>
                  {/* Player Controls */}
                  <div className="flex items-center gap-4">
                    <Button
                      size="lg"
                      variant={
                        player.playing !== null ? "secondary" : "default"
                      }
                      onClick={player.playing !== null ? player.pause : play}
                      className="shrink-0"
                    >
                      <Icon
                        name={player.playing !== null ? "pause" : "play_arrow"}
                        size="lg"
                      />
                    </Button>

                    {/* Visualizer */}
                    <div
                      className="flex-1 relative bg-muted rounded-lg overflow-hidden"
                      style={{ height: "128px" }}
                      ref={onCanvasContainerElementMount}
                    >
                      {canvasContainerDimensions !== null &&
                      player.analyserNode() ? (
                        <AnalyserNodeView
                          visualizationMode={{
                            type: "verticalBars",
                            barWidth: 20,
                          }}
                          canvasHeight={128 * window.devicePixelRatio}
                          canvasWidth={
                            canvasContainerDimensions.width *
                            window.devicePixelRatio
                          }
                          isPlaying={player.playing !== null}
                          analyserNode={player.analyserNode()}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Icon
                            name="graphic_eq"
                            size="xl"
                            className="text-muted-foreground"
                          />
                        </div>
                      )}
                      {player.playing !== null &&
                        player.playing.cursor !== null && (
                          <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                            {secondsToHumanReadable(player.playing.cursor)}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {player.playing !== null &&
                    player.playing.cursor !== null && (
                      <div className="space-y-2">
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{
                              width: `${
                                (player.playing.cursor /
                                  (recording.duration / 1000)) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {secondsToHumanReadable(player.playing.cursor)}
                          </span>
                          <span>
                            {secondsToHumanReadable(recording.duration / 1000)}
                          </span>
                        </div>
                      </div>
                    )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Recording Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Technical Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sample Rate</span>
                  <span className="font-medium">{recording.sampleRate} Hz</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Channels</span>
                  <span className="font-medium">{recording.channels}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frame Size</span>
                  <span className="font-medium">{recording.frameSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File Size</span>
                  <span className="font-medium">
                    {humanReadableRecordingSize}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recording Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">
                    {secondsToHumanReadable(recording.duration / 1000)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">
                    {DateTime.fromJSDate(recording.createdAt).toRelative()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                    {recording.id}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <Icon name="download" className="mr-2" />
                  Download
                </Button>
                <Button variant="outline" className="flex-1">
                  <Icon name="share" className="mr-2" />
                  Share
                </Button>
                <Button variant="destructive" className="flex-1">
                  <Icon name="delete" className="mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
