const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const pdf = require('pdf-parse');
const fs = require('fs');

const app = express();
app.use(cors());

// Google Drive setup will go here

app.get('/api/questions', async (req, res) => {
  // PDF fetching and parsing logic will go here
});

function parseQuestionsFromText(text) {
  // Question parsing logic will go here
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});