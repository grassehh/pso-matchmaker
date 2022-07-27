import { MessageMentions } from "discord.js";

export async function handle<T>(promise: Promise<T>): Promise<[T | undefined, any]> {
    try {
        const data = await promise;
        return [data, undefined];
    } catch (error) {
        console.log(error);
        return [undefined, error];
    }
}

export function getUserIdFromMention(mention: string): string | null {
    const result = MessageMentions.USERS_PATTERN.exec(mention)
    MessageMentions.USERS_PATTERN.lastIndex = 0
    if (!result) return null
    return result[1]
}


export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}