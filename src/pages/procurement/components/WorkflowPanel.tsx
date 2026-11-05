import { usePlatform } from '@/pages/lib/PlatformContext';
import FilesSheet from '@/pages/procurement/components/workflow/FilesSheet';
import StepRow, {
  StepModel,
} from '@/pages/procurement/components/workflow/StepRow';
import UploadResultSheet from '@/pages/procurement/components/workflow/UploadResultSheet';
import { useWorkflow } from '@/pages/procurement/components/workflow/useWorkflow';
import { XLSX_MIME_TYPE } from '@/pages/procurement/lib/utils';
import { workflowClasses as w } from '@/styles/classMaps/procurement/workflow';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Typography } from '@mui/material';
import {
  Calculator,
  ChevronDown,
  Download,
  Share2,
  Upload,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

/** Whether this browser can hand .xlsx files to the system share sheet. */
function useCanShareXlsx() {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    try {
      const probe = new File([''], 'probe.xlsx', { type: XLSX_MIME_TYPE });
      setCanShare(
        typeof navigator.share === 'function' &&
          navigator.canShare?.({ files: [probe] }) === true,
      );
    } catch {
      setCanShare(false);
    }
  }, []);
  return canShare;
}

/**
 * The four file steps — empty files → upload filled → calculate → final
 * files — as a numbered card that's always visible (they used to hide in an
 * "Actions" menu). Reads everything from useProcurement(); takes no props.
 *
 * Phones: folded to the progress bar + the next step, because the products
 * list is what superusers come back to most and four rows (~260px) would push
 * it below the fold on a 390x844 screen. One tap shows all steps (any step
 * can be re-run, e.g. a late file from one store). Desktop: always open.
 */
export default function WorkflowPanel(): JSX.Element | null {
  const t = useTranslations();
  const platform = usePlatform();
  const isMobile = platform === 'mobile';
  const wf = useWorkflow();
  const canShare = useCanShareXlsx();
  const [expanded, setExpanded] = useState(false);

  if (!wf.hasOrder) return null;

  const { stats } = wf;
  const share = isMobile && canShare;
  const fileAction = {
    actionLabel: t(share ? 'procurementShare' : 'download'),
    ActionIcon: share ? Share2 : Download,
  };
  let missing: string | undefined;
  if (wf.stores === 0) missing = t('procurementNeedSuppliers');
  else if (wf.products === 0) missing = t('procurementNeedProducts');
  const uploaded = stats.filled > 0;
  const calculated = stats.cheapest > 0;

  let calculateStatus = t('procurementStepCalculateHint');
  let calculateTone: StepModel['tone'];
  if (!uploaded) calculateStatus = t('procurementNeedPrices');
  else if (calculated && stats.stale) {
    calculateStatus = t('procurementPricesChanged');
    calculateTone = 'warn';
  } else if (calculated) {
    calculateStatus = t('procurementCheapestFound', {
      found: stats.cheapest,
      total: stats.linesToOrder,
    });
    calculateTone = 'done';
  }

  const steps: StepModel[] = [
    {
      key: 'empty',
      number: 1,
      title: t('procurementStepEmptyFiles'),
      status:
        missing ??
        (stats.linesToOrder === 0
          ? t('allQuantitiesZero')
          : t('procurementStepEmptyFilesInfo', {
              stores: wf.stores,
              products: stats.linesToOrder,
            })),
      done: wf.sentEmpty || uploaded,
      disabled: missing != null || stats.linesToOrder === 0,
      ...fileAction,
      onAction: wf.downloadEmpty,
    },
    {
      key: 'upload',
      number: 2,
      title: t('procurementStepUpload'),
      status:
        missing ??
        (uploaded
          ? t('procurementStepPricesFilled', {
              filled: stats.filled,
              total: stats.cells,
            })
          : t('procurementStepUploadHint')),
      tone: uploaded && !missing ? 'done' : undefined,
      done: uploaded,
      disabled: missing != null,
      actionLabel: t('procurementUpload'),
      ActionIcon: Upload,
      onAction: wf.chooseFiles,
    },
    {
      key: 'calculate',
      number: 3,
      title: t('calculate'),
      status: calculateStatus,
      tone: calculateTone,
      done: calculated && !stats.stale,
      disabled: !uploaded,
      actionLabel: t('calculate'),
      ActionIcon: Calculator,
      onAction: wf.calculate,
    },
    {
      key: 'final',
      number: 4,
      title: t('procurementStepFinalFiles'),
      status:
        stats.finalFiles === 0
          ? t('procurementNeedCalculate')
          : t('procurementFinalFilesInfo', {
              files: stats.finalFiles,
              products: stats.finalLines,
            }),
      done: wf.sentFinal,
      disabled: stats.finalFiles === 0,
      ...fileAction,
      onAction: wf.downloadFinal,
    },
  ];

  const doneCount = steps.filter(({ done }) => done).length;
  const firstOpen = steps.findIndex(({ done }) => !done);
  const nextIndex = firstOpen === -1 ? steps.length - 1 : firstOpen;
  const showAll = !isMobile || expanded;
  const visible = showAll ? steps : [steps[nextIndex]];

  const headerContent = (
    <>
      <Typography
        component="h2"
        className={`${w.title} ${fontClassName.className}`}
      >
        {t('procurementWorkflowTitle')}
      </Typography>
      <Typography className={`${w.progressText} ${fontClassName.className}`}>
        {t('procurementStepsDone', { done: doneCount, total: steps.length })}
      </Typography>
    </>
  );

  return (
    <Box
      component="section"
      className={w.card[platform]}
      data-testid="procurement-workflow"
    >
      {isMobile ? (
        <ButtonBase
          disableRipple
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-label={t(
            expanded ? 'procurementHideSteps' : 'procurementShowAllSteps',
          )}
          className={`${w.header} ${fontClassName.className}`}
        >
          {headerContent}
          <Box
            component="span"
            className={`${w.toggle} ${expanded ? w.toggleOpen : ''}`}
            aria-hidden
          >
            <ChevronDown className="w-5 h-5" />
          </Box>
        </ButtonBase>
      ) : (
        <Box className={w.header}>{headerContent}</Box>
      )}

      <Box className={w.progress} aria-hidden>
        {steps.map((step) => (
          <Box
            key={step.key}
            className={`${w.progressSegment} ${
              step.done ? w.progressDone : w.progressTodo
            }`}
          />
        ))}
      </Box>

      <Box component="ol">
        {visible.map((step, idx) => (
          <StepRow
            key={step.key}
            step={step}
            isNext={step.number - 1 === nextIndex}
            bordered={idx > 0}
          />
        ))}
      </Box>

      <input
        ref={wf.fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        multiple
        hidden
        onChange={wf.onFilesChosen}
        data-testid="procurement-upload-input"
      />

      {wf.uploadResult && (
        <UploadResultSheet
          result={wf.uploadResult}
          supplierName={wf.supplierName}
          onClose={wf.closeUploadResult}
          onCalculate={() => {
            wf.closeUploadResult();
            wf.calculate();
          }}
        />
      )}
      {wf.readyFiles && (
        <FilesSheet ready={wf.readyFiles} onClose={wf.closeReadyFiles} />
      )}
    </Box>
  );
}
