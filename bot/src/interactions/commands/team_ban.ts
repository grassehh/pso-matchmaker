import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { ITeamBan, TeamBans } from "../../mongoSchema";
import { regionService } from "../../services/regionService";
import { teamService } from "../../services/teamService";
import parse from "parse-duration";

export default {
    data: new SlashCommandBuilder()
        .setName('team_ban')
        .setDescription('Ban a team from using the matchmaking')
        .addStringOption(option => option.setName('team_id')
            .setRequired(true)
            .setDescription('The ID of the team to ban'))
        .addStringOption(option => option.setName('reason')
            .setRequired(false)
            .setDescription('The reason of the ban'))
        .addStringOption(option => option.setName('duration')
            .setRequired(false)
            .setDescription('The duration of the ban (ex: 1d2h. Minimum 1h. Permanent ban if not specified)')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        if (!regionService.isRegionalDiscord(interaction.guildId!)) {
            await interaction.reply({ content: '⛔ Only regional discord are allowed to ban team', ephemeral: true })
            return
        }

        const guildId = interaction.options.getString('team_id')!
        if (guildId === interaction.guildId) {
            await interaction.reply({ content: `⛔ You surely don't want to ban your own team !`, ephemeral: true })
            return
        }

        const team = await teamService.findTeamByGuildId(guildId)
        if (!team) {
            await interaction.reply({ content: '⛔ This team does not exist', ephemeral: true })
            return
        }

        if (team.region !== regionService.getRegionByGuildId(interaction.guildId!)) {
            await interaction.reply({ content: '⛔ You are not allowed to ban a team that is not in your region', ephemeral: true })
            return
        }

        let duration = null
        const durationOption = interaction.options.getString('duration')
        if (durationOption != null) {
            duration = parse(durationOption)
            if (duration == null) {
                await interaction.reply({ content: `⛔ Unkown duration format ${durationOption}`, ephemeral: true })
                return
            }

            if (duration < 60 * 60 * 1000) {
                await interaction.reply({ content: `⛔ Please choose a duration greater than or equal to 1h`, ephemeral: true })
                return
            }
        }

        const reason = interaction.options.getString('reason') || undefined;
        const now = Date.now()
        const expireAt = duration ? new Date(now + duration) : undefined
        const ban = { region: team.region, guildId: team.guildId, reason, expireAt } as ITeamBan

        await TeamBans.updateOne({ guildId: team.guildId }, ban, { upsert: true })
        await teamService.notifyBanned(interaction.client, ban)
        await interaction.reply({ content: `The team ${team.prettyPrintName()} is now ${ban.expireAt ? `banned until **${ban.expireAt.toUTCString()}**` : '**permanently banned**'}` })
    }
} as ICommandHandler;