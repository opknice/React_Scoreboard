# Requirements Document

## Introduction

The Instant Replay system provides an automated workflow for playing OBS Replay Buffer clips during live football streaming broadcasts. The system consists of a Control Panel (/replay) for administrators and a Screen Mode (/replay/screen) for OBS Browser Source display. The system communicates via BroadcastChannel and supports folder monitoring, automatic trimming, and instant playback of the latest replay clips.

## Glossary

- **Instant_Replay_System**: The complete system managing replay clip playback including control panel and screen display
- **Control_Panel**: The administrator interface at /replay for managing replay settings and triggering playback
- **Screen_Mode**: The OBS Browser Source display at /replay/screen showing video playback
- **Replay_Buffer**: OBS feature that continuously records and saves the last N seconds when triggered
- **Replay_Folder**: The directory where OBS saves Replay Buffer video files
- **Replay_Duration**: The number of seconds from the end of a clip to play (e.g., 8 seconds)
- **Auto_Trim**: Feature that automatically plays only the last N seconds of a replay clip
- **Folder_Handle**: File System Access API directory handle for monitoring folder changes
- **Latest_Clip**: The most recently modified video file in the Replay_Folder
- **Watch_Folder**: Feature that monitors the Replay_Folder for new files and auto-loads them
- **Trim_Start_Time**: The calculated video timestamp where trimmed playback begins (duration - replayDuration)
- **Video_Metadata**: Information about a video file including duration, size, and modification timestamp
- **Channel_Name**: The BroadcastChannel identifier "scoreboard_replay_v1"

## Requirements

### Requirement 1: Folder Selection and Management

**User Story:** As a stream operator, I want to select the folder where OBS saves replay files, so that the system can access and load replay clips automatically.

#### Acceptance Criteria

1. WHEN the operator clicks "Select Replay Folder", THE Control_Panel SHALL invoke showDirectoryPicker from the File System Access API
2. WHEN a Folder_Handle is granted, THE Control_Panel SHALL read all video files from the directory
3. WHEN video files are loaded, THE Control_Panel SHALL sort them by lastModified timestamp in descending order
4. THE Control_Panel SHALL display the folder name in the UI
5. WHEN a folder is selected, THE Control_Panel SHALL store the folder name in LocalStorage with key "replayFolderName"
6. WHEN the Control_Panel loads, THE Control_Panel SHALL restore the saved folder name from LocalStorage
7. THE Control_Panel SHALL provide a "Change Folder" button to select a different Replay_Folder
8. WHEN no folder is selected, THE Control_Panel SHALL display a prompt to select a folder

### Requirement 2: Latest Replay Loading

**User Story:** As a stream operator, I want to instantly load the latest replay clip, so that I can quickly review and play recent game moments.

#### Acceptance Criteria

1. WHEN a Replay_Folder is selected, THE Control_Panel SHALL automatically identify the Latest_Clip
2. THE Control_Panel SHALL provide a "Load Latest Replay" button
3. WHEN "Load Latest Replay" is clicked, THE Control_Panel SHALL read the Latest_Clip as an ArrayBuffer
4. WHEN the ArrayBuffer is ready, THE Control_Panel SHALL send a message via Channel_Name containing the ArrayBuffer, MIME type, and filename
5. WHEN Screen_Mode receives a file message, THE Screen_Mode SHALL create a Blob URL and assign it to the video element source
6. WHEN video metadata is loaded, THE Screen_Mode SHALL send Video_Metadata back to the Control_Panel via Channel_Name
7. THE Control_Panel SHALL display the loaded filename, file size, and last modified date
8. WHEN a file is loaded, THE Screen_Mode SHALL automatically play the video

### Requirement 3: Automatic Trim Calculation

**User Story:** As a stream operator, I want to automatically play only the last N seconds of a replay clip, so that viewers see only the relevant action without manual editing.

#### Acceptance Criteria

1. THE Control_Panel SHALL provide preset buttons for 5, 8, 10, and 15 seconds
2. THE Control_Panel SHALL provide a "Full" button to play the entire clip without trimming
3. THE Control_Panel SHALL provide a range slider adjustable in 0.5 second increments from 3 to 30 seconds
4. THE Control_Panel SHALL provide an "Auto-trim" checkbox to enable or disable automatic trimming
5. WHEN Auto_Trim is enabled and Video_Metadata is received, THE Control_Panel SHALL calculate Trim_Start_Time as (duration - Replay_Duration)
6. WHEN Trim_Start_Time is calculated, THE Control_Panel SHALL send setA command with value 0
7. WHEN Trim_Start_Time is calculated, THE Control_Panel SHALL send setB command with the video duration value
8. WHEN Trim_Start_Time is calculated, THE Control_Panel SHALL send seek command with Trim_Start_Time value
9. WHEN Trim_Start_Time is greater than 0, THE Control_Panel SHALL display "Playing from [START_TIME] to [END_TIME]" using formatTime
10. THE Control_Panel SHALL display a visual indicator on the timeline showing the Trim_Start_Time position
11. WHEN the user changes Replay_Duration, THE Control_Panel SHALL recalculate Trim_Start_Time and update playback markers
12. THE Control_Panel SHALL store the Replay_Duration value in LocalStorage with key "replayDuration"
13. THE Control_Panel SHALL store the Auto_Trim state in LocalStorage with key "autoTrim"

