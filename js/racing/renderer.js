import { RACING_STATUS } from "./logic.js";

function toSeconds(ms) {
  return `${(Math.max(0, ms) / 1000).toFixed(2)}s`;
}

function drawBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#95c9f5");
  gradient.addColorStop(1, "#bfe2ab");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(20, 60, 40, 0.1)";
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }
}

function drawTrack(ctx, track) {
  ctx.save();

  ctx.fillStyle = "#2f3f3b";
  ctx.beginPath();
  ctx.ellipse(track.centerX, track.centerY, track.outerRadiusX, track.outerRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#89bb6a";
  ctx.beginPath();
  ctx.ellipse(track.centerX, track.centerY, track.innerRadiusX, track.innerRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#f5f5f5";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.ellipse(
    track.centerX,
    track.centerY,
    (track.outerRadiusX + track.innerRadiusX) / 2,
    (track.outerRadiusY + track.innerRadiusY) / 2,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  const startYOuter = track.centerY - track.outerRadiusY;
  const startYInner = track.centerY - track.innerRadiusY;
  ctx.moveTo(track.centerX, startYOuter);
  ctx.lineTo(track.centerX, startYInner);
  ctx.stroke();

  ctx.restore();
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.heading);

  ctx.fillStyle = car.offTrack ? "#c58b2b" : "#e94f37";
  ctx.strokeStyle = "#4e120b";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-14, -10);
  ctx.lineTo(-18, 0);
  ctx.lineTo(-14, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffe8d8";
  ctx.fillRect(-5, -5, 10, 10);

  ctx.restore();
}

function drawReadyHint(ctx, width, height, status) {
  if (status !== RACING_STATUS.READY) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(10, 22, 28, 0.78)";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "700 28px 'Trebuchet MS', sans-serif";
  ctx.fillText("Top-Down Racing", width / 2, height / 2 - 12);
  ctx.font = "500 17px 'Trebuchet MS', sans-serif";
  ctx.fillText("Press Start Race or Space", width / 2, height / 2 + 22);
  ctx.restore();
}

export function createRacingRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to initialize 2D canvas context");
  }

  return {
    render(state) {
      drawBackground(ctx, canvas.width, canvas.height);
      drawTrack(ctx, state.track);
      drawCar(ctx, state.car);
      drawReadyHint(ctx, canvas.width, canvas.height, state.status);
    },
    updateHUD(state, ui) {
      const speedKmh = Math.max(0, state.car.speed) * 0.13;
      ui.statusValue.textContent = state.status;
      ui.lapValue.textContent = `${state.completedLaps} / ${state.config.lapTarget}`;
      ui.timerValue.textContent = toSeconds(state.elapsedMs);
      ui.currentLapValue.textContent = toSeconds(state.currentLapMs);
      ui.bestLapValue.textContent = state.bestLapMs ? toSeconds(state.bestLapMs) : "--";
      ui.speedValue.textContent = `${speedKmh.toFixed(0)} km/h`;
      ui.trackStateValue.textContent = state.car.offTrack ? "OFF TRACK" : "ON TRACK";
      ui.eventValue.textContent = state.eventMessage;

      ui.trackStateValue.classList.remove("is-safe", "is-warning");
      ui.trackStateValue.classList.add(state.car.offTrack ? "is-warning" : "is-safe");

      ui.pauseButton.disabled = state.status === RACING_STATUS.READY || state.status === RACING_STATUS.OVER;
      ui.startButton.textContent = state.status === RACING_STATUS.OVER ? "Start New Race" : "Start Race";
    }
  };
}
