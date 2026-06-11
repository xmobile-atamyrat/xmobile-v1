import { interClassname } from '@/styles/theme';
import { VariantDisplay } from '@/pages/product/utils';
import { Box, Typography } from '@mui/material';

interface VariantBadgeProps extends VariantDisplay {
  fontSize?: number;
}

// Renders a selected variant as "<spec>" plus a small color circle (no name).
// The color name is exposed via the circle's tooltip for accessibility.
export default function VariantBadge({
  spec,
  colorHex,
  colorName,
  fontSize = 12,
}: VariantBadgeProps) {
  if (!spec && !colorHex) return null;
  return (
    <Box className="flex flex-row items-center gap-1.5">
      {spec && (
        <Typography
          className={interClassname.className}
          sx={{ fontSize, color: 'text.secondary' }}
        >
          {spec}
        </Typography>
      )}
      {colorHex && (
        <Box
          title={colorName ?? undefined}
          sx={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: '1px solid rgba(0,0,0,0.2)',
            backgroundColor: colorHex,
            flexShrink: 0,
          }}
        />
      )}
    </Box>
  );
}
