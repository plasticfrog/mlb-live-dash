// ============================================================
// MLB Live Dash - Frontend Application
// ============================================================

let currentGamePk = null;
let refreshInterval = null;
const REFRESH_MS = 10000;

// ---- Date Navigation ----
const dateInput = document.getElementById('game-date');
const today = new Date().toISOString().split('T')[0];
dateInput.value = today;

document.getElementById('prev-day').addEventListener('click', () => {
  const d = new Date(dateInput.value);
  d.setDate(d.getDate() - 1);
  dateInput.value = d.toISOString().split('T')[0];
  loadSchedule();
});

document.getElementById('next-day').addEventListener('click', () => {
  const d = new Date(dateInput.value);
  d.setDate(d.getDate() + 1);
  dateInput.value = d.toISOString().split('T')[0];
  loadSchedule();
});

dateInput.addEventListener('change', loadSchedule);

document.getElementById('back-btn').addEventListener('click', () => {
  currentGamePk = null;
  clearInterval(refreshInterval);
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('game-selector').classList.remove('hidden');
  loadSchedule();
});

// ---- Schedule / Game Cards ----
async function loadSchedule() {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '<div class="no-data">Loading games...</div>';

  try {
    const res = await fetch(`/api/schedule?date=${dateInput.value}`);
    const data = await res.json();
    const games = data.dates?.[0]?.games || [];

    if (games.length === 0) {
      grid.innerHTML = '<div class="no-data">No games scheduled for this date.</div>';
      return;
    }

    grid.innerHTML = '';
    games.forEach(game => {
      const card = document.createElement('div');
      card.className = 'game-card';

      const status = game.status?.detailedState || '';
      const isLive = status === 'In Progress' || status === 'Warmup' || status === 'Manager Challenge';
      if (isLive) card.classList.add('live');

      const away = game.teams?.away;
      const home = game.teams?.home;
      const ls = game.linescore;

      let scoreHtml = '';
      let infoHtml = '';

      if (isLive && ls) {
        scoreHtml = `<span class="card-score">${ls.teams?.away?.runs ?? 0} - ${ls.teams?.home?.runs ?? 0}</span>`;
        const half = ls.isTopInning ? 'Top' : 'Bot';
        infoHtml = `<span class="live-badge">LIVE</span> ${half} ${ls.currentInning || ''}`;
      } else if (status === 'Final' || status === 'Game Over') {
        scoreHtml = `<span class="card-score">${ls?.teams?.away?.runs ?? 0} - ${ls?.teams?.home?.runs ?? 0}</span>`;
        infoHtml = 'Final';
      } else {
        const time = game.gameDate ? new Date(game.gameDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
        infoHtml = `${time} | ${status}`;
      }

      card.innerHTML = `
        <div class="teams">
          <span class="team">${away?.team?.abbreviation || away?.team?.name || 'TBD'}</span>
          <span class="vs">${scoreHtml || '@'}</span>
          <span class="team">${home?.team?.abbreviation || home?.team?.name || 'TBD'}</span>
        </div>
        <div class="game-info">${infoHtml}</div>
      `;

      card.addEventListener('click', () => selectGame(game.gamePk));
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<div class="no-data">Error loading schedule: ${err.message}</div>`;
  }
}

// ---- Select & Load Game ----
function selectGame(gamePk) {
  currentGamePk = gamePk;
  document.getElementById('game-selector').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadGameData();

  clearInterval(refreshInterval);
  refreshInterval = setInterval(loadGameData, REFRESH_MS);
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
      `Updated: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.error('Error loading game data:', err);
  }
}

// ---- Render Scoreboard ----
function renderScoreboard(data) {
  const gd = data.gameData;
  const ld = data.liveData;
  const ls = ld?.linescore;

  document.getElementById('away-name').textContent =
    gd?.teams?.away?.abbreviation || gd?.teams?.away?.name || '';
  document.getElementById('home-name').textContent =
    gd?.teams?.home?.abbreviation || gd?.teams?.home?.name || '';
  document.getElementById('away-score').textContent = ls?.teams?.away?.runs ?? 0;
  document.getElementById('home-score').textContent = ls?.teams?.home?.runs ?? 0;

  // Inning & outs
  const status = gd?.status?.detailedState || '';
  if (status === 'In Progress' || status === 'Warmup' || status === 'Manager Challenge') {
    const half = ls?.isTopInning ? 'Top' : 'Bot';
    document.getElementById('inning').textContent = `${half} ${ls?.currentInning || ''}`;
    document.getElementById('outs').textContent = `${ls?.outs ?? 0} Out${ls?.outs !== 1 ? 's' : ''}`;
  } else {
    document.getElementById('inning').textContent = status;
    document.getElementById('outs').textContent = '';
  }

  // Count
  const balls = ls?.balls ?? 0;
  const strikes = ls?.strikes ?? 0;
  document.getElementById('count').textContent = `${balls}-${strikes}`;

  // Bases
  const offense = ls?.offense || {};
  document.getElementById('base-1').classList.toggle('occupied', !!offense.first);
  document.getElementById('base-2').classList.toggle('occupied', !!offense.second);
  document.getElementById('base-3').classList.toggle('occupied', !!offense.third);

  // Linescore table
  renderLinescoreTable(ls, gd);
}

function renderLinescoreTable(ls, gd) {
  const container = document.getElementById('linescore-container');
  if (!ls?.innings?.length) {
    container.innerHTML = '';
    return;
  }

  const awayAbbr = gd?.teams?.away?.abbreviation || 'AWAY';
  const homeAbbr = gd?.teams?.home?.abbreviation || 'HOME';
  const currentInning = ls.currentInning || 0;

  let html = '<table class="linescore-table"><thead><tr><th></th>';
  ls.innings.forEach(inn => {
    const cls = inn.num === currentInning ? 'current-inning' : '';
    html += `<th class="${cls}">${inn.num}</th>`;
  });
  html += '<th class="totals">R</th><th class="totals">H</th><th class="totals">E</th></tr></thead><tbody>';

  // Away row
  html += `<tr><td><strong>${awayAbbr}</strong></td>`;
  ls.innings.forEach(inn => {
    const cls = inn.num === currentInning ? 'current-inning' : '';
    html += `<td class="${cls}">${inn.away?.runs ?? ''}</td>`;
  });
  html += `<td class="totals">${ls.teams?.away?.runs ?? 0}</td>`;
  html += `<td class="totals">${ls.teams?.away?.hits ?? 0}</td>`;
  html += `<td class="totals">${ls.teams?.away?.errors ?? 0}</td></tr>`;

  // Home row
  html += `<tr><td><strong>${homeAbbr}</strong></td>`;
  ls.innings.forEach(inn => {
    const cls = inn.num === currentInning ? 'current-inning' : '';
    html += `<td class="${cls}">${inn.home?.runs ?? ''}</td>`;
  });
  html += `<td class="totals">${ls.teams?.home?.runs ?? 0}</td>`;
  html += `<td class="totals">${ls.teams?.home?.hits ?? 0}</td>`;
  html += `<td class="totals">${ls.teams?.home?.errors ?? 0}</td></tr>`;

  html += '</tbody></table>';
  container.innerHTML = html;
}

// ---- Render Matchup ----
function renderMatchup(data) {
  const ls = data.liveData?.linescore;
  const pitcher = ls?.defense?.pitcher;
  const batter = ls?.offense?.batter;
  document.getElementById('current-pitcher').textContent =
    pitcher ? `P: ${pitcher.fullName}` : 'P: --';
  document.getElementById('current-batter').textContent =
    batter ? `AB: ${batter.fullName}` : 'AB: --';
}

// ============================================================
// STAT COMPUTATION ENGINE
// ============================================================

function computeAndRenderStats(data) {
  const allPlays = data.liveData?.plays?.allPlays || [];

  // Build per-pitcher and per-batter stat maps
  const pitcherMap = {};  // pitcherId -> { name, firstPitchStrikes, firstPitchTotal, pitchTypeCounts, pitchTypeHits, threeBallCounts, fullCounts, totalPitches }
  const hitterMap = {};   // batterId -> { name, pitchesSeen, pitchTypesSeen }

  allPlays.forEach(play => {
    const pitcherId = play.matchup?.pitcher?.id;
    const pitcherName = play.matchup?.pitcher?.fullName || 'Unknown';
    const batterId = play.matchup?.batter?.id;
    const batterName = play.matchup?.batter?.fullName || 'Unknown';

    if (!pitcherId || !batterId) return;

    // Initialize pitcher
    if (!pitcherMap[pitcherId]) {
      pitcherMap[pitcherId] = {
        name: pitcherName,
        firstPitchStrikes: 0,
        firstPitchTotal: 0,
        pitchTypeCounts: {},   // type -> total thrown
        pitchTypeHits: {},     // type -> hits allowed
        pitchTypeABs: {},      // type -> at-bats ending on this pitch type
        threeBallCounts: 0,
        fullCounts: 0,
        totalPitches: 0
      };
    }

    // Initialize hitter
    if (!hitterMap[batterId]) {
      hitterMap[batterId] = {
        name: batterName,
        pitchesSeen: 0,
        pitchTypesSeen: {}
      };
    }

    const pitcher = pitcherMap[pitcherId];
    const hitter = hitterMap[batterId];
    const events = play.playEvents || [];

    let balls = 0;
    let strikes = 0;
    let isFirstPitch = true;
    let reachedThreeBall = false;
    let reachedFullCount = false;
    let lastPitchType = null;

    events.forEach(event => {
      if (event.isPitch) {
        const pitchType = event.details?.type?.description || event.details?.type?.code || 'Unknown';
        lastPitchType = pitchType;

        // Count total pitches
        pitcher.totalPitches++;
        hitter.pitchesSeen++;

        // Pitch type counting
        pitcher.pitchTypeCounts[pitchType] = (pitcher.pitchTypeCounts[pitchType] || 0) + 1;
        hitter.pitchTypesSeen[pitchType] = (hitter.pitchTypesSeen[pitchType] || 0) + 1;

        // First pitch strike tracking
        if (isFirstPitch) {
          pitcher.firstPitchTotal++;
          const desc = event.details?.description || '';
          const callCode = event.details?.code || '';
          // Strikes: called strike (C), swinging strike (S), foul (F), in play (X, E, D)
          const strikeCodes = ['C', 'S', 'F', 'T', 'L', 'M', 'O', 'Q', 'R', 'W', 'X', 'D', 'E'];
          if (strikeCodes.includes(callCode)) {
            pitcher.firstPitchStrikes++;
          }
          isFirstPitch = false;
        }

        // Track count progression
        const callCode = event.details?.code || '';
        const ballCodes = ['B', 'I', 'P', 'V'];
        const strikeCodes = ['C', 'S', 'F', 'T', 'L', 'M', 'O', 'Q', 'R', 'W'];

        if (ballCodes.includes(callCode)) {
          balls++;
        } else if (strikeCodes.includes(callCode)) {
          if (callCode === 'F' && strikes === 2) {
            // Foul with 2 strikes doesn't add a strike
          } else {
            strikes++;
          }
        }

        // Check for 3-ball count
        if (balls >= 3 && !reachedThreeBall) {
          pitcher.threeBallCounts++;
          reachedThreeBall = true;
        }

        // Check for full count
        if (balls >= 3 && strikes >= 2 && !reachedFullCount) {
          pitcher.fullCounts++;
          reachedFullCount = true;
        }
      }
    });

    // Track hits by pitch type for the result of the AB
    const result = play.result?.event || '';
    const isHit = ['Single', 'Double', 'Triple', 'Home Run'].includes(result);
    const isAB = !['Walk', 'Hit By Pitch', 'Intent Walk', 'Sac Bunt', 'Sac Fly',
                    'Catcher Interference', 'Fan interference'].includes(result)
                 && result !== '';

    if (lastPitchType && isAB) {
      pitcher.pitchTypeABs[lastPitchType] = (pitcher.pitchTypeABs[lastPitchType] || 0) + 1;
      if (isHit) {
        pitcher.pitchTypeHits[lastPitchType] = (pitcher.pitchTypeHits[lastPitchType] || 0) + 1;
      }
    }
  });

  renderPitcherPanel(pitcherMap, data);
  renderHitterPanel(hitterMap, data);
  renderAllPitchersSummary(pitcherMap);
  renderAllHittersSummary(hitterMap);
}

// ---- Render Current Pitcher Panel ----
function renderPitcherPanel(pitcherMap, data) {
  const container = document.getElementById('pitcher-stats-content');
  const currentPitcherId = data.liveData?.linescore?.defense?.pitcher?.id;

  if (!currentPitcherId || !pitcherMap[currentPitcherId]) {
    container.innerHTML = '<div class="no-data">No pitcher data yet</div>';
    return;
  }

  const p = pitcherMap[currentPitcherId];

  // First Pitch Strike %
  const fpsRate = p.firstPitchTotal > 0 ? ((p.firstPitchStrikes / p.firstPitchTotal) * 100).toFixed(0) : '--';
  const fpsClass = fpsRate !== '--' ? (fpsRate >= 65 ? 'stat-good' : fpsRate >= 50 ? 'stat-warn' : 'stat-bad') : '';

  // Success rate per pitch type (hits / ABs ending on that pitch)
  let pitchTypeHtml = '';
  const pitchTypes = Object.keys(p.pitchTypeCounts).sort((a, b) => p.pitchTypeCounts[b] - p.pitchTypeCounts[a]);

  pitchTypes.forEach(type => {
    const thrown = p.pitchTypeCounts[type];
    const abs = p.pitchTypeABs[type] || 0;
    const hits = p.pitchTypeHits[type] || 0;
    const successRate = abs > 0 ? `${hits}-${abs}` : '--';
    const pct = abs > 0 ? ((hits / abs) * 100).toFixed(0) : 0;
    const barColor = abs > 0 ? (pct <= 25 ? '#22c55e' : pct <= 40 ? '#f59e0b' : '#ef4444') : '#374151';

    pitchTypeHtml += `
      <div class="pitch-type-bar">
        <span class="label">${type}</span>
        <div class="bar-bg">
          <div class="bar-fill" style="width: ${abs > 0 ? Math.max(pct, 5) : 0}%; background: ${barColor};"></div>
        </div>
        <span class="value">${successRate} (${thrown})</span>
      </div>`;
  });

  container.innerHTML = `
    <div class="stat-row">
      <div class="stat-box">
        <span class="stat-value ${fpsClass}">${fpsRate}%</span>
        <span class="stat-label">1st Pitch Strike%</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">${p.firstPitchStrikes}/${p.firstPitchTotal}</span>
        <span class="stat-label">FPS / Batters</span>
      </div>
      <div class="stat-box">
        <span class="stat-value stat-warn">${p.threeBallCounts}</span>
        <span class="stat-label">3-Ball Counts</span>
      </div>
      <div class="stat-box">
        <span class="stat-value stat-bad">${p.fullCounts}</span>
        <span class="stat-label">3-2 Counts</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">${p.totalPitches}</span>
        <span class="stat-label">Total Pitches</span>
      </div>
    </div>
    <h4 style="color: #93c5fd; margin: 12px 0 8px; font-size: 0.85rem;">Hit Rate by Pitch Type (H-AB) (Total Thrown)</h4>
    ${pitchTypeHtml || '<div class="no-data">No pitch data</div>'}
  `;
}

// ---- Render Current Hitter Panel ----
function renderHitterPanel(hitterMap, data) {
  const container = document.getElementById('hitter-stats-content');
  const currentBatterId = data.liveData?.linescore?.offense?.batter?.id;

  if (!currentBatterId || !hitterMap[currentBatterId]) {
    container.innerHTML = '<div class="no-data">No hitter data yet</div>';
    return;
  }

  const h = hitterMap[currentBatterId];

  let pitchTypeHtml = '';
  const types = Object.keys(h.pitchTypesSeen).sort((a, b) => h.pitchTypesSeen[b] - h.pitchTypesSeen[a]);
  types.forEach(type => {
    const count = h.pitchTypesSeen[type];
    const pct = ((count / h.pitchesSeen) * 100).toFixed(0);
    pitchTypeHtml += `
      <div class="pitch-type-bar">
        <span class="label">${type}</span>
        <div class="bar-bg">
          <div class="bar-fill" style="width: ${pct}%; background: #60a5fa;"></div>
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
    <h4 style="color: #93c5fd; margin: 12px 0 8px; font-size: 0.85rem;">Breakdown by Pitch Type</h4>
    ${pitchTypeHtml || '<div class="no-data">No pitch type data</div>'}
  `;
}

// ---- All Pitchers Summary Table ----
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

    // Build pitch type success summary
    const types = Object.keys(p.pitchTypeCounts).sort((a, b) => p.pitchTypeCounts[b] - p.pitchTypeCounts[a]);
    const typeSummary = types.map(t => {
      const hits = p.pitchTypeHits[t] || 0;
      const abs = p.pitchTypeABs[t] || 0;
      return `${t}: ${hits}-${abs}`;
    }).join(', ');

    return `<tr>
      <td>${p.name}</td>
      <td>${p.totalPitches}</td>
      <td class="${fpsClass}">${fpsRate} (${p.firstPitchStrikes}/${p.firstPitchTotal})</td>
      <td>${p.threeBallCounts}</td>
      <td>${p.fullCounts}</td>
      <td style="font-size:0.75rem">${typeSummary || '--'}</td>
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
          <th>H-AB by Pitch Type</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ---- All Hitters Summary Table ----
function renderAllHittersSummary(hitterMap) {
  const container = document.getElementById('all-hitters-content');
  const hitters = Object.values(hitterMap).sort((a, b) => b.pitchesSeen - a.pitchesSeen);

  if (hitters.length === 0) {
    container.innerHTML = '<div class="no-data">No hitter data yet</div>';
    return;
  }

  let rows = hitters.map(h => {
    const types = Object.keys(h.pitchTypesSeen).sort((a, b) => h.pitchTypesSeen[b] - h.pitchTypesSeen[a]);
    const typeSummary = types.map(t => `${t}: ${h.pitchTypesSeen[t]}`).join(', ');

    return `<tr>
      <td>${h.name}</td>
      <td>${h.pitchesSeen}</td>
      <td style="font-size:0.75rem">${typeSummary || '--'}</td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <table class="stat-table">
      <thead>
        <tr>
          <th>Hitter</th>
          <th>Pitches Seen</th>
          <th>By Type</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ---- Init ----
loadSchedule();
