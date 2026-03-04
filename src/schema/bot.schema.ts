import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

export type BotDocument = Bot & Document

@Schema({timestamps: true, versionKey: false})
export class Bot {
    @Prop({required: true})
    name: string;

    @Prop({required: true})
    chatId: number;

    @Prop({required: true})
    phone: string;

    @Prop({
        type: {
            latitude: {type: Number, default: null},
            longitude: {type: Number, default: null}
        },
        default: null
    })
    location: {
        latitude: number;
        longitude: number
    }
}

export const botSchema = SchemaFactory.createForClass(Bot)