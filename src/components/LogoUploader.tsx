import React, { useState } from 'react';
import { useImageUploadQuota } from '../hooks/useImageUploadQuota';
import { validateLogoFile } from '../services/logoStorageService';
import type { LogoStorageProvider } from '../types/logoStorage';
import LogoStorageProviderSelect from './LogoStorageProviderSelect';

interface LogoUploaderProps {
  uploadLogo: (
    file: File,
    fileName: string,
    provider?: LogoStorageProvider,
  ) => Promise<string>;
  onUploadSuccess?: (fileName: string, url: string, targetTeam?: 'A' | 'B' | 'none') => Promise<void> | void;
}

export default function LogoUploader({ uploadLogo, onUploadSuccess }: LogoUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [targetTeam, setTargetTeam] = useState<'A' | 'B' | 'none'>('none');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadedUrl, setUploadedUrl] = useState<string>('');
  const [storageProvider, setStorageProvider] = useState<LogoStorageProvider>('supabase');

  const { isQuotaExceeded, isUnlimited, incrementUploadCount, quotaMessage, loading: quotaLoading } = useImageUploadQuota();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (isQuotaExceeded) {
        setError('คุณใช้โควต้าอัปโหลดรูปภาพครบ 10 รูปแล้ว กรุณาสมัครสมาชิกเพื่อใช้งานไม่จำกัด');
        return;
      }
      if (quotaLoading) {
        setError('กำลังตรวจสอบโควต้า กรุณารอสักครู่');
        return;
      }

      try {
        validateLogoFile(selectedFile);
      } catch (validationError: unknown) {
        setError(validationError instanceof Error ? validationError.message : 'ไฟล์รูปภาพไม่ถูกต้อง');
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
    if (quotaLoading) {
      setError('กำลังตรวจสอบโควต้า กรุณารอสักครู่');
      return;
    }
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
      const imageUrl = await uploadLogo(file, file.name, storageProvider);

      await incrementUploadCount();

      setMessage(`✅ อัปโหลดสำเร็จ!`);
      setUploadedUrl(imageUrl);
      setFile(null);
      setPreviewUrl('');

      if (onUploadSuccess) {
        await onUploadSuccess?.(file.name, imageUrl, targetTeam);
      }

    } catch (err: unknown) {
      console.error('Upload error:', err);
      setError(`❌ เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดรูปภาพได้'}`);
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
      <h3 style={{ marginTop: 0 }}>📤 อัปโหลดโลโก้</h3>

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

      <div style={{ marginBottom: '15px' }}>
        <label
          htmlFor="scoreboard-logo-storage-provider"
          style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px' }}
        >
          พื้นที่จัดเก็บ
        </label>
        <LogoStorageProviderSelect
          id="scoreboard-logo-storage-provider"
          value={storageProvider}
          onChange={setStorageProvider}
          disabled={uploading}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #444',
            backgroundColor: '#2a2a2a',
            color: '#fff',
          }}
        />
      </div>

      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          disabled={uploading || isQuotaExceeded || quotaLoading}
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
        disabled={!file || uploading || isQuotaExceeded || quotaLoading}
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
        marginTop: '10px',
        fontSize: '12px',
        color: '#888'
      }}>
        💡 รูปภาพจะถูกเก็บใน {storageProvider === 'cloudinary' ? 'Cloudinary' : 'Supabase Storage'} และใช้ URL เดียวกันทุก browser/OBS
      </div>
    </div>
  );
}
