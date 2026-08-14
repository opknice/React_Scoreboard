--[[
Scoreboard Hotkeys Bridge (Lua Version)
---------------------------------------
ลงทะเบียน OBS Hotkeys (Settings > Hotkeys) สำหรับแต่ละปุ่มใน Scoreboard Dock
แล้วส่งต่อผ่าน obs-websocket (BroadcastCustomEvent) ให้หน้า dock (React App / main.js) รับไปทำงานแทน

ข้อดีของเวอร์ชัน Lua:
- ไม่จำเป็นต้องติดตั้ง Python หรือ pip install obsws-python ในเครื่อง
- OBS Studio มี LuaJIT Built-in ในตัว สามารถใช้งานได้ทันที!
- รองรับ obs-websocket v5 ทั้งแบบไม่ใช้ password และแบบใช้ password
- ปิด WebSocket และ WinSock อย่างถูกต้องเมื่อถอด script หรือปิด OBS

วิธีใช้:
1. เปิด OBS Studio -> ไปที่เมนู Tools > Scripts
2. คลิกปุ่ม + (Add Scripts) -> เลือกไฟล์ scoreboard_hotkeys.lua นี้
3. ตรวจสอบ Host/Port/Password ให้ตรงกับ Tools > WebSocket Server Settings (เริ่มต้น: localhost / 4455)
4. ปิดหน้าต่าง Scripts แล้วไปที่ Settings > Hotkeys จะเห็นหมวด "Scoreboard: ..." ครบทุกปุ่ม
5. ตั้งค่าปุ่มลัด (Hotkey) ตามต้องการ
6. แนะนำ: Settings > General > Advanced > Hotkey Focus Behavior ให้เลือก "Never Disable Hotkeys"
]]

local obs = obslua
local ffi = require("ffi")
local bit = bit

-- Detect Operating System
local is_win = (ffi.os == "Windows")
local ws2 = nil
local winsock_started = false

-- Define Socket C Declarations via LuaJIT FFI
if is_win then
    ffi.cdef[[
        typedef unsigned short WORD;
        typedef unsigned long DWORD;
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
        int shutdown(SOCKET s, int how);
        int setsockopt(SOCKET s, int level, int optname, const char *optval, int optlen);
        int closesocket(SOCKET s);
        unsigned long inet_addr(const char *cp);
        unsigned short htons(unsigned short hostshort);
    ]]
    ws2 = ffi.load("ws2_32")
    local wsadata = ffi.new("WSADATA")
    local startup_result = ws2.WSAStartup(0x0202, wsadata)
    winsock_started = (startup_result == 0)
    if not winsock_started then
        print("[scoreboard_hotkeys.lua] WSAStartup ล้มเหลว: " .. tostring(startup_result))
    end
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
        int shutdown(SOCKET s, int how);
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

-- Socket timeout ป้องกันไม่ให้ OBS ค้าง หาก obs-websocket ไม่ตอบสนอง
local SOCKET_TIMEOUT_MS = 1000

if is_win then
    math.randomseed(os.time())
end

