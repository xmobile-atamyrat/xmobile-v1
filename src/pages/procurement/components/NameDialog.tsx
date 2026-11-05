import ProcurementSheet from '@/pages/procurement/components/ProcurementSheet';
import {
  procurementClasses as c,
  procurementFieldSx,
} from '@/styles/classMaps/procurement';
import { fontClassName } from '@/styles/theme';
import { ButtonBase, CircularProgress, TextField } from '@mui/material';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';

interface NameDialogProps {
  title: string;
  /** Prefills the field (edit). Omit for create. */
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  /** Visible label above the name field (used when `secondField` is set). */
  label?: string;
  /** Optional extra free-text field (e.g. a supplier's note); may be empty. */
  secondField?: { label: string; initialValue?: string; placeholder?: string };
  onClose: () => void;
  /** Resolve truthy/void to close; the dialog stays open if it throws. */
  onSubmit: (value: string, secondValue?: string) => Promise<void> | void;
}

const fieldLabelClass = 'block text-[13px] font-semibold text-muted mb-[6px]';

/**
 * One text field + Cancel/Save, used for naming an order and renaming a
 * product or supplier. Enter submits; empty input is blocked inline.
 */
export default function NameDialog({
  title,
  initialValue = '',
  placeholder,
  submitLabel,
  label,
  secondField,
  onClose,
  onSubmit,
}: NameDialogProps) {
  const t = useTranslations();
  const [value, setValue] = useState(initialValue);
  const [secondValue, setSecondValue] = useState(
    secondField?.initialValue ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const trimmed = value.trim();
  const invalid = touched && trimmed === '';

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setTouched(true);
    if (trimmed === '' || saving) return;
    setSaving(true);
    try {
      if (secondField) await onSubmit(trimmed, secondValue.trim());
      else await onSubmit(trimmed);
      onClose();
    } catch {
      // Stay open so the name isn't lost; the api utils already showed a toast.
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProcurementSheet
      onClose={onClose}
      title={title}
      footer={
        <>
          <ButtonBase
            disableRipple
            onClick={onClose}
            className={`${c.btnSecondary} flex-1 ${fontClassName.className}`}
          >
            {t('cancel')}
          </ButtonBase>
          <ButtonBase
            disableRipple
            onClick={() => submit()}
            disabled={saving}
            className={`${c.btnPrimary} flex-1 ${fontClassName.className}`}
          >
            {saving ? (
              <CircularProgress size={20} sx={{ color: '#fff' }} />
            ) : (
              submitLabel ?? t('save')
            )}
          </ButtonBase>
        </>
      }
    >
      <form onSubmit={submit}>
        {label && (
          <span className={`${fieldLabelClass} ${fontClassName.className}`}>
            {label}
          </span>
        )}
        <TextField
          autoFocus
          fullWidth
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          error={invalid}
          helperText={invalid ? t('emptyField') : undefined}
          sx={procurementFieldSx}
          inputProps={{ 'aria-label': label ?? title }}
        />
        {secondField && (
          <>
            <span
              className={`${fieldLabelClass} mt-4 ${fontClassName.className}`}
            >
              {secondField.label}
            </span>
            <TextField
              fullWidth
              multiline
              minRows={2}
              value={secondValue}
              placeholder={secondField.placeholder}
              onChange={(e) => setSecondValue(e.target.value)}
              sx={{
                ...procurementFieldSx,
                // Multiline pads the root, not the textarea; keep one 12px inset.
                '& .MuiInputBase-root': { py: '12px' },
                '& .MuiInputBase-input': { py: 0 },
              }}
              inputProps={{ 'aria-label': secondField.label }}
            />
          </>
        )}
      </form>
    </ProcurementSheet>
  );
}
