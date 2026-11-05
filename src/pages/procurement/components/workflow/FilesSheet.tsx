import { hasNativeFiles, sendFilesToApp } from '@/pages/lib/nativeFiles';
import ProcurementSheet from '@/pages/procurement/components/ProcurementSheet';
import { ReadyFiles } from '@/pages/procurement/components/workflow/useWorkflow';
import { downloadFiles, shareFiles } from '@/pages/procurement/lib/orderFiles';
import { useProcurement } from '@/pages/procurement/lib/ProcurementContext';
import { procurementClasses as c } from '@/styles/classMaps/procurement';
import { workflowClasses as w } from '@/styles/classMaps/procurement/workflow';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Typography } from '@mui/material';
import { FileSpreadsheet, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Phones only: the built workbooks, one row per store, each with its own
 * Share button so every store gets just its file (Telegram, WhatsApp, …).
 * Download stays as the fallback for when sharing isn't wanted or fails.
 */
export default function FilesSheet({
  ready,
  onClose,
}: {
  ready: ReadyFiles;
  onClose: () => void;
}) {
  const t = useTranslations();
  const { notify } = useProcurement();
  const files = ready.items.map(({ file }) => file);

  // Inside the mobile app the files go through the native bridge.
  const share = async (toShare: File[], title?: string) => {
    const status = hasNativeFiles()
      ? await sendFilesToApp('share', toShare, title)
      : await shareFiles(toShare, title);
    if (status === 'failed') notify('procurementShareFailed', 'error');
  };
  const download = async () => {
    if (!hasNativeFiles()) {
      await downloadFiles(files);
      return;
    }
    const status = await sendFilesToApp('save', files);
    if (status === 'failed') notify('procurementShareFailed', 'error');
    else if (status === 'saved') {
      // Android writes straight to Downloads/Xmobile; on iOS the user picked
      // the folder in the Files picker themselves.
      const android = /Android/i.test(navigator.userAgent);
      notify(
        android ? 'procurementFilesSavedDownloads' : 'procurementFilesSaved',
        'success',
      );
    }
  };

  return (
    <ProcurementSheet
      onClose={onClose}
      title={t('procurementFilesReady')}
      subtitle={t('procurementFilesReadyHint')}
      data-testid="procurement-files-sheet"
      footer={
        <>
          <ButtonBase
            disableRipple
            onClick={download}
            className={`${c.btnSecondary} ${w.footerBtn} ${fontClassName.className}`}
          >
            {t(files.length > 1 ? 'procurementDownloadAll' : 'download')}
          </ButtonBase>
          <ButtonBase
            disableRipple
            onClick={() => share(files)}
            className={`${c.btnPrimary} ${w.footerBtn} ${fontClassName.className}`}
          >
            {t(files.length > 1 ? 'procurementShareAll' : 'procurementShare')}
          </ButtonBase>
        </>
      }
    >
      <Box component="ul">
        {ready.items.map(({ file, supplierName, lines }, idx) => (
          <Box
            component="li"
            key={file.name}
            className={`${w.fileRow} ${idx > 0 ? w.fileRowBorder : ''}`}
          >
            <Box className={`${w.fileTile} ${w.fileTileNeutral}`} aria-hidden>
              <FileSpreadsheet className="w-5 h-5" />
            </Box>
            <Box className={w.fileText}>
              <Typography
                className={`${w.fileName} ${fontClassName.className}`}
              >
                {supplierName}
              </Typography>
              <Typography
                className={`${w.fileMeta} ${fontClassName.className}`}
              >
                {t('procurementProductCount', { count: lines })} · {file.name}
              </Typography>
            </Box>
            <ButtonBase
              disableRipple
              onClick={() => share([file], supplierName)}
              className={c.iconBtn}
              aria-label={`${t('procurementShare')}: ${supplierName}`}
            >
              <Share2 className={c.icon} />
            </ButtonBase>
          </Box>
        ))}
      </Box>
    </ProcurementSheet>
  );
}
