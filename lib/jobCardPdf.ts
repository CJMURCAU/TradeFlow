import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { Job, Client, JobInventoryItem, TimeEntry, BusinessDetails, Employee } from './supabase';

type JobCardData = {
  job: Job & { client?: Client };
  inventoryItems: JobInventoryItem[];
  timeEntries: TimeEntry[];
  business: BusinessDetails | null;
  employees: Employee[];
};

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function buildJobCardHtml(data: JobCardData): string {
  const { job, inventoryItems, timeEntries, business, employees } = data;
  const client = job.client;

  const defaultRate = business?.default_hourly_rate ?? 0;
  const tradesmanName = business?.tradesman_name || 'Owner';
  const companyName = business?.company_name || 'Your Service Provider';

  const totalSeconds = timeEntries.reduce((sum, entry) => {
    const start = new Date(entry.start_time).getTime();
    const end = entry.end_time ? new Date(entry.end_time).getTime() : Date.now();
    return sum + Math.floor((end - start) / 1000);
  }, 0);
  const timeFormatted = formatTime(totalSeconds);

  // Owner labour: entries with no employee_id
  const ownerSeconds = timeEntries
    .filter(e => e.employee_id == null)
    .reduce((sum, entry) => {
      const start = new Date(entry.start_time).getTime();
      const end = entry.end_time ? new Date(entry.end_time).getTime() : Date.now();
      return sum + Math.floor((end - start) / 1000);
    }, 0);
  const ownerCost = (ownerSeconds / 3600) * defaultRate;

  // Employee labour: grouped by employee_id
  const empRateMap = new Map(employees.map(e => [e.id, { name: e.name, rate: e.hourly_rate ?? defaultRate }]));
  const empRowMap = new Map<string, { name: string; seconds: number; rate: number }>();
  timeEntries
    .filter(e => e.employee_id != null)
    .forEach(entry => {
      const empId = entry.employee_id!;
      const empInfo = empRateMap.get(empId) ?? { name: 'Employee', rate: defaultRate };
      const start = new Date(entry.start_time).getTime();
      const end = entry.end_time ? new Date(entry.end_time).getTime() : Date.now();
      const secs = Math.floor((end - start) / 1000);
      const existing = empRowMap.get(empId);
      if (existing) {
        existing.seconds += secs;
      } else {
        empRowMap.set(empId, { name: empInfo.name, seconds: secs, rate: empInfo.rate });
      }
    });
  const empRows = Array.from(empRowMap.values());
  const empLabourCost = empRows.reduce((sum, r) => sum + (r.seconds / 3600) * r.rate, 0);
  const totalLabourCost = ownerCost + empLabourCost;

  const totalInventoryCost = inventoryItems.reduce((sum, p) => sum + p.unit_price * p.quantity, 0);
  const totalCost = totalLabourCost + totalInventoryCost;

  const labourRowsHtml = `
    <tr>
      <td style="padding:5px 0;font-size:11px;color:#555555;text-transform:uppercase;letter-spacing:0.06em;" colspan="2">Labour Cost</td>
    </tr>
    <tr>
      <td style="padding:3px 0 3px 12px;font-size:14px;color:#000000;">
        ${tradesmanName}
        <span style="font-size:12px;color:#555555;"> — ${formatTime(ownerSeconds)}${defaultRate > 0 ? ` @ $${defaultRate.toFixed(2)}/hr` : ''}</span>
      </td>
      <td style="padding:3px 0;font-size:14px;font-weight:700;color:#000000;text-align:right;">${defaultRate > 0 ? `$${ownerCost.toFixed(2)}` : '&mdash;'}</td>
    </tr>
    ${empRows.map(r => `
    <tr>
      <td style="padding:3px 0 3px 12px;font-size:14px;color:#000000;">
        ${r.name}
        <span style="font-size:12px;color:#555555;"> — ${formatTime(r.seconds)} @ $${r.rate.toFixed(2)}/hr</span>
      </td>
      <td style="padding:3px 0;font-size:14px;font-weight:700;color:#000000;text-align:right;">$${((r.seconds / 3600) * r.rate).toFixed(2)}</td>
    </tr>`).join('')}
    <tr>
      <td style="padding:3px 0 6px 12px;font-size:14px;color:#000000;">Labour Total</td>
      <td style="padding:3px 0 6px;font-size:15px;font-weight:700;color:#000000;text-align:right;">$${totalLabourCost.toFixed(2)}</td>
    </tr>`;

  const inventoryHtml = inventoryItems.length > 0
    ? `
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">Description</th>
            <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;">Type</th>
            <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">Unit Price</th>
            <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">Qty</th>
            <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryItems.map(p => `
            <tr>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">${p.name}</td>
              <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-transform:capitalize;">${p.type}</td>
              <td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">$${p.unit_price.toFixed(2)}</td>
              <td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">${p.quantity}</td>
              <td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;">$${(p.unit_price * p.quantity).toFixed(2)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    : `<p style="color:#6b7280;font-size:14px;">No items or services recorded.</p>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;">
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:40px 40px 24px;">
          <div style="font-size:28px;line-height:34px;color:#000000;font-weight:700;letter-spacing:-0.5px;">${companyName}</div>
          <div style="margin-top:6px;font-size:15px;line-height:21px;color:#000000;font-weight:400;letter-spacing:0.03em;">JOB CARD #${job.job_card_number}${formatDate(job.scheduled_time) ? `&nbsp;&nbsp;&mdash;&nbsp;&nbsp;${formatDate(job.scheduled_time)}` : ''}</div>
        </td>
      </tr>
      <tr><td style="height:3px;padding:0;background:#000000;font-size:0;line-height:3px;">&nbsp;</td></tr>
    </table>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 4px;color:#000000;font-size:20px;font-weight:700;">${job.title}</h2>
      ${job.purchase_order_number ? `<p style="margin:0 0 16px;color:#555555;font-size:14px;">PO: ${job.purchase_order_number}</p>` : ''}

      ${client ? `
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #000000;">
        <tr><td style="padding:16px 16px 8px;font-size:11px;line-height:13px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Client</td></tr>
        <tr><td style="padding:0 16px 4px;font-size:16px;line-height:20px;color:#000000;font-weight:600;">${client.name}</td></tr>
        ${client.company_name ? `<tr><td style="padding:0 16px 4px;font-size:14px;line-height:18px;color:#000000;">${client.company_name}</td></tr>` : ''}
        ${client.address ? `<tr><td style="padding:0 16px 16px;font-size:14px;line-height:18px;color:#000000;">${client.address}</td></tr>` : `<tr><td style="padding:0 16px 16px;font-size:1px;line-height:1px;">&nbsp;</td></tr>`}
      </table>` : ''}

      ${job.description ? `
      <div style="margin-bottom:24px;">
        <p style="display:block;margin:0 0 8px;font-size:11px;line-height:13px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Description</p>
        <p style="display:block;margin:0;font-size:15px;line-height:24px;color:#000000;">${job.description}</p>
      </div>` : ''}

      <div style="margin-bottom:24px;">
        <p style="display:block;margin:0 0 8px;font-size:11px;line-height:13px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Inventory</p>
        ${inventoryHtml}
      </div>

      <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #000000;">
        <tr><td style="padding:16px;">
          <p style="display:block;margin:0 0 12px;font-size:11px;line-height:13px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Cost Summary</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:5px 0;font-size:15px;line-height:20px;color:#000000;">Total Time</td>
              <td style="padding:5px 0;font-size:15px;line-height:20px;font-weight:700;color:#000000;text-align:right;">${timeFormatted}</td>
            </tr>
            ${labourRowsHtml}
            <tr>
              <td style="padding:5px 0;font-size:15px;line-height:20px;color:#000000;">Inventory</td>
              <td style="padding:5px 0;font-size:15px;line-height:20px;font-weight:700;color:#000000;text-align:right;">${totalInventoryCost.toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:0;border-top:1px solid #000000;font-size:1px;line-height:1px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:8px 0 0;font-size:17px;line-height:22px;font-weight:700;color:#000000;">Total</td>
              <td style="padding:8px 0 0;font-size:17px;line-height:22px;font-weight:700;color:#000000;text-align:right;">${totalCost.toFixed(2)}</td>
            </tr>
          </table>
        </td></tr>
      </table>

      ${tradesmanName ? `<p style="display:block;margin:0 0 0;font-size:14px;line-height:20px;color:#000000;">Completed by ${tradesmanName}</p>` : ''}
    </div>
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:16px 40px;border-top:1px solid #000000;font-size:12px;line-height:16px;color:#555555;text-align:center;">${companyName} &mdash; Job Card #${job.job_card_number}</td></tr>
    </table>
  </div>
</body>
</html>`;
}

export async function generateJobCardPdf(data: JobCardData): Promise<string> {
  const html = buildJobCardHtml(data);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

export async function deleteJobCardPdf(uri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
  }
}
