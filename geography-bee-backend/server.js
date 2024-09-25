require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const PORT = process.env.PORT || 3001;
const PORT_MIN = 3001;
const PORT_MAX = 3010;

const app = express();
app.use(cors());
app.use(express.json());

let drive;
try {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS),
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    drive = google.drive({ version: 'v3', auth });
    console.log('Google Drive client initialized successfully');
} catch (error) {
    console.error('Error setting up Google Auth:', error);
}

let cachedQuestions = [];
const CACHE_FILE = path.join(__dirname, 'questionCache.json');

// Reset Cache to remove old data
async function resetCache() {
    if (fs.existsSync(CACHE_FILE)) {
        console.log('Deleting old cache...');
        await fs.promises.unlink(CACHE_FILE);
    }
}

// Load questions from cache or fresh from Google Drive
async function loadQuestionsWithCache() {
    if (fs.existsSync(CACHE_FILE)) {
        const cacheData = await fs.promises.readFile(CACHE_FILE, 'utf8');
        cachedQuestions = JSON.parse(cacheData);
        console.log(`Loaded ${cachedQuestions.length} questions from cache`);
        return;
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const files = await listFiles(folderId);

    for (const file of files) {
        const questions = await downloadAndParsePDF(file.id, file.name);
        cachedQuestions = cachedQuestions.concat(questions);
    }

    await fs.promises.writeFile(CACHE_FILE, JSON.stringify(cachedQuestions, null, 2));
    console.log(`Cached ${cachedQuestions.length} questions`);
}

// Refresh cache and reload questions
async function refreshQuestionCache() {
    console.log('Refreshing question cache...');
    await resetCache();
    await loadQuestionsWithCache();
    console.log('Question cache refreshed');
}

// List PDF files in the Google Drive folder
async function listFiles(folderId) {
    if (!drive) {
        throw new Error('Google Drive client not initialized');
    }
    try {
        const res = await drive.files.list({
            q: `'${folderId}' in parents and mimeType='application/pdf'`,
            fields: 'files(id, name)',
        });
        return res.data.files;
    } catch (error) {
        console.error('Error listing files:', error.message);
        throw error;
    }
}

// Download and parse the PDF file using pdf-parse
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

    const dataBuffer = await fs.promises.readFile(tempFilePath);
    const data = await pdf(dataBuffer);
    await fs.promises.unlink(tempFilePath);

    const questions = extractQuestionsFromText(data.text, fileName);
    return questions;
}

// Preprocess the text to clean up formatting artifacts
function preprocessText(text) {
  return text
      .replace(/\n/g, ' ')  // Replace newlines with spaces
      .replace(/\s+/g, ' ')  // Normalize spaces
      .replace(/2020-21|2021-22|Round \d+|Page \d+/g, '')  // Remove headers, page numbers, etc.
      .trim();
}

function extractQuestionsFromText(text, fileName) {
  console.log('Starting question extraction process...');
  text = preprocessText(text);

  const questions = [];
  const questionRegex = /\((\d+)\)\s*(.*?)\s*ANSWER:\s*(.*?)(?=\(\d+\)|$)/gs;

  let match;
  while ((match = questionRegex.exec(text)) !== null) {
      const [, questionNumber, questionText, rawAnswerText] = match;
      const cleanAnswer = rawAnswerText.split(/\.\s|ANSWER/)[0].trim();

      const clues = createClues(questionText);

      questions.push({
          questionNumber: parseInt(questionNumber),
          question: questionText.trim(),
          answer: cleanAnswer,
          clues,
          sourceFile: fileName
      });

      console.log(`Extracted question ${questionNumber}:`, questionText.trim());
      console.log(`Extracted clues:`, clues);
  }

  console.log(`Parsed ${questions.length} valid questions from ${fileName}`);
  return questions;
}

