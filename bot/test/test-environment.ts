import { MongoMemoryServer } from 'mongodb-memory-server';

import NodeEnvironment from 'jest-environment-node';
import mongoose from 'mongoose';

class TestEnvironment extends NodeEnvironment {
    private mongod: MongoMemoryServer | undefined;

    override async setup(): Promise<void> {
        this.mongod = await MongoMemoryServer.create()
        await mongoose.connect(this.mongod.getUri())
        console.log(this.mongod.getUri())
    }

    override async teardown(): Promise<void> {
        await mongoose.disconnect()
        await this.mongod?.stop()
    }
}

module.exports = TestEnvironment