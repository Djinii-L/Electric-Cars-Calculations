import { useState, useCallback, useMemo } from "react";
import { parseInputFile, parseReferenceFile, MonthSummary, ProcessedRow, ReferenceRow, Category } from "@/lib/excelProcessor";
import { exportToExcel } from "@/lib/excelExport";

type Step = "upload" | "processing" | "results";

const CATEGORY_STYLE: Record<Category, { header: string; accent: string }> = {
  C2:      { header: "bg-violet-50 border-violet-200", accent: "text-violet-700" },
  C3:      { header: "bg-teal-50 border-teal-200",     accent: "text-teal-700" },
  "C2-C3": { header: "bg-amber-50 border-amber-200",   accent: "text-amber-700" },
  Other:   { header: "bg-gray-50 border-gray-200",     accent: "text-gray-500" },
};

const CATEGORIES: Category[] = ["C2", "C3", "C2-C3"];

function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileDropZone({
  label,
  description,
  file,
  onFile,
  accent,
}: {
  label: string;
  description: string;
  file: File | null;
  onFile: (f: File) => void;
  accent: string;
}) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
        dragging ? "border-blue-400 bg-blue-50" : file ? "border-green-400 bg-green-50" : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
      }`}
      onClick={() => document.getElementById(`file-input-${label}`)?.click()}
    >
      <input
        id={`file-input-${label}`}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${file ? "bg-green-100 text-green-600" : `bg-${accent}-100 text-${accent}-500`}`}>
        {file ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <UploadIcon />
        )}
      </div>
      <p className="font-semibold text-gray-800">{label}</p>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
      {file ? (
        <p className="text-sm font-medium text-green-600 mt-2">{file.name}</p>
      ) : (
        <p className="text-xs text-gray-400 mt-3">Drag & drop or click to browse</p>
      )}
    </div>
  );
}

function MatchBadge({ score }: { score?: number }) {
  if (score === undefined) return <span className="text-xs text-gray-400">—</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "bg-green-100 text-green-700" : pct >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-orange-100 text-orange-700";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{pct}%</span>;
}

function MonthCard({ summary, onClick, isSelected, extraLithium }: { summary: MonthSummary; onClick: () => void; isSelected: boolean; extraLithium: number }) {
  const displayTotal = summary.totalLithiumKg + extraLithium;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all hover:shadow-md ${
        isSelected ? "border-blue-500 bg-blue-50 shadow-md" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-900">{summary.monthName}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${summary.rowCount > 0 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
          {summary.rowCount} vehicles
        </span>
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold text-gray-900">
          {displayTotal.toFixed(2)}
        </span>
        <span className="text-sm text-gray-500 ml-1">kg Li</span>
      </div>
    </button>
  );
}

