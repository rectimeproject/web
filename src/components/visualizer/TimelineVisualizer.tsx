import PixiVisualizerBase from "./PixiVisualizerBase.js";
import {useVisualizerBars} from "../../hooks/visualizer/useVisualizerBars.js";
import {useTimelineWaveform} from "../../hooks/visualizer/useTimelineWaveform.js";
import BookmarkMarkers from "./BookmarkMarkers.js";

interface IBookmark {
  id: string;
  durationOffset: number;
  title?: string;
}

interface TimelineVisualizerProps {
  canvasWidth?: number | string;
  canvasHeight?: number | string;
  backgroundColor?: number;
  barColor?: number;
  bookmarkColor?: number;
  waveformSamples: number[];
  samplesPerSecond: number | undefined;
  timeWindowSeconds: number | undefined;
  bookmarks?: IBookmark[];
  currentDuration?: number;
  totalDuration: number | undefined;
  onBookmarkClick?: (bookmark: IBookmark) => void;
}

/**
 * Timeline visualization component
 * Displays waveform amplitude over time with optional scrolling window
 */
export default function TimelineVisualizer({
  canvasWidth = "100%",
  canvasHeight = 256,
  backgroundColor = 0xe9ecef,
  barColor = 0x495057,
  bookmarkColor = 0xff6b6b,
  waveformSamples,
  samplesPerSecond = 20,
  timeWindowSeconds = 10,
  bookmarks = [],
  currentDuration = 0,
  totalDuration,
  onBookmarkClick
}: TimelineVisualizerProps) {
  return (
    <PixiVisualizerBase
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      backgroundColor={backgroundColor}
    >
      {({barsContainerRef, markersContainerRef, isPixiReady, dimensions}) => {
        const barsRef = useVisualizerBars({
          visualizationMode: {
            type: "timeline",
            samplesPerSecond,
            timeWindowSeconds
          },
          isPixiReady,
          barsContainerRef
        });

        useTimelineWaveform({
          waveformSamples,
          barsRef,
          dimensions,
          barColor,
          samplesPerSecond,
          timeWindowSeconds
        });

        return (
          <BookmarkMarkers
            bookmarks={bookmarks}
            markersContainerRef={markersContainerRef}
            dimensions={dimensions}
            currentDuration={currentDuration}
            totalDuration={totalDuration}
            bookmarkColor={bookmarkColor}
            onBookmarkClick={onBookmarkClick}
            visualizationMode="timeline"
            timeWindowSeconds={timeWindowSeconds}
          />
        );
      }}
    </PixiVisualizerBase>
  );
}
