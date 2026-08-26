# Implementation Plan: Instant Replay

## Overview

This implementation plan creates a dual-view instant replay system for OBS Replay Buffer management. The system consists of a Control Panel (`/replay`) for operators to manage replay files and settings, and a Screen Mode (`/replay/screen`) for OBS Browser Source video display. Communication between views uses BroadcastChannel API, and file access leverages the File System Access API. The implementation follows React patterns with TypeScript for type safety.

## Tasks

- [x] 1. Set up core types and utilities
  - [x] 1.1 Create TypeScript types for messages and state
    - Define `ChannelMessage` discriminated union types (FileMessage, CommandMessage, StatusMessage)
    - Define component state interfaces (ControlState, ScreenState, VideoState)
    - Define settings and metadata interfaces (ReplaySettings, VideoFileMetadata)
    - Create type guard functions (isFileMessage, isCommandMessage, isStatusMessage)
    - _Requirements: 6.3, 6.4, 6.5_

  - [x] 1.2 Implement utility functions for formatting and validation
    - Create `formatTime(seconds: number): string` for MM:SS time formatting
    - Create `formatSize(bytes: number): string` for KB/MB file size formatting
    - Create `isVideoFile(file: File): boolean` for video file validation (MIME type and extension)
    - Create `findLatestFile(files: File[]): File | null` for identifying latest file by lastModified
    - _Requirements: 3.9, 4.1, 4.2, 8.2, 8.3, 8.9_

  - [ ]* 1.3 Write property tests for utility functions
    - **Property 3: Time Formatting Round-Trip Structure**
    - **Property 4: Size Formatting Consistency**
    - **Property 5: Video File Validation Completeness**
    - **Validates: Requirements 3.9, 4.1, 4.2, 8.2, 8.3, 8.9**

- [x] 2. Create BroadcastChannel communication hook
  - [x] 2.1 Implement useReplayChannel custom hook
    - Create hook with channel initialization using "scoreboard_replay_v1"
    - Implement `send(message: ChannelMessage)` method with type safety
    - Add cleanup to close channel on component unmount
    - Use useRef to store channel instance
    - _Requirements: 6.1, 6.8_

  - [ ]* 2.2 Write unit tests for useReplayChannel
    - Test channel initialization and cleanup
    - Test message sending with different message types
    - Test error handling for send failures
    - _Requirements: 6.1, 6.8, 6.9_

- [x] 3. Implement InstantReplayScreen component (Screen Mode)
  - [x] 3.1 Create basic screen component structure
    - Create `InstantReplayScreen.tsx` component
    - Set up video element ref and state (objectUrl, hasVideo, loopA, loopB)
    - Implement "WAITING FOR REPLAY FEED" placeholder display
    - Add BroadcastChannel hook integration
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 3.2 Implement file message handler
    - Handle FileMessage from BroadcastChannel
    - Create Blob from ArrayBuffer and generate object URL
    - Assign Blob URL to video element src
    - Implement cleanup to revoke previous object URL
    - Set video playback rate to 1x and autoplay
    - _Requirements: 2.5, 10.5, 10.6, 10.9_

  - [x] 3.3 Implement video metadata and status reporting
    - Listen to loadedmetadata event to extract duration
    - Send StatusMessage with duration, currentTime, markerA, markerB
    - Listen to timeupdate event to send ongoing status updates
    - _Requirements: 2.6, 6.6, 6.7_

  - [x] 3.4 Implement command message handlers
    - Handle play command: call video.play() with promise catch
    - Handle pause command: call video.pause()
    - Handle seek command: set video.currentTime to value
    - Handle setA command: update loopA state
    - Handle setB command: update loopB state
    - Handle clearLoop command: reset loopA and loopB to null
    - _Requirements: 10.7, 10.8_

  - [x] 3.5 Implement loop boundary enforcement
    - In timeupdate handler, check if currentTime > loopB
    - If exceeded, seek to loopA
    - Check if currentTime < loopA - 0.1, seek to loopA
    - Only enforce when both loopA and loopB are non-null
    - Clear markers when new file loads
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 3.6 Write unit tests for screen component logic
    - Test loop boundary checking logic
    - Test command execution handlers
    - Test status message generation
    - Test object URL cleanup
    - _Requirements: 7.1, 7.2, 7.3, 10.7, 10.8, 10.9_

  - [ ]* 3.7 Write property test for loop enforcement
    - **Property 8: Loop Boundary Enforcement**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 4. Checkpoint - Verify screen mode functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement InstantReplayControl component (Control Panel)
  - [x] 5.1 Create basic control component structure
    - Create `InstantReplayControl.tsx` component
    - Set up state management for all ControlState properties
    - Add BroadcastChannel hook integration
    - Create UI sections for folder, file info, settings, playback controls
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_

  - [x] 5.2 Implement LocalStorage persistence
    - Create `loadSettings()` to restore from LocalStorage with defaults
    - Create `saveSettings()` to persist replayDuration, autoTrim, autoLoad, folderName
    - Call loadSettings in useEffect on mount
    - Call saveSettings whenever settings change
    - Handle JSON parse errors gracefully
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [ ]* 5.3 Write property test for LocalStorage persistence
    - **Property 9: LocalStorage Persistence Round-Trip**
    - **Validates: Requirements 9.5, 9.6, 9.7, 9.8**

