import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, InteractionUpdateOptions, Message, StringSelectMenuBuilder, TextChannel } from "discord.js";
import { MAX_TEAM_CODE_LENGTH, MAX_TEAM_NAME_LENGTH } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { ITeam } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { regionService } from "../../services/regionService";
import { teamService, TeamType, TeamTypeHelper } from "../../services/teamService";

async function editTeamLogo(interaction: ButtonInteraction, guildId: string) {
    const filter = (m: Message) => interaction.user.id === m.author.id
    const collector = (interaction.channel as TextChannel).createMessageCollector({ filter, time: 20000 });
    let team = await teamService.findTeamByGuildId(guildId) as ITeam
    const teamWasVerified = team.verified
    let teamChanged = false
    collector.on('collect', async m => {
        if (m.content === 'delete') {
            team = await teamService.updateTeamLogo(guildId, null) as ITeam
        } else {
            const validatedTeamLogo = await teamService.sanitizeTeamLogo(interaction.client, guildId, m.content)
            if (!validatedTeamLogo) {
                await interaction.followUp({ content: '⛔ Only valid emojis are allowed (example: :flag_eu:)', ephemeral: true })
                collector.resetTimer()
                return
            }
            team = await teamService.updateTeamLogo(guildId, validatedTeamLogo) as ITeam
        }

        teamChanged = true
        collector.stop()
    })

    collector.on('end', async () => {
        if (teamChanged) {
            await interaction.followUp(interactionUtils.createTeamManagementReply(interaction, team))
            if (teamWasVerified) {
                teamService.notifyNoLongerVerified(interaction.client, team, 'Team logo changed')
            }
        } else {
            await interaction.followUp({ content: "Logo edition timed out...", ephemeral: true })
        }
    })
    await interaction.reply({ content: 'Enter your team logo (must be an emoji. Example: :flag_eu:)\nType **delete** to delete your logo.', ephemeral: true })
}

async function editTeamName(interaction: ButtonInteraction, guildId: string) {
    const filter = (m: Message) => interaction.user.id === m.author.id
    const collector = (interaction.channel as TextChannel).createMessageCollector({ filter, time: 20000 });
    let team = await teamService.findTeamByGuildId(guildId) as ITeam
    const teamWasVerified = team.verified
    let teamChanged = false
    collector.on('collect', async m => {
        const validatedTeamName = teamService.validateTeamName(m.content)
        if (!validatedTeamName) {
            await interaction.followUp({
                content: `⛔ Enter a team name that respects the following:
                    - Does not contain **emojis**
                    - Does not **already exists**
                    - Must be less than **${MAX_TEAM_NAME_LENGTH} characters**
                `,
                ephemeral: true
            })
            return
        }

        const duplicatedTeam = await teamService.findTeamByRegionAndName(team.region, validatedTeamName)
        if (duplicatedTeam && duplicatedTeam.guildId !== guildId) {
            await interaction.followUp({
                content: `⛔ Another team is already registered under the name **'${validatedTeamName}'**. Please chose another name.`,
                ephemeral: true
            })
            return
        }

        teamChanged = true
        team = await teamService.updateTeamName(guildId, validatedTeamName) as ITeam
        collector.stop()
    })

    collector.on('end', async () => {
        if (teamChanged) {
            await interaction.followUp(interactionUtils.createTeamManagementReply(interaction, team))
            if (teamWasVerified) {
                teamService.notifyNoLongerVerified(interaction.client, team, 'Team name changed')
            }
        } else {
            await interaction.followUp({ content: "Name edition timed out...", ephemeral: true })
        }
    })
    await interaction.reply({
        content: `
        Enter a team name that respects the following:
            - Does not contain **emojis**
            - Does not **already exists**
            - Must be less than **${MAX_TEAM_NAME_LENGTH} characters**
        `,
        ephemeral: true
    })
}

