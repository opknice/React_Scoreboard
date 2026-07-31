# Requirements Document

## Introduction

ระบบ OBS Football Scoreboard ปัจจุบันมีปัญหาการจัดการโลโก้ทีมที่แยกกันระหว่าง Web Browser (React App) และ OBS Studio ทำให้ผู้ใช้ต้องคัดลอกไฟล์โลโก้ไว้ 2 ที่ (Web Browser ใช้ path ที่ hard-coded ใน Vite config: `d:\OBS_football_React\logos\` และ OBS Studio ใช้ path ที่ผู้ใช้กำหนดเอง default: `C:/OBSAssets/logos`) 

Feature นี้จะรวมการจัดการ logo path ให้เป็นที่เดียว โดยให้ Web Browser และ OBS Studio ใช้ absolute path เดียวกันตามที่ผู้ใช้กำหนด ผ่านการสร้าง API endpoint ใน Vite dev server ที่รองรับการส่ง logoFolderPath มาพร้อมกับ request

## Glossary

- **Logo_API**: API endpoint ใน Vite dev server ที่รับ query parameter `logoPath` และ `file` เพื่อส่งไฟล์โลโก้กลับมา
- **Vite_Dev_Server**: Development server ที่รัน React application และให้บริการ API endpoints
- **Logo_Path**: Absolute file system path ที่ชี้ไปยังโฟลเดอร์ที่เก็บไฟล์โลโก้ทีม
- **Frontend_Component**: React components ที่แสดงโลโก้ทีม ได้แก่ ScoreboardController, OverlayContainer, AllScoresStandalone, และ LeagueTableStandalone
- **OBS_Source**: Image source ใน OBS Studio ที่แสดงโลโก้ทีม
- **Overlay_URL**: URL ที่ใช้สำหรับแสดง overlay view ใน OBS Studio browser source

## Requirements

### Requirement 1: Logo API Endpoint

**User Story:** ในฐานะผู้พัฒนาระบบ ฉันต้องการ API endpoint สำหรับดึงไฟล์โลโก้จาก custom path เพื่อให้ทั้ง Web Browser และ OBS Studio ใช้โลโก้จาก path เดียวกันได้

#### Acceptance Criteria

1. WHEN a request is sent to `/api/logo` WITH valid `path` and `file` query parameters, THEN THE Logo_API SHALL return the requested image file with correct MIME type
2. WHEN a request is sent to `/api/logo` WITH `path` parameter containing absolute Windows path (e.g., `C:/OBSAssets/logos`), THEN THE Logo_API SHALL resolve and serve the file from that absolute path
3. WHEN a request is sent to `/api/logo` WITHOUT `path` parameter, THEN THE Logo_API SHALL fallback to serve files from the default `logos/` directory
4. WHEN a request is sent to `/api/logo` WITH `file` parameter containing URL-encoded filename, THEN THE Logo_API SHALL decode and serve the correct file
5. THE Logo_API SHALL support image file extensions: png, jpg, jpeg, gif, webp, svg
6. WHEN the requested file exists, THEN THE Logo_API SHALL set appropriate Content-Type header based on file extension
7. WHEN the requested file exists, THEN THE Logo_API SHALL stream the file content to the response

### Requirement 2: Security Validation

**User Story:** ในฐานะผู้ใช้ระบบ ฉันต้องการให้ระบบป้องกันการเข้าถึงไฟล์ที่ไม่ได้รับอนุญาต เพื่อความปลอดภัยของข้อมูล

#### Acceptance Criteria

1. WHEN a request contains `file` parameter with path traversal patterns (e.g., `../`, `..\\`), THEN THE Logo_API SHALL reject the request
2. WHEN a request contains `file` parameter with absolute path patterns (e.g., `/etc/passwd`, `C:/Windows/`), THEN THE Logo_API SHALL reject the request
3. WHEN a request contains `file` parameter with disallowed file extension, THEN THE Logo_API SHALL reject the request
4. WHEN the requested file does NOT exist at the specified path, THEN THE Logo_API SHALL return appropriate error response
5. WHEN the requested file size exceeds 10MB, THEN THE Logo_API SHALL reject the request
6. WHEN the `path` parameter contains suspicious patterns, THEN THE Logo_API SHALL validate and sanitize the path before file access

### Requirement 3: Frontend Logo Rendering

**User Story:** ในฐานะผู้ใช้ระบบ ฉันต้องการให้ Web Browser แสดงโลโก้จาก path ที่ฉันกำหนดเอง เพื่อไม่ต้องคัดลอกไฟล์ไปยังโฟลเดอร์ `logos/`

#### Acceptance Criteria

1. WHEN rendering team logo in ScoreboardController component, THEN THE Frontend_Component SHALL construct API URL with format `/api/logo?path={logoFolderPath}&file={fileName}`
2. WHEN rendering team logo in OverlayContainer component, THEN THE Frontend_Component SHALL construct API URL with format `/api/logo?path={logoFolderPath}&file={fileName}`
3. WHEN rendering team logo in AllScoresStandalone component, THEN THE Frontend_Component SHALL construct API URL with format `/api/logo?path={logoFolderPath}&file={fileName}`
4. WHEN rendering team logo in LeagueTableStandalone component, THEN THE Frontend_Component SHALL construct API URL with format `/api/logo?path={logoFolderPath}&file={fileName}`
5. WHEN `logoFolderPath` is empty or undefined, THEN THE Frontend_Component SHALL use the old format `logos/{fileName}` as fallback
6. WHEN logo image fails to load, THEN THE Frontend_Component SHALL display the configured default logo
7. THE Frontend_Component SHALL properly URL-encode both `path` and `file` parameters

### Requirement 4: Overlay URL Generation

**User Story:** ในฐานะผู้ใช้ระบบ ฉันต้องการให้ URL ที่สร้างสำหรับ OBS overlay รวม logoPath parameter ไว้ด้วย เพื่อให้ overlay แสดงโลโก้จาก path ที่ฉันกำหนด

#### Acceptance Criteria

1. WHEN generating overlay URL for table view, THEN THE System SHALL include `logoPath` query parameter with the user-configured Logo_Path
2. WHEN generating overlay URL for results view, THEN THE System SHALL include `logoPath` query parameter with the user-configured Logo_Path
3. WHEN generating overlay URL for ticker view, THEN THE System SHALL include `logoPath` query parameter with the user-configured Logo_Path
4. WHEN generating overlay URL for stadium view, THEN THE System SHALL include `logoPath` query parameter with the user-configured Logo_Path
5. THE System SHALL properly URL-encode the `logoPath` parameter value
6. WHEN `logoPath` is not configured, THEN THE System SHALL generate overlay URL without `logoPath` parameter for backward compatibility

### Requirement 5: OBS Integration Compatibility

**User Story:** ในฐานะผู้ใช้ระบบ ฉันต้องการให้การเปลี่ยนแปลงนี้ไม่กระทบกับการทำงานของ OBS WebSocket เพื่อให้ OBS Studio ยังสามารถแสดงโลโก้ได้ตามปกติ

#### Acceptance Criteria

1. WHEN OBS WebSocket calls `setImage` command, THEN THE System SHALL continue to use the `logoFolderPath` from localStorage
2. WHEN OBS WebSocket sets team logo, THEN THE OBS_Source SHALL display the logo from the user-configured Logo_Path
3. WHEN `logoFolderPath` in localStorage changes, THEN THE System SHALL use the new path for subsequent OBS WebSocket image updates
4. THE System SHALL maintain existing OBS WebSocket protocol without modifications

### Requirement 6: Backward Compatibility

**User Story:** ในฐานะผู้ใช้ระบบเดิม ฉันต้องการให้ระบบยังทำงานได้ตามปกติหากฉันไม่ได้กำหนด custom logo path เพื่อไม่ให้กระทบกับการใช้งานเดิม

#### Acceptance Criteria

1. WHEN `logoPath` query parameter is NOT provided to Logo_API, THEN THE Logo_API SHALL serve files from default `logos/` directory
2. WHEN overlay URL does NOT contain `logoPath` parameter, THEN THE Frontend_Component SHALL use default logo path behavior
3. WHEN `logoFolderPath` in localStorage is empty, THEN THE System SHALL fallback to default path `C:/OBSAssets/logos`
4. THE System SHALL continue to support existing overlay URLs without `logoPath` parameter

### Requirement 7: Configuration Persistence

**User Story:** ในฐานะผู้ใช้ระบบ ฉันต้องการให้ระบบจำ logo path ที่ฉันกำหนดไว้ เพื่อไม่ต้องตั้งค่าใหม่ทุกครั้ง

#### Acceptance Criteria

1. WHEN user sets Logo_Path in settings, THEN THE System SHALL save the path to localStorage with key `logoFolderPath`
2. WHEN application loads, THEN THE System SHALL read Logo_Path from localStorage key `logoFolderPath`
3. WHEN Logo_Path is not found in localStorage, THEN THE System SHALL use default value `C:/OBSAssets/logos`
4. THE System SHALL persist Logo_Path across browser sessions
