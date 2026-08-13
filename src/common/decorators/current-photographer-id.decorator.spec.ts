import { BadRequestException, ExecutionContext } from "@nestjs/common";
import { currentPhotographerIdFactory } from './current-photographer-id.decorator';

function makeContext(headers: Record<string, string> = {}) {
    const request = {headers};
    return {
        switchToHttp: () => ({getRequest: () => request}),
    } as unknown as ExecutionContext;
}

describe ('currentPhotographerIdFactory', () => {
    it('returns the header value when present', () => {
        const context = makeContext({'x-photographer-id': 'photographer-1'});

        expect(currentPhotographerIdFactory(undefined, context)).toBe('photographer-1');
    });

    it('throws BadRequestException when the header is missing', () => {
        const context = makeContext();

        expect(() => currentPhotographerIdFactory(undefined, context)).toThrow(
            BadRequestException,
        );
    });

    it('throws BadRequestException when the header is blank', () => {
        const context = makeContext({'x-photographer-id' : '  '});

        expect(() => currentPhotographerIdFactory(undefined, context)).toThrow(
            BadRequestException,
        );
    });
});