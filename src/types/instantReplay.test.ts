import { describe, it, expect } from 'vitest';
import {
  isFileMessage,
  isCommandMessage,
  isStatusMessage,
  isReplayVideoEndedEvent,
  isReplayPlaylistItemEndedEvent,
  isReplayPlaylistCompletedEvent,
  type ChannelMessage,
} from './instantReplay';

describe('Type Guard Functions', () => {
  describe('isFileMessage', () => {
    it('should return true for valid FileMessage', () => {
      const message: ChannelMessage = {
        type: 'file',
        data: new ArrayBuffer(0),
        mime: 'video/mp4',
        name: 'test.mp4',
      };
      expect(isFileMessage(message)).toBe(true);
    });

    it('should return false for CommandMessage', () => {
      const message: ChannelMessage = {
        type: 'cmd',
        action: 'play',
      };
      expect(isFileMessage(message)).toBe(false);
    });

    it('should return false for StatusMessage', () => {
      const message: ChannelMessage = {
        type: 'status',
        duration: 10,
        currentTime: 5,
        markerA: null,
        markerB: null,
      };
      expect(isFileMessage(message)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const message: ChannelMessage = {
        type: 'file',
        data: new ArrayBuffer(100),
        mime: 'video/webm',
        name: 'replay.webm',
      };

      if (isFileMessage(message)) {
        // TypeScript should know message has 'data', 'mime', 'name' properties
        expect(message.data).toBeInstanceOf(ArrayBuffer);
        expect(message.mime).toBe('video/webm');
        expect(message.name).toBe('replay.webm');
      }
    });
  });

  describe('isCommandMessage', () => {
    it('should return true for valid CommandMessage with play action', () => {
      const message: ChannelMessage = {
        type: 'cmd',
        action: 'play',
      };
      expect(isCommandMessage(message)).toBe(true);
    });

    it('should return true for valid CommandMessage with value', () => {
      const message: ChannelMessage = {
        type: 'cmd',
        action: 'seek',
        value: 10.5,
      };
      expect(isCommandMessage(message)).toBe(true);
    });

    it('should return true for setSpeed CommandMessage', () => {
      const message: ChannelMessage = {
        type: 'cmd',
        action: 'setSpeed',
        value: 0.5,
      };
      expect(isCommandMessage(message)).toBe(true);
    });

    it('should return false for FileMessage', () => {
      const message: ChannelMessage = {
        type: 'file',
        data: new ArrayBuffer(0),
        mime: 'video/mp4',
        name: 'test.mp4',
      };
      expect(isCommandMessage(message)).toBe(false);
    });

    it('should return false for StatusMessage', () => {
      const message: ChannelMessage = {
        type: 'status',
        duration: 10,
        currentTime: 5,
        markerA: null,
        markerB: null,
      };
      expect(isCommandMessage(message)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const message: ChannelMessage = {
        type: 'cmd',
        action: 'setA',
        value: 5.25,
      };

      if (isCommandMessage(message)) {
        // TypeScript should know message has 'action' and 'value' properties
        expect(message.action).toBe('setA');
        expect(message.value).toBe(5.25);
      }
    });
  });

  describe('isStatusMessage', () => {
    it('should return true for valid StatusMessage', () => {
      const message: ChannelMessage = {
        type: 'status',
        duration: 30,
        currentTime: 15.5,
        markerA: 10,
        markerB: 20,
      };
      expect(isStatusMessage(message)).toBe(true);
    });

    it('should return true for StatusMessage with null markers', () => {
      const message: ChannelMessage = {
        type: 'status',
        duration: 45,
        currentTime: 22.3,
        markerA: null,
        markerB: null,
      };
      expect(isStatusMessage(message)).toBe(true);
    });

    it('should return false for FileMessage', () => {
      const message: ChannelMessage = {
        type: 'file',
        data: new ArrayBuffer(0),
        mime: 'video/mp4',
        name: 'test.mp4',
      };
      expect(isStatusMessage(message)).toBe(false);
    });

    it('should return false for CommandMessage', () => {
      const message: ChannelMessage = {
        type: 'cmd',
        action: 'pause',
      };
      expect(isStatusMessage(message)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const message: ChannelMessage = {
        type: 'status',
        duration: 35.8,
        currentTime: 12.3,
        markerA: 5,
        markerB: 30,
      };

      if (isStatusMessage(message)) {
        // TypeScript should know message has duration, currentTime, markerA, markerB
        expect(message.duration).toBe(35.8);
        expect(message.currentTime).toBe(12.3);
        expect(message.markerA).toBe(5);
        expect(message.markerB).toBe(30);
      }
    });
  });

  describe('Replay completion events', () => {
    it('accepts a single ReplayVideoEnded event without playlist metadata', () => {
      expect(isReplayVideoEndedEvent({
        type: 'ReplayVideoEnded',
        videoElement: 'InstantReplayScreen',
        fileName: 'goal.mp4',
        playbackId: 'playback-1',
        timestamp: Date.now(),
        duration: 8,
        currentTime: 8,
      })).toBe(true);
    });

    it('rejects legacy playlist-shaped ReplayVideoEnded events', () => {
      expect(isReplayVideoEndedEvent({
        type: 'ReplayVideoEnded',
        videoElement: 'InstantReplayScreen',
        fileName: 'highlight-1.mp4',
        playbackId: 'playback-1',
        playlistItemId: 'item-1',
        playlistSessionId: 'session-1',
        timestamp: Date.now(),
        duration: 12,
        currentTime: 12,
      })).toBe(false);
    });

    it('accepts a private playlist item completion event', () => {
      expect(isReplayPlaylistItemEndedEvent({
        type: 'ReplayPlaylistItemEnded',
        videoElement: 'InstantReplayScreen',
        fileName: 'highlight-1.mp4',
        playbackId: 'playback-1',
        playlistItemId: 'item-1',
        playlistSessionId: 'session-1',
        timestamp: Date.now(),
        duration: 12,
        currentTime: 12,
      })).toBe(true);
    });

    it('accepts a public playlist completion event', () => {
      expect(isReplayPlaylistCompletedEvent({
        type: 'ReplayPlaylistCompleted',
        videoElement: 'InstantReplayScreen',
        playlistSessionId: 'session-1',
        completedItemCount: 3,
        lastPlaylistItemId: 'item-3',
        timestamp: Date.now(),
      })).toBe(true);
    });

    it('rejects a playlist item event missing its session identity', () => {
      expect(isReplayPlaylistItemEndedEvent({
        type: 'ReplayPlaylistItemEnded',
        videoElement: 'InstantReplayScreen',
        fileName: 'highlight-1.mp4',
        playbackId: 'playback-1',
        playlistItemId: 'item-1',
        timestamp: Date.now(),
        duration: 12,
        currentTime: 12,
      })).toBe(false);
    });
  });

  describe('Type discrimination', () => {
    it('should handle all message types in a switch statement', () => {
      const messages: ChannelMessage[] = [
        { type: 'file', data: new ArrayBuffer(0), mime: 'video/mp4', name: 'test.mp4' },
        { type: 'cmd', action: 'play' },
        { type: 'status', duration: 10, currentTime: 5, markerA: null, markerB: null },
      ];

      messages.forEach((message) => {
        if (isFileMessage(message)) {
          expect(message.type).toBe('file');
        } else if (isCommandMessage(message)) {
          expect(message.type).toBe('cmd');
        } else if (isStatusMessage(message)) {
          expect(message.type).toBe('status');
        }
      });
    });
  });
});
