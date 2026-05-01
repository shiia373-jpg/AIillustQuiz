const { loadFarm, saveFarm, getAllFarmUserIds } = require('./farmState');
const { getSlotStatus, calcHarvest, getLevelExp, getFarmBonus } = require('./mechanics');
const { CROPS } = require('./crops');

const AUTO_HARVEST_LEVEL = 5;   // この Lv 以上で自動収穫が動く
const INTERVAL_MS = 30 * 60 * 1000; // 30分

// 起動時に古い activeMessage 参照をクリア
async function clearOldFarmMessages() {
  let userIds;
  try { userIds = await getAllFarmUserIds(); } catch { return; }

  for (const userId of userIds) {
    try {
      const farm = await loadFarm(userId);
      if (farm.activeMessage) {
        farm.activeMessage = null;
        await saveFarm(userId, farm);
      }
    } catch { /* ignore */ }
  }
  console.log('🌾 古い農場メッセージ参照をクリアしました');
}

// 1ユーザーの自動収穫
async function autoHarvestUser(userId) {
  try {
    const farm = await loadFarm(userId);
    if (!farm.level || farm.level < AUTO_HARVEST_LEVEL) return;

    const farmBonus = getFarmBonus(farm);
    let totalCoins = 0, totalExp = 0, count = 0;

    for (let i = 0; i < farm.slots.length; i++) {
      const slot = farm.slots[i];
      const status = getSlotStatus(slot);
      if (status === 'optimal' || status === 'ready' || status === 'overripe') {
        const result = calcHarvest(slot, false, farmBonus); // isManual=false
        if (!result) continue;

        totalCoins += result.coins;
        totalExp   += result.exp;
        count++;
        farm.coins += result.coins;
        farm.exp   += result.exp;
        farm.totalHarvests   = (farm.totalHarvests   ?? 0) + 1;
        farm.totalCoinsEarned = (farm.totalCoinsEarned ?? 0) + result.coins;
        farm.slots[i] = { crop: null, planted_at: null };
      }
    }

    if (count === 0) return;

    // レベルアップ処理
    let needed = getLevelExp(farm.level);
    while (farm.exp >= needed) {
      farm.exp   -= needed;
      farm.level += 1;
      needed      = getLevelExp(farm.level);
    }

    // 自動収穫通知をペンディングに積む（次回農場表示時に出す）
    if (!farm.autoHarvestPending) farm.autoHarvestPending = { coins: 0, exp: 0, count: 0 };
    farm.autoHarvestPending.coins += totalCoins;
    farm.autoHarvestPending.exp   += totalExp;
    farm.autoHarvestPending.count += count;

    await saveFarm(userId, farm);
    console.log(`🤖 自動収穫 [${userId}] ${count}個 +${totalCoins}G +${totalExp}EXP`);
  } catch (err) {
    console.error(`[AutoHarvest Error] ${userId}:`, err);
  }
}

// 全ユーザーを対象に自動収穫
async function runAutoHarvest() {
  let userIds;
  try { userIds = await getAllFarmUserIds(); } catch { return; }
  for (const userId of userIds) {
    await autoHarvestUser(userId);
  }
}

function startFarmUpdater(client) {
  clearOldFarmMessages();

  // 起動後すぐに1回実行し、以降30分ごとに繰り返す
  runAutoHarvest().catch(console.error);
  setInterval(() => runAutoHarvest().catch(console.error), INTERVAL_MS);

  console.log(`🌾 自動収穫機 起動（Lv.${AUTO_HARVEST_LEVEL}以上が対象・30分ごと）`);
}

module.exports = { startFarmUpdater };
