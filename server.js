const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const MLB_API = 'https://statsapi.mlb.com';

app.use(express.static(path.join(__dirname, 'public')));

// Get today's schedule (all games)
app.get('/api/schedule', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    // sportId=1 is MLB, but during spring training we need to include spring training games
    // hydrate=linescore gives us inning-by-inning, team gives full team info
    const url = `${MLB_API}/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore,team,probablePitcher&gameType=S,R,F,D,L,W`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Schedule fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Get live game feed (full play-by-play + pitch data)
app.get('/api/game/:gamePk/live', async (req, res) => {
  try {
    const { gamePk } = req.params;
    const url = `${MLB_API}/api/v1.1/game/${gamePk}/feed/live`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Live feed fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch live feed' });
  }
});

// Get boxscore
app.get('/api/game/:gamePk/boxscore', async (req, res) => {
  try {
    const { gamePk } = req.params;
    const url = `${MLB_API}/api/v1/game/${gamePk}/boxscore`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Boxscore fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch boxscore' });
  }
});

// Get Baseball Savant statcast data
app.get('/api/game/:gamePk/savant', async (req, res) => {
  try {
    const { gamePk } = req.params;
    const url = `https://baseballsavant.mlb.com/gf?game_pk=${gamePk}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Savant fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch savant data' });
  }
});

app.listen(PORT, () => {
  console.log(`MLB Live Dash running on port ${PORT}`);
});
