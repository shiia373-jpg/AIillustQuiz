const { CROPS } = require('./crops');

// 品質ランク定義 — 収穫タイミングで決まる
const QUALITY = {
  S: { label: 'S', emoji: '⭐', multiplier: 2.0 },
  A: { label: 'A', emoji: '✨', multiplier: 1.5 },
  B: { label: 'B', emoji: '👍', multiplier: 1.2 },
  C: { label: 'C', emoji: '😐', multiplier: 1.0 },
  D: { label: 'D', emoji: '😢', multiplier: 0.6 },
};

const MAX_SLOTS = 9;
const INITIAL_SLOTS = 2;

// 解放コスト: index = スロット番号 (0始まり)
const SLOT_UNLOCK_PRICES = [0, 0, 100, 250, 500, 1000, 2000, 4000, 8000];

/**
 * スロットの現在状態を返す
 * @returns {'empty'|'growing'|'optimal'|'ready'|'overripe'}
 */
function getSlotStatus(slot) {
  if (!slot || !slot.crop) return 'empty';
  const crop = CROPS[slot.crop];
  if (!crop) return 'empty';

  const elapsed = Date.now() - slot.planted_at;
  if (elapsed < crop.growTime) return 'growing';
  if (elapsed < crop.growTime + crop.optimalWindow) return 'optimal';
  if (elapsed < crop.growTime + crop.optimalWindow * 3) return 'ready';
  return 'overripe';
}

/**
 * 収穫タイミングから品質を決定する
 * @returns {Object|null} QUALITY のいずれか、または未収穫なら null
 */
function calcQuality(slot) {
  const status = getSlotStatus(slot);
  if (status === 'empty' || status === 'growing') return null;

  const crop = CROPS[slot.crop];
  const overtime = (Date.now() - slot.planted_at) - crop.growTime;

  if (overtime <= crop.optimalWindow * 0.5)  return QUALITY.S;
  if (overtime <= crop.optimalWindow)         return QUALITY.A;
  if (overtime <= crop.optimalWindow * 2)     return QUALITY.B;
  if (overtime <= crop.optimalWindow * 3)     return QUALITY.C;
  return QUALITY.D;
}

/**
 * 収穫時に得られるコインと内訳を計算する
 * @param {Object} slot
 * @param {boolean} isManual true なら手動収穫ボーナスを適用
 * @returns {{ coins: number, quality: Object, bonuses: string[] }|null}
 */
function calcHarvest(slot, isManual = true) {
  const crop = CROPS[slot.crop];
  const quality = calcQuality(slot);
  if (!quality) return null;

  let coins = crop.sellPrice * quality.multiplier;
  const bonuses = [];

  // 手動収穫ボーナス +20%
  if (isManual) {
    coins *= 1.2;
    bonuses.push('🤲 手動収穫 +20%');
  }

  // ベストタイミングボーナス（S品質のとき追加 +10%）
  if (quality.label === 'S') {
    coins *= 1.1;
    bonuses.push('🏆 ベストタイミング +10%');
  }

  return {
    coins: Math.floor(coins),
    quality,
    bonuses,
  };
}

/** 成長進捗 0.0〜1.0 */
function getGrowProgress(slot) {
  if (!slot || !slot.crop) return 0;
  const crop = CROPS[slot.crop];
  const elapsed = Date.now() - slot.planted_at;
  return Math.min(elapsed / crop.growTime, 1.0);
}

/** 収穫可能になるまでの残り時間(ms)、すでに可能なら 0 */
function getTimeToReady(slot) {
  if (!slot || !slot.crop) return null;
  const crop = CROPS[slot.crop];
  const remaining = crop.growTime - (Date.now() - slot.planted_at);
  return remaining > 0 ? remaining : 0;
}

/** ms を「X時間Y分Z秒」形式に変換 */
function formatTime(ms) {
  if (ms <= 0) return '今すぐ！';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

module.exports = {
  QUALITY,
  MAX_SLOTS,
  INITIAL_SLOTS,
  SLOT_UNLOCK_PRICES,
  getSlotStatus,
  calcQuality,
  calcHarvest,
  getGrowProgress,
  getTimeToReady,
  formatTime,
};
