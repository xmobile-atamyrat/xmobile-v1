import ProcurementSheet from '@/pages/procurement/components/ProcurementSheet';
import { UploadResult } from '@/pages/procurement/lib/orderFiles';
import { procurementClasses as c } from '@/styles/classMaps/procurement';
import { workflowClasses as w } from '@/styles/classMaps/procurement/workflow';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Typography } from '@mui/material';
import { Calculator, FileCheck2, FileX2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

const errorKey = {
  unreadable: 'procurementFileUnreadable',
  notThisOrder: 'procurementFileOtherOrder',
  noPrices: 'procurementFileNoPrices',
} as const;

/** What an upload did: per file, how many prices it brought or why not. */
export default function UploadResultSheet({
  result,
  supplierName,
  onClose,
  onCalculate,
}: {
  result: UploadResult;
  supplierName: (id?: string) => string | undefined;
  onClose: () => void;
  onCalculate: () => void;
}) {
  const t = useTranslations();
  const read = result.files.filter(({ error }) => !error).length;
  const imported = result.files.reduce((sum, f) => sum + f.imported, 0);

  return (
    <ProcurementSheet
      onClose={onClose}
      title={t('procurementUploadResult')}
      subtitle={t('procurementUploadSummary', {
        files: read,
        total: result.files.length,
        prices: imported,
      })}
      data-testid="procurement-upload-result"
      footer={
        <>
          <ButtonBase
            disableRipple
            onClick={onClose}
            className={`${c.btnSecondary} ${w.footerBtn} ${fontClassName.className}`}
          >
            {t('close')}
          </ButtonBase>
          {imported > 0 && (
            <ButtonBase
              disableRipple
              onClick={onCalculate}
              className={`${c.btnPrimary} ${w.footerBtn} ${fontClassName.className}`}
            >
              <Calculator className={c.icon} aria-hidden />
              {t('calculate')}
            </ButtonBase>
          )}
        </>
      }
    >
      <Box component="ul">
        {result.files.map((file, idx) => {
          const Icon = file.error ? FileX2 : FileCheck2;
          return (
            <Box
              component="li"
              // eslint-disable-next-line react/no-array-index-key
              key={`${file.fileName}-${idx}`}
              className={`${w.fileRow} ${idx > 0 ? w.fileRowBorder : ''}`}
            >
              <Box
                className={`${w.fileTile} ${
                  file.error ? w.fileTileError : w.fileTileOk
                }`}
                aria-hidden
              >
                <Icon className="w-5 h-5" />
              </Box>
              <Box className={w.fileText}>
                <Typography
                  className={`${w.fileName} ${fontClassName.className}`}
                >
                  {supplierName(file.supplierId) ?? file.fileName}
                </Typography>
                <Typography
                  className={`${
                    file.error ? w.fileMetaError : w.fileMeta
                  } ${fontClassName.className}`}
                >
                  {file.error
                    ? t(errorKey[file.error])
                    : t('procurementPricesImported', { count: file.imported })}
                </Typography>
                {supplierName(file.supplierId) != null && (
                  <Typography
                    className={`${w.fileMeta} ${fontClassName.className}`}
                  >
                    {file.fileName}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </ProcurementSheet>
  );
}
