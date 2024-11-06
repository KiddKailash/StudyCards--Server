const express = require('express');
const cors = require('cors');
const { YoutubeTranscript } = require('youtube-transcript');

const app = express();
const PORT = process.env.PORT || 5002;

app.use(
  cors({
    origin: '*', // Replace with your frontend URL in production for security
  }),
);

app.use(express.json());

// Test route to check YouTube connectivity (optional)
app.get('/test-connection', (req, res) => {
  const https = require('https');
  https
    .get('https://www.youtube.com', (response) => {
      res.status(200).send('Able to access YouTube');
    })
    .on('error', (e) => {
      console.error('Error accessing YouTube:', e);
      res.status(500).send('Unable to access YouTube');
    });
});

// Main endpoint to fetch transcript
app.get('/transcript', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    res.status(400).json({ error: "Missing 'url' query parameter" });
    return;
  }

  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    res.status(400).json({ error: 'Invalid YouTube URL' });
    return;
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    res.json(transcript);
  } catch (error) {
    console.error('Error fetching transcript:', error);

    // Handle specific errors
    if (error.message.includes('Could not retrieve transcript')) {
      res.status(404).json({
        error: 'Transcript not found',
        details: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Error fetching transcript',
        details: error.message,
        // stack: error.stack, // Uncomment for debugging; remove in production
      });
    }
  }
});

// Improved function to extract video ID from YouTube URLs
function extractVideoId(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    } else if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      return urlObj.searchParams.get('v');
    } else {
      return null;
    }
  } catch (e) {
    console.error('Error parsing URL:', e);
    return null;
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});