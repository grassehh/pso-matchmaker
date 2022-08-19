import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { Team } from "../src/mongoSchema";

let mongod: MongoMemoryServer

export const dbConnect = async () => {
    mongod = await MongoMemoryServer.create()
    const uri = mongod.getUri();
    await mongoose.connect(uri);
};

export const dbDisconnect = async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
};

export const dbClean = async () => {
    await Team.deleteMany({})
};