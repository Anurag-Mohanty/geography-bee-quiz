require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const pdf = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

// Set up Google Drive API
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

async function listFiles(folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/pdf'`,
    fields: 'files(id, name)',
  });
  return res.data.files;
}

async function downloadAndParsePDF(fileId, fileName) {
  const tempFilePath = path.join('/tmp', fileName);
  const dest = fs.createWriteStream(tempFilePath);
  const res = await drive.files.get(
    { fileId: fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  await new Promise((resolve, reject) => {
    res.data
      .on('end', resolve)
      .on('error', reject)
      .pipe(dest);
  });

  const dataBuffer = await fs.readFile(tempFilePath);
  const data = await pdf(dataBuffer);
  await fs.unlink(tempFilePath);  // Delete the temp file

  return parseQuestionsFromText(data.text);
}

app.get('/api/questions', async (req, res) => {
  try {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const files = await listFiles(folderId);
    let allQuestions = [];

    for (const file of files) {
      const questions = await downloadAndParsePDF(file.id, file.name);
      allQuestions = allQuestions.concat(questions);
    }

    res.json(allQuestions);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred while fetching questions' });
  }
});

function parseQuestionsFromText(text) {
  // Implement your parsing logic here
  // This is a basic example and may need to be adjusted based on your PDF structure
  const questions = [];
  const lines = text.split('\n');
  let currentQuestion = null;

  for (const line of lines) {
    if (line.startsWith('Q:')) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      currentQuestion = { question: line.substring(2).trim(), clues: [], answer: '' };
    } else if (line.startsWith('A:') && currentQuestion) {
      currentQuestion.answer = line.substring(2).trim();
    } else if (line.trim() && currentQuestion) {
      currentQuestion.clues.push(line.trim());
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));