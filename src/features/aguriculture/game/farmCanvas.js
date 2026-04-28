const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { CROPS } = require('./crops');
const {
  MAX_SLOTS,
  getSlotStatus,
  getGrowProgress,
  getTimeToReady,
  formatTime,
} = require('./mechanics');

const CELL_W   = 160;
const CELL_H   = 190;
const PAD      = 12;
const COLS     = 3;
const HEADER_H = 100;
const CANVAS_W = PAD + COLS * (CELL_W + PAD);

const PALETTE = {
  empty:    { bg: '#2E2416', border: '#6B5530', text: '#BBA060' },
  growing:  { bg: '#0E1F08', border: '#3D7A26', text: '#7ADA50', badge: '#1E4A10', badgeText: '#7ADA50' },
  optimal:  { bg: '#1A2A05', border: '#FFD700', text: '#FFD700', badge: '#4A3800', badgeText: '#FFD700' },
  ready:    { bg: '#0D200E', border: '#5CB85C', text: '#90EE90', badge: '#1A4020', badgeText: '#90EE90' },
  overripe: { bg: '#260C00', border: '#CC5500', text: '#FF7733', badge: '#3A1200', badgeText: '#FF7733' },
  locked:   { bg: '#0D0D0D', border: '#252525', text: '#3A3A3A' },
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

function drawBadge(ctx, text, rx, ty, bg, fg) {
  ctx.font = 'bold 10px sans-serif';
  const tw = ctx.measureText(text).width;
  const bw = tw + 12;
  const bh = 16;
  roundRect(ctx, rx - bw, ty, bw, bh, 4);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'right';
  ctx.fillText(text, rx - 6, ty + bh - 3);
}

function drawProgressBar(ctx, x, y, w, h, progress, color) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = '#0A0A0A';
  ctx.fill();

  if (progress > 0) {
    roundRect(ctx, x, y, Math.max(h, w * progress), h, h / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.fillStyle = '#FFFFFFCC';
  ctx.font = `bold ${h}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(progress * 100)}%`, x + w / 2, y + h - 1);
}

// 絵文字が描画できない環境向けのフォールバック（カラー丸＋頭文字）
function drawCropIcon(ctx, crop, cx, iconY, size) {
  const radius = size / 2;

  // 外周グロー
  ctx.shadowColor = crop.color;
  ctx.shadowBlur  = 10;
  ctx.beginPath();
  ctx.arc(cx, iconY, radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = crop.color + '22';
  ctx.fill();
  ctx.shadowBlur = 0;

  // 塗り円
  ctx.beginPath();
  ctx.arc(cx, iconY, radius, 0, Math.PI * 2);
  ctx.fillStyle = crop.color + '55';
  ctx.fill();
  ctx.strokeStyle = crop.color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 絵文字をレンダリング（サポートされていれば表示）
  ctx.font = `${size - 4}px sans-serif`;
  ctx.textAlign  = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle  = '#FFFFFF';
  ctx.fillText(crop.emoji, cx, iconY);
  ctx.textBaseline = 'alphabetic';
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

  // ── 背景 & 枠 ──
  if (status === 'optimal') {
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur  = 16;
  }
  roundRect(ctx, x, y, CELL_W, CELL_H, 12);
  ctx.fillStyle = pal.bg;
  ctx.fill();
  ctx.strokeStyle = pal.border;
  ctx.lineWidth   = status === 'optimal' ? 3 : 2;
  roundRect(ctx, x, y, CELL_W, CELL_H, 12);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ── スロット番号 ──
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font      = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`#${index + 1}`, x + 8, y + 16);

  // ── LOCKED ──
  if (isLocked) {
    ctx.fillStyle = pal.text;
    ctx.font      = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔒', cx, y + CELL_H / 2 - 10);
    ctx.textBaseline = 'alphabetic';
    ctx.font      = 'bold 12px sans-serif';
    ctx.fillText('LOCKED', cx, y + CELL_H / 2 + 18);
    return;
  }

  // ── 空きスロット ──
  if (status === 'empty') {
    ctx.fillStyle = pal.text;
    ctx.font      = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌱', cx, y + CELL_H / 2 - 8);
    ctx.textBaseline = 'alphabetic';
    ctx.font      = '12px sans-serif';
    ctx.fillText('空き', cx, y + CELL_H / 2 + 22);
    return;
  }

  const crop = CROPS[slot.crop];

  // ── 状態バッジ（右上）──
  if (pal.badge) {
    drawBadge(ctx, STATUS_LABELS[status], x + CELL_W - 6, y + 4, pal.badge, pal.badgeText);
  }

  // ── 作物アイコン（大きく中央）──
  const iconY = y + 70;
  drawCropIcon(ctx, crop, cx, iconY, 44);

  // ── 作物名 ──
  ctx.fillStyle = '#FFFFFF';
  ctx.font      = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(crop.name, cx, y + 104);

  // ── 売値プレビュー ──
  ctx.fillStyle = '#FFD700BB';
  ctx.font      = '11px sans-serif';
  ctx.fillText(`売値 ${crop.sell} G～`, cx, y + 120);

  // ── 育成中: 進捗バー + 残り時間 ──
  if (status === 'growing') {
    const progress  = getGrowProgress(slot);
    const remaining = getTimeToReady(slot);

    ctx.fillStyle = pal.text;
    ctx.font      = 'bold 13px sans-serif';
    ctx.fillText(formatTime(remaining), cx, y + 143);

    drawProgressBar(ctx, x + 10, y + 150, CELL_W - 20, 14, progress, '#3D9A20');

  // ── 収穫可能: ステータスメッセージ ──
  } else {
    const info = {
      optimal:  { line1: '⭐ BEST タイミング！', line2: '今すぐ収穫で最大ボーナス', color: '#FFD700' },
      ready:    { line1: '✅ 収穫できます',       line2: 'ベストは過ぎましたが大丈夫',  color: '#90EE90' },
      overripe: { line1: '⚠ 過熟中！',           line2: '早く収穫しないと損！',       color: '#FF7733' },
    }[status];

    if (info) {
      ctx.fillStyle = info.color;
      ctx.font      = 'bold 13px sans-serif';
      ctx.fillText(info.line1, cx, y + 146);
      ctx.fillStyle = info.color + 'AA';
      ctx.font      = '11px sans-serif';
      ctx.fillText(info.line2, cx, y + 163);
    }
  }
}

function generateFarmImage(farm) {
  const rows    = Math.ceil(MAX_SLOTS / COLS);
  const canvasH = HEADER_H + PAD + rows * (CELL_H + PAD) + PAD;
  const canvas  = createCanvas(CANVAS_W, canvasH);
  const ctx     = canvas.getContext('2d');

  // ── 背景グラデーション ──
  const bg = ctx.createLinearGradient(0, 0, 0, canvasH);
  bg.addColorStop(0, '#0A1505');
  bg.addColorStop(1, '#050E02');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, canvasH);

  // ── ヘッダー ──
  const hg = ctx.createLinearGradient(0, 0, CANVAS_W, HEADER_H);
  hg.addColorStop(0, '#1F4010');
  hg.addColorStop(1, '#0F2006');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, CANVAS_W, HEADER_H);

  ctx.strokeStyle = '#3D7A2650';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(CANVAS_W, HEADER_H);
  ctx.stroke();

  // タイトル
  ctx.fillStyle    = '#FFFFFF';
  ctx.font         = 'bold 26px sans-serif';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('🌾 農場', 16, 38);

  // コイン & レベル
  ctx.fillStyle = '#FFD700';
  ctx.font      = 'bold 17px sans-serif';
  ctx.fillText(`💰 ${farm.coins} G`, 16, 63);

  ctx.fillStyle = '#88DDFF';
  ctx.font      = 'bold 14px sans-serif';
  ctx.fillText(`⚡ Lv.${farm.level ?? 1}`, 16, 84);

  // 右側ステータス
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font      = '13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`収穫 ${farm.totalHarvests} 回`, CANVAS_W - 14, 38);
  ctx.fillText(`累計 ${farm.totalCoinsEarned} G`, CANVAS_W - 14, 58);
  ctx.fillText(`${farm.slots.length} / ${MAX_SLOTS} スロット`, CANVAS_W - 14, 78);

  // ── 各スロット ──
  for (let i = 0; i < MAX_SLOTS; i++) {
    const slot = farm.slots[i] ?? { crop: null, planted_at: null };
    drawSlot(ctx, slot, i, farm.slots.length);
  }

  return canvas.toBuffer('image/png');
}

module.exports = { generateFarmImage };
