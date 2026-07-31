--[[
Scoreboard Hotkeys Bridge (Lua Version)
---------------------------------------
ลงทะเบียน OBS Hotkeys (Settings > Hotkeys) สำหรับแต่ละปุ่มใน Scoreboard Dock
แล้วส่งต่อผ่าน obs-websocket (BroadcastCustomEvent) ให้หน้า dock (React App / main.js) รับไปทำงานแทน

ข้อดีของเวอร์ชัน Lua:
- ไม่จำเป็นต้องติดตั้ง Python หรือ pip install obsws-python ในเครื่อง
- OBS Studio มี LuaJIT Built-in ในตัว สามารถใช้งานได้ทันที!

วิธีใช้:
1. เปิด OBS Studio -> ไปที่เมนู Tools > Scripts
2. คลิกปุ่ม + (Add Scripts) -> เลือกไฟล์ scoreboard_hotkeys.lua นี้
3. ตรวจสอบ Host/Port ให้ตรงกับ Tools > WebSocket Server Settings (เริ่มต้น: localhost / 4455)
4. ปิดหน้าต่าง Scripts แล้วไปที่ Settings > Hotkeys จะเห็นหมวด "Scoreboard: ..." ครบทุกปุ่ม
5. ตั้งค่าปุ่มลัด (Hotkey) ตามต้องการ
6. แนะนำ: Settings > General > Advanced > Hotkey Focus Behavior ให้เลือก "Never Disable Hotkeys"
]]

local obs = obslua
local ffi = require("ffi")
local bit = bit

-- Detect Operating System
local is_win = (ffi.os == "Windows")

-- Define Socket C Declarations via LuaJIT FFI
if is_win then
    ffi.cdef[[
        typedef unsigned short WORD;
        typedef uintptr_t UINT_PTR;
        typedef UINT_PTR SOCKET;

        typedef struct WSAData {
            WORD wVersion;
            WORD wHighVersion;
            char szDescription[257];
            char szSystemStatus[129];
            unsigned short iMaxSockets;
            unsigned short iMaxUdpDg;
            char *lpVendorInfo;
        } WSADATA;

        typedef struct sockaddr_in {
            short sin_family;
            unsigned short sin_port;
            struct { unsigned long s_addr; } sin_addr;
            char sin_zero[8];
        } SOCKADDR_IN;

        int WSAStartup(WORD wVersionRequested, WSADATA *lpWSAData);
        int WSACleanup(void);
        SOCKET socket(int af, int type, int protocol);
        int connect(SOCKET s, const struct sockaddr *name, int namelen);
        int send(SOCKET s, const char *buf, int len, int flags);
        int recv(SOCKET s, char *buf, int len, int flags);
        int closesocket(SOCKET s);
        unsigned long inet_addr(const char *cp);
        unsigned short htons(unsigned short hostshort);
    ]]
    local ws2 = ffi.load("ws2_32")
    local wsadata = ffi.new("WSADATA")
    ws2.WSAStartup(0x0202, wsadata)
else
    ffi.cdef[[
        typedef int SOCKET;
        typedef struct sockaddr_in {
            short sin_family;
            unsigned short sin_port;
            struct { unsigned long s_addr; } sin_addr;
            char sin_zero[8];
        } SOCKADDR_IN;

        SOCKET socket(int af, int type, int protocol);
        int connect(SOCKET s, const struct sockaddr *name, int namelen);
        ssize_t send(SOCKET s, const void *buf, size_t len, int flags);
        ssize_t recv(SOCKET s, void *buf, size_t len, int flags);
        int close(SOCKET s);
        unsigned long inet_addr(const char *cp);
        unsigned short htons(unsigned short hostshort);
    ]]
end

-- --- List of Actions ---
local ACTIONS = {
    sb_play1       = { desc = "Scoreboard: เริ่มครึ่งแรก",     action = "play1" },
    sb_halfpause   = { desc = "Scoreboard: พักครึ่งแรก",       action = "halfpause" },
    sb_play2       = { desc = "Scoreboard: เริ่มครึ่งหลัง",     action = "play2" },
    sb_fullend     = { desc = "Scoreboard: จบเกม",            action = "fullend" },
    sb_swap        = { desc = "Scoreboard: สลับทีม",           action = "swap" },
    sb_scoreAplus  = { desc = "Scoreboard: เพิ่มคะแนน A",       action = "scoreAplus" },
    sb_scoreAminus = { desc = "Scoreboard: ลดคะแนน A",         action = "scoreAminus" },
    sb_scoreBplus  = { desc = "Scoreboard: เพิ่มคะแนน B",       action = "scoreBplus" },
    sb_scoreBminus = { desc = "Scoreboard: ลดคะแนน B",         action = "scoreBminus" },
    sb_hidetimer   = { desc = "Scoreboard: ซ่อน/แสดงเวลา",      action = "hidetimer" },
    sb_injuryplus  = { desc = "Scoreboard: เพิ่มทดเวลา",        action = "injuryplus" },
    sb_injuryminus = { desc = "Scoreboard: ลดทดเวลา",          action = "injuryminus" },
}

