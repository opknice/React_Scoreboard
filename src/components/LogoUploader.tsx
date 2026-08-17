// Cloudinary Logo Uploader (Unsigned Upload - No API Secret needed)
import React, { useState } from 'react';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '../constants/uploadConfig';
import { useImageUploadQuota } from '../hooks/useImageUploadQuota';

interface LogoUploaderProps {
  onUploadSuccess?: (fileName: string, url: string, targetTeam?: 'A' | 'B' | 'none') => void;
}

export default function LogoUploader({ onUploadSuccess }: LogoUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [targetTeam, setTargetTeam] = useState<'A' | 'B' | 'none'>('none');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadedUrl, setUploadedUrl] = useState<string>('');

  const { isQuotaExceeded, isUnlimited, incrementUploadCount, quotaMessage } = useImageUploadQuota();

  // Cloudinary config (public info - safe to expose)
  const CLOUD_NAME = 'vayh51zb';
  const UPLOAD_PRESET = 'logo_upload'; // You'll create this in next step

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (isQuotaExceeded) {
        setError('คุณใช้โควต้าอัปโหลดรูปภาพครบ 10 รูปแล้ว กรุณาสมัครสมาชิกเพื่อใช้งานไม่จำกัด');
        return;
      }

      // Validate file type
      if (!selectedFile.type.startsWith('image/')) {
        setError('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
        return;
      }

      // Validate file size (2MB for Cloudinary)
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        const sizeInMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
        setError(`ไฟล์ใหญ่เกิน ${MAX_FILE_SIZE_MB}MB (ขนาดปัจจุบัน ${sizeInMB}MB)`);
        return;
      }

      setFile(selectedFile);
      setError('');
      setMessage('');
      setUploadedUrl('');

      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (isQuotaExceeded) {
      setError('คุณใช้โควต้าอัปโหลดรูปภาพครบ 10 รูปแล้ว กรุณาสมัครสมาชิกเพื่อใช้งานไม่จำกัด');
      return;
    }

    if (!file) {
      setError('กรุณาเลือกไฟล์');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', 'logos'); // Optional: organize in folder

      // Upload to Cloudinary
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

      await incrementUploadCount();

      setMessage(`✅ อัปโหลดสำเร็จ!`);
      setUploadedUrl(imageUrl);
      setFile(null);
      setPreviewUrl('');

      if (onUploadSuccess) {
        onUploadSuccess(file.name, imageUrl, targetTeam);
      }

    } catch (err: any) {
      console.error('Upload error:', err);

      if (err.message.includes('Invalid upload preset')) {
        setError(`❌ ยังไม่ได้ตั้งค่า Upload Preset - กรุณาดูคำแนะนำด้านล่าง`);
      } else {
        setError(`❌ เกิดข้อผิดพลาด: ${err.message}`);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      padding: '20px',
      border: '2px dashed #444',
      borderRadius: '8px',
      backgroundColor: '#1a1a1a',
      marginTop: '20px'
    }}>
      <h3 style={{ marginTop: 0 }}>📤 อัปโหลดโลโก้ (Cloudinary - ฟรี 25GB)</h3>

      {/* Quota Banner */}
      <div style={{
        padding: '8px 12px',
        borderRadius: '6px',
        backgroundColor: isQuotaExceeded ? '#450a0a' : isUnlimited ? '#064e3b' : '#1e293b',
        border: isQuotaExceeded ? '1px solid #ef4444' : isUnlimited ? '1px solid #10b981' : '1px solid #3b82f6',
        color: '#fff',
        fontSize: '12px',
        marginBottom: '15px',
        fontWeight: 500
      }}>
        ℹ️ {quotaMessage}
      </div>

      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading || isQuotaExceeded}
          style={{
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #444',
            backgroundColor: '#2a2a2a',
            color: '#fff',
            flex: 1,
            cursor: 'pointer'
          }}
        />
        <select
          value={targetTeam}
          onChange={(e) => setTargetTeam(e.target.value as 'A' | 'B' | 'none')}
          disabled={uploading}
          style={{
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #444',
            backgroundColor: '#2a2a2a',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          <option value="none">ไม่อัปเดตทีม</option>
          <option value="A">ใช้เป็นโลโก้ Team A</option>
          <option value="B">ใช้เป็นโลโก้ Team B</option>
        </select>
      </div>

      {previewUrl && (
        <div style={{ marginBottom: '15px', textAlign: 'center' }}>
          <img
            src={previewUrl}
            alt="Preview"
            style={{
              maxWidth: '200px',
              maxHeight: '200px',
              border: '1px solid #444',
              borderRadius: '4px'
            }}
          />
          <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
            {file?.name} ({(file!.size / 1024).toFixed(2)} KB)
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading || isQuotaExceeded}
        style={{
          padding: '10px 20px',
          backgroundColor: isQuotaExceeded ? '#7f1d1d' : (file && !uploading ? '#4CAF50' : '#666'),
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: file && !uploading && !isQuotaExceeded ? 'pointer' : 'not-allowed',
          fontSize: '14px',
          width: '100%'
        }}
      >
        {uploading ? '⏳ กำลังอัปโหลด...' : isQuotaExceeded ? '🚫 โควต้าการอัปโหลดเต็มแล้ว (10/10)' : '🚀 อัปโหลดทันที (ไม่ต้องรอ deploy)'}
      </button>

      {message && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#1b5e20',
          color: '#4caf50',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          {message}
        </div>
      )}

      {uploadedUrl && (
        <div style={{
          marginTop: '10px',
          padding: '10px',
          backgroundColor: '#1a237e',
          borderRadius: '4px',
          fontSize: '12px',
          wordBreak: 'break-all'
        }}>
          <strong>URL:</strong><br />
          <a href={uploadedUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#64b5f6' }}>
            {uploadedUrl}
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(uploadedUrl);
              setMessage('✅ คัดลอก URL แล้ว!');
              setTimeout(() => setMessage(''), 2000);
            }}
            style={{
              marginLeft: '10px',
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            📋 คัดลอก
          </button>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#5c0000',
          color: '#ff5252',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <div style={{
        marginTop: '15px',
        padding: '12px',
        backgroundColor: '#1a1a2e',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#aaa',
        borderLeft: '3px solid #ff9800'
      }}>
        <strong style={{ color: '#ff9800' }}>⚠️ ขั้นตอนสำคัญ:</strong><br />
        ต้องสร้าง <strong>Upload Preset</strong> ก่อนใช้งาน:<br />
        <ol style={{ marginLeft: '20px', marginTop: '8px', marginBottom: 0 }}>
          <li>ไปที่ <a href="https://console.cloudinary.com/settings/upload" target="_blank" style={{ color: '#64b5f6' }}>Cloudinary Settings</a></li>
          <li>เลื่อนลงมาที่ <strong>Upload presets</strong></li>
          <li>คลิก <strong>Add upload preset</strong></li>
          <li>ตั้งชื่อ: <code style={{ backgroundColor: '#2a2a2a', padding: '2px 6px', borderRadius: '3px' }}>logo_upload</code></li>
          <li>เปลี่ยน Signing Mode เป็น: <strong>Unsigned</strong></li>
          <li>Folder: <code style={{ backgroundColor: '#2a2a2a', padding: '2px 6px', borderRadius: '3px' }}>logos</code></li>
          <li>คลิก <strong>Save</strong></li>
        </ol>
      </div>

      <div style={{
        marginTop: '10px',
        fontSize: '12px',
        color: '#888'
      }}>
        💡 <strong>ข้อดี:</strong> ฟรี 25GB, CDN เร็ว, Image optimization อัตโนมัติ
      </div>
    </div>
  );
}
