import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import pa11y from "pa11y";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Simple in-memory store of the last report
let LAST_REPORT = null;

// --- Detailed Audit Helper Functions ---
const normalizeUrl = (url) => (url.startsWith("http") ? url : `https://${url}`);

async function securityCheck(url) {
    const https = url.startsWith("https://");
    let headers = {};
    const required = ["content-security-policy", "strict-transport-security", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy"];
    try {
        const res = await fetch(url, { redirect: "follow" });
        res.headers.forEach((v, k) => (headers[k] = v));
    } catch (e) {}
    const present = required.filter((h) => headers[h]);
    const missing = required.filter((h) => !headers[h]);
    return { https, present, missing };
}

async function seoCheck(url) {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    const titleText = $("title").text().trim();
    const metaDescriptionText = $('meta[name="description"]').attr("content") || "";
    const h1Count = $("h1").length;
    const imgsWithoutAlt = $("img:not([alt])").length;
    return { titleText, metaDescriptionText, h1Count, imgsWithoutAlt };
}

async function performanceCheck(url) {
    const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    const start = Date.now();
    await page.goto(url, { waitUntil: "networkidle2" });
    const loadTimeMs = Date.now() - start;
    const metrics = await page.evaluate(() => {
        const perf = performance.getEntriesByType("resource");
        const totalTransfer = perf.reduce((acc, e) => acc + (e.transferSize || 0), 0);
        return { resourceCount: perf.length, totalTransfer };
    });
    const domCount = await page.evaluate(() => document.getElementsByTagName("*").length);
    await browser.close();
    return { loadTimeMs, resourceCount: metrics.resourceCount, totalTransferBytes: metrics.totalTransfer, domCount };
}

async function accessibilityCheck(url) {
    const results = await pa11y(url, { standard: "WCAG2AA", timeout: 60000 });
    return { count: results.issues.length, issues: results.issues };
}

// --- Main Audit Endpoint ---
app.post("/audit", async (req, res) => {
  try {
    let { url: userInput } = req.body;
    if (!userInput) return res.status(400).json({ error: "URL is required." });

    const targetUrl = normalizeUrl(userInput);

    const [security, seo, performance, accessibility] = await Promise.all([
      securityCheck(targetUrl),
      seoCheck(targetUrl),
      performanceCheck(targetUrl),
      accessibilityCheck(targetUrl)
    ]);

    // Basic scoring logic
    let score = 100;
    if (!security.https) score -= 15;
    score -= security.missing.length * 4;
    score -= Math.min(accessibility.count * 1.5, 25);
    if (performance.loadTimeMs > 4000) score -= 15;
    if (performance.totalTransferBytes > 2_000_000) score -= 10;
    if (!seo.titleText) score -= 5;
    if (!seo.metaDescriptionText) score -= 5;
    score = Math.max(0, Math.round(score));

    LAST_REPORT = { url: targetUrl, score, security, seo, performance, accessibility };
    res.json(LAST_REPORT);
  } catch (e) {
    res.status(500).json({ error: "Audit failed", details: e.message });
  }
});

// --- NEW: PDF Download Endpoint ---
app.get("/report.pdf", (req, res) => {
    if (!LAST_REPORT) return res.status(400).send("Run an audit first to generate a report.");

    const r = LAST_REPORT;
    const doc = new PDFDocument({ margin: 40 });

    res.setHeader('Content-disposition', 'attachment; filename="audit-report.pdf"');
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(20).text(`Website Audit Report for ${r.url}`, { underline: true });
    doc.moveDown();
    doc.fontSize(14).text(`Overall Score: ${r.score}/100`);
    doc.moveDown(2);

    doc.fontSize(16).text("Security", { underline: true });
    doc.fontSize(11).list([ `HTTPS Status: ${r.security.https ? "Secure" : "Insecure"}`, `Missing Headers: ${r.security.missing.join(", ") || "None"}` ]).moveDown();

    doc.fontSize(16).text("Performance", { underline: true });
    doc.fontSize(11).list([ `Load Time: ${r.performance.loadTimeMs} ms`, `Resources Loaded: ${r.performance.resourceCount}`, `Data Transfer: ${(r.performance.totalTransferBytes / 1024).toFixed(1)} KB`, `DOM Nodes Rendered: ${r.performance.domCount}` ]).moveDown();

    doc.fontSize(16).text("SEO", { underline: true });
    doc.fontSize(11).list([ `Title Tag: ${r.seo.titleText || "Missing"}`, `Meta Description: ${r.seo.metaDescriptionText || "Missing"}`, `H1 Heading Count: ${r.seo.h1Count}`, `Images Missing ALT: ${r.seo.imgsWithoutAlt}` ]).moveDown();

    doc.fontSize(16).text("Accessibility", { underline: true });
    doc.fontSize(11).text(`Total Issues: ${r.accessibility.count}`);
    if(r.accessibility.issues.length > 0) {
        doc.fontSize(9);
        r.accessibility.issues.slice(0, 15).forEach(issue => doc.text(`- ${issue.message}`));
    }

    doc.end();
});

// --- WebSocket Bridge (remains the same) ---
const wss = new WebSocketServer({ server });
wss.on("connection", (browserSocket) => {
    const pythonSocket = new WebSocket("ws://localhost:8765");
    browserSocket.on("message", (message) => {
        if (pythonSocket.readyState === WebSocket.OPEN) pythonSocket.send(message);
    });
    pythonSocket.on("message", (message) => {
        if (browserSocket.readyState === WebSocket.OPEN) browserSocket.send(message.toString('utf-8'));
    });
    browserSocket.on("close", () => {
        if (pythonSocket.readyState === WebSocket.OPEN) pythonSocket.close();
    });
});

server.listen(PORT, () => console.log(`✅ Backend server running at http://localhost:${PORT}`));