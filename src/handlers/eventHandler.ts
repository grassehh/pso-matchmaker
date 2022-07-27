export interface IEventHandler {
    name: string,
    once?: boolean,
    execute(event: any): Promise<void>
}