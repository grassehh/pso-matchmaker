import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, InteractionReplyOptions, Message, SlashCommandBuilder, TextChannel } from "discord.js";
import { MIN_DAYS_BETWEEN_TEAM_OFFERS } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { teamService } from "../../services/teamService";
import { interactionUtils } from "../../services/interactionUtils";
import { regionService } from "../../services/regionService";

export default {
    data: new SlashCommandBuilder()
        .setName('team_offer')
        .addAttachmentOption(option => option.setName("image")
            .setRequired(false)
            .setDescription("The logo image of the team"))
        .addStringOption(option => option.setName("discord_link")
            .setRequired(false)
            .setDescription("The Discord invitation link to your team"))
        .setDescription('Sends an offer message for your team on the regional community Discord'),
    async execute(interaction: ChatInputCommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        if (!team.hasCaptain(interaction.user.id)) {
            await interaction.reply({
                content: `⛔ You must be captain of this team in order to send an offer. Use the **/team_manage** command to edit captains list.`,
                ephemeral: true
            })
            return
        }

        let nextOfferDate = team.lastOfferDate.getTime() + MIN_DAYS_BETWEEN_TEAM_OFFERS * 24 * 60 * 60 * 1000;
        if (Date.now() < nextOfferDate) {
            await interaction.reply({
                content: `⛔ You can send another offer <t:${Math.floor(nextOfferDate / 1000)}:R>`,
                ephemeral: true
            })
            return
        }

        const teamImage = interaction.options.getAttachment("image") || undefined
        const teamDiscordLink = interaction.options.getString("discord_link") || undefined
        let teamOfferDescription: string

        const filter = (m: Message) => interaction.user.id === m.author.id
        const messageCollector = (interaction.channel as TextChannel).createMessageCollector({ filter, time: 5 * 60 * 1000 });
        messageCollector.on('collect', async m => {
            messageCollector.resetTimer()
            const sendActionRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`send_team_offer`)
                        .setLabel(`Send`)
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`cancel_team_offer`)
                        .setLabel(`Cancel`)
                        .setStyle(ButtonStyle.Danger)
                )
            await interaction.followUp({
                content: "Below is the preview of your offer message. \nIf you are happy with it, click on the **'Send'** button. \nIf not, simply re-write another description below.",
                components: [sendActionRow],
                ephemeral: true
            })
            teamOfferDescription = m.content
            let teamOfferMessage = interactionUtils.createTeamOfferMessage(team, teamOfferDescription, teamImage, teamDiscordLink) as InteractionReplyOptions
            teamOfferMessage.ephemeral = true
            await interaction.followUp(teamOfferMessage)
        })

        const messageComponentCollector = (interaction.channel as TextChannel).createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 5 * 60 * 1000
        });
        messageComponentCollector.on('collect', async i => {
            if (i.user.id === interaction.user.id) {
                if (i.customId === 'send_team_offer') {
                    await regionService.sendToTeamOffersChannel(interaction.client, team.region, interactionUtils.createTeamOfferMessage(team, teamOfferDescription, teamImage, teamDiscordLink))
                    await teamService.updateLastOfferDateByGuildId(team.guildId)
                    await i.update({ content: "✅ Your offer has been successfully sent !", components: [] })
                } else {
                    await i.update({ content: "❌ Your cancelled the team offer", components: [] })
                }

                messageCollector.stop()
                messageComponentCollector.stop()
            } else {
                i.reply({ content: `⛔ This button is not for you !`, ephemeral: true });
            }
        });

        await interaction.reply({ content: "Write down the text of your team offer below", ephemeral: true })
    }
} as ICommandHandler;