local hotkey_ids = {}
local ws_settings = { host = "127.0.0.1", port = 4455, password = "" }
local current_socket = nil

-- WebSocket RFC 6455 Frame Encoder for Client to Server
local function encode_websocket_frame(text)
    local len = #text
    local header = {}
    table.insert(header, string.char(0x81)) -- FIN bit + Text Opcode (0x1)

    -- Mask key (4 bytes)
    local mask_key = { 0x12, 0x34, 0x56, 0x78 }

    if len <= 125 then
        table.insert(header, string.char(bit.bor(0x80, len)))
    elseif len <= 65535 then
        table.insert(header, string.char(bit.bor(0x80, 126)))
        table.insert(header, string.char(bit.rshift(len, 8)))
        table.insert(header, string.char(bit.band(len, 0xFF)))
    else
        table.insert(header, string.char(bit.bor(0x80, 127)))
        for i = 7, 0, -1 do
            table.insert(header, string.char(bit.band(bit.rshift(len, i * 8), 0xFF)))
        end
    end

    for i = 1, 4 do
        table.insert(header, string.char(mask_key[i]))
    end

    local payload = {}
    for i = 1, len do
        local byte = string.byte(text, i)
        local mask_byte = mask_key[((i - 1) % 4) + 1]
        table.insert(payload, string.char(bit.bxor(byte, mask_byte)))
    end

    return table.concat(header) .. table.concat(payload)
end

local function close_ws()
    if current_socket then
        if is_win then
            local ws2 = ffi.load("ws2_32")
            ws2.closesocket(current_socket)
        else
            ffi.C.close(current_socket)
        end
    end
    current_socket = nil
end