### Requirement 4: Parser for Video File Formats

**User Story:** As a developer, I want to correctly identify and parse video files from the Replay_Folder, so that the system loads only valid video files.

#### Acceptance Criteria

1. THE Control_Panel SHALL accept files matching the regex pattern /\.(mp4|webm|mov|m4v|avi|mkv)$/i
2. THE Control_Panel SHALL accept files with MIME types starting with "video/"
3. WHEN a file does not match video criteria, THE Control_Panel SHALL exclude it from the file list
4. THE Control_Panel SHALL parse file metadata including name, size, and lastModified timestamp
5. FOR ALL valid video files loaded and then re-scanned, THE Control_Panel SHALL produce consistent file identification results (round-trip property)

### Requirement 5: Watch Folder Auto-Load

**User Story:** As a stream operator, I want new replay files to load and play automatically when saved by OBS, so that I can trigger replays instantly during live broadcast without manual clicks.

#### Acceptance Criteria

1. THE Control_Panel SHALL provide a checkbox "Auto-load new replays (watch folder)"
2. WHEN auto-load is enabled, THE Control_Panel SHALL poll the Replay_Folder every 3 seconds
3. WHEN a new file is detected (lastModified timestamp newer than last scan), THE Control_Panel SHALL identify it as Latest_Clip
4. WHEN a new Latest_Clip is detected, THE Control_Panel SHALL automatically trigger the load workflow
5. WHEN the load workflow completes, THE Control_Panel SHALL automatically calculate Trim_Start_Time if Auto_Trim is enabled
6. WHEN Trim_Start_Time is set, THE Control_Panel SHALL automatically send play command
7. THE Control_Panel SHALL store the auto-load state in LocalStorage with key "autoLoad"
8. WHEN auto-load is disabled, THE Control_Panel SHALL stop polling the Replay_Folder
9. WHEN polling encounters an error, THE Control_Panel SHALL log the error and continue polling

### Requirement 6: BroadcastChannel Communication

**User Story:** As a system component, I want reliable communication between Control_Panel and Screen_Mode, so that commands and status updates are synchronized in real-time.

#### Acceptance Criteria

1. THE Instant_Replay_System SHALL use BroadcastChannel with name "scoreboard_replay_v1"
2. WHEN the Control_Panel sends a message, THE Screen_Mode SHALL receive it within 100 milliseconds
3. THE Control_Panel SHALL send messages with type "file" containing ArrayBuffer, MIME type, and filename
4. THE Control_Panel SHALL send messages with type "cmd" containing action and optional value
5. THE Screen_Mode SHALL send messages with type "status" containing duration, currentTime, markerA, and markerB
6. WHEN Screen_Mode video metadata loads, THE Screen_Mode SHALL send status message with duration
7. WHEN Screen_Mode video time updates, THE Screen_Mode SHALL send status message with currentTime
8. WHEN a component unmounts, THE Instant_Replay_System SHALL close the BroadcastChannel connection
9. WHEN a message send fails, THE Instant_Replay_System SHALL handle the error silently without crashing

### Requirement 7: Video Loop Playback

**User Story:** As a stream operator, I want replay clips to loop continuously within the trimmed section, so that viewers can see the action multiple times while the replay is displayed.

#### Acceptance Criteria

1. WHEN markerA and markerB are set, THE Screen_Mode SHALL loop playback between these markers
2. WHEN currentTime exceeds markerB, THE Screen_Mode SHALL seek to markerA
3. WHEN currentTime is less than markerA minus 0.1 seconds, THE Screen_Mode SHALL seek to markerA
4. WHEN the video element fires timeupdate event, THE Screen_Mode SHALL check loop boundaries
5. THE Screen_Mode SHALL continue looping until markers are cleared or a new file is loaded
6. WHEN a new file is loaded, THE Screen_Mode SHALL clear markerA and markerB
7. WHEN markerA is null or markerB is null, THE Screen_Mode SHALL play the video without looping

### Requirement 8: UI Display and File Information

**User Story:** As a stream operator, I want to see clear information about loaded files and current settings, so that I can verify the system state at a glance.

#### Acceptance Criteria

