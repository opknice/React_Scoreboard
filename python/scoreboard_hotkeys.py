"""
Scsoreboard Hotkeys Bridge
-------------------------
ลงทะเบียน OBS Hotkeys (Settings > Hotkeys) สำหรับแต่ละปุ่มใน Scoreboard Dock
แล้วส่งต่อผ่าน obs-websocket (BroadcastCustomEvent) ให้หน้า dock (main.js) รับไปกดปุ่มแทน

ติดตั้งก่อนใช้งาน (ใน Python env เดียวกับที่ OBS ใช้ — เช็คได้จาก Tools > Scripts > แท็บ Python Settings):
    pip install obsws-python

วิธีใช้:
1. Tools > Scripts > + > เลือกไฟล์นี้
2. กรอก host / port / password ให้ตรงกับ Tools > WebSocket Server Settings ของคุณ
3. ปิดหน้าต่าง Scripts แล้วไปที่ Settings > Hotkeys จะเห็นหมวด "Scoreboard: ..." ครบทุกปุ่ม
   -> ตั้งปุ่มลัดที่ต้องการได้เลย (ไม่ชนกับ keydown เดิมในหน้าเว็บก็ได้ เพราะจะเลิกใช้ของเดิม)
4. แนะนำ: Settings > General > Advanced > Hotkey Focus Behavior ให้เลือก "Never Disable Hotkeys"
   เพื่อให้ hotkey ทำงานได้จริงแบบ global ไม่ว่า focus จะอยู่ dock ไหน
"""

import obspython as obs

try:
    import obsws_python as obsws
except ImportError:
    obsws = None

# --- action_id -> (คำอธิบายที่จะไปโชว์ใน Settings>Hotkeys, ชื่อ action ที่จะส่งให้ JS) ---
ACTIONS = {
    "sb_play1":        ("Scoreboard: เริ่มครึ่งแรก",      "play1"),
    "sb_halfpause":    ("Scoreboard: พักครึ่งแรก",        "halfpause"),
    "sb_play2":        ("Scoreboard: เริ่มครึ่งหลัง",      "play2"),
    "sb_fullend":      ("Scoreboard: จบเกม",             "fullend"),
    "sb_swap":         ("Scoreboard: สลับทีม",            "swap"),
    "sb_scoreAplus":   ("Scoreboard: เพิ่มคะแนน A",        "scoreAplus"),
    "sb_scoreAminus":  ("Scoreboard: ลดคะแนน A",          "scoreAminus"),
    "sb_scoreBplus":   ("Scoreboard: เพิ่มคะแนน B",        "scoreBplus"),
    "sb_scoreBminus":  ("Scoreboard: ลดคะแนน B",          "scoreBminus"),
    "sb_hidetimer":    ("Scoreboard: ซ่อน/แสดงเวลา",       "hidetimer"),
    "sb_injuryplus":   ("Scoreboard: เพิ่มทดเวลา",         "injuryplus"),
    "sb_injuryminus":  ("Scoreboard: ลดทดเวลา",           "injuryminus"),
}

hotkey_ids = {}   # action_id -> obs hotkey id (ต้องเก็บไว้เพื่อ save/load key binding)
ws_client = None
ws_settings = {"host": "localhost", "port": 4455, "password": ""}


def connect_ws():
    """เชื่อมต่อ (หรือเชื่อมต่อใหม่) ไปยัง obs-websocket ในฐานะ client ปกติ"""
    global ws_client
    if obsws is None:
        print("[scoreboard_hotkeys] ยังไม่ได้ติดตั้ง obsws-python: pip install obsws-python")
        return
    try:
        ws_client = obsws.ReqClient(
            host=ws_settings["host"],
            port=ws_settings["port"],
            password=ws_settings["password"],
            timeout=3,
        )
        print("[scoreboard_hotkeys] เชื่อมต่อ obs-websocket สำเร็จ")
    except Exception as e:
        ws_client = None
        print(f"[scoreboard_hotkeys] เชื่อมต่อ obs-websocket ไม่สำเร็จ: {e}")


def broadcast_action(action_name):
    global ws_client
    print(f"[scoreboard_hotkeys] broadcast_action called: {action_name}")
    
    if ws_client is None:
        print("[scoreboard_hotkeys] ws_client is None, connecting...")
        connect_ws()
        if ws_client is None:
            print("[scoreboard_hotkeys] Failed to connect!")
            return
    
    try:
        print(f"[scoreboard_hotkeys] Sending event: action={action_name}")
        # ใช้ base_client.req แทนเพราะ broadcast_custom_event ห่อ data ผิด
        response = ws_client.base_client.req("BroadcastCustomEvent", {"eventData": {"action": action_name}})
        print(f"[scoreboard_hotkeys] Response: {response}")
        
        if not response.get("requestStatus", {}).get("result"):
            raise Exception(f"BroadcastCustomEvent failed: {response}")
        
        print(f"[scoreboard_hotkeys] Event sent successfully: {action_name}")
    except Exception as e:
        print(f"[scoreboard_hotkeys] ส่ง event ไม่สำเร็จ: {e}")
        print(f"[scoreboard_hotkeys] Error type: {type(e)}")
        import traceback
        traceback.print_exc()
        connect_ws()


def make_callback(action_name):
    def callback(pressed):
        if pressed:  # obs ส่ง True ตอนกดลง, False ตอนปล่อย — เอาแค่ตอนกด
            broadcast_action(action_name)
    return callback


def script_description():
    return (
        "เชื่อม OBS Hotkeys (Settings > Hotkeys) เข้ากับปุ่มใน Scoreboard Dock\n"
        "ผ่าน obs-websocket (BroadcastCustomEvent) ทำให้กด hotkey ได้จากทุกที่ใน OBS\n"
        "โดยไม่ต้องคลิก dock ก่อน"
    )


def script_properties():
    props = obs.obs_properties_create()
    obs.obs_properties_add_text(props, "ws_host", "obs-websocket Host", obs.OBS_TEXT_DEFAULT)
    obs.obs_properties_add_int(props, "ws_port", "obs-websocket Port", 1, 65535, 1)
    obs.obs_properties_add_text(props, "ws_password", "obs-websocket Password", obs.OBS_TEXT_PASSWORD)
    return props


def script_defaults(settings):
    obs.obs_data_set_default_string(settings, "ws_host", "localhost")
    obs.obs_data_set_default_int(settings, "ws_port", 4455)
    obs.obs_data_set_default_string(settings, "ws_password", "")


def script_update(settings):
    ws_settings["host"] = obs.obs_data_get_string(settings, "ws_host") or "localhost"
    ws_settings["port"] = obs.obs_data_get_int(settings, "ws_port") or 4455
    ws_settings["password"] = obs.obs_data_get_string(settings, "ws_password") or ""
    connect_ws()


def script_load(settings):
    for action_id, (description, action_name) in ACTIONS.items():
        hk_id = obs.obs_hotkey_register_frontend(action_id, description, make_callback(action_name))
        hotkey_ids[action_id] = hk_id
        saved_array = obs.obs_data_get_array(settings, action_id)
        obs.obs_hotkey_load(hk_id, saved_array)
        obs.obs_data_array_release(saved_array)


def script_save(settings):
    for action_id, hk_id in hotkey_ids.items():
        saved_array = obs.obs_hotkey_save(hk_id)
        obs.obs_data_set_array(settings, action_id, saved_array)
        obs.obs_data_array_release(saved_array)
