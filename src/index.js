import "dotenv/config";
import { google } from "googleapis";
import QRCode from "qrcode";
import puppeteer from "puppeteer";
import express from "express";
import {readFile} from "fs/promises";
import { pejabat } from "../config/pejabat.js";

const auth = new google.auth.GoogleAuth({
  keyFile: "./credentials/service-account.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});
function formatTanggalIndonesia(tanggal) {

  if (!tanggal) {
    return "";
  }

  const bulan = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember"
  ];

  const tanggalString = String(tanggal);

  const match = tanggalString.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (match) {

    const hari = match[1].padStart(2, "0");
    const nomorBulan = Number(match[2]);
    const tahun = match[3];

    return `${hari} ${bulan[nomorBulan - 1]} ${tahun}`;

  }

  return tanggalString;

}

async function getData() {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Form Responses 1!A2:N",
  });

    const dataTerakhir = result.data.values.at(-1);

    const tanggalSelesai = dataTerakhir[7];

    const tahun = tanggalSelesai
    ? tanggalSelesai.split("/")[2]
    : "";

    const mahasiswa = {
    nama: dataTerakhir[1],
    nim: dataTerakhir[2],
    universitas: dataTerakhir[3],
    fakultas: dataTerakhir[4],
    prodi: dataTerakhir[5],
    tanggalMulai: formatTanggalIndonesia(dataTerakhir[6]),
    tanggalSelesai: formatTanggalIndonesia(dataTerakhir[7]),
     tahun: tahun,
    nomorSertifikat: dataTerakhir[13],

//   nama: "Natasya Kusuma Putri",
//   nim: "123456789",
//   universitas: "Universitas Atma Jaya Yogyakarta",
//   fakultas: "Fakultas Hukum",
//   prodi: "Ilmu Hukum",

//   tanggalMulai: "01 September 2026",
//   tanggalSelesai: "30 September 2026",
//   tahun: "2026",
};
 //console.log(mahasiswa);
 return mahasiswa;
}

async function generateQR(mahasiswa) {
  const isiQR = `${mahasiswa.nama}
${mahasiswa.universitas}
${mahasiswa.nomorSertifikat}
www.kejari-sleman.go.id`;

  const qrDataURL = await QRCode.toDataURL(isiQR);

  return qrDataURL;
}


//console.log(qrDataURL);

async function loadTemplate() {
    const template = await readFile(
        "templates/certificate.html",
        "utf-8"
    );
    return template;
    
}

async function loadAsset(path) {
    const file = await readFile(path);
    const extension = path.split(".").pop();

    return `data:image/${extension};base64,${file.toString("base64")}`;
}

function fillTemplate(template, mahasiswa, qrDataURL, pejabat,background,logo){
return template
    .replaceAll("{{nama}}", mahasiswa.nama)
    .replaceAll("{{nim}}", mahasiswa.nim)
    .replaceAll("{{universitas}}", mahasiswa.universitas)
    .replaceAll("{{fakultas}}", mahasiswa.fakultas)
    .replaceAll("{{prodi}}", mahasiswa.prodi)
    .replaceAll("{{tanggalMulai}}", mahasiswa.tanggalMulai)
    .replaceAll("{{tanggalSelesai}}", mahasiswa.tanggalSelesai)
    .replaceAll(
        "{{tahun}}",
        new Date(mahasiswa.tanggalSelesai).getFullYear()
    )

    .replaceAll("{{tahun}}", mahasiswa.tahun)
    .replaceAll("{{nomorSertifikat}}", mahasiswa.nomorSertifikat)
    .replaceAll("{{qr}}", qrDataURL)
    .replaceAll("{{namaKajari}}", pejabat.nama)
    .replaceAll("{{pangkatKajari}}", pejabat.pangkat)
    .replaceAll("{{background}}", background)
    .replaceAll("{{logo}}", logo)
    //.replaceAll("{{nipKajari}}", pejabat.nip);
}

function generateFileName(mahasiswa){
    const nama = mahasiswa.nama;

    const nim = mahasiswa.nim
    .replace(/\s+/g, "")
    .replace(/[<>:"/\\|?*]/g, "");

    return `${nama}_${nim}.pdf`;

}

async function generatePDF (html, mahasiswa) {
    const browser = await puppeteer.launch();
    
    const page = await browser.newPage();
    await page.setContent(html, {
        waitUntil:"networkidle0",
    });

    const fileName = generateFileName(mahasiswa);

    await page.pdf({
    path: `./output/certificates/${fileName}`,
    format: "A4",
    landscape: true,
    printBackground: true,
  });

  await browser.close();
    
}

const background = await loadAsset(
    "./assets/background.png"
);

const logo = await loadAsset(
    "./assets/logo-kejaksaan.png"
);

async function generateCertificate() {

 
  const mahasiswa = await getData();

  const qrDataURL = await generateQR(mahasiswa);
  const template = await loadTemplate();

  const html = fillTemplate(
    template,
    mahasiswa,
    qrDataURL,
    pejabat,
    background,
    logo
  );

  await generatePDF(html, mahasiswa);

  console.log("PDF Berhasil dibuat");
}

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Certificate Generator aktif");
});

app.post("/generate-certificate", async (req, res) => {
  try {

    console.log("Request generate diterima");

    await generateCertificate();

    console.log("Generate selesai");

    res.json({
      success: true,
      message: "PDF berhasil dibuat",
    });

    } catch (error) {

    console.error("ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });

    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});