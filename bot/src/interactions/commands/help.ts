import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { ICommandHandler } from "../../handlers/commandHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Something you don\'t understand ?'),
    async execute(interaction: ChatInputCommandInteraction) {
        const titleEmbed = new EmbedBuilder()
            .setColor('#566573')
            .setTitle(`What is PSO Matchmaker ?`)
            .setTimestamp()
            .setDescription(`**PSO (Pro Soccer Online) Matchmaker** is a discord bot that is here to help you create your own **team** with your friends and challenge other **teams**. 
            Each **Team** can be a *competitive* team (with members that wish to compete in tournaments for example), or a *mix* team (with any PSO player mixed all together, like the :flag_eu: PSO EU team)`)


        const setupEmbed = new EmbedBuilder()
            .setColor('#566573')
            .setTitle(`How to create your own team ?`)
            .setTimestamp()
            .setDescription(`
                **1) Invite the bot on your discord**
                Click here [here](https://discord.com/api/oauth2/authorize?client_id=914818953707151420&permissions=2550295552&scope=applications.commands%20bot) to invite the bot on your discord server

                **2) Create your team**
                Use the **/team_create** command anywhere on your discord server to create your team. Make sure you select the correct region.

                **3) Create lineups**                
                On any channel in you discord server, use one of the following command to configure a lineup and get ready to play and face other teams
                **/lineup_create**: If you want to challenge other teams and mix
                **/lineup_create_mix**: If you want to play with your community only (not facing any team or mix)
                **/lineup_create_solo_queue**: Similar to **/lineup_create_mix**, but more anonymous. Players can't see who is signed in which position, and when the match starts, teams are shuffled based on each player rating
                **/lineup_create_captains**: If you want a Pick Up Game (PUG) with snake draft

                **4) Manage your team**
                Use the **/team_manage** command to edit your team at any time.
                You can edit the captains/players list, team logo, team type and more.
                Send recruitment offers for your team to the official Discord's mercato channel with the **/team_offer** command !

                **5) Command Permissions**
                The following commands require users to either be the server administrator or to have a role name '**PSO MM ADMIN**'
                - **/team_create**
                - **/team_manage**
                - **/team_region**
                - **/team_delete**
                - **/team_ban**
                - **/team_unban**
                - **/team_bans**
                - **/teams**                            
                - **/lineup_clear**
                - **/lineup_create**
                - **/lineup_create_mix**
                - **/lineup_create_solo_queue**
                - **/lineup_create_captains**
                - **/lineup_delete**
                - **/lineup_name**
                - **/match_manage**
                - **/player_ban**
                - **/player_unban**
                - **/player_bans**
                - **/player_stats_downgrade**
                - **/account_info**

                **6) Official Discords command permissions**
                The following commands can only be used on official regional discords. 
                - **/team_manage** with the *team_id* optional parameter
                - **/team_ban**
                - **/team_unban**
                - **/teams**
                - **/lineup_create_mix** with the *ranked* optional paramter set to **true**
                - **/lineup_create_solo_queue** with the *ranked* optional paramter set to **true**
                - **/lineup_create_captains** with the *ranked* optional paramter set to **true**
                - **/match_manage**
                - **/player_stats_downgrade**
                - **/account_info**
            `)

        const matchmakingEmbed = new EmbedBuilder()
            .setColor('#566573')
            .setTitle(`How to use the matchmaking ?`)
            .setTimestamp()
            .addFields(
                [
                    { name: 'Want to see the teams that are looking for a match ?', value: 'Use the **/challenges** command.' },
                    { name: 'Want other teams to be aware that you are looking for a match ?', value: 'Use the **/search** command.' },
                    { name: 'Want to hide your team from other teams ?', value: 'Use the **/stop_search** command.' },
                    { name: 'Want to sign in your lineup or see its status ?', value: 'Use the **/status** command.' }
                ]
            )

        const otherEmbed = new EmbedBuilder()
            .setColor('#566573')
            .setTitle(`Other`)
            .setTimestamp()
            .addFields([{ name: 'Want to report a bug or suggest a feature ?', value: 'Send a direct message to grass#6639' }])

        await interaction.reply({
            embeds: [titleEmbed, setupEmbed, matchmakingEmbed, otherEmbed],
            ephemeral: true
        })
    },
} as ICommandHandler