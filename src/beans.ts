import AuthorizationService from "./services/authorizationService";
import InteractionUtils from "./services/interactionUtils";
import MatchmakingService from "./services/matchmakingService";
import StatsService from "./services/statsService";
import TeamService from "./services/teamService";

export const matchmakingService = new MatchmakingService()
export const teamService = new TeamService()
export const statsService  = new StatsService()
export const interactionUtils = new InteractionUtils()
export const authorizationService = new AuthorizationService()