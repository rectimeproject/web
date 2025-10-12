"use client";

import { RecorderContext, IRecorderContextValue } from "@/lib/RecorderContext";
import { Opus } from "@/lib/Recorder";
import { AudioContext } from "standardized-audio-context";
import RecorderWithDatabase from "@/lib/RecorderWithDatabase";
import RecorderDatabase from "@/lib/RecorderDatabase";
import RecorderDatabaseContext from "@/lib/RecorderDatabaseContext";
import { ThemeProvider } from "@/components/theme-provider";
import { useEffect, useState, ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [recorderContext, setRecorderContext] =
    useState<IRecorderContextValue | null>(null);
  const [recorderDatabase, setRecorderDatabase] =
    useState<RecorderDatabase | null>(null);

  useEffect(() => {
    // Initialize on client side only
    const opus = new Opus();
    const audioContext = new AudioContext({
      sampleRate: 48000,
    });
    const pendingWorklet = audioContext.audioWorklet?.addModule("/worklet.js");

    const context: IRecorderContextValue = {
      opus,
      recorder: pendingWorklet
        ? pendingWorklet.then(
            () => new RecorderWithDatabase(audioContext, opus)
          )
        : Promise.resolve(null),
      audioContext,
      worklet: Promise.resolve<void>(pendingWorklet),
    };

    const db = new RecorderDatabase(RecorderWithDatabase.databaseName);

    setRecorderContext(context);
    setRecorderDatabase(db);
  }, []);

  if (!recorderContext || !recorderDatabase) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse">Loading...</div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <RecorderDatabaseContext.Provider value={recorderDatabase}>
        <RecorderContext.Provider value={recorderContext}>
          {children}
        </RecorderContext.Provider>
      </RecorderDatabaseContext.Provider>
    </ThemeProvider>
  );
}
