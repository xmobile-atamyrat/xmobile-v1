import * as ExcelJS from 'exceljs';

// Top-level categories get the solid brand navy, subcategories a tint of it, so
// a scan down the sheet shows where one section ends and how deep it sits.
export const ROOT_BANNER_FILL = 'FF221765';
export const NESTED_BANNER_FILL = 'FFD9D4EC';
export const HEADER_FILL = 'FFF2F2F2';

export const PATH_SEPARATOR = ' > ';

/**
 * Tints a whole row rather than just the cell holding the text, so the colour
 * reads as a band across the sheet and survives viewers that drop cell merges.
 */
export function fillRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  lastColumn: number,
  argb: string,
) {
  for (let column = 1; column <= lastColumn; column += 1) {
    sheet.getCell(row, column).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb },
    };
  }
}

/** Bold, and legible against whichever banner fill the depth selected. */
export function bannerFont(isRoot: boolean): Partial<ExcelJS.Font> {
  return {
    bold: true,
    color: { argb: isRoot ? 'FFFFFFFF' : ROOT_BANNER_FILL },
  };
}
