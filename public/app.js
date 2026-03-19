// ============================================================
// MLB Live Dash — Frontend Application
// ============================================================

// MLB team colors — brightened for dark backgrounds
const TEAM_COLORS = {
  108: '#e4404e', // LAA Angels
  109: '#e4404e', // AZ Diamondbacks
  110: '#f56b3e', // BAL Orioles
  111: '#e44a52', // BOS Red Sox
  112: '#3a7bdb', // CHC Cubs
  113: '#e44a4a', // CIN Reds
  114: '#3a7bdb', // CLE Guardians
  115: '#7b6db5', // COL Rockies
  116: '#f56b3e', // DET Tigers
  117: '#f56b3e', // HOU Astros
  118: '#5b9bd5', // KC Royals
  119: '#5b9bd5', // LAD Dodgers
  120: '#e44a52', // WSH Nationals
  121: '#f56b3e', // NYM Mets
  133: '#50a86e', // OAK Athletics
  134: '#f5c842', // PIT Pirates
  135: '#8b6f3a', // SD Padres (tan/brown)
  136: '#3a8e8e', // SEA Mariners (teal)
  137: '#f56b3e', // SF Giants
  138: '#e44a52', // STL Cardinals
  139: '#6bb5e0', // TB Rays
  140: '#5b9bd5', // TEX Rangers
  141: '#5b9bd5', // TOR Blue Jays
  142: '#e44a52', // MIN Twins
  143: '#e44a52', // PHI Phillies
  144: '#e44a52', // ATL Braves
  145: '#8e8e8e', // CWS White Sox
  146: '#55c9e8', // MIA Marlins
  147: '#5b7b9b', // NYY Yankees (steel blue)
  158: '#d4a94e', // MIL Brewers (gold)
  160: '#50a86e', // OAK Athletics
};

// Fallback: get a team color, default to accent
function getTeamColor(teamId) {
  return TEAM_COLORS[teamId] || '#5b8cc9';
}

let currentGamePk = null;
let refreshInterval = null;
const REFRESH_MS = 16000;

// Track which pitcher detail rows are expanded (by pitcher ID)
const expandedPitchers = new Set();

// ---- DOM ----
const dateInput = document.getElementById('game-date');

// Fix timezone issue: use local date parts instead of ISO which can shift to next day
const now = new Date();
const todayStr = now.getFullYear() + '-' +
  String(now.getMonth() + 1).padStart(2, '0') + '-' +
  String(now.getDate()).padStart(2, '0');
dateInput.value = todayStr;

