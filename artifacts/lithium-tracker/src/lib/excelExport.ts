import * as XLSX from "xlsx";
import type { MonthSummary, Category } from "./excelProcessor";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const CATEGORIES: Category[] = ["C2", "C3", "C2-C3"];

export function exportToExcel(
  monthlySummaries: MonthSummary[],
  manualLithium: Record<string, number>
) {
  const wb = XLSX.utils.book_new();

  const summaryData: (string | number)[][] = [
    ["Month", "C2 (kg)", "C3 (kg)", "C2-C3 (kg)", "No Match (kg)", "Total (kg)", "Vehicles"],
  ];

  let grandC2 = 0, grandC3 = 0, grandC2C3 = 0, grandNoMatch = 0, grandTotal = 0, grandVehicles = 0;

  for (const s of monthlySummaries) {
    const c2 = s.rows.filter(r => r.category === "C2").reduce((a, r) => a + (r.lithiumKg ?? 0), 0);
    const c3 = s.rows.filter(r => r.category === "C3").reduce((a, r) => a + (r.lithiumKg ?? 0), 0);
    const c2c3 = s.rows.filter(r => r.category === "C2-C3").reduce((a, r) => a + (r.lithiumKg ?? 0), 0);
    const noMatchRows = s.rows.filter(r => r.matchedCar === undefined);
    const noMatch = noMatchRows.reduce((a, r) => {
      const key = `${s.month}-${s.rows.indexOf(r)}`;
      return a + (manualLithium[key] ?? r.lithiumKg ?? 0);
    }, 0);
    const total = c2 + c3 + c2c3 + noMatch;

    grandC2 += c2;
    grandC3 += c3;
    grandC2C3 += c2c3;
    grandNoMatch += noMatch;
    grandTotal += total;
    grandVehicles += s.rowCount;

    summaryData.push([s.monthName, c2, c3, c2c3, noMatch, total, s.rowCount]);
  }

  summaryData.push(["Grand Total", grandC2, grandC3, grandC2C3, grandNoMatch, grandTotal, grandVehicles]);

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Monthly Summary");

  for (const s of monthlySummaries) {
    if (s.rowCount === 0) continue;

    for (const cat of CATEGORIES) {
      const catRows = s.rows.filter(r => r.category === cat);
      if (catRows.length === 0) continue;

      const data: (string | number)[][] = [
        ["Car (File 1)", "Matched Car (File 2)", "Match %", "Lithium (kg)"],
      ];
      let catTotal = 0;
      for (const r of catRows) {
        const li = r.lithiumKg ?? 0;
        catTotal += li;
        data.push([
          r.carName,
          r.matchedCar ?? "",
          r.matchScore !== undefined ? Math.round(r.matchScore * 100) : 0,
          li,
        ]);
      }
      data.push(["Total", "", "", catTotal]);

      const sheetName = `${MONTH_NAMES[s.month - 1].substring(0, 3)} ${cat}`;
      const sheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, sheet, sheetName);
    }

    const noMatchRows = s.rows.filter(r => r.matchedCar === undefined);
    if (noMatchRows.length > 0) {
      const data: (string | number)[][] = [
        ["Car (File 1)", "Lithium (kg) - Manual"],
      ];
      let nmTotal = 0;
      for (const r of noMatchRows) {
        const idx = s.rows.indexOf(r);
        const key = `${s.month}-${idx}`;
        const li = manualLithium[key] ?? 0;
        nmTotal += li;
        data.push([r.carName, li]);
      }
      data.push(["Total", nmTotal]);

      const sheetName = `${MONTH_NAMES[s.month - 1].substring(0, 3)} No Match`;
      const sheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, sheet, sheetName);
    }
  }

  XLSX.writeFile(wb, "lithium-analysis.xlsx");
}