async function editTeamCode(interaction: ButtonInteraction, guildId: string) {
    const filter = (m: Message) => interaction.user.id === m.author.id
    const collector = (interaction.channel as TextChannel).createMessageCollector({ filter, time: 20000 });
    let team = await teamService.findTeamByGuildId(guildId) as ITeam
    const regionGuild = await regionService.getRegionGuild(interaction.client, team.region)
    const teamWasVerified = team.verified
    let teamChanged = false
    collector.on('collect', async m => {
        const validatedTeamCode = teamService.validateTeamCode(m.content)
        if (!validatedTeamCode) {
            await interaction.followUp({
                content: `⛔ Enter a team code that respects the following:
                    - Does not contain **emojis**
                    - Does not **already exists**
                    - Must be less than **${MAX_TEAM_CODE_LENGTH} characters**
                `, ephemeral: true
            })
            return
        }

        const duplicatedTeam = await teamService.findTeamByRegionAndCode(team.region, validatedTeamCode)
        if (duplicatedTeam && duplicatedTeam.guildId !== guildId) {
            await interaction.followUp({
                content: `⛔ Another team already has the code **'${validatedTeamCode}'**. Please chose another code.`,
                ephemeral: true
            })
            return
        }

        teamChanged = true
        team = await teamService.updateTeamCode(guildId, validatedTeamCode) as ITeam
        const allPlayers = team.players.concat(team.captains)
        for (const player of allPlayers) {
            await regionService.addTeamCodeToNickname(player.id, team, regionGuild)
        }
        collector.stop()
    })

    collector.on('end', async () => {
        if (teamChanged) {
            await interaction.followUp(interactionUtils.createTeamManagementReply(interaction, team))
            if (teamWasVerified) {
                teamService.notifyNoLongerVerified(interaction.client, team, 'Team code changed')
            }
        } else {
            await interaction.followUp({ content: "Code edition timed out...", ephemeral: true })
        }
    })
    await interaction.reply({
        content: `
        Enter a team code. It is a short name of your team. For example: "HyP" for "Hyperion".
        The code must respect the following:
            - Does not contain **emojis**
            - Does not **already exists**
            - Must be less than **${MAX_TEAM_CODE_LENGTH} characters**
        `, ephemeral: true
    })
}

async function editTeamType(interaction: ButtonInteraction, guildId: string) {
    const teamTypeActionRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`team_edit_type_${guildId}`)
                .setPlaceholder('Select a new type')
                .addOptions([
                    { label: `${TeamTypeHelper.toString(TeamType.CLUB)}`, value: TeamType.CLUB.toString() },
                    { label: `${TeamTypeHelper.toString(TeamType.NATION)}`, value: TeamType.NATION.toString() }
                ])
        )
    await interaction.reply({ components: [teamTypeActionRow], ephemeral: true })
}

async function editTeamVerification(interaction: ButtonInteraction) {
    const verify = interaction.customId.split('_')[3] === 'verify'
    const guildId = interaction.customId.split('_')[4]

    const team = (await teamService.verify(guildId, verify))!
    const informationEmbed = new EmbedBuilder()
        .setColor('#566573')
        .setTimestamp()
    if (verify) {
        informationEmbed.setTitle('✅ Team Verified !')
        informationEmbed.setDescription("Congratulations ! Your team has been verified and is now allowed to use ranked matchmaking.")
    } else {
        informationEmbed.setTitle('🛑 Team Unverified')
        const regionGuild = await regionService.getRegionGuild(interaction.client, team.region)
        informationEmbed.setDescription(`Your team has been unverified by the admins. You can no longer participate in ranked matches.\nPlease contact the admins of the regional ** ${regionGuild?.name} ** discord to get your team verified by providing your team id: ** ${team.guildId} **.`)
    }
    teamService.sendMessage(interaction.client, team.guildId, { embeds: [informationEmbed] })

    await interaction.update(interactionUtils.createTeamManagementReply(interaction, team) as InteractionUpdateOptions)

    informationEmbed.setFooter({ text: `Author: ${interaction.user.username}` })
    if (verify) {
        informationEmbed.setDescription(`${team.prettyPrintName()} has been verified`)
    } else {
        informationEmbed.setDescription(`${team.prettyPrintName()} has been unverified`)
    }
    await interaction.followUp({ embeds: [informationEmbed] })
}

async function editTeamUsers(interaction: ButtonInteraction, guildId: string, category: string) {
    const teamCaptainsActionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`team_users_add_${category}_${guildId}`)
                .setLabel(`Add ${category === 'captains' ? 'Captains' : 'Players'}`)
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`team_users_remove_${category}_${guildId}`)
                .setLabel(`Remove ${category === 'captains' ? 'Captains' : 'Players'}`)
                .setStyle(ButtonStyle.Danger)
        )
    await interaction.reply({ content: 'What do you want to do ?', components: [teamCaptainsActionRow], ephemeral: true })
}

export default {
    customId: 'team_manage_',
    async execute(interaction: ButtonInteraction) {
        const option = interaction.customId.split('_')[2]
        const guildId = interaction.customId.split('_')[3]
        switch (option) {
            case 'type':
                editTeamType(interaction, guildId)
                break
            case 'logo':
                editTeamLogo(interaction, guildId)
                break
            case 'name':
                editTeamName(interaction, guildId)
                break
            case 'code':
                editTeamCode(interaction, guildId)
                break
            case 'state':
                editTeamVerification(interaction)
                break
            case 'captains':
            case 'players':
                editTeamUsers(interaction, guildId, option)
                break
        }
    }
} as IButtonHandler
