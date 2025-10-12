"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DateTime } from "luxon";
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
import secondsToHumanReadable from "@/lib/secondsToHumanReadable";

export default function RecordingListScreen() {
  const db = useRecorderDatabase();
  const router = useRouter();
  const [newRecordingNames, setNewRecordingNames] = useState(
    new Map<string, string>()
  );

  const recordings = useMemo(
    () =>
      db.recordings.map((r) => ({
        ...r,
        originalValue: r,
        onChangeNewRecordingName: (e: ChangeEvent<HTMLInputElement>) => {
          const newName = e.target.value;
          setNewRecordingNames(
            (newRecordingNames) =>
              new Map([...newRecordingNames, [r.id, newName]])
          );
        },
        onClickPlay: () => router.push(`/recording/${r.id}`),
      })),
    [router, db.recordings]
  );

  useEffect(() => {
    for (const [id, name] of newRecordingNames) {
      if (db.updatingRecordingIds.includes(id)) {
        continue;
      }
      const recording = recordings.find((r) => r.id === id);
      if (!recording) {
        console.error("failed to update recording: %o", recording);
        continue;
      }
      if (recording.name === name) {
        continue;
      }
      db.updateRecording({
        ...recording.originalValue,
        name,
      });
    }
  }, [db, recordings, newRecordingNames]);

  useEffect(() => {
    if (!db.hasLoadedInitialRecordings) db.getRecordings();
  }, [db]);

  const onScroll = useCallback(() => {
    if (!document.scrollingElement) {
      return;
    }
    const pct =
      window.scrollY /
      (document.scrollingElement.scrollHeight -
        document.scrollingElement.clientHeight);
    if (pct < 0.9) {
      return;
    }
    db.getMoreRecordings();
  }, [db]);

  useEffect(() => {
    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [onScroll]);

  const deleteRecording = useCallback(
    (id: string) => {
      if (confirm("Are you sure you want to delete this recording?")) {
        db.deleteRecording(id);
      }
    },
    [db]
  );

  return (
    <>
      <NavigationBar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Your Recordings
              </h1>
              <p className="text-muted-foreground mt-1">
                {recordings.length} recording
                {recordings.length !== 1 ? "s" : ""} total
              </p>
            </div>
            <Button asChild>
              <Link href="/">
                <Icon name="add" className="mr-2" />
                New Recording
              </Link>
            </Button>
          </div>

          {/* Recording List */}
          {!recordings.length ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <Icon
                    name="mic_off"
                    size="xl"
                    className="text-muted-foreground mx-auto"
                  />
                  <div>
                    <h3 className="text-lg font-semibold">No recordings yet</h3>
                    <p className="text-muted-foreground mt-1">
                      Get started by creating your first recording
                    </p>
                  </div>
                  <Button asChild>
                    <Link href="/">
                      <Icon name="mic" className="mr-2" />
                      Start Recording
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recordings.map((r) => (
                <Card
                  key={r.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={(e) => {
                    // Don't navigate if clicking on input or buttons
                    const target = e.target as HTMLElement;
                    if (
                      target.tagName === "INPUT" ||
                      target.tagName === "BUTTON" ||
                      target.closest("button")
                    ) {
                      return;
                    }
                    r.onClickPlay();
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {r.name || "Untitled Recording"}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {DateTime.fromJSDate(r.createdAt).toLocaleString(
                            DateTime.DATETIME_SHORT
                          )}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRecording(r.id);
                        }}
                        className="shrink-0"
                      >
                        <Icon name="delete" className="text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Icon
                        name="schedule"
                        size="sm"
                        className="text-muted-foreground"
                      />
                      <span className="text-sm font-medium">
                        {secondsToHumanReadable(r.duration / 1000)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon
                        name="settings_voice"
                        size="sm"
                        className="text-muted-foreground"
                      />
                      <span className="text-sm text-muted-foreground">
                        {r.sampleRate} Hz • {r.channels} channel
                        {r.channels > 1 ? "s" : ""}
                      </span>
                    </div>
                    <Button
                      className="w-full mt-4"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        r.onClickPlay();
                      }}
                    >
                      <Icon name="play_arrow" className="mr-2" />
                      Play
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Loading More */}
          {db.isGettingMoreRecordings && (
            <div className="flex justify-center py-8">
              <ActivityIndicator size="md" />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
