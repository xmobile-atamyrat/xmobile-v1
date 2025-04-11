import JSZip from 'jszip'; // TODO: install when the mf VPN starts working

export interface CsvFileData {
  data: (string | number)[][];
  filename: string;
}

function escapeCsvCellTs(cell: any): string {
  if (cell == null) {
    return '';
  }
  const cellString = String(cell);
  const needsQuoting =
    cellString.includes(',') ||
    cellString.includes('"') ||
    cellString.includes('\n') ||
    cellString.includes('\r');

  if (needsQuoting) {
    const escapedString = cellString.replace(/"/g, '""');
    return `"${escapedString}"`;
  }
  return cellString;
}

function arrayToCsvTs(data: (string | number)[][]): string {
  if (!Array.isArray(data) || !data.every(Array.isArray)) {
    console.error('Input data must be a 2D array.');
    return '';
  }
  try {
    return data.map((row) => row.map(escapeCsvCellTs).join(',')).join('\n');
  } catch (error) {
    console.error('Error converting array to CSV:', error);
    return '';
  }
}

export async function downloadCsvAsZip(
  files: CsvFileData[],
  zipFilename: string = 'archive.zip',
): Promise<void> {
  if (!files || files.length === 0) {
    console.error('No files provided to zip.');
    return;
  }

  if (!zipFilename.toLowerCase().endsWith('.zip')) {
    zipFilename += '.zip';
  }

  const zip = new JSZip();

  files.map((fileInfo) => {
    if (
      !fileInfo ||
      typeof fileInfo !== 'object' ||
      !fileInfo.filename ||
      !Array.isArray(fileInfo.data)
    ) {
      console.warn('Skipping invalid file data structure:', fileInfo);
      return fileInfo;
    }

    let filename = fileInfo.filename;
    if (!filename.toLowerCase().endsWith('.csv')) {
      filename += '.csv';
    }

    const csvString = arrayToCsvTs(fileInfo.data);
    if (csvString) {
      zip.file(filename, csvString);
    } else {
      console.warn(
        `Failed to convert data to CSV for ${filename}. Skipping file.`,
      );
    }
    return fileInfo;
  });

  if (Object.keys(zip.files).length === 0) {
    console.error('No valid files could be added to the zip archive.');
    return;
  }

  try {
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6,
      },
    });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', zipFilename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating or downloading the zip file:', error);
  }
}
