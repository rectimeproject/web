import {useEffect} from "react";
import * as PIXI from "pixi.js";

interface IBookmark {
  id: string;
  durationOffset: number;
  title?: string;
}

interface BookmarkMarkersProps {
  bookmarks: IBookmark[];
  markersContainerRef: React.RefObject<PIXI.Container | null>;
  dimensions: {width: number; height: number};
  currentDuration: number;
  totalDuration: number | undefined;
  bookmarkColor?: number;
  onBookmarkClick: ((bookmark: IBookmark) => void) | undefined;
  visualizationMode: "timeline" | "frequency";
  timeWindowSeconds: number | undefined;
}

/**
 * Renders bookmark markers as vertical lines on the visualizer
 * Optimized for touch devices with 48px touch targets
 */
export default function BookmarkMarkers({
  bookmarks,
  markersContainerRef,
  dimensions,
  currentDuration,
  totalDuration,
  bookmarkColor = 0xff6b6b,
  onBookmarkClick,
  visualizationMode,
  timeWindowSeconds = 10
}: BookmarkMarkersProps) {
  useEffect(() => {
    if (!markersContainerRef.current) return;

    const container = markersContainerRef.current;
    container.removeChildren();

    const duration = totalDuration ?? currentDuration;
    if (!duration) return;

    const TOUCH_TARGET_WIDTH = 48; // Material Design guideline
    const LINE_WIDTH = 2;

    // Calculate visible time range
    let visibleStartMs = 0;
    let visibleEndMs = duration;

    if (visualizationMode === "timeline") {
      const timeWindowMs = timeWindowSeconds * 1000;
      visibleStartMs = Math.max(0, duration - timeWindowMs);
      visibleEndMs = duration;
    }

    bookmarks.forEach(bookmark => {
      // For timeline mode, only show bookmarks in the visible window
      if (visualizationMode === "timeline") {
        if (
          bookmark.durationOffset < visibleStartMs ||
          bookmark.durationOffset > visibleEndMs
        ) {
          return; // Skip bookmarks outside the visible window
        }

        // Calculate position relative to the visible window
        const relativeOffset = bookmark.durationOffset - visibleStartMs;
        const windowDuration = visibleEndMs - visibleStartMs;
        const x = (relativeOffset / windowDuration) * dimensions.width;

        createBookmarkMarker(x, bookmark);
      } else {
        // For frequency mode, use full duration
        const x = (bookmark.durationOffset / duration) * dimensions.width;
        createBookmarkMarker(x, bookmark);
      }
    });

    function createBookmarkMarker(x: number, bookmark: IBookmark) {
      // Create container for this bookmark
      const markerContainer = new PIXI.Container();
      markerContainer.x = x;

      // Visual line (simple vertical line, no decorations)
      const line = new PIXI.Graphics();
      line.moveTo(0, 0);
      line.lineTo(0, dimensions.height);
      line.stroke({width: LINE_WIDTH, color: bookmarkColor, alpha: 0.85});

      // Hit area (wider for touch devices, invisible)
      const hitArea = new PIXI.Graphics();
      hitArea.rect(
        -TOUCH_TARGET_WIDTH / 2,
        0,
        TOUCH_TARGET_WIDTH,
        dimensions.height
      );
      hitArea.fill({color: 0x000000, alpha: 0});

      hitArea.interactive = true;
      hitArea.cursor = "pointer";
      hitArea.hitArea = new PIXI.Rectangle(
        -TOUCH_TARGET_WIDTH / 2,
        0,
        TOUCH_TARGET_WIDTH,
        dimensions.height
      );

      // Event handlers
      hitArea.on("click", () => onBookmarkClick?.(bookmark));
      hitArea.on("tap", () => onBookmarkClick?.(bookmark));

      // Visual feedback - brighten line on hover/touch
      hitArea.on("pointerover", () => {
        line.alpha = 1;
        line.clear();
        line.moveTo(0, 0);
        line.lineTo(0, dimensions.height);
        line.stroke({width: LINE_WIDTH + 1, color: bookmarkColor, alpha: 1});
      });

      hitArea.on("pointerout", () => {
        line.clear();
        line.moveTo(0, 0);
        line.lineTo(0, dimensions.height);
        line.stroke({width: LINE_WIDTH, color: bookmarkColor, alpha: 0.85});
      });

      hitArea.on("pointerdown", () => {
        line.alpha = 0.6;
      });

      hitArea.on("pointerup", () => {
        line.alpha = 1;
      });

      markerContainer.addChild(line);
      markerContainer.addChild(hitArea);
      container.addChild(markerContainer);
    }
  }, [
    bookmarks,
    markersContainerRef,
    dimensions,
    currentDuration,
    totalDuration,
    onBookmarkClick,
    bookmarkColor,
    visualizationMode,
    timeWindowSeconds
  ]);

  return null;
}
