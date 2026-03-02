import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Bot, BotDocument } from "src/schema/bot.schema";
import TelegramBot from "node-telegram-bot-api"

@Injectable()
export class BotService {
    private bot: TelegramBot

    private readonly teacherId: number = Number(process.env.TEACHER_ID as string)
    constructor(@InjectModel(Bot.name) private botModel: Model<BotDocument>) {}
}