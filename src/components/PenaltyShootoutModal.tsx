import PenaltyShootoutController from './PenaltyShootoutController';

interface PenaltyShootoutModalProps {
  isOpen: boolean;
  obs: any;
  teamNameA: string;
  teamNameB: string;
  onClose: () => void;
}

export default function PenaltyShootoutModal({ isOpen, obs, teamNameA, teamNameB, onClose }: PenaltyShootoutModalProps) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '10px', right: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }} title="ปิด">×</button>
        <PenaltyShootoutController obs={obs} teamNameA={teamNameA} teamNameB={teamNameB} onClose={onClose} />
      </div>
    </div>
  );
}
