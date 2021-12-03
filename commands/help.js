const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Something you don\'t understand ?'),
    async execute(interaction) {
        const titleEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`What is PSO Matchmaker ?`)
            .setTimestamp()
            .addField(`PSO (Pro Soccer Online) Matchmaker is a discord bot that is here to help you create your own team with your friends and challenge other teams.`,            
            `Each Team can be a 'competitive' team (with members that wish to compete in turnaments for example), or a 'mix' team (with any PSO player mixed all together, like the :flag_eu: PSO EU team)`)

        const setupEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`How to set things up ?`)
            .setTimestamp()
            .addField('Team management', `
         **Creating** a **Team** is the first thing to do after you have invited me in your server.
         Each **Team** is associated with the Discord server where it was created.
         To **create** a **Team**, simply use the */register_team* command, then give it a name and a region.
         If you wish to **delete** your **Team** for any reason, use the */delete_team* command.`)
            .addField('Lineup management', `
         **Creating** a **Lineup** is the next step after creating your **Team**.
         A Lineup is associated with the Discord channel where it was created.
         To **create** a **Lineup**, simply use the */setup_lineup* command, and give it a size.

         You can also specify a name to your **Lineup**. This can be useful if you have multiple **Lineups** within you server, having the same size.
         You can enable the auto_search option if you want your **Lineup** to automatically register into the queue, and notify the other teams that you are looking for a match.
         
         Finally, if you wish to **delete** your **Lineup** for any reason, use the /delete_lineup command.

         *(calling the /setup_lineup command multiple time will override the existing lineup setup)*
         `)
         .addField('Command Permissions', `
            The following commands requires higher permissions to be used: 
            - **/delete_lineup**
            - **/delete_team**
            - **/register_team**
            - **/setup_lineup**
            - **/team_name**

            By Default, the Discord server administrator has access to all of these commands. If you wish to give someone else's permission for these commands, create a role named **'PSO MM ADMIN'** and give them.
         `)

        const matchmakingEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`How to use the matchmaking ?`)
            .setTimestamp()
            .addField('Want to see the teams that are looking for a match ?', `Use the **/challenges** command.`)
            .addField('Want other teams to be aware that you are looking for a match ?', `Use the **/search** command.`)
            .addField('Want to hide your team from other teams ?', `Use the **/stop_search** command.`)
            .addField('Want to sign into a specific position and see the current lineup ?', `Use the **/lineup** command.`)

        const otherEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`Other`)
            .setTimestamp()
            .addField('Want to add the bot to your server ?', `Click on this link: https://discord.com/api/oauth2/authorize?client_id=914818953707151420&permissions=2147904576&scope=applications.commands%20bot`)
            .addField('Any bugs or suggestions ?', 'Message grass#6639')

        await interaction.reply({
            embeds: [titleEmbed, setupEmbed, matchmakingEmbed, otherEmbed],
            ephemeral: true
        })
    },
};