const { createCanvas } = require('@napi-rs/canvas');
const { CROPS } = require('./crops');
const {
  MAX_SLOTS,
  getSlotStatus,
  getGrowProgress,
  getTimeToReady,
  formatTime,
} = require('./mechanics');

const CELL_W  = 160;
const CELL_H  = 170;
const PAD     = 12;
const COLS    = 3;
const HEADER_H = 100;
const CANVAS_W = PAD + COLS * (CELL_W + PAD);

const PALETTE = {
  empty:    { bg: '#2E2416', border: '#6B5530', label: '#BBA060', badge: null },
  growing:  { bg: '#112208', border: '#3D7A26', label: '#7ADA50', badge: '#2A6018', badgeText: '#7ADA50' },
  optimal:  { bg: '#1A2D08', border: '#FFD700', label: '#FFD700', badge: '#4A3A00', badgeText: '#FFD700' },
  ready:    { bg: '#0F2210', border: '#5CB85C', label: '#90EE90', badge: '#1A4020', badgeText: '#90EE90' },
  overripe: { bg: '#2A0E00', border: '#CC5500', label: '#FF7733', badge: '#3A1500', badgeText: '#FF7733' },
  locked:   { bg: '#0D0D0D', border: '#2A2A2A', label: '#444444', badge: null },
};

const STATUS_LABELS = {
  growing:  '🌱 育成中',
  optimal:  '⭐ BEST！',
  ready:    '✅ 収穫OK',
  overripe: '⚠ 過熟！',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawProgressBar(ctx, x, y, w, h, progress, color) {
  // 背景
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = '#111';
  ctx.fill();

  // 塗り（最小幅 = h でゼロでも見える）
  if (progress > 0) {
    const fillW = Math.max(h, w * progress);
    roundRect(ctx, x, y, fillW, h, h / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // パーセント表示
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${h + 2}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(progress * 100)}%`, x + w / 2, y + h - 1);
}

function drawBadge(ctx, label, x, y, bgColor, textColor) {
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'right';
  const textW = ctx.measureText(label).width;
  const bw = textW + 10;
  const bh = 16;
  const bx = x - bw;
  const by = y;

  roundRect(ctx, bx, by, bw, bh, 4);
  ctx.fillStyle = bgColor;
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.fillText(label, x - 5, by + bh - 3);
}

function drawSlot(ctx, slot, index, unlockedCount) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x   = PAD + col * (CELL_W + PAD);
  const y   = HEADER_H + PAD + row * (CELL_H + PAD);
  const cx  = x + CELL_W / 2;

  const isLocked = index >= unlockedCount;
  const status   = isLocked ? 'locked' : getSlotStatus(slot);
  const pal      = PALETTE[status];

  // ── 背景 ──
  if (status === 'optimal') {
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur  = 14;
  }
  roundRect(ctx, x, y, CELL_W, CELL_H, 10);
  ctx.fillStyle = pal.bg;
  ctx.fill();
  ctx.strokeStyle = pal.border;
  ctx.lineWidth   = status === 'optimal' ? 3 : 2;
  roundRect(ctx, x, y, CELL_W, CELL_H, 10);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ── スロット番号 ──
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font      = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`#${index + 1}`, x + 8, y + 16);

  // ── LOCKED ──
  if (isLocked) {
    ctx.fillStyle = pal.label;
    ctx.font      = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔒 LOCKED', cx, y + CELL_H / 2 + 5);
    return;
  }

  // ── 空き ──
  if (status === 'empty') {
    ctx.fillStyle = pal.label;
    ctx.font      = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('空き', cx, y + CELL_H / 2 + 5);
    return;
  }

  const crop = CROPS[slot.crop];

  // ── 状態バッジ（右上）──
  if (pal.badge) {
    drawBadge(ctx, STATUS_LABELS[status], x + CELL_W - 6, y + 4, pal.badge, pal.badgeText);
  }

  // ── 作物カラー帯（上部） ──
  roundRect(ctx, x + 1, y + 1, CELL_W - 2, 28, 10);
  ctx.fillStyle = crop.color + '44';
  ctx.fill();

  // ── 作物名（大きく中央）──
  ctx.fillStyle = '#FFFFFF';
  ctx.font      = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(crop.name, cx, y + 52);

  // ── 売値プレビュー ──
  ctx.fillStyle = '#FFD700AA';
  ctx.font      = '11px sans-serif';
  ctx.fillText(`売値 ${crop.sell}G～`, cx, y + 70);

  if (status === 'growing') {
    const progress  = getGrowProgress(slot);
    const remaining = getTimeToReady(slot);

    // 残り時間（大きく）
    ctx.fillStyle = pal.label;
    ctx.font      = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatTime(remaining), cx, y + 95);

    // プログレスバー
    const barX = x + 10;
    const barW = CELL_W - 20;
    drawProgressBar(ctx, barX, y + 102, barW, 14, progress, '#3D9A20');

  } else {
    // 大きなステータス表示
    const statusConfig = {
      optimal:  { text: '⭐ BEST タイミング！', color: '#FFD700', sub: '今すぐ収穫で最大ボーナス' },
      ready:    { text: '✅ 収穫できます',        color: '#90EE90', sub: 'そろそろ収穫しよう' },
      overripe: { text: '⚠ 過熟しています',       color: '#FF7733', sub: '早く収穫しないと損！' },
    };
    const sc = statusConfig[status];
    if (sc) {
      ctx.fillStyle = sc.color;
      ctx.font      = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sc.text, cx, y + 98);

      ctx.fillStyle = sc.color + 'AA';
      ctx.font      = '11px sans-serif';
      ctx.fillText(sc.sub, cx, y + 115);
    }
  }
}

