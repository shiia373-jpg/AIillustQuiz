// 作物マスターデータ
// growTime: 成長時間(ms)
// optimalWindow: 収穫可能後のベストタイミング幅(ms) — この間に収穫するとS品質
// unlockLevel: この種が店に並ぶ解放スロット数条件
const CROPS = {
  wheat: {
    id: 'wheat',
    name: 'コムギ',
    emoji: '🌾',
    color: '#F5DEB3',
    seedPrice: 20,
    sellPrice: 35,
    growTime: 5 * 60 * 1000,
    optimalWindow: 3 * 60 * 1000,
    unlockLevel: 0,
  },
  carrot: {
    id: 'carrot',
    name: 'ニンジン',
    emoji: '🥕',
    color: '#FF6B35',
    seedPrice: 40,
    sellPrice: 80,
    growTime: 10 * 60 * 1000,
    optimalWindow: 5 * 60 * 1000,
    unlockLevel: 0,
  },
  tomato: {
    id: 'tomato',
    name: 'トマト',
    emoji: '🍅',
    color: '#FF3333',
    seedPrice: 80,
    sellPrice: 180,
    growTime: 20 * 60 * 1000,
    optimalWindow: 8 * 60 * 1000,
    unlockLevel: 2,
  },
  corn: {
    id: 'corn',
    name: 'トウモロコシ',
    emoji: '🌽',
    color: '#FFD700',
    seedPrice: 150,
    sellPrice: 380,
    growTime: 45 * 60 * 1000,
    optimalWindow: 15 * 60 * 1000,
    unlockLevel: 3,
  },
  strawberry: {
    id: 'strawberry',
    name: 'イチゴ',
    emoji: '🍓',
    color: '#FF69B4',
    seedPrice: 300,
    sellPrice: 800,
    growTime: 90 * 60 * 1000,
    optimalWindow: 20 * 60 * 1000,
    unlockLevel: 5,
  },
  pumpkin: {
    id: 'pumpkin',
    name: 'カボチャ',
    emoji: '🎃',
    color: '#FF8C00',
    seedPrice: 600,
    sellPrice: 1800,
    growTime: 3 * 60 * 60 * 1000,
    optimalWindow: 30 * 60 * 1000,
    unlockLevel: 7,
  },
};

module.exports = { CROPS };
