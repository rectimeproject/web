// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import {vi, afterEach} from "vitest";
import {cleanup} from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Web Audio API (not available in jsdom)
global.AudioContext = vi.fn().mockImplementation(() => ({
  createAnalyser: vi.fn(),
  createGain: vi.fn(),
  createMediaStreamSource: vi.fn(),
  audioWorklet: {
    addModule: vi.fn().mockResolvedValue(undefined)
  },
  sampleRate: 48000,
  state: "running",
  resume: vi.fn().mockResolvedValue(undefined),
  destination: {}
})) as any;

// Mock AudioWorkletNode
(global as any).AudioWorkletNode = vi.fn();

// Mock MediaDevices
Object.defineProperty(global.navigator, "mediaDevices", {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [],
      getAudioTracks: () => [],
      getVideoTracks: () => []
    }),
    enumerateDevices: vi.fn().mockResolvedValue([])
  },
  writable: true
});

// Mock IndexedDB
const indexedDB = require("fake-indexeddb");
const IDBKeyRange = require("fake-indexeddb/lib/FDBKeyRange");

(global as any).indexedDB = indexedDB;
(global as any).IDBKeyRange = IDBKeyRange;
