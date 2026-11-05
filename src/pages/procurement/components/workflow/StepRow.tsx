import { workflowClasses as w } from '@/styles/classMaps/procurement/workflow';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Typography } from '@mui/material';
import { Check, LucideIcon } from 'lucide-react';

export interface StepModel {
  key: string;
  number: number;
  title: string;
  status: string;
  /** 'done' renders green, 'warn' amber, otherwise muted. */
  tone?: 'done' | 'warn';
  done: boolean;
  disabled: boolean;
  actionLabel: string;
  ActionIcon: LucideIcon;
  onAction: () => void;
}

/** Number badge · title + one-line status · action button. */
export default function StepRow({
  step,
  isNext,
  bordered,
}: {
  step: StepModel;
  isNext: boolean;
  bordered: boolean;
}) {
  const { ActionIcon } = step;
  let badgeClass = w.badgeIdle;
  if (step.done) badgeClass = w.badgeDone;
  else if (isNext) badgeClass = w.badgeNext;
  let statusClass = w.stepStatus;
  if (step.tone === 'done') statusClass = w.stepStatusDone;
  else if (step.tone === 'warn') statusClass = w.stepStatusWarn;

  return (
    <Box
      component="li"
      className={`${w.step} ${bordered ? w.stepBorder : ''}`}
      data-testid={`procurement-step-${step.key}`}
      data-done={step.done ? 'true' : 'false'}
    >
      <Box
        className={`${w.badge} ${badgeClass} ${fontClassName.className}`}
        aria-hidden
      >
        {step.done ? (
          <Check className="w-4 h-4" strokeWidth={3} />
        ) : (
          step.number
        )}
      </Box>
      <Box className={w.stepText}>
        <Typography
          component="h3"
          className={`${w.stepTitle} ${fontClassName.className}`}
        >
          {step.title}
        </Typography>
        <Typography className={`${statusClass} ${fontClassName.className}`}>
          {step.status}
        </Typography>
      </Box>
      <ButtonBase
        disableRipple
        disabled={step.disabled}
        onClick={step.onAction}
        className={`${w.action} ${
          isNext && !step.disabled ? w.actionPrimary : w.actionSoft
        } ${fontClassName.className}`}
      >
        <ActionIcon className={w.actionIcon} aria-hidden />
        {step.actionLabel}
      </ButtonBase>
    </Box>
  );
}
