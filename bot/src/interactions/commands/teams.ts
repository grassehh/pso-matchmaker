import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { ITeam } from "../../mongoSchema";
import { regionService } from "../../services/regionService";
import { teamService } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('teams')
        .setDescription('Display verified teams and their ids')
        .addUserOption(option => option.setName('player')
            .setRequired(false)
            .setDescription('Only display the team in which the given player is')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        if (!regionService.isOfficialDiscord(interaction.guildId!)) {
            await interaction.reply({ content: '⛔ Only official discords can use this command', ephemeral: true })
            return
        }

        const user = interaction.options.getUser('player')
        let teams: ITeam[] = []
        if (user) {
            teams = teams.concat(await teamService.findTeams(user.id))
        } else {
            teams = await teamService.findAllVerifiedTeams(regionService.getRegionByGuildId(interaction.guildId!)!)
        }

        const verifiedTeamsEmbed = new EmbedBuilder()
            .setTitle(user ? `${user.username} Team` : 'Verified Teams')
            .setDescription(teams.length === 0 ? 'No team found' : teams.map(team => `${team.logo ? team.logo : ''} **${team.name}** - ${team.guildId}`).join('\n'))
            .setColor('#566573')

        await interaction.reply({ embeds: [verifiedTeamsEmbed] })
    }
} as ICommandHandler;