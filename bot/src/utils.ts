const emojiRegex = require('emoji-regex');

export async function handle<T>(promise: Promise<T>): Promise<[T | undefined, any]> {
    try {
        const data = await promise;
        return [data, undefined];
    } catch (error) {
        return [undefined, error];
    }
}

export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

export function getUnicodeEmojis(text: string): string[] {
    const regex = emojiRegex();
    let match;
    let emojis = [];
    while ((match = regex.exec(text)) != null) {
        emojis.push(match[0]);
    }

    return emojis
}