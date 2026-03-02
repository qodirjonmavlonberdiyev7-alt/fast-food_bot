import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Bot, botSchema } from "src/schema/bot.schema";

@Module({
    imports: [MongooseModule.forFeature([{name: Bot.name, schema: botSchema}])],
    providers: []
})

export class BotModule {}