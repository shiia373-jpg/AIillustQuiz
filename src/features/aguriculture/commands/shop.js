const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { loadFarm, saveFarm } = require('../game/farmState');
const { CROPS } = require('../game/crops');
const { MAX_SLOTS, SLOT_UNLOCK_PRICES } = require('../game/mechanics');

// ショップ Embed を生成するヘルパー
function buildShopEmbed(farm) {
  const availableCrops = Object.values(CROPS).filter(c => farm.slots.length >= c.unlockLevel);

  const seedLines = availableCrops.map(c => {
    const owned = farm.seeds[c.id] ?? 0;
    return `${c.emoji} **${c.name}** — 種 ${c.seedPrice} G / 収穫 ${c.sellPrice} G～ （所持 ${owned} 個）`;
  });

  const nextSlot = farm.slots.length;
  const slotLine = nextSlot >= MAX_SLOTS
    ? 'スロットは最大まで解放済みです'
    : `スロット #${nextSlot + 1} 解放: **${SLOT_UNLOCK_PRICES[nextSlot]} G**`;

  return new EmbedBuilder()
    .setTitle('🛒 農場ショップ')
    .setColor(0x5C4A1E)
    .addFields(
      { name: '🌱 種（1個）', value: seedLines.join('\n'), inline: false },
      { name: '🔓 スロット解放', value: slotLine, inline: false },
      { name: '💰 所持コイン', value: `${farm.coins} G`, inline: true },
    )
    .setFooter({ text: '下のボタンで購入。種を多く持つほど連続で植えやすい！' });
}

// 種購入ボタンを生成するヘルパー
function buildButtons(farm) {
  const availableCrops = Object.values(CROPS).filter(c => farm.slots.length >= c.unlockLevel);
  const rows = [];

  // 種ボタン（5個まで1行に収まる Discord 制限を考慮して分割）
  const cropChunks = [];
  for (let i = 0; i < availableCrops.length; i += 5) {
    cropChunks.push(availableCrops.slice(i, i + 5));
  }
  for (const chunk of cropChunks) {
    const row = new ActionRowBuilder().addComponents(
      chunk.map(c =>
        new ButtonBuilder()
          .setCustomId(`farm_buy_${c.id}`)
          .setLabel(`${c.name} 種 (${c.seedPrice}G)`)
          .setEmoji(c.emoji)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(farm.coins < c.seedPrice)
      )
    );
    rows.push(row);
  }

  // スロット解放ボタン
  const nextSlot = farm.slots.length;
  if (nextSlot < MAX_SLOTS) {
    const price = SLOT_UNLOCK_PRICES[nextSlot];
    const unlockRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('farm_unlock_slot')
        .setLabel(`スロット #${nextSlot + 1} 解放 (${price}G)`)
        .setEmoji('🔓')
        .setStyle(ButtonStyle.Success)
        .setDisabled(farm.coins < price)
    );
    rows.push(unlockRow);
  }

  return rows.slice(0, 5); // Discord は ActionRow 最大5行
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('種の購入・スロット解放'),

  async execute(interaction) {
    const farm = await loadFarm(interaction.user.id);
    await interaction.reply({
      embeds: [buildShopEmbed(farm)],
      components: buildButtons(farm),
      ephemeral: true,
    });
  },

  // ショップボタンのハンドラ（index.js から handleButton 経由で呼ばれる）
  async handleShopButton(interaction) {
    const { customId } = interaction;

    if (customId === 'farm_unlock_slot') {
      const farm = await loadFarm(interaction.user.id);
      const nextSlot = farm.slots.length;
      if (nextSlot >= MAX_SLOTS) {
        return interaction.reply({ content: '❌ これ以上スロットを解放できません。', ephemeral: true });
      }
      const price = SLOT_UNLOCK_PRICES[nextSlot];
      if (farm.coins < price) {
        return interaction.reply({ content: `❌ コインが足りません。（必要: ${price} G）`, ephemeral: true });
      }
      farm.coins -= price;
      farm.slots.push({ crop: null, planted_at: null });
      await saveFarm(interaction.user.id, farm);

      await interaction.update({
        embeds: [buildShopEmbed(farm)],
        components: buildButtons(farm),
      });
      await interaction.followUp({
        content: `✅ スロット **#${nextSlot + 1}** を解放しました！（残り: ${farm.coins} G）`,
        ephemeral: true,
      });
      return;
    }

    if (customId.startsWith('farm_buy_')) {
      const cropId = customId.replace('farm_buy_', '');
      const crop = CROPS[cropId];
      if (!crop) return;

      const farm = await loadFarm(interaction.user.id);
      if (farm.coins < crop.seedPrice) {
        return interaction.reply({ content: `❌ コインが足りません。（必要: ${crop.seedPrice} G）`, ephemeral: true });
      }
      farm.coins -= crop.seedPrice;
      farm.seeds[cropId] = (farm.seeds[cropId] ?? 0) + 1;
      await saveFarm(interaction.user.id, farm);

      await interaction.update({
        embeds: [buildShopEmbed(farm)],
        components: buildButtons(farm),
      });
      await interaction.followUp({
        content: `✅ ${crop.emoji} **${crop.name}** の種を1個購入しました！（残り: ${farm.coins} G）`,
        ephemeral: true,
      });
    }
  },
};
