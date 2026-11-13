/**
 * Service d'exportation de rapports PDF / Impression certifiée - BillShops (Hol Corporation)
 */

import { DailyReportSummary } from '../types/financial';
import { DbEstablishmentSettings } from '../types/database';
import { formatFC } from './financialCalculations';

export function generateDailyReportPrintHtml(
  report: DailyReportSummary,
  settings?: DbEstablishmentSettings | null
): string {
  const shopName = settings?.name || 'BillShops';
  const legalName = settings?.legal_name || 'Hol Corporation';
  const city = settings?.city || '';
  const headerSubtitle = [legalName, city].filter(Boolean).join(' • ');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport Financier — ${report.reportDate} — ${shopName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; margin: 30px; line-height: 1.4; }
    .header { border-bottom: 2px solid #7c3aed; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .brand { font-size: 24px; font-weight: 800; color: #111; }
    .brand span { color: #7c3aed; }
    .badge { background: #ede9fe; color: #6d28d9; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; }
    .meta { font-size: 13px; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px; }
    th { background: #f8fafc; text-align: left; padding: 8px 12px; font-size: 12px; font-weight: 700; border: 1px solid #e2e8f0; }
    td { padding: 8px 12px; font-size: 12px; border: 1px solid #e2e8f0; }
    .num { text-align: right; font-weight: 600; font-family: monospace; font-size: 13px; }
    .total-row { background: #faf5ff; font-weight: bold; }
    .total-row td { border-top: 2px solid #7c3aed; }
    .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; color: #777; text-align: center; }
    @media print {
      body { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Bill<span>Shops</span></div>
      <div class="meta">${headerSubtitle}</div>
    </div>
    <div style="text-align: right;">
      <span class="badge">RAPPORT JOURNALIER ${report.status === 'closed' ? 'CLÔTURÉ' : 'EN COURS'}</span>
      <div class="meta" style="margin-top: 5px;">Date : <strong>${report.reportDate}</strong></div>
    </div>
  </div>

  <h3 style="font-size: 14px; margin-bottom: 5px; color: #333;">1. Synthèse générale par activité</h3>
  <table>
    <thead>
      <tr>
        <th>Activité commerciale</th>
        <th style="text-align: right;">Volume / Chiffre Brut</th>
        <th style="text-align: right;">Dépenses</th>
        <th style="text-align: right;">Recette d'exploitation nette</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Bureautique (Activité principale)</strong></td>
        <td class="num">${formatFC(report.office.turnover)}</td>
        <td class="num" style="color: #dc2626;">-${formatFC(report.office.expenses)}</td>
        <td class="num" style="color: #059669;">${formatFC(report.office.netResult)}</td>
      </tr>
      <tr>
        <td><strong>Unités téléphoniques (4 réseaux)</strong></td>
        <td class="num">${formatFC(report.telecom.totalSoldUnits)}</td>
        <td class="num">-</td>
        <td class="num" style="color: #059669;">${formatFC(report.telecom.totalCashCollected)}</td>
      </tr>
      <tr>
        <td><strong>Frigos & Produits KongoTerra</strong></td>
        <td class="num">${formatFC(report.products.totalSales)}</td>
        <td class="num">-</td>
        <td class="num" style="color: #059669;">${formatFC(report.products.totalSales)}</td>
      </tr>
      <tr>
        <td><strong>Mobile Money (Commissions acquises)</strong></td>
        <td class="num">Dépôts: ${formatFC(report.money.totalDepositsVolume)} | Retraits: ${formatFC(report.money.totalWithdrawalsVolume)}</td>
        <td class="num">-</td>
        <td class="num" style="color: #059669;">${formatFC(report.money.totalEarnedCommissions)}</td>
      </tr>
      <tr class="total-row">
        <td><strong>TOTAL RECETTES D'EXPLOITATION</strong></td>
        <td colspan="2"></td>
        <td class="num" style="color: #6d28d9; font-size: 15px;">${formatFC(report.totalRevenue)}</td>
      </tr>
    </tbody>
  </table>

  <h3 style="font-size: 14px; margin-bottom: 5px; color: #333;">2. Contrôle et équilibrage des caisses</h3>
  <table>
    <thead>
      <tr>
        <th>Poste de contrôle</th>
        <th>État d'équilibrage</th>
        <th style="text-align: right;">Écart constaté</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Unités téléphoniques (Orange, Airtel, Africell, Vodacom)</td>
        <td>${report.telecom.hasAnyDiscrepancy ? '<span style="color: #d97706; font-weight: bold;">Écart détecté</span>' : '<span style="color: #059669;">Équilibré</span>'}</td>
        <td class="num">${formatFC(report.telecom.totalDiscrepancy)}</td>
      </tr>
      <tr>
        <td>Mobile Money (Caisse physique)</td>
        <td>${report.money.totalCashDiscrepancy !== 0 ? '<span style="color: #d97706; font-weight: bold;">Écart de caisse</span>' : '<span style="color: #059669;">Équilibré</span>'}</td>
        <td class="num">${formatFC(report.money.totalCashDiscrepancy)}</td>
      </tr>
      <tr>
        <td>Mobile Money (Portefeuille électronique)</td>
        <td>${report.money.totalEBalanceDiscrepancy !== 0 ? '<span style="color: #d97706; font-weight: bold;">Écart électronique</span>' : '<span style="color: #059669;">Équilibré</span>'}</td>
        <td class="num">${formatFC(report.money.totalEBalanceDiscrepancy)}</td>
      </tr>
    </tbody>
  </table>

  ${
    report.reopenJustification
      ? `<div style="background: #fffbeb; border: 1px solid #fde68a; padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 20px;">
          <strong>Historique de réouverture :</strong> ${report.reopenJustification}
        </div>`
      : ''
  }

  <div class="footer">
    ${shopName} — Système de gestion commerciale développé par Hol Corporation.<br/>
    Document généré le ${new Date().toLocaleString('fr-FR')} • Certifié conforme aux écritures comptables.
  </div>
</body>
</html>
  `;
}

export function exportReportToPdf(
  report: DailyReportSummary,
  settings?: DbEstablishmentSettings | null
) {
  const html = generateDailyReportPrintHtml(report, settings);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}
