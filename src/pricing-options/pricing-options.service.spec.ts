import { NotFoundException } from "@nestjs/common";
import { PricingOptionsService } from './pricing-options.service';

describe('PricingOptionsService', () => {
    let repository: {
        findAllForPhotographer: jest.Mock;
        findById: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
    };
    let service: PricingOptionsService;

    const option = {
        id: 'option-1',
        photographerId: 'photographer-1',
        label: '30MP JPEG',
        price: {toString: () => '12.00'} as any,
    };

    beforeEach(() => {
        repository = {
            findAllForPhotographer: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
        service = new PricingOptionsService(repository as any);
    });

    describe('list', () => {
        it('returns options mapped with price as a number', async() => {
            repository.findAllForPhotographer.mockResolvedValue([option]);

            const result = await service.list('photographer-1');

            expect(result).toEqual([
                {id: 'option-1', photographerId: 'photographer-1', label: '30MP JPEG', price: 12},
            ]);
            expect(repository.findAllForPhotographer).toHaveBeenCalledWith('photographer-1');
        });
    });

    describe('create', () => {
        it('creates an option owned by the calling photographer', async() => {
            repository.create.mockResolvedValue(option);

            const result = await service.create('photographer-1', {label: '30MP JPEG', price: 12});

            expect(repository.create).toHaveBeenCalledWith({
                photographerId: 'photographer-1',
                label: '30MP JPEG',
                price: 12,
            });
            expect(result.price).toBe(12);
        });
    });

    describe('update', () => {
        it('throws NotFoundException when the option does not exist', async() => {
            repository.findById.mockResolvedValue(null);

            await expect(
                service.update('photographer-1', 'missing-id', {price: 20}),
            ).rejects.toThrow(NotFoundException);
            expect(repository.update).not.toHaveBeenCalled();
        });

        it('throws NotFoundException when the option belongs to a different photographer', async() => {
            repository.findById.mockResolvedValue({...option, photographerId: 'someone-else'});

            await expect(
                service.update('photographer-1', 'option-1', {price: 20}),
            ).rejects.toThrow(NotFoundException);
            expect(repository.update).not.toHaveBeenCalled();
        });

        it('updates the option when it belongs to calling photographer', async () => {
            repository.findById.mockResolvedValue(option);
            repository.update.mockResolvedValue({...option, price: {toString: () => '20.00'}});

            const result = await service.update('photographer-1', 'option-1', {price:20});

            expect(repository.update).toHaveBeenCalledWith('option-1', {price: 20});
            expect(result.price).toBe(20);
        });
    });

    describe('remove', () => {
        it('throws NotFoundException when the option belongs to a different photographer', async() => {
            repository.findById.mockResolvedValue({...option, photographerId: 'someone-else'});

            await expect(service.remove('photographer-1', 'option-1')).rejects.toThrow(
                NotFoundException,
            );
            expect(repository.delete).not.toHaveBeenCalled();
        });

        it('deletes the option when it belongs to the calling photographer', async() => {
            repository.findById.mockResolvedValue(option);

            await service.remove('photographer-1', 'option-1');

            expect(repository.delete).toHaveBeenCalledWith('option-1');
        });
    });
});