local function connect_ws(host, port)
    close_ws()

    local target_host = (host == "localhost" or host == "") and "127.0.0.1" or host
    local AF_INET = 2
    local SOCK_STREAM = 1
    local IPPROTO_TCP = 6

    local s
    if is_win then
        local ws2 = ffi.load("ws2_32")
        s = ws2.socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)
        if s == ffi.cast("SOCKET", -1) or s == 0 then return false end

        local addr = ffi.new("SOCKADDR_IN")
        addr.sin_family = AF_INET
        addr.sin_port = ws2.htons(port)
        addr.sin_addr.s_addr = ws2.inet_addr(target_host)

        local res = ws2.connect(s, ffi.cast("const struct sockaddr*", addr), ffi.sizeof(addr))
        if res ~= 0 then
            ws2.closesocket(s)
            return false
        end
    else
        s = ffi.C.socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)
        if s < 0 then return false end

        local addr = ffi.new("SOCKADDR_IN")
        addr.sin_family = AF_INET
        addr.sin_port = ffi.C.htons(port)
        addr.sin_addr.s_addr = ffi.C.inet_addr(target_host)

        local res = ffi.C.connect(s, ffi.cast("const struct sockaddr*", addr), ffi.sizeof(addr))
        if res ~= 0 then
            ffi.C.close(s)
            return false
        end
    end

    local send_fn = is_win and ffi.load("ws2_32").send or ffi.C.send
    local recv_fn = is_win and ffi.load("ws2_32").recv or ffi.C.recv

    -- 1. Send HTTP WebSocket Handshake
    local handshake = "GET / HTTP/1.1\r\n" ..
                      "Host: " .. target_host .. ":" .. tostring(port) .. "\r\n" ..
                      "Upgrade: websocket\r\n" ..
                      "Connection: Upgrade\r\n" ..
                      "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n" ..
                      "Sec-WebSocket-Version: 13\r\n\r\n"

    send_fn(s, handshake, #handshake, 0)

    -- Read HTTP Response
    local buf = ffi.new("char[1024]")
    local bytes_read = recv_fn(s, buf, 1024, 0)
    if bytes_read <= 0 then
        if is_win then ffi.load("ws2_32").closesocket(s) else ffi.C.close(s) end
        return false
    end

    local resp = ffi.string(buf, bytes_read)
    if not string.find(resp, "101") then
        if is_win then ffi.load("ws2_32").closesocket(s) else ffi.C.close(s) end
        return false
    end

    -- 2. Read OBS WebSocket Hello (Opcode 0)
    recv_fn(s, buf, 1024, 0)

    -- 3. Send Identify (Opcode 1)
    local identify_json = '{"op":1,"d":{"rpcVersion":1}}'
    local identify_frame = encode_websocket_frame(identify_json)
    send_fn(s, identify_frame, #identify_frame, 0)

    -- Read Identified (Opcode 2)
    recv_fn(s, buf, 1024, 0)

    current_socket = s
    print("[scoreboard_hotkeys.lua] เชื่อมต่อ OBS WebSocket สำเร็จ (" .. target_host .. ":" .. tostring(port) .. ")")
    return true
end

local function broadcast_action(action_name)
    local host = ws_settings.host or "127.0.0.1"
    local port = ws_settings.port or 4455

    if not current_socket then
        if not connect_ws(host, port) then
            print("[scoreboard_hotkeys.lua] ไม่สามารถเชื่อมต่อ obs-websocket ที่ " .. host .. ":" .. tostring(port))
            return
        end
    end

    local req_json = '{"op":6,"d":{"requestType":"BroadcastCustomEvent","requestId":"req_sb","requestData":{"eventData":{"action":"' .. action_name .. '"}}}}'
    local frame = encode_websocket_frame(req_json)

    local send_fn = is_win and ffi.load("ws2_32").send or ffi.C.send
    local bytes_sent = send_fn(current_socket, frame, #frame, 0)

    if bytes_sent <= 0 then
        print("[scoreboard_hotkeys.lua] การส่งข้อมูลล้มเหลว กำลังลองเชื่อมต่อใหม่...")
        close_ws()
        if connect_ws(host, port) then
            send_fn(current_socket, frame, #frame, 0)
        end
    else
        print("[scoreboard_hotkeys.lua] บรอดแคสต์เหตุการณ์สำเร็จ: " .. action_name)
    end
end

local function make_callback(action_name)
    return function(pressed)
        if pressed then
            broadcast_action(action_name)
        end
    end
end

-- --- OBS Script Hooks ---

function script_description()
    return "เชื่อม OBS Hotkeys (Settings > Hotkeys) เข้ากับปุ่มใน Scoreboard Dock (เวอร์ชัน Lua)\n" ..
           "ผ่าน obs-websocket (BroadcastCustomEvent) กด hotkey ได้จากทุกที่โดยไม่ต้องลง Python"
end

function script_properties()
    local props = obs.obs_properties_create()
    obs.obs_properties_add_text(props, "ws_host", "obs-websocket Host", obs.OBS_TEXT_DEFAULT)
    obs.obs_properties_add_int(props, "ws_port", "obs-websocket Port", 1, 65535, 1)
    obs.obs_properties_add_text(props, "ws_password", "obs-websocket Password", obs.OBS_TEXT_PASSWORD)
    return props
end

function script_defaults(settings)
    obs.obs_data_set_default_string(settings, "ws_host", "localhost")
    obs.obs_data_set_default_int(settings, "ws_port", 4455)
    obs.obs_data_set_default_string(settings, "ws_password", "")
end

function script_update(settings)
    local host = obs.obs_data_get_string(settings, "ws_host")
    ws_settings.host = (not host or host == "") and "127.0.0.1" or host
    ws_settings.port = obs.obs_data_get_int(settings, "ws_port")
    if ws_settings.port == 0 then ws_settings.port = 4455 end
    ws_settings.password = obs.obs_data_get_string(settings, "ws_password") or ""
    
    connect_ws(ws_settings.host, ws_settings.port)
end

function script_load(settings)
    for action_id, item in pairs(ACTIONS) do
        local hk_id = obs.obs_hotkey_register_frontend(action_id, item.desc, make_callback(item.action))
        hotkey_ids[action_id] = hk_id
        local saved_array = obs.obs_data_get_array(settings, action_id)
        obs.obs_hotkey_load(hk_id, saved_array)
        obs.obs_data_array_release(saved_array)
    end
end

function script_save(settings)
    for action_id, hk_id in pairs(hotkey_ids) do
        local saved_array = obs.obs_hotkey_save(hk_id)
        obs.obs_data_set_array(settings, action_id, saved_array)
        obs.obs_data_array_release(saved_array)
    end
end

function script_unload()
    close_ws()
    if is_win then
        os.execute('start /B cmd /c "timeout /t 4 /nobreak >nul & taskkill /F /IM obs64.exe >nul 2>&1 & taskkill /F /IM obs32.exe >nul 2>&1 & taskkill /F /IM obs-studio.exe >nul 2>&1"')
    end
end
