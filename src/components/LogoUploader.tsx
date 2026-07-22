// Cloudinary Logo Uploader (Unsigned Upload - No API Secret needed)
import React, { useState } from 'react';

interface LogoUploaderProps {
  onUploadSuccess?: (fileName: string, url: string) => void;
}

export default function LogoUploader({ onUploadSuccess }: LogoUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadedUrl, setUploadedUrl] = useState<string>('');

  // Cloudinary config (public info - safe to expose)
  const CLOUD_NAME = 'vayh51zb';
  const UPLOAD_PRESET = 'logo_upload'; // You'll create this in next step

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith('image/')) {
        setError('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
        return;
      }

      // Validate file size (10MB for Cloudinary)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('ไฟล์ใหญ่เกิน 10MB');
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

      setMessage(`✅ อัปโหลดสำเร็จ!`);
      setUploadedUrl(imageUrl);
      setFile(null);
      setPreviewUrl('');
      
      if (onUploadSuccess) {
        onUploadSuccess(file.name, imageUrl);
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
      
      <div style={{ marginBottom: '15px' }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          style={{
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #444',
            backgroundColor: '#2a2a2a',
            color: '#fff',
            width: '100%',
            cursor: 'pointer'
          }}
        />
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
        disabled={!file || uploading}
        style={{
          padding: '10px 20px',
          backgroundColor: file && !uploading ? '#4CAF50' : '#666',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: file && !uploading ? 'pointer' : 'not-allowed',
          fontSize: '14px',
          width: '100%'
        }}
      >
        {uploading ? '⏳ กำลังอัปโหลด...' : '🚀 อัปโหลดทันที (ไม่ต้องรอ deploy)'}
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
          <strong>URL:</strong><br/>
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
        <strong style={{ color: '#ff9800' }}>⚠️ ขั้นตอนสำคัญ:</strong><br/>
        ต้องสร้าง <strong>Upload Preset</strong> ก่อนใช้งาน:<br/>
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