- [x] 6. Implement folder selection and file system access
  - [x] 6.1 Create folder selection UI and handlers
    - Add "Select Replay Folder" button
    - Implement `selectFolder()` using showDirectoryPicker API
    - Store folderHandle in state
    - Display folder name in UI
    - Save folder name to LocalStorage
    - Add "Change Folder" button
    - _Requirements: 1.1, 1.4, 1.5, 1.7_

  - [x] 6.2 Implement file scanning and sorting
    - Create directory file scanning to read directory contents
    - Filter files using isVideoFile validation
    - Sort files by lastModified in descending order
    - Store videoFiles array in state
    - Update lastScanTimestamp
    - _Requirements: 1.2, 1.3, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 6.3 Write property tests for file operations
    - **Property 1: File Sorting Preserves Order Invariant**
    - **Property 6: File Identification Consistency**
    - **Property 7: New File Detection Accuracy**
    - **Validates: Requirements 1.3, 4.5, 5.3**

- [x] 7. Implement file loading workflow
  - [x] 7.1 Create manual file loading
    - Add "Load Latest Replay" button
    - Implement `loadLatestFile()` to find latest file using findLatestFile
    - Read file as ArrayBuffer using file.arrayBuffer()
    - Send FileMessage via BroadcastChannel with ArrayBuffer, MIME type, filename
    - Display loaded filename, size, and lastModified in UI
    - Handle file read errors with user-friendly messages
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.1, 8.2, 8.3_

  - [ ]* 7.2 Write integration test for file loading workflow
    - Test end-to-end file loading with mocked File System API
    - Test ArrayBuffer transmission via mocked BroadcastChannel
    - Test error handling for file read failures
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 8. Implement auto-trim calculation and controls
  - [x] 8.1 Create auto-trim UI controls
    - Add preset buttons for 5, 8, 10, 15 seconds, and "Full"
    - Add range slider (3-30 seconds, 0.5 increment)
    - Add "Auto-trim" checkbox
    - Display current replayDuration value
    - Update replayDuration state on user interaction
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.8, 3.12_

  - [x] 8.2 Implement trim calculation logic
    - Create `calculateTrimStartTime(duration, replayDuration)` function
    - Create `applyAutoTrim(duration)` function to execute trim workflow
    - When status message received with duration and autoTrim enabled, calculate trim start
    - Send setA command with value 0
    - Send setB command with video duration
    - Send seek command with calculated trim start time
    - Display "Playing from [START] to [END]" with formatTime
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9, 3.11, 8.5_

  - [x] 8.3 Add visual timeline marker
    - Display timeline visualization showing trim start position
    - Update marker when replayDuration changes
    - _Requirements: 3.10_

  - [ ]* 8.4 Write property test for trim calculation
    - **Property 2: Trim Calculation Correctness**
    - **Validates: Requirements 3.5**

  - [ ]* 8.5 Write integration test for auto-trim workflow
    - Test trim calculation with various duration values
    - Test command sequence (setA, setB, seek) with correct values
    - Test UI updates when settings change
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9, 3.11_

- [x] 9. Implement auto-load polling
  - [x] 9.1 Create auto-load UI and polling mechanism
    - Add "Auto-load new replays (watch folder)" checkbox
    - Implement interval polling at 3 seconds
    - Implement cleanup to clear interval
    - Save autoLoad state to LocalStorage
    - _Requirements: 5.1, 5.7, 5.8_

  - [x] 9.2 Implement new file detection and auto-load workflow
    - In poll handler, read directory files
    - Compare current files with previous scan by lastModified
    - If new file detected, call loadLatestFile automatically
    - When status message received, apply auto-trim if enabled
    - After trim applied, send play command automatically
    - Log and continue on polling errors
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.9_

  - [ ]* 9.3 Write integration test for auto-load workflow
    - Test polling mechanism with mocked timer
    - Test new file detection logic
    - Test automatic load and play sequence
    - Test error handling during polling
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.9_

- [x] 10. Checkpoint - Verify control panel functionality
  - All control panel workflows implemented and functional.

- [x] 11. Add routing and authentication
  - [x] 11.1 Register routes in App.tsx
    - Create `InstantReplayPage.tsx` wrapper component accepting mode prop ("control" | "screen")
    - Conditionally render InstantReplayControl or InstantReplayScreen based on mode
    - Add route `/replay` with AuthGuard wrapping control mode
    - Add route `/replay/screen` without authentication for screen mode
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ]* 11.2 Write integration test for routing
    - Test authenticated access to /replay
    - Test unauthenticated redirect from /replay
    - Test public access to /replay/screen
    - _Requirements: 11.5, 11.6, 11.7_

- [x] 12. Add styling and final polish
  - [x] 12.1 Create CSS stylesheet
    - `InstantReplayControl.css` styling control panel with dark broadcast control aesthetic
    - Screen mode full-screen video display
    - Responsive layout
    - High contrast for OBS Browser Source compatibility
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 10.3, 10.4_

  - [x] 12.2 Add error handling UI
    - Display user-friendly error messages for folder selection failures
    - Display error notifications for file loading failures
    - Display error messages for video playback failures
    - Handle File System Access API not supported with helpful message
    - _Requirements: 1.8_

- [x] 13. Final checkpoint - Integration verification
  - Feature implementation completed and verified.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Integration tests validate end-to-end workflows
- The system follows React patterns with TypeScript for type safety
- BroadcastChannel enables reliable cross-window communication
- File System Access API provides direct folder monitoring (Chromium browsers only)
- LocalStorage provides settings persistence across sessions

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["3.5", "3.6", "3.7", "4"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 7, "tasks": ["6.2", "6.3"] },
    { "id": 8, "tasks": ["7.1", "7.2"] },
    { "id": 9, "tasks": ["8.1"] },
    { "id": 10, "tasks": ["8.2", "8.3"] },
    { "id": 11, "tasks": ["8.4", "8.5", "9.1"] },
    { "id": 12, "tasks": ["9.2", "9.3", "10"] },
    { "id": 13, "tasks": ["11.1", "11.2"] },
    { "id": 14, "tasks": ["12.1", "12.2", "13"] }
  ]
}
```
