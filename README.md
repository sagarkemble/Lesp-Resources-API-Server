# LESP Resources - File Upload/Delete Server (Google Drive API)

This is a Node.js backend server for the **LESP Resources LMS**. It handles file uploads/delete and stores them in Google Drive under dynamically created folders.Files are uploaded via HTTP requests and shared via public links.

---

## Purpose

- Upload files (e.g. notes, materials) to Google Drive.
- Automatically create folders if they don’t exist.
- Return a shareable webview Google Drive.
- Clean up temporary files after upload.

---

## Made using

- Node.js
- Express
- Multer (file uploads)
- Google Drive OAuth API (v3)
- Render for backend hosting  


