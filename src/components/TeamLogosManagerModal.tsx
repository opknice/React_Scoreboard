import { useState, useEffect, useRef } from 'react';
import type { Database } from 'firebase/database';
import {
  getLogoSrc,
  getTeamInitials,
  saveTeamsToFirebase,
  listenToFirebaseTeams,
  normalizeTeamKey
} from '../utils/logoResolver';

interface TeamLogosManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamList: string[];
  db: Database | null;
  leagueName?: string;
  logoFolderPath: string;
  onLogoFolderPathChange: (path: string) => void;
  onToast?: (message: string, type?: string) => void;
}

export default function TeamLogosManagerModal({
  isOpen,
  onClose,
  teamList,
  db,
  leagueName,
  logoFolderPath,
  onLogoFolderPathChange,
  onToast
}: TeamLogosManagerModalProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [teamLogosMap, setTeamLogosMap] = useState<Record<string, { name: string; logo: string }>>({});
  const [uploadingTeam, setUploadingTeam] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [obsLogoPath, setObsLogoPath] = useState<string>(() => logoFolderPath || localStorage.getItem('logoFolderPath') || 'D:\\OBS_football\\logos');

  useEffect(() => {
    setObsLogoPath(logoFolderPath || localStorage.getItem('logoFolderPath') || 'D:\\OBS_football\\logos');
  }, [logoFolderPath, isOpen]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetUploadTeamRef = useRef<string | null>(null);

  const handleDirectFileUpload = async (teamName: string, selectedFile: File) => {
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      onToast?.('❌ กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      onToast?.('❌ ไฟล์รูปภาพต้องมีขนาดไม่เกิน 10MB', 'error');
      return;
    }

    setUploadingTeam(teamName);

    try {
      const CLOUD_NAME = 'vayh51zb';
      const UPLOAD_PRESET = 'logo_upload';

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', 'logos');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Upload failed');
      }

      const data = await response.json();
      const imageUrl = data.secure_url;

      handleUpdateLogo(teamName, imageUrl);
      onToast?.(`✅ อัปโหลดโลโก้ ${teamName} ขึ้น Cloud เรียบร้อยแล้ว!`, 'success');
    } catch (err: any) {
      console.error('Direct upload error:', err);
      onToast?.(`❌ เกิดข้อผิดพลาดในการอัปโหลด: ${err.message}`, 'error');
    } finally {
      setUploadingTeam(null);
    }
  };

  // Initialize and load existing teams from Firebase DB when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // 1. Build initial map from teamList
    const initialMap: Record<string, { name: string; logo: string }> = {};
    
    // Load local storage fallback
    const savedLocal = localStorage.getItem('teamLogos');
    const localMemory: Record<string, string> = savedLocal ? JSON.parse(savedLocal) : {};

    teamList.forEach((team) => {
      const clean = team.trim();
      if (!clean) return;
      const key = normalizeTeamKey(clean);
      initialMap[key] = {
        name: clean,
        logo: localMemory[key] || ''
      };
    });

    setTeamLogosMap(initialMap);

    // 2. Listen to Firebase Realtime DB `teams` node
    if (db) {
      const unsubscribe = listenToFirebaseTeams(db, (fbTeamsMap) => {
        setTeamLogosMap((prev) => {
          const updated = { ...prev };
          Object.keys(fbTeamsMap).forEach((key) => {
            const fbItem = fbTeamsMap[key];
            if (updated[key]) {
              updated[key] = {
                ...updated[key],
                logo: fbItem.logo || updated[key].logo
              };
            } else {
              updated[key] = {
                name: fbItem.name,
                logo: fbItem.logo
              };
            }
          });
          return updated;
        });
      });
      return () => unsubscribe();
    }
  }, [isOpen, db, teamList]);

  if (!isOpen) return null;

  const allTeamsKeys = Object.keys(teamLogosMap);
  const filteredKeys = allTeamsKeys.filter((key) => {
    const item = teamLogosMap[key];
    if (!searchTerm) return true;
    return item.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalTeams = allTeamsKeys.length;
  const configuredTeams = allTeamsKeys.filter((k) => teamLogosMap[k].logo.startsWith('http')).length;

  const handleUpdateLogo = (teamName: string, url: string) => {
    const key = normalizeTeamKey(teamName);
    setTeamLogosMap((prev) => ({
      ...prev,
      [key]: {
        name: prev[key]?.name || teamName,
        logo: url.trim()
      }
    }));
  };

  const handleSaveAllToFirebase = async () => {
    if (!db) {
      onToast?.('❌ กรุณาเชื่อมต่อ Firebase Realtime Database ก่อนบันทึก', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await saveTeamsToFirebase(db, teamLogosMap);
      
      // Update local storage backup
      const localBackup: Record<string, string> = {};
      Object.keys(teamLogosMap).forEach((k) => {
        if (teamLogosMap[k].logo) {
          localBackup[k] = teamLogosMap[k].logo;
        }
      });
      localStorage.setItem('teamLogos', JSON.stringify(localBackup));

      onToast?.(`✅ บันทึกโลโก้ทีม ${Object.keys(teamLogosMap).length} ทีมลง Firebase สำเร็จ!`, 'success');
      onClose();
    } catch (err: any) {
      console.error('Save teams error:', err);
      onToast?.(`❌ เกิดข้อผิดพลาดในการบันทึก: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fas fa-shield-halved" style={{ color: 'var(--accent-color)' }}></i>
            จัดการโลโก้ทีมประจำลีก (Batch Team Logos Manager)
          </h2>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-muted-color)', fontSize: '13px' }}>
            {leagueName ? `สำหรับลีก: ${leagueName} | ` : ''}
            อัปโหลดหรือใส่ URL โลโก้ของทุกทีมที่ดึงจาก Excel แล้วบันทึกลง Firebase ครั้งแรกเพียงครั้งเดียว
          </p>
        </div>

        {/* OBS Logo Path Setting Section */}
        <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#1a1a2e', borderRadius: '8px', border: '1px solid #3f51b5' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64b5f6', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <i className="fas fa-folder-open"></i> ตั้งค่า Path logo obs (ส่งไฟล์ไป OBS WebSocket):
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', backgroundColor: '#2a2a2a', border: '1px solid #444', color: '#fff', fontSize: '13px' }}
              value={obsLogoPath}
              placeholder="D:\OBS_football\logos"
              onChange={(e) => {
                const val = e.target.value;
                setObsLogoPath(val);
                onLogoFolderPathChange?.(val);
                localStorage.setItem('logoFolderPath', val);
              }}
            />
            <button
              className="btn-primary"
              style={{ fontSize: '12px', padding: '6px 14px', whiteSpace: 'nowrap' }}
              onClick={() => {
                onLogoFolderPathChange?.(obsLogoPath);
                localStorage.setItem('logoFolderPath', obsLogoPath);
                onToast?.(`💾 บันทึก Path OBS (${obsLogoPath}) เรียบร้อยแล้ว`, 'success');
                onClose();
              }}
            >
              💾 บันทึก
            </button>
            <button
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '6px 12px', whiteSpace: 'nowrap' }}
              onClick={() => {
                const defaultPath = 'D:\\OBS_football\\logos';
                setObsLogoPath(defaultPath);
                onLogoFolderPathChange?.(defaultPath);
                localStorage.setItem('logoFolderPath', defaultPath);
                onToast?.('ตั้งค่า Path เป็น D:\\OBS_football\\logos เรียบร้อย', 'info');
              }}
            >
              🔄 ใช้ Default Path
            </button>
          </div>
        </div>

        {/* Stats & Search Bar */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="🔍 ค้นหาชื่อทีม..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff' }}
          />
          <div style={{ fontSize: '13px', backgroundColor: '#222', padding: '6px 12px', borderRadius: '6px', border: '1px solid #333' }}>
            พร้อมใช้งาน: <strong style={{ color: '#4caf50' }}>{configuredTeams}</strong> / {totalTeams} ทีม
          </div>
        </div>

        {/* Teams Grid List */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px', marginBottom: '16px' }}>
          {filteredKeys.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <i className="fas fa-search" style={{ fontSize: '24px', marginBottom: '8px', display: 'block' }}></i>
              ไม่พบรายชื่อทีมในระบบ (กรุณานำเข้าไฟล์ Excel ก่อน)
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredKeys.map((key) => {
                const item = teamLogosMap[key];
                const hasCloudUrl = item.logo.startsWith('http');

                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      backgroundColor: '#1e1e1e',
                      borderRadius: '8px',
                      border: hasCloudUrl ? '1px solid #2e7d32' : '1px solid #333'
                    }}
                  >
                    {/* Logo Preview Avatar */}
                    <div
                      style={{
                        width: '45px',
                        height: '45px',
                        borderRadius: '50%',
                        backgroundColor: '#2a2a2a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        flexShrink: 0,
                        border: '1px solid #444'
                      }}
                    >
                      <img
                        key={item.logo}
                        src={getLogoSrc(item.logo, item.name)}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#aaa' }}>
                        {getTeamInitials(item.name)}
                      </span>
                    </div>

                    {/* Team Name & Status */}
                    <div style={{ width: '160px', flexShrink: 0 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '11px', color: hasCloudUrl ? '#81c784' : '#ffb74d' }}>
                        {hasCloudUrl ? '✅ บันทึก Cloud URL แล้ว' : '⚠️ รอนำเข้าโลโก้'}
                      </div>
                    </div>

                    {/* URL Input field */}
                    <input
                      type="text"
                      placeholder="วาง URL โลโก้ (https://...)"
                      value={item.logo}
                      onChange={(e) => handleUpdateLogo(item.name, e.target.value)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '4px',
                        backgroundColor: '#2a2a2a',
                        border: '1px solid #444',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                    />

                    {/* Paste URL Button */}
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                      title="วางลิงก์จากคลิปบอร์ด"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            handleUpdateLogo(item.name, text);
                            onToast?.(`คัดลอก URL ให้ ${item.name} แล้ว`, 'success');
                          }
                        } catch (e) {
                          onToast?.('อ่านคลิปบอร์ดไม่สำเร็จ', 'error');
                        }
                      }}
                    >
                      📋 วาง
                    </button>

                    {/* Upload Button - Directly triggers native file browser */}
                    <button
                      className="btn-primary"
                      disabled={uploadingTeam === item.name}
                      style={{ padding: '6px 12px', fontSize: '12px', minWidth: '95px' }}
                      onClick={() => {
                        targetUploadTeamRef.current = item.name;
                        fileInputRef.current?.click();
                      }}
                    >
                      {uploadingTeam === item.name ? '⏳ อัปโหลด...' : '📤 อัปโหลด'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Hidden File Input for Direct Native Browsing */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && targetUploadTeamRef.current) {
              handleDirectFileUpload(targetUploadTeamRef.current, file);
              e.target.value = '';
            }
          }}
        />

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #333', paddingTop: '12px' }}>
          <button className="btn-secondary" onClick={onClose} disabled={isSaving}>
            ยกเลิก
          </button>
          <button
            className="btn-success"
            style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 'bold' }}
            onClick={handleSaveAllToFirebase}
            disabled={isSaving}
          >
            {isSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึกโลโก้ทีมทั้งหมดลง Firebase Database'}
          </button>
        </div>
      </div>
    </div>
  );
}
