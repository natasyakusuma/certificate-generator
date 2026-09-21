import "dotenv/config";

import { google } from "googleapis";

import QRCode from "qrcode";

import puppeteer from "puppeteer";

import express from "express";

import {readFile} from "fs/promises";

import { pejabat } from "../config/pejabat.js";

import chromium from "@sparticuz/chromium";

import fs from "fs";


// Function untuk membuat QR Code dari data mahasiswa

async function generateQR(mahasiswa) {

  const isiQR = `${mahasiswa.nama}
${mahasiswa.universitas}
${mahasiswa.nomorSertifikat}
www.kejari-sleman.go.id`;

  const qrDataURL = await QRCode.toDataURL(isiQR);

  return qrDataURL;

}


//console.log(qrDataURL);


// Function untuk membaca template sertifikat HTML

async function loadTemplate() {

    const template = await readFile(

        "templates/certificate.html",

        "utf-8"

    );

    return template;

}


// Function untuk membaca file background dan logo

async function loadAsset(path) {

    const file = await readFile(path);

    const extension = path.split(".").pop();

    return `data:image/${extension};base64,${file.toString("base64")}`;

}


// Function untuk memasukkan data mahasiswa ke dalam template sertifikat

function fillTemplate(template, mahasiswa, qrDataURL, pejabat,background,logo){

return template

    .replaceAll("{{nama}}", String(mahasiswa.nama))

    .replaceAll("{{nim}}", String(mahasiswa.nim))

    .replaceAll("{{universitas}}", String(mahasiswa.universitas))

    .replaceAll("{{fakultas}}", String(mahasiswa.fakultas))

    .replaceAll("{{prodi}}", String(mahasiswa.prodi))

    .replaceAll("{{tanggalMulai}}", String(mahasiswa.tanggalMulai))

    .replaceAll("{{tanggalSelesai}}", String(mahasiswa.tanggalSelesai))

    .replaceAll("{{tahun}}", String(mahasiswa.tahun))

    .replaceAll("{{nomorSertifikat}}", String(mahasiswa.nomorSertifikat))

    .replaceAll("{{qr}}", qrDataURL)

    .replaceAll("{{namaKajari}}", pejabat.nama)

    .replaceAll("{{pangkatKajari}}", pejabat.pangkat)

    .replaceAll("{{background}}", background)

    .replaceAll("{{logo}}", logo)

    //.replaceAll("{{nipKajari}}", pejabat.nip);

}


// Function untuk membuat nama file PDF berdasarkan nama dan NIM mahasiswa

function generateFileName(mahasiswa){

    const nama = String(mahasiswa.nama);

    const nim = String(mahasiswa.nim)

    .replace(/\s+/g, "")

    .replace(/[<>:"/\\|?*]/g, "");

    return `${nama}_${nim}.pdf`;

}


// Function untuk membuat file PDF dari HTML sertifikat

async function generatePDF (html, mahasiswa) {

  console.log("Chromium executable path:", await chromium.executablePath());  

  const browser = await puppeteer.launch({

        executablePath: await chromium.executablePath(),

        args: chromium.args,

        headless: true,

    });

    const page = await browser.newPage();

    await page.setContent(html, {

        waitUntil:"networkidle0",

    });

    const fileName = generateFileName(mahasiswa);

    fs.mkdirSync("./output/certificates", {

    recursive: true,

    });

    await page.pdf({

    path: `./output/certificates/${fileName}`,

    format: "A4",

    landscape: true,

    printBackground: true,

  });

    await browser.close();

    const filePath = `./output/certificates/${fileName}`;

    const driveFile = await uploadToDrive(

        filePath,

        fileName

    );

    return driveFile;

}


// Function untuk mengupload file PDF ke Google Drive

async function uploadToDrive(filePath, fileName) {

    const driveAuth = new google.auth.OAuth2(

        process.env.GOOGLE_DRIVE_CLIENT_ID,

        process.env.GOOGLE_DRIVE_CLIENT_SECRET

    );

    driveAuth.setCredentials({

        refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,

    });

    const drive = google.drive({

        version: "v3",

        auth: driveAuth,

    });

    const response = await drive.files.create({

        requestBody: {

            name: fileName,

            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],

        },

        media: {

            mimeType: "application/pdf",

            body: fs.createReadStream(filePath),

        },

        fields: "id, name, webViewLink",

    });

    return response.data;

}


// Membaca background dan logo yang digunakan pada sertifikat

const background = await loadAsset(

    "./assets/background.png"

);

const logo = await loadAsset(

    "./assets/logo-kejaksaan.png"

);


// Function untuk menjalankan proses pembuatan sertifikat

async function generateCertificate(mahasiswa) {

  //const mahasiswa = await getData();

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

  const driveFile = await generatePDF(html, mahasiswa);

  console.log("PDF Berhasil dibuat");

  console.log("File Drive:", driveFile);

}


// Membuat aplikasi Express

const app = express();

app.use(express.json());


// Function untuk menerima request pembuatan sertifikat

app.get("/", (req, res) => {

  res.send("Certificate Generator aktif");

});

app.post("/generate-certificate", async (req, res) => {

  try {

    console.log("Request generate diterima");

    const mahasiswa = req.body;

    await generateCertificate(mahasiswa);

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