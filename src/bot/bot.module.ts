import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Bot, botSchema } from "src/schema/bot.schema";
import { BotService } from "./bot.service";

@Module({
    imports: [MongooseModule.forFeature([{name: Bot.name, schema: botSchema}])],
    providers: [BotService]
})

export class BotModule {}