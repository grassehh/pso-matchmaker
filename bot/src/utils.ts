export async function handle<T>(promise: Promise<T>): Promise<[T | undefined, any]> {
    try {
        const data = await promise;
        return [data, undefined];
    } catch (error) {
        console.log(error);
        return [undefined, error];
    }
}

export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

export function getOfficialDiscordIdByRegion(region: string): string {
    switch (region) {
        case 'EU':
            return process.env.PSO_EU_DISCORD_GUILD_ID as string;
        case 'NA':
            return process.env.PSO_NA_DISCORD_GUILD_ID as string;
        case 'SA':
            return process.env.PSO_SA_DISCORD_GUILD_ID as string;
        case 'AS':
            return process.env.PSO_AS_DISCORD_GUILD_ID as string;
        default:
            throw new Error(`Unknown region: ${region}`);
    }
}