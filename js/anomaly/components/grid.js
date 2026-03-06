export function createGridLayout(rows, cols, width, height, tileGap) {
  const totalGapX = tileGap * (cols + 1);
  const totalGapY = tileGap * (rows + 1);
  const tileWidth = (width - totalGapX) / cols;
  const tileHeight = (height - totalGapY) / rows;

  const cells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = tileGap + col * (tileWidth + tileGap);
      const y = tileGap + row * (tileHeight + tileGap);
      const id = `${row}:${col}`;

      cells.push({
        id,
        row,
        col,
        x,
        y,
        width: tileWidth,
        height: tileHeight
      });
    }
  }

  return {
    rows,
    cols,
    tileGap,
    tileWidth,
    tileHeight,
    cells
  };
}

export function locateCellAt(layout, x, y) {
  for (const cell of layout.cells) {
    const withinX = x >= cell.x && x <= cell.x + cell.width;
    const withinY = y >= cell.y && y <= cell.y + cell.height;

    if (withinX && withinY) {
      return cell;
    }
  }

  return null;
}
