import { useState, useRef } from 'react';
import { convertAdvSceneSwitcherFile, isValidAdvSceneSwitcherFile } from '../services/advSceneSwitcherConverter';
import type { Macro } from '../services/macroEngine';

interface AdvSceneSwitcherImporterProps {
  onImport: (macros: Macro[]) => void;
  onClose: () => void;
}

export default function AdvSceneSwitcherImporter({ onImport, onClose }: AdvSceneSwitcherImporterProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [preview, setPreview] = useState<Macro[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError('');

    try {
      const content = await file.text();

      // Validate format
      if (!isValidAdvSceneSwitcherFile(content)) {
        throw new Error('Invalid Advanced Scene Switcher file format');
      }

      // Convert macros
      const convertedMacros = convertAdvSceneSwitcherFile(content);

      if (convertedMacros.length === 0) {
        throw new Error('No valid macros found in file');
      }

      // Show preview
      setPreview(convertedMacros);
      setShowPreview(true);
    } catch (err: any) {
      setError(err.message || 'Failed to import file');
      console.error('Import error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = () => {
    if (preview.length > 0) {
      onImport(preview);
      onClose();
    }
  };

  const handleCancel = () => {
    setPreview([]);
    setShowPreview(false);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-file-import"></i> Import Advanced Scene Switcher Macros
        </h3>

        {!showPreview ? (
          <>
            {/* File Selection */}
            <div style={{
              padding: '32px',
              background: '#1e293b',
              borderRadius: '12px',
              border: '2px dashed #475569',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <i className="fas fa-cloud-upload-alt" style={{ fontSize: '3rem', color: '#3b82f6', marginBottom: '16px' }}></i>
              <h4 style={{ margin: '0 0 8px 0', color: '#e2e8f0' }}>
                Select Advanced Scene Switcher Export File
              </h4>
              <p style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                Choose a .txt or .json file exported from Advanced Scene Switcher plugin
              </p>
              <input
                type="file"
                ref={fileInputRef}
                accept=".txt,.json"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={isProcessing}
              />
              <button
                className="btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                style={{ fontSize: '1rem', padding: '12px 24px' }}
              >
                <i className="fas fa-folder-open"></i> {isProcessing ? 'Processing...' : 'Choose File'}
              </button>
            </div>

            {/* Error Display */}
            {error && (
              <div style={{
                padding: '16px',
                background: '#7f1d1d',
                borderRadius: '8px',
                borderLeft: '4px solid #ef4444',
                color: '#fca5a5',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <i className="fas fa-exclamation-circle" style={{ marginTop: '2px' }}></i>
                  <div>
                    <strong>Import Error</strong><br />
                    {error}
                  </div>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div style={{
              padding: '16px',
              background: '#064e3b',
              borderRadius: '8px',
              borderLeft: '4px solid #10b981',
              fontSize: '0.9rem',
              color: '#a7f3d0',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <i className="fas fa-info-circle" style={{ marginTop: '2px', color: '#10b981' }}></i>
                <div>
                  <strong style={{ color: '#6ee7b7' }}>📖 How to Export from Advanced Scene Switcher:</strong><br />
                  1. Open OBS Studio<br />
                  2. Go to Tools → Advanced Scene Switcher<br />
                  3. Click on "Macro" tab<br />
                  4. Right-click on macro list area<br />
                  5. Select "Export" → "Export to file"<br />
                  6. Save as .txt or .json file<br />
                  7. Upload that file here
                </div>
              </div>
            </div>

            {/* Supported Features */}
            <div style={{
              padding: '16px',
              background: '#1e293b',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontSize: '0.95rem' }}>
                ✅ Supported Actions:
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1' }}>
                <li>Wait</li>
                <li>Scene Switch</li>
                <li>Hotkeys (show/hide sources)</li>
              </ul>
              <p style={{ margin: '12px 0 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                ℹ️ All imported macros will be set to "Manual Trigger" mode
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Preview */}
            <div style={{
              padding: '16px',
              background: '#1e3a8a',
              borderRadius: '8px',
              borderLeft: '4px solid #3b82f6',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <i className="fas fa-check-circle" style={{ color: '#60a5fa' }}></i>
                <strong style={{ color: '#dbeafe' }}>Preview: {preview.length} macro{preview.length !== 1 ? 's' : ''} ready to import</strong>
              </div>
            </div>

            {/* Macro List */}
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              marginBottom: '20px'
            }}>
              {preview.map((macro, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px',
                    background: '#1e293b',
                    borderRadius: '8px',
                    border: '2px solid #334155',
                    marginBottom: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#e2e8f0' }}>
                        {macro.name}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'pre-line' }}>
                        {macro.description}
                      </p>
                    </div>
                    <div style={{
                      padding: '4px 12px',
                      background: '#3b82f6',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      color: '#fff',
                      whiteSpace: 'nowrap'
                    }}>
                      {macro.actions.length} action{macro.actions.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Actions Preview */}
                  <div style={{ 
                    padding: '12px', 
                    background: '#0f172a', 
                    borderRadius: '6px',
                    fontSize: '0.8rem'
                  }}>
                    <strong style={{ color: '#cbd5e1', marginBottom: '8px', display: 'block' }}>Actions:</strong>
                    {macro.actions.map((action, actionIdx) => (
                      <div
                        key={actionIdx}
                        style={{
                          padding: '6px 8px',
                          background: '#1e293b',
                          borderLeft: '3px solid #3b82f6',
                          borderRadius: '4px',
                          marginBottom: '4px',
                          color: '#cbd5e1'
                        }}
                      >
                        <span style={{ color: '#60a5fa', marginRight: '8px' }}>#{actionIdx + 1}</span>
                        {action.type === 'wait' && `⏱️ Wait ${action.duration}s`}
                        {action.type === 'scene_switch' && `🎬 Switch to "${action.sceneName}"`}
                        {action.type === 'source_show' && `👁️ Show "${action.sourceName}" in "${action.sceneName}"`}
                        {action.type === 'source_hide' && `🙈 Hide "${action.sourceName}" in "${action.sceneName}"`}
                        {action.type === 'hotkey' && `⌨️ Hotkey: ${action.hotkeyName}`}
                      </div>
                    ))}
                  </div>

                  {/* Settings */}
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', fontSize: '0.75rem' }}>
                    {macro.enabled && (
                      <span style={{ padding: '2px 8px', background: '#065f46', borderRadius: '4px', color: '#6ee7b7' }}>
                        ✓ Enabled
                      </span>
                    )}
                    {macro.runOnce && (
                      <span style={{ padding: '2px 8px', background: '#1e40af', borderRadius: '4px', color: '#93c5fd' }}>
                        Run Once
                      </span>
                    )}
                    {macro.parallel && (
                      <span style={{ padding: '2px 8px', background: '#7c2d12', borderRadius: '4px', color: '#fdba74' }}>
                        Parallel
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Warning */}
            <div style={{
              padding: '12px',
              background: '#78350f',
              borderRadius: '6px',
              borderLeft: '4px solid #f59e0b',
              fontSize: '0.85rem',
              color: '#fcd34d',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginTop: '2px' }}></i>
                <div>
                  <strong>Note:</strong> Imported macros may need manual adjustment.<br />
                  Hotkey-based show/hide actions might require scene/source name corrections.
                </div>
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          {showPreview && (
            <button 
              className="btn-secondary" 
              onClick={handleCancel}
            >
              <i className="fas fa-arrow-left"></i> Back
            </button>
          )}
          <button 
            className="btn-secondary" 
            onClick={onClose}
          >
            <i className="fas fa-times"></i> Cancel
          </button>
          {showPreview && (
            <button 
              className="btn-success" 
              onClick={handleConfirmImport}
              disabled={preview.length === 0}
            >
              <i className="fas fa-file-import"></i> Import {preview.length} Macro{preview.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