// ---- Date Navigation ----
document.getElementById('prev-day').addEventListener('click', () => {
  const d = new Date(dateInput.value + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  dateInput.value = d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
  loadSchedule();
});

document.getElementById('next-day').addEventListener('click', () => {
  const d = new Date(dateInput.value + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  dateInput.value = d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
  loadSchedule();
});

dateInput.addEventListener('change', loadSchedule);

// ---- Back Button ----
document.getElementById('back-btn').addEventListener('click', () => {
  currentGamePk = null;
  expandedPitchers.clear();
  stopAutoRefresh();
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('game-selector').classList.remove('hidden');
  loadSchedule();
});

// ---- Manual Refresh ----
document.getElementById('refresh-btn').addEventListener('click', () => {
  if (currentGamePk) {
    loadGameData();
  } else {
    loadSchedule();
  }
});

function stopAutoRefresh() {
  clearInterval(refreshInterval);
}

// ============================================================
// SCHEDULE
// ============================================================

async function loadSchedule() {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '<div class="no-data">Loading games...</div>';

  try {
    const res = await fetch(`/api/schedule?date=${dateInput.value}`);
    const data = await res.json();
    const games = data.dates?.[0]?.games || [];

    if (games.length === 0) {
      grid.innerHTML = '<div class="no-data">No games scheduled</div>';
      return;
    }

    grid.innerHTML = '';
    games.forEach(game => {
      const card = document.createElement('div');
      card.className = 'game-card';

      const status = game.status?.detailedState || '';
      const isLive = ['In Progress', 'Warmup', 'Manager Challenge'].includes(status);
      if (isLive) card.classList.add('live');

      const away = game.teams?.away;
      const home = game.teams?.home;
      const ls = game.linescore;

      const awayRuns = ls?.teams?.away?.runs ?? '';
      const homeRuns = ls?.teams?.home?.runs ?? '';
      const awayName = away?.team?.abbreviation || away?.team?.name || 'TBD';
      const homeName = home?.team?.abbreviation || home?.team?.name || 'TBD';

      let statusText = '';
      let statusClass = '';
      let timeText = '';
      let hasScore = false;

      if (isLive) {
        const half = ls?.isTopInning ? 'TOP' : 'BOT';
        statusText = `LIVE — ${half} ${ls?.currentInning || ''}`;
        statusClass = 'live-status';
        hasScore = true;
      } else if (status === 'Final' || status === 'Game Over' || status === 'Completed Early') {
        statusText = status === 'Completed Early' ? 'FINAL (Early)' : 'FINAL';
        hasScore = true;
      } else {
        statusText = status.toUpperCase();
        if (game.gameDate) {
          timeText = new Date(game.gameDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        }
      }

      const awayWinning = Number(awayRuns) > Number(homeRuns);
      const homeWinning = Number(homeRuns) > Number(awayRuns);

      const awayTeamId = away?.team?.id;
      const homeTeamId = home?.team?.id;
      const awayColor = getTeamColor(awayTeamId);
      const homeColor = getTeamColor(homeTeamId);

      card.innerHTML = `
        <div class="card-top">
          <span class="card-status ${statusClass}">${statusText}</span>
          <span class="card-time">${timeText}</span>
        </div>
        <div class="card-teams">
          <div class="card-team-row ${hasScore && awayWinning ? 'winning' : hasScore ? 'losing' : ''}">
            <span class="card-team-name" style="color: ${awayColor};">${awayName}</span>
            <span class="card-team-score">${hasScore ? awayRuns : ''}</span>
          </div>
          <div class="card-team-row ${hasScore && homeWinning ? 'winning' : hasScore ? 'losing' : ''}">
            <span class="card-team-name" style="color: ${homeColor};">${homeName}</span>
            <span class="card-team-score">${hasScore ? homeRuns : ''}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => selectGame(game.gamePk));
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<div class="no-data">Error: ${err.message}</div>`;
  }
}

// ============================================================
// GAME SELECTION & DATA
// ============================================================

function selectGame(gamePk) {
  currentGamePk = gamePk;
  expandedPitchers.clear();
  document.getElementById('game-selector').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadGameData();

  stopAutoRefresh();
  refreshInterval = setInterval(() => {
    loadGameData();
  }, REFRESH_MS);
}

async function loadGameData() {
  if (!currentGamePk) return;
  try {
    const res = await fetch(`/api/game/${currentGamePk}/live`);
    const data = await res.json();
    renderScoreboard(data);
    renderMatchup(data);
    computeAndRenderStats(data);
    document.getElementById('last-update').textContent =
      new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  } catch (err) {
    console.error('Error loading game:', err);
  }
}

// ============================================================
// SCOREBOARD
// ============================================================

function renderScoreboard(data) {
  const gd = data.gameData;
  const ls = data.liveData?.linescore;

  const awayAbbr = gd?.teams?.away?.abbreviation || '';
  const homeAbbr = gd?.teams?.home?.abbreviation || '';
  const awayTeamId = gd?.teams?.away?.id;
  const homeTeamId = gd?.teams?.home?.id;

  document.getElementById('away-name').textContent = awayAbbr;
  document.getElementById('home-name').textContent = homeAbbr;
  document.getElementById('away-name').style.color = getTeamColor(awayTeamId);
  document.getElementById('home-name').style.color = getTeamColor(homeTeamId);
  document.getElementById('away-score').textContent = ls?.teams?.away?.runs ?? 0;
  document.getElementById('home-score').textContent = ls?.teams?.home?.runs ?? 0;

  const status = gd?.status?.detailedState || '';
  const isLive = ['In Progress', 'Warmup', 'Manager Challenge'].includes(status);

  if (isLive) {
    const half = ls?.isTopInning ? 'TOP' : 'BOT';
    document.getElementById('inning').textContent = `${half} ${ls?.currentInning || ''}`;
    document.getElementById('outs').textContent = `${ls?.outs ?? 0} OUT${ls?.outs !== 1 ? 'S' : ''}`;
    document.getElementById('count').textContent = `${ls?.balls ?? 0}-${ls?.strikes ?? 0}`;
  } else {
    document.getElementById('inning').textContent = status.toUpperCase();
    document.getElementById('outs').textContent = '';
    document.getElementById('count').textContent = '';
  }

  const offense = ls?.offense || {};
  setBase('base-1', !!offense.first);
  setBase('base-2', !!offense.second);
  setBase('base-3', !!offense.third);

  renderLinescoreTable(ls, gd);
}

function setBase(id, occupied) {
  const el = document.getElementById(id);
  if (occupied) el.classList.add('occupied');
  else el.classList.remove('occupied');
}

function renderLinescoreTable(ls, gd) {
  const container = document.getElementById('linescore-container');
  if (!ls?.innings?.length) { container.innerHTML = ''; return; }

  const awayAbbr = gd?.teams?.away?.abbreviation || 'AWAY';
  const homeAbbr = gd?.teams?.home?.abbreviation || 'HOME';
  const awayLsColor = getTeamColor(gd?.teams?.away?.id);
  const homeLsColor = getTeamColor(gd?.teams?.home?.id);
  const cur = ls.currentInning || 0;

  let h = '<table class="linescore-table"><thead><tr><th></th>';
  ls.innings.forEach(inn => {
    h += `<th class="${inn.num === cur ? 'current-inning' : ''}">${inn.num}</th>`;
  });
  h += '<th class="totals">R</th><th class="totals">H</th><th class="totals">E</th></tr></thead><tbody>';

  const sideData = [['away', awayAbbr, awayLsColor], ['home', homeAbbr, homeLsColor]];
  sideData.forEach(([side, abbr, color]) => {
    h += `<tr><td><strong style="color: ${color};">${abbr}</strong></td>`;
    ls.innings.forEach(inn => {
      h += `<td class="${inn.num === cur ? 'current-inning' : ''}">${inn[side]?.runs ?? ''}</td>`;
    });
    h += `<td class="totals">${ls.teams?.[side]?.runs ?? 0}</td>`;
    h += `<td class="totals">${ls.teams?.[side]?.hits ?? 0}</td>`;
    h += `<td class="totals">${ls.teams?.[side]?.errors ?? 0}</td></tr>`;
  });

  h += '</tbody></table>';
  container.innerHTML = h;
}

// ============================================================
// MATCHUP BAR
// ============================================================

function renderMatchup(data) {
  const ls = data.liveData?.linescore;
  document.getElementById('current-pitcher').textContent =
    ls?.defense?.pitcher?.fullName || '--';
  document.getElementById('current-batter').textContent =
    ls?.offense?.batter?.fullName || '--';
}

// ============================================================
// STAT COMPUTATION ENGINE
// ============================================================

function computeAndRenderStats(data) {
  const allPlays = data.liveData?.plays?.allPlays || [];

  const pitcherMap = {};
  const hitterMap = {};
  const teamRisp = { away: { ab: 0, hits: 0 }, home: { ab: 0, hits: 0 } };

  const awayId = data.gameData?.teams?.away?.id;
  const homeId = data.gameData?.teams?.home?.id;

  allPlays.forEach(play => {
    const pitcherId = play.matchup?.pitcher?.id;
    const pitcherName = play.matchup?.pitcher?.fullName || 'Unknown';
    const batterId = play.matchup?.batter?.id;
    const batterName = play.matchup?.batter?.fullName || 'Unknown';
    const batterTeamId = play.matchup?.batter?.id ? getBatterTeamId(play, data) : null;

    if (!pitcherId || !batterId) return;

    if (!pitcherMap[pitcherId]) {
      pitcherMap[pitcherId] = {
        id: pitcherId,
        name: pitcherName,
        firstPitchStrikes: 0,
        firstPitchTotal: 0,
        pitchTypeCounts: {},
        pitchTypeHits: {},
        pitchTypeABs: {},
        pitchTypeDetails: {},
        pitchTypeStrikeouts: {}, // pitch type -> strikeout count
        threeBallCounts: 0,
        fullCounts: 0,
        totalPitches: 0,
        strikeouts: 0,
        rispAB: 0,
        rispHits: 0
      };
    }

    const batSide = play.matchup?.batSide?.code || '?';

    if (!hitterMap[batterId]) {
      hitterMap[batterId] = {
        name: batterName,
        batSide: batSide,
        teamId: batterTeamId,
        pitchesSeen: 0,
        pa: 0,
        hits: 0,
        pitchTypesSeen: {}
      };
    }

    const p = pitcherMap[pitcherId];
    const hitter = hitterMap[batterId];
    const events = play.playEvents || [];

    const hasRisp = play.runners?.some(r => {
      const startBase = r.movement?.start;
      return startBase === '2B' || startBase === '3B';
    }) || false;

    let balls = 0;
    let strikes = 0;
    let isFirstPitch = true;
    let reachedThreeBall = false;
    let reachedFullCount = false;
    let lastPitchType = null;

    events.forEach(evt => {
      if (!evt.isPitch) return;

      const pitchType = evt.details?.type?.description || evt.details?.type?.code || 'Unknown';
      lastPitchType = pitchType;
      const code = evt.details?.code || '';

      p.totalPitches++;
      hitter.pitchesSeen++;
      p.pitchTypeCounts[pitchType] = (p.pitchTypeCounts[pitchType] || 0) + 1;
      hitter.pitchTypesSeen[pitchType] = (hitter.pitchTypesSeen[pitchType] || 0) + 1;

      if (!p.pitchTypeDetails[pitchType]) {
        p.pitchTypeDetails[pitchType] = {
          balls: 0, calledStrikes: 0, swingingStrikes: 0, fouls: 0,
          inPlay: 0, swings: 0, whiffs: 0, total: 0
        };
      }
      const d = p.pitchTypeDetails[pitchType];
      d.total++;

      const ballCodes = ['B', 'I', 'P', 'V'];
      const calledStrikeCodes = ['C'];
      const swingStrikeCodes = ['S', 'T', 'M', 'O', 'Q', 'R', 'W'];
      const foulCodes = ['F', 'L'];
      const inPlayCodes = ['X', 'D', 'E'];

      if (ballCodes.includes(code)) {
        d.balls++;
      } else if (calledStrikeCodes.includes(code)) {
        d.calledStrikes++;
      } else if (swingStrikeCodes.includes(code)) {
        d.swingingStrikes++;
        d.swings++;
        d.whiffs++;
      } else if (foulCodes.includes(code)) {
        d.fouls++;
        d.swings++;
      } else if (inPlayCodes.includes(code)) {
        d.inPlay++;
        d.swings++;
      }

      if (isFirstPitch) {
        p.firstPitchTotal++;
        const strikeCodes = ['C', 'S', 'F', 'T', 'L', 'M', 'O', 'Q', 'R', 'W', 'X', 'D', 'E'];
        if (strikeCodes.includes(code)) p.firstPitchStrikes++;
        isFirstPitch = false;
      }

      if (ballCodes.includes(code)) {
        balls++;
      } else if (!foulCodes.includes(code) || strikes < 2) {
        if (foulCodes.includes(code) && strikes < 2) strikes++;
        else if (!ballCodes.includes(code) && !foulCodes.includes(code)) strikes++;
      }

      if (balls >= 3 && !reachedThreeBall) { p.threeBallCounts++; reachedThreeBall = true; }
      if (balls >= 3 && strikes >= 2 && !reachedFullCount) { p.fullCounts++; reachedFullCount = true; }
    });

    // Result tracking
    const result = play.result?.event || '';
    const isHit = ['Single', 'Double', 'Triple', 'Home Run'].includes(result);
    const isStrikeout = result === 'Strikeout' || result === 'Strikeout Double Play';
    const nonABEvents = ['Walk', 'Hit By Pitch', 'Intent Walk', 'Sac Bunt', 'Sac Fly',
                         'Catcher Interference', 'Fan interference'];
    const isAB = result !== '' && !nonABEvents.includes(result);

    if (lastPitchType && isAB) {
      p.pitchTypeABs[lastPitchType] = (p.pitchTypeABs[lastPitchType] || 0) + 1;
      if (isHit) p.pitchTypeHits[lastPitchType] = (p.pitchTypeHits[lastPitchType] || 0) + 1;
    }

    // Strikeout pitch tracking
    if (isStrikeout && lastPitchType) {
      p.strikeouts++;
      p.pitchTypeStrikeouts[lastPitchType] = (p.pitchTypeStrikeouts[lastPitchType] || 0) + 1;
    }

    // Hitter PA/Hit tracking - PA includes walks, HBP, sac, etc.
    if (result !== '') {
      hitter.pa++;
      if (isHit) hitter.hits++;
    }

    // RISP
    if (hasRisp && isAB) {
      p.rispAB++;
      if (isHit) p.rispHits++;
      if (batterTeamId === awayId) { teamRisp.away.ab++; if (isHit) teamRisp.away.hits++; }
      else if (batterTeamId === homeId) { teamRisp.home.ab++; if (isHit) teamRisp.home.hits++; }
    }
  });

  renderPitcherPanel(pitcherMap, data);
  renderHitterPanel(hitterMap, data);
  renderRISP(pitcherMap, teamRisp, data);
  renderAllPitchersSummary(pitcherMap);
  renderAllHittersSummary(hitterMap, data);
}

function getBatterTeamId(play, data) {
  const side = play.about?.halfInning;
  if (side === 'top') return data.gameData?.teams?.away?.id;
  if (side === 'bottom') return data.gameData?.teams?.home?.id;
  return null;
}

// ============================================================
// CURRENT PITCHER PANEL
// ============================================================

function renderPitcherPanel(pitcherMap, data) {
  const container = document.getElementById('pitcher-stats-content');
  const id = data.liveData?.linescore?.defense?.pitcher?.id;

  if (!id || !pitcherMap[id]) {
    container.innerHTML = '<div class="no-data">No pitcher data yet</div>';
    return;
  }

  const p = pitcherMap[id];
  const fpsRate = p.firstPitchTotal > 0 ? ((p.firstPitchStrikes / p.firstPitchTotal) * 100).toFixed(0) : '--';
  const fpsClass = fpsRate !== '--' ? (fpsRate >= 65 ? 'stat-good' : fpsRate >= 50 ? 'stat-warn' : 'stat-bad') : '';

  // Strikeout pitch breakdown
  let kPitchHtml = '';
  if (p.strikeouts > 0) {
    const kTypes = Object.keys(p.pitchTypeStrikeouts).sort((a, b) => p.pitchTypeStrikeouts[b] - p.pitchTypeStrikeouts[a]);
    kPitchHtml = kTypes.map(t => `${t}: ${p.pitchTypeStrikeouts[t]}`).join(', ');
  }

  let pitchTypeHtml = '';
  const types = Object.keys(p.pitchTypeCounts).sort((a, b) => p.pitchTypeCounts[b] - p.pitchTypeCounts[a]);
  types.forEach(type => {
    const thrown = p.pitchTypeCounts[type];
    const abs = p.pitchTypeABs[type] || 0;
    const hits = p.pitchTypeHits[type] || 0;
    const pct = abs > 0 ? ((hits / abs) * 100).toFixed(0) : 0;
    const barColor = abs > 0 ? (pct <= 25 ? 'var(--green)' : pct <= 40 ? 'var(--yellow)' : 'var(--red)') : 'var(--border)';

    pitchTypeHtml += `
      <div class="pitch-type-bar">
        <span class="label">${type}</span>
        <div class="bar-bg">
          <div class="bar-fill" style="width: ${abs > 0 ? Math.max(pct, 5) : 0}%; background: ${barColor};"></div>
        </div>
        <span class="value">${abs > 0 ? hits + '-' + abs : '--'} (${thrown})</span>
      </div>`;
  });

  container.innerHTML = `
    <div class="stat-row">
      <div class="stat-box">
        <span class="stat-value ${fpsClass}">${fpsRate}%</span>
        <span class="stat-label">FPS%</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">${p.firstPitchStrikes}/${p.firstPitchTotal}</span>
        <span class="stat-label">FPS / BF</span>
      </div>
      <div class="stat-box">
        <span class="stat-value stat-warn">${p.threeBallCounts}</span>
        <span class="stat-label">3-Ball</span>
      </div>
      <div class="stat-box">
        <span class="stat-value stat-bad">${p.fullCounts}</span>
        <span class="stat-label">Full Ct</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">${p.totalPitches}</span>
        <span class="stat-label">Pitches</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">${p.strikeouts}</span>
        <span class="stat-label">K</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">${p.rispAB > 0 ? p.rispHits + '/' + p.rispAB : '--'}</span>
        <span class="stat-label">RISP</span>
      </div>
    </div>
    ${p.strikeouts > 0 ? `<div class="pitch-section-title">Strikeout Pitches (${p.strikeouts} K)</div><div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 12px; font-family: inherit;">${kPitchHtml}</div>` : ''}
    <div class="pitch-section-title">Hit Rate by Pitch Type (H-AB) (Thrown)</div>
    ${pitchTypeHtml || '<div class="no-data">No pitch data</div>'}
  `;
}

// ============================================================
// CURRENT HITTER PANEL
// ============================================================

function renderHitterPanel(hitterMap, data) {
  const container = document.getElementById('hitter-stats-content');
  const id = data.liveData?.linescore?.offense?.batter?.id;

  if (!id || !hitterMap[id]) {
    container.innerHTML = '<div class="no-data">No hitter data yet</div>';
    return;
  }

  const h = hitterMap[id];
  const types = Object.keys(h.pitchTypesSeen).sort((a, b) => h.pitchTypesSeen[b] - h.pitchTypesSeen[a]);

  let pitchTypeHtml = '';
  types.forEach(type => {
    const count = h.pitchTypesSeen[type];
    const pct = ((count / h.pitchesSeen) * 100).toFixed(0);
    pitchTypeHtml += `
      <div class="pitch-type-bar">
        <span class="label">${type}</span>
        <div class="bar-bg">
          <div class="bar-fill" style="width: ${pct}%; background: var(--accent-soft);"></div>
        </div>
        <span class="value">${count} (${pct}%)</span>
      </div>`;
  });

  container.innerHTML = `
    <div class="stat-row">
      <div class="stat-box">
        <span class="stat-value">${h.pitchesSeen}</span>
        <span class="stat-label">Pitches Seen</span>
      </div>
    </div>
    <div class="pitch-section-title">Breakdown by Pitch Type</div>
    ${pitchTypeHtml || '<div class="no-data">No data</div>'}
  `;
}

// ============================================================
// RISP PANEL
// ============================================================

function renderRISP(pitcherMap, teamRisp, data) {
  const container = document.getElementById('risp-content');
  const awayAbbr = data.gameData?.teams?.away?.abbreviation || 'AWAY';
  const homeAbbr = data.gameData?.teams?.home?.abbreviation || 'HOME';
  const awayId = data.gameData?.teams?.away?.id;
  const homeId = data.gameData?.teams?.home?.id;
  const awayColor = getTeamColor(awayId);
  const homeColor = getTeamColor(homeId);

  const pitchers = Object.values(pitcherMap).filter(p => p.rispAB > 0);

  let teamHtml = `
    <div class="stat-row" style="margin-bottom: 16px;">
      <div class="stat-box" style="border-left: 3px solid ${awayColor};">
        <span class="stat-value">${teamRisp.away.ab > 0 ? teamRisp.away.hits + '/' + teamRisp.away.ab : '0/0'}</span>
        <span class="stat-label">${awayAbbr} RISP</span>
      </div>
      <div class="stat-box" style="border-left: 3px solid ${homeColor};">
        <span class="stat-value">${teamRisp.home.ab > 0 ? teamRisp.home.hits + '/' + teamRisp.home.ab : '0/0'}</span>
        <span class="stat-label">${homeAbbr} RISP</span>
      </div>
    </div>`;

  if (pitchers.length === 0) {
    container.innerHTML = teamHtml + '<div class="no-data">No RISP at-bats yet</div>';
    return;
  }

  let rows = pitchers.map(p => {
    const avg = p.rispAB > 0 ? (p.rispHits / p.rispAB).toFixed(3).replace('0.', '.') : '.000';
    return `<tr>
      <td>${p.name}</td>
      <td class="risp-hits">${p.rispHits}/${p.rispAB}</td>
      <td>${avg}</td>
    </tr>`;
  }).join('');

  container.innerHTML = teamHtml + `
    <table class="risp-table">
      <thead><tr><th>Pitcher</th><th>H/AB w/ RISP</th><th>AVG</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ============================================================
// ALL PITCHERS — EXPANDABLE (persists across refreshes)
// ============================================================

function renderAllPitchersSummary(pitcherMap) {
  const container = document.getElementById('all-pitchers-content');
  const pitchers = Object.values(pitcherMap).sort((a, b) => b.totalPitches - a.totalPitches);

  if (pitchers.length === 0) {
    container.innerHTML = '<div class="no-data">No pitcher data yet</div>';
    return;
  }

  let rows = pitchers.map(p => {
    const fpsRate = p.firstPitchTotal > 0 ? ((p.firstPitchStrikes / p.firstPitchTotal) * 100).toFixed(0) + '%' : '--';
    const fpsClass = p.firstPitchTotal > 0
      ? ((p.firstPitchStrikes / p.firstPitchTotal) * 100 >= 65 ? 'stat-good' : (p.firstPitchStrikes / p.firstPitchTotal) * 100 >= 50 ? 'stat-warn' : 'stat-bad')
      : '';

    const isExpanded = expandedPitchers.has(p.id);
    const detailHtml = buildPitcherDetail(p);

    return `
      <tr class="pitcher-row-clickable ${isExpanded ? 'expanded' : ''}" data-pitcher-id="${p.id}" onclick="togglePitcherDetail(this)">
        <td>${p.name}</td>
        <td>${p.totalPitches}</td>
        <td class="${fpsClass}">${fpsRate}</td>
        <td>${p.threeBallCounts}</td>
        <td>${p.fullCounts}</td>
        <td>${p.strikeouts}</td>
        <td>${p.rispAB > 0 ? p.rispHits + '/' + p.rispAB : '--'}</td>
      </tr>
      <tr class="pitcher-detail-row ${isExpanded ? 'visible' : ''}" data-detail-pitcher="${p.id}">
        <td colspan="7">${detailHtml}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <table class="stat-table">
      <thead>
        <tr>
          <th>Pitcher</th>
          <th>Pitches</th>
          <th>FPS%</th>
          <th>3-Ball</th>
          <th>3-2</th>
          <th>K</th>
          <th>RISP</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildPitcherDetail(p) {
  const types = Object.keys(p.pitchTypeDetails).sort((a, b) => p.pitchTypeDetails[b].total - p.pitchTypeDetails[a].total);

  if (types.length === 0) return '<div class="pitcher-detail-content"><div class="no-data">No pitch data</div></div>';

  // Strikeout pitch summary
  let kSummary = '';
  if (p.strikeouts > 0) {
    const kTypes = Object.keys(p.pitchTypeStrikeouts).sort((a, b) => p.pitchTypeStrikeouts[b] - p.pitchTypeStrikeouts[a]);
    kSummary = `<div style="margin-bottom: 12px;">
      <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Strikeout Pitches (${p.strikeouts} K)</span>
      <div style="color: var(--text-secondary); font-size: 0.82rem; margin-top: 4px; font-family: inherit;">
        ${kTypes.map(t => `${t}: ${p.pitchTypeStrikeouts[t]}`).join(' &nbsp;|&nbsp; ')}
      </div>
    </div>`;
  }

  let pitchRows = types.map(type => {
    const d = p.pitchTypeDetails[type];
    const totalStrikes = d.calledStrikes + d.swingingStrikes + d.fouls + d.inPlay;
    const strikePct = d.total > 0 ? ((totalStrikes / d.total) * 100).toFixed(0) : 0;
    const whiffRate = d.swings > 0 ? ((d.whiffs / d.swings) * 100).toFixed(0) : '--';
    const hits = p.pitchTypeHits[type] || 0;
    const abs = p.pitchTypeABs[type] || 0;
    const kOnPitch = p.pitchTypeStrikeouts[type] || 0;

    return `<tr>
      <td>${type}</td>
      <td>${d.total}</td>
      <td>${d.balls}</td>
      <td>${d.calledStrikes}</td>
      <td>${d.swingingStrikes}</td>
      <td>${d.fouls}</td>
      <td>${d.inPlay}</td>
      <td>${strikePct}%</td>
      <td>${d.swings > 0 ? d.whiffs + '/' + d.swings + ' (' + whiffRate + '%)' : '--'}</td>
      <td>${abs > 0 ? hits + '-' + abs : '--'}</td>
      <td>${kOnPitch > 0 ? kOnPitch : '--'}</td>
    </tr>`;
  }).join('');

  return `
    <div class="pitcher-detail-content">
      ${kSummary}
      <div class="detail-section">
        <h4>Pitch Arsenal Breakdown</h4>
        <div style="overflow-x: auto;">
          <table class="detail-table">
            <thead>
              <tr>
                <th>Pitch</th>
                <th>Total</th>
                <th>Balls</th>
                <th>Called K</th>
                <th>Swing K</th>
                <th>Fouls</th>
                <th>In Play</th>
                <th>Strike%</th>
                <th>Whiff%</th>
                <th>H-AB</th>
                <th>K On</th>
              </tr>
            </thead>
            <tbody>${pitchRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// Toggle uses pitcher ID so it persists across re-renders
function togglePitcherDetail(row) {
  const pitcherId = Number(row.dataset.pitcherId);
  const detailRow = document.querySelector(`tr[data-detail-pitcher="${pitcherId}"]`);

  if (expandedPitchers.has(pitcherId)) {
    expandedPitchers.delete(pitcherId);
    row.classList.remove('expanded');
    detailRow.classList.remove('visible');
  } else {
    expandedPitchers.add(pitcherId);
    row.classList.add('expanded');
    detailRow.classList.add('visible');
  }
}

window.togglePitcherDetail = togglePitcherDetail;

// ============================================================
// ALL HITTERS
// ============================================================

function renderAllHittersSummary(hitterMap, data) {
  const container = document.getElementById('all-hitters-content');
  const hitters = Object.values(hitterMap);

  if (hitters.length === 0) {
    container.innerHTML = '<div class="no-data">No hitter data yet</div>';
    return;
  }

  const awayId = data.gameData?.teams?.away?.id;
  const homeId = data.gameData?.teams?.home?.id;
  const awayName = data.gameData?.teams?.away?.name || 'Away';
  const homeName = data.gameData?.teams?.home?.name || 'Home';
  const awayColor = getTeamColor(awayId);
  const homeColor = getTeamColor(homeId);

  const awayHitters = hitters.filter(h => h.teamId === awayId).sort((a, b) => b.pitchesSeen - a.pitchesSeen);
  const homeHitters = hitters.filter(h => h.teamId === homeId).sort((a, b) => b.pitchesSeen - a.pitchesSeen);

  function buildRows(list) {
    return list.map(h => {
      const side = h.batSide === 'S' ? 'S' : h.batSide || '?';
      const types = Object.keys(h.pitchTypesSeen).sort((a, b) => h.pitchTypesSeen[b] - h.pitchTypesSeen[a]);
      const summary = types.map(t => `${t}: ${h.pitchTypesSeen[t]}`).join(', ');
      return `<tr>
        <td>${h.name} <span style="color: var(--text-muted); font-size: 0.8rem;">(${side})</span></td>
        <td>${h.pa}</td>
        <td>${h.hits}-${h.pa}</td>
        <td>${h.pitchesSeen}</td>
        <td style="font-size:0.8rem">${summary || '--'}</td>
      </tr>`;
    }).join('');
  }

  let html = `<table class="stat-table">
    <thead><tr><th>Hitter</th><th>PA</th><th>H-PA</th><th>Pitches</th><th>Pitches by Type</th></tr></thead>
    <tbody>`;

  html += `<tr class="team-divider"><td colspan="5" style="border-left: 4px solid ${awayColor}; color: ${awayColor};">${awayName}</td></tr>`;
  html += buildRows(awayHitters);
  html += `<tr class="team-divider"><td colspan="5" style="border-left: 4px solid ${homeColor}; color: ${homeColor};">${homeName}</td></tr>`;
  html += buildRows(homeHitters);

  html += '</tbody></table>';
  container.innerHTML = html;
}

// ---- Init ----
loadSchedule();
