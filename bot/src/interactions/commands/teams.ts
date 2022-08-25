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
            .setDescription('Only display the team in which the given player is'))
        .addBooleanOption(option => option.setName('verified')
            .setRequired(false)
            .setDescription('Displays verified/unverified teams only')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        if (!regionService.isRegionalDiscord(interaction.guildId!)) {
            await interaction.reply({ content: '⛔ Only regional discords can use this command', ephemeral: true })
            return
        }

        const teamsEmbed = new EmbedBuilder()
            .setColor('#566573')
        const user = interaction.options.getUser('player')
        let teams: ITeam[] = []
        if (user) {
            teams = teams.concat(await teamService.findTeamsByUserId(user.id))
            teamsEmbed.setTitle(`${user.username} Teams`)
        } else {
            const verified = interaction.options.getBoolean("verified") !== null ? interaction.options.getBoolean("verified")! : true
            teams = await teamService.findTeamsByRegion(regionService.getRegionByGuildId(interaction.guildId!)!, verified)
            teamsEmbed.setTitle(`${verified ? 'Verified' : 'Unverified'} Teams`)
        }

        teamsEmbed.setDescription(teams.length === 0 ? 'No team found' : teams.map(team => `${team.logo ? team.logo : ''} **${team.name}** - ${team.guildId}`).join('\n'))

        await interaction.reply({ embeds: [teamsEmbed] })
    }
} as ICommandHandler;