1. WHEN a file is loaded, THE Control_Panel SHALL display the filename
2. WHEN a file is loaded, THE Control_Panel SHALL display the file size formatted as KB or MB
3. WHEN a file is loaded, THE Control_Panel SHALL display the last modified timestamp formatted in Thai locale
4. WHEN a Replay_Folder is selected, THE Control_Panel SHALL display the folder name
5. WHEN Auto_Trim is enabled, THE Control_Panel SHALL display "Playing from [START] to [END]"
6. THE Control_Panel SHALL display the current Replay_Duration value in seconds
7. THE Control_Panel SHALL display a timeline with a visual marker showing Trim_Start_Time
8. WHEN the range slider moves, THE Control_Panel SHALL update the displayed Replay_Duration value immediately
9. WHEN no file is loaded, THE Screen_Mode SHALL display "WAITING FOR REPLAY FEED"

### Requirement 9: LocalStorage Persistence

**User Story:** As a stream operator, I want my settings to persist across browser sessions, so that I don't need to reconfigure the system for each stream.

#### Acceptance Criteria

1. WHEN Replay_Duration changes, THE Control_Panel SHALL save it to LocalStorage
2. WHEN Auto_Trim state changes, THE Control_Panel SHALL save it to LocalStorage
3. WHEN auto-load state changes, THE Control_Panel SHALL save it to LocalStorage
4. WHEN a Replay_Folder is selected, THE Control_Panel SHALL save the folder name to LocalStorage
5. WHEN the Control_Panel loads, THE Control_Panel SHALL restore Replay_Duration from LocalStorage with default value 8
6. WHEN the Control_Panel loads, THE Control_Panel SHALL restore Auto_Trim state from LocalStorage with default value true
7. WHEN the Control_Panel loads, THE Control_Panel SHALL restore auto-load state from LocalStorage with default value false
8. WHEN the Control_Panel loads, THE Control_Panel SHALL restore folder name from LocalStorage if available
9. WHEN LocalStorage read fails, THE Control_Panel SHALL use default values without crashing

### Requirement 10: Screen Mode Display

**User Story:** As a viewer, I want the replay video to display correctly in OBS Browser Source, so that the broadcast shows high-quality replay footage.

#### Acceptance Criteria

1. THE Screen_Mode SHALL render at /replay/screen route
2. THE Screen_Mode SHALL display a video element with muted and playsInline attributes
3. WHEN no video is loaded, THE Screen_Mode SHALL display "WAITING FOR REPLAY FEED" centered on screen
4. WHEN a video is loaded, THE Screen_Mode SHALL hide the waiting message
5. THE Screen_Mode SHALL set video playback rate to 1x when loading a new file
6. THE Screen_Mode SHALL automatically play the video when a file loads
7. WHEN play command is received via BroadcastChannel, THE Screen_Mode SHALL call video.play()
8. WHEN pause command is received via BroadcastChannel, THE Screen_Mode SHALL call video.pause()
9. WHEN the video element is unmounted, THE Screen_Mode SHALL revoke the Blob URL to free memory

### Requirement 11: Control Panel Routes and Authentication

**User Story:** As a system administrator, I want the control panel protected by authentication, so that only authorized operators can trigger replays.

#### Acceptance Criteria

1. THE Instant_Replay_System SHALL register route /replay for the Control_Panel
2. THE Instant_Replay_System SHALL register route /replay/screen for Screen_Mode
3. THE Control_Panel route SHALL be wrapped with AuthGuard component
4. THE Screen_Mode route SHALL be publicly accessible without authentication
5. WHEN an unauthenticated user accesses /replay, THE Instant_Replay_System SHALL redirect to authentication
6. WHEN an authenticated user accesses /replay, THE Instant_Replay_System SHALL render the Control_Panel
7. WHEN any user accesses /replay/screen, THE Instant_Replay_System SHALL render Screen_Mode

### Requirement 12: Auto-Load Workflow Integration

**User Story:** As a stream operator, I want the auto-load workflow to handle all steps automatically, so that I can focus on broadcasting without manual video management.

#### Acceptance Criteria

1. WHEN a new file is detected via watch folder, THE Control_Panel SHALL load the file as ArrayBuffer
2. WHEN the ArrayBuffer is ready, THE Control_Panel SHALL send it via BroadcastChannel
3. WHEN Screen_Mode loads the video metadata, THE Screen_Mode SHALL send duration back to Control_Panel
4. WHEN duration is received and Auto_Trim is enabled, THE Control_Panel SHALL calculate Trim_Start_Time
5. WHEN Trim_Start_Time is calculated, THE Control_Panel SHALL send setA command with value Trim_Start_Time
6. WHEN Trim_Start_Time is calculated, THE Control_Panel SHALL send setB command with value equal to duration
7. WHEN markers are set, THE Control_Panel SHALL send seek command with value Trim_Start_Time
8. WHEN seek completes, THE Control_Panel SHALL send play command
9. THE Screen_Mode SHALL begin looped playback between markerA and markerB
10. WHEN Auto_Trim is disabled, THE Control_Panel SHALL skip marker commands and play the full video

