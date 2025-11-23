// sensors.js
// Functions for fetching and displaying sensor data, and sending commands

// Fetch sensor data from Supabase and update the UI
export async function fetchSensorData() {
  try {
    const { data, error } = await window.supabase
      .from("sensor_data")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(200);

    if (error) throw error;

    const loadingElem = document.getElementById("loading");
    if (loadingElem) loadingElem.style.display = "none";
    const loadingMonitor = document.getElementById("loading-monitor");
    if (loadingMonitor) loadingMonitor.style.display = "none";
    document.getElementById(
      "data-points"
    ).textContent = `Data Points: ${data.length}`;
    document.getElementById(
      "last-update"
    ).textContent = `Last Update: ${new Date().toLocaleString()}`;

    displayData(data);
    if (window.checkAlerts) window.checkAlerts(data);
  } catch (error) {
    console.error("Fetch error:", error);
    showNotification("Failed to fetch sensor data", "error");
  }
}

// Display sensor data in the UI (with modular card/modal/next event logic)
export function displayData(data) {
  const container = document.getElementById("sensor-container");
  const monitorContainer = document.getElementById("sensor-container-monitor");
  if (container) container.innerHTML = "";
  if (monitorContainer) monitorContainer.innerHTML = "";

  // Group data by sensor and get latest readings
  const latestBySensor = {};
  for (const row of data) {
    if (!latestBySensor[row.sensor_id]) {
      latestBySensor[row.sensor_id] = row;
    }
  }

  // Group ECS devices into two room containers
  const strongIds = ["ecs_1", "ecs_3"];
  const smallIds = ["ecs_2"];

  const strongAvailable = strongIds
    .map((id) => ({ id, data: latestBySensor[id] }))
    .filter((x) => x.data);
  const smallAvailable = smallIds
    .map((id) => ({ id, data: latestBySensor[id] }))
    .filter((x) => x.data);

  if (strongAvailable.length === 0 && smallAvailable.length === 0) {
    container.innerHTML =
      '<div class="loading">No ECS data available yet.</div>';
    return;
  }

  // Build room sections first, then append clones into both containers
  const roomSections = [];
  function buildRoomSection(title, items) {
    if (!items || items.length === 0) return;
    const roomSection = document.createElement("div");
    roomSection.className = "room-section";
    roomSection.innerHTML = `<h2 class="room-title">${title}</h2>`;
    const cardsGrid = document.createElement("div");
    cardsGrid.className = "cards-grid";
    items.forEach((s) => {
      const card = createSensorCard(s.id, s.data);
      cardsGrid.appendChild(card);
    });
    roomSection.appendChild(cardsGrid);
    roomSections.push(roomSection);
  }

  buildRoomSection("🛡️ Strong Room", strongAvailable);
  buildRoomSection("📦 Small Room", smallAvailable);

  // Append overview sections to main container only
  if (container) {
    roomSections.forEach((rs) => container.appendChild(rs.cloneNode(true)));
  }

  // Build monitor-specific layout (do not change overview)
  if (monitorContainer) {
    // Helper to build a partial card showing only selected fields
    function createPartialCard(sensorId, data, options = {}) {
      const {
        showT1 = false,
        showRH1 = false,
        showT2 = false,
        showRH2 = false,
        showPM = false,
        showNC = false,
        includeControls = false,
        titleSuffix = "",
      } = options;
      const card = document.createElement("div");
      card.className = "card";
      const iconClass = "ecs-icon";
      const icon = "🌿";
      const deviceType =
        "Environment Control System" + (titleSuffix ? ` • ${titleSuffix}` : "");

      // Top row: combined temperature & humidity for readability
      let topRowHtml =
        '<div style="display:flex;gap:10px;justify-content:center;">';
      if (showT1)
        topRowHtml += `<div class="metric" style="flex:1;"><div class="metric-value">${
          data.t1 ?? "--"
        }°C</div><div class="metric-label">Temp 1</div></div>`;
      if (showRH1)
        topRowHtml += `<div class="metric" style="flex:1;"><div class="metric-value">${
          data.rh1 ?? "--"
        }%</div><div class="metric-label">RH 1</div></div>`;
      if (showT2)
        topRowHtml += `<div class="metric" style="flex:1;"><div class="metric-value">${
          data.t2 ?? "--"
        }°C</div><div class="metric-label">Temp 2</div></div>`;
      if (showRH2)
        topRowHtml += `<div class="metric" style="flex:1;"><div class="metric-value">${
          data.rh2 ?? "--"
        }%</div><div class="metric-label">RH 2</div></div>`;
      topRowHtml += "</div>";

      // Below row: air quality (PM) and NC metrics
      let aqHtml = "";
      if (showPM) {
        aqHtml += `
          <div class="metric"><div class="metric-value">${
            data.pm1 ?? "--"
          }</div><div class="metric-label">PM1.0</div></div>
          <div class="metric"><div class="metric-value">${
            data.pm25 ?? "--"
          }</div><div class="metric-label">PM2.5</div></div>
          <div class="metric"><div class="metric-value">${
            data.pm10 ?? "--"
          }</div><div class="metric-label">PM10</div></div>
          <div class="metric"><div class="metric-value">${
            data.avg_particle_size ?? "--"
          } μm</div><div class="metric-label">Avg Particle Size</div></div>
        `;
      }
      if (showNC) {
        aqHtml += `
          <div class="metric"><div class="metric-value">${
            data.nc0_5 ?? "--"
          } /L</div><div class="metric-label">NC 0.5</div></div>
          <div class="metric"><div class="metric-value">${
            data.nc1_0 ?? "--"
          } /L</div><div class="metric-label">NC 1.0</div></div>
          <div class="metric"><div class="metric-value">${
            data.nc2_5 ?? "--"
          } /L</div><div class="metric-label">NC 2.5</div></div>
          <div class="metric"><div class="metric-value">${
            data.nc10 ?? "--"
          } /L</div><div class="metric-label">NC 10</div></div>
        `;
      }

      let controlsHtml = "";
      if (includeControls) {
        controlsHtml += `
          <button class="control-btn ${
            data.relay1 ? "on" : "off"
          }" onclick="sendCommand('${sensorId}', 'relay1', ${!data.relay1})">Air Purifier: ${
          data.relay1 ? "ON" : "OFF"
        }</button>
          <button class="control-btn ${
            data.relay2 ? "on" : "off"
          }" onclick="sendCommand('${sensorId}', 'relay2', ${!data.relay2})">Dehumidifier: ${
          data.relay2 ? "ON" : "OFF"
        }</button>
        `;
      }

      card.innerHTML = `
        <div class="card-title">
          <div class="device-icon ${iconClass}">${icon}</div>
          <div>
            <div>${deviceType}</div>
            <div style="font-size: 0.9rem; font-weight: normal; color: #666;">${sensorId.toUpperCase()}</div>
          </div>
        </div>
        ${topRowHtml}
        <div class="metrics-grid">${aqHtml}</div>
        <div class="controls">${controlsHtml}</div>
        <div class="timestamp">Last Updated: ${new Date(
          data.timestamp
        ).toLocaleString()}</div>
      `;
      return card;
    }

    // Helper to create AC control card showing t1,t2 and relay1 toggle
    function createACControlCard(sensorId, data) {
      const card = document.createElement("div");
      card.className = "card";
      const iconClass = "ac-icon";
      const icon = "❄️";
      const deviceType = "Air Conditioner";

      const topRow = `<div style="display:flex;gap:10px;justify-content:center;">
        <div class="metric" style="flex:1;"><div class="metric-value">${
          data.t1 ?? "--"
        }°C</div><div class="metric-label">T1</div></div>
        <div class="metric" style="flex:1;"><div class="metric-value">${
          data.t2 ?? "--"
        }°C</div><div class="metric-label">T2</div></div>
      </div>`;

      const controlsHtml = `
        <button class="control-btn ${
          data.relay1 ? "on" : "off"
        }" onclick="sendCommand('${sensorId}', 'relay1', ${!data.relay1})">AC: ${
        data.relay1 ? "ON" : "OFF"
      }</button>
      `;
      // Add schedule and timer icons next to controls
      // const extraControls = `
      //   <button class="icon-btn" title="Schedules" onclick="window.showScheduleModal && window.showScheduleModal('${sensorId}')" style="margin-left:8px;">📅</button>
      // `;

      card.innerHTML = `
        <div class="card-title">
          <div class="device-icon" onclick="window.showScheduleModal && window.showScheduleModal('${sensorId}', ${
        data.relay1
      })" ${iconClass}">${icon}</div>
          <div>
            <div>${deviceType}</div>
            <div style="font-size: 0.9rem; font-weight: normal; color: #666;">${sensorId.toUpperCase()}</div>
          </div>
        </div>
        ${topRow}
  <div class="controls">${controlsHtml}</div>
        <div class="timestamp">Last Updated: ${new Date(
          data.timestamp
        ).toLocaleString()}</div>
      `;
      return card;
    }

    // Build monitor layout according to user mapping arranged in three rows
    if (strongAvailable.length || smallAvailable.length) {
      const ecs1 = latestBySensor["ecs_1"];
      const ecs2 = latestBySensor["ecs_2"];
      const ecs3 = latestBySensor["ecs_3"];

      // Create sections
      const strongMainSection = document.createElement("div");
      strongMainSection.className = "room-section";
      strongMainSection.innerHTML = `<h2 class="room-title">🛡️ Strong Room</h2>`;
      const strongGrid = document.createElement("div");
      strongGrid.className = "cards-grid";
      if (ecs1)
        strongGrid.appendChild(
          createPartialCard("ecs_1", ecs1, {
            showT1: true,
            showRH1: true,
            showPM: true,
            showNC: true,
          })
        );
      strongMainSection.appendChild(strongGrid);

      const smallMainSection = document.createElement("div");
      smallMainSection.className = "room-section";
      smallMainSection.innerHTML = `<h2 class="room-title">📦 Small Room</h2>`;
      const smallGrid = document.createElement("div");
      smallGrid.className = "cards-grid";
      if (ecs2)
        smallGrid.appendChild(
          createPartialCard("ecs_2", ecs2, {
            showT1: true,
            showRH1: true,
            showPM: true,
            showNC: true,
          })
        );
      smallMainSection.appendChild(smallGrid);

      const strongCtrl = document.createElement("div");
      strongCtrl.className = "room-section";
      strongCtrl.innerHTML = `<h2 class="room-title">🛠️ Strong Room Control</h2>`;
      const strongCtrlGrid = document.createElement("div");
      strongCtrlGrid.className = "cards-grid";
      if (ecs1)
        strongCtrlGrid.appendChild(
          createPartialCard("ecs_1", ecs1, {
            showT2: true,
            showRH2: true,
            includeControls: true,
            titleSuffix: "Control",
          })
        );
      // Add AC controllers in strong room control grid: ac_1 and ac_3
      const ac1 = latestBySensor["ac_1"];
      const ac3 = latestBySensor["ac_3"];
      if (ac1) strongCtrlGrid.appendChild(createACControlCard("ac_1", ac1));
      if (ac3) strongCtrlGrid.appendChild(createACControlCard("ac_3", ac3));
      strongCtrl.appendChild(strongCtrlGrid);

      const smallCtrl = document.createElement("div");
      smallCtrl.className = "room-section";
      smallCtrl.innerHTML = `<h2 class="room-title">🔧 Small Room Control</h2>`;
      const smallCtrlGrid = document.createElement("div");
      smallCtrlGrid.className = "cards-grid";
      if (ecs2)
        smallCtrlGrid.appendChild(
          createPartialCard("ecs_2", ecs2, {
            showT2: true,
            showRH2: true,
            includeControls: true,
            titleSuffix: "Control",
          })
        );
      // Add AC controller in small room control grid: ac_2
      const ac2 = latestBySensor["ac_2"];
      if (ac2) smallCtrlGrid.appendChild(createACControlCard("ac_2", ac2));
      smallCtrl.appendChild(smallCtrlGrid);

      const strongFar = document.createElement("div");
      strongFar.className = "room-section";
      strongFar.innerHTML = `<h2 class="room-title">🛡️ Strong Room — Far End</h2>`;
      const strongFarGrid = document.createElement("div");
      strongFarGrid.className = "cards-grid";
      if (ecs3)
        strongFarGrid.appendChild(
          createPartialCard("ecs_3", ecs3, {
            showT1: true,
            showRH1: true,
            showPM: true,
            showNC: true,
            titleSuffix: "Far End",
          })
        );
      strongFar.appendChild(strongFarGrid);

      const smallFar = document.createElement("div");
      smallFar.className = "room-section";
      smallFar.innerHTML = `<h2 class="room-title">📦 Small Room — Far End</h2>`;
      const smallFarGrid = document.createElement("div");
      smallFarGrid.className = "cards-grid";
      if (ecs3)
        smallFarGrid.appendChild(
          createPartialCard("ecs_3", ecs3, {
            showT2: true,
            showRH2: true,
            titleSuffix: "Far End",
          })
        );
      smallFar.appendChild(smallFarGrid);

      // Helper to create a flex row with two columns
      function appendRow(leftSection, rightSection) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "15px";
        row.style.alignItems = "flex-start";
        row.style.marginBottom = "18px";

        const left = leftSection || document.createElement("div");
        const right = rightSection || document.createElement("div");
        left.style.flex = "1";
        right.style.flex = "1";
        row.appendChild(left);
        row.appendChild(right);
        monitorContainer.appendChild(row);
      }

      // Top: control rooms side-by-side
      appendRow(strongCtrl, smallCtrl);
      // Middle: main rooms side-by-side
      appendRow(strongMainSection, smallMainSection);
      // Bottom: far ends side-by-side
      appendRow(strongFar, smallFar);
    }
  }
}

