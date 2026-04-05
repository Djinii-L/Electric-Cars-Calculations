import * as XLSX from "xlsx";

export type Category = "C2" | "C3" | "C2-C3" | "Other";

export interface ProcessedRow {
  month: number;
  category: Category;
  carName: string;
  rawDate: string;
  matchedCar?: string;
  lithiumKg?: number;
  matchScore?: number;
}

export interface ReferenceRow {
  carName: string;
  lithiumKg: number;
  category: Category;
}

export interface MonthSummary {
  month: number;
  monthName: string;
  totalLithiumKg: number;
  rowCount: number;
  rows: ProcessedRow[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function normalizeCategory(raw: string): Category {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (s === "C2-C3" || s === "C2C3") return "C2-C3";
  if (s === "C2") return "C2";
  if (s === "C3") return "C3";
  return "Other";
}

function normalizeCarName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeCarName(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeCarName(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared++;
  }

  const unionSize = tokensA.size + tokensB.size - shared;
  return shared / unionSize;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function stringSimilarity(a: string, b: string): number {
  const na = normalizeCarName(a);
  const nb = normalizeCarName(b);
  if (na === nb) return 1;

  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  const levScore = 1 - levenshtein(na, nb) / maxLen;
  const tokenScore = tokenSimilarity(a, b);

  return (levScore + tokenScore) / 2;
}

export function findBestMatch(
  carName: string,
  references: ReferenceRow[],
  threshold = 0.5
): { ref: ReferenceRow; score: number } | null {
  let best: { ref: ReferenceRow; score: number } | null = null;

  for (const ref of references) {
    const score = stringSimilarity(carName, ref.carName);
    if (score >= threshold && (!best || score > best.score)) {
      best = { ref, score };
    }
  }

  return best;
}

export function parseReferenceFile(file: File): Promise<ReferenceRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];

        const result: ReferenceRow[] = [];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const carName = String(row[0] ?? "").trim();
          const lithiumRaw = row[3];
          const lithiumKg = typeof lithiumRaw === "number" ? lithiumRaw : parseFloat(String(lithiumRaw ?? ""));
          const categoryRaw = String(row[6] ?? "").trim();

          if (!carName || carName === "" || isNaN(lithiumKg)) continue;
          result.push({ carName, lithiumKg, category: normalizeCategory(categoryRaw) });
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read reference file"));
    reader.readAsBinaryString(file);
  });
}

export function parseInputFile(
  file: File,
  references: ReferenceRow[]
): Promise<{ rows: ProcessedRow[]; monthlySummaries: MonthSummary[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];

        const processedRows: ProcessedRow[] = [];

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;

          const colD = String(row[3] ?? "").trim();
          const colF = String(row[5] ?? "").trim();
          const colG = String(row[6] ?? "").trim().toLowerCase();

          if (colG === "benzin" || colG === "diesel") continue;
          if (colG !== "" && colG !== "el") continue;

          if (!colD || !colF) continue;

          let month: number | null = null;
          const dateMatch = colD.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dateMatch) {
            month = parseInt(dateMatch[2], 10);
          } else {
            const excelNum = parseFloat(colD);
            if (!isNaN(excelNum)) {
              const jsDate = new Date(Math.round((excelNum - 25569) * 86400 * 1000));
              month = jsDate.getUTCMonth() + 1;
            }
          }

          if (!month || month < 1 || month > 12) continue;

          const match = findBestMatch(colF, references);
          const processed: ProcessedRow = {
            month,
            category: match?.ref.category ?? "Other",
            carName: colF,
            rawDate: colD,
            matchedCar: match?.ref.carName,
            lithiumKg: match?.ref.lithiumKg,
            matchScore: match?.score,
          };
          processedRows.push(processed);
        }

        const monthlySummaries: MonthSummary[] = Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const monthRows = processedRows.filter((r) => r.month === m);
          const totalLithiumKg = monthRows.reduce((sum, r) => sum + (r.lithiumKg ?? 0), 0);
          return {
            month: m,
            monthName: MONTH_NAMES[i],
            totalLithiumKg,
            rowCount: monthRows.length,
            rows: monthRows,
          };
        });

        resolve({ rows: processedRows, monthlySummaries });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read input file"));
    reader.readAsBinaryString(file);
  });
}
