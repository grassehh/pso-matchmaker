# pso-matchmaker
**pso-matchmaker** is a Discord bot initially developped for the game [Pro Soccer Online](https://store.steampowered.com/app/1583320/Pro_Soccer_Online/). You are free to fork it and use it for your own purpose, by adapting some of the text content in the code.

The purpose of this bot is to help players looking for competitive games to find matches and build up their own team.
Use the **/help** command to see a list of useful commands and how to use the bot.

## How to run the bot locally
- Install [NPM](https://www.npmjs.com/) and [NodeJS](https://nodejs.org/en/)
- Build the project using `npm run build`
- Create a **.env** file in the project root directory with at least the following variables
```
CLIENT_ID=<BOT CLIENT ID>
TOKEN=<BOT TOKEN ID>
MONGO_URI=<MONGO URI>
```
An additional **GUILD_ID** env variable can be used to deploy the commands on a specific guild (useful for test environment)
- Deploy the commands using `node build/scripts/deploys-commands.js`
- Start the bot with nodemon using `npm run dev`