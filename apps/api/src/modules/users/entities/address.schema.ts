import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// _id: false vì đây là subdocument nhúng, không cần id riêng, không tồn tại độc lập
@Schema({ _id: false })
export class Address {
    @Prop() street: string;
    @Prop() ward: string;
    @Prop() district: string;
    @Prop() city: string;
    @Prop() country: string;
}

export const AddressSchema = SchemaFactory.createForClass(Address);