function createClues(text) {
  // Remove the question number if present
  text = text.replace(/^\(\d+\)\s*/, '');

  // Split the text into main content and "For the point" part
  const parts = text.split(/For the point,/i);
  const mainText = parts[0].trim();
  const forThePointText = parts.length > 1 ? "For the point, " + parts[1].trim() : "";

  // Temporarily replace "Mt." with a placeholder to avoid splitting
  let preprocessedText = mainText.replace(/\bMt\./g, 'MT_PLACEHOLDER');

  // Use a regex to split sentences while avoiding the "MT_PLACEHOLDER"
  const sentenceRegex = /(?<=\.)\s+(?=[A-Z])/g;
  let sentences = preprocessedText.split(sentenceRegex).map(s => s.trim()).filter(s => s.length > 0);

  // Restore the "Mt." placeholder back to its original form
  sentences = sentences.map(sentence => sentence.replace(/MT_PLACEHOLDER/g, 'Mt.'));

  // Create clues, ensuring no empty strings are added
  const clues = [];
  const targetLength = Math.ceil(mainText.length / 3); // Aim for 3 clues plus the "For the point" text

  let currentClue = '';
  sentences.forEach((sentence, index) => {
      if (currentClue.length + sentence.length > targetLength && clues.length < 2) {
          if (currentClue.trim()) { // Check to avoid adding empty strings
              clues.push(currentClue.trim());
          }
          currentClue = sentence;
      } else {
          currentClue += (currentClue ? ' ' : '') + sentence;
      }
  });

  if (currentClue.trim()) {
      clues.push(currentClue.trim());  // Add the final clue if it's not empty
  }

  // Add the "For the point" text as the last clue
  if (forThePointText) {
      clues.push(forThePointText);
  }

  // Ensure the total number of clues is 4 by splitting or combining as needed
  while (clues.length < 4) {
      const longestClueIndex = clues.reduce((maxIndex, clue, index, arr) =>
          clue.length > arr[maxIndex].length ? index : maxIndex, 0);

      const clueToSplit = clues[longestClueIndex];
      const splitIndex = clueToSplit.lastIndexOf('.', Math.floor(clueToSplit.length / 2)) + 1;

      if (splitIndex > 0) {
          const firstHalf = clueToSplit.substring(0, splitIndex).trim();
          const secondHalf = clueToSplit.substring(splitIndex).trim();
          clues[longestClueIndex] = firstHalf;
          clues.splice(longestClueIndex + 1, 0, secondHalf);
      } else {
          // If we can't split, add a placeholder
          clues.push("Additional information not available.");
      }
  }

  // If we have more than 4 clues, combine the shortest adjacent clues
  while (clues.length > 4) {
      let shortestPairIndex = 0;
      let shortestPairLength = Infinity;

      for (let i = 0; i < clues.length - 1; i++) {
          const pairLength = clues[i].length + clues[i + 1].length;
          if (pairLength < shortestPairLength) {
              shortestPairIndex = i;
              shortestPairLength = pairLength;
          }
      }

      clues[shortestPairIndex] += ' ' + clues[shortestPairIndex + 1];
      clues.splice(shortestPairIndex + 1, 1);
  }

  return clues;
}

// API endpoint to serve questions
app.get('/api/questions', async (req, res) => {
    const pageSize = parseInt(req.query.pageSize) || 10;

    // Shuffle the entire array of questions
    const shuffledQuestions = [...cachedQuestions].sort(() => 0.5 - Math.random());

    // Take the first pageSize questions
    const questionsToShow = shuffledQuestions.slice(0, pageSize).map(
      ({ questionNumber, question, answer, clues, sourceFile }) => ({
        questionNumber,
        question,
        answer,
        clues,
        sourceFile
      })
    );

    res.json({
      questions: questionsToShow,
      totalQuestions: cachedQuestions.length,
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).send('API is running');
});

// Endpoint to refresh the question cache
app.get('/api/refresh-cache', async (req, res) => {
    try {
        await refreshQuestionCache();
        res.json({ message: 'Question cache refreshed successfully!' });
    } catch (error) {
        console.error('Error refreshing cache:', error);
        res.status(500).json({ message: 'Error refreshing cache' });
    }
});

// Load questions on server start
loadQuestionsWithCache()
    .then(() => refreshQuestionCache())
    .catch(console.error);

function startServer(port) {
    const server = app.listen(port, () => {
        const actualPort = server.address().port;
        console.log(`Server running on port ${actualPort}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE' && port < PORT_MAX) {
            startServer(port + 1);
        } else {
            console.error('No available ports in the specified range', err);
        }
    });
}

if (process.env.NODE_ENV === 'production') {
  // In production (Heroku), use the PORT environment variable
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
} else {
  // In development, use the dynamic port selection
  const providedPort = process.argv[2] ? parseInt(process.argv[2].split('=')[1], 10) : null;
  startServer(providedPort || PORT_MIN);
}

// Serve static files from the React build in frontend
app.use(express.static(path.join(__dirname, '..', 'geography-bee-frontend', 'build')));

// The "catchall" handler: for any request that doesn't match an API route, send back the React index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'geography-bee-frontend', 'build', 'index.html'));
});