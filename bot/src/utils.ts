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