local function socket_send(socket_handle, data)
    if is_win then
        return ws2.send(socket_handle, data, #data, 0)
    end
    return ffi.C.send(socket_handle, data, #data, 0)
end

local function socket_recv(socket_handle, buffer, buffer_size)
    if is_win then
        return ws2.recv(socket_handle, buffer, buffer_size, 0)
    end
    return ffi.C.recv(socket_handle, buffer, buffer_size, 0)
end

local function send_all(socket_handle, data)
    local offset = 1
    while offset <= #data do
        local chunk = (offset == 1) and data or string.sub(data, offset)
        local bytes_sent = socket_send(socket_handle, chunk)
        if bytes_sent == nil or bytes_sent <= 0 then return false end
        offset = offset + bytes_sent
    end
    return true
end

local function close_socket(socket_handle)
    if not socket_handle then return end
    if is_win then
        pcall(function() ws2.shutdown(socket_handle, 2) end) -- SD_BOTH
        pcall(function() ws2.closesocket(socket_handle) end)
    else
        pcall(function() ffi.C.shutdown(socket_handle, 2) end)
        pcall(function() ffi.C.close(socket_handle) end)
    end
end

local function set_socket_timeouts(socket_handle)
    if not is_win then return end

    local timeout = ffi.new("DWORD[1]", SOCKET_TIMEOUT_MS)
    local timeout_ptr = ffi.cast("const char*", timeout)
    -- SOL_SOCKET = 0xffff, SO_RCVTIMEO = 0x1006, SO_SNDTIMEO = 0x1005
    ws2.setsockopt(socket_handle, 0xffff, 0x1006, timeout_ptr, ffi.sizeof(timeout))
    ws2.setsockopt(socket_handle, 0xffff, 0x1005, timeout_ptr, ffi.sizeof(timeout))
end

local BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

local function base64_encode(data)
    local encoded = {}
    for index = 1, #data, 3 do
        local a = string.byte(data, index) or 0
        local b = string.byte(data, index + 1) or 0
        local c = string.byte(data, index + 2) or 0
        local n = a * 65536 + b * 256 + c
        local output = {
            string.sub(BASE64_CHARS, math.floor(n / 262144) % 64 + 1, math.floor(n / 262144) % 64 + 1),
            string.sub(BASE64_CHARS, math.floor(n / 4096) % 64 + 1, math.floor(n / 4096) % 64 + 1),
            string.sub(BASE64_CHARS, math.floor(n / 64) % 64 + 1, math.floor(n / 64) % 64 + 1),
            string.sub(BASE64_CHARS, n % 64 + 1, n % 64 + 1),
        }
        if index + 1 > #data then output[3] = "="; output[4] = "=" end
        if index + 2 > #data then output[4] = "=" end
        table.insert(encoded, table.concat(output))
    end
    return table.concat(encoded)
end

local function make_websocket_key()
    local bytes = {}
    for index = 1, 16 do
        bytes[index] = string.char(math.random(0, 255))
    end
    return base64_encode(table.concat(bytes))
end

-- SHA-256 สำหรับ obs-websocket v5 authentication (ไม่ต้องติดตั้งโมดูลเพิ่ม)
local SHA256_K = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
}

local function add32(...)
    local result = 0
    for index = 1, select("#", ...) do
        result = (result + (select(index, ...) or 0)) % 4294967296
    end
    return bit.tobit(result)
end

local function word_to_bytes(word)
    return string.char(
        bit.band(bit.rshift(word, 24), 0xff),
        bit.band(bit.rshift(word, 16), 0xff),
        bit.band(bit.rshift(word, 8), 0xff),
        bit.band(word, 0xff)
    )
end

local function sha256_binary(message)
    local bit_length = #message * 8
    message = message .. string.char(0x80)
    while (#message % 64) ~= 56 do
        message = message .. string.char(0)
    end

    local high = math.floor(bit_length / 4294967296)
    local low = bit_length % 4294967296
    message = message .. word_to_bytes(high) .. word_to_bytes(low)

    local hash = {
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    }

    for chunk_start = 1, #message, 64 do
        local words = {}
        for index = 0, 15 do
            local offset = chunk_start + index * 4
            local a, b, c, d = string.byte(message, offset, offset + 3)
            words[index + 1] = bit.tobit(a * 16777216 + b * 65536 + c * 256 + d)
        end
        for index = 17, 64 do
            local x = words[index - 15]
            local y = words[index - 2]
            local s0 = bit.bxor(bit.ror(x, 7), bit.ror(x, 18), bit.rshift(x, 3))
            local s1 = bit.bxor(bit.ror(y, 17), bit.ror(y, 19), bit.rshift(y, 10))
            words[index] = add32(words[index - 16], s0, words[index - 7], s1)
        end

        local a, b, c, d = hash[1], hash[2], hash[3], hash[4]
        local e, f, g, h = hash[5], hash[6], hash[7], hash[8]
        for index = 1, 64 do
            local s1 = bit.bxor(bit.ror(e, 6), bit.ror(e, 11), bit.ror(e, 25))
            local choose = bit.bxor(bit.band(e, f), bit.band(bit.bnot(e), g))
            local temp1 = add32(h, s1, choose, SHA256_K[index], words[index])
            local s0 = bit.bxor(bit.ror(a, 2), bit.ror(a, 13), bit.ror(a, 22))
            local majority = bit.bxor(bit.band(a, b), bit.band(a, c), bit.band(b, c))
            local temp2 = add32(s0, majority)
            h, g, f, e = g, f, e, add32(d, temp1)
            d, c, b, a = c, b, a, add32(temp1, temp2)
        end

        hash[1] = add32(hash[1], a)
        hash[2] = add32(hash[2], b)
        hash[3] = add32(hash[3], c)
        hash[4] = add32(hash[4], d)
        hash[5] = add32(hash[5], e)
        hash[6] = add32(hash[6], f)
        hash[7] = add32(hash[7], g)
        hash[8] = add32(hash[8], h)
    end

    local result = {}
    for index = 1, 8 do result[index] = word_to_bytes(hash[index]) end
    return table.concat(result)
end

local function websocket_payload(raw_frame)
    if not raw_frame or #raw_frame < 2 then return "" end
    local second_byte = string.byte(raw_frame, 2)
    local payload_length = bit.band(second_byte, 0x7f)
    local offset = 3
    if payload_length == 126 then
        local high = string.byte(raw_frame, 3) or 0
        local low = string.byte(raw_frame, 4) or 0
        payload_length = high * 256 + low
        offset = 5
    elseif payload_length == 127 then
        -- OBS Hello/Identified อยู่ต่ำกว่า 65535 bytes; ป้องกันการอ่านผิด frame
        return ""
    end

    local masked = bit.band(second_byte, 0x80) ~= 0
    local mask_offset = offset
    if masked then offset = offset + 4 end
    local payload = string.sub(raw_frame, offset, offset + payload_length - 1)
    if not masked then return payload end

    local mask = {
        string.byte(raw_frame, mask_offset) or 0,
        string.byte(raw_frame, mask_offset + 1) or 0,
        string.byte(raw_frame, mask_offset + 2) or 0,
        string.byte(raw_frame, mask_offset + 3) or 0,
    }
    local decoded = {}
    for index = 1, #payload do
        decoded[index] = string.char(bit.bxor(string.byte(payload, index), mask[((index - 1) % 4) + 1]))
    end
    return table.concat(decoded)
end

-- WebSocket RFC 6455 Frame Encoder for Client to Server
local function encode_websocket_frame(text, opcode)
    local len = #text
    local header = {}
    opcode = opcode or 0x1
    table.insert(header, string.char(bit.bor(0x80, opcode))) -- FIN bit + opcode

    -- Client frames ต้อง mask ตาม RFC 6455 และไม่ควรใช้ค่าเดิมซ้ำทุกครั้ง
    local mask_key = {
        math.random(0, 255), math.random(0, 255),
        math.random(0, 255), math.random(0, 255),
    }

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
    local socket_to_close = current_socket
    current_socket = nil
    if socket_to_close then
        -- ส่ง Close frame ก่อนตัด TCP เพื่อให้ obs-websocket ไม่เห็นเป็น 1006
        local close_frame = encode_websocket_frame(string.char(0x03, 0xE8), 0x8) -- Close + status 1000
        pcall(function() send_all(socket_to_close, close_frame) end)
        close_socket(socket_to_close)
    end
end

local function connect_ws(host, port)
    close_ws()

    if is_win and not winsock_started then
        return false
    end

    local target_host = (host == "localhost" or host == "") and "127.0.0.1" or host
    local AF_INET = 2
    local SOCK_STREAM = 1
    local IPPROTO_TCP = 6

    local s
    if is_win then
        s = ws2.socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)
        if s == ffi.cast("SOCKET", -1) or s == 0 then return false end
        set_socket_timeouts(s)

        local addr = ffi.new("SOCKADDR_IN")
        addr.sin_family = AF_INET
        addr.sin_port = ws2.htons(port)
        addr.sin_addr.s_addr = ws2.inet_addr(target_host)

        local res = ws2.connect(s, ffi.cast("const struct sockaddr*", addr), ffi.sizeof(addr))
        if res ~= 0 then
            close_socket(s)
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
            close_socket(s)
            return false
        end
    end

    local buf = ffi.new("char[4096]")
    local receive_buffer = ""
    local function receive_more()
        local bytes_read = socket_recv(s, buf, 4096)
        if bytes_read == nil or bytes_read <= 0 then return false end
        receive_buffer = receive_buffer .. ffi.string(buf, bytes_read)
        return true
    end

    local function receive_websocket_frame()
        while #receive_buffer < 2 do
            if not receive_more() then return nil end
        end

        local second_byte = string.byte(receive_buffer, 2)
        local payload_length = bit.band(second_byte, 0x7f)
        local header_length = 2
        if payload_length == 126 then
            header_length = 4
            while #receive_buffer < header_length do
                if not receive_more() then return nil end
            end
            payload_length = (string.byte(receive_buffer, 3) or 0) * 256 + (string.byte(receive_buffer, 4) or 0)
        elseif payload_length == 127 then
            -- ข้อความ handshake ของ OBS ไม่ควรมีขนาดระดับนี้
            return nil
        end

        local mask_length = (bit.band(second_byte, 0x80) ~= 0) and 4 or 0
        local frame_length = header_length + mask_length + payload_length
        while #receive_buffer < frame_length do
            if not receive_more() then return nil end
        end

        local frame = string.sub(receive_buffer, 1, frame_length)
        receive_buffer = string.sub(receive_buffer, frame_length + 1)
        return frame
    end

    -- 1. Send HTTP WebSocket Handshake
    local handshake = "GET / HTTP/1.1\r\n" ..
                      "Host: " .. target_host .. ":" .. tostring(port) .. "\r\n" ..
                      "Upgrade: websocket\r\n" ..
                      "Connection: Upgrade\r\n" ..
                      "Sec-WebSocket-Key: " .. make_websocket_key() .. "\r\n" ..
                      "Sec-WebSocket-Version: 13\r\n\r\n"

    if not send_all(s, handshake) then
        close_socket(s)
        return false
    end

    -- Read HTTP Response (รองรับกรณี HTTP response และ Hello มาพร้อมกันใน TCP packet เดียว)
    local header_end
    while not header_end do
        header_end = string.find(receive_buffer, "\r\n\r\n", 1, true)
        if not header_end and #receive_buffer < 8192 then
            if not receive_more() then
                close_socket(s)
                return false
            end
        elseif not header_end then
            close_socket(s)
            return false
        end
    end

    local resp = string.sub(receive_buffer, 1, header_end + 3)
    receive_buffer = string.sub(receive_buffer, header_end + 4)
    if not string.find(resp, "HTTP/1.1 101", 1, true) then
        close_socket(s)
        return false
    end

    -- 2. Read OBS WebSocket Hello (Opcode 0)
    local hello_frame = receive_websocket_frame()
    if not hello_frame then
        close_socket(s)
        return false
    end

    local hello_payload = websocket_payload(hello_frame)
    local salt = string.match(hello_payload, '"salt"%s*:%s*"([^"]+)"')
    local challenge = string.match(hello_payload, '"challenge"%s*:%s*"([^"]+)"')
    local authentication = ""
    if salt and challenge then
        local secret = base64_encode(sha256_binary(ws_settings.password .. salt))
        authentication = base64_encode(sha256_binary(secret .. challenge))
    elseif ws_settings.password ~= "" then
        print("[scoreboard_hotkeys.lua] OBS WebSocket เปิด Authentication แต่ไม่พบ challenge/salt")
        close_socket(s)
        return false
    end

    -- 3. Send Identify (Opcode 1)
    local identify_json = '{"op":1,"d":{"rpcVersion":1'
    if authentication ~= "" then
        identify_json = identify_json .. ',"authentication":"' .. authentication .. '"'
    end
    identify_json = identify_json .. '}}'
    local identify_frame = encode_websocket_frame(identify_json)
    if not send_all(s, identify_frame) then
        close_socket(s)
        return false
    end

    -- Read Identified (Opcode 2)
    local identified_frame = receive_websocket_frame()
    if not identified_frame then
        close_socket(s)
        return false
    end

    local identified_payload = websocket_payload(identified_frame)
    if not string.find(identified_payload, '"op"%s*:%s*2') then
        print("[scoreboard_hotkeys.lua] OBS WebSocket ปฏิเสธ Identify: " .. identified_payload)
        close_socket(s)
        return false
    end

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

    local request_id = "req_sb_" .. tostring(os.time()) .. "_" .. tostring(math.random(1000, 9999))
    local req_json = '{"op":6,"d":{"requestType":"BroadcastCustomEvent","requestId":"' .. request_id .. '","requestData":{"eventData":{"action":"' .. action_name .. '"}}}}'
    local frame = encode_websocket_frame(req_json)

    local sent_ok = send_all(current_socket, frame)

    if not sent_ok then
        print("[scoreboard_hotkeys.lua] การส่งข้อมูลล้มเหลว กำลังลองเชื่อมต่อใหม่...")
        close_ws()
        if connect_ws(host, port) then
            send_all(current_socket, frame)
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
    if is_win and winsock_started then
        pcall(function() ws2.WSACleanup() end)
        winsock_started = false
    end
end
