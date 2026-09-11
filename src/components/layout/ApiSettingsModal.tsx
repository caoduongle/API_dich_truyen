import React, { Suspense } from 'react';
import { useAIConfigContext } from '../../context/AIConfigContext';

const ApiSettings = React.lazy(() => import('../ApiSettings'));

export interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiSettingsModal({ isOpen, onClose }: ApiSettingsModalProps) {
  const {
    apiKeys,
    selectedModel,
    warningParagraphMismatch,
    enableAiQaCritique,
    enableSegmentTranslation,
    setWarningParagraphMismatch,
    setEnableAiQaCritique,
    setEnableSegmentTranslation,
    handleSaveModel,
    handleAddApiKey,
    handleUpdateKeyIndex,
    handleDeleteKeyIndex,
    handleImportClipboardKeys,
  } = useAIConfigContext();

  if (!isOpen) return null;

  return (
    <Suspense fallback={null}>
      <ApiSettings
        apiKeys={apiKeys}
        selectedModel={selectedModel}
        onClose={onClose}
        onSaveModel={handleSaveModel}
        onAddApiKey={handleAddApiKey}
        onUpdateKeyIndex={handleUpdateKeyIndex}
        onDeleteKeyIndex={handleDeleteKeyIndex}
        onImportClipboardKeys={handleImportClipboardKeys}
        warningParagraphMismatch={warningParagraphMismatch}
        setWarningParagraphMismatch={setWarningParagraphMismatch}
        enableAiQaCritique={enableAiQaCritique}
        setEnableAiQaCritique={setEnableAiQaCritique}
        enableSegmentTranslation={enableSegmentTranslation}
        setEnableSegmentTranslation={setEnableSegmentTranslation}
      />
    </Suspense>
  );
}
