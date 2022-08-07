import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, Guild } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { LINEUP_TYPE_TEAM, LINEUP_VISIBILITY_PUBLIC, teamService } from "../../services/teamService";
import { getOfficialDiscordIdByRegion } from "../../utils";

export default {
    data:
        new SlashCommandBuilder()
            .setName('setup_lineup')
            .setDescription('Set the size of the team lineup to use for the selected channel')
            .addIntegerOption(option => option.setName('size')
                .setRequired(true)
                .setDescription('The size of the team lineup')
                .addChoices(
                    { name: '1', value: 1 },
                    { name: '2', value: 2 },
                    { name: '3', value: 3 },
                    { name: '4', value: 4 },
                    { name: '5', value: 5 },
                    { name: '6', value: 6 },
                    { name: '7', value: 7 },
                    { name: '8', value: 8 },
                    { name: '9', value: 9 },
                    { name: '10', value: 10 },
                    { name: '11', value: 11 }
                )
            )
            .addBooleanOption(option => option.setName('auto_search')
                .setRequired(false)
                .setDescription('Indicates if this lineup should automatically search for a team once it is filled'))
            .addBooleanOption(option => option.setName('allow_ranked')
                .setRequired(false)
                .setDescription('Indicates if this lineup allows to play ranked matches that would influence the team rating')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        let lineupQueue = await matchmakingService.findLineupQueueByChannelId(interaction.channelId) || undefined
        if (lineupQueue) {
            await interaction.reply(interactionUtils.createReplyAlreadyQueued(lineupQueue.lineup.size))
            return
        }

        const lineupSize = interaction.options.getInteger("size")!
        const autoSearch = interaction.options.getBoolean("auto_search") || false
        const allowRanked = interaction.options.getBoolean("allow_ranked") === true

        if (allowRanked && !team.verified) {
            const officialGuild = await interaction.client.guilds.fetch(getOfficialDiscordIdByRegion(team.region)) as Guild
            await interaction.reply({
                content: `
                ⛔ You are not allowed to create a ranked lineup because your team has not been verified. Please:                
                1. Manage your team using **/team_manage** command
                2. Contact the admins of the official **${officialGuild.name}** discord by providing your team id: **${team.guildId}**\n`
                , ephemeral: true
            })
            return
        }

        const lineup = teamService.createLineup(interaction.channelId, lineupSize, undefined, autoSearch, allowRanked, team, LINEUP_TYPE_TEAM, LINEUP_VISIBILITY_PUBLIC)
        await teamService.upsertLineup(lineup)

        let reply = await interactionUtils.createReplyForLineup(interaction, lineup, lineupQueue)
        reply.embeds?.splice(0, 0, interactionUtils.createInformationEmbed(interaction.user, '✅ New lineup configured'))
        await interaction.reply(reply);
    }
} as ICommandHandler