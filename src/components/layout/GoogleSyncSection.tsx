import React, { Suspense } from 'react';
import { useProjectContext } from '../../context/ProjectContext';

const GoogleSyncModal = React.lazy(() =>
  import('../google-sync/GoogleSyncModal').then((m) => ({ default: m.GoogleSyncModal }))
);
const CustomThemeModal = React.lazy(() =>
  import('../common/CustomThemeModal').then((m) => ({ default: m.CustomThemeModal }))
);

export interface GoogleSyncSectionProps {
  showGoogleSyncModal: boolean;
  onCloseGoogleSyncModal: () => void;
  showCustomThemeModal?: boolean;
  onCloseCustomThemeModal?: () => void;
}

export function GoogleSyncSection({
  showGoogleSyncModal,
  onCloseGoogleSyncModal,
  showCustomThemeModal = false,
  onCloseCustomThemeModal,
}: GoogleSyncSectionProps) {
  const { reloadProjects } = useProjectContext();

  return (
    <>
      {showGoogleSyncModal && (
        <Suspense fallback={null}>
          <GoogleSyncModal
            isOpen={showGoogleSyncModal}
            onClose={onCloseGoogleSyncModal}
            onDataChanged={reloadProjects}
          />
        </Suspense>
      )}

      {showCustomThemeModal && onCloseCustomThemeModal && (
        <Suspense fallback={null}>
          <CustomThemeModal
            open={showCustomThemeModal}
            onClose={onCloseCustomThemeModal}
          />
        </Suspense>
      )}
    </>
  );
}
