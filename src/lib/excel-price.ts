import ExcelJS from "exceljs";
import { stringifyCell } from "@/lib/json-path";
import { isDisplayableImage, uniqueUrls } from "@/lib/media";
import { writeMediaFile } from "@/lib/media-store";
import { matrixToTable } from "@/lib/parse-feed";

interface WorkbookMedia {
  buffer?: Buffer | Uint8Array;
  extension?: string;
  name?: string;
}

function cellHyperlink(cell: ExcelJS.Cell) {
  if (typeof cell.hyperlink === "string" && cell.hyperlink.trim()) return cell.hyperlink.trim();
  const value = cell.value;
  if (value && typeof value === "object" && "hyperlink" in value) {
    const href = (value as { hyperlink?: unknown }).hyperlink;
    if (typeof href === "string") return href.trim();
  }
  return "";
}

async function extractSheetImages(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, supplierId?: string) {
  const byExcelRow = new Map<number, string[]>();
  if (!supplierId) return byExcelRow;
  const media =
    ((workbook as unknown as { model?: { media?: WorkbookMedia[] } }).model?.media ?? []).filter(
      (item) => item?.buffer,
    );
  let pictures: { imageId: number | string; range?: { tl?: { nativeRow?: number; row?: number } } }[] = [];
  try {
    pictures =
      (
        sheet as unknown as {
          getImages?: () => { imageId: number | string; range?: { tl?: { nativeRow?: number; row?: number } } }[];
        }
      ).getImages?.() ?? [];
  } catch {
    pictures = [];
  }
  for (const [index, pic] of pictures.entries()) {
    const mediaIndex = Number(pic.imageId);
    const file = Number.isFinite(mediaIndex) ? media[mediaIndex] : undefined;
    if (!file?.buffer) continue;
    const nativeRow = pic.range?.tl?.nativeRow ?? pic.range?.tl?.row ?? 0;
    const excelRow = Number(nativeRow) + 1;
    const ext = (file.extension || "png").replace(/^\./, "") || "png";
    const url = await writeMediaFile(
      supplierId,
      `xl/${excelRow}-${index}.${ext}`,
      Buffer.from(file.buffer),
    );
    const list = byExcelRow.get(excelRow) ?? [];
    list.push(url);
    byExcelRow.set(excelRow, list);
  }
  return byExcelRow;
}

export async function parseExcelPrice(buffer: Buffer, supplierId?: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { table: matrixToTable([]), imagesByDataRow: new Map<number, string[]>(), fontsNoted: true };
  }

  const embedded = await extractSheetImages(workbook, sheet, supplierId);
  const matrix: string[][] = [];
  const excelRows: number[] = [];
  const hrefByExcelRow = new Map<number, string[]>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    const max = Math.max(row.cellCount, (Array.isArray(row.values) ? row.values.length - 1 : 0));
    for (let index = 1; index <= max; index += 1) {
      const cell = row.getCell(index);
      const text = stringifyCell(cell.value);
      const href = cellHyperlink(cell);
      if (href) {
        const list = hrefByExcelRow.get(rowNumber) ?? [];
        list.push(href);
        hrefByExcelRow.set(rowNumber, list);
      }
      cells.push(href && !text ? href : href && text && text !== href ? `${text} ${href}` : text);
    }
    if (cells.some((cell) => cell.trim())) {
      matrix.push(cells);
      excelRows.push(rowNumber);
    }
  });

  const table = matrixToTable(matrix, 400_000);
  const imagesByDataRow = new Map<number, string[]>();
  for (let dataIndex = 0; dataIndex < table.rows.length; dataIndex += 1) {
    const excelRow = excelRows[dataIndex + 1];
    if (!excelRow) continue;
    const urls = uniqueUrls([
      ...(embedded.get(excelRow) ?? []),
      ...(hrefByExcelRow.get(excelRow) ?? []).filter((item) => isDisplayableImage(item) || /^https?:/i.test(item)),
    ]);
    if (urls.length) imagesByDataRow.set(dataIndex, urls);
  }

  return { table, imagesByDataRow, fontsNoted: true };
}

export function isXlsxName(filename: string) {
  const lower = filename.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls");
}