// Create a sensor card element for the dashboard
function createSensorCard(sensorId, d) {
  const isECS = sensorId.startsWith("ecs_");
  const card = document.createElement("div");
  card.className = "card";

  const deviceType = isECS ? "Environment Control System" : sensorId;
  const icon = isECS ? "🌿" : "⚙️";
  const iconClass = isECS ? "ecs-icon" : "";

  // Build metrics: two SHT35 sensors (t1/rh1, t2/rh2) and SPS30 PM fields
  let metricsHtml = `
    <div class="metric">
      <div class="metric-value">${d.t1 ?? "--"}°C</div>
      <div class="metric-label">Temp 1</div>
    </div>
    <div class="metric">
      <div class="metric-value">${d.rh1 ?? "--"}%</div>
      <div class="metric-label">RH 1</div>
    </div>
    <div class="metric">
      <div class="metric-value">${d.t2 ?? "--"}°C</div>
      <div class="metric-label">Temp 2</div>
    </div>
    <div class="metric">
      <div class="metric-value">${d.rh2 ?? "--"}%</div>
      <div class="metric-label">RH 2</div>
    </div>
  `;

  if (isECS) {
    metricsHtml += `
      <div class="metric">
        <div class="metric-value">${d.pm1 ?? "--"}</div>
        <div class="metric-label">PM1.0</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.pm25 ?? "--"}</div>
        <div class="metric-label">PM2.5</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.pm10 ?? "--"}</div>
        <div class="metric-label">PM10</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.avg_particle_size ?? "--"} μm</div>
        <div class="metric-label">Avg Particle Size</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.nc0_5 ?? "--"} /L</div>
        <div class="metric-label">NC 0.5</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.nc1_0 ?? "--"} /L</div>
        <div class="metric-label">NC 1.0</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.nc2_5 ?? "--"} /L</div>
        <div class="metric-label">NC 2.5</div>
      </div>
      <div class="metric">
        <div class="metric-value">${d.nc10 ?? "--"} /L</div>
        <div class="metric-label">NC 10</div>
      </div>
    `;
  }

  // Controls: only the three ECS devices are controllable now
  let controlsHtml = "";
  const controllableIDs = ["ecs_1", "ecs_2", "ecs_3"];
  if (controllableIDs.includes(sensorId)) {
    controlsHtml += `
      <button class="control-btn ${d.relay1 ? "on" : "off"}" 
              onclick="sendCommand('${sensorId}', 'relay1', ${!d.relay1})">
        Air Purifier: ${d.relay1 ? "ON" : "OFF"}
      </button>
    `;
    controlsHtml += `
      <button class="control-btn ${d.relay2 ? "on" : "off"}" 
              onclick="sendCommand('${sensorId}', 'relay2', ${!d.relay2})">
        Dehumidifier: ${d.relay2 ? "ON" : "OFF"}
      </button>
    `;
  }

  card.innerHTML = `
    <div class="card-title">
      <div class="device-icon ${iconClass}">${icon}</div>
      <div>
        <div>${deviceType}</div>
        <div style="font-size: 0.9rem; font-weight: normal; color: #666;">
          ${sensorId.toUpperCase()}
        </div>
      </div>
    </div>
    <div class="metrics-grid">
      ${metricsHtml}
    </div>
    <div class="controls">
      ${controlsHtml}
    </div>
    <div class="timestamp">
      Last Updated: ${new Date(d.timestamp).toLocaleString()}
    </div>
  `;
  return card;
}