function VehicleTable({
  monthName,
  label,
  headerClass,
  accentClass,
  tableRows,
}: {
  monthName: string;
  label: string;
  headerClass: string;
  accentClass: string;
  tableRows: ProcessedRow[];
}) {
  const total = tableRows.reduce((s, r) => s + (r.lithiumKg ?? 0), 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className={`flex items-center justify-between px-6 py-3 border-b ${headerClass}`}>
        <h3 className="font-semibold text-gray-900">
          {monthName} — Vehicle Details{" "}
          <span className={`font-bold ${accentClass}`}>{label}</span>
        </h3>
        <span className="text-sm text-gray-500">
          {tableRows.length} vehicles
          {total > 0 && (
            <> · <span className={`font-semibold ${accentClass}`}>{total.toFixed(2)} kg</span></>
          )}
        </span>
      </div>

      {tableRows.length === 0 ? (
        <p className="text-center text-gray-400 py-6 text-sm">No vehicles in this category.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-4 text-gray-500 font-medium">Car (File 1)</th>
                <th className="text-left py-2 px-4 text-gray-500 font-medium">Matched Car (File 2)</th>
                <th className="text-center py-2 px-4 text-gray-500 font-medium">Match</th>
                <th className="text-right py-2 px-4 text-gray-500 font-medium">Lithium (kg)</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                  <td className="py-2 px-4 text-gray-800 font-medium">{row.carName}</td>
                  <td className="py-2 px-4 text-gray-600">
                    {row.matchedCar ?? <span className="text-gray-400 italic">No match</span>}
                  </td>
                  <td className="py-2 px-4 text-center"><MatchBadge score={row.matchScore} /></td>
                  <td className="py-2 px-4 text-right font-mono">
                    {row.lithiumKg !== undefined ? (
                      <span className="font-semibold text-gray-800">{row.lithiumKg.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {total > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-blue-50">
                  <td colSpan={3} className="py-2 px-4 font-semibold text-gray-700">Total</td>
                  <td className="py-2 px-4 text-right font-mono font-bold text-blue-700">
                    {total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

function CategoryTable({ monthName, category, rows }: { monthName: string; category: Category; rows: ProcessedRow[] }) {
  const style = CATEGORY_STYLE[category];
  return (
    <VehicleTable
      monthName={monthName}
      label={category}
      headerClass={style.header}
      accentClass={style.accent}
      tableRows={rows.filter((r) => r.category === category)}
    />
  );
}

function NoMatchTable({
  monthName,
  rows,
  month,
  allRows,
  manualLithium,
  onManualChange,
}: {
  monthName: string;
  rows: ProcessedRow[];
  month: number;
  allRows: ProcessedRow[];
  manualLithium: Record<string, number>;
  onManualChange: (key: string, value: number) => void;
}) {
  const noMatchRows = rows.filter((r) => r.matchedCar === undefined);
  const total = noMatchRows.reduce((s, r) => {
    const idx = allRows.indexOf(r);
    const key = `${month}-${idx}`;
    return s + (manualLithium[key] ?? 0);
  }, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b bg-pink-50 border-pink-200">
        <h3 className="font-semibold text-gray-900">
          {monthName} — Vehicle Details{" "}
          <span className="font-bold text-pink-600">No match</span>
        </h3>
        <span className="text-sm text-gray-500">
          {noMatchRows.length} vehicles
          {total > 0 && (
            <> · <span className="font-semibold text-pink-600">{total.toFixed(2)} kg</span></>
          )}
        </span>
      </div>

      {noMatchRows.length === 0 ? (
        <p className="text-center text-gray-400 py-6 text-sm">No vehicles in this category.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-4 text-gray-500 font-medium">Car (File 1)</th>
                <th className="text-right py-2 px-4 text-gray-500 font-medium">Lithium (kg) — enter manually</th>
              </tr>
            </thead>
            <tbody>
              {noMatchRows.map((row) => {
                const idx = allRows.indexOf(row);
                const key = `${month}-${idx}`;
                const val = manualLithium[key] ?? "";
                return (
                  <tr key={idx} className={`border-b border-gray-100 ${noMatchRows.indexOf(row) % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                    <td className="py-2 px-4 text-gray-800 font-medium">{row.carName}</td>
                    <td className="py-2 px-4 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={val}
                        onChange={(e) => {
                          const parsed = parseFloat(e.target.value);
                          onManualChange(key, isNaN(parsed) ? 0 : parsed);
                        }}
                        placeholder="0.00"
                        className="w-28 text-right font-mono border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {total > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-blue-50">
                  <td className="py-2 px-4 font-semibold text-gray-700">Total</td>
                  <td className="py-2 px-4 text-right font-mono font-bold text-blue-700">
                    {total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthSummary[]>([]);
  const [_references, setReferences] = useState<ReferenceRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [manualLithium, setManualLithium] = useState<Record<string, number>>({});

  const canProcess = inputFile && referenceFile;

  const handleProcess = async () => {
    if (!inputFile || !referenceFile) return;
    setStep("processing");
    setError(null);
    try {
      const refs = await parseReferenceFile(referenceFile);
      setReferences(refs);
      const { monthlySummaries: summaries } = await parseInputFile(inputFile, refs);
      setMonthlySummaries(summaries);
      const firstWithData = summaries.find((s) => s.rowCount > 0);
      setSelectedMonth(firstWithData?.month ?? 1);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setStep("upload");
    }
  };

  const handleReset = () => {
    setInputFile(null);
    setReferenceFile(null);
    setMonthlySummaries([]);
    setManualLithium({});
    setError(null);
    setStep("upload");
  };

  const handleManualChange = useCallback((key: string, value: number) => {
    setManualLithium((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleDownload = useCallback(() => {
    exportToExcel(monthlySummaries, manualLithium);
  }, [monthlySummaries, manualLithium]);

  const totalManualByMonth = useMemo(() => {
    const result: Record<number, number> = {};
    for (const s of monthlySummaries) {
      let manualTotal = 0;
      for (const r of s.rows) {
        if (r.matchedCar === undefined) {
          const idx = s.rows.indexOf(r);
          const key = `${s.month}-${idx}`;
          manualTotal += manualLithium[key] ?? 0;
        }
      }
      result[s.month] = manualTotal;
    }
    return result;
  }, [monthlySummaries, manualLithium]);

  const totalAllMonths = monthlySummaries.reduce((s, m) => s + m.totalLithiumKg + (totalManualByMonth[m.month] ?? 0), 0);
  const selectedSummary = monthlySummaries.find((s) => s.month === selectedMonth);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Calculation of EV batteries
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Total EV battery Weight based on EV-database.org</h1>
        </div>

        {step === "upload" && (
          <div className="max-w-2xl mx-auto">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                <strong>Error:</strong> {error}
              </div>
            )}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Upload Files</h2>
              <div className="space-y-4">
                <FileDropZone
                  label="File 1 — Input File"
                  description="Vehicle data with dates (Col B), car names (Col D), fuel type (Col E)"
                  file={inputFile}
                  onFile={setInputFile}
                  accent="blue"
                />
                <FileDropZone
                  label="File 2 — Reference File"
                  description="Car names (Col A), Lithium kg (Col D), category C2/C3/C2-C3 (Col G)"
                  file={referenceFile}
                  onFile={setReferenceFile}
                  accent="purple"
                />
              </div>

              <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <p className="font-semibold mb-1">Processing rules applied to File 1:</p>
                <ul className="list-disc list-inside space-y-1 text-amber-700">
                  <li>Column A is removed</li>
                  <li>Rows with "Benzin" or "Diesel" in Column E are excluded</li>
                  <li>Only rows where Column E is blank or "El" are kept</li>
                  <li>Dates in Column B (YYYY-MM-DD) are split into 12 months</li>
                  <li>Car names matched with ≥50% similarity to File 2</li>
                  <li>Each matched car is categorised (C2, C3, C2-C3) from Column G of File 2</li>
                </ul>
              </div>

              <button
                disabled={!canProcess}
                onClick={handleProcess}
                className={`mt-6 w-full py-3 px-6 rounded-xl font-semibold text-white transition-all ${
                  canProcess
                    ? "bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Analyse Files
              </button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="max-w-sm mx-auto text-center py-20">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Processing files...</h2>
            <p className="text-gray-500 mt-2">Cleaning, filtering, and matching car names</p>
          </div>
        )}

        {step === "results" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Results</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Total lithium across all months:{" "}
                  <span className="font-semibold text-blue-700">{totalAllMonths.toFixed(2)} kg</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="text-sm text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download Excel
                </button>
                <button
                  onClick={handleReset}
                  className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Upload New Files
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">Monthly Summary</h3>
                  <div className="space-y-2">
                    {monthlySummaries.map((summary) => (
                      <MonthCard
                        key={summary.month}
                        summary={summary}
                        onClick={() => setSelectedMonth(summary.month)}
                        isSelected={selectedMonth === summary.month}
                        extraLithium={totalManualByMonth[summary.month] ?? 0}
                      />
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-sm font-semibold text-gray-700">Grand Total</span>
                      <span className="font-bold text-blue-700 text-lg">{totalAllMonths.toFixed(2)} kg</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3 space-y-4">
                {CATEGORIES.map((cat) => (
                  <CategoryTable
                    key={cat}
                    monthName={selectedSummary?.monthName ?? ""}
                    category={cat}
                    rows={selectedSummary?.rows ?? []}
                  />
                ))}
                <NoMatchTable
                  monthName={selectedSummary?.monthName ?? ""}
                  rows={selectedSummary?.rows ?? []}
                  month={selectedMonth}
                  allRows={selectedSummary?.rows ?? []}
                  manualLithium={manualLithium}
                  onManualChange={handleManualChange}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
