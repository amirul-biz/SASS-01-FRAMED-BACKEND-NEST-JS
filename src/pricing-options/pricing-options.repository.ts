import { Injectable } from "@nestjs/common";
import { PrismaService } from "../config/database/prisma.service";

@Injectable()
export class PricingOptionsRepository {
    constructor(private readonly prisma: PrismaService) {}

    findAllForPhotographer(photographerId: string) {
        return this.prisma.pricingOption.findMany({
            where: { photographerId },
            orderBy: { createdAt: 'asc' },
        });
    }

    findById(id: string) {
        return this.prisma.pricingOption.findUnique({where: {id}});
    }

    create(data: { photographerId: string; label: string; price: number }) {
        return this.prisma.pricingOption.create({data});
    }

    update(id: string, data: { label?: string; price?: number}) {
        return this.prisma.pricingOption.update({where: {id}, data});
    }

    delete(id: string) {
        return this.prisma.pricingOption.delete({where: {id}});
    }
}