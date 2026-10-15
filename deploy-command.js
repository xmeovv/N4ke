import 'dotenv/config';
import {
  REST, Routes, SlashCommandBuilder,
  ApplicationIntegrationType, InteractionContextType,
} from 'discord.js';

const integrationTypes = [
  ApplicationIntegrationType.UserInstall,
  ApplicationIntegrationType.GuildInstall,
];

const commands = [
  new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Delete every channel and rebuild the server')
    .addBooleanOption(o =>
      o.setName('spam')
        .setDescription('Spam the raid text in every new channel (default: true)')
        .setRequired(false))
    .addBooleanOption(o =>
      o.setName('roles')
        .setDescription('Also delete every deletable role (default: false)')
        .setRequired(false))
    .setIntegrationTypes(...integrationTypes)
    .setContexts(InteractionContextType.Guild),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all commands')
    .setIntegrationTypes(...integrationTypes)
    .setContexts(InteractionContextType.Guild),
].map(c => c.toJSON());

const appId = process.env.CLIENT_ID;

console.log('CLIENT_ID set?', Boolean(appId));

if (!appId) {
  console.error('ERROR: CLIENT_ID is missing!');
  process.exit(0);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

try {
  // WICHTIG: user-install commands MUESSEN global registriert werden
  console.log(`Registering ${commands.length} GLOBAL commands (up to 1h delay)...`);
  const data = await rest.put(Routes.applicationCommands(appId), { body: commands });
  console.log(`OK - registered ${data.length} commands.`);
} catch (err) {
  console.error('Registration failed:', err);
  process.exit(0);
}