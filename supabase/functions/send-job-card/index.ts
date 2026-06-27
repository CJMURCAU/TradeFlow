import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
// @deno-types="npm:pdfmake/build/pdfmake.d.ts"
import pdfMake from "npm:pdfmake/build/pdfmake.js";
// @deno-types="npm:pdfmake/build/vfs_fonts.d.ts"
import pdfFonts from "npm:pdfmake/build/vfs_fonts.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPdfDefinition(params: {
  job: any;
  client: any;
  inventoryItems: { name: string; unit_price: number; quantity: number; type: string }[];
  timeEntries: { start_time: string; end_time: string | null; employee_id: string | null }[];
  business: any;
  employees: { id: string; name: string; hourly_rate: number | null }[];
  jobPhotos: { public_url: string }[];
  photoDataUrls: (string | null)[];
  totalSeconds: number;
  ownerSeconds: number;
  ownerCost: number;
  empRows: { name: string; seconds: number; rate: number }[];
  totalLabourCost: number;
  totalInventoryCost: number;
  totalCost: number;
  defaultRate: number;
  tradesmanName: string;
  companyName: string;
}) {
  const {
    job, client, inventoryItems, business,
    photoDataUrls, ownerSeconds, ownerCost, empRows,
    totalLabourCost, totalInventoryCost, totalCost,
    defaultRate, tradesmanName, companyName,
  } = params;

  const timeFormatted = formatTime(params.totalSeconds);

  // Inventory table body
  const inventoryTableBody = [
    [
      { text: "Description", style: "tableHeader" },
      { text: "Type", style: "tableHeader" },
      { text: "Unit Price", style: "tableHeader", alignment: "right" },
      { text: "Qty", style: "tableHeader", alignment: "right" },
      { text: "Total", style: "tableHeader", alignment: "right" },
    ],
    ...inventoryItems.map(p => [
      { text: p.name, style: "tableCell" },
      { text: p.type, style: "tableCellMuted" },
      { text: `$${p.unit_price.toFixed(2)}`, style: "tableCell", alignment: "right" },
      { text: String(p.quantity), style: "tableCell", alignment: "right" },
      { text: `$${(p.unit_price * p.quantity).toFixed(2)}`, style: "tableCell", alignment: "right" },
    ]),
  ];

  // Cost summary table rows
  const costTableBody: unknown[] = [
    [
      { text: "Total Time", style: "summaryLabel" },
      { text: timeFormatted, style: "summaryValue", alignment: "right" },
    ],
    [
      { text: "LABOUR COST", style: "summarySubheading", colSpan: 2 },
      {},
    ],
    [
      {
        text: `  ${tradesmanName}  \u2014  ${formatTime(ownerSeconds)}${defaultRate > 0 ? `  @  $${defaultRate.toFixed(2)}/hr` : ""}`,
        style: "summaryDetail",
      },
      {
        text: defaultRate > 0 ? `$${ownerCost.toFixed(2)}` : "\u2014",
        style: "summaryValue",
        alignment: "right",
      },
    ],
    ...empRows.map(r => [
      {
        text: `  ${r.name}  \u2014  ${formatTime(r.seconds)}  @  $${r.rate.toFixed(2)}/hr`,
        style: "summaryDetail",
      },
      {
        text: `$${((r.seconds / 3600) * r.rate).toFixed(2)}`,
        style: "summaryValue",
        alignment: "right",
      },
    ]),
    [
      { text: "  Labour Total", style: "summaryLabel" },
      { text: `$${totalLabourCost.toFixed(2)}`, style: "summaryValue", alignment: "right" },
    ],
    [
      { text: "Inventory", style: "summaryLabel" },
      { text: `$${totalInventoryCost.toFixed(2)}`, style: "summaryValue", alignment: "right" },
    ],
    [
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 435, y2: 0, lineWidth: 0.5, lineColor: "#000000" }], colSpan: 2, margin: [0, 4, 0, 4] },
      {},
    ],
    [
      { text: "TOTAL", style: "summaryTotal" },
      { text: `$${totalCost.toFixed(2)}`, style: "summaryTotal", alignment: "right" },
    ],
  ];

  // Photos section
  const photosContent: unknown[] = [];
  const validPhotos = params.jobPhotos
    .map((p, i) => ({ url: p.public_url, dataUrl: photoDataUrls[i] }))
    .filter(p => p.dataUrl != null);

  if (validPhotos.length > 0) {
    photosContent.push({ text: "PHOTOS", style: "sectionLabel", margin: [0, 16, 0, 8] });
    for (let i = 0; i < validPhotos.length; i += 2) {
      const row: unknown[] = [
        { image: validPhotos[i].dataUrl, width: 220, margin: [0, 0, 8, 8] },
      ];
      if (validPhotos[i + 1]) {
        row.push({ image: validPhotos[i + 1].dataUrl, width: 220, margin: [0, 0, 0, 8] });
      }
      photosContent.push({ columns: row });
    }
  }

  const content: unknown[] = [
    // Header
    { text: companyName, style: "companyName" },
    { text: `JOB CARD #${job.job_card_number}`, style: "jobCardNumber" },
    { canvas: [{ type: "line", x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 2.5, lineColor: "#000000" }], margin: [0, 8, 0, 16] },

    // Job title
    { text: job.title, style: "jobTitle" },
    ...(job.purchase_order_number ? [{ text: `PO: ${job.purchase_order_number}`, style: "poNumber" }] : []),

    // Client box
    {
      table: {
        widths: ["*"],
        body: [[{
          stack: [
            { text: "CLIENT", style: "sectionLabel", margin: [0, 0, 0, 6] },
            ...(client.company_name ? [{ text: client.company_name, style: "clientCompany" }] : []),
            { text: client.name, style: client.company_name ? "clientName" : "clientCompany" },
            ...(client.phone ? [{ text: client.phone, style: "clientDetail" }] : []),
            ...(client.address ? [{ text: client.address, style: "clientDetail" }] : []),
          ],
          margin: [12, 12, 12, 12],
        }]],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => "#000000",
        vLineColor: () => "#000000",
      },
      margin: [0, 12, 0, 16],
    },

    // Description
    ...(job.description
      ? [
          { text: "DESCRIPTION", style: "sectionLabel" },
          { text: job.description, style: "bodyText", margin: [0, 4, 0, 16] },
        ]
      : []),

    // Inventory
    { text: "INVENTORY", style: "sectionLabel" },
    inventoryItems.length > 0
      ? {
          table: {
            headerRows: 1,
            widths: ["*", "auto", "auto", "auto", "auto"],
            body: inventoryTableBody,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#d1d5db",
            vLineColor: () => "#d1d5db",
            fillColor: (rowIndex: number) => rowIndex === 0 ? "#f3f4f6" : null,
          },
          margin: [0, 6, 0, 16],
        }
      : { text: "No items or services recorded.", style: "noData", margin: [0, 4, 0, 16] },

    // Photos
    ...photosContent,

    // Cost Summary
    { text: "COST SUMMARY", style: "sectionLabel", margin: [0, 4, 0, 8] },
    {
      table: {
        widths: ["*", "auto"],
        body: costTableBody,
      },
      layout: "noBorders",
    },

    // Footer
    ...(tradesmanName ? [{ text: `Completed by ${tradesmanName}`, style: "footerText", margin: [0, 20, 0, 0] }] : []),
  ];

  return {
    pageSize: "A4",
    pageMargins: [40, 50, 40, 50],
    content,
    styles: {
      companyName: { fontSize: 22, bold: true, color: "#000000" },
      jobCardNumber: { fontSize: 12, color: "#000000", margin: [0, 4, 0, 0] },
      jobTitle: { fontSize: 18, bold: true, color: "#000000", margin: [0, 0, 0, 4] },
      poNumber: { fontSize: 12, color: "#555555", margin: [0, 0, 0, 4] },
      sectionLabel: { fontSize: 9, bold: true, color: "#000000" },
      clientCompany: { fontSize: 14, bold: true, color: "#000000" },
      clientName: { fontSize: 13, color: "#000000", margin: [0, 2, 0, 0] },
      clientDetail: { fontSize: 12, color: "#000000", margin: [0, 2, 0, 0] },
      bodyText: { fontSize: 13, color: "#000000", lineHeight: 1.5 },
      tableHeader: { fontSize: 11, bold: true, color: "#000000", margin: [4, 4, 4, 4] },
      tableCell: { fontSize: 12, color: "#000000", margin: [4, 4, 4, 4] },
      tableCellMuted: { fontSize: 11, color: "#6b7280", margin: [4, 4, 4, 4] },
      noData: { fontSize: 12, color: "#6b7280" },
      summarySubheading: { fontSize: 9, color: "#555555", margin: [0, 8, 0, 2] },
      summaryLabel: { fontSize: 13, color: "#000000", margin: [0, 2, 0, 2] },
      summaryDetail: { fontSize: 12, color: "#000000", margin: [0, 2, 0, 2] },
      summaryValue: { fontSize: 13, bold: true, color: "#000000", margin: [0, 2, 0, 2] },
      summaryTotal: { fontSize: 15, bold: true, color: "#000000", margin: [0, 4, 0, 0] },
      footerText: { fontSize: 12, color: "#555555" },
    },
    defaultStyle: {
      font: "Roboto",
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { jobId, includePhotos } = await req.json();

    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*, client:clients(*)")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = Array.isArray(job.client) ? job.client[0] : job.client;

    const [inventoryRes, timeEntriesRes, businessRes, employeesRes, photosRes] = await Promise.all([
      supabase.from("job_inventory").select("*").eq("job_id", jobId).order("created_at", { ascending: true }),
      supabase.from("time_entries").select("*").eq("job_id", jobId),
      supabase.from("business_details").select("*").eq("user_id", job.user_id).maybeSingle(),
      supabase.from("employees").select("*").eq("user_id", job.user_id).eq("status", "active"),
      includePhotos
        ? supabase.from("job_photos").select("public_url").eq("job_id", jobId).order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    const inventoryItems: { name: string; unit_price: number; quantity: number; type: string }[] = inventoryRes.data || [];
    const timeEntries: { start_time: string; end_time: string | null; employee_id: string | null }[] = timeEntriesRes.data || [];
    const business = businessRes.data;
    const employees: { id: string; name: string; hourly_rate: number | null }[] = employeesRes.data || [];
    const jobPhotos: { public_url: string }[] = photosRes.data || [];

    const defaultRate: number = business?.default_hourly_rate ?? 0;
    const tradesmanName: string = business?.tradesman_name || "Owner";
    const companyName: string = business?.company_name || "Your Service Provider";

    const totalSeconds = timeEntries.reduce((sum, entry) => {
      const start = new Date(entry.start_time).getTime();
      const end = entry.end_time ? new Date(entry.end_time).getTime() : Date.now();
      return sum + Math.floor((end - start) / 1000);
    }, 0);
    const timeFormatted = formatTime(totalSeconds);

    const ownerSeconds = timeEntries
      .filter(e => e.employee_id == null)
      .reduce((sum, entry) => {
        const start = new Date(entry.start_time).getTime();
        const end = entry.end_time ? new Date(entry.end_time).getTime() : Date.now();
        return sum + Math.floor((end - start) / 1000);
      }, 0);
    const ownerCost = (ownerSeconds / 3600) * defaultRate;

    const empRateMap = new Map(employees.map(e => [e.id, { name: e.name, rate: e.hourly_rate ?? defaultRate }]));
    const empRowMap = new Map<string, { name: string; seconds: number; rate: number }>();
    timeEntries
      .filter(e => e.employee_id != null)
      .forEach(entry => {
        const empId = entry.employee_id!;
        const empInfo = empRateMap.get(empId) ?? { name: "Employee", rate: defaultRate };
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

    // Fetch photos as data URLs for embedding in the PDF
    const photoDataUrls: (string | null)[] = includePhotos && jobPhotos.length > 0
      ? await Promise.all(jobPhotos.map(p => fetchImageAsDataUrl(p.public_url)))
      : [];

    // Generate PDF
    const docDefinition = buildPdfDefinition({
      job, client, inventoryItems, timeEntries, business, employees,
      jobPhotos, photoDataUrls,
      totalSeconds, ownerSeconds, ownerCost, empRows,
      totalLabourCost, totalInventoryCost, totalCost,
      defaultRate, tradesmanName, companyName,
    });

    const pdfBuffer: Uint8Array = await new Promise((resolve, reject) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const generator = (pdfMake as any).createPdf(docDefinition);
        generator.getBuffer((buf: Uint8Array) => resolve(buf));
      } catch (e) {
        reject(e);
      }
    });

    const pdfBase64 = uint8ToBase64(pdfBuffer);

    // Build email HTML
    const labourRowsHtml = `
      <tr>
        <td style="padding:5px 0 2px;font-size:11px;color:#555555;text-transform:uppercase;letter-spacing:0.06em;" colspan="2">Labour Cost</td>
      </tr>
      <tr>
        <td style="padding:3px 0 3px 12px;font-size:14px;color:#000000;">
          ${tradesmanName}
          <span style="font-size:12px;color:#555555;"> &mdash; ${formatTime(ownerSeconds)}${defaultRate > 0 ? ` @ $${defaultRate.toFixed(2)}/hr` : ""}</span>
        </td>
        <td style="padding:3px 0;font-size:14px;font-weight:700;color:#000000;text-align:right;">${defaultRate > 0 ? `$${ownerCost.toFixed(2)}` : "&mdash;"}</td>
      </tr>
      ${empRows.map(r => `
      <tr>
        <td style="padding:3px 0 3px 12px;font-size:14px;color:#000000;">
          ${r.name}
          <span style="font-size:12px;color:#555555;"> &mdash; ${formatTime(r.seconds)} @ $${r.rate.toFixed(2)}/hr</span>
        </td>
        <td style="padding:3px 0;font-size:14px;font-weight:700;color:#000000;text-align:right;">$${((r.seconds / 3600) * r.rate).toFixed(2)}</td>
      </tr>`).join("")}
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
              </tr>`).join("")}
          </tbody>
        </table>`
      : `<p style="color:#6b7280;font-size:14px;">No items or services recorded.</p>`;

    let photosHtml = "";
    if (includePhotos && jobPhotos.length > 0) {
      const photoRows: string[] = [];
      for (let i = 0; i < jobPhotos.length; i += 2) {
        const left = `<td style="padding:4px;width:50%;vertical-align:top;"><img src="${jobPhotos[i].public_url}" style="width:60%;border-radius:4px;display:block;margin:0 auto;" alt="Job photo" /></td>`;
        const right = jobPhotos[i + 1]
          ? `<td style="padding:4px;width:50%;vertical-align:top;"><img src="${jobPhotos[i + 1].public_url}" style="width:60%;border-radius:4px;display:block;margin:0 auto;" alt="Job photo" /></td>`
          : `<td style="width:50%;"></td>`;
        photoRows.push(`<tr>${left}${right}</tr>`);
      }
      photosHtml = `
      <div style="margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:11px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Photos</p>
        <table style="width:100%;border-collapse:collapse;">${photoRows.join("")}</table>
      </div>`;
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;">
    <div style="padding:40px 40px 24px;border-bottom:3px solid #000000;">
      <h1 style="margin:0 0 6px;color:#000000;font-size:28px;font-weight:700;letter-spacing:-0.5px;">${companyName}</h1>
      <p style="margin:0;color:#000000;font-size:15px;font-weight:400;letter-spacing:0.03em;">JOB CARD #${job.job_card_number}</p>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 4px;color:#000000;font-size:20px;font-weight:700;">${job.title}</h2>
      ${job.purchase_order_number ? `<p style="margin:0 0 16px;color:#555555;font-size:14px;">PO: ${job.purchase_order_number}</p>` : ""}

      <div style="padding:16px;margin:20px 0;border:1px solid #000000;">
        <p style="margin:0 0 4px;font-size:11px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Client</p>
        ${client.company_name ? `<p style="margin:0;font-size:16px;color:#000000;font-weight:600;">${client.company_name}</p>` : ""}
        <p style="margin:${client.company_name ? "4px" : "0"} 0 0;font-size:14px;color:#000000;">${client.name}</p>
        ${client.phone ? `<p style="margin:4px 0 0;font-size:14px;color:#000000;">${client.phone}</p>` : ""}
        ${client.address ? `<p style="margin:4px 0 0;font-size:14px;color:#000000;">${client.address}</p>` : ""}
      </div>

      ${job.description ? `
      <div style="margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:11px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Description</p>
        <p style="margin:0;font-size:15px;color:#000000;line-height:1.6;">${job.description}</p>
      </div>` : ""}

      <div style="margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:11px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Inventory</p>
        ${inventoryHtml}
      </div>

      ${photosHtml}

      <div style="padding:16px;border:1px solid #000000;">
        <p style="margin:0 0 12px;font-size:11px;color:#000000;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Cost Summary</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:5px 0;font-size:15px;color:#000000;">Total Time</td>
            <td style="padding:5px 0;font-size:15px;font-weight:700;color:#000000;text-align:right;">${timeFormatted}</td>
          </tr>
          ${labourRowsHtml}
          <tr>
            <td style="padding:5px 0;font-size:15px;color:#000000;">Inventory</td>
            <td style="padding:5px 0;font-size:15px;font-weight:700;color:#000000;text-align:right;">$${totalInventoryCost.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:4px 0;"><hr style="border:none;border-top:1px solid #000000;margin:4px 0;" /></td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:17px;font-weight:700;color:#000000;">Total</td>
            <td style="padding:5px 0;font-size:17px;font-weight:700;color:#000000;text-align:right;">$${totalCost.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      ${tradesmanName ? `<p style="margin:24px 0 0;font-size:14px;color:#000000;">Completed by ${tradesmanName}</p>` : ""}
      <p style="margin:16px 0 0;font-size:13px;color:#555555;">A print-ready PDF is attached to this email.</p>
    </div>
    <div style="padding:16px 40px;border-top:1px solid #000000;">
      <p style="margin:0;font-size:12px;color:#555555;text-align:center;">${companyName} &mdash; Job Card #${job.job_card_number}</p>
    </div>
  </div>
</body>
</html>`;

    const mailtrapToken = Deno.env.get("MAILTRAP_API_TOKEN");
    if (!mailtrapToken) {
      return new Response(JSON.stringify({ error: "MAILTRAP_API_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!business?.job_email) {
      return new Response(JSON.stringify({ error: "No job card email set in Business settings. Please add one before sending." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipientEmail = business.job_email;

    const mailtrapResponse = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mailtrapToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { name: companyName, email: "hello@tradeflowmanager.com" },
        to: [{ email: recipientEmail }],
        reply_to: { email: recipientEmail },
        subject: `Job Card #${job.job_card_number} - ${job.title}`,
        html: emailHtml,
        attachments: [
          {
            content: pdfBase64,
            filename: `JobCard-${job.job_card_number}.pdf`,
            type: "application/pdf",
            disposition: "attachment",
          },
        ],
      }),
    });

    const mailtrapRawText = await mailtrapResponse.text();

    if (!mailtrapResponse.ok) {
      let mailtrapError: unknown;
      try { mailtrapError = JSON.parse(mailtrapRawText); } catch { mailtrapError = mailtrapRawText; }
      const errObj = mailtrapError as Record<string, unknown>;
      const errorMessage =
        (typeof errObj?.message === "string" ? errObj.message : null) ||
        (Array.isArray(errObj?.errors) ? (errObj.errors as string[]).join(", ") : null) ||
        mailtrapRawText;
      return new Response(JSON.stringify({ error: errorMessage, details: mailtrapError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("jobs")
      .update({ email_sent: true, status: "completed" })
      .eq("id", jobId);

    return new Response(JSON.stringify({ success: true, sentTo: recipientEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