function generateFarmImage(farm) {
  const rows    = Math.ceil(MAX_SLOTS / COLS);
  const canvasH = HEADER_H + PAD + rows * (CELL_H + PAD) + PAD;
  const canvas  = createCanvas(CANVAS_W, canvasH);
  const ctx     = canvas.getContext('2d');

  // ── 背景 ──
  ctx.fillStyle = '#0A1505';
  ctx.fillRect(0, 0, CANVAS_W, canvasH);

  // ── ヘッダー ──
  const grad = ctx.createLinearGradient(0, 0, CANVAS_W, HEADER_H);
  grad.addColorStop(0, '#1A3A0A');
  grad.addColorStop(1, '#0F2006');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, HEADER_H);

  // 区切り線
  ctx.strokeStyle = '#3D7A2640';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(CANVAS_W, HEADER_H);
  ctx.stroke();

  // タイトル
  ctx.fillStyle = '#FFFFFF';
  ctx.font      = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🌾 農場', 16, 38);

  // コイン
  ctx.fillStyle = '#FFD700';
  ctx.font      = 'bold 18px sans-serif';
  ctx.fillText(`💰 ${farm.coins} G`, 16, 64);

  // レベル
  ctx.fillStyle = '#88DDFF';
  ctx.font      = 'bold 14px sans-serif';
  ctx.fillText(`⚡ Lv.${farm.level ?? 1}`, 16, 86);

  // 右側ステータス
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font      = '13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`収穫 ${farm.totalHarvests} 回`, CANVAS_W - 14, 38);
  ctx.fillText(`累計 ${farm.totalCoinsEarned} G`, CANVAS_W - 14, 58);
  ctx.fillText(`${farm.slots.length} / ${MAX_SLOTS} スロット`, CANVAS_W - 14, 78);

  // ── スロット描画 ──
  for (let i = 0; i < MAX_SLOTS; i++) {
    const slot = farm.slots[i] ?? { crop: null, planted_at: null };
    drawSlot(ctx, slot, i, farm.slots.length);
  }

  return canvas.toBuffer('image/png');
}

module.exports = { generateFarmImage };
