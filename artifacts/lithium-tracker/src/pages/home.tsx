import { useState, useCallback } from "react";
import { parseInputFile, parseReferenceFile, MonthSummary, ProcessedRow, ReferenceRow, Category } from "@/lib/excelProcessor";

type Step = "upload" | "processing" | "results";

const CATEGORY_COLORS: Record<Category, { bg: string; text: string; dot: string }> = {
  C2:      { bg: "bg-violet-100",  text: "text-violet-700",  dot: "bg-violet-500" },
  C3:      { bg: "bg-teal-100",    text: "text-teal-700",    dot: "bg-teal-500" },
  "C2-C3": { bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500" },
  Other:   { bg: "bg-gray-100",    text: "text-gray-500",    dot: "bg-gray-400" },
};

function CategoryPill({ category }: { category: Category }) {
  const c = CATEGORY_COLORS[category];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {category}
    </span>
  );
}

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

function MonthCard({ summary, onClick, isSelected }: { summary: MonthSummary; onClick: () => void; isSelected: boolean }) {
  const cats: Category[] = ["C2", "C3", "C2-C3"];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all hover:shadow-md ${
        isSelected ? "border-blue-500 bg-blue-50 shadow-md" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-900">{summary.monthName}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${summary.rowCount > 0 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
          {summary.rowCount} vehicles
        </span>
      </div>
      <div className="mb-3">
        <span className="text-xl font-bold text-gray-900">{summary.totalLithiumKg.toFixed(2)}</span>
        <span className="text-sm text-gray-500 ml-1">kg Li total</span>
      </div>
      <div className="space-y-1">
        {cats.map((cat) => {
          const bd = summary.byCategory[cat];
          const c = CATEGORY_COLORS[cat];
          return (
            <div key={cat} className="flex items-center justify-between text-xs">
              <span className={`flex items-center gap-1 font-medium ${c.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {cat}
                <span className="text-gray-400 font-normal">({bd.count})</span>
              </span>
              <span className="font-mono text-gray-600">{bd.lithiumKg.toFixed(2)} kg</span>
            </div>
          );
        })}
      </div>
    </button>
  );
}

type CategoryFilter = "All" | Category;

function RowsTable({ rows }: { rows: ProcessedRow[] }) {
  const [filter, setFilter] = useState<CategoryFilter>("All");

  const filteredRows = filter === "All" ? rows : rows.filter((r) => r.category === filter);

  if (rows.length === 0) {
    return <p className="text-center text-gray-400 py-8">No vehicles found for this month.</p>;
  }

  const cats: CategoryFilter[] = ["All", "C2", "C3", "C2-C3", "Other"];

  return (
    <div>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {cats.map((cat) => {
          const count = cat === "All" ? rows.length : rows.filter((r) => r.category === cat).length;
          if (count === 0 && cat !== "All") return null;
          const active = filter === cat;
          const c = cat === "All" ? null : CATEGORY_COLORS[cat as Category];
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                active
                  ? c ? `${c.bg} ${c.text} border-transparent` : "bg-blue-600 text-white border-transparent"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              {cat} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-gray-500 font-medium">Category</th>
              <th className="text-left py-2 px-3 text-gray-500 font-medium">Car (File 1)</th>
              <th className="text-left py-2 px-3 text-gray-500 font-medium">Matched Car (File 2)</th>
              <th className="text-center py-2 px-3 text-gray-500 font-medium">Match</th>
              <th className="text-right py-2 px-3 text-gray-500 font-medium">Lithium (kg)</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => (
              <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                <td className="py-2 px-3"><CategoryPill category={row.category} /></td>
                <td className="py-2 px-3 text-gray-800 font-medium">{row.carName}</td>
                <td className="py-2 px-3 text-gray-600">{row.matchedCar ?? <span className="text-gray-400 italic">No match</span>}</td>
                <td className="py-2 px-3 text-center"><MatchBadge score={row.matchScore} /></td>
                <td className="py-2 px-3 text-right font-mono">
                  {row.lithiumKg !== undefined ? (
                    <span className="font-semibold text-gray-800">{row.lithiumKg.toFixed(2)}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-blue-50">
              <td colSpan={4} className="py-2 px-3 font-semibold text-gray-700">
                Total ({filteredRows.length} vehicles)
              </td>
              <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">
                {filteredRows.reduce((s, r) => s + (r.lithiumKg ?? 0), 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function GrandTotalRow({ summaries }: { summaries: MonthSummary[] }) {
  const cats: Category[] = ["C2", "C3", "C2-C3"];
  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-sm font-bold text-gray-700">Grand Total</span>
        <span className="font-bold text-blue-700 text-lg">
          {summaries.reduce((s, m) => s + m.totalLithiumKg, 0).toFixed(2)} kg
        </span>
      </div>
      {cats.map((cat) => {
        const total = summaries.reduce((s, m) => s + m.byCategory[cat].lithiumKg, 0);
        const count = summaries.reduce((s, m) => s + m.byCategory[cat].count, 0);
        const c = CATEGORY_COLORS[cat];
        return (
          <div key={cat} className="flex items-center justify-between px-1 text-xs">
            <span className={`flex items-center gap-1 font-medium ${c.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              {cat}
              <span className="text-gray-400 font-normal">({count} vehicles)</span>
            </span>
            <span className="font-mono text-gray-600">{total.toFixed(2)} kg</span>
          </div>
        );
      })}
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
    setError(null);
    setStep("upload");
  };

  const totalAllMonths = monthlySummaries.reduce((s, m) => s + m.totalLithiumKg, 0);
  const selectedSummary = monthlySummaries.find((s) => s.month === selectedMonth);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            EV Lithium Analysis
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Lithium Tracker</h1>
          <p className="text-gray-500 mt-2 text-lg">
            Upload your vehicle and reference files to calculate lithium (kg) by month and category
          </p>
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
                  description="Vehicle data with dates (Col B), car names (Col D), fuel type (Col E), category (Col G)"
                  file={inputFile}
                  onFile={setInputFile}
                  accent="blue"
                />
                <FileDropZone
                  label="File 2 — Reference File"
                  description="Car names (Col A) with Lithium (kg) values (Col B)"
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
                  <li>Column G is read and split into categories: C2, C3, C2-C3</li>
                  <li>Car names matched with ≥50% similarity to File 2</li>
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
            <p className="text-gray-500 mt-2">Cleaning, filtering, categorising, and matching car names</p>
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
              <button
                onClick={handleReset}
                className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Upload New Files
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                      />
                    ))}
                  </div>
                  <GrandTotalRow summaries={monthlySummaries} />
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">
                      {selectedSummary?.monthName} — Vehicle Details
                    </h3>
                    <span className="text-sm text-gray-500">
                      {selectedSummary?.rowCount ?? 0} vehicles ·{" "}
                      <span className="font-semibold text-blue-700">
                        {(selectedSummary?.totalLithiumKg ?? 0).toFixed(2)} kg
                      </span>
                    </span>
                  </div>
                  <RowsTable rows={selectedSummary?.rows ?? []} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
