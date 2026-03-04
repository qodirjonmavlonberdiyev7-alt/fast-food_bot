import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Bot, BotDocument } from "src/schema/bot.schema";
import TelegramBot from "node-telegram-bot-api";

@Injectable()
export class BotService {
    private bot: TelegramBot;
    private readonly ownerId: number = Number(process.env.OWNER_ID as string);

    constructor(@InjectModel(Bot.name) private botModel: Model<BotDocument>) {
        this.bot = new TelegramBot(process.env.BOT_TOKEN as string, { polling: true });

        // 1️⃣ /start komandasi
        this.bot.onText(/\/start/, async (msg) => {
            const chatId: number = msg.from?.id as number;

            if (chatId === this.ownerId) {
                await this.bot.sendMessage(this.ownerId, "Siz bot egasi sifatida belgilangansiz!✅");
            }

            const foundedUser = await this.botModel.findOne({ chatId });

            if (!foundedUser) {
                await this.botModel.create({ name: msg.from?.first_name, chatId });
                return await this.bot.sendMessage(
                    chatId,
                    "🥳 Tabriklaymiz! Siz botimizdan ro'yxatdan o'tdingiz. /start tugmasini qayta bosing."
                );
            }

            // Foydalanuvchi mavjud bo'lsa — telefon so'raymiz
            await this.bot.sendMessage(foundedUser.chatId, "EVOS | Yetkazib berish botiga xush kelibsiz 🍽");
            await this.bot.sendMessage(
                foundedUser.chatId,
                "📲 Iltimos, telefon raqamingizni yuboring:",
                {
                    reply_markup: {
                        keyboard: [
                            [{ text: "📲 Telefon raqam yuborish", request_contact: true }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                }
            );
        });

        // 2️⃣ Kontakt kelganda — saqlab, location so'raymiz
        this.bot.on("contact", async (msg) => {
            const chatId = msg.from?.id as number;
            const phone = msg.contact?.phone_number;

            if (!phone) return;

            // Kontaktni bazaga saqlaymiz
            await this.botModel.findOneAndUpdate(
                { chatId },
                { phone },
                { new: true }
            );

            await this.bot.sendMessage(chatId, "Telefon raqamingiz qabul qilindi ✅");

            // Location so'raymiz
            await this.bot.sendMessage(
                chatId,
                "📍 Endi manzilingizni yuboring:",
                {
                    reply_markup: {
                        keyboard: [
                            [{ text: "📍 Joylashuvni yuborish", request_location: true }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                }
            );
        });

        // 3️⃣ Location kelganda — saqlab, tasdiqlаymiz
        this.bot.on("location", async (msg) => {
            const chatId = msg.from?.id as number;
            const location = msg.location;

            if (!location) return;

            // Locationni bazaga saqlaymiz
            await this.botModel.findOneAndUpdate(
                { chatId },
                {
                    location: {
                        latitude: location.latitude,
                        longitude: location.longitude
                    }
                },
                { new: true }
            );

            await this.bot.sendMessage(chatId, "Manzilingiz qabul qilindi ✅");
            await this.bot.sendMessage(chatId, "🛍 Endi buyurtma berishingiz mumkin!", {
                reply_markup: { remove_keyboard: true }
            });
        });
    }
}