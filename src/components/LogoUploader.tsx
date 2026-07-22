// Firebase Storage Logo Uploader
import React, { useState } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getApp } from 'firebase/app';

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith('image/')) {
        setError('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
        return;
      }

      // Validate file size (5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('ไฟล์ใหญ่เกิน 5MB');
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
      // Get Firebase app
      const app = getApp();
      const storage = getStorage(app);

      // Create unique filename with timestamp
      const timestamp = Date.now();
      const fileName = file.name;
      const storageRef = ref(storage, `logos/${fileName}`);

      // Upload file
      await uploadBytes(storageRef, file);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      setMessage(`✅ อัปโหลดสำเร็จ!`);
      setUploadedUrl(downloadURL);
      setFile(null);
      setPreviewUrl('');
      
      if (onUploadSuccess) {
        onUploadSuccess(fileName, downloadURL);
      }

    } catch (err: any) {
      console.error('Upload error:', err);
      
      if (err.code === 'storage/unauthorized') {
        setError(`❌ ไม่มีสิทธิ์อัปโหลด - กรุณาตั้งค่า Firebase Storage Rules`);
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
      <h3 style={{ marginTop: 0 }}>📤 อัปโหลดโลโก้ (Firebase Storage)</h3>
      
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
        fontSize: '12px',
        color: '#888'
      }}>
        💡 <strong>ข้อดี:</strong> อัปโหลดได้ทันที ไม่ต้องรอ deploy (ฟรี 5GB)
      </div>
    </div>
  );
}
