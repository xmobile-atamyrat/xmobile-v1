import { fontClassName } from '@/styles/theme';
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
    // Specs are merchant-authored and often repeat the whole product name, so this
    // has to wrap inside whatever column it lands in. The swatch is inline rather
    // than a flex sibling so it trails the last wrapped line instead of being
    // parked at the far right of a full-width paragraph.
    <Typography
      component="p"
      className={fontClassName.className}
      sx={{
        fontSize,
        fontWeight: 500,
        color: '#8B8A98',
        minWidth: 0,
        maxWidth: '100%',
        overflowWrap: 'anywhere',
      }}
    >
      {spec}
      {colorHex && (
        <Box
          component="span"
          title={colorName ?? undefined}
          sx={{
            display: 'inline-block',
            verticalAlign: 'middle',
            marginLeft: spec ? '6px' : 0,
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: '1px solid #ECECF1',
            backgroundColor: colorHex,
          }}
        />
      )}
    </Typography>
  );
}