// Modal for schedule (calendar icon)
function showScheduleModal(sensorId, sensorData) {
  // Remove existing modal if any
  const old = document.getElementById("device-detail-modal");
  if (old) old.remove();

  // Modal container
  const modal = document.createElement("div");
  modal.id = "device-detail-modal";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100vw";
  modal.style.height = "100vh";
  modal.style.background = "rgba(0,0,0,0.45)";
  modal.style.zIndex = "9999";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";

  // Modal content
  const content = document.createElement("div");
  content.style.background = "#23272f";
  content.style.borderRadius = "18px";
  content.style.padding = "24px 8px 16px 8px";
  content.style.minWidth = "0";
  content.style.width = "95vw";
  content.style.maxWidth = "420px";
  content.style.boxShadow = "0 8px 32px rgba(0,0,0,0.25)";
  content.style.position = "relative";
  content.style.height = "80vh";
  content.style.overflowY = "auto";

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "12px";
  closeBtn.style.right = "18px";
  closeBtn.style.background = "none";
  closeBtn.style.border = "none";
  closeBtn.style.fontSize = "2rem";
  closeBtn.style.color = "#fff";
  closeBtn.style.cursor = "pointer";
  closeBtn.onclick = () => modal.remove();
  content.appendChild(closeBtn);

  // Title
  const title = document.createElement("h2");
  title.textContent = `${sensorId.toUpperCase()} Schedules`;
  title.style.marginBottom = "12px";
  title.style.color = "#fff";
  content.appendChild(title);

  // List container
  const schedList = document.createElement("div");
  schedList.style.marginTop = "18px";
  content.appendChild(schedList);

  // State
  let schedules = [];
  const dayShort = ["S", "M", "T", "W", "T", "F", "S"];

  // DB helpers
  async function loadSchedulesFromDB(sensorId) {
    try {
      const { data, error } = await window.supabase
        .from("schedule")
        .select("*")
        .eq("sensor_id", sensorId)
        .order("id", { ascending: true });
      if (error) throw error;
      schedules = (data || []).map((row) => {
        // parse timer_on_duration / timer_off_duration (HH:MM:SS) into on/off hour/min (24h)
        let onHour = null,
          onMinute = null,
          offHour = null,
          offMinute = null;
        if (row.timer_on_duration) {
          const parts = row.timer_on_duration.split(":");
          onHour = parseInt(parts[0], 10) || 0;
          onMinute = parseInt(parts[1], 10) || 0;
        }
        if (row.timer_off_duration) {
          const parts2 = row.timer_off_duration.split(":");
          offHour = parseInt(parts2[0], 10) || 0;
          offMinute = parseInt(parts2[1], 10) || 0;
        }
        // For sorting/display choose ON time if available, otherwise OFF
        let hour = onHour !== null ? onHour : offHour !== null ? offHour : 8;
        let minute =
          onMinute !== null ? onMinute : offMinute !== null ? offMinute : 0;
        const days = [];
        if (row.sun) days.push(0);
        if (row.mon) days.push(1);
        if (row.tue) days.push(2);
        if (row.wed) days.push(3);
        if (row.thu) days.push(4);
        if (row.fri) days.push(5);
        if (row.sat) days.push(6);
        // build display strings
        const onStr =
          onHour !== null
            ? `${onHour.toString().padStart(2, "0")}:${(onMinute || 0)
                .toString()
                .padStart(2, "0")}`
            : null;
        const offStr =
          offHour !== null
            ? `${offHour.toString().padStart(2, "0")}:${(offMinute || 0)
                .toString()
                .padStart(2, "0")}`
            : null;
        const displayTime =
          onStr && offStr
            ? `${onStr} / ${offStr}`
            : onStr ||
              offStr ||
              `${hour.toString().padStart(2, "0")}:${minute
                .toString()
                .padStart(2, "0")}`;
        return {
          id: row.id,
          state: row.state,
          enable: row.enable,
          hour,
          minute,
          onHour,
          onMinute,
          offHour,
          offMinute,
          displayTime,
          days: days.length ? days : [1, 2, 3, 4, 5], // default weekdays
          setting: row.setting || "schedule",
          raw: row,
        };
      });
      renderSchedules();
    } catch (err) {
      console.error("Failed loading schedules", err);
      showNotification("Failed to load schedules", "error");
    }
  }

  async function saveScheduleToDB(sched) {
    try {
      // Accept either 24-hour (sched.hh24) or legacy sched.hour+ampm
      let hh = 0;
      if (typeof sched.hh24 !== "undefined" && sched.hh24 !== null) {
        hh = parseInt(sched.hh24, 10) || 0;
      } else {
        hh = parseInt(sched.hour, 10) || 0;
        // legacy am/pm support if present
        if (sched.ampm === "AM") {
          if (hh === 12) hh = 0;
        } else if (sched.ampm === "PM") {
          if (hh !== 12) hh = hh + 12;
        }
      }
      const mm = parseInt(sched.minute, 10) || 0;
      if (hh < 0) hh = 0;
      if (hh > 23) hh = hh % 24;
      const timeStr = `${hh.toString().padStart(2, "0")}:${mm
        .toString()
        .padStart(2, "0")}:00`;

      // store the time into the appropriate timer_* field depending on state
      const payload = {
        sensor_id: sensorId,
        target: sched.target || "relay1",
        state: !!sched.state,
        mon: !!(sched.days && sched.days.includes(1)),
        tue: !!(sched.days && sched.days.includes(2)),
        wed: !!(sched.days && sched.days.includes(3)),
        thu: !!(sched.days && sched.days.includes(4)),
        fri: !!(sched.days && sched.days.includes(5)),
        sat: !!(sched.days && sched.days.includes(6)),
        sun: !!(sched.days && sched.days.includes(0)),
        setting: sched.setting || "schedule",
        // prefer explicitly provided timer fields (from edit modal), otherwise fall back to single-time logic
        timer_on_duration:
          typeof sched.timer_on_duration !== "undefined" &&
          sched.timer_on_duration !== null
            ? sched.timer_on_duration
            : sched.state
            ? timeStr
            : null,
        timer_off_duration:
          typeof sched.timer_off_duration !== "undefined" &&
          sched.timer_off_duration !== null
            ? sched.timer_off_duration
            : sched.state
            ? null
            : timeStr,
        enable: !!sched.enable,
      };

      if (sched.id && sched.id !== -1) {
        const { error } = await window.supabase
          .from("schedule")
          .update(payload)
          .eq("id", sched.id);
        if (error) throw error;
        // Toggle relay using current sensor data's relay1 state if available
        await sendCommand(sensorId, "relay1", sensorData);
        showNotification("Schedule updated", "success");
      } else {
        const { error } = await window.supabase
          .from("schedule")
          .insert([payload]);
        await sendCommand(sensorId, "relay1", sensorData);
        if (error) throw error;
        showNotification("Schedule saved", "success");
      }
      await loadSchedulesFromDB(sensorId);
    } catch (err) {
      console.error("Failed to save schedule", err);
      showNotification("Failed to save schedule", "error");
    }
  }

  async function deleteScheduleFromDB(id) {
    try {
      const numericId = Number(id);
      const { error } = await window.supabase
        .from("schedule")
        .delete()
        .eq("id", numericId);
      await sendCommand(sensorId, "relay1", sensorData);
      if (error) throw error;
      showNotification("Schedule deleted", "success");
      await loadSchedulesFromDB(sensorId);
    } catch (err) {
      console.error("Failed to delete schedule", err);
      showNotification("Failed to delete schedule", "error");
    }
  }
  loadSchedulesFromDB(sensorId);
  function renderSchedules() {
    schedList.innerHTML = "";
    const titleDiv = document.createElement("div");
    titleDiv.style.fontWeight = "600";
    titleDiv.style.fontSize = "1.05em";
    titleDiv.style.color = "#fff";
    titleDiv.style.marginBottom = "6px";
    titleDiv.textContent = schedules.length ? "Schedules" : "No schedule";
    schedList.appendChild(titleDiv);

    console.log(schedules);

    const sorted = schedules.slice().sort((a, b) => {
      if (a.id !== b.id) return a.id - b.id;
      return a.id - b.id;
    });

    sorted.forEach((sched, idx) => {
      const item = document.createElement("div");
      item.style.display = "flex";
      item.style.flexDirection = "column";
      item.style.padding = "12px";
      item.style.marginBottom = "10px";
      item.style.background = sched.enable === false ? "#2a2d32" : "#2f3339";
      item.style.borderRadius = "12px";

      const top = document.createElement("div");
      top.style.display = "flex";
      top.style.justifyContent = "space-between";
      top.style.alignItems = "center";

      const timeStr =
        sched.displayTime ||
        `${sched.hour.toString().padStart(2, "0")}:${sched.minute
          .toString()
          .padStart(2, "0")}`;
      const left = document.createElement("div");
      left.innerHTML = `<div style="font-weight:600;color:#fff;font-size:1.05em;">${timeStr}</div><div style="margin-top:6px;color:#ccc;font-size:0.95em;"></div>`;
      // left.style.cursor = 'pointer';
      // left.onclick = () => showEditScheduleModal(schedules.indexOf(sched));

      const setting = document.createElement("button");
      setting.type = "button";
      setting.textContent = sched.setting;
      setting.style.padding = "6px 10px";
      setting.style.borderRadius = "12px";
      setting.style.border = "none";
      setting.style.cursor = "pointer";
      setting.style.textTransform = "capitalize";
      setting.className =
        sched.setting === "schedule" ? "control-btn" : "control-btn on";
      setting.onclick = async (e) => {
        e.stopPropagation();
        showEditScheduleModal(schedules.indexOf(sched));
      };
      left.appendChild(setting);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "8px";
      right.style.marginTop = "26px";

      const enableBtn = document.createElement("button");
      enableBtn.type = "button";
      enableBtn.textContent = sched.enable === false ? "Off" : "On";
      enableBtn.style.padding = "6px 10px";
      enableBtn.style.borderRadius = "12px";
      enableBtn.style.border = "none";
      enableBtn.style.cursor = "pointer";
      enableBtn.className =
        sched.enable === false ? "control-btn" : "control-btn on";
      enableBtn.onclick = async (e) => {
        e.stopPropagation();
        sched.enable = !(sched.enable !== false);
        if (sched.id && sched.id !== -1) {
          try {
            const { error } = await window.supabase
              .from("schedule")
              .update({ enable: !!sched.enable })
              .eq("id", sched.id);
            await sendCommand(sensorId, "relay1", sensorData);
            if (error) throw error;
            showNotification("Schedule updated", "success");
          } catch (err) {
            console.error(err);
            showNotification("Failed to update schedule", "error");
          }
          await loadSchedulesFromDB(sensorId);
        } else {
          renderSchedules();
        }
      };

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Delete";
      delBtn.style.padding = "6px 10px";
      delBtn.style.borderRadius = "12px";
      delBtn.style.border = "none";
      delBtn.style.cursor = "pointer";
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        if (sched.id && sched.id !== -1) {
          // if (!confirm('Delete this schedule?')) return;
          await deleteScheduleFromDB(sched.id);
        } else {
          schedules = schedules.filter((s) => s !== sched);
          renderSchedules();
        }
      };

      right.appendChild(enableBtn);
      right.appendChild(delBtn);

      top.appendChild(left);
      top.appendChild(right);
      item.appendChild(top);

      // days
      const daysRow = document.createElement("div");
      daysRow.style.marginTop = "8px";
      daysRow.style.display = "flex";
      daysRow.style.gap = "6px";
      daysRow.className = "days-row";
      dayShort.forEach((d, i) => {
        const pill = document.createElement("div");
        pill.textContent = d;
        pill.style.padding = "4px 8px";
        pill.style.borderRadius = "10px";
        pill.style.background =
          sched.setting === "timer"
            ? "#606160"
            : sched.days && sched.days.includes(i)
            ? "#56ab2f"
            : "#3a3f46";
        pill.style.color = "#fff";
        pill.style.fontSize = "0.9em";
        daysRow.appendChild(pill);
      });
      item.appendChild(daysRow);
      const id = document.createElement("div");
      id.style.marginTop = "20px";
      id.style.fontSize = "0.6em";
      id.style.color = "#888";
      id.style.position = "absolute";
      id.style.right = "15px";
      id.textContent = `ID: ${sched.id || "-"}`;
      daysRow.appendChild(id);

      schedList.appendChild(item);
    });
  }

  function showEditScheduleModal(idx) {
    const sched = schedules[idx];
    const existing = document.getElementById("edit-schedule-modal");
    if (existing) existing.remove();
    const overlay = document.createElement("div");
    overlay.id = "edit-schedule-modal";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.background = "rgba(0,0,0,0.45)";
    overlay.style.zIndex = "10001";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    const box = document.createElement("div");
    box.style.background = "#23272f";
    box.style.borderRadius = "12px";
    box.style.padding = "18px";
    box.style.width = "92vw";
    box.style.maxWidth = "420px";
    box.style.boxShadow = "0 8px 32px rgba(0,0,0,0.25)";
    box.style.position = "relative";
    const header = document.createElement("div");
    header.style.top = "12px";
    header.style.right = "18px";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "12px";
    box.appendChild(header);
    const title = document.createElement("h3");
    title.textContent =
      sched.id && sched.id !== -1 ? "Edit Schedule" : "New Schedule";
    title.style.color = "#fff";
    title.style.marginBottom = "12px";
    header.appendChild(title);

    // state toggle
    const stateBtn = document.createElement("button");
    stateBtn.type = "button";
    stateBtn.textContent = sched.enable ? "ON" : "OFF";
    stateBtn.style.marginBottom = "12px";
    stateBtn.className = sched.enable ? "control-btn on" : "control-btn";
    stateBtn.onclick = () => {
      sched.enable = !sched.enable;
      stateBtn.textContent = sched.enable ? "ON" : "OFF";
      stateBtn.className = sched.enable ? "control-btn on" : "control-btn";
    };
    const typeButton = document.createElement("button");
    typeButton.type = "button";
    // initialize setting if missing
    if (!sched.setting) sched.setting = "schedule";
    typeButton.textContent =
      sched.setting === "schedule" ? "Schedule" : "Timer";
    typeButton.style.marginBottom = "12px";
    typeButton.className =
      sched.setting === "schedule" ? "control-btn on" : "control-btn";
    typeButton.onclick = () => {
      // toggle between 'schedule' and 'timer'
      sched.setting = sched.setting === "schedule" ? "timer" : "schedule";
      typeButton.textContent =
        sched.setting === "schedule" ? "Schedule" : "Timer";
      typeButton.className =
        sched.setting === "schedule" ? "control-btn on" : "control-btn";
      daysWrap.style.display = sched.setting == "schedule" ? "flex" : "none";
      // update modal title to reflect type
      title.textContent =
        sched.setting === "schedule"
          ? sched.id && sched.id !== -1
            ? "Edit Schedule"
            : "New Schedule"
          : sched.id && sched.id !== -1
          ? "Edit Timer"
          : "New Timer";
    };
    // header.appendChild(stateBtn);
    box.appendChild(typeButton);

    // time selectors (24-hour) — provide ON and OFF time picks
    const timeRow = document.createElement("div");
    timeRow.style.display = "flex";
    timeRow.style.flexDirection = "row";
    timeRow.style.gap = "8px";
    timeRow.style.marginBottom = "12px";
    timeRow.style.justifyContent = "space-between";
    // compute defaults from existing sched.raw if available
    let defaultOnH = 8,
      defaultOnM = 0,
      defaultOffH = 18,
      defaultOffM = 0;
    if (sched && sched.raw) {
      if (sched.raw.timer_on_duration) {
        const parts = sched.raw.timer_on_duration.split(":");
        let hhVal = parseInt(parts[0], 10);
        let mmVal = parseInt(parts[1], 10);
        if (isNaN(hhVal)) hhVal = defaultOnH;
        if (isNaN(mmVal)) mmVal = defaultOnM;
        defaultOnH = hhVal;
        defaultOnM = mmVal;
      }
      if (sched.raw.timer_off_duration) {
        const parts2 = sched.raw.timer_off_duration.split(":");
        let hhVal2 = parseInt(parts2[0], 10);
        let mmVal2 = parseInt(parts2[1], 10);
        if (isNaN(hhVal2)) hhVal2 = defaultOffH;
        if (isNaN(mmVal2)) mmVal2 = defaultOffM;
        defaultOffH = hhVal2;
        defaultOffM = mmVal2;
      }
    }
    // ON time
    const onWrap = document.createElement("div");
    onWrap.style.display = "flex";
    onWrap.style.gap = "8px";
    onWrap.style.alignItems = "center";
    const onLabel = document.createElement("div");
    onLabel.textContent = "ON";
    onLabel.style.color = "#fff";
    onLabel.style.minWidth = "36px";
    onWrap.appendChild(onLabel);
    const onHH = document.createElement("select");
    onHH.style.padding = "8px";
    onHH.style.borderRadius = "8px";
    for (let i = 0; i < 24; i++) {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = i.toString().padStart(2, "0");
      if (i === defaultOnH) o.selected = true;
      onHH.appendChild(o);
    }
    const onMM = document.createElement("select");
    onMM.style.padding = "8px";
    onMM.style.borderRadius = "8px";
    [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].forEach((m) => {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = m.toString().padStart(2, "0");
      if (m === defaultOnM) o.selected = true;
      onMM.appendChild(o);
    });
    onWrap.appendChild(onHH);
    onWrap.appendChild(onMM);
    // Ensure the selects reflect the parsed defaults (hours/minutes) coming from timer_*_duration
    // (set as strings because option values are strings when read from the DOM)
    try {
      onHH.value = String(defaultOnH);
      onMM.value = String(defaultOnM);
    } catch (e) {
      // ignore if setting fails for any reason
    }

    // OFF time
    const offWrap = document.createElement("div");
    offWrap.style.display = "flex";
    offWrap.style.gap = "8px";
    offWrap.style.alignItems = "center";
    const offLabel = document.createElement("div");
    offLabel.textContent = "OFF";
    offLabel.style.color = "#fff";
    offLabel.style.minWidth = "36px";
    offWrap.appendChild(offLabel);
    const offHH = document.createElement("select");
    offHH.style.padding = "8px";
    offHH.style.borderRadius = "8px";
    for (let i = 0; i < 24; i++) {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = i.toString().padStart(2, "0");
      if (i === defaultOffH) o.selected = true;
      offHH.appendChild(o);
    }
    const offMM = document.createElement("select");
    offMM.style.padding = "8px";
    offMM.style.borderRadius = "8px";
    [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].forEach((m) => {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = m.toString().padStart(2, "0");
      if (m === defaultOffM) o.selected = true;
      offMM.appendChild(o);
    });
    offWrap.appendChild(offHH);
    offWrap.appendChild(offMM);
    try {
      offHH.value = String(defaultOffH);
      offMM.value = String(defaultOffM);
    } catch (e) {
      // ignore if setting fails for any reason
    }

    timeRow.appendChild(onWrap);
    timeRow.appendChild(offWrap);
    box.appendChild(timeRow);

    // days
    const daysWrapContainer = document.createElement("div");
    daysWrapContainer.style.display = "flex";
    daysWrapContainer.style.gap = "6px";
    daysWrapContainer.style.flexWrap = "wrap";
    daysWrapContainer.style.marginBottom = "12px";
    daysWrapContainer.style.height = "28px";
    const daysWrap = document.createElement("div");
    daysWrap.style.display = sched.setting == "schedule" ? "flex" : "none";
    daysWrap.style.gap = "6px";
    daysWrap.style.flexWrap = "wrap";
    daysWrap.style.marginBottom = "12px";
    daysWrap.style.width = "100%";
    daysWrapContainer.appendChild(daysWrap);
    dayShort.forEach((d, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = d;
      b.style.padding = "6px 10px";
      b.style.borderRadius = "8px";
      b.style.border = "none";
      b.style.cursor = "pointer";
      b.style.flexGrow = "1";
      if (sched.days && sched.days.includes(i)) {
        b.style.background = "#56ab2f";
      } else {
        b.style.background = "#353945";
      }
      b.onclick = () => {
        if (!sched.days) sched.days = [];
        if (sched.days.includes(i)) {
          sched.days = sched.days.filter((x) => x !== i);
          b.style.background = "#353945";
        } else {
          sched.days.push(i);
          b.style.background = "#56ab2f";
        }
      };
      daysWrap.appendChild(b);
    });
    box.appendChild(daysWrapContainer);

    // buttons
    const buttons = document.createElement("div");
    buttons.style.display = "flex";
    buttons.style.gap = "8px";
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "Save";
    save.className = "control-btn on";
    save.onclick = async () => {
      // Prepare two schedule objects: ON and OFF
      const onHour = parseInt(onHH.value, 10);
      const onMin = parseInt(onMM.value, 10);
      const offHour = parseInt(offHH.value, 10);
      const offMin = parseInt(offMM.value, 10);

      const baseDays = sched.days || [1, 2, 3, 4, 5];
      const enable = sched.enable !== false;

      // Build a single schedule row that contains both ON and OFF times
      const idToUse = sched.id && sched.id !== -1 ? sched.id : -1;
      const onTimeStr = `${onHour.toString().padStart(2, "0")}:${onMin
        .toString()
        .padStart(2, "0")}:00`;
      const offTimeStr = `${offHour.toString().padStart(2, "0")}:${offMin
        .toString()
        .padStart(2, "0")}:00`;

      const singleSched = Object.assign({}, sched, {
        id: idToUse,
        timer_on_duration: onTimeStr,
        timer_off_duration: offTimeStr,
        days: baseDays,
        enable,
      });

      // Save single row containing both times
      await saveScheduleToDB(singleSched);
      overlay.remove();
    };
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.className = "control-btn";
    cancel.onclick = () => {
      if (sched.id === -1) schedules = schedules.filter((s) => s !== sched);
      overlay.remove();
      renderSchedules();
    };
    buttons.appendChild(save);
    buttons.appendChild(cancel);
    box.appendChild(buttons);

    // close X
    const close = document.createElement("button");
    close.textContent = "×";
    close.style.position = "absolute";
    close.style.top = "8px";
    close.style.right = "10px";
    close.style.background = "none";
    close.style.border = "none";
    close.style.color = "#fff";
    close.style.fontSize = "1.3rem";
    close.onclick = () => {
      if (sched.id === -1) schedules = schedules.filter((s) => s !== sched);
      overlay.remove();
      renderSchedules();
    };
    box.appendChild(close);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // Top-right + button beside close (x)
  const addBtn = document.createElement("button");
  addBtn.title = "Add Schedule";
  addBtn.innerHTML = '<span style="font-size:1.7em;line-height:1;">＋</span>';
  addBtn.style.position = "absolute";
  addBtn.style.top = "12px";
  addBtn.style.right = "54px";
  addBtn.style.width = "40px";
  addBtn.style.height = "40px";
  addBtn.style.borderRadius = "50%";
  addBtn.style.background = "#56ab2f";
  addBtn.style.color = "#fff";
  addBtn.style.border = "none";
  addBtn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)";
  addBtn.style.zIndex = "1001";
  addBtn.style.cursor = "pointer";
  addBtn.style.display = "flex";
  addBtn.style.alignItems = "center";
  addBtn.style.justifyContent = "center";
  addBtn.onmouseenter = () => (addBtn.style.background = "#6fdc4b");
  addBtn.onmouseleave = () => (addBtn.style.background = "#56ab2f");
  addBtn.onclick = () => {
    // Allow adding multiple schedules (editing is now in a separate modal)
    schedules.push({
      id: -1,
      state: true, // ON/OFF action for IoT
      enable: true, // schedule enable by default
      hour: 8,
      minute: 0,
      hh24: 8,
      days: [1, 2, 3, 4, 5, 6, 0],
      setting: "schedule",
    });
    loadSchedulesFromDB(sensorId);
    renderSchedules();
    // Immediately open the edit modal for the new schedule
    showEditScheduleModal(schedules.length - 1);
  };
  content.appendChild(addBtn);

  // When modal closes, no need to remove addBtn (it's inside content)
  closeBtn.onclick = () => {
    modal.remove();
  };

  modal.appendChild(content);
  document.body.appendChild(modal);
}

// Show notification banner
export function showNotification(message, type) {
  const notification = document.createElement("div");
  notification.className = `alert-banner ${type}`;
  notification.textContent = message;
  notification.style.position = "fixed";
  notification.style.top = "20px";
  notification.style.right = "20px";
  notification.style.zIndex = "1000";
  notification.style.minWidth = "300px";

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Send command to Supabase (for control buttons)
export async function sendCommand(sensor_id, target, state) {
  try {
    const { error } = await window.supabase.from("commands").insert([
      {
        sensor_id: sensor_id,
        target: target,
        state: state,
        issued_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    showNotification(
      `✅ Command sent: ${sensor_id} → ${target} = ${state ? "ON" : "OFF"}`,
      "success"
    );
    setTimeout(fetchSensorData, 1000);
  } catch (error) {
    showNotification(`❌ Failed to send command: ${error.message}`, "error");
  }
}

// Make sendCommand and showNotification globally accessible for inline event handlers
window.sendCommand = sendCommand;
window.showNotification = showNotification;
// Expose schedule/timer modal openers so inline onclick handlers can call them
window.showScheduleModal = showScheduleModal;
