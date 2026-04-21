import express from 'express';
import axios from 'axios';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

const router = express.Router();

// Preview DOCX file - convert to HTML
router.post('/preview/docx', async (req, res) => {
  try {
    const { fileUrl } = req.body;
    
    if (!fileUrl) {
      return res.status(400).json({ error: 'fileUrl is required' });
    }

    // Download file
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    // Convert to HTML
    const result = await mammoth.convertToHtml({ buffer });
    
    res.json({
      html: result.value,
      messages: result.messages,
    });
  } catch (error: any) {
    console.error('Error previewing DOCX:', error);
    res.status(500).json({ error: error.message || 'Failed to preview DOCX' });
  }
});

// Preview XLSX file - convert to JSON
router.post('/preview/xlsx', async (req, res) => {
  try {
    const { fileUrl, maxRows = 50 } = req.body;
    
    if (!fileUrl) {
      return res.status(400).json({ error: 'fileUrl is required' });
    }

    // Download file
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    // Parse Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON (limit rows)
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const previewData = jsonData.slice(0, maxRows);
    
    res.json({
      sheetNames: workbook.SheetNames,
      currentSheet: sheetName,
      data: previewData,
      totalRows: jsonData.length,
      previewRows: previewData.length,
    });
  } catch (error: any) {
    console.error('Error previewing XLSX:', error);
    res.status(500).json({ error: error.message || 'Failed to preview XLSX' });
  }
});

// Preview text-based files
router.post('/preview/text', async (req, res) => {
  try {
    const { fileUrl, maxBytes = 50000 } = req.body; // Max 50KB preview
    
    if (!fileUrl) {
      return res.status(400).json({ error: 'fileUrl is required' });
    }

    // Download file with byte limit
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      maxContentLength: maxBytes,
    });
    
    const text = Buffer.from(response.data).toString('utf-8');
    
    res.json({
      text,
      truncated: response.data.length >= maxBytes,
    });
  } catch (error: any) {
    console.error('Error previewing text:', error);
    res.status(500).json({ error: error.message || 'Failed to preview text' });
  }
});

// Preview PPTX file - extract text from slides
router.post('/preview/pptx', async (req, res) => {
  try {
    const { fileUrl, maxSlides = 5 } = req.body;
    
    if (!fileUrl) {
      return res.status(400).json({ error: 'fileUrl is required' });
    }

    // Download file
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    // For now, just return basic info since pptx parsing is complex
    // In production, you'd use a library like pptx2json or officegen
    res.json({
      message: 'PowerPoint preview',
      fileName: fileUrl.split('/').pop(),
      fileSize: buffer.length,
      note: 'Vui lòng tải xuống để xem chi tiết',
    });
  } catch (error: any) {
    console.error('Error previewing PPTX:', error);
    res.status(500).json({ error: error.message || 'Failed to preview PPTX' });
  }
});

export default router;
