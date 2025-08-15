const express = require("express");
const multer = require("multer");
const { Readable } = require("stream");
const cors = require("cors");
const { google } = require("googleapis");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// Use in-memory storage for faster uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

async function ensureFolderExists(folderName, parentId) {
  const result = await drive.files.list({
    q: `'${parentId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (result.data.files.length > 0) {
    return result.data.files[0].id;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  return folder.data.id;
}

async function resolveFolderPath(pathString, rootFolderId) {
  const folders = pathString.split("/").filter(Boolean);
  let currentFolderId = rootFolderId;

  for (const folder of folders) {
    currentFolderId = await ensureFolderExists(folder, currentFolderId);
  }

  return currentFolderId;
}

// Upload endpoint using memory storage
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.body.path) {
      return res.status(400).json({ error: "Missing file or path" });
    }

    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;
    const targetPath = req.body.path;

    const targetFolderId = await resolveFolderPath(targetPath, "root");

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId],
      },
      media: {
        mimeType: req.file.mimetype,
        body: Readable.from(fileBuffer),
      },
      fields: "id",
      supportsAllDrives: true,
    });

    const fileId = response.data.id;

    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });

    res.json({
      success: true,
      fileId,
      webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
    });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete file from Google Drive
app.post("/delete", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "No file ID provided" });
    }

    await drive.files.delete({
      fileId: id,
      supportsAllDrives: true,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export for Vercel
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
