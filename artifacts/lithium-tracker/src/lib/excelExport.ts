import * as XLSX from "xlsx";
import type { MonthSummary } from "./excelProcessor";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function exportToExcel(
  monthlySummaries: MonthSummary[],
  manualLithium: Record<string, number>
) {
  const wb = XLSX.utils.book_new();

  const summaryData: (string | number)[][] = [
    ["Month", "Matched (kg)", "No Match (kg)", "Total (kg)", "Vehicles"],
  ];

  let grandMatched = 0, grandNoMatch = 0, grandTotal = 0, grandVehicles = 0;

  for (const s of monthlySummaries) {
    const matched = s.rows.filter(r => r.matchedCar !== undefined).reduce((a, r) => a + (r.lithiumKg ?? 0), 0);
    const noMatchRows = s.rows.filter(r => r.matchedCar === undefined);
    const noMatch = noMatchRows.reduce((a, r) => {
      const key = `${s.month}-${s.rows.indexOf(r)}`;
      return a + (manualLithium[key] ?? r.lithiumKg ?? 0);
    }, 0);
    const total = matched + noMatch;

    grandMatched += matched;
    grandNoMatch += noMatch;
    grandTotal += total;
    grandVehicles += s.rowCount;

    summaryData.push([s.monthName, matched, noMatch, total, s.rowCount]);
  }

  summaryData.push(["Grand Total", grandMatched, grandNoMatch, grandTotal, grandVehicles]);

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Monthly Summary");

  for (const s of monthlySummaries) {
    if (s.rowCount === 0) continue;

    const matchedRows = s.rows.filter(r => r.matchedCar !== undefined);
    if (matchedRows.length > 0) {
      const data: (string | number)[][] = [
        ["Car (File 1)", "Matched Car (File 2)", "Match %", "Battery (total Kg)"],
      ];
      let matchedTotal = 0;
      for (const r of matchedRows) {
        const li = r.lithiumKg ?? 0;
        matchedTotal += li;
        data.push([
          r.carName,
          r.matchedCar ?? "",
          r.matchScore !== undefined ? Math.round(r.matchScore * 100) : 0,
          li,
        ]);
      }
      data.push(["Total", "", "", matchedTotal]);

      const sheetName = `${MONTH_NAMES[s.month - 1].substring(0, 3)} Matched`;
      const sheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, sheet, sheetName);
    }

    const noMatchRows = s.rows.filter(r => r.matchedCar === undefined);
    if (noMatchRows.length > 0) {
      const data: (string | number)[][] = [
        ["Car (File 1)", "Battery (total Kg) - Manual"],
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

  XLSX.writeFile(wb, "EV-battery-calculation.xlsx");
}
