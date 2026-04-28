const path = require('path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { buildFarmPayload } = require('../aguriculture/game/farmView');
const { setGame } = require('../ai-illust-quiz/game/gameState');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of require('fs').readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) commands.push(command);
}

async function handleButton(interaction) {
  const { customId } = interaction;

  if (customId === 'menu_farm') {
    await interaction.deferReply();
    const payload = await buildFarmPayload(interaction.user.id);
    await interaction.editReply(payload);
    return;
  }

  if (customId === 'menu_quiz') {
    const roundButtons = [1, 3, 5, 7, 10].map(n =>
      new ButtonBuilder()
        .setCustomId(`menu_quiz_rounds_${n}`)
        .setLabel(`${n}ラウンド`)
        .setStyle(ButtonStyle.Primary),
    );
    const row = new ActionRowBuilder().addComponents(...roundButtons);
    const embed = new EmbedBuilder()
      .setTitle('🎨 AIイラストクイズ')
      .setDescription('ラウンド数を選んでください')
      .setColor(0x5865f2);
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    return;
  }

  if (customId.startsWith('menu_quiz_rounds_')) {
    const totalRounds = parseInt(customId.replace('menu_quiz_rounds_', ''), 10);
    setGame(interaction.guildId, {
      answer: null,
      answers: [],
      hints: [],
      imageAttachment: null,
      quizmasterId: interaction.user.id,
      totalRounds,
    });

    const startBtn = new ButtonBuilder()
      .setCustomId('quiz_input_word')
      .setLabel('ラウンド1のお題を入力する')
      .setStyle(ButtonStyle.Primary);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle('🎨 AIイラストクイズ')
          .setDescription(`✅ 全${totalRounds}ラウンドで開始します！\nボタンを押してラウンド1のお題を入力してください。`)
          .setColor(0x5865f2),
      ],
      components: [new ActionRowBuilder().addComponents(startBtn)],
    });
  }
}

module.exports = { commands, handleButton };
