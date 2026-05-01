const { loadFarm, saveFarm, getAllFarmUserIds } = require('./farmState');
const { getSlotStatus, calcHarvest, getLevelExp, getFarmBonus } = require('./mechanics');

const LV_AUTO      = 5;   // Lv.5以上 → 30分ごとに通常自動収穫
const LV_BEST      = 10;  // Lv.10以上 → 5分ごとにベストタイミング収穫

const INTERVAL_NORMAL = 30 * 60 * 1000; //  30分
const INTERVAL_BEST   =  5 * 60 * 1000; //   5分

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
// targetStatuses: 収穫対象のステータス配列
// label: ログ・通知用ラベル
async function autoHarvestUser(userId, targetStatuses, label) {
  try {
    const farm = await loadFarm(userId);
    if (!farm.level) return;

    const farmBonus = getFarmBonus(farm);
    let totalCoins = 0, totalExp = 0, count = 0;

    for (let i = 0; i < farm.slots.length; i++) {
      const slot   = farm.slots[i];
      const status = getSlotStatus(slot);
      if (!targetStatuses.includes(status)) continue;

      const result = calcHarvest(slot, false, farmBonus); // isManual=false
      if (!result) continue;

      totalCoins += result.coins;
      totalExp   += result.exp;
      count++;
      farm.coins += result.coins;
      farm.exp   += result.exp;
      farm.totalHarvests    = (farm.totalHarvests    ?? 0) + 1;
      farm.totalCoinsEarned = (farm.totalCoinsEarned ?? 0) + result.coins;
      farm.slots[i] = { crop: null, planted_at: null };
    }

    if (count === 0) return;

    // レベルアップ処理
    let needed = getLevelExp(farm.level);
    while (farm.exp >= needed) {
      farm.exp   -= needed;
      farm.level += 1;
      needed      = getLevelExp(farm.level);
    }

    // 通知をペンディングに積む（次回農場表示時に出す）
    if (!farm.autoHarvestPending) farm.autoHarvestPending = { coins: 0, exp: 0, count: 0, bestCount: 0 };
    farm.autoHarvestPending.coins += totalCoins;
    farm.autoHarvestPending.exp   += totalExp;
    farm.autoHarvestPending.count += count;
    if (label === 'best') farm.autoHarvestPending.bestCount = (farm.autoHarvestPending.bestCount ?? 0) + count;

    await saveFarm(userId, farm);
    console.log(`🤖 自動収穫[${label}] [${userId}] ${count}個 +${totalCoins}G +${totalExp}EXP`);
  } catch (err) {
    console.error(`[AutoHarvest Error] ${userId}:`, err);
  }
}

// 全ユーザーに対してノーマル収穫（Lv.5以上・30分ごと）
async function runNormalHarvest() {
  let userIds;
  try { userIds = await getAllFarmUserIds(); } catch { return; }
  for (const userId of userIds) {
    const farm = await loadFarm(userId).catch(() => null);
    if (!farm || (farm.level ?? 0) < LV_AUTO) continue;
    await autoHarvestUser(userId, ['optimal', 'ready', 'overripe'], 'normal');
  }
}

// 全ユーザーに対してベストタイミング収穫（Lv.10以上・5分ごと）
async function runBestHarvest() {
  let userIds;
  try { userIds = await getAllFarmUserIds(); } catch { return; }
  for (const userId of userIds) {
    const farm = await loadFarm(userId).catch(() => null);
    if (!farm || (farm.level ?? 0) < LV_BEST) continue;
    await autoHarvestUser(userId, ['optimal'], 'best');
  }
}

function startFarmUpdater(client) {
  clearOldFarmMessages();

  // 起動直後に1回ずつ実行
  runNormalHarvest().catch(console.error);
  runBestHarvest().catch(console.error);

  setInterval(() => runNormalHarvest().catch(console.error), INTERVAL_NORMAL);
  setInterval(() => runBestHarvest().catch(console.error),  INTERVAL_BEST);

  console.log(`🌾 自動収穫機 起動 — Lv.${LV_AUTO}+ 通常(30分) / Lv.${LV_BEST}+ ベスト(5分)`);
}

module.exports = { startFarmUpdater };
