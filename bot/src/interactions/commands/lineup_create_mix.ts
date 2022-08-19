import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { BOT_ADMIN_ROLE, MAX_LINEUP_NAME_LENGTH, MIN_LINEUP_SIZE_FOR_RANKED } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { LineupQueue } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { regionService } from "../../services/regionService";
import { LINEUP_TYPE_MIX, LINEUP_VISIBILITY_PUBLIC, LINEUP_VISIBILITY_TEAM, teamService } from "../../services/teamService";

export default {
    data:
        new SlashCommandBuilder()
            .setName('lineup_create_mix')
            .setDescription('Setup a mix lineup (allows mix vs mix matches)')
            .addIntegerOption(option => option.setName('size')
                .setRequired(true)
                .setDescription('The size of each mix lineups')
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
            .addStringOption(option => option.setName('name')
                .setRequired(false)
                .setDescription('Sets a name for this mix. Useful if you have multiple mixes inside your team'))
            .addBooleanOption(option => option.setName('allow_teams')
                .setRequired(false)
                .setDescription('If true, teams will be able to challenge the mix (replacing the blue blue)'))
            .addBooleanOption(option => option.setName('ranked')
                .setRequired(false)
                .setDescription('Indicates if this lineup is ranked and should update ratings')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        let lineupName = interaction.options.getString("name") || undefined
        if (lineupName && !teamService.validateLineupName(lineupName)) {
            await interaction.reply({
                content: `⛔ Please choose a name with less than ${MAX_LINEUP_NAME_LENGTH} characters.`,
                ephemeral: true
            })
            return
        }

        const lineupSize = interaction.options.getInteger("size")!
        const ranked = interaction.options.getBoolean("ranked") === true
        if (ranked) {
            if (!regionService.isOfficialDiscord(interaction.guildId!)) {
                await interaction.reply({ content: "⛔ Only official community discords can create ranked mixes", ephemeral: true })
                return
            }

            if (lineupSize < MIN_LINEUP_SIZE_FOR_RANKED) {
                await interaction.reply({ content: `⛔ Ranked lineups are only allowed for **${MIN_LINEUP_SIZE_FOR_RANKED}v${MIN_LINEUP_SIZE_FOR_RANKED}**`, ephemeral: true })
                return
            }
        }

        const allowTeams = interaction.options.getBoolean("allow_teams") === true
        const visibility = allowTeams ? LINEUP_VISIBILITY_PUBLIC : LINEUP_VISIBILITY_TEAM
        const lineup = teamService.createLineup(interaction.channelId, lineupSize, lineupName, true, ranked, team, LINEUP_TYPE_MIX, visibility, false)
        await teamService.upsertLineup(lineup)

        await matchmakingService.deleteLineupQueuesByChannelId(interaction.channelId)

        let lineupQueue
        if (allowTeams) {
            lineupQueue = await new LineupQueue({ lineup, ranked }).save()
        }

        let reply = await interactionUtils.createReplyForLineup(lineup, lineupQueue)
        reply.embeds?.splice(0, 0, interactionUtils.createInformationEmbed('✅ New mix lineup configured', interaction.user))
        await interaction.reply(reply);
    }
} as ICommandHandler;