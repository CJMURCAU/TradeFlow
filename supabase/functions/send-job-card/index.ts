import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "npm:pdf-lib";
import { encodeBase64 } from "jsr:@std/encoding/base64";

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

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}


function wrapText(
  text: string,
  widthOfText: (t: string) => number,
  maxWidth: number
): string[] {
  if (!text) return [];
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (widthOfText(candidate) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

// deno-lint-ignore no-explicit-any
async function buildPdf(params: any): Promise<Uint8Array> {
  const {
    job, client, inventoryItems, jobPhotos, photoBuffers,
    ownerSeconds, ownerCost, empRows,
    totalLabourCost, totalInventoryCost, totalCost,
    totalSeconds, defaultRate, tradesmanName, companyName,
  } = params;

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const [PW, PH] = PageSizes.A4; // 595.28 x 841.89
  const M = 50; // margin
  const CW = PW - M * 2; // content width = 495.28

  const BLACK = rgb(0, 0, 0);
  const GRAY = rgb(0.33, 0.33, 0.33);
  const MUTED = rgb(0.42, 0.45, 0.49);
  const RULE_GRAY = rgb(0.82, 0.84, 0.86);
  const HEADER_FILL = rgb(0.95, 0.96, 0.97);

  let page = pdfDoc.addPage([PW, PH]);
  let y = M; // y from top (increases downward)

  function pdfY(yFromTop: number) {
    return PH - yFromTop;
  }

  function checkPage(needed: number) {
    if (y + needed > PH - M) {
      page = pdfDoc.addPage([PW, PH]);
      y = M;
    }
  }

  function drawText(
    text: string,
    x: number,
    yFromTop: number,
    font: typeof fontRegular,
    size: number,
    color = BLACK
  ) {
    page.drawText(text, { x, y: pdfY(yFromTop) - size, font, size, color });
  }

  function hline(yFromTop: number, x1 = M, x2 = PW - M, thickness = 0.5, color = RULE_GRAY) {
    page.drawLine({
      start: { x: x1, y: pdfY(yFromTop) },
      end: { x: x2, y: pdfY(yFromTop) },
      thickness,
      color,
    });
  }

  function rect(
    x: number,
    yFromTop: number,
    w: number,
    h: number,
    options: { fill?: ReturnType<typeof rgb>; border?: ReturnType<typeof rgb>; borderWidth?: number } = {}
  ) {
    page.drawRectangle({
      x,
      y: pdfY(yFromTop) - h,
      width: w,
      height: h,
      color: options.fill,
      borderColor: options.border,
      borderWidth: options.borderWidth,
    });
  }

  function textWidth(text: string, font: typeof fontRegular, size: number) {
    return font.widthOfTextAtSize(text, size);
  }

  // ── HEADER ────────────────────────────────────────────────────────────────
  // Company name
  drawText(companyName, M, y + 22, fontBold, 22);
  y += 28;
  // Job card number + date on the same line
  const jobCardLabel = `JOB CARD  #${job.job_card_number}`;
  const scheduledDateStr = formatDate(job.scheduled_time);
  drawText(jobCardLabel, M, y + 11, fontRegular, 11, GRAY);
  if (scheduledDateStr) {
    const dateLabel = `Date: ${scheduledDateStr}`;
    drawText(dateLabel, PW - M - textWidth(dateLabel, fontRegular, 11), y + 11, fontRegular, 11, GRAY);
  }
  y += 16;
  // Bold rule
  page.drawLine({ start: { x: M, y: pdfY(y) }, end: { x: PW - M, y: pdfY(y) }, thickness: 2.5, color: BLACK });
  y += 18;

  // ── JOB TITLE ─────────────────────────────────────────────────────────────
  checkPage(30);
  drawText(job.title, M, y + 18, fontBold, 18);
  y += 24;
  if (job.purchase_order_number) {
    drawText(`PO: ${job.purchase_order_number}`, M, y + 11, fontRegular, 11, MUTED);
    y += 16;
  }

  // ── CLIENT BOX ────────────────────────────────────────────────────────────
  const clientLines: { text: string; bold: boolean; size: number }[] = [
    { text: "CLIENT", bold: true, size: 9 },
  ];
  if (client.company_name) clientLines.push({ text: client.company_name, bold: true, size: 14 });
  clientLines.push({ text: client.name, bold: false, size: 12 });
  if (client.phone) clientLines.push({ text: client.phone, bold: false, size: 12 });
  if (client.address) clientLines.push({ text: client.address, bold: false, size: 12 });

  const BOX_PAD = 12;
  let clientBoxH = BOX_PAD * 2;
  for (let i = 0; i < clientLines.length; i++) {
    clientBoxH += clientLines[i].size + (i < clientLines.length - 1 ? 5 : 0);
  }

  checkPage(clientBoxH + 16);
  y += 8;
  rect(M, y, CW, clientBoxH, { border: BLACK, borderWidth: 1 });
  let cy = y + BOX_PAD;
  for (let i = 0; i < clientLines.length; i++) {
    const cl = clientLines[i];
    drawText(cl.text, M + BOX_PAD, cy + cl.size, cl.bold ? fontBold : fontRegular, cl.size, i === 0 ? GRAY : BLACK);
    cy += cl.size + (i < clientLines.length - 1 ? 5 : 0);
  }
  y += clientBoxH + 14;

  // ── DESCRIPTION ───────────────────────────────────────────────────────────
  if (job.description) {
    const descLines = wrapText(job.description, (t) => textWidth(t, fontRegular, 12), CW);
    const descH = 9 + 6 + descLines.length * 18 + 14;
    checkPage(descH);
    drawText("DESCRIPTION", M, y + 9, fontBold, 9, GRAY);
    y += 14;
    for (const line of descLines) {
      drawText(line, M, y + 12, fontRegular, 12);
      y += 17;
    }
    y += 8;
  }

  // ── INVENTORY TABLE ───────────────────────────────────────────────────────
  checkPage(40);
  drawText("INVENTORY", M, y + 9, fontBold, 9, GRAY);
  y += 14;

  if (inventoryItems.length === 0) {
    drawText("No items or services recorded.", M, y + 12, fontRegular, 12, MUTED);
    y += 20;
  } else {
    const COL_W = [210, 75, 75, 50, CW - 210 - 75 - 75 - 50]; // desc, type, unit, qty, total
    const COL_X = [M, M + COL_W[0], M + COL_W[0] + COL_W[1], M + COL_W[0] + COL_W[1] + COL_W[2], M + COL_W[0] + COL_W[1] + COL_W[2] + COL_W[3]];
    const ROW_H = 20;
    const CELL_PAD = 4;

    // Header row
    rect(M, y, CW, ROW_H, { fill: HEADER_FILL, border: RULE_GRAY, borderWidth: 0.5 });
    const headers = ["Description", "Type", "Unit Price", "Qty", "Total"];
    const alignRight = [false, false, true, true, true];
    for (let c = 0; c < 5; c++) {
      const tx = alignRight[c]
        ? COL_X[c] + COL_W[c] - CELL_PAD - textWidth(headers[c], fontBold, 10)
        : COL_X[c] + CELL_PAD;
      drawText(headers[c], tx, y + 13, fontBold, 10);
    }
    y += ROW_H;

    for (const item of inventoryItems) {
      const descWrapped = wrapText(item.name, (t) => textWidth(t, fontRegular, 11), COL_W[0] - CELL_PAD * 2);
      const rowH = Math.max(ROW_H, descWrapped.length * 14 + CELL_PAD * 2);
      checkPage(rowH + 4);

      rect(M, y, CW, rowH, { border: RULE_GRAY, borderWidth: 0.5 });

      // Draw description lines
      for (let li = 0; li < descWrapped.length; li++) {
        drawText(descWrapped[li], COL_X[0] + CELL_PAD, y + CELL_PAD + 11 + li * 14, fontRegular, 11);
      }

      // Type
      drawText(item.type, COL_X[1] + CELL_PAD, y + 13, fontRegular, 11, MUTED);

      // Unit price (right-aligned)
      const upStr = `$${item.unit_price.toFixed(2)}`;
      drawText(upStr, COL_X[2] + COL_W[2] - CELL_PAD - textWidth(upStr, fontRegular, 11), y + 13, fontRegular, 11);

      // Qty (right-aligned)
      const qtyStr = String(item.quantity);
      drawText(qtyStr, COL_X[3] + COL_W[3] - CELL_PAD - textWidth(qtyStr, fontRegular, 11), y + 13, fontRegular, 11);

      // Total (right-aligned)
      const totalStr = `$${(item.unit_price * item.quantity).toFixed(2)}`;
      drawText(totalStr, COL_X[4] + COL_W[4] - CELL_PAD - textWidth(totalStr, fontRegular, 11), y + 13, fontRegular, 11);

      y += rowH;
    }
    y += 14;
  }

  // ── PHOTOS ────────────────────────────────────────────────────────────────
  const validPhotos: { dataUrl: Uint8Array; mimeType: string }[] = [];
  for (let i = 0; i < jobPhotos.length; i++) {
    if (photoBuffers[i]) validPhotos.push(photoBuffers[i]);
  }

  if (validPhotos.length > 0) {
    checkPage(30);
    drawText("PHOTOS", M, y + 9, fontBold, 9, GRAY);
    y += 14;

    const IMG_GAP = 8;
    const IMG_W = (CW - IMG_GAP) / 2;

    for (let i = 0; i < validPhotos.length; i += 2) {
      try {
        const left = validPhotos[i];
        const embedLeft = left.mimeType.includes("png")
          ? await pdfDoc.embedPng(left.dataUrl)
          : await pdfDoc.embedJpg(left.dataUrl);
        const scaleLeft = IMG_W / embedLeft.width;
        const leftH = embedLeft.height * scaleLeft;

        let rightH = 0;
        let embedRight = null;
        if (validPhotos[i + 1]) {
          const right = validPhotos[i + 1];
          embedRight = right.mimeType.includes("png")
            ? await pdfDoc.embedPng(right.dataUrl)
            : await pdfDoc.embedJpg(right.dataUrl);
          const scaleRight = IMG_W / embedRight.width;
          rightH = embedRight.height * scaleRight;
        }

        const rowH = Math.max(leftH, rightH);
        checkPage(rowH + 8);

        page.drawImage(embedLeft, {
          x: M,
          y: pdfY(y) - leftH,
          width: IMG_W,
          height: leftH,
        });
        if (embedRight) {
          page.drawImage(embedRight, {
            x: M + IMG_W + IMG_GAP,
            y: pdfY(y) - rightH,
            width: IMG_W,
            height: rightH,
          });
        }

        y += rowH + IMG_GAP;
      } catch {
        // skip photos that fail to embed
      }
    }
    y += 6;
  }

  // ── COST SUMMARY ──────────────────────────────────────────────────────────
  checkPage(40);
  drawText("COST SUMMARY", M, y + 9, fontBold, 9, GRAY);
  y += 14;

  const LW = 380; // label column width
  const VX = M + LW; // value column x

  function summaryRow(label: string, value: string, bold = false, yPos: number) {
    const font = bold ? fontBold : fontRegular;
    const size = bold ? 14 : 13;
    drawText(label, M, yPos + size, font, size);
    drawText(value, VX + (CW - LW) - textWidth(value, font, size), yPos + size, font, size);
    return yPos + size + 6;
  }

  y = summaryRow("Total Time", formatTime(totalSeconds), false, y);

  // Labour subheading
  checkPage(12);
  drawText("LABOUR COST", M, y + 9, fontRegular, 9, MUTED);
  y += 14;

  // Owner row
  const ownerLabel = defaultRate > 0
    ? `  ${tradesmanName}  \u2014  ${formatTime(ownerSeconds)}  @  $${defaultRate.toFixed(2)}/hr`
    : `  ${tradesmanName}  \u2014  ${formatTime(ownerSeconds)}`;
  checkPage(20);
  drawText(ownerLabel, M, y + 12, fontRegular, 12);
  const ownerValue = defaultRate > 0 ? `$${ownerCost.toFixed(2)}` : "\u2014";
  drawText(ownerValue, VX + (CW - LW) - textWidth(ownerValue, fontBold, 12), y + 12, fontBold, 12);
  y += 18;

  // Employee rows
  for (const r of empRows) {
    const empLabel = `  ${r.name}  \u2014  ${formatTime(r.seconds)}  @  $${r.rate.toFixed(2)}/hr`;
    const empValue = `$${((r.seconds / 3600) * r.rate).toFixed(2)}`;
    checkPage(18);
    drawText(empLabel, M, y + 12, fontRegular, 12);
    drawText(empValue, VX + (CW - LW) - textWidth(empValue, fontBold, 12), y + 12, fontBold, 12);
    y += 18;
  }

  // Labour total
  checkPage(20);
  drawText("  Labour Total", M, y + 13, fontRegular, 13);
  const ltv = `$${totalLabourCost.toFixed(2)}`;
  drawText(ltv, VX + (CW - LW) - textWidth(ltv, fontBold, 13), y + 13, fontBold, 13);
  y += 20;

  // Inventory
  checkPage(20);
  drawText("Inventory", M, y + 13, fontRegular, 13);
  const inv = `$${totalInventoryCost.toFixed(2)}`;
  drawText(inv, VX + (CW - LW) - textWidth(inv, fontBold, 13), y + 13, fontBold, 13);
  y += 20;

  // Divider
  checkPage(10);
  hline(y + 4, M, PW - M, 0.75, BLACK);
  y += 10;

  // Total
  checkPage(24);
  drawText("TOTAL", M, y + 15, fontBold, 15);
  const tot = `$${totalCost.toFixed(2)}`;
  drawText(tot, VX + (CW - LW) - textWidth(tot, fontBold, 15), y + 15, fontBold, 15);
  y += 22;

  // Footer note
  if (tradesmanName) {
    checkPage(18);
    y += 6;
    drawText(`Completed by ${tradesmanName}`, M, y + 12, fontRegular, 12, MUTED);
    y += 16;
  }

  return pdfDoc.save();
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

    // Fetch photos as raw buffers for embedding in the PDF
    const photoBuffers: ({ dataUrl: Uint8Array; mimeType: string } | null)[] = [];
    if (includePhotos && jobPhotos.length > 0) {
      for (const photo of jobPhotos) {
        try {
          const res = await fetch(photo.public_url);
          if (!res.ok) { photoBuffers.push(null); continue; }
          const buf = await res.arrayBuffer();
          const mimeType = res.headers.get("content-type") || "image/jpeg";
          photoBuffers.push({ dataUrl: new Uint8Array(buf), mimeType });
        } catch {
          photoBuffers.push(null);
        }
      }
    }

    // Generate PDF
    const pdfBytes = await buildPdf({
      job, client, inventoryItems, jobPhotos, photoBuffers,
      totalSeconds, ownerSeconds, ownerCost, empRows,
      totalLabourCost, totalInventoryCost, totalCost,
      defaultRate, tradesmanName, companyName,
    });

    const pdfBase64 = encodeBase64(pdfBytes);

    // Build email HTML (unchanged)
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
      <p style="margin:0;color:#000000;font-size:15px;font-weight:400;letter-spacing:0.03em;">JOB CARD #${job.job_card_number}${formatDate(job.scheduled_time) ? `&nbsp;&nbsp;&mdash;&nbsp;&nbsp;${formatDate(job.scheduled_time)}` : ""}</p>
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
            <td style="padding:5px 0;font-size:15px;font-weight:700;color:#000000;text-align:right;">${formatTime(totalSeconds)}</td>
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
