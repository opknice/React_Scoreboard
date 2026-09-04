import { useState } from 'react';

export function useScoreboardModalState() {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [showVarReplayV2Modal, setShowVarReplayV2Modal] = useState(false);
  const [showInstantReplayModal, setShowInstantReplayModal] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showLogoPathModal, setShowLogoPathModal] = useState(false);
  const [showPresetTimeModal, setShowPresetTimeModal] = useState(false);
  const [showQuickSetupModal, setShowQuickSetupModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showTeamSelectModal, setShowTeamSelectModal] = useState(false);
  const [showAutoMacrosModal, setShowAutoMacrosModal] = useState(false);
  const [showOBSSetupModal, setShowOBSSetupModal] = useState(false);

  return {
    showSettingsModal, setShowSettingsModal,
    showHelpModal, setShowHelpModal,
    showPenaltyModal, setShowPenaltyModal,
    showVarReplayV2Modal, setShowVarReplayV2Modal,
    showInstantReplayModal, setShowInstantReplayModal,
    showDonateModal, setShowDonateModal,
    showLogoPathModal, setShowLogoPathModal,
    showPresetTimeModal, setShowPresetTimeModal,
    showQuickSetupModal, setShowQuickSetupModal,
    showChangelogModal, setShowChangelogModal,
    showTeamSelectModal, setShowTeamSelectModal,
    showAutoMacrosModal, setShowAutoMacrosModal,
    showOBSSetupModal, setShowOBSSetupModal,
  };
}
