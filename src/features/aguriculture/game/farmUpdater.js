const { loadFarm, saveFarm, getAllFarmUserIds } = require('./farmState');

// 農場メッセージはエフェメラルになったため自動更新は不要。
// 起動時に全ユーザーの古い activeMessage 参照をクリアする。
async function clearOldFarmMessages() {
  let userIds;
  try {
    userIds = await getAllFarmUserIds();
  } catch {
    return;
  }

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

function startFarmUpdater(client, intervalMs = 30000) {
  // 起動時に一度だけ古い参照をクリア
  clearOldFarmMessages();
  console.log('🌾 農場自動更新: エフェメラル化により無効（古い参照をクリア済み）');
}

module.exports = { startFarmUpdater };
