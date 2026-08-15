# React Scoreboard

⚽ Football Scoreboard Controller with OBS Integration

## 🚀 Features

- Real-time scoreboard control
- OBS WebSocket integration
- Instant replay management
- Team logos & colors management
- Firebase database sync
- Excel data import
- Multi-user support
- Goal animation overlay for OBS

## 🎯 Goal Animation Overlay

The controller broadcasts a `GoalScored` event whenever the score is increased
from the manual score buttons or the OBS score hotkeys. OBS receives the event
through the transparent `Goal_Alert` Browser Source.

For a manual OBS setup, add a Browser Source with this URL:

```text
http://localhost:5173/React_Scoreboard/goal-animation
```

Use a 1920x1080 transparent source and keep it loaded while the broadcast is
running. The Quick Setup configuration creates this source automatically with
the correct URL and visibility settings.

## 📁 Video Folder Setup

### First Time Setup

1. Click the **"Video: คลิกเพื่อเลือกโฟลเดอร์"** button in the header
2. Select your video folder (e.g., your OBS replay buffer folder)
3. The system will remember your choice automatically

### Changing Video Folder

- Click the **Video** status button to select a different folder
- Click the **✕** button next to it to reset and choose a new folder
- Or go to **Settings** → **Logo Upload & Path Settings** → Edit "Path โฟลเดอร์วิดีโอ"

### Multi-User Support

Each user can select their own video folder path:
- Path is saved in browser localStorage (per device)
- No hardcoded paths - works on any system
- Folder access is remembered using File System Access API

### Path Information

The "Path" field in settings is for reference only. The actual folder is stored securely using:
- **File System Access API** (modern browsers)
- **IndexedDB** for persistent storage
- Automatically requests permission when needed

## 🎬 Video Folder Tips

- ✅ Choose a folder with video files (.mp4, .mov, .mkv, etc.)
- ✅ The system will auto-scan and sort videos by date (newest first)
- ✅ Use OBS Replay Buffer folder for seamless integration
- ✅ Click "Rescan" to refresh the video list after new recordings
- ⚠️ Browser needs permission to access the folder - grant when prompted

## 🛠️ Development

```bash
npm install
npm run dev
```

## 📝 Configuration

- **Logo Folder**: Set in Settings → Logo Upload & Path Settings
- **Video Folder**: Click Video button or set path in Settings
- **OBS WebSocket**: Configure in OBS Tools → WebSocket Server Settings
- **Firebase**: Add your config to `.env` file

## 🌐 Multi-User Deployment

When deploying for multiple users:
1. Each user sets their own video folder path (no shared config needed)
2. Logos can be uploaded to Cloudinary/Firebase (cloud URLs work for everyone)
3. Excel data can be loaded from URLs (shared access)
4. Firebase database syncs data across users

## 🔒 Security

- Video folder access is browser-managed (secure)
- No file paths exposed in network requests
- Firebase Auth for user authentication
- Admin whitelist for privileged operations

## 🎁 7-Day Free Trial

- Gmail users who are not in the whitelist receive one 7-day trial.
- Trial start time is stored in Firebase Realtime Database and is not stored in `localStorage`.
- Super Admin and whitelisted users keep permanent access.
- After the trial expires, the user must be approved from the Admin Whitelist page.
- Before production use, publish the rules from `database.rules.json` in the Firebase Realtime Database Rules tab. Do not use public `.read`/`.write` rules because users could reset their own trial.
