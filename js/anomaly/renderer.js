import { GAME_STATE } from "./constants.js";

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawTile(ctx, cell, selectedCellId) {
  ctx.fillStyle = cell.fill;
  ctx.strokeStyle = cell.stroke;
  ctx.lineWidth = 2;

  roundRect(ctx, cell.x, cell.y, cell.width, cell.height, 10);
  ctx.fill();
  ctx.stroke();

  if (selectedCellId === cell.id) {
    ctx.strokeStyle = "#ff7746";
    ctx.lineWidth = 4;
    roundRect(ctx, cell.x + 2, cell.y + 2, cell.width - 4, cell.height - 4, 8);
    ctx.stroke();
  }

  const [temp, latency, errorRate] = cell.label.split("|");
  ctx.fillStyle = "rgba(16, 30, 27, 0.58)";
  ctx.font = "700 11px Menlo, Monaco, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`T ${temp}`, cell.x + cell.width / 2, cell.y + cell.height / 2 - 12);
  ctx.fillText(`L ${latency}`, cell.x + cell.width / 2, cell.y + cell.height / 2);
  ctx.fillText(`E ${errorRate}`, cell.x + cell.width / 2, cell.y + cell.height / 2 + 12);
}

function drawStateBanner(ctx, canvas, label, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = "700 30px Avenir Next";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

export function renderGameFrame(ctx, canvas, state) {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#f0f7f2");
  gradient.addColorStop(1, "#d7e8dd");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (state.activeGrid) {
    for (const cell of state.activeGrid.cells) {
      drawTile(ctx, cell, state.selectedCellId);
    }
  }

  if (state.status === GAME_STATE.LOADING) {
    drawStateBanner(ctx, canvas, "Loading...", "#3f5750");
  }

  if (state.status === GAME_STATE.PAUSED) {
    drawStateBanner(ctx, canvas, "Paused", "rgba(30, 44, 40, 0.72)");
  }

  if (state.status === GAME_STATE.OVER) {
    drawStateBanner(ctx, canvas, "Game Over", "rgba(126, 34, 31, 0.72)");
  }
}
