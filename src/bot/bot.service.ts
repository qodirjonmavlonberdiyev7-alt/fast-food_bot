import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Bot, BotDocument } from "src/schema/bot.schema";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";

@Injectable()
export class BotService {
  private bot: TelegramBot;
  private readonly ownerId: number = Number(process.env.OWNER_ID as string);

  constructor(@InjectModel(Bot.name) private botModel: Model<BotDocument>) {
    this.bot = new TelegramBot(process.env.BOT_TOKEN as string, { polling: true });

    // ===================== INTERFACES =====================
    interface OrderItem {
      name: string;
      imageUrl: string;
      price: number;
    }

    interface MenuCategory {
      name: string;
      items: OrderItem[];
    }

    type BotDocumentExtended = BotDocument & {
      step?: "START" | "PHONE" | "LOCATION" | "CATEGORY" | "ITEM" | "ORDER_DONE";
      category?: string;
      order?: OrderItem[];
    };

    // ===================== MENU =====================
    const MENU: MenuCategory[] = [
      {
        name: "Ichimliklar",
        items: [
          {
            name: "Cola",
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Coca-Cola_bottle_and_glass.jpg/800px-Coca-Cola_bottle_and_glass.jpg",
            price: 5000,
          },
          {
            name: "Fanta",
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Fanta_Orange_-_Can_-_2023.jpg/800px-Fanta_Orange_-_Can_-_2023.jpg",
            price: 5000,
          },
          {
            name: "Sprite",
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Sprite_2022.jpg/800px-Sprite_2022.jpg",
            price: 5000,
          },
        ],
      },
      {
        name: "Shirinliklar",
        items: [
          {
            name: "Tort",
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Chocolate_mousse_cake_2.jpg/800px-Chocolate_mousse_cake_2.jpg",
            price: 10000,
          },
          {
            name: "Shokolad",
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Chocolate_%28blue_background%29.jpg/800px-Chocolate_%28blue_background%29.jpg",
            price: 8000,
          },
        ],
      },
      {
        name: "Fast-Food",
        items: [
          {
            name: "Burger",
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png",
            price: 15000,
          },
          {
            name: "Fries",
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Smiley-fries.jpg/800px-Smiley-fries.jpg",
            price: 7000,
          },
        ],
      },
    ];

    // ===================== /START =====================
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.from?.id as number;

      if (chatId === this.ownerId) {
        await this.bot.sendMessage(chatId, "Siz bot egasi sifatida belgilangansiz!✅");
      }

      let user = await this.botModel.findOne({ chatId }) as BotDocumentExtended;

      if (!user) {
        user = await this.botModel.create({ name: msg.from?.first_name, chatId }) as BotDocumentExtended;
      }

      await this.botModel.findOneAndUpdate({ chatId }, { step: "PHONE" });

      await this.bot.sendMessage(chatId, "EVOS | Yetkazib berish botiga xush kelibsiz 🍽");
      await this.bot.sendMessage(chatId, "📲 Iltimos, telefon raqamingizni yuboring:", {
        reply_markup: {
          keyboard: [[{ text: "📲 Telefon raqam yuborish", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    });

    // ===================== CONTACT =====================
    this.bot.on("contact", async (msg) => {
      const chatId = msg.from?.id as number;
      const phone = msg.contact?.phone_number;
      if (!phone) return;

      await this.botModel.findOneAndUpdate({ chatId }, { phone, step: "LOCATION" });

      await this.bot.sendMessage(chatId, "Telefon raqamingiz qabul qilindi ✅");
      await this.bot.sendMessage(chatId, "📍 Endi manzilingizni yuboring:", {
        reply_markup: {
          keyboard: [[{ text: "📍 Joylashuvni yuborish", request_location: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    });

    // ===================== LOCATION =====================
    this.bot.on("location", async (msg) => {
      const chatId = msg.from?.id as number;
      const loc = msg.location;
      if (!loc) return;
      const { latitude, longitude } = loc;

      let address = "Manzil aniqlanmadi";
      try {
        const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
          params: { format: "json", lat: latitude, lon: longitude },
          headers: { "User-Agent": "fast-food-bot" },
        });
        address = (response.data as any).display_name ?? "Manzil topilmadi";
      } catch (e) {
        console.error("Geocoding error:", e.message);
      }

      await this.botModel.findOneAndUpdate({ chatId }, {
        location: { latitude, longitude, address },
        step: "CATEGORY",
      });

      await this.bot.sendMessage(chatId, `📍 Joylashuvingiz qabul qilindi ✅\n${address}`, {
        reply_markup: { remove_keyboard: true },
      });
      this.showMenuCategories(chatId);
    });

    // ===================== MESSAGE HANDLER =====================
    this.bot.on("message", async (msg) => {
      const chatId = msg.from?.id as number;
      const text = msg.text;
      const user = await this.botModel.findOne({ chatId }) as BotDocumentExtended;
      if (!user) return;

      // Zakaz tugatish
      if (text === "✅ Zakazni yakunlash") {
        if (!user.order || user.order.length === 0) {
          return await this.bot.sendMessage(chatId, "Siz hali hech narsa tanlamadingiz ❌");
        }
        const total = user.order.reduce((sum, i) => sum + i.price, 0);
        let orderText = "Sizning zakazingiz:\n";
        user.order.forEach(i => { orderText += `${i.name} - ${i.price} so'm\n`; });
        orderText += `Umumiy summa: ${total} so'm`;

        await this.bot.sendMessage(chatId, orderText, { reply_markup: { remove_keyboard: true } });
        await this.bot.sendMessage(this.ownerId, `Yangi zakaz:\n${orderText}\nFrom: ${user.name} (${user.phone})`);

        await this.botModel.findOneAndUpdate({ chatId }, { step: "ORDER_DONE", order: [] });
        return;
      }

      // Kategoriya tanlash
      if (user.step === "CATEGORY") {
        const category = MENU.find(c => c.name === text);
        if (!category) return;

        await this.botModel.findOneAndUpdate({ chatId }, { category: category.name, step: "ITEM" });

        const buttons = category.items.map(i => [{ text: `${i.name} - ${i.price} so'm` }]);
        buttons.push([{ text: "⬅️ Orqaga" }], [{ text: "✅ Zakazni yakunlash" }]);
        return await this.bot.sendMessage(chatId, `🛒 ${category.name} dan mahsulot tanlang:`, {
          reply_markup: { keyboard: buttons, resize_keyboard: true, one_time_keyboard: true },
        });
      }

      // Mahsulot tanlash
      if (user.step === "ITEM" && user.category) {
        const category = MENU.find(c => c.name === user.category);
        if (!category) return;

        if (text === "⬅️ Orqaga") {
          return this.showMenuCategories(chatId);
        }

        const item = category.items.find(i => `${i.name} - ${i.price} so'm` === text);
        if (!item) return;

        // Savatga qo'shish
        const updatedOrder = user.order ? [...user.order, item] : [item];
        await this.botModel.findOneAndUpdate({ chatId }, { order: updatedOrder, step: "CATEGORY" });

        // ✅ Rasm yuborish — xato bo'lsa matn yuboradi
        try {
          await this.bot.sendPhoto(chatId, item.imageUrl, {
            caption: `${item.name} savatingizga qo'shildi ✅\nNarxi: ${item.price} so'm`,
          });
        } catch (err) {
          console.error("Rasm yuklanmadi:", err.message);
          await this.bot.sendMessage(
            chatId,
            `${item.name} savatingizga qo'shildi ✅\nNarxi: ${item.price} so'm`,
          );
        }

        // Kategoriya menyusini qayta ko'rsatish
        this.showMenuCategories(chatId);
        return;
      }
    });

    // ===================== HELPERS =====================
    this.showMenuCategories = async (chatId: number) => {
      const buttons = MENU.map(c => [{ text: c.name }]);
      buttons.push([{ text: "✅ Zakazni yakunlash" }]);
      await this.bot.sendMessage(chatId, "🍔 Kategoriya tanlang:", {
        reply_markup: { keyboard: buttons, resize_keyboard: true, one_time_keyboard: true },
      });
    };
  }

  private showMenuCategories: (chatId: number) => Promise<void